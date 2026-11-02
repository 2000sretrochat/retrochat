// YappChat server (repo: retrochat). Auth hook: replace `identify()` later for accounts; media hook: add /api/media-token for LiveKit.
const express = require('express'), http = require('http'), { Server } = require('socket.io');
const acc = require('./accounts'), db = require('./db'), geo = require('./geo');
const app = express(), server = http.createServer(app);
app.set('trust proxy', 1);
const io = new Server(server, { maxHttpBufferSize: 1e5, allowRequest: (req, cb) => { const o = req.headers.origin; try { cb(null, !o || new URL(o).host === req.headers.host); } catch { cb(null, false); } } });
io.use(async (s, next) => { if (MASTER.ipBanned(geo.clientIp(s.handshake.headers, s.handshake.address))) return next(new Error('banned'));
  s.data.acct = await acc.userFromCookie(s.handshake.headers.cookie);
  if (s.data.acct) { try { const u = (await db.q('select adult,is_master,m_incog,m_announce from users where id=$1', [s.data.acct.id]))[0]; s.data.adult = !!u?.adult; s.data.master = !!u?.is_master; if (s.data.master) { s.data.incPref = !!u.m_incog; s.data.announce = !!u.m_announce; } } catch { } } next(); });
const ROOMS = { 'Lobby':'General','Friends':'General','Chit Chat':'General','Late Night':'General' };
const TOPICS = { 'Lobby':'Welcome! Pull up a chair and say hi','Friends':'Make new friends and catch up with old ones','Chit Chat':'Talk about anything and everything','Late Night':'For the night owls - who else is still up?' };
const MAXLEN = 300, HIST = 50, COLORS = ['#000000','#ff0000','#0000ff','#008000','#800080','#ff6600','#008080','#990033'];
const users = new Map(); const VERSION = 'v11.4-master-incog-dots-email'; // lower(name) -> socket.id
const history = Object.fromEntries(Object.keys(ROOMS).map(r => [r, []]));
// ---- user-created rooms (public, in memory; removed after ~10 min empty) ----
const UROOMS = new Map(); // name -> { owner, ownerLc, emptySince }
const RATINGS = ['PG-13', 'R'], RATE = {}; const adultR = r => RATE[r] === 'R'; // official rooms default PG-13
const rateOf = r => RATE[r] || 'PG-13';
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
setInterval(() => { const now = Date.now(); for (const [n, r] of UROOMS) { if (socks(n).length) r.emptySince = 0; else if (!r.emptySince) r.emptySince = now; else if (now - r.emptySince > EMPTY_MS) { UROOMS.delete(n); delete ROOMS[n]; delete TOPICS[n]; delete history[n]; delete RATE[n]; } } }, 30e3).unref();
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.use((req,res,next)=>{res.setHeader('Permissions-Policy','camera=(self), microphone=(self), display-capture=(self)');next()});
acc.http(app, express, { ipBanned: ip => MASTER.ipBanned(ip), seedMaster: (id, n) => MASTER.seedMaster(id, n), guestInUse: n => users.has(String(n).toLowerCase()) && !!io.sockets.sockets.get(users.get(String(n).toLowerCase()))?.data.guest });
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
geo.admin(app, n => acc.isOnline(n) || users.has(String(n).toLowerCase())); // admin-key only
app.get('/healthz', (q, r) => r.send('ok')); app.get('/api/version', (q, r) => r.json({ version: VERSION }));
const roomList = (adult, vm) => Object.entries(ROOMS).filter(([n]) => adult || !adultR(n)).map(([name, cat]) => ({ name, cat, topic: TOPICS[name], rating: rateOf(name), mics: micsOf(name), count: members(name, vm).length, owner: UROOMS.get(name)?.owner || null }));
async function isAdultReq(req) { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return false; try { return !!(await db.q('select adult from users where id=$1', [u.id]))[0]?.adult; } catch { return false; } }
app.get('/api/rooms', async (q, r) => r.json(roomList(await isAdultReq(q))));
app.post('/api/adult', express.json(), async (req, res) => { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in first.' });
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmation required.' }); await db.q('update users set adult=true where id=$1', [u.id]);
  for (const x of io.sockets.sockets.values()) if (x.data.acct?.id === u.id) x.data.adult = true; res.json({ ok: true }); });
