// YappChat server (repo: retrochat). Auth hook: replace `identify()` later for accounts; media hook: add /api/media-token for LiveKit.
const FLOOD = require('./flood');
const express = require('express'), http = require('http'), { Server } = require('socket.io');
const acc = require('./accounts'), db = require('./db'), geo = require('./geo');
const app = express(), server = http.createServer(app);
app.set('trust proxy', 1);
const io = new Server(server, { pingInterval: 20000, pingTimeout: 40000, maxHttpBufferSize: 1e5, allowRequest: (req, cb) => { const o = req.headers.origin; try { cb(null, !o || new URL(o).host === req.headers.host); } catch { cb(null, false); } } });
io.use(async (s, next) => { if (MASTER.ipBanned(geo.clientIp(s.handshake.headers, s.handshake.address))) return next(new Error('banned'));
  s.data.acct = await acc.userFromCookie(s.handshake.headers.cookie);
  if (s.data.acct) { try { const u = (await db.q('select adult,is_master,m_incog,m_announce from users where id=$1', [s.data.acct.id]))[0]; s.data.adult = !!u?.adult; s.data.master = !!u?.is_master; if (s.data.master) { s.data.incPref = !!u.m_incog; s.data.announce = !!u.m_announce; } } catch { } }
  s.data.ip = geo.clientIp(s.handshake.headers, s.handshake.address); s.data.dev = devOf(s.handshake.headers.cookie);
  if (!s.data.master) { const devs = new Set(); for (const x of io.sockets.sockets.values()) if (!x.data.master && x.data.ip === s.data.ip) devs.add(x.data.dev || x.id);
    if (!devs.has(s.data.dev || s.id) && devs.size >= IP_LIMIT) return next(new Error('Too many users from this network (limit ' + IP_LIMIT + ').')); }
  next(); });
const IP_LIMIT = +process.env.IP_LIMIT || 5; acc.devConflict = (s, n) => devConflict(s, n);
function devOf(c) { const m = /(?:^|;\s*)ydid=([A-Za-z0-9-]{8,64})/.exec(String(c || '')); return m ? m[1] : ''; }
// another non-master on the same computer using a different screen name?
function devConflict(s, name) { if (s.data.master || !s.data.dev) return null; const lc = String(name).toLowerCase();
  for (const x of io.sockets.sockets.values()) { if (x === s || x.data.master || x.data.dev !== s.data.dev) continue; const n = x.data.name || (x.data.mess && x.data.acct && x.data.acct.name); if (n && n.toLowerCase() !== lc) return n; } return null; }
const blockedBy = async (owner, who) => { try { return (await db.q('select 1 from blocks where owner=$1 and blocked=$2', [owner, who])).length > 0; } catch { return false; } };
const mutualC = async (a, b) => { try { return (await db.q('select 1 from contacts where owner=$1 and contact=$2', [a, b])).length > 0; } catch { return false; } };
const masterNames = () => new Set([...io.sockets.sockets.values()].filter(x => x.data.master && x.data.acct).map(x => x.data.acct.name.toLowerCase()));
async function masterLc() { try { return new Set((await db.q('select name_lc from users where is_master')).map(r => r.name_lc)); } catch { return masterNames(); } }
const { DIR, PATH, ADULT_ROOMS, CAT_ORDER } = require('./rooms-dir');
const ROOMS = {}; for (const [c, rs] of Object.entries(DIR)) for (const r of rs) ROOMS[r] = c;
const TOPICS = { 'Lobby':'Welcome! Pull up a chair and say hi','Friends':'Make new friends and catch up with old ones','Chit Chat':'Talk about anything and everything','Late Night':'For the night owls - who else is still up?', 'The Lounge':'Good company. No particular agenda.' };
for (const r of Object.keys(ROOMS)) if (!TOPICS[r]) TOPICS[r] = ADULT_ROOMS.has(r) ? r + ' - adults only (18+)' : 'Welcome to ' + r + ' - chat about ' + r.toLowerCase();
const MAXLEN = 300, HIST = 50, COLORS = ['#000000','#ff0000','#0000ff','#008000','#800080','#ff6600','#008080','#990033','#8b5cf6'];
const GRACE = new Map(); const users = new Map(); const VERSION = 'v13.4'; // lower(name) -> socket.id
const history = Object.fromEntries(Object.keys(ROOMS).map(r => [r, []]));
// ---- user-created rooms (public, in memory; removed after ~10 min empty) ----
const UROOMS = new Map(); // name -> { owner, ownerLc, emptySince }
// user rooms persist in Postgres (user_rooms) and are restored at boot
const saveURoom = n => { const r = UROOMS.get(n); if (!r) return; Promise.resolve().then(() => db.q('insert into user_rooms(name,cat,owner,rating,mics,topic,icon,last_used) values($1,$2,$3,$4,$5,$6,$7,now()) on conflict(name) do update set cat=$2,rating=$4,mics=$5,topic=$6,icon=$7,last_used=now()', [n, ROOMS[n] || 'Cultures & Community', r.owner, RATE[n] || 'PG-13', MICS[n] || 1, TOPICS[n] || '', r.icon || ''])).catch(e => console.error('save room', e.message)); };
const ICONS = ['💬','🎵','🎮','⚽','🏀','🎬','📚','💻','🍕','☕','🌙','⭐','❤️','🔥','🌈','🐶','🐱','🌎','✈️','🎨','📷','🎤','🎧','🍷','🌸','🏖️','🧠','👻','🎉','💎','🚀','🎲'];
const delURoom = n => { Promise.resolve().then(() => db.q('delete from user_rooms where name=$1', [n])).catch(() => {}); };
const RATINGS = ['PG-13', 'R'], RATE = {}; const adultR = r => RATE[r] === 'R'; // official rooms default PG-13
const rateOf = r => RATE[r] || 'PG-13';
for (const r of ADULT_ROOMS) RATE[r] = 'R';
const OFFICIAL = new Set(Object.keys(ROOMS)), MAXU = 5, EMPTY_MS = 10 * 60e3;
const BAD = /(fuck|shit|bitch|cunt|nigg|fag|dick|cock|pussy|whore|slut|rape|nazi|porn|sex|penis|vagina|asshole|retard)/i;
const roomKey = n => String(n).toLowerCase().replace(/\s+/g, ' ').trim();
function roomNameError(n) {
  if (!/^[A-Za-z0-9][A-Za-z0-9 '!?&.\-]{2,29}$/.test(n)) return 'Room names are 3-30 characters: letters, numbers, spaces and a little punctuation.';
  const k = roomKey(n); if ([...OFFICIAL].some(o => roomKey(o) === k) || [...UROOMS.keys()].some(o => roomKey(o) === k)) return 'A room with that name already exists.';
  if (BAD.test(n.replace(/[^a-z]/gi, ''))) return 'Please choose a different room name.';
  return null;
}
const cleanTopic = t => String(t || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100); // raw; client escapes
// user rooms are kept permanently (owner can reopen them with their settings); nothing is deleted when they empty out
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
app.disable('x-powered-by');
const CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; font-src 'self' data:; connect-src 'self' wss: ws:; worker-src 'self' blob:; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";
app.use((req,res,next)=>{res.set({'Permissions-Policy':'camera=(self), microphone=(self), display-capture=(self)','Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Referrer-Policy':'strict-origin-when-cross-origin','Cross-Origin-Opener-Policy':'same-origin'}); if (req.secure) res.set('Strict-Transport-Security','max-age=15552000'); next()});
acc.http(app, express, { reservedName: n => MASTER.reserved(n), ipBanned: ip => MASTER.ipBanned(ip), seedMaster: (id, n) => MASTER.seedMaster(id, n), guestInUse: n => users.has(String(n).toLowerCase()) && !!io.sockets.sockets.get(users.get(String(n).toLowerCase()))?.data.guest });
app.get('/privacy', (req, res) => res.sendFile(__dirname + '/public/privacy.html'));
app.get('/terms', (req, res) => res.sendFile(__dirname + '/public/terms.html'));
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
const roomList = (adult, vm) => Object.entries(ROOMS).filter(([n]) => adult || !adultR(n)).map(([name, cat]) => { const ss = seen(name, vm); return { name, cat, path: PATH[name] || [], topic: TOPICS[name], rating: rateOf(name), mics: micsOf(name), count: ss.length + botsIn(name).length, cams: ss.filter(x => x.data.cam).length, owner: UROOMS.get(name)?.owner || null, icon: UROOMS.get(name)?.icon || '', user: UROOMS.has(name) }; });
// favorites + "mine" (owner/admin) decoration for a signed-in account
const userFromReq = req => acc.userFromCookie(req.headers.cookie);
async function decorate(list, acct) { if (!acct) return list; const lc = acct.name.toLowerCase(); let f = new Set();
  try { f = new Set((await db.q('select room from favorites where owner=$1', [lc])).map(r => r.room)); } catch {}
  return list.map(r => ({ ...r, fav: f.has(r.name), mine: UROOMS.get(r.name)?.ownerLc === lc ? 'owner' : (MOD[r.name]?.admins?.has?.(lc) ? 'admin' : '') })); }
app.post('/api/fav', express.json(), async (req, res) => { const a = await userFromReq(req).catch(() => null); if (!a) return res.status(401).json({ error: 'Sign in to save favorites.' });
  const room = String(req.body?.room || ''); if (!ROOMS[room]) return res.status(404).json({ error: 'No such room.' }); const lc = a.name.toLowerCase();
  try { await db.q(req.body?.on ? 'insert into favorites(owner,room) values($1,$2) on conflict do nothing' : 'delete from favorites where owner=$1 and room=$2', [lc, room]); res.json({ ok: true }); } catch { res.status(503).json({ error: 'Favorites are unavailable right now.' }); } });
// ---- idle chat bots (Late Night), toggled by masters; not sockets, so they never count toward IP/session limits ----
const loadURooms = () => Promise.resolve().then(() => db.q('select * from user_rooms')).then(rs => { for (const r of rs) { if (ROOMS[r.name] && !UROOMS.has(r.name)) continue; UROOMS.set(r.name, { owner: r.owner, ownerLc: r.owner.toLowerCase(), emptySince: Date.now(), icon: r.icon || '' }); ROOMS[r.name] = DIR[r.cat] ? r.cat : 'Cultures & Community'; TOPICS[r.name] = r.topic || 'Welcome to ' + r.name; history[r.name] = history[r.name] || []; if (r.rating) RATE[r.name] = r.rating; if (r.mics) MICS[r.name] = r.mics; } if (rs.length) console.log('restored', rs.length, 'user rooms'); }).catch(e => console.error('user rooms', e.message));
// ICE servers (STUN + optional TURN), credentials come from env, never hardcoded in the client
let iceCache = null;
// room preview (Browse Rooms hover / long-press): who's inside, minus incognito masters and blocked users
app.get('/api/peek', async (req, res) => { const room = String(req.query.room || ''); if (!ROOMS[room]) return res.json({ names: [] }); const a = await userFromReq(req).catch(() => null);
  if (adultR(room) && !(await isAdultReq(req))) return res.json({ names: [] });
  let mine = new Set(); if (a) try { mine = new Set((await db.q('select blocked from blocks where owner=$1 union select owner from blocks where blocked=$1', [a.id])).map(r => r.blocked)); } catch { }
  const names = socks(room).filter(x => !x.data.inc && !(x.data.acct && mine.has(x.data.acct.id))).map(x => x.data.name).concat(botsIn(room).map(b => b.name || b));
  res.set('Cache-Control', 'no-store').json({ names: names.slice(0, 30), more: Math.max(0, names.length - 30) }); });
app.get('/api/gif', async (req, res) => { const k = process.env.GIPHY_KEY; if (!k) return res.json({ needKey: true }); try { const q = String(req.query.q || '').slice(0, 60); const u = 'https://api.giphy.com/v1/gifs/' + (q ? 'search' : 'trending') + '?api_key=' + encodeURIComponent(k) + '&limit=24&rating=pg-13' + (q ? '&q=' + encodeURIComponent(q) : ''); const r = await fetch(u); const j = await r.json(); res.json({ items: (j.data || []).map(d => d.id).filter(id => /^[A-Za-z0-9]{4,40}$/.test(id)) }); } catch (e) { res.json({ items: [] }); } });
app.get('/api/ice', async (req, res) => { const stun = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }; const out = [stun];
  try { const E = process.env;
    if (E.TURN_URLS && E.TURN_USERNAME && E.TURN_CREDENTIAL) out.push({ urls: E.TURN_URLS.split(',').map(x => x.trim()), username: E.TURN_USERNAME, credential: E.TURN_CREDENTIAL });
    else if (iceCache && iceCache.exp > Date.now()) out.push(...iceCache.list);
    else if (E.METERED_API_KEY && E.METERED_APP) { const r = await fetch('https://' + E.METERED_APP + '.metered.live/api/v1/turn/credentials?apiKey=' + encodeURIComponent(E.METERED_API_KEY)); const l = (await r.json()).filter(x => !/^stun:/.test([].concat(x.urls)[0])); iceCache = { list: l, exp: Date.now() + 3600e3 }; out.push(...l); }
    else if (E.CF_TURN_KEY_ID && E.CF_TURN_API_TOKEN) { const r = await fetch('https://rtc.live.cloudflare.com/v1/turn/keys/' + E.CF_TURN_KEY_ID + '/credentials/generate', { method: 'POST', headers: { Authorization: 'Bearer ' + E.CF_TURN_API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ ttl: 86400 }) }); const j = await r.json(); const l = [].concat(j.iceServers || []); iceCache = { list: l, exp: Date.now() + 12 * 3600e3 }; out.push(...l); }
  } catch (e) { console.error('ice', e.message); }
  res.set('Cache-Control', 'no-store').json({ iceServers: out }); });
