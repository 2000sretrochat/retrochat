const EM = require('./emails');
// Accounts (HTTP) + Messenger (Socket.IO) for YappChat.
const crypto = require('crypto'), bcrypt = require('bcryptjs'), db = require('./db'), geo = require('./geo');
const COOKIE = 'yc_sid', NAME_RE = /^[A-Za-z][A-Za-z0-9_.]{2,19}$/, STATUSES = ['available', 'busy', 'away', 'brb', 'invisible'];
const AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const RESERVED = /^(admin|administrator|moderator|mod|support|system|yappchat|staff|root|guest)/i;
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
async function userFromCookie(h) {
  const t = parseCookies(h)[COOKIE]; if (!t || !db.status().ready) return null;
  try { const r = await db.q('select u.id,u.name from sessions s join users u on u.id=s.user_id where s.token=$1 and s.expires>now() and not u.banned', [sha(t)]); return r[0] || null; } catch { return null; }
}
// simple fixed-window rate limiter
const hits = new Map();
function limited(key, max, ms) { const now = Date.now(); let h = hits.get(key); if (!h || now - h.t > ms) h = { t: now, n: 0 }; h.n++; hits.set(key, h); return h.n > max; }
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.t > 3600e3) hits.delete(k); }, 600e3).unref();
const DUMMY = bcrypt.hashSync('x-dummy-password', 10);