const roomVisible = lc => { const id = users.get(lc), x = id && io.sockets.sockets.get(id); return !!x && !x.data.inc; };
// ---- profiles (typed by the user; never derived from IP) ----
const PCLEAN = (t, n) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
app.get('/api/profile/:name', async (req, res) => { const n = String(req.params.name || ''), lc = n.toLowerCase(); res.set('Cache-Control', 'no-store');
  if (db.status().ready) { try { const r = (await db.q('select name,avatar,display_name,age,location,bio,interests,created from users where name_lc=$1', [lc]))[0];
    if (r) return res.json({ name: r.name, avatar: r.avatar, displayName: r.display_name, age: r.age, location: r.location, bio: r.bio, interests: r.interests, memberSince: r.created, online: acc.isOnline(r.name) || roomVisible(lc) }); } catch { } }
  const id = users.get(lc), x = id && io.sockets.sockets.get(id); if (x && x.data.guest) return res.json({ name: x.data.name, guest: true, online: true, room: x.data.room });
  res.status(404).json({ error: 'No such user.' }); });
app.post('/api/profile', express.json(), async (req, res) => { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in to edit your profile.' });
  const b = req.body || {}; let age = b.age === '' || b.age == null ? null : parseInt(b.age, 10);
  if (age !== null && !(age >= 13 && age <= 120)) return res.status(400).json({ error: 'Age must be between 13 and 120 (or left blank).' });
  await db.q('update users set display_name=$2, age=$3, location=$4, bio=$5, interests=$6 where id=$1', [u.id, PCLEAN(b.displayName, 30), age, PCLEAN(b.location, 50), PCLEAN(b.bio, 300), PCLEAN(b.interests, 150)]);
  res.json({ ok: true }); });
// ---- site admin: room ratings / closing (ADMIN_KEY) ----
app.get('/api/admin/rooms', (req, res) => { if (!keyOk(req.get('x-admin-key'))) return res.status(401).json({ error: 'Unauthorized' }); res.json(roomList(true).map(r => ({ ...r, official: OFFICIAL.has(r.name) }))); });
function closeRoom(room) { if (!ROOMS[room]) return 'No such room.'; if (OFFICIAL.has(room)) return 'Official rooms cannot be closed.';
  for (const x of socks(room)) { x.emit('msg', { sys: true, text: 'This room was closed by a moderator.' }); x.data.rejoin('Lobby'); }
  UROOMS.delete(room); delete ROOMS[room]; delete TOPICS[room]; delete history[room]; delete RATE[room]; delete MOD[room]; delete MICS[room]; delete HQ[room]; delete MTIMER[room]; delete QUEUE[room]; MASTER.saveMics(room, null); MASTER.saveRating(room, null); MASTER.saveMod(room); return null; }
function setRating(room, rating) { if (!ROOMS[room]) return 'No such room.'; if (!RATINGS.includes(rating)) return 'Rating must be PG-13 or R.';
  RATE[room] = rating; MASTER.saveRating(room, rating); if (adultR(room)) for (const x of socks(room)) if (!x.data.adult && !x.data.master) { x.emit('msg', { sys: true, text: room + ' is now rated ' + rating + ' (18+).' }); x.data.rejoin('Lobby'); }
  io.to(room).emit('rating', { room, rating }); return null; }
function setTopic(room, t) { if (!ROOMS[room]) return 'No such room.'; TOPICS[room] = cleanTopic(t) || TOPICS[room]; io.to(room).emit('topic', TOPICS[room]); return null; }
app.post('/api/admin/room', express.json(), (req, res) => { if (!keyOk(req.get('x-admin-key'))) return res.status(401).json({ error: 'Unauthorized' });
  const { room, rating, close } = req.body || {}; if (!ROOMS[room]) return res.status(404).json({ error: 'No such room.' });
  const e = close ? closeRoom(room) : setRating(room, rating); if (e) return res.status(400).json({ error: e }); res.json({ ok: true }); });
function socks(room) { return [...io.sockets.adapter.rooms.get(room) || []].map(id => io.sockets.sockets.get(id)).filter(x => x && x.data.name); }
// incognito masters are visible only to other masters (vm = viewer is master)
function seen(room, vm) { return socks(room).filter(x => vm || !x.data.inc); }
function members(room, vm) { return seen(room, vm).map(x => x.data.name).sort((a,b)=>a.localeCompare(b)); }
function roster(room, vm) { return seen(room, vm).map(x => ({ ...(vm && x.data.inc ? { inc: true } : {}), name: x.data.name, av: x.data.av || '', id: x.id, guest: !!x.data.guest, cam: !!x.data.cam, talk: !!x.data.talk, tl: x.data.talk && x.data.talkUntil ? Math.max(0, Math.ceil((x.data.talkUntil - Date.now()) / 1000)) : 0, role: x.data.master ? '' : roleOf(x, room), dot: dotLeft(room, x.data.name.toLowerCase()) !== null, dl: Math.ceil((dotLeft(room, x.data.name.toLowerCase()) || 0) / 1000), mt: mod(room).mt.has(x.data.name.toLowerCase()), mm: mod(room).mm.has(x.data.name.toLowerCase()), voice: !!x.data.voice, viewers: x.data.cam ? [...(x.data.viewers||[])].map(v => io.sockets.sockets.get(v)?.data.name).filter(Boolean) : [] })).sort((a,b)=>a.name.localeCompare(b.name)); }
const MICS = {}; const MIC_DEFAULT_OFFICIAL = 3;
const micsOf = r => MICS[r] || (UROOMS.has(r) ? 1 : MIC_DEFAULT_OFFICIAL);
const micsUsed = r => socks(r).filter(x => x.data.talk).length;
function parseSecs(t) { if (t == null || t === '' || t === 'off' || t === 0 || t === '0') return 0; const m = String(t).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/); if (!m) return null;
  const v = Math.round(parseFloat(m[1]) * (m[2] && m[2][0] === 'm' ? 60 : 1)); return v >= 5 && v <= 300 ? v : null; }