const ANN = {}; (function loadAnn(n) { if (!db.status().ready) return n < 60 && setTimeout(() => loadAnn(n + 1), 2000).unref?.(); Promise.resolve().then(() => db.q('select room,text from room_ann')).then(r => r.forEach(x => ANN[x.room] = x.text)).catch(() => {}); })(0);
// report from profile / messenger (signed-in users)
app.post('/api/report', express.json(), async (req, res) => { const a = await userFromReq(req).catch(() => null); if (!a) return res.status(401).json({ error: 'Sign in to report.' });
  const who = String(req.body?.who || '').slice(0, 30), why = String(req.body?.why || '').slice(0, 300), msg = String(req.body?.msg || '').slice(0, 300); if (!who) return res.status(400).json({ error: 'Who are you reporting?' });
  MASTER.report(a.name, req.body?.room ? String(req.body.room).slice(0, 40) : null, who, (why + (msg ? ' | message: "' + msg + '"' : '')).slice(0, 600)); res.json({ ok: true }); });
// stats for Master Control: online now / peak today
const STAT = { day: '', peak: 0 }; const onlineNow = () => new Set([...io.sockets.sockets.values()].filter(x => x.data.name || x.data.acct).map(x => (x.data.acct?.name || x.data.name).toLowerCase())).size;
setInterval(() => { const d = new Date().toISOString().slice(0, 10), n = onlineNow(); if (STAT.day !== d) { STAT.day = d; STAT.peak = 0; } if (n > STAT.peak) { STAT.peak = n; Promise.resolve().then(() => db.q('insert into stats_day(d,peak) values($1,$2) on conflict(d) do update set peak=greatest(stats_day.peak,$2)', [d, n])).catch(() => {}); } }, 15e3).unref();
const BOTMOD = require('./bots'), BOTS = BOTMOD.BOTS; let botsOn = true; const botOff = new Set(); // rooms with bots switched off
const botsIn = room => botsOn && !botOff.has(room) ? (BOTMOD.byRoom[room] || []) : [];
const isBot = n => BOTS.some(b => b.name.toLowerCase() === String(n || '').toLowerCase());
const botRooms = () => Object.keys(BOTMOD.byRoom);
function saveBots() { Promise.resolve().then(() => db.q("insert into kv(k,v) values('bots',$1) on conflict(k) do update set v=$1", [JSON.stringify({ on: botsOn, off: [...botOff] })])).catch(() => {}); botRooms().forEach(r => ROOMS[r] && upd(r)); }
function setBots(on, room) { if (room !== undefined) { if (!BOTMOD.byRoom[room]) return botsOn; on ? botOff.delete(room) : botOff.add(room); } else botsOn = !!on; saveBots(); return botsOn; }
const getBots = () => ({ on: botsOn, total: BOTS.length, rooms: botRooms().map(r => ({ room: r, on: !botOff.has(r), bots: BOTMOD.byRoom[r].map(b => b.name) })) });
(function loadBots(n) { if (!db.status().ready) return n < 60 && setTimeout(() => loadBots(n + 1), 2000).unref?.(); Promise.resolve().then(() => db.q("select v from kv where k='bots'")).then(r => { if (r[0]) { const v = r[0].v; if (v === 'on' || v === 'off') botsOn = v !== 'off'; else try { const j = JSON.parse(v); botsOn = j.on !== false; (j.off || []).forEach(x => botOff.add(x)); } catch { } } botRooms().forEach(x => ROOMS[x] && upd(x)); }).catch(() => {}); })(0);
// each bot room ticks on its own randomized, staggered timer (every ~3-7 min) and only talks while real people are there
// bots: each room has its own random timer. Faster (40s-2.5min) while people are in the room, slow (4-10 min) while empty so rooms keep recent text.
const botSay = (room, b, text) => push(room, { name: b.name, av: b.av || '', role: '', text: esc(text), color: b.color || '#000080', b: false, i: false, u: false, f: b.font || 'Arial', t: Date.now() });
const lastBot = {};
function botTick(room) { const busy = socks(room).length > 0; setTimeout(() => botTick(room), (busy ? 40 + Math.random() * 110 : 240 + Math.random() * 360) * 1000).unref?.();
  const bs = botsIn(room); if (!bs.length) return; const b = bs[Math.floor(Math.random() * bs.length)];
  const line = BOTMOD.line(b, room, lastBot[room]); lastBot[room] = line; botSay(room, b, line);
  // sometimes a second bot answers a moment later, so it reads like a conversation
  if (bs.length > 1 && Math.random() < 0.35) { const o = bs.filter(x => x !== b)[Math.floor(Math.random() * (bs.length - 1))]; setTimeout(() => botsIn(room).includes(o) && botSay(room, o, BOTMOD.reply(o, b.name)), 6000 + Math.random() * 14000).unref?.(); } }
