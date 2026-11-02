// YappChat server (repo: retrochat). Auth hook: replace `identify()` later for accounts; media hook: add /api/media-token for LiveKit.
const express = require('express'), http = require('http'), { Server } = require('socket.io');
const acc = require('./accounts'), db = require('./db'), geo = require('./geo');
const app = express(), server = http.createServer(app);
app.set('trust proxy', 1);
const io = new Server(server, { maxHttpBufferSize: 1e5, allowRequest: (req, cb) => { const o = req.headers.origin; try { cb(null, !o || new URL(o).host === req.headers.host); } catch { cb(null, false); } } });
io.use(async (s, next) => { s.data.acct = await acc.userFromCookie(s.handshake.headers.cookie); next(); });
const ROOMS = { 'Lobby':'General','Friends':'General','Chit Chat':'General','Late Night':'General' };
const TOPICS = { 'Lobby':'Welcome! Pull up a chair and say hi','Friends':'Make new friends and catch up with old ones','Chit Chat':'Talk about anything and everything','Late Night':'For the night owls - who else is still up?' };
const MAXLEN = 300, HIST = 50, COLORS = ['#000000','#ff0000','#0000ff','#008000','#800080','#ff6600','#008080','#990033'];
const users = new Map(); const VERSION = 'v8.1-admin-cams'; // lower(name) -> socket.id
const history = Object.fromEntries(Object.keys(ROOMS).map(r => [r, []]));
// ---- user-created rooms (public, in memory; removed after ~10 min empty) ----
const UROOMS = new Map(); // name -> { owner, ownerLc, emptySince }
const OFFICIAL = new Set(Object.keys(ROOMS)), MAXU = 2, EMPTY_MS = 10 * 60e3;
const BAD = /(fuck|shit|bitch|cunt|nigg|fag|dick|cock|pussy|whore|slut|rape|nazi|porn|sex|penis|vagina|asshole|retard)/i;
const roomKey = n => String(n).toLowerCase().replace(/\s+/g, ' ').trim();
function roomNameError(n) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 '!?&.\-]{2,29}$/.test(n)) return 'Room names are 3-30 characters: letters, numbers, spaces and a little punctuation.';
  const k = roomKey(n); if ([...OFFICIAL].some(o => roomKey(o) === k) || [...UROOMS.keys()].some(o => roomKey(o) === k)) return 'A room with that name already exists.';
  if (BAD.test(n.replace(/[^a-z]/gi, ''))) return 'Please choose a different room name.';
  return null;
}
const cleanTopic = t => String(t || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100); // raw; client escapes
setInterval(() => { const now = Date.now(); for (const [n, r] of UROOMS) { if (members(n).length) r.emptySince = 0; else if (!r.emptySince) r.emptySince = now; else if (now - r.emptySince > EMPTY_MS) { UROOMS.delete(n); delete ROOMS[n]; delete TOPICS[n]; delete history[n]; } } }, 30e3).unref();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.use((req,res,next)=>{res.setHeader('Permissions-Policy','camera=(self), microphone=(self), display-capture=(self)');next()});
acc.http(app, express, { guestInUse: n => users.has(String(n).toLowerCase()) && !!io.sockets.sockets.get(users.get(String(n).toLowerCase()))?.data.guest });
app.use(express.static(__dirname + '/public'));
// ---- avatars: custom (uploaded / avatar-maker) images. Accounts -> Postgres `avatars`; guests -> memory for the session ----
const AVMEM = new Map(), PRESETS = ['a1','a2','a3','a4','a5','a6','a7','a8'], AVMAX = 32 * 1024;
const MAGIC = { 'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff, 'image/png': b => b.slice(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'image/webp': b => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' };
function parseAvatar(d) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(d || '').slice(0, 50000)); if (!m) return { error: 'Avatars must be a JPEG, PNG or WebP image.' };
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > AVMAX) return { error: 'That picture is too big (max 32 KB after resizing).' };
  if (buf.length < 50 || !MAGIC[m[1]](buf)) return { error: 'That file is not a valid image.' };
  return { mime: m[1], buf };
}
const AVCOL = ['#1877E8','#2468D7','#4AB7F2','#176FCF','#10234A','#8e44ad','#16a085','#d35400'];
function defaultAv(name) { const c = AVCOL[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVCOL.length], L = (name.match(/[A-Za-z]/) || ['?'])[0].toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="${c}"/><circle cx="48" cy="40" r="17" fill="#fff" opacity=".9"/><path d="M16 96c4-22 18-30 32-30s28 8 32 30z" fill="#fff" opacity=".9"/><text x="48" y="47" font-family="Arial,sans-serif" font-weight="bold" font-size="20" text-anchor="middle" fill="${c}">${L}</text></svg>`; }
app.get('/av/:name', async (req, res) => {
  const n = String(req.params.name || ''); if (!/^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(n)) return res.status(404).end();
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Cache-Control': req.query.v && req.query.v !== '0' ? 'public, max-age=86400, immutable' : 'no-cache' });
  let a = AVMEM.get(n.toLowerCase());
  if (!a && db.status().ready) { try { const r = await db.q('select a.mime,a.data from avatars a join users u on u.id=a.user_id where u.name_lc=$1', [n.toLowerCase()]); if (r[0]) a = { mime: r[0].mime, buf: r[0].data }; } catch { } }
  if (a) return res.type(a.mime).send(a.buf);
  res.type('image/svg+xml').send(defaultAv(n));
});
geo.admin(app, n => acc.isOnline(n) || users.has(String(n).toLowerCase()));
app.get('/healthz', (q, r) => r.send('ok')); app.get('/api/version', (q, r) => r.json({ version: VERSION }));
app.get('/api/rooms', (q, r) => r.json(Object.entries(ROOMS).map(([name, cat]) => ({ name, cat, topic: TOPICS[name], count: members(name).length, owner: UROOMS.get(name)?.owner || null }))));
function socks(room) { return [...io.sockets.adapter.rooms.get(room) || []].map(id => io.sockets.sockets.get(id)).filter(x => x && x.data.name); }
function members(room) { return socks(room).map(x => x.data.name).sort((a,b)=>a.localeCompare(b)); }
function roster(room) { return socks(room).map(x => ({ name: x.data.name, av: x.data.av || '', id: x.id, guest: !!x.data.guest, cam: !!x.data.cam, talk: !!x.data.talk, voice: !!x.data.voice, viewers: x.data.cam ? [...(x.data.viewers||[])].map(v => io.sockets.sockets.get(v)?.data.name).filter(Boolean) : [] })).sort((a,b)=>a.name.localeCompare(b.name)); }
function upd(room) { if (room) io.to(room).emit('roster', roster(room)); }
const MAXVIEW = 6;
function push(room, m) { m.t = m.t || Date.now(); history[room].push(m); if (history[room].length > HIST) history[room].shift(); io.to(room).emit('msg', m); }
io.on('connection', s => {
  let stamps = [];
  s.on('login', async ({ name, room }, cb) => {
    name = s.data.acct ? s.data.acct.name : String(name || '').trim();
    if (!s.data.acct) {
      if (!/^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(name)) return cb({ error: 'Guest names are 3-20 characters, start with a letter, and use letters, numbers, _ or .' });
      if (/^(admin|administrator|moderator|mod|support|system|yappchat|staff|root)/i.test(name)) return cb({ error: 'That screen name is not available.' });
      if (db.status().ready) { try { if ((await db.q('select 1 from users where name_lc=$1', [name.toLowerCase()])).length) return cb({ error: 'That screen name belongs to a registered user. Pick another guest name or sign in.' }); } catch { } }
      s.data.guest = true;
    }
    if (typeof cb !== 'function') return;
    if (!ROOMS[room]) return cb({ error: 'That room no longer exists.' });
    if (s.data.name) return cb({ error: 'Already signed in' });
    if (users.has(name.toLowerCase()) || (s.data.guest && acc.isOnline(name))) return cb({ error: 'That screen name is in use right now. Try another.' });
    users.set(name.toLowerCase(), s.id); s.data.name = name;
    if (s.data.acct && db.status().ready) { try { s.data.av = (await db.q('select avatar from users where id=$1', [s.data.acct.id]))[0]?.avatar || ''; } catch { } }
    { const ip = geo.clientIp(s.handshake.headers, s.handshake.address); if (s.data.guest) geo.recordGuest(name, ip).catch(() => {}); else if (s.data.acct) geo.recordAccount(s.data.acct.id, ip, 'room'); }
    join(room); cb({ ok: true, name, colors: COLORS, account: !!s.data.acct });
  });
  function join(room) {
    if (s.data.room) { s.leave(s.data.room); push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); io.to(s.data.room).emit('members', members(s.data.room)); }
    const old = s.data.room; mediaReset(); if (old) upd(old);
    s.data.room = room; s.join(room); s.emit('history', { room, topic: TOPICS[room], msgs: history[room], owner: UROOMS.get(room)?.owner || null });
    push(room, { sys: true, text: `${esc(s.data.name)} has joined the room.` }); io.to(room).emit('members', members(room)); upd(room);
  }
  s.on('create-room', ({ name, topic }, cb) => {
    if (typeof cb !== 'function') return; if (!s.data.acct) return cb({ error: 'Guests cannot create rooms. Get a free screen name to create one.' });
    name = String(name || '').replace(/\s+/g, ' ').trim(); const e = roomNameError(name); if (e) return cb({ error: e });
    const lc = s.data.acct.name.toLowerCase(); if ([...UROOMS.values()].filter(r => r.ownerLc === lc).length >= MAXU) return cb({ error: 'You can own at most ' + MAXU + ' rooms at a time.' });
    UROOMS.set(name, { owner: s.data.acct.name, ownerLc: lc, emptySince: Date.now() }); ROOMS[name] = 'User Rooms'; TOPICS[name] = cleanTopic(topic) || 'Welcome to ' + name; history[name] = [];
    cb({ ok: true, name }); if (s.data.name) join(name);
  });
  const isOwner = () => { const r = UROOMS.get(s.data.room); return r && s.data.acct && r.ownerLc === s.data.acct.name.toLowerCase(); };
  s.on('set-topic', (t, cb) => { if (!isOwner()) return cb && cb({ error: 'Only the room owner can change the topic.' }); TOPICS[s.data.room] = cleanTopic(t) || TOPICS[s.data.room];
    io.to(s.data.room).emit('topic', TOPICS[s.data.room]); push(s.data.room, { sys: true, text: esc(s.data.name) + ' changed the topic to: ' + esc(TOPICS[s.data.room]) }); cb && cb({ ok: true }); });
  s.on('kick', (who, cb) => { if (!isOwner()) return cb && cb({ error: 'Only the room owner can kick.' }); const room = s.data.room;
    const t = socks(room).find(x => x.data.name.toLowerCase() === String(who || '').toLowerCase()); if (!t || t === s) return cb && cb({ error: 'Not in this room.' });
    t.emit('kicked', { room, by: s.data.name }); push(room, { sys: true, text: esc(t.data.name) + ' was kicked from the room by ' + esc(s.data.name) + '.' }); t.data.kickedFrom = t.data.kickedFrom || {}; t.data.kickedFrom[room] = Date.now();
    t.data.rejoin('Lobby'); cb && cb({ ok: true }); });
  s.data.rejoin = r => join(r);
  s.on('join', (room, cb) => { if (!s.data.name || !ROOMS[room] || room === s.data.room) return cb && cb({ error: ROOMS[room] ? 'Already here' : 'That room no longer exists.' });
    if (s.data.kickedFrom && Date.now() - (s.data.kickedFrom[room] || 0) < 300e3) return cb && cb({ error: 'You were kicked from that room. Try again later.' }); join(room); cb && cb({ ok: true }); });
  s.on('say', m => {
    if (!s.data.name || !m) return;
    const now = Date.now(); stamps = stamps.filter(t => now - t < 10000);
    if (stamps.length >= 5) return s.emit('msg', { sys: true, text: 'You are sending messages too fast. Slow down.' });
    stamps.push(now);
    const text = String(m.text || '').trim().slice(0, MAXLEN); if (!text) return;
    const FONTS = ['Arial','Verdana','Tahoma','Comic Sans MS','Times New Roman','Courier New'];
    push(s.data.room, { name: esc(s.data.name), av: s.data.av || '', text: esc(text), color: COLORS.includes(m.color) ? m.color : '#000000', b: !!m.b, i: !!m.i, u: !!m.u, f: FONTS.includes(m.f) ? m.f : 'Arial', t: now });
  });
  function mediaReset() {
    const room = s.data.room; if (!room) return;
    io.to(room).emit('media-gone', { id: s.id });
    for (const x of socks(room)) x.data.viewers?.delete(s.id);
    s.data.cam = false; s.data.talk = false; s.data.voice = false; s.data.viewers = new Set();
  }
  const same = id => { const t = io.sockets.sockets.get(id); return t && t.data.name && t.data.room === s.data.room ? t : null; };
  s.on('voice', on => { if (!s.data.name) return; s.data.voice = !!on; if (!on) s.data.talk = false; upd(s.data.room); });
  s.on('talk', on => { if (!s.data.name || !s.data.voice) return; s.data.talk = !!on; upd(s.data.room); });
  s.on('cam', on => { if (!s.data.name) return; s.data.cam = !!on; if (!on) { io.to(s.data.room).emit('cam-off', { id: s.id }); s.data.viewers = new Set(); } upd(s.data.room); });
  s.on('view', (id, cb) => { const t = same(id); if (!t || !t.data.cam) return cb && cb({ error: 'That webcam is not available.' });
    t.data.viewers = t.data.viewers || new Set();
    if (!t.data.viewers.has(s.id) && t.data.viewers.size >= MAXVIEW) return cb && cb({ error: 'That webcam has the maximum number of viewers (' + MAXVIEW + ').' });
    t.data.viewers.add(s.id); t.emit('view-req', { id: s.id, name: s.data.name }); upd(s.data.room); cb && cb({ ok: true }); });
  s.on('unview', id => { const t = same(id); if (t && t.data.viewers?.delete(s.id)) { t.emit('unview', { id: s.id }); upd(s.data.room); } });
  s.on('signal', ({ to, data }) => { const t = same(to); if (t && data && JSON.stringify(data).length < 60000) t.emit('signal', { from: s.id, name: s.data.name, data }); });
  let lastBuzz = 0, lastTyping = 0;
  s.on('buzz', () => { if (!s.data.name) return; const now = Date.now(); if (now - lastBuzz < 15000) return s.emit('msg', { sys: true, text: 'Please wait a bit before buzzing again.' }); lastBuzz = now;
    push(s.data.room, { buzz: true, name: esc(s.data.name), t: now }); });
  s.on('typing', () => { if (!s.data.name) return; const now = Date.now(); if (now - lastTyping < 2000) return; lastTyping = now; s.to(s.data.room).emit('typing', { name: s.data.name }); });
  s.on('pm', ({ to, text }, cb) => { if (!s.data.name) return; const id = users.get(String(to || '').toLowerCase()); const t = id && io.sockets.sockets.get(id);
    text = String(text || '').trim().slice(0, MAXLEN); if (!text) return; if (!t) return cb && cb({ error: to + ' is not online.' });
    const now = Date.now(); stamps = stamps.filter(x => now - x < 10000); if (stamps.length >= 5) return cb && cb({ error: 'You are sending messages too fast.' }); stamps.push(now);
    t.emit('pm', { from: s.data.name, text: esc(text), t: now }); cb && cb({ ok: true, text: esc(text) }); });
  let lastAv = 0;
  s.on('avatar:set', (d, cb) => setAv(d, cb).catch(e => { console.error('[avatar]', e.message); typeof cb === 'function' && cb({ error: 'Could not save your avatar.' }); }));
  async function setAv(d, cb) {
    if (typeof cb !== 'function') cb = () => {}; const acct = s.data.acct, name = acct ? acct.name : (s.data.guest && s.data.name);
    if (!name) return cb({ error: 'Sign in first.' }); if (Date.now() - lastAv < 2000) return cb({ error: 'Please wait a moment before changing your avatar again.' }); lastAv = Date.now();
    let av;
    if (PRESETS.includes(d)) av = d;
    else { const p = parseAvatar(d); if (p.error) return cb(p); av = 'c' + Date.now().toString(36);
      if (acct) { if (!db.status().ready) return cb({ error: 'Accounts are temporarily unavailable.' });
        await db.q('insert into avatars(user_id,mime,data,updated) values($1,$2,$3,now()) on conflict(user_id) do update set mime=$2,data=$3,updated=now()', [acct.id, p.mime, p.buf]); }
      else AVMEM.set(name.toLowerCase(), { mime: p.mime, buf: p.buf }); }
    if (acct) { await db.q('update users set avatar=$2 where id=$1', [acct.id, av]); await acc.setAvatar(acct.id, av); }
    else if (PRESETS.includes(av)) AVMEM.delete(name.toLowerCase());
    for (const [, x] of io.sockets.sockets) if (x.data.acct ? acct && x.data.acct.id === acct.id : x === s) x.data.av = av;
    io.emit('avatar', { name, av }); cb({ ok: true, av });
  }
  s.on('report', ({ who, why }) => { if (!s.data.name) return; console.log('[REPORT ABUSE]', new Date().toISOString(), 'by', s.data.name, 'in', s.data.room, 'against', String(who || '').slice(0, 30), '-', String(why || '').slice(0, 300)); });
  s.on('disconnect', () => { if (!s.data.name) return; users.delete(s.data.name.toLowerCase()); if (s.data.guest) { AVMEM.delete(s.data.name.toLowerCase()); geo.guestOff(s.data.name); } const r0 = s.data.room; mediaReset(); s.leave(r0); upd(r0);
    if (s.data.room) { push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); io.to(s.data.room).emit('members', members(s.data.room)); } });
});
acc.sockets(io, { roomExists: r => !!ROOMS[r] });
db.init().finally(() => server.listen(process.env.PORT || 3000, () => console.log('YappChat on', process.env.PORT || 3000)));