function setMicOpts(room, { hq, timer } = {}) { if (!ROOMS[room]) return 'No such room.'; let t;
  if (timer !== undefined) { t = parseSecs(timer); if (t === null) return 'Timer must be off or 5 seconds to 5 minutes (e.g. 45s, 1m30 = 90).'; }
  if (hq !== undefined) { HQ[room] = !!hq; if (!hq) QUEUE[room] = []; } if (t !== undefined) { MTIMER[room] = t; for (const x of socks(room)) if (x.data.talk) x.data.talkUntil = t ? Date.now() + t * 1000 : 0; }
  MASTER.saveMeta(room, { hq: !!HQ[room], mtimer: MTIMER[room] || 0 }); upd(room); return null; }
function setMics(room, n) { n = +n; if (!ROOMS[room]) return 'No such room.'; if (![1, 2, 3, 4, 5].includes(n)) return 'Mic limit must be 1 to 5.';
  MICS[room] = n; MASTER.saveMics(room, n); io.to(room).emit('mics', { room, max: n }); upd(room); return null; }
const HQ = {}, MTIMER = {}, QUEUE = {}; // hands-up on/off, per-turn seconds (0=off), ordered socket ids
const qOf = r => QUEUE[r] = (QUEUE[r] || []).filter(id => { const x = io.sockets.sockets.get(id); return x && x.data.room === r && x.data.voice && !x.data.talk; });
const hqOn = r => !!HQ[r] && micsOf(r) === 1;
function micq(room) { return { room, on: hqOn(room), timer: MTIMER[room] || 0, max: micsOf(room), q: hqOn(room) ? qOf(room).map(id => io.sockets.sockets.get(id).data.name) : [] }; }
function startTurn(x, room) { x.data.talk = true; x.data.talkUntil = MTIMER[room] ? Date.now() + MTIMER[room] * 1000 : 0; }
function advance(room) { if (!room || !ROOMS[room]) return false; let ch = false;
  for (const x of socks(room)) if (x.data.talk && x.data.talkUntil && x.data.talkUntil <= Date.now()) { x.data.talk = false; x.data.talkUntil = 0; x.emit('micdrop', { reason: 'time' }); push(room, { sys: true, text: esc(x.data.name) + "'s mic time is up." }); ch = true; }
  if (hqOn(room)) { const q = qOf(room); while (q.length && micsUsed(room) < micsOf(room)) { const x = io.sockets.sockets.get(q.shift()); if (mod(room).mm.has(x.data.name.toLowerCase())) continue; startTurn(x, room); x.emit('yourturn', { secs: MTIMER[room] || 0 }); push(room, { sys: true, text: esc(x.data.name) + ' has the mic.' }); ch = true; } }
  return ch; }
setInterval(() => { for (const r of Object.keys(ROOMS)) { let ch = advance(r); const d = MOD[r]?.dot;
  if (d) for (const [n, u] of d) if (u < DOTFOREVER && u <= Date.now()) { d.delete(n); ch = true; const x = socks(r).find(y => y.data.name.toLowerCase() === n); if (x) x.emit('undotted', { auto: true }); MASTER.saveMod(r); }
  if (ch) upd(r); } }, 1000).unref();
function lists(room) { if (!room) return; const R = {}; for (const x of socks(room)) { const k = x.data.master ? 1 : 0; R[k] = R[k] || [roster(room, !!k), members(room, !!k)]; x.emit('roster', R[k][0]); x.emit('members', R[k][1]); } }
function upd(room) { if (room) { lists(room); io.to(room).emit('micq', micq(room)); } }
const MAXVIEW = 6;
// ---- room moderation: owner (or site admin via ADMIN_KEY) > room admins > users. All checks are server-side. ----
const MOD = {}; const KICK_MS = 5 * 60e3;
const mod = r => MOD[r] = MOD[r] || { admins: new Set(), kicked: new Map(), dot: new Map(), mt: new Set(), mm: new Set() };
function roleOf(x, room) { if (!x || !x.data.name) return ''; const u = UROOMS.get(room), lc = x.data.name.toLowerCase();
  if (x.data.site || x.data.master) return 'owner'; if (u && x.data.acct && u.ownerLc === x.data.acct.name.toLowerCase()) return 'owner';
  if (x.data.acct && mod(room).admins.has(lc)) return 'admin'; return ''; }