// a bot may greet a person who says hi or mentions it
function botHear(room, who, text) { const bs = botsIn(room); if (!bs.length) return; const t = String(text).toLowerCase();
  const named = bs.find(b => t.includes(b.name.toLowerCase())); const hi = /\b(hi|hey|hello|hola|sup|yo|wassup|anyone)\b/.test(t);
  if (!named && !(hi && Math.random() < 0.6)) return; const b = named || bs[Math.floor(Math.random() * bs.length)];
  setTimeout(() => botsIn(room).includes(b) && botSay(room, b, BOTMOD.greet(b, who)), 3000 + Math.random() * 6000).unref?.(); }
botRooms().forEach((r, i) => setTimeout(() => botTick(r), 60e3 + i * 7000 + Math.random() * 120e3).unref?.());
const onlineTotal = () => new Set([...io.sockets.sockets.values()].filter(x => (x.data.name || x.data.acct) && !x.data.inc).map(x => (x.data.acct?.name || x.data.name).toLowerCase())).size + botRooms().reduce((n, r) => n + botsIn(r).length, 0);
// buddy list for the room Invite picker (signed-in only)
app.get('/api/buddies', async (req, res) => { const a = await userFromReq(req).catch(() => null); if (!a) return res.status(401).json({ error: 'Sign in to invite buddies.' });
  try { const cs = await db.q('select u.id,u.name,u.avatar from contacts c join users u on u.id=c.contact where c.owner=$1 order by lower(u.name)', [a.id]);
    res.set('Cache-Control', 'no-store').json(cs.map(c => { const p = acc.presence(c.id) || {}; return { name: c.name, avatar: c.avatar || '', online: !!p.online, status: p.online ? (p.status || 'available') : 'offline', room: p.room || null }; })); } catch { res.json([]); } });
// ---- "Snap" a profile photo from your phone: one-time QR link (10 min) ----
const SNAP = new Map(); setInterval(() => { const n = Date.now(); for (const [k, v] of SNAP) if (v.exp < n) SNAP.delete(k); }, 60e3).unref();
app.get('/snap', (q, r) => r.sendFile(require('path').join(__dirname, 'public', 'snap.html')));
app.get('/snapchk', (q, r) => { const v = SNAP.get(String(q.query.t || '')); r.set('Cache-Control', 'no-store').json(v && v.exp > Date.now() ? { ok: true, name: v.name } : { error: 'This photo link expired or was already used. Make a new QR code on your computer.' }); });
app.post('/snapup', express.json({ limit: '80kb' }), async (req, res) => { const t = String(req.body?.t || ''), v = SNAP.get(t);
  if (!v || v.exp < Date.now()) return res.status(410).json({ error: 'This photo link expired or was already used. Make a new QR code on your computer.' });
  const p = parseAvatar(req.body?.img); if (p.error) return res.status(400).json(p); SNAP.delete(t);
  try { if (!db.status().ready) return res.status(503).json({ error: 'Accounts are temporarily unavailable.' }); const av = 'c' + Date.now().toString(36);
    await db.q('insert into avatars(user_id,mime,data,updated) values($1,$2,$3,now()) on conflict(user_id) do update set mime=$2,data=$3,updated=now()', [v.uid, p.mime, p.buf]);
    await db.q('update users set avatar=$2 where id=$1', [v.uid, av]); await acc.setAvatar(v.uid, av);
    for (const [, x] of io.sockets.sockets) if (x.data.acct && x.data.acct.id === v.uid) { x.data.av = av; x.emit('snap:done', { av }); }
    io.emit('avatar', { name: v.name, av }); res.json({ ok: true }); } catch (e) { console.error('[snap]', e.message); res.status(500).json({ error: 'Could not save the photo.' }); } });
app.get('/api/online', (q, r) => r.set('Cache-Control', 'no-store').json({ n: onlineTotal() }));
async function isAdultReq(req) { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return false; try { return !!(await db.q('select adult from users where id=$1', [u.id]))[0]?.adult; } catch { return false; } }
app.get('/api/rooms', async (q, r) => {
  const socialOrigin = 'https://social-chat-preview-jn.fair-mink-5216.chatgpt.site';
  r.vary('Origin');
  if (q.get('Origin') === socialOrigin) {
    r.set('Access-Control-Allow-Origin', socialOrigin);
    return r.json(await decorate(roomList(false), null));
  }
  return r.json(await decorate(roomList(await isAdultReq(q)), await userFromReq(q).catch(() => null)));
});
app.post('/api/adult', express.json(), async (req, res) => { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in first.' });
  if (req.body?.confirm !== true) return res.status(400).json({ error: 'Confirmation required.' }); await db.q('update users set adult=true where id=$1', [u.id]);
  for (const x of io.sockets.sockets.values()) if (x.data.acct?.id === u.id) x.data.adult = true; res.json({ ok: true }); });