let H = {};
function http(app, express, hooks = {}) { H = hooks;
  const secure = req => req.secure;
  // CSRF: SameSite=Lax cookies + JSON-only bodies + same-origin check on writes
  app.use('/api', express.json({ limit: '8kb' }), (req, res, next) => {
    if (req.method === 'GET') return next();
    if (!req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
    const o = req.get('origin'); if (o && new URL(o).host !== req.get('host')) return res.status(403).json({ error: 'Bad origin' });
    next();
  });
  const maint = (res) => res.status(503).json({ error: 'Accounts are temporarily unavailable (maintenance). Please try again later.', maintenance: true });
  const setCookie = (req, res, token, remember) => res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(req), path: '/', ...(remember ? { maxAge: 30 * 864e5 } : {}) });
  async function newSession(req, res, uid, remember) {
    const t = crypto.randomBytes(32).toString('base64url');
    await db.q('insert into sessions(token,user_id,expires) values($1,$2,now()+$3::interval)', [sha(t), uid, remember ? '30 days' : '2 days']);
    setCookie(req, res, t, remember);
  }
  app.get('/api/status', (q, r) => r.json({ accounts: db.status().ready, message: db.status().ready ? null : 'Accounts are temporarily unavailable while we finish setting up the database. Chat rooms still work as a guest.' }));
  app.get('/api/me', async (req, res) => { const u = await userFromCookie(req.headers.cookie); let m = false; if (u) { try { m = !!(await db.q('select is_master from users where id=$1', [u.id]))[0]?.is_master; } catch { } } res.set('Cache-Control', 'no-store'); res.json(u ? (m ? { name: u.name, m: true } : { name: u.name }) : { name: null }); });
  app.get('/api/available', async (req, res) => {
    if (!db.status().ready) return maint(res);
    if (limited('av:' + req.ip, 60, 60e3)) return res.status(429).json({ error: 'Too many requests' });
    const n = String(req.query.name || ''); if (!NAME_RE.test(n) || RESERVED.test(n)) return res.json({ available: false, valid: false });
    const r = await db.q('select 1 from users where name_lc=$1', [n.toLowerCase()]); res.json({ available: !r.length && !(H.guestInUse && H.guestInUse(n)), valid: true });
  });
  app.post('/api/signup', async (req, res) => {
    if (!db.status().ready) return maint(res);
    if (H.ipBanned && H.ipBanned(geo.clientIp(req.headers, req.socket.remoteAddress))) return res.status(403).json({ error: 'Sign-ups from your network are not allowed.' });
    if (limited('su:' + req.ip, +process.env.SIGNUP_LIMIT || 5, 3600e3)) return res.status(429).json({ error: 'Too many sign-ups from your network. Try again later.' });
    const { name, password, remember } = req.body || {}; let { email } = req.body || {}; if (typeof email === 'string') email = email.trim();
    if (typeof name !== 'string' || !NAME_RE.test(name)) return res.status(400).json({ error: 'Screen names are 3-20 characters, start with a letter, and use letters, numbers, _ or .' });
    if (RESERVED.test(name)) return res.status(400).json({ error: 'That screen name is not available.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Passwords must be 8-100 characters.' });
    if (email && (typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ error: 'That email address does not look right.' });
    if (H.guestInUse && H.guestInUse(name)) return res.status(409).json({ error: 'That screen name is already taken.' });
    if (email && await EM.taken(email)) return res.status(409).json({ error: 'That email already has a screen name.' });
    const hash = await bcrypt.hash(password, 12);
    try {
      const r = await db.q('insert into users(name,name_lc,pw,email,email_norm) values($1,$2,$3,$4,$5) returning id', [name, name.toLowerCase(), hash, email ? email.trim() : null, email ? EM.norm(email) : null]);
      await db.q("insert into groups(owner,name) values($1,'Friends') on conflict do nothing", [r[0].id]);
      await newSession(req, res, r[0].id, !!remember); H.seedMaster && await H.seedMaster(r[0].id, name).catch(() => {}); geo.recordAccount(r[0].id, geo.clientIp(req.headers, req.socket.remoteAddress), 'signup'); res.json({ ok: true, name });
    } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'That screen name is already taken.' }); console.error(e); res.status(500).json({ error: 'Sign up failed.' }); }
  });
  app.post('/api/login', async (req, res) => {
    if (!db.status().ready) return maint(res);
    if (H.ipBanned && H.ipBanned(geo.clientIp(req.headers, req.socket.remoteAddress))) return res.status(403).json({ error: 'Sign-ins from your network are not allowed.' });
    const { name, password, remember } = req.body || {};
    const lc = String(name || '').toLowerCase().slice(0, 40);
    if (limited('li:' + req.ip, 20, 900e3) || limited('ln:' + lc, 8, 900e3)) return res.status(429).json({ error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
    const r = typeof password === 'string' && password.length <= 100 ? await db.q('select id,name,pw,banned from users where name_lc=$1', [lc]) : [];
    const ok = await bcrypt.compare(String(password || ''), r[0] ? r[0].pw : DUMMY); // constant work either way
    if (!r[0] || !ok) return res.status(401).json({ error: 'Invalid screen name or password.' });
    if (r[0].banned) return res.status(403).json({ error: 'This screen name has been banned.' });
    await newSession(req, res, r[0].id, !!remember); H.seedMaster && await H.seedMaster(r[0].id, r[0].name).catch(() => {}); geo.recordAccount(r[0].id, geo.clientIp(req.headers, req.socket.remoteAddress), 'login'); res.json({ ok: true, name: r[0].name });
  });
  app.post('/api/logout', async (req, res) => {
    const t = parseCookies(req.headers.cookie)[COOKIE]; if (t && db.status().ready) await db.q('delete from sessions where token=$1', [sha(t)]).catch(() => {});
    res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
  });
}

// ---------- Messenger sockets ----------
function sockets(io, hooks) {
  const online = new Map(); // uid -> Set(socket)
  const state = new Map(); // uid -> {status,msg,idle,avatar,name}
  const pres = uid => { const st = state.get(uid), on = online.has(uid) && st && st.status !== 'invisible'; return { online: !!on, status: on ? st.status : 'offline', msg: on ? st.msg : '', idle: on ? !!st.idle : false, avatar: st ? st.avatar : 'a1' }; };
  setAvFn = async (uid, av) => { const st = state.get(uid); if (st) { st.avatar = av; await broadcast(uid, st.name); } };
  const toUser = (uid, ev, data) => { for (const s of online.get(uid) || []) s.emit(ev, data); };
  async function watchers(uid) { return (await db.q('select owner from contacts where contact=$1', [uid])).map(r => r.owner); }
  async function broadcast(uid, name) { const p = { name, ...pres(uid) }; for (const w of await watchers(uid)) toUser(w, 'm:presence', p); }
  const idOf = async n => { const r = await db.q('select id,name from users where name_lc=$1', [String(n || '').toLowerCase().slice(0, 40)]); return r[0]; };
  const mutual = async (a, b) => (await db.q('select 1 from contacts where owner=$1 and contact=$2', [a, b])).length > 0;
  const blocked = async (by, who) => (await db.q('select 1 from blocks where owner=$1 and blocked=$2', [by, who])).length > 0;
  const FONTS = ['Arial', 'Verdana', 'Tahoma', 'Comic Sans MS', 'Times New Roman', 'Courier New'], COLORS = ['#000000', '#ff0000', '#0000ff', '#008000', '#800080', '#ff6600', '#008080', '#990033'];
  const fmt = m => ({ b: !!m.b, i: !!m.i, u: !!m.u, color: COLORS.includes(m.color) ? m.color : '#000000', f: FONTS.includes(m.f) ? m.f : 'Arial' });
  hooks.onlineName = n => { for (const [uid, st] of state) if (st.name.toLowerCase() === String(n).toLowerCase() && online.has(uid)) return uid; return null; };
  presFn = hooks.presence = uid => online.has(uid) ? { online: true, status: state.get(uid)?.status || 'online', msg: state.get(uid)?.msg || '' } : { online: false, status: 'offline', msg: '' };
  hooks.toUser = toUser; isOnlineFn = n => !!hooks.onlineName(n);

  io.on('connection', async s => {
    const acct = s.data.acct; if (!acct) return;
    const uid = acct.id, me = acct.name; let ready = false;
    const safe = fn => async (...a) => { const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null; try { const r = await fn(...a); cb && cb(r || { ok: true }); } catch (e) { if (!e.maint) console.error('[m]', e.message); cb && cb({ error: e.maint ? 'Service under maintenance' : 'Something went wrong' }); } };
    let stamps = [];
    const flood = () => { const now = Date.now(); stamps = stamps.filter(t => now - t < 10000); if (stamps.length >= 8) return true; stamps.push(now); return false; };
    s.on('m:init', safe(async () => {
      const [u] = await db.q('select name,status,status_msg,avatar from users where id=$1', [uid]);
      const first = !online.has(uid); if (!online.has(uid)) online.set(uid, new Set()); online.get(uid).add(s); s.data.mess = true; ready = true;
      if (!state.has(uid)) state.set(uid, { name: u.name, status: STATUSES.includes(u.status) ? u.status : 'available', msg: u.status_msg, avatar: u.avatar, idle: false });
      const cs = await db.q('select u.id,u.name,c.grp from contacts c join users u on u.id=c.contact where c.owner=$1 order by lower(u.name)', [uid]);
      const groups = (await db.q('select name from groups where owner=$1 order by name', [uid])).map(r => r.name);
      const reqs = await db.q('select u.name,r.msg from requests r join users u on u.id=r.from_id where r.to_id=$1', [uid]);
      const bl = (await db.q('select u.name from blocks b join users u on u.id=b.blocked where b.owner=$1', [uid])).map(r => r.name);
      const off = await db.q('select o.id,u.name,o.body,extract(epoch from o.created)*1000 as t from offline o join users u on u.id=o.from_id where o.to_id=$1 order by o.id', [uid]);
      if (off.length) await db.q('delete from offline where to_id=$1 and id<=$2', [uid, off[off.length - 1].id]);
      if (first) broadcast(uid, me);
      const st = state.get(uid);
      return { me: { name: u.name, status: st.status, msg: st.msg, avatar: st.avatar }, groups: [...new Set(['Friends', ...groups, ...cs.map(c => c.grp)])],
        contacts: cs.map(c => ({ name: c.name, group: c.grp, ...pres(c.id) })), requests: reqs.map(r => ({ name: r.name, msg: esc(r.msg) })), blocked: bl,
        offline: off.map(o => ({ from: o.name, t: Math.round(o.t), ...o.body })) };
    }));
    s.on('m:status', safe(async ({ status, msg }) => {
      if (!ready) return; const st = state.get(uid); if (STATUSES.includes(status)) st.status = status; if (typeof msg === 'string') st.msg = esc(msg.trim().slice(0, 60));
      await db.q('update users set status=$2,status_msg=$3 where id=$1', [uid, st.status, st.msg]); for (const x of online.get(uid)) if (x !== s) x.emit('m:self', { status: st.status, msg: st.msg });
      await broadcast(uid, me); return { ok: true, status: st.status, msg: st.msg };
    }));
    s.on('m:idle', safe(async on => { if (!ready) return; const st = state.get(uid); if (st.idle === !!on) return; st.idle = !!on; await broadcast(uid, me); }));
    s.on('m:avatar', safe(async a => { if (!ready || !AVATARS.includes(a)) return { error: 'bad avatar' }; state.get(uid).avatar = a; await db.q('update users set avatar=$2 where id=$1', [uid, a]); await broadcast(uid, me); }));
    s.on('m:add', safe(async ({ name, msg }) => {
      if (!ready || flood()) return { error: 'Slow down a little.' }; const generic = { ok: true, text: 'If ' + esc(String(name).slice(0, 20)) + ' is a YappChat user, they have been sent your request.' };
      const t = await idOf(name); if (!t || t.id === uid) return t && t.id === uid ? { error: 'You cannot add yourself.' } : generic;
      if (await mutual(uid, t.id)) return { error: esc(t.name) + ' is already in your contacts.' };
      if (await blocked(t.id, uid)) return generic;
      // if they already asked me, accept straight away
      if ((await db.q('select 1 from requests where from_id=$1 and to_id=$2', [t.id, uid])).length) return await accept(t);
      await db.q('insert into requests(from_id,to_id,msg) values($1,$2,$3) on conflict (from_id,to_id) do update set msg=excluded.msg, created=now()', [uid, t.id, String(msg || '').slice(0, 120)]);
      toUser(t.id, 'm:request', { name: me, msg: esc(String(msg || '').slice(0, 120)) }); return generic;
    }));
    async function accept(t) {
      await db.q('delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)', [uid, t.id]);
      await db.q("insert into contacts(owner,contact) values($1,$2),($2,$1) on conflict do nothing", [uid, t.id]);
      await db.q('delete from blocks where owner=$1 and blocked=$2', [uid, t.id]);
      const [ug] = await db.q('select grp from contacts where owner=$1 and contact=$2', [uid, t.id]), [tg] = await db.q('select grp from contacts where owner=$2 and contact=$1', [uid, t.id]);
      toUser(uid, 'm:contact', { name: t.name, group: ug.grp, ...pres(t.id) }); toUser(t.id, 'm:contact', { name: me, group: tg.grp, ...pres(uid) });
      toUser(t.id, 'm:toast', { text: esc(me) + ' accepted your contact request.' }); return { ok: true, text: esc(t.name) + ' was added to your contacts.' };
    }
    s.on('m:respond', safe(async ({ name, accept: yes }) => {
      if (!ready) return; const t = await idOf(name); if (!t) return { error: 'Request not found.' };
      const r = await db.q('select 1 from requests where from_id=$1 and to_id=$2', [t.id, uid]); if (!r.length) return { error: 'Request not found.' };
      if (yes) return await accept(t); await db.q('delete from requests where from_id=$1 and to_id=$2', [t.id, uid]); return { ok: true };
    }));
    s.on('m:remove', safe(async ({ name }) => { if (!ready) return; const t = await idOf(name); if (!t) return; await db.q('delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1)', [uid, t.id]);
      toUser(uid, 'm:gone', { name: t.name }); toUser(t.id, 'm:gone', { name: me }); }));
    s.on('m:block', safe(async ({ name, on }) => { if (!ready) return; const t = await idOf(name); if (!t || t.id === uid) return { error: 'Not found' };
      if (on === false) { await db.q('delete from blocks where owner=$1 and blocked=$2', [uid, t.id]); return { ok: true }; }
      await db.q('insert into blocks(owner,blocked) values($1,$2) on conflict do nothing', [uid, t.id]);
      await db.q('delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1)', [uid, t.id]); await db.q('delete from requests where from_id=$1 and to_id=$2', [t.id, uid]);
      toUser(uid, 'm:gone', { name: t.name }); toUser(t.id, 'm:gone', { name: me }); return { ok: true, name: t.name }; }));
    s.on('m:group', safe(async ({ name, group }) => { if (!ready) return; group = String(group || '').trim().slice(0, 24); if (!group || /[<>]/.test(group)) return { error: 'Group names are 1-24 characters.' };
      await db.q('insert into groups(owner,name) values($1,$2) on conflict do nothing', [uid, group]);
      if (name) { const t = await idOf(name); if (t) await db.q('update contacts set grp=$3 where owner=$1 and contact=$2', [uid, t.id, group]); } return { ok: true, group }; }));
    // relay helpers: only between mutual contacts, never to/from blockers
    async function peer(name) { const t = await idOf(name); if (!t || !(await mutual(uid, t.id)) || (await blocked(t.id, uid))) return null; return t; }
    s.on('m:im', safe(async m => {
      if (!ready || !m) return; if (flood()) return { error: 'You are sending messages too fast.' };
      const text = String(m.text || '').trim().slice(0, 1000); if (!text) return; const t = await peer(m.to); if (!t) return { error: 'You can only message your contacts.' };
      const body = { text: esc(text), ...fmt(m) }, now = Date.now();
      for (const x of online.get(uid) || []) if (x !== s) x.emit('m:im-echo', { to: t.name, t: now, ...body });
      if (online.has(t.id)) { toUser(t.id, 'm:im', { from: me, t: now, ...body }); return { ok: true, t: now, ...body }; }
      await db.q('insert into offline(to_id,from_id,body) values($1,$2,$3)', [t.id, uid, body]); return { ok: true, offline: true, t: now, ...body };
    }));
    s.on('m:typing', safe(async ({ to }) => { if (!ready) return; const t = await peer(to); if (t) toUser(t.id, 'm:typing', { from: me }); }));
    let lastBuzz = 0;
    s.on('m:buzz', safe(async ({ to }) => { if (!ready) return; if (Date.now() - lastBuzz < 10000) return { error: 'Please wait before buzzing again.' }; const t = await peer(to); if (!t) return { error: 'Not a contact.' };
      lastBuzz = Date.now(); if (!online.has(t.id)) return { error: esc(t.name) + ' is offline.' }; toUser(t.id, 'm:buzz', { from: me }); return { ok: true }; }));
    s.on('m:invite', safe(async ({ to, room }) => { if (!ready) return; const t = await peer(to); if (!t || !online.has(t.id)) return { error: 'They need to be an online contact.' };
      if (!hooks.roomExists(room)) return { error: 'That room does not exist.' }; toUser(t.id, 'm:invite', { from: me, room }); return { ok: true }; }));
    // 1:1 calls (voice / webcam) – signaling relay
    for (const ev of ['m:call', 'm:callans', 'm:sig', 'm:hang']) s.on(ev, safe(async d => { if (!ready || !d) return; const t = await peer(d.to); if (!t || !online.has(t.id)) return { error: 'They are not available.' };
      if (ev === 'm:sig' && JSON.stringify(d.data || '').length > 60000) return; toUser(t.id, ev, { from: me, kind: d.kind === 'video' ? 'video' : 'audio', accept: !!d.accept, data: d.data }); }));
    s.on('disconnect', async () => { const set = online.get(uid); if (!set) return; set.delete(s); if (!set.size) { online.delete(uid); const st = state.get(uid); state.delete(uid);
      try { await broadcast(uid, me); } catch {} if (st && st.idle) st.idle = false; } });
  });
}
let isOnlineFn = () => false, setAvFn = async () => {};
let presFn = null;
module.exports = { presence: uid => presFn ? presFn(uid) : { online: false }, http, sockets, userFromCookie, isOnline: n => isOnlineFn(n), setAvatar: (uid, av) => setAvFn(uid, av) };