function kickedLeft(room, name) { const m = mod(room), lc = String(name).toLowerCase(), u = m.kicked.get(lc) || 0; if (u <= Date.now()) { m.kicked.delete(lc); return 0; } return u - Date.now(); }
const DOTFOREVER = 8.64e15, DOTMINS = [0, 1, 5, 10, 30];
function dotLeft(room, lc) { const d = mod(room).dot, u = d.get(lc); if (!u) return null; if (u < DOTFOREVER && u <= Date.now()) { d.delete(lc); return null; } return u >= DOTFOREVER ? 0 : u - Date.now(); }
function modList(room) { const m = mod(room); [...m.kicked.keys()].forEach(k => kickedLeft(room, k));
  return { admins: [...m.admins], muted: [...new Set([...m.mt, ...m.mm])].map(n => ({ name: n, text: m.mt.has(n), mic: m.mm.has(n) })), dotted: [...m.dot.keys()].filter(n => dotLeft(room, n) !== null).map(n => { const l = dotLeft(room, n); return { name: n, secs: l ? Math.ceil(l / 1000) : 0 }; }), kicked: [...m.kicked].map(([n, u]) => ({ name: n, ban: u > 1e15, mins: u > 1e15 ? 0 : Math.ceil((u - Date.now()) / 60e3) })), owner: UROOMS.get(room)?.owner || null }; }
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const keyOk = k => { if (!ADMIN_KEY || typeof k !== 'string') return false; const a = Buffer.from(k), b = Buffer.from(ADMIN_KEY); return a.length === b.length && require('crypto').timingSafeEqual(a, b); };
function push(room, m) { m.t = m.t || Date.now(); history[room].push(m); if (history[room].length > HIST) history[room].shift(); io.to(room).emit('msg', m); }
function modAct(s, room, { action, who, mins } = {}, cb) {
  cb = typeof cb === 'function' ? cb : () => {}; const me = roleOf(s, room); if (!room || !me) return cb({ error: 'Only the room owner and admins can do that.' });
  const m = mod(room), lc = String(who || '').toLowerCase().slice(0, 30), t = socks(room).find(x => x.data.name.toLowerCase() === lc && (!x.data.inc || s.data.master)), nm = esc(t ? t.data.name : String(who || '').slice(0, 30)), by = s.data.master ? 'a moderator' : esc(s.data.name), byRaw = s.data.master ? 'a moderator' : s.data.name;
  const ACTS = ['kick', 'unkick', 'dot', 'undot', 'mutetext', 'unmutetext', 'mutemic', 'unmutemic', 'muteboth', 'unmuteall', 'admin', 'unadmin', 'ban', 'unban']; if (!ACTS.includes(action) || !lc) return cb({ error: 'Unknown action.' });
  if (t === s) return cb({ error: 'You cannot do that to yourself.' });
  if (t && t.data.master && !s.data.master) return cb({ error: 'You cannot do that.' });
  const tr = t ? roleOf(t, room) : (m.admins.has(lc) ? 'admin' : (UROOMS.get(room)?.ownerLc === lc ? 'owner' : ''));
  if (tr === 'owner' && !s.data.master) return cb({ error: 'Nobody can moderate the room owner.' });
  if (['admin', 'unadmin', 'ban', 'unban'].includes(action) && me !== 'owner') return cb({ error: 'Only the room owner can do that.' });
  if (tr === 'admin' && me !== 'owner') return cb({ error: 'Admins cannot act on other admins.' });
  const needHere = ['kick', 'dot', 'admin'].includes(action); if (needHere && !t) return cb({ error: 'That user is not in this room.' });
  const say = txt => push(room, { sys: true, mod: true, text: txt });
  if (action === 'kick') { m.kicked.set(lc, Date.now() + KICK_MS); t.emit('kicked', { room, by: byRaw, mins: KICK_MS / 60e3 }); say(nm + ' was bounced from the room by ' + by + ' (5 min).'); t.data.rejoin(room === 'Lobby' ? 'Chit Chat' : 'Lobby'); }
  else if (action === 'ban') { m.kicked.set(lc, 8.64e15); if (t) { t.emit('kicked', { room, by: byRaw, ban: true }); t.data.rejoin(room === 'Lobby' ? 'Chit Chat' : 'Lobby'); } say(nm + ' was banned from the room by ' + by + '.'); }
  else if (action === 'unban') { if (!m.kicked.delete(lc)) return cb({ error: 'That user is not banned.' }); say(nm + ' was unbanned by ' + by + '.'); }
  else if (action === 'unkick') { if (!m.kicked.delete(lc)) return cb({ error: 'That user is not bounced.' }); say(nm + ' may rejoin (bounce lifted by ' + by + ').'); }
  else if (action === 'dot') { mins = DOTMINS.includes(+mins) ? +mins : 0; m.dot.set(lc, mins ? Date.now() + mins * 60e3 : DOTFOREVER); t.data.talk = false; t.data.talkUntil = 0; const q = QUEUE[room]; if (q) { const i = q.indexOf(t.id); if (i >= 0) q.splice(i, 1); } t.emit('dotted', { by: byRaw, mins }); say(nm + ' was dotted'); }
  else if (action === 'undot') { if (!m.dot.delete(lc)) return cb({ error: 'That user is not dotted.' }); if (t) t.emit('undotted', {}); }
  else if (action === 'admin') { if (!t.data.acct) return cb({ error: 'Only registered screen names can be admins.' }); m.admins.add(lc); m.mt.delete(lc); m.mm.delete(lc); say(nm + ' is now a room admin (by ' + by + ').'); }
  else if (action === 'unadmin') { if (!m.admins.delete(lc)) return cb({ error: 'That user is not an admin.' }); say(nm + ' is no longer a room admin.'); }
  else { const tx = { mutetext: [1, 0], mutemic: [0, 1], muteboth: [1, 1] }[action];
    if (tx) { if (tx[0]) m.mt.add(lc); if (tx[1]) { m.mm.add(lc); if (t) { t.data.talk = false; t.emit('dotted', { by: byRaw, muted: true }); } } say(nm + ' was muted (' + (tx[0] && tx[1] ? 'text + mic' : tx[0] ? 'text' : 'mic') + ') by ' + by + '.'); }
    else { const a = action === 'unmutetext' ? m.mt.delete(lc) : action === 'unmutemic' ? m.mm.delete(lc) : (m.mt.delete(lc) | m.mm.delete(lc)); if (!a) return cb({ error: 'That user is not muted.' }); say(nm + ' was unmuted by ' + by + '.'); } }
  MASTER.saveMod(room); upd(room); cb({ ok: true, list: modList(room) });
}
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
    if (adultR(room) && !s.data.adult && !s.data.master) return cb({ error: room + ' is rated ' + rateOf(room) + '. Confirm you are 18 or older to join.', adult: true });
    if (!s.data.master) { const left = kickedLeft(room, name); if (left > 1e12) return cb({ error: 'You are banned from ' + room + '.' }); if (left) return cb({ error: 'You were bounced from ' + room + '. You can rejoin in about ' + Math.ceil(left / 60e3) + ' min.' }); }
    if (users.has(name.toLowerCase()) || (s.data.guest && acc.isOnline(name))) return cb({ error: 'That screen name is in use right now. Try another.' });
    users.set(name.toLowerCase(), s.id); s.data.name = name;
    if (s.data.acct && db.status().ready) { try { s.data.av = (await db.q('select avatar from users where id=$1', [s.data.acct.id]))[0]?.avatar || ''; } catch { } }
    { const ip = geo.clientIp(s.handshake.headers, s.handshake.address); if (s.data.guest) geo.recordGuest(name, ip).catch(() => {}); else if (s.data.acct) geo.recordAccount(s.data.acct.id, ip, 'room'); }
    join(room); cb({ ok: true, name, colors: COLORS, account: !!s.data.acct, ...(s.data.master ? { m: true } : {}) });
  });
  const noticeOk = () => !s.data.master || (s.data.announce && !s.data.inc); // masters enter/leave silently by default
  function join(room) {
    if (s.data.room) { s.leave(s.data.room); if (noticeOk()) push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); lists(s.data.room); }
    const old = s.data.room; mediaReset(); if (old) upd(old);
    s.data.inc = !!(s.data.master && s.data.incPref); s.data.room = room; s.join(room); s.emit('history', { room, topic: TOPICS[room], msgs: history[room], owner: UROOMS.get(room)?.owner || null, rating: rateOf(room), mics: micsOf(room) });
    if (noticeOk()) push(room, { sys: true, text: `${esc(s.data.name)} has entered the room.` }); upd(room); s.emit('inc', { on: !!s.data.inc, announce: !!s.data.announce });
  }
  s.on('create-room', ({ name, topic, rating, mics }, cb) => {
    if (typeof cb !== 'function') return; if (!s.data.acct) return cb({ error: 'Guests cannot create rooms. Get a free screen name to create one.' });
    name = String(name || '').replace(/\s+/g, ' ').trim(); const e = roomNameError(name); if (e) return cb({ error: e });
    if (!RATINGS.includes(rating)) return cb({ error: 'Choose a rating for your room: PG-13 or R.' }); if (rating !== 'PG-13' && !s.data.adult) return cb({ error: 'Confirm you are 18 or older to create an R-rated room.', adult: true });
    const lc = s.data.acct.name.toLowerCase(); if ([...UROOMS.values()].filter(r => r.ownerLc === lc).length >= MAXU) return cb({ error: 'You can own at most ' + MAXU + ' rooms at a time.' });
    UROOMS.set(name, { owner: s.data.acct.name, ownerLc: lc, emptySince: Date.now() }); ROOMS[name] = 'User Rooms'; TOPICS[name] = cleanTopic(topic) || 'Welcome to ' + name; history[name] = []; RATE[name] = rating; MASTER.saveRating(name, rating); mics = [1, 2, 3, 4, 5].includes(+mics) ? +mics : 1; MICS[name] = mics; MASTER.saveMics(name, mics);
    cb({ ok: true, name, rating, mics }); if (s.data.name) join(name);
  });
  const isOwner = () => { const r = UROOMS.get(s.data.room); return r && s.data.acct && r.ownerLc === s.data.acct.name.toLowerCase(); };
  s.on('set-topic', (t, cb) => { if (!isOwner()) return cb && cb({ error: 'Only the room owner can change the topic.' }); TOPICS[s.data.room] = cleanTopic(t) || TOPICS[s.data.room];
    io.to(s.data.room).emit('topic', TOPICS[s.data.room]); push(s.data.room, { sys: true, text: esc(s.data.name) + ' changed the topic to: ' + esc(TOPICS[s.data.room]) }); cb && cb({ ok: true }); });
  s.on('kick', (who, cb) => doMod({ action: 'kick', who }, cb));
  let keyTries = 0;
  s.on('mod:site', (k, cb) => { if (typeof cb !== 'function') return; if (++keyTries > 5) return cb({ error: 'Too many attempts.' });
    if (!keyOk(k)) return cb({ error: 'Wrong admin key.' }); s.data.site = true; upd(s.data.room); cb({ ok: true }); });
  s.on('mod:list', cb => { if (typeof cb !== 'function') return; if (!roleOf(s, s.data.room)) return cb({ error: 'Only the room owner and admins can do that.' }); cb(modList(s.data.room)); });
  s.on('mod', (d, cb) => doMod(d || {}, cb));
  function doMod(d, cb) { modAct(s, s.data.room, d, cb); }
  s.data.rejoin = r => join(r);
  s.on('rooms', cb => typeof cb === 'function' && cb(roomList(!!s.data.adult || !!s.data.master, !!s.data.master)));
  s.on('adult', async (yes, cb) => { if (yes !== true) return; s.data.adult = true; if (s.data.acct && db.status().ready) { try { await db.q('update users set adult=true where id=$1', [s.data.acct.id]); } catch { } } typeof cb === 'function' && cb({ ok: true }); });
  s.on('join', (room, cb) => { if (!s.data.name || !ROOMS[room] || room === s.data.room) return cb && cb({ error: ROOMS[room] ? 'Already here' : 'That room no longer exists.' });
    if (adultR(room) && !s.data.adult && !s.data.master) return cb && cb({ error: room + ' is rated ' + rateOf(room) + '. Confirm you are 18 or older to join.', adult: true });
    if (!s.data.master) { const left = kickedLeft(room, s.data.name); if (left > 1e12) return cb && cb({ error: 'You are banned from that room.' }); if (left) return cb && cb({ error: 'You were bounced from that room. Try again in about ' + Math.ceil(left / 60e3) + ' min.' }); } join(room); cb && cb({ ok: true }); });
  s.on('say', m => {
    if (!s.data.name || !m) return;
    if (mod(s.data.room).mt.has(s.data.name.toLowerCase())) return s.emit('msg', { sys: true, text: 'You are muted in this room and cannot send messages.' });
    const now = Date.now(); stamps = stamps.filter(t => now - t < 10000);
    if (stamps.length >= 5) return s.emit('msg', { sys: true, text: 'You are sending messages too fast. Slow down.' });
    stamps.push(now);
    const text = String(m.text || '').trim().slice(0, MAXLEN); if (!text) return;
    if (s.data.inc) { if (m.vis !== true) { stamps.pop(); return s.emit('incwarn', { text }); } s.data.inc = false; upd(s.data.room); s.emit('inc', { on: false, announce: !!s.data.announce }); }
    const FONTS = ['Arial','Verdana','Tahoma','Comic Sans MS','Times New Roman','Courier New'];
    push(s.data.room, { name: esc(s.data.name), av: s.data.av || '', role: s.data.master ? '' : roleOf(s, s.data.room), text: esc(text), color: COLORS.includes(m.color) ? m.color : '#000000', b: !!m.b, i: !!m.i, u: !!m.u, f: FONTS.includes(m.f) ? m.f : 'Arial', t: now });
  });
  function mediaReset() {
    const room = s.data.room; if (!room) return;
    if (!s.data.inc) io.to(room).emit('media-gone', { id: s.id });
    for (const x of socks(room)) x.data.viewers?.delete(s.id);
    s.data.cam = false; s.data.talk = false; s.data.voice = false; s.data.viewers = new Set();
  }
  const same = id => { const t = io.sockets.sockets.get(id); return t && t.data.name && t.data.room === s.data.room && (!t.data.inc || s.data.master) ? t : null; };
  s.on('voice', on => { if (!s.data.name) return; s.data.voice = !!on; if (!on) s.data.talk = false; upd(s.data.room); });
  s.on('talk', (on, cb) => { const ack = typeof cb === 'function' ? cb : () => {}; if (!s.data.name || !s.data.voice) return ack({ error: 'Voice is off.' }); const room = s.data.room;
    if (on && dotLeft(room, s.data.name.toLowerCase()) !== null) { s.emit('dotted', {}); return ack({ error: "You've been dotted." }); }
    if (on && s.data.inc) return ack({ error: 'You are incognito. Send a message visibly first to use the mic.' });
    if (on && mod(room).mm.has(s.data.name.toLowerCase())) { s.emit('dotted', { muted: true }); upd(room); return ack({ error: 'Your mic is muted.' }); }
    if (on && !s.data.talk) { const max = micsOf(room), used = micsUsed(room); if (used >= max) { upd(room); return ack({ error: 'Mic is full (' + used + '/' + max + ')', full: true, used, max, hq: hqOn(room) }); }
      if (hqOn(room) && qOf(room).length && QUEUE[room][0] !== s.id) return ack({ error: 'Hands up is on \u2013 raise your hand to get in line.', full: true, hq: true });
      QUEUE[room] = qOf(room).filter(id => id !== s.id); startTurn(s, room); }
    else if (!on) { s.data.talk = false; s.data.talkUntil = 0; advance(room); }
    upd(room); ack({ ok: true, secs: on ? MTIMER[room] || 0 : 0 }); });
  s.on('hand', (up, cb) => { cb = typeof cb === 'function' ? cb : () => {}; const room = s.data.room; if (!room || !s.data.name) return cb({ error: 'Not in a room.' }); if (s.data.inc) return cb({ error: 'You are incognito.' }); if (up !== false && dotLeft(room, s.data.name.toLowerCase()) !== null) return cb({ error: "You've been dotted." });
    if (!hqOn(room)) return cb({ error: 'Hands up is off in this room.' }); const q = qOf(room);
    if (up) { if (!s.data.voice) return cb({ error: 'Turn on voice first.' }); if (s.data.talk) return cb({ error: 'You already have the mic.' }); if (!q.includes(s.id)) q.push(s.id); }
    else QUEUE[room] = q.filter(id => id !== s.id);
    advance(room); upd(room); cb({ ok: true }); });
  s.on('handq', ({ who, op } = {}, cb) => { cb = typeof cb === 'function' ? cb : () => {}; const room = s.data.room; if (!roleOf(s, room)) return cb({ error: 'Only the room owner and admins can manage the line.' });
    const q = qOf(room), i = q.findIndex(id => io.sockets.sockets.get(id).data.name.toLowerCase() === String(who || '').toLowerCase()); if (i < 0) return cb({ error: 'Not in line.' });
    const [id] = q.splice(i, 1); if (op === 'up') q.splice(Math.max(0, i - 1), 0, id); else if (op === 'down') q.splice(Math.min(q.length, i + 1), 0, id); else if (op === 'top') q.unshift(id); else if (op !== 'remove') q.splice(i, 0, id);
    QUEUE[room] = q; upd(room); cb({ ok: true }); });
  s.on('set-micopts', ({ hq, timer } = {}, cb) => { cb = typeof cb === 'function' ? cb : () => {}; if (roleOf(s, s.data.room) !== 'owner') return cb({ error: 'Only the room owner can change mic settings.' });
    const e = setMicOpts(s.data.room, { hq, timer }); if (e) return cb({ error: e }); const r = s.data.room;
    push(r, { sys: true, text: 'Mic settings: hands up ' + (HQ[r] ? 'on' : 'off') + ', turn timer ' + (MTIMER[r] ? MTIMER[r] + 's' : 'off') + '.' }); cb({ ok: true }); });
  s.on('set-mics', (n, cb) => { cb = typeof cb === 'function' ? cb : () => {}; if (roleOf(s, s.data.room) !== 'owner') return cb({ error: 'Only the room owner can change the mic limit.' });
    const e = setMics(s.data.room, n); if (e) return cb({ error: e }); push(s.data.room, { sys: true, text: 'Mic limit set to ' + MICS[s.data.room] + (MICS[s.data.room] === 1 ? ' (single mic).' : ' talkers at once.') }); cb({ ok: true }); });
  s.on('cam', on => { if (!s.data.name || (on && s.data.inc)) return; s.data.cam = !!on; if (!on) { io.to(s.data.room).emit('cam-off', { id: s.id }); s.data.viewers = new Set(); } upd(s.data.room); });
  s.on('view', (id, cb) => { if (s.data.inc) return cb && cb({ error: 'You are incognito.' }); const t = same(id); if (!t || !t.data.cam) return cb && cb({ error: 'That webcam is not available.' });
    t.data.viewers = t.data.viewers || new Set(); if (t.data.camBlock?.has(s.data.name.toLowerCase())) return cb && cb({ error: t.data.name + ' has blocked you from viewing their webcam.' });
    if (!t.data.viewers.has(s.id) && t.data.viewers.size >= MAXVIEW) return cb && cb({ error: 'That webcam has the maximum number of viewers (' + MAXVIEW + ').' });
    t.data.viewers.add(s.id); t.emit('view-req', { id: s.id, name: s.data.name }); upd(s.data.room); cb && cb({ ok: true }); });
  s.on('cam:block', (name, cb) => { if (!s.data.name) return; const lc = String(name || '').toLowerCase(); const v = socks(s.data.room).find(x => x.data.name.toLowerCase() === lc);
    if (!v || v.id === s.id) return typeof cb === 'function' && cb({ error: 'That user is not here.' }); (s.data.camBlock = s.data.camBlock || new Set()).add(lc);
    if (s.data.viewers?.delete(v.id)) { s.emit('unview', { id: v.id }); v.emit('cam-blocked', { id: s.id, name: s.data.name }); } upd(s.data.room); typeof cb === 'function' && cb({ ok: true }); });
  s.on('cam:unblock', name => { s.data.camBlock?.delete(String(name || '').toLowerCase()); });
  s.on('unview', id => { const t = same(id); if (t && t.data.viewers?.delete(s.id)) { t.emit('unview', { id: s.id }); upd(s.data.room); } });
  s.on('signal', ({ to, data }) => { if (s.data.inc) return; const t = same(to); if (t && data && JSON.stringify(data).length < 60000) t.emit('signal', { from: s.id, name: s.data.name, data }); });
  let lastBuzz = 0, lastTyping = 0;
  s.on('buzz', () => { if (!s.data.name) return; if (s.data.inc) return s.emit('msg', { sys: true, text: 'You are incognito.' }); if (mod(s.data.room).mt.has(s.data.name.toLowerCase())) return; const now = Date.now(); if (now - lastBuzz < 15000) return s.emit('msg', { sys: true, text: 'Please wait a bit before buzzing again.' }); lastBuzz = now;
    push(s.data.room, { buzz: true, name: esc(s.data.name), t: now }); });
  s.on('typing', () => { if (!s.data.name || s.data.inc) return; const now = Date.now(); if (now - lastTyping < 2000) return; lastTyping = now; s.to(s.data.room).emit('typing', { name: s.data.name }); });
  s.on('pm', ({ to, text }, cb) => { if (!s.data.name) return; const id = users.get(String(to || '').toLowerCase()); const t0 = id && io.sockets.sockets.get(id), t = t0 && (!t0.data.inc || s.data.master) ? t0 : null;
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
  s.on('report', ({ who, why } = {}) => { if (!s.data.name) return; MASTER.report(s.data.name, s.data.room, String(who || '').slice(0, 30), String(why || '').slice(0, 300)); console.log('[REPORT ABUSE]', new Date().toISOString(), 'by', s.data.name, 'in', s.data.room, 'against', String(who || '').slice(0, 30), '-', String(why || '').slice(0, 300)); });
  s.on('disconnect', () => { if (!s.data.name) return; users.delete(s.data.name.toLowerCase()); if (s.data.guest) { AVMEM.delete(s.data.name.toLowerCase()); geo.guestOff(s.data.name); } const r0 = s.data.room; mediaReset(); s.leave(r0); upd(r0);
    if (s.data.room && noticeOk()) push(s.data.room, { sys: true, text: `${esc(s.data.name)} has left the room.` }); });
});
acc.sockets(io, { roomExists: r => !!ROOMS[r] });
const MASTER = require('./master')({ app, express, io, db, acc, geo, users, ROOMS, UROOMS, RATE, TOPICS, OFFICIAL, MOD, mod, socks, push, upd, history, roomList, closeRoom, lists, setRating, setTopic, modAct, esc, MICS, setMics, micsOf, HQ, MTIMER, setMicOpts, RATINGS, KICK_MS });
db.init().then(() => MASTER.load()).catch(e => console.error('[master load]', e.message)).finally(() => server.listen(process.env.PORT || 3000, () => console.log('YappChat on', process.env.PORT || 3000)));