const roomVisible = lc => { const id = users.get(lc), x = id && io.sockets.sockets.get(id); return !!x && !x.data.inc; };
// ---- profiles (typed by the user; never derived from IP) ----
const PCLEAN = (t, n) => String(t ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
app.get('/api/profile/:name', async (req, res) => { const n = String(req.params.name || ''), lc = n.toLowerCase(); res.set('Cache-Control', 'no-store');
  if (db.status().ready) { try { const r = (await db.q('select name,avatar,display_name,age,location,bio,interests,created from users where name_lc=$1', [lc]))[0];
    if (r) { const v = await acc.userFromCookie(req.headers.cookie); let hide = false; if (v && v.name.toLowerCase() !== lc) { const [vu] = await db.q('select is_master from users where id=$1', [v.id]); const [tu] = await db.q('select id from users where name_lc=$1', [lc]); hide = !vu?.is_master && await blockedBy(tu.id, v.id); }
    return res.json({ name: r.name, avatar: r.avatar, displayName: r.display_name, age: r.age, location: r.location, bio: r.bio, interests: r.interests, memberSince: r.created, online: !hide && (acc.isOnline(r.name) || roomVisible(lc)) }); } } catch { } }
  const id = users.get(lc), x = id && io.sockets.sockets.get(id); if (x && x.data.guest) return res.json({ name: x.data.name, guest: true, online: true, room: x.data.room });
  res.status(404).json({ error: 'No such user.' }); });
app.post('/api/profile', express.json(), async (req, res) => { const u = await acc.userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in to edit your profile.' });
  const b = req.body || {}; let age = b.age === '' || b.age == null ? null : parseInt(b.age, 10);
  if (age !== null && !(age >= 18 && age <= 120)) return res.status(400).json({ error: 'Age must be between 18 and 120 (or left blank). YappChat is for adults 18+.' });
  await db.q('update users set display_name=$2, age=$3, location=$4, bio=$5, interests=$6 where id=$1', [u.id, PCLEAN(b.displayName, 30), age, PCLEAN(b.location, 50), PCLEAN(b.bio, 300), PCLEAN(b.interests, 150)]);
  res.json({ ok: true }); });
// ---- site admin: room ratings / closing (ADMIN_KEY) ----
app.get('/api/admin/rooms', (req, res) => { if (!keyOk(req.get('x-admin-key'))) return res.status(401).json({ error: 'Unauthorized' }); res.json(roomList(true).map(r => ({ ...r, official: OFFICIAL.has(r.name) }))); });
function closeRoom(room) { if (!ROOMS[room]) return 'No such room.'; if (OFFICIAL.has(room)) return 'Official rooms cannot be closed.';
  for (const x of socks(room)) { x.emit('msg', { sys: true, text: 'This room was closed by a moderator.' }); x.data.rejoin('Lobby'); }
  UROOMS.delete(room); delURoom(room); delete ROOMS[room]; delete TOPICS[room]; delete history[room]; delete RATE[room]; delete MOD[room]; delete MICS[room]; delete HQ[room]; delete MTIMER[room]; delete QUEUE[room]; MASTER.saveMics(room, null); MASTER.saveRating(room, null); MASTER.saveMod(room); return null; }
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
function members(room, vm) { return [...seen(room, vm).map(x => x.data.name), ...botsIn(room).map(b => b.name)].sort((a,b)=>a.localeCompare(b)); }
function roster(room, vm) { return seen(room, vm).map(x => ({ ...(vm && x.data.inc ? { inc: true } : {}), name: x.data.name, av: x.data.av || '', id: x.id, guest: !!x.data.guest, cam: !!x.data.cam, talk: !!x.data.talk, ...(x.data.music ? { music: true } : {}), ...(x.data.idle ? { idle: true } : {}), tl: x.data.talk && x.data.talkUntil ? Math.max(0, Math.ceil((x.data.talkUntil - Date.now()) / 1000)) : 0, role: x.data.master ? '' : roleOf(x, room), dot: dotLeft(room, x.data.name.toLowerCase()) !== null, dl: Math.ceil((dotLeft(room, x.data.name.toLowerCase()) || 0) / 1000), mt: mod(room).mt.has(x.data.name.toLowerCase()), mm: mod(room).mm.has(x.data.name.toLowerCase()), voice: !!x.data.voice, viewers: x.data.cam ? [...(x.data.viewers||[])].map(v => io.sockets.sockets.get(v)?.data.name).filter(Boolean) : [] })).concat(botsIn(room).map((b, i) => ({ name: b.name, av: b.av, id: 'bot-' + i, guest: true, bot: true, cam: false, talk: false, tl: 0, role: '', dot: false, dl: 0, mt: false, mm: false, voice: false, viewers: [] }))).sort((a,b)=>a.name.localeCompare(b.name)); }
const MICS = {}; const MIC_DEFAULT_OFFICIAL = 3;
const micsOf = r => MICS[r] || (UROOMS.has(r) ? 1 : MIC_DEFAULT_OFFICIAL);
const micsUsed = r => socks(r).filter(x => x.data.talk).length;
function parseSecs(t) { if (t == null || t === '' || t === 'off' || t === 0 || t === '0') return 0; const m = String(t).trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?)?$/); if (!m) return null;
  const v = Math.round(parseFloat(m[1]) * (m[2] && m[2][0] === 'm' ? 60 : 1)); return v >= 5 && v <= 300 ? v : null; }
function setMicOpts(room, { hq, timer, mann } = {}) { if (!ROOMS[room]) return 'No such room.'; let t;
  if (mann !== undefined) { mann = +mann; if (![0, 1, 2, 3, 5].includes(mann)) return 'Mic timer must be off, 1, 2, 3 or 5 minutes.'; MANN[room] = mann; }
  if (timer !== undefined) { t = parseSecs(timer); if (t === null) return 'Timer must be off or 5 seconds to 5 minutes (e.g. 45s, 1m30 = 90).'; }
  if (hq !== undefined) { HQ[room] = !!hq; if (!hq) QUEUE[room] = []; } if (t !== undefined) { MTIMER[room] = t; for (const x of socks(room)) if (x.data.talk) x.data.talkUntil = t ? Date.now() + t * 1000 : 0; }
  MASTER.saveMeta(room, { hq: !!HQ[room], mtimer: MTIMER[room] || 0, mann: MANN[room] || 0 }); upd(room); return null; }
function setMics(room, n) { n = +n; if (!ROOMS[room]) return 'No such room.'; if (![1, 2, 3, 4, 5].includes(n)) return 'Mic limit must be 1 to 5.';
  MICS[room] = n; MASTER.saveMics(room, n); io.to(room).emit('mics', { room, max: n }); upd(room); return null; }
const HQ = {}, MTIMER = {}, QUEUE = {}, MANN = {}; // hands-up on/off, per-turn seconds (0=off), ordered socket ids
const qOf = r => QUEUE[r] = (QUEUE[r] || []).filter(id => { const x = io.sockets.sockets.get(id); return x && x.data.room === r && x.data.voice && !x.data.talk; });
const hqOn = r => !!HQ[r] && micsOf(r) === 1;
function micq(room) { return { room, on: hqOn(room), timer: MTIMER[room] || 0, mann: MANN[room] || 0, max: micsOf(room), q: hqOn(room) ? qOf(room).map(id => io.sockets.sockets.get(id).data.name) : [] }; }
function startTurn(x, room) { x.data.talk = true; x.data.talkStart = Date.now(); x.data.talkAnn = 0; x.data.talkUntil = MTIMER[room] ? Date.now() + MTIMER[room] * 1000 : 0; }
function advance(room) { if (!room || !ROOMS[room]) return false; let ch = false;
  for (const x of socks(room)) if (x.data.talk && x.data.talkUntil && x.data.talkUntil <= Date.now()) { x.data.talk = false; x.data.talkUntil = 0; x.emit('micdrop', { reason: 'time' }); push(room, { sys: true, text: esc(x.data.name) + "'s mic time is up." }); ch = true; }
  if (hqOn(room)) { const q = qOf(room); while (q.length && micsUsed(room) < micsOf(room)) { const x = io.sockets.sockets.get(q.shift()); if (mod(room).mm.has(x.data.name.toLowerCase())) continue; startTurn(x, room); x.emit('yourturn', { secs: MTIMER[room] || 0 }); push(room, { sys: true, text: esc(x.data.name) + ' has the mic.' }); ch = true; } }
  return ch; }
setInterval(() => { for (const r of Object.keys(ROOMS)) { let ch = advance(r);
  if (MANN[r] && micsOf(r) === 1) for (const x of socks(r)) if (x.data.talk && x.data.talkStart) { const n = Math.floor((Date.now() - x.data.talkStart) / 60e3 / MANN[r]) * MANN[r]; if (n > (x.data.talkAnn || 0)) { x.data.talkAnn = n; push(r, { sys: true, text: esc(x.data.name) + ' has been on the mic ' + n + ' minute' + (n > 1 ? 's' : '') + '.' }); } } const d = MOD[r]?.dot;
  if (d) for (const [n, u] of d) if (u < DOTFOREVER && u <= Date.now()) { d.delete(n); ch = true; const x = socks(r).find(y => y.data.name.toLowerCase() === n); if (x) x.emit('undotted', { auto: true }); MASTER.saveMod(r); }
  if (ch) upd(r); } }, 1000).unref();
const AH = { roomExists: r => !!ROOMS[r], roomRating: r => rateOf(r), rawRoomOf: n => { const x = io.sockets.sockets.get(users.get(String(n).toLowerCase())); return x && x.data.room && ROOMS[x.data.room] ? x.data.room : null; },
  bannedFrom: (r, n) => { const e = MOD[r]?.kicked?.get?.(String(n).toLowerCase()); return !!e && e > Date.now(); },
  toRoomUser: (n, ev, d) => { const x = io.sockets.sockets.get(users.get(String(n).toLowerCase())); x && x.emit(ev, d); }, roomOf: n => { const x = io.sockets.sockets.get(users.get(String(n).toLowerCase())); return x && x.data.room && !x.data.inc && !x.data.master && ROOMS[x.data.room] ? x.data.room : null; } };
function lists(room) { if (!room) return; setImmediate(() => { for (const x of socks(room)) if (x.data.acct) AH.roomChanged?.(x.data.name); }); const R = {}; for (const x of socks(room)) { const k = x.data.master ? 1 : 0; R[k] = R[k] || [roster(room, !!k), members(room, !!k)]; x.emit('roster', R[k][0]); x.emit('members', R[k][1]); } }
function upd(room) { if (room) { lists(room); io.to(room).emit('micq', micq(room)); } }
const MAXVIEW = 6;
// ---- room moderation: owner (or site admin via ADMIN_KEY) > room admins > users. All checks are server-side. ----
const MOD = {}; const KICK_MS = 5 * 60e3;
const mod = r => MOD[r] = MOD[r] || { admins: new Set(), kicked: new Map(), dot: new Map(), mt: new Set(), mm: new Set() };
const ROOMBUZZ = new Map();
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
function push(room, m) { m.t = m.t || Date.now(); (history[room] = history[room] || []).push(m); if (history[room].length > HIST) history[room].shift(); io.to(room).emit('msg', m);
  if (!/has (entered|left) the room/.test(m.text || '') && db.status().ready) Promise.resolve().then(() => db.q('insert into room_history(room,msg) values($1,$2)', [room, JSON.stringify(m)])).catch(() => {}); }
// trim stored history to the last HIST messages per room
setInterval(() => { if (db.status().ready) Promise.resolve().then(() => db.q('delete from room_history h using (select id, row_number() over (partition by room order by id desc) rn from room_history) x where h.id=x.id and x.rn>$1', [HIST])).catch(() => {}); }, 10 * 60e3).unref();
(function loadHist(n) { if (!db.status().ready) return n < 90 && setTimeout(() => loadHist(n + 1), 2000).unref?.();
  Promise.resolve().then(() => db.q('select room,msg from (select room,msg,id,row_number() over (partition by room order by id desc) rn from room_history) x where rn<=$1 order by id', [HIST])).then(rs => { const by = {}; for (const r of rs) (by[r.room] = by[r.room] || []).push(typeof r.msg === 'string' ? JSON.parse(r.msg) : r.msg);
    for (const [k, v] of Object.entries(by)) if (ROOMS[k] || UROOMS.has(k)) { const live = (history[k] || []).filter(m => !v.some(o => o.t === m.t && o.text === m.text)); history[k] = v.concat(live).slice(-HIST); } if (rs.length) console.log('restored history for', Object.keys(by).length, 'rooms'); }).catch(e => console.error('history', e.message)); })(0);
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
// per-IP socket cap + per-socket event rate limit (masters get a higher ceiling)
const IPCONN = new Map(), MAXCONN = +process.env.MAX_SOCKETS_PER_IP || 30, KEYTRY = new Map();
io.use((s, next) => { const ip = geo.clientIp(s.handshake.headers, s.handshake.address); const n = IPCONN.get(ip) || 0; if (n >= MAXCONN) return next(new Error('Too many connections')); IPCONN.set(ip, n + 1); s.once('disconnect', () => { const m = (IPCONN.get(ip) || 1) - 1; m > 0 ? IPCONN.set(ip, m) : IPCONN.delete(ip); }); next(); });
io.on('connection', s => {
  { let win = Date.now(), cnt = 0, strikes = 0; s.use((pkt, next) => { const now = Date.now(); if (now - win > 10e3) { win = now; cnt = 0; } const lim = s.data.master ? 800 : 300;
    if (++cnt > lim) { if (++strikes > 50) { s.disconnect(true); return; } const cb = pkt[pkt.length - 1]; if (typeof cb === 'function') cb({ error: 'Slow down - too many actions.' }); return; } next(); }); }
  let stamps = [];
  s.on('login', async ({ name, room }, cb) => {
    name = s.data.acct ? s.data.acct.name : String(name || '').trim();
    if (!s.data.acct) {
      if (!/^[A-Za-z][A-Za-z0-9 _-]{2,19}$/.test(name)) return cb({ error: 'Guest screen names must be 3–20 characters, start with a letter, and use only letters, numbers, spaces, hyphens, or underscores.' });
      if (/razzle/i.test(name)) return cb({ error: 'Guest screen names cannot contain “razzle”.' });
      if (/^(admin|administrator|moderator|mod|support|system|yappchat|staff|root)/i.test(name) || isBot(name) || MASTER.reserved(name)) return cb({ error: 'That screen name is not available.' });
      if (db.status().ready) { try { if ((await db.q('select 1 from users where name_lc=$1', [name.toLowerCase()])).length) return cb({ error: 'That screen name belongs to a registered user. Pick another guest name or sign in.' }); } catch { } }
      s.data.guest = true;
    }
    if (typeof cb !== 'function') return;
    if (!ROOMS[room]) return cb({ error: 'That room no longer exists.' });
    if (s.data.name) return cb({ error: 'Already signed in' });
    if (adultR(room) && !s.data.adult && !s.data.master) return cb({ error: room + ' is rated ' + rateOf(room) + '. Confirm you are 18 or older to join.', adult: true });
    if (!s.data.master) { const left = kickedLeft(room, name); if (left > 1e12) return cb({ error: 'You are banned from ' + room + '.' }); if (left) return cb({ error: 'You were bounced from ' + room + '. You can rejoin in about ' + Math.ceil(left / 60e3) + ' min.' }); }
    { const dc = devConflict(s, name); if (dc) return cb({ error: 'Another screen name (' + dc + ') is already signed in on this computer. Sign out of it first - only one screen name per computer.' }); }
    if (users.has(name.toLowerCase())) { const o = io.sockets.sockets.get(users.get(name.toLowerCase()));
      const mine = o && (s.data.acct ? o.data.acct && o.data.acct.id === s.data.acct.id : o.data.guest && s.data.dev && o.data.dev === s.data.dev);
      if (o && mine && !s.data.master) { o.emit('signed-elsewhere', { text: 'Signed in elsewhere' }); o.disconnect(true); users.delete(name.toLowerCase()); }
      else if (o && mine && s.data.master) return cb({ error: 'You are already in a room with this screen name in another tab.' });
      else if (o) return cb({ error: 'That screen name is in use right now. Try another.' }); }
    if (s.data.guest && acc.isOnline(name)) return cb({ error: 'That screen name is in use right now. Try another.' });
    await loadPrefs();
    users.set(name.toLowerCase(), s.id); s.data.name = name;
    if (s.data.acct && db.status().ready) { try { s.data.av = (await db.q('select avatar from users where id=$1', [s.data.acct.id]))[0]?.avatar || ''; } catch { } }
    { const ip = geo.clientIp(s.handshake.headers, s.handshake.address); if (s.data.guest) geo.recordGuest(name, ip).catch(() => {}); else if (s.data.acct) geo.recordAccount(s.data.acct.id, ip, 'room'); }
    join(room); cb({ ok: true, name, colors: COLORS, account: !!s.data.acct, ...(s.data.master ? { m: true } : {}) });
  });
  const graceSkip = room => { const g = GRACE.get(s.data.name.toLowerCase()); if (!g) return false; GRACE.delete(s.data.name.toLowerCase()); clearTimeout(g.t); return g.room === room; };
  const noticeOk = () => !s.data.master || (s.data.announce && !s.data.inc); // masters enter/leave silently by default
  function join(room) {
    if (s.data.room) { s.leave(s.data.room); if (noticeOk()) push(s.data.room, { sys: true, who: s.data.name, text: `${esc(s.data.name)} has left the room.` }); lists(s.data.room); }
    const old = s.data.room; mediaReset(); if (old) upd(old);
    s.data.inc = !!(s.data.master && s.data.incPref); s.data.room = room; s.join(room); s.emit('history', { room, topic: TOPICS[room], msgs: history[room], owner: UROOMS.get(room)?.owner || null, icon: UROOMS.get(room)?.icon || '', rating: rateOf(room), mics: micsOf(room), ann: ANN[room] || '' });
    if (!graceSkip(room) && noticeOk()) push(room, { sys: true, who: s.data.name, text: `${esc(s.data.name)} has entered the room.` }); upd(room); s.emit('inc', { on: !!s.data.inc, announce: !!s.data.announce });
  }
  s.on('create-room', ({ name, topic, rating, mics, cat, icon }, cb) => {
    if (typeof cb !== 'function') return; if (!s.data.acct) return cb({ error: 'Guests cannot create rooms. Get a free screen name to create one.' });
    name = String(name || '').replace(/\s+/g, ' ').trim(); const e = roomNameError(name); if (e) return cb({ error: e });
    if (!RATINGS.includes(rating)) return cb({ error: 'Choose a rating for your room: PG-13 or R.' }); if (rating !== 'PG-13' && !s.data.adult) return cb({ error: 'Confirm you are 18 or older to create an R-rated room.', adult: true });
    const lc = s.data.acct.name.toLowerCase(); if (!s.data.master && [...UROOMS.values()].filter(r => r.ownerLc === lc).length >= MAXU) return cb({ error: 'You can own at most ' + MAXU + ' rooms at a time.' });
    if (!DIR[cat]) return cb({ error: 'Choose a section (category) for your room.' }); UROOMS.set(name, { owner: s.data.acct.name, ownerLc: lc, emptySince: Date.now(), icon: ICONS.includes(icon) ? icon : '' }); ROOMS[name] = cat; TOPICS[name] = cleanTopic(topic) || 'Welcome to ' + name; history[name] = []; RATE[name] = rating; MASTER.saveRating(name, rating); mics = [1, 2, 3, 4, 5].includes(+mics) ? +mics : 1; MICS[name] = mics; MASTER.saveMics(name, mics);
    saveURoom(name); cb({ ok: true, name, rating, mics }); if (s.data.name) join(name);
  });
  const isOwner = () => { const r = UROOMS.get(s.data.room); return r && s.data.acct && r.ownerLc === s.data.acct.name.toLowerCase(); };
  s.on('rename-room', async (nn, cb) => { if (typeof cb !== 'function') return; const old = s.data.room;
    if (!old || !UROOMS.has(old) || !(isOwner() || s.data.master)) return cb({ error: 'Only the room owner can rename this room.' });
    const name = String(nn || '').replace(/\s+/g, ' ').trim(); if (name === old) return cb({ ok: true, name });
    const r0 = UROOMS.get(old); UROOMS.delete(old); const e = roomNameError(name); if (e) { UROOMS.set(old, r0); return cb({ error: e }); }
    try { await db.q('update user_rooms set name=$2 where name=$1', [old, name]);
      for (const t of ['room_meta', 'room_mod', 'room_ann', 'room_history', 'favorites']) await db.q(`update ${t} set room=$2 where room=$1`, [old, name]).catch(err => console.error('rename', t, err.message));
    } catch (err) { UROOMS.set(old, r0); return cb({ error: err.code === '23505' ? 'A room with that name already exists.' : 'Could not rename the room right now.' }); }
    UROOMS.set(name, r0); for (const M of [ROOMS, TOPICS, history, RATE, MOD, MICS, HQ, MTIMER, QUEUE, MANN, ANN]) if (old in M) { M[name] = M[old]; delete M[old]; }
    for (const x of socks(old)) { x.leave(old); x.join(name); x.data.room = name; }
    io.to(name).emit('room-renamed', { from: old, to: name }); push(name, { sys: true, text: 'Room renamed to ' + esc(name) }); upd(name); io.emit('rooms-changed'); cb({ ok: true, name }); });
  s.on('set-topic', (t, cb) => { if (!isOwner()) return cb && cb({ error: 'Only the room owner can change the topic.' }); TOPICS[s.data.room] = cleanTopic(t) || TOPICS[s.data.room];
    saveURoom(s.data.room); io.to(s.data.room).emit('topic', TOPICS[s.data.room]); push(s.data.room, { sys: true, text: esc(s.data.name) + ' changed the topic to: ' + esc(TOPICS[s.data.room]) }); cb && cb({ ok: true }); });
  s.on('kick', (who, cb) => doMod({ action: 'kick', who }, cb));
  let keyTries = 0;
  s.on('mod:site', (k, cb) => { if (typeof cb !== 'function') return; const kip = s.data.ip || '?', kt = (KEYTRY.get(kip) || []).filter(t => Date.now() - t < 3600e3); if (++keyTries > 5 || kt.length >= 10) return cb({ error: 'Too many attempts.' }); kt.push(Date.now()); KEYTRY.set(kip, kt);
    if (!keyOk(k)) return cb({ error: 'Wrong admin key.' }); s.data.site = true; upd(s.data.room); cb({ ok: true }); });
  s.on('mod:list', cb => { if (typeof cb !== 'function') return; if (!roleOf(s, s.data.room)) return cb({ error: 'Only the room owner and admins can do that.' }); cb(modList(s.data.room)); });
  s.on('mod', (d, cb) => doMod(d || {}, cb));
  s.on('room:cats', cb => typeof cb === 'function' && cb({ cats: Object.keys(DIR), icons: ICONS }));
  s.on('room:icon', (icon, cb) => { cb = typeof cb === 'function' ? cb : () => {}; const room = s.data.room, u = UROOMS.get(room); if (!u) return cb({ error: 'Only rooms created by members can have a custom icon.' });
    if (roleOf(s, room) !== 'owner') return cb({ error: 'Only the room owner can change the room icon.' }); if (icon && !ICONS.includes(icon)) return cb({ error: 'Pick an icon from the list.' });
    u.icon = icon || ''; saveURoom(room); io.to(room).emit('room-icon', { room, icon: u.icon }); cb({ ok: true }); });
  s.on('mod:clearhist', cb => { cb = typeof cb === 'function' ? cb : () => {}; const room = s.data.room; if (!room || !roleOf(s, room)) return cb({ error: 'Only the room owner and admins can do that.' });
    history[room] = []; Promise.resolve().then(() => db.q('delete from room_history where room=$1', [room])).catch(() => {}); io.to(room).emit('clear-history', { by: s.data.master ? 'a moderator' : s.data.name }); push(room, { sys: true, mod: true, text: 'Room history was cleared by ' + (s.data.master ? 'a moderator' : esc(s.data.name)) + '.' }); cb({ ok: true }); });
  function doMod(d, cb) { modAct(s, s.data.room, d, cb); }
  s.data.rejoin = r => join(r);
  s.on('rooms', async cb => typeof cb === 'function' && cb(await decorate(roomList(!!s.data.adult || !!s.data.master, !!s.data.master), s.data.acct)));
  s.on('adult', async (yes, cb) => { if (yes !== true) return; s.data.adult = true; if (s.data.acct && db.status().ready) { try { await db.q('update users set adult=true where id=$1', [s.data.acct.id]); } catch { } } typeof cb === 'function' && cb({ ok: true }); });
  s.on('join', (room, cb) => { if (!s.data.name || !ROOMS[room] || room === s.data.room) return cb && cb({ error: ROOMS[room] ? 'Already here' : 'That room no longer exists.' });
    if (adultR(room) && !s.data.adult && !s.data.master) return cb && cb({ error: room + ' is rated ' + rateOf(room) + '. Confirm you are 18 or older to join.', adult: true });
    if (!s.data.master) { const left = kickedLeft(room, s.data.name); if (left > 1e12) return cb && cb({ error: 'You are banned from that room.' }); if (left) return cb && cb({ error: 'You were bounced from that room. Try again in about ' + Math.ceil(left / 60e3) + ' min.' }); } join(room); cb && cb({ ok: true }); });
  s.on('say', m => {
    if (!s.data.name || !m) return;
    if (mod(s.data.room).mt.has(s.data.name.toLowerCase())) return s.emit('msg', { sys: true, text: 'You are muted in this room and cannot send messages.' });
    const now = Date.now(); stamps = stamps.filter(t => now - t < 10000);
    if (stamps.length >= 5) { if (now - (s.data.flw || 0) > 5000) { s.data.flw = now; s.emit('msg', { sys: true, text: 'Whoa, slow down a little! Give it a few seconds and try again.' }); } return; }
    stamps.push(now);
    const text = String(m.text || '').trim().slice(0, MAXLEN); if (!text) return;
    { const fl = FLOOD.check(s.data.acct?.name || s.data.name, text, s.data.master); if (fl) return s.emit('msg', { sys: true, text: fl }); }
    if (s.data.inc) { if (m.vis !== true) { stamps.pop(); return s.emit('incwarn', { text }); } s.data.inc = false; upd(s.data.room); s.emit('inc', { on: false, announce: !!s.data.announce }); }
    const FONTS = ['Arial','Verdana','Tahoma','Comic Sans MS','Times New Roman','Courier New'];
    push(s.data.room, { name: esc(s.data.name), av: s.data.av || '', role: s.data.master ? '' : roleOf(s, s.data.room), ...(s.data.guest && !s.data.master ? { g: true } : {}), text: esc(text), color: COLORS.includes(m.color) ? m.color : '#000000', b: !!m.b, i: !!m.i, u: !!m.u, f: FONTS.includes(m.f) ? m.f : 'Arial', t: now });
    if (!s.data.inc) botHear(s.data.room, s.data.name, text);
  });
  function mediaReset() {
    const room = s.data.room; if (!room) return;
    if (!s.data.inc) io.to(room).emit('media-gone', { id: s.id });
    for (const x of socks(room)) x.data.viewers?.delete(s.id);
    s.data.cam = false; s.data.talk = false; s.data.voice = false; s.data.viewers = new Set();
  }
  const same = id => { const t = io.sockets.sockets.get(id); return t && t.data.name && t.data.room === s.data.room && (!t.data.inc || s.data.master) ? t : null; };
  s.on('idle', on => { if (!s.data.name || s.data.idle === !!on) return; s.data.idle = !!on; upd(s.data.room); });
  s.on('avmode', on => { if (!s.data.name) return; s.data.music = !!on; upd(s.data.room); });
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
  s.on('handq', ({ who, op } = {}, cb) => { cb = typeof cb === 'function' ? cb : () => {}; const room = s.data.room; if (!roleOf(s, room) && !s.data.master) return cb({ error: 'Only the room owner and admins can manage the line.' });
    if (op === 'pass') { const cur = socks(room).filter(x => x.data.talk); if (!qOf(room).length) return cb({ error: 'Nobody is in line.' }); for (const x of cur) { x.data.talk = false; x.data.talkUntil = 0; x.emit('micdrop', { reason: 'pass' }); } push(room, { sys: true, text: esc(s.data.name) + ' passed the mic to the next in line.' }); advance(room); upd(room); return cb({ ok: true }); }
    const q = qOf(room), i = q.findIndex(id => io.sockets.sockets.get(id).data.name.toLowerCase() === String(who || '').toLowerCase()); if (i < 0) return cb({ error: 'Not in line.' });
    const [id] = q.splice(i, 1); if (op === 'up') q.splice(Math.max(0, i - 1), 0, id); else if (op === 'down') q.splice(Math.min(q.length, i + 1), 0, id); else if (op === 'top') q.unshift(id); else if (op !== 'remove') q.splice(i, 0, id);
    QUEUE[room] = q; upd(room); cb({ ok: true }); });
  s.on('set-micopts', ({ hq, timer, mann } = {}, cb) => { cb = typeof cb === 'function' ? cb : () => {}; if (!roleOf(s, s.data.room) && !s.data.master) return cb({ error: 'Only the room owner and admins can change mic settings.' });
    const e = setMicOpts(s.data.room, { hq, timer, mann }); if (e) return cb({ error: e }); const r = s.data.room;
    push(r, { sys: true, text: 'Mic settings: hands up ' + (HQ[r] ? 'on' : 'off') + ', turn limit ' + (MTIMER[r] ? MTIMER[r] + 's' : 'off') + ', mic timer ' + (MANN[r] ? MANN[r] + ' min' : 'off') + '.' }); cb({ ok: true }); });
  s.on('set-mics', (n, cb) => { cb = typeof cb === 'function' ? cb : () => {}; if (roleOf(s, s.data.room) !== 'owner') return cb({ error: 'Only the room owner can change the mic limit.' });
    const e = setMics(s.data.room, n); if (e) return cb({ error: e }); saveURoom(s.data.room); push(s.data.room, { sys: true, text: 'Mic limit set to ' + MICS[s.data.room] + (MICS[s.data.room] === 1 ? ' (single mic).' : ' talkers at once.') }); cb({ ok: true }); });
  s.on('cam', on => { if (!s.data.name || (on && s.data.inc)) return; if (on && s.data.guest && !s.data.master) return s.emit('msg', { sys: true, text: 'Guests can\'t broadcast a webcam. Get a free screen name to use your cam.' }); s.data.cam = !!on; if (!on) { io.to(s.data.room).emit('cam-off', { id: s.id }); s.data.viewers = new Set(); } upd(s.data.room); });
  s.on('view', (id, cb) => { if (s.data.inc) return cb && cb({ error: 'You are incognito.' }); const t = same(id); if (!t || !t.data.cam) return cb && cb({ error: 'That webcam is not available.' });
    t.data.viewers = t.data.viewers || new Set(); if (!s.data.master && t.data.acct && s.data.acct && t.data.blk?.has(s.data.acct.id)) return cb && cb({ error: 'That webcam is not available.' }); if (t.data.camBlock?.has(s.data.name.toLowerCase())) return cb && cb({ error: t.data.name + ' has blocked you from viewing their webcam.' });
    if (!t.data.viewers.has(s.id) && t.data.viewers.size >= MAXVIEW) return cb && cb({ error: 'That webcam has the maximum number of viewers (' + MAXVIEW + ').' });
    t.data.viewers.add(s.id); t.emit('view-req', { id: s.id, name: s.data.name }); upd(s.data.room); cb && cb({ ok: true }); });
  s.on('cam:block', (name, cb) => { if (!s.data.name) return; const lc = String(name || '').toLowerCase(); const v = socks(s.data.room).find(x => x.data.name.toLowerCase() === lc);
    if (!v || v.id === s.id) return typeof cb === 'function' && cb({ error: 'That user is not here.' }); (s.data.camBlock = s.data.camBlock || new Set()).add(lc);
    if (s.data.viewers?.delete(v.id)) { s.emit('unview', { id: v.id }); v.emit('cam-blocked', { id: s.id, name: s.data.name }); } upd(s.data.room); typeof cb === 'function' && cb({ ok: true }); });
  s.on('cam:unblock', name => { s.data.camBlock?.delete(String(name || '').toLowerCase()); });
  s.on('unview', id => { const t = same(id); if (t && t.data.viewers?.delete(s.id)) { t.emit('unview', { id: s.id }); upd(s.data.room); } });
  s.on('signal', ({ to, data }) => { if (s.data.inc) return; const t = same(to); if (t && data && JSON.stringify(data).length < 60000) t.emit('signal', { from: s.id, name: s.data.name, data }); });
  let lastBuzz = 0, lastTyping = 0;
  s.on('buzz', () => { if (!s.data.name) return; if (s.data.inc) return s.emit('msg', { sys: true, text: 'You are incognito.' }); if (!s.data.master && !roleOf(s, s.data.room)) return s.emit('msg', { sys: true, text: 'Only room owners and admins can buzz the room.' }); const now = Date.now(), rk = s.data.room; if (now - (ROOMBUZZ.get(rk) || 0) < 60000) return s.emit('msg', { sys: true, text: 'This room was buzzed recently. Try again in ' + Math.ceil((60000 - (now - ROOMBUZZ.get(rk))) / 1000) + 's.' }); ROOMBUZZ.set(rk, now); lastBuzz = now;
    push(s.data.room, { buzz: true, rb: true, name: s.data.master ? 'A moderator' : esc(s.data.name), t: now }); });
  s.on('typing', () => { if (!s.data.name || s.data.inc) return; const now = Date.now(); if (now - lastTyping < 2000) return; lastTyping = now; /* room typing indicator removed in v13 (IMs only) */ });
  s.on('ann:set', async ({ text } = {}, cb) => { const room = s.data.room; if (!room || typeof cb !== 'function') return; if (!s.data.master && !roleOf(s, room)) return cb({ error: 'Only the room owner or admins can set the announcement.' });
    const t = String(text || '').trim().slice(0, 300); if (t) ANN[room] = esc(t); else delete ANN[room];
    try { await (t ? db.q('insert into room_ann(room,text,by) values($1,$2,$3) on conflict(room) do update set text=$2,by=$3,t=now()', [room, ANN[room], s.data.name]) : db.q('delete from room_ann where room=$1', [room])); } catch { }
    io.to(room).emit('ann', { room, text: ANN[room] || '' }); cb({ ok: true }); });
  s.on('room:invite', async ({ to } = {}, cb) => { if (typeof cb !== 'function') return; if (!s.data.name || !s.data.room) return cb({ error: 'Join a room first.' });
    if (!s.data.acct) return cb({ error: 'Sign in to invite people to rooms.' }); if (isBot(to)) return cb({ error: String(to) + " isn't available for invites." });
    try { cb(await AH.invite({ uid: s.data.acct.id, name: s.data.acct.name, master: !!s.data.master, room: s.data.room }, to)); } catch (e) { cb({ error: 'Could not send invite.' }); } });
  s.on('room:invite-decline', ({ from } = {}) => { if (!s.data.name) return; AH.toRoomUser(String(from || ''), 'invite-declined', { name: s.data.name }); });
  s.on('pm', async ({ to, text } = {}, cb) => { if (!s.data.name) return; if (isBot(to)) return cb && cb({ ok: true }); const id = users.get(String(to || '').toLowerCase()); const t0 = id && io.sockets.sockets.get(id), t = t0 && (!t0.data.inc || s.data.master) ? t0 : null;
    text = String(text || '').trim().slice(0, MAXLEN); if (!text) return; { const fl = FLOOD.check(s.data.acct?.name || s.data.name, text, s.data.master); if (fl) return cb && cb({ error: fl }); } if (!t) return cb && cb({ error: to + ' is not online.' });
    if (s.data.guest && !s.data.master && !(s.data.pmFrom && s.data.pmFrom.has(t.data.name.toLowerCase()))) return cb && cb({ error: 'Guests can only reply to private messages. Get a free screen name to start a conversation.' });
    if (t.data.guest && !s.data.guest) (t.data.pmFrom = t.data.pmFrom || new Set()).add(s.data.name.toLowerCase());
    const now = Date.now(); stamps = stamps.filter(x => now - x < 10000); if (stamps.length >= 5) return cb && cb({ error: 'You are sending messages too fast.' }); stamps.push(now);
    if (!s.data.master && t.data.acct && ((s.data.acct && t.data.blk?.has(s.data.acct.id)) || (t.data.pmb && !(s.data.acct && await mutualC(t.data.acct.id, s.data.acct.id))))) return cb && cb({ error: "This user isn't accepting messages." });
    t.emit('pm', { from: s.data.name, text: esc(text), t: now }); cb && cb({ ok: true, text: esc(text) }); });
  // ---- ignore / block / privacy ----
  s.data.ign = s.data.ign || new Set();
  async function loadPrefs() { if (!s.data.acct || !db.status().ready) return; try { const id = s.data.acct.id;
    s.data.ign = new Set((await db.q('select name_lc from ignores where owner=$1', [id])).map(r => r.name_lc));
    s.data.blk = new Set((await db.q('select blocked from blocks where owner=$1', [id])).map(r => r.blocked));
    s.data.pmb = !!(await db.q('select pm_buddies from users where id=$1', [id]))[0]?.pm_buddies; } catch { } }
  async function blockedNames() { if (!s.data.acct) return []; return (await db.q('select u.name from blocks b join users u on u.id=b.blocked where b.owner=$1 order by u.name_lc', [s.data.acct.id])).map(r => r.name); }
  async function prefs() { const bl = await blockedNames().catch(() => []), ms = await masterLc(), ign = [...s.data.ign];
    return { ignored: ign, blocked: bl, hide: [...new Set([...ign, ...bl.map(n => n.toLowerCase())])].filter(n => !ms.has(n)), pmBuddies: !!s.data.pmb, account: !!s.data.acct }; }
  const syncSibs = () => { if (s.data.acct) for (const x of io.sockets.sockets.values()) if (x !== s && x.data.acct?.id === s.data.acct.id) { x.data.ign = new Set(s.data.ign); x.data.blk = new Set(s.data.blk || []); x.data.pmb = s.data.pmb; } };
  const P = fn => async (d, cb) => { if (typeof d === 'function') { cb = d; d = {}; } cb = typeof cb === 'function' ? cb : () => {}; try { if (s.data.acct && !s.data.prefsLoaded) { await loadPrefs(); s.data.prefsLoaded = true; } cb(await fn(d || {})); } catch (e) { cb({ error: e.maint ? 'Service under maintenance' : 'Something went wrong' }); } };
  s.on('prefs', P(async () => prefs()));
  s.on('ign:set', P(async ({ name, on }) => { const lc = String(name || '').toLowerCase().slice(0, 30); if (!/^[a-z][a-z0-9_.]{2,19}$/.test(lc)) return { error: 'Bad name.' };
    if (s.data.name && lc === s.data.name.toLowerCase()) return { error: 'You cannot ignore yourself.' };
    if (on === false) { s.data.ign.delete(lc); if (s.data.acct) await db.q('delete from ignores where owner=$1 and name_lc=$2', [s.data.acct.id, lc]); }
    else { s.data.ign.add(lc); if (s.data.acct) await db.q('insert into ignores(owner,name_lc) values($1,$2) on conflict do nothing', [s.data.acct.id, lc]); }
    syncSibs(); return { ok: true, ...(await prefs()) }; }));
  s.on('blk:set', P(async ({ name, on }) => { if (!s.data.acct) return { error: 'Sign in with a screen name to block people. Guests can use Ignore.' };
    const [t] = await db.q('select id,name from users where name_lc=$1', [String(name || '').toLowerCase().slice(0, 30)]); if (!t) return { error: 'Only registered screen names can be blocked. Use Ignore for guests.' };
    if (t.id === s.data.acct.id) return { error: 'You cannot block yourself.' }; const uid = s.data.acct.id; s.data.blk = s.data.blk || new Set();
    if (on === false) { await db.q('delete from blocks where owner=$1 and blocked=$2', [uid, t.id]); s.data.blk.delete(t.id); }
    else { await db.q('insert into blocks(owner,blocked) values($1,$2) on conflict do nothing', [uid, t.id]); s.data.blk.add(t.id);
      await db.q('delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1)', [uid, t.id]); await db.q('delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)', [uid, t.id]);
      acc.toUser && (acc.toUser(uid, 'm:gone', { name: t.name }), acc.toUser(t.id, 'm:gone', { name: s.data.acct.name }));
      for (const x of io.sockets.sockets.values()) if (x.data.acct?.id === t.id && !x.data.master) { for (const y of io.sockets.sockets.values()) if (y.data.acct?.id === uid && y.data.viewers?.delete(x.id)) { y.emit('unview', { id: x.id }); x.emit('cam-blocked', { id: y.id, name: y.data.name }); } } }
    syncSibs(); if (s.data.room) upd(s.data.room); return { ok: true, name: t.name, ...(await prefs()) }; }));
  s.on('priv:set', P(async ({ pmBuddies }) => { if (!s.data.acct) return { error: 'Sign in with a screen name to change privacy settings.' }; s.data.pmb = !!pmBuddies;
    await db.q('update users set pm_buddies=$2 where id=$1', [s.data.acct.id, s.data.pmb]); syncSibs(); return { ok: true, ...(await prefs()) }; }));
  let lastAv = 0;
  s.on('snap:token', cb => { if (typeof cb !== 'function') return; const a = s.data.acct; if (!a) return cb({ error: 'Sign in with a screen name to use a phone photo.' });
    for (const [k, v] of SNAP) if (v.uid === a.id) SNAP.delete(k); const t = require('crypto').randomBytes(18).toString('base64url'); SNAP.set(t, { uid: a.id, name: a.name, exp: Date.now() + 600e3 }); cb({ t }); });
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
  s.on('disconnect', () => { if (!s.data.name) return; if (users.get(s.data.name.toLowerCase()) === s.id) users.delete(s.data.name.toLowerCase()); if (s.data.guest) { AVMEM.delete(s.data.name.toLowerCase()); geo.guestOff(s.data.name); } const r0 = s.data.room; mediaReset(); s.leave(r0); upd(r0); if (s.data.acct) setImmediate(() => AH.roomChanged?.(s.data.name));
    if (s.data.room && noticeOk()) { const nm = s.data.name, rm = s.data.room, lc = nm.toLowerCase(); const old = GRACE.get(lc); if (old) clearTimeout(old.t); GRACE.set(lc, { room: rm, t: setTimeout(() => { GRACE.delete(lc); if (ROOMS[rm]) push(rm, { sys: true, who: nm, text: `${esc(nm)} has left the room.` }); }, 20000) }); } });
});
acc.sockets(io, AH);
const RESET = require('./reset')(app, express);
const MASTER = require('./master')({ resetLink: RESET.makeLink, app, express, io, db, acc, geo, users, ROOMS, UROOMS, RATE, TOPICS, OFFICIAL, MOD, mod, socks, push, upd, history, roomList, closeRoom, setBots, getBots, stats: () => ({ online: onlineNow(), peak: Math.max(STAT.peak, onlineNow()), rooms: Object.keys(ROOMS).filter(r => socks(r).length).length }), lists, setRating, setTopic, modAct, esc, MICS, setMics, micsOf, HQ, MTIMER, MANN, setMicOpts, RATINGS, KICK_MS });
db.init().then(() => loadURooms()).then(() => MASTER.load()).catch(e => console.error('[master load]', e.message)).finally(() => { if (!db.status().ready) { const t = setInterval(() => { if (db.status().ready) { clearInterval(t); loadURooms().then(() => MASTER.load()).catch(() => {}); } }, 2000); } }).finally(() => server.listen(process.env.PORT || 3000, () => console.log('YappChat on', process.env.PORT || 3000)));
