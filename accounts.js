const EM = require('./emails');
const mailer = require('./mail');
// Shared Razzle accounts and Messenger sockets.
const crypto = require('crypto'), bcrypt = require('bcryptjs'), db = require('./db'), geo = require('./geo');
const COOKIE = 'yc_sid', NAME_RE = /^[A-Za-z][A-Za-z0-9_.]{3,19}$/, STATUSES = ['available', 'busy', 'away', 'brb', 'invisible'];
const AVATARS = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const RESERVED = /^(admin|administrator|moderator|mod|support|system|yappchat|razzle|staff|root|guest)/i;
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
async function userFromCookie(h) {
  const t = parseCookies(h)[COOKIE]; if (!t || !db.status().ready) return null;
  try { const r = await db.q('select u.id, case when lower(s.display)=u.name_lc then s.display else u.name end as name, u.name as canon from sessions s join users u on u.id=s.user_id where s.token=$1 and s.expires>now() and not u.banned and not coalesce(u.deactivated,false)', [sha(t)]); return r[0] || null; } catch { return null; }
}
// simple fixed-window rate limiter
const hits = new Map();
function limited(key, max, ms) { const now = Date.now(); let h = hits.get(key); if (!h || now - h.t > ms) h = { t: now, n: 0 }; h.n++; hits.set(key, h); return h.n > max; }
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now - h.t > 3600e3) hits.delete(k); }, 600e3).unref();
const DUMMY = bcrypt.hashSync('x-dummy-password', 12);

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
  async function newSession(req, res, uid, remember, display) {
    const t = crypto.randomBytes(32).toString('base64url');
    await db.q('insert into sessions(token,user_id,expires,display) values($1,$2,now()+$3::interval,$4)', [sha(t), uid, remember ? '30 days' : '2 days', display || null]);
    setCookie(req, res, t, remember);
  }
  app.get('/api/status', (q, r) => r.json({ accounts: db.status().ready, message: db.status().ready ? null : 'Accounts are temporarily unavailable while we finish setting up the database. Chat rooms still work as a guest.' }));
  app.get('/api/receipts', async (req, res) => { const u = await userFromCookie(req.headers.cookie); if (!u) return res.json({ on: false }); try { res.json({ on: !!(await db.q('select receipts from users where id=$1', [u.id]))[0]?.receipts }); } catch { res.json({ on: false }); } });
  app.post('/api/receipts', async (req, res) => { const u = await userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in first.' }); await db.q('update users set receipts=$2 where id=$1', [u.id, req.body?.on === true]); res.json({ ok: true, on: req.body?.on === true }); });
  app.get('/api/me', async (req, res) => { const u = await userFromCookie(req.headers.cookie); let m = false; if (u) { try { m = !!(await db.q('select is_master from users where id=$1', [u.id]))[0]?.is_master; } catch { } } res.set('Cache-Control', 'no-store'); res.json(u ? (m ? { name: u.name, m: true } : { name: u.name }) : { name: null }); });
  app.get('/api/available', async (req, res) => {
    if (!db.status().ready) return maint(res);
    if (limited('av:' + geo.clientIp(req.headers, req.socket.remoteAddress), 60, 60e3)) return res.status(429).json({ error: 'Too many requests' });
    const n = String(req.query.name || ''); if (!NAME_RE.test(n) || RESERVED.test(n) || (H.reservedName && H.reservedName(n))) return res.json({ available: false, valid: false });
    const r = await db.q('select 1 from users where name_lc=$1', [n.toLowerCase()]); res.json({ available: !r.length && !(H.guestInUse && H.guestInUse(n)), valid: true });
  });
  app.post('/api/signup', async (req, res) => {
    if (!db.status().ready) return maint(res);
    if (H.ipBanned && H.ipBanned(geo.clientIp(req.headers, req.socket.remoteAddress))) return res.status(403).json({ error: 'Sign-ups from your network are not allowed.' });
    if (limited('su:' + geo.clientIp(req.headers, req.socket.remoteAddress), +process.env.SIGNUP_LIMIT || 5, 3600e3)) return res.status(429).json({ error: 'Too many sign-ups from your network. Try again later.' });
    const { name, password, remember } = req.body || {}; let { email } = req.body || {}; if (typeof email === 'string') email = email.trim();
    if (typeof name !== 'string' || !NAME_RE.test(name)) return res.status(400).json({ error: 'Screen names are 4–20 characters, start with a letter, and use letters, numbers, _ or .' });
    if (req.body.agree !== true) return res.status(400).json({ error: 'Please agree to the Terms and Rules (18 or older) to sign up.' });
    if (RESERVED.test(name) || (H.reservedName && H.reservedName(name))) return res.status(400).json({ error: 'That screen name is not available.' });
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) return res.status(400).json({ error: 'Passwords must be 8-100 characters.' });
    if (!email) return res.status(400).json({ error: 'An email address is required to sign up.' });
    if (email && (typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({ error: 'That email address does not look right.' });
    if (H.guestInUse && H.guestInUse(name)) return res.status(409).json({ error: 'That screen name is already taken.' });
    if (email && await EM.taken(email, name)) return res.status(409).json({ error: 'That email already has a screen name.' });
    const hash = await bcrypt.hash(password, 12);
    try {
      const r = await db.q('insert into users(name,name_lc,pw,email,email_norm) values($1,$2,$3,$4,$5) returning id', [name, name.toLowerCase(), hash, email ? email.trim() : null, email ? EM.norm(email) : null]);
      await db.q("insert into groups(owner,name) values($1,'Friends') on conflict do nothing", [r[0].id]);
      await newSession(req, res, r[0].id, !!remember); H.seedMaster && await H.seedMaster(r[0].id, name).catch(() => {}); geo.recordAccount(r[0].id, geo.clientIp(req.headers, req.socket.remoteAddress), 'signup');
      if (email) {
        const site = (process.env.PUBLIC_URL || ((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.headers.host));
        mailer.sendWelcome(email.trim(), name, site).catch(e => console.error('welcome mail', e.message));
      }
      res.json({ ok: true, name });
    } catch (e) { if (e.code === '23505') return res.status(409).json({ error: 'That screen name is already taken.' }); console.error(e); res.status(500).json({ error: 'Sign up failed.' }); }
  });
  async function signIn(req, res, fromSocial = false) {
    const reply = (code, payload) => {
      if (!fromSocial) return res.status(code).json(payload);
      return res.redirect(303, code === 200 ? '/social/' : 'https://2000sretrochat.github.io/retrochat/?signin=failed');
    };
    if (!db.status().ready) return reply(503, { error: 'Accounts are temporarily unavailable.' });
    if (H.ipBanned && H.ipBanned(geo.clientIp(req.headers, req.socket.remoteAddress))) return reply(403, { error: 'Sign-ins from your network are not allowed.' });
    const { name, password, remember } = req.body || {};
    const lc = String(name || '').toLowerCase().slice(0, 40);
    if (limited('li:' + geo.clientIp(req.headers, req.socket.remoteAddress), 20, 900e3) || limited('ln:' + lc, 8, 900e3)) return reply(429, { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
    const r = typeof password === 'string' && password.length <= 100 ? await db.q('select id,name,pw,banned,deactivated from users where name_lc=$1', [lc]) : [];
    const ok = await bcrypt.compare(String(password || ''), r[0] && !r[0].pw.startsWith('!social-bot:') ? r[0].pw : DUMMY) && !r[0]?.pw.startsWith('!social-bot:'); // Bots have no usable sign-in password.
    if (!r[0] || !ok) return reply(401, { error: 'Invalid screen name or password.' });
    if (r[0].banned) return reply(403, { error: 'This screen name has been banned.' });
    if (r[0].deactivated) return reply(403, { error: 'This screen name has been deactivated.' });
    const typed = String(name).trim(), disp = typed.toLowerCase() === r[0].name.toLowerCase() ? typed : r[0].name; // session display = capitalization typed at sign-in
    await newSession(req, res, r[0].id, !!remember, disp); H.seedMaster && await H.seedMaster(r[0].id, r[0].name).catch(() => {}); geo.recordAccount(r[0].id, geo.clientIp(req.headers, req.socket.remoteAddress), 'login'); return reply(200, { ok: true, name: disp });
  }
  app.post('/api/login', (req, res) => signIn(req, res));
  app.post('/social-sign-in', (req, res, next) => {
    if (req.get('Origin') !== 'https://2000sretrochat.github.io') return res.sendStatus(403);
    if (!req.is('application/x-www-form-urlencoded')) return res.sendStatus(415);
    res.set('Cache-Control', 'no-store');
    next();
  }, express.urlencoded({ extended: false, limit: '2kb', parameterLimit: 3 }), (req, res) => signIn(req, res, true));
  // "Sign in as invisible" on the sign-in screen: called right after a successful sign-in, before Messenger connects.
  // invisible=true -> invisible; invisible=false only clears a leftover invisible status (busy/away are kept).
  app.post('/api/signin-presence', async (req, res) => {
    const u = await userFromCookie(req.headers.cookie); if (!u) return res.status(401).json({ error: 'Sign in first.' });
    if (typeof req.body?.invisible !== 'boolean') return res.status(400).json({ error: 'Invalid presence.' });
    const [r] = await db.q(req.body.invisible ? "update users set status='invisible' where id=$1 returning status" : "update users set status=case when status='invisible' then 'available' else status end where id=$1 returning status", [u.id]);
    const status = r?.status || 'available'; await setStatusFn(u.id, status).catch(() => {});
    res.json({ ok: true, status });
  });
  app.post('/api/logout', async (req, res) => {
    const t = parseCookies(req.headers.cookie)[COOKIE]; if (t && db.status().ready) await db.q('delete from sessions where token=$1', [sha(t)]).catch(() => {});
    res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true });
  });
}

// ---------- Messenger sockets ----------
function sockets(io, hooks) {
  const { clientKind, deviceKind, presenceDevice, replacedSessions, CallRoutes } = require('./messenger-sessions');
  const callRoutes = new CallRoutes();
  const sentMessages = new Map(); // Share retries across Messenger reconnections.
  const online = new Map(); // uid -> Set(socket)
  const ROOM_TAG = '[room]', AUDS = ['lol', 'doh', 'woohoo', 'wave', 'kiss', 'drumroll'], IMVS = ['none', 'beach', 'space', 'hearts', 'city', 'retro']; const state = new Map(); // uid -> {status,msg,avatar,name}
  const idleNow = uid => {
    const clients = online.get(uid);
    return state.get(uid)?.status === 'available' && !!clients?.size && [...clients].every(client => client.data.messIdle === true);
  };
  const pres = uid => { const st = state.get(uid), on = online.has(uid) && st && st.status !== 'invisible'; const sr = on && st.msg === ROOM_TAG, rm = on && (sr || st.showRoom !== false) ? (hooks.roomOf ? hooks.roomOf(st.name) : null) : null; return { online: !!on, status: on ? st.status : 'offline', msg: on ? (sr ? (rm ? 'In: ' + rm : 'Not in a room') : st.msg) : '', room: rm || null, showRoom: !!sr, idle: idleNow(uid), device: presenceDevice(online.get(uid) || [],!!on), avatar: st ? st.avatar : 'a1' }; };
  const lastRoom = new Map(); hooks.roomChanged = n => { const uid = hooks.onlineName(n); if (!uid) return; const st = state.get(uid); if (!st || (st.msg !== ROOM_TAG && st.showRoom === false)) return; const r = hooks.roomOf ? hooks.roomOf(st.name) : null; if (lastRoom.get(uid) === r) return; lastRoom.set(uid, r); broadcast(uid, st.name).catch(() => {}); };
  setAvFn = async (uid, av) => { const st = state.get(uid); if (st) { st.avatar = av; await broadcast(uid, st.name); } };
  const toUser = (uid, ev, data) => { for (const s of online.get(uid) || []) s.emit(ev, data); };
  contactsChangedFn = (...ids) => { for (const id of ids) toUser(id, 'm:contacts-changed'); };
  blockFn = async (uid, byName, name, on=true) => {
    const [target]=await db.q('select id,name from users where name_lc=$1',[String(name||'').toLowerCase().slice(0,30)]);
    if(!target || target.id===uid)return {error:'Account unavailable.'};
    if(on){
      await db.q(`with added as (insert into blocks(owner,blocked) values($1,$2) on conflict do nothing),
        cleared as (delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1))
        delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)`,[uid,target.id]);
      toUser(uid,'m:gone',{name:target.name});toUser(target.id,'m:gone',{name:byName});
    }else await db.q('delete from blocks where owner=$1 and blocked=$2',[uid,target.id]);
    for(const client of io.sockets.sockets.values())if(client.data.acct?.id===uid && client.data.blk){
      if(on)client.data.blk.add(target.id);else client.data.blk.delete(target.id);
    }
    toUser(uid,'m:block-state',{name:target.name,on});contactsChangedFn(uid);
    return {ok:true,name:target.name};
  };
  async function contactList(uid) {
    const rows = await db.q('select u.id,u.name,c.grp from contacts c join users u on u.id=c.contact where c.owner=$1 order by lower(u.name)', [uid]);
    return rows.map(c => ({ name: c.name, group: c.grp, ...pres(c.id) }));
  }
  async function blockedContacts(uid){return (await db.q('select u.name,u.avatar from blocks b join users u on u.id=b.blocked where b.owner=$1',[uid])).map(row=>({...row,online:false,status:'offline',msg:'',blocked:true}));}
  async function pendingRequests(uid) {
    const rows = await db.q('select u.name,r.msg from requests r join users u on u.id=r.from_id where r.to_id=$1', [uid]);
    return rows.map(r => ({ name: r.name, msg: esc(r.msg) }));
  }
  async function watchers(uid) { return (await db.q('select owner from contacts where contact=$1', [uid])).map(r => r.owner); }
  async function broadcast(uid, name) { const bl = new Set((await db.q('select blocked from blocks where owner=$1', [uid]).catch(() => [])).map(r => r.blocked)); const audience = await watchers(uid); const p = { name, ...pres(uid) }; for (const w of audience) toUser(w, 'm:presence', bl.has(w) ? { name, online: false, status: 'offline', msg: '', room: null, idle: false, device: null, avatar: p.avatar } : p); }
  const idOf = async n => { const r = await db.q('select id,name from users where name_lc=$1', [String(n || '').toLowerCase().slice(0, 40)]); return r[0]; };
  const mutual = async (a, b) => (await db.q('select 1 from contacts where owner=$1 and contact=$2', [a, b])).length > 0;
  const blocked = async (by, who) => (await db.q('select 1 from blocks where owner=$1 and blocked=$2', [by, who])).length > 0;
  const FONTS = ['Arial', 'Verdana', 'Tahoma', 'Comic Sans MS', 'Times New Roman', 'Courier New'], COLORS = ['#000000', '#ff0000', '#0000ff', '#008000', '#800080', '#ff6600', '#008080', '#990033', '#8b5cf6'];
  const fmt = m => ({ b: !!m.b, i: !!m.i, u: !!m.u, color: COLORS.includes(m.color) ? m.color : '#000000', f: FONTS.includes(m.f) ? m.f : 'Arial' });
  hooks.onlineName = n => { for (const [uid, st] of state) if (st.name.toLowerCase() === String(n).toLowerCase() && online.has(uid)) return uid; return null; };
  // Raw presence (masters / admin only) vs. what everyone else sees: an invisible user looks offline.
  const hiddenUid = uid => state.get(uid)?.status === 'invisible';
  presRawFn = uid => online.has(uid) ? { online: true, status: state.get(uid)?.status || 'online', msg: state.get(uid)?.msg || '' } : { online: false, status: 'offline', msg: '' };
  presFn = hooks.presence = uid => online.has(uid) && !hiddenUid(uid) ? presRawFn(uid) : { online: false, status: 'offline', msg: '' };
  // Sign-in presence chosen on the sign-in screen ("Sign in as invisible"), applied before the socket connects.
  setStatusFn = async (uid, status) => { const st = state.get(uid); if (!st || st.status === status) return; st.status = status; for (const x of online.get(uid) || []) x.emit('m:self', { status, msg: st.msg }); if (online.has(uid)) await broadcast(uid, st.name); };
  // ---- room invites: friends only; target must be online + Available; block/ignore/18+/ban enforced; rate limited; expire after 2 minutes ----
  // Rejecting an invite never tells the inviter.
  let inviteStore = null; const invites = () => inviteStore ||= require('./room-invites').createRoomInvites();
  const inviteRoom = from => (hooks.rawRoomOf && hooks.rawRoomOf(from.name)) || (hooks.roomExists && hooks.roomExists(from.room) ? from.room : null);
  async function inviteOne(from, room, toName) {
    const nm = String(toName || '').slice(0, 40);
    const t = await idOf(nm); if (!t || t.id === from.uid) return { error: nm + " isn't available for invites." };
    const na = { error: t.name + " isn't available for invites." };
    if (!from.master && !(await mutual(from.uid, t.id))) return { error: 'You can only invite people on your friends list.' };
    const st = state.get(t.id);
    if (!online.has(t.id) || !st || st.status !== 'available') return na;
    const [u] = await db.q('select adult from users where id=$1', [t.id]);
    if (!from.master) {
      if (await blocked(t.id, from.uid) || await blocked(from.uid, t.id)) return na;
      if ((await db.q('select 1 from ignores where owner=$1 and name_lc=$2', [t.id, from.name.toLowerCase()])).length) return na;
      if (hooks.roomRating && hooks.roomRating(room) === 'R' && !u?.adult) return { error: t.name + " can't be invited to an 18+ room." };
      if (hooks.bannedFrom && hooks.bannedFrom(room, t.name)) return { error: t.name + " can't be invited to " + room + '.' };
      if (invites().coolingDown(from.name, t.name)) return { error: 'You already invited ' + t.name + '. Please wait a bit before inviting again.' };
    }
    const pl = invites().create({ from: from.name, fromId: from.uid, toId: t.id, toName: t.name, room, rating: hooks.roomRating ? hooks.roomRating(room) : 'PG-13' });
    toUser(t.id, 'm:invite', pl); hooks.toRoomUser && hooks.toRoomUser(t.name, 'room-invite', pl);
    return { ok: true, room, name: t.name };
  }
  hooks.invite = async (from, toName) => {
    const room = inviteRoom(from); if (!room) return { error: 'Join a chat room first, then invite people to it.' };
    const slow = invites().takeBatch(from.name.toLowerCase(), from.master); if (slow) return { error: slow };
    return inviteOne(from, room, toName); };
  hooks.inviteMany = async (from, names) => {
    const { cleanNames, MAX_BATCH } = require('./room-invites');
    const room = inviteRoom(from); if (!room) return { error: 'Join a chat room first, then invite people to it.' };
    const list = cleanNames(names); if (!list.length) return { error: 'Check at least one friend to invite.' };
    if (list.length > MAX_BATCH) return { error: 'You can invite up to ' + MAX_BATCH + ' friends at a time.' };
    const slow = invites().takeBatch(from.name.toLowerCase(), from.master); if (slow) return { error: slow };
    const sent = [], failed = [];
    for (const n of list) { const r = await inviteOne(from, room, n); if (r.ok) sent.push(r.name); else failed.push({ name: n, error: r.error }); }
    return sent.length ? { ok: true, room, sent, failed } : { error: failed[0]?.error || 'No invites were sent.', room, sent, failed }; };
  hooks.inviteAnswer = (to, id, accept) => {
    const r = invites().answer(to.uid, String(id || ''), !!accept);
    if (id) { toUser(to.uid, 'm:invite-gone', { id }); hooks.toRoomUser && hooks.toRoomUser(to.name, 'invite-gone', { id }); }
    return r; };
  hooks.toUser = toUser; toUserFn = toUser; isConnectedFn = n => !!hooks.onlineName(n); isOnlineFn = n => { const id = hooks.onlineName(n); return !!id && !hiddenUid(id); };
  let offlineStore = null; const offlineBox = () => offlineStore ||= require('./offline-messages').createOfflineMessages({ db, isOnline: n => isOnlineFn(n), toUser });

  io.on('connection', async s => {
    const acct = s.data.acct; if (!acct) {
      for(const event of ['m:init','m:contacts','m:add','m:respond','m:find-contacts'])s.on(event,(...args)=>{
        const reply=args[args.length-1];if(typeof reply==='function')reply({error:'Guests cannot add friends or be added. Create a free screen name or sign in.'});
      });return;
    }
    const uid = acct.id, me = acct.name; let ready = false;
    const safe = fn => async (...a) => { const cb = typeof a[a.length - 1] === 'function' ? a.pop() : null; try { const restricted = await db.q('select 1 from social_restrictions where user_id=$1 and service=$2', [uid, 'messenger']); if (restricted.length) { cb && cb({ error: 'Messenger access is restricted. Your Social account remains available.' }); return; } const r = await fn(...a); cb && cb(r || { ok: true }); } catch (e) { if (!e.maint) console.error('[m]', e.message); cb && cb({ error: e.maint ? 'Service under maintenance' : 'Something went wrong' }); } };
    let stamps = [];
    const flood = () => { const now = Date.now(); stamps = stamps.filter(t => now - t < 10000); if (stamps.length >= 8) return true; stamps.push(now); return false; };
    s.on('m:init', safe(async options => {
      if (!s.data.master) { const dc = module.exports.devConflict && module.exports.devConflict(s, me); if (dc) return { error: 'Another screen name (' + dc + ') is already signed in on this computer. Sign out of it first - only one screen name per computer.' };
        for (const x of replacedSessions(s, online.get(uid) || [])) { x.emit('signed-elsewhere', { text: 'Signed in elsewhere' }); online.get(uid).delete(x); x.disconnect(true); } }
      const [u] = await db.q('select name,status,status_msg,avatar,show_room from users where id=$1', [uid]);
      const first = !online.has(uid), wasIdle = idleNow(uid); if (!online.has(uid)) online.set(uid, new Set()); online.get(uid).add(s); s.data.mess = true; s.data.messClient = clientKind(s); s.data.messIdle = false; ready = true;
      if (state.has(uid)) state.get(uid).name = me; else state.set(uid, { name: me, status: STATUSES.includes(u.status) ? u.status : 'available', msg: u.status_msg, avatar: u.avatar });
      state.get(uid).showRoom = u.show_room !== false;
      const cs = await contactList(uid);
      const groups = (await db.q('select name from groups where owner=$1 order by name', [uid])).map(r => r.name);
      const reqs = await pendingRequests(uid);
      const blockedRows=await blockedContacts(uid),bl=blockedRows.map(r=>r.name);
      const off = options?.offlineInbox ? await db.q(`select o.id,u.name,o.body,extract(epoch from o.created)*1000 as t,
        exists(select 1 from contacts c where c.owner=$1 and c.contact=o.from_id) as contact
        from offline o join users u on u.id=o.from_id where o.to_id=$1 and o.read_at is null
        and not exists(select 1 from blocks b where b.owner=$1 and b.blocked=o.from_id) order by o.id`, [uid])
        : await db.q(`with delivered as (
        delete from offline o using users u where u.id=o.from_id and o.to_id=$1
        and not exists(select 1 from blocks b where b.owner=$1 and b.blocked=o.from_id)
        returning o.id,u.name,o.body,extract(epoch from o.created)*1000 as t
      ) select * from delivered order by id`, [uid]);
      await broadcast(uid, me);
      const st = state.get(uid);
      return { me: { name: u.name, device: deviceKind(s), status: st.status, msg: st.msg, avatar: st.avatar, showRoom: st.showRoom !== false, m: !!s.data.master }, groups: [...new Set(['Friends', ...groups, ...cs.map(c => c.group)])],
        contacts: cs, requests: reqs, blocked: bl, blockedContacts:blockedRows,
        offline: off.map(o => ({ from: o.name, t: Math.round(o.t), id: 'offline:'+o.id, ...o.body, offlineId:o.id, contact: o.contact !== false })) };
    }));
    s.on('m:contacts',safe(async()=>{
      if(!ready)return {error:'Sign in first.'};const blockedRows=await blockedContacts(uid);
      return {contacts:await contactList(uid),requests:await pendingRequests(uid),blocked:blockedRows.map(r=>r.name),blockedContacts:blockedRows};
    }));
    s.on('m:offline-read', safe(async ids => {
      if (!ready || !Array.isArray(ids)) return {error:'Invalid messages.'};
      const valid = ids.filter(id => Number.isInteger(id) && id > 0 && id <= 2147483647).slice(0,200);
      const rows = await db.q('delete from offline where to_id=$1 and id=any($2::int[]) returning id',[uid,valid]);
      toUser(uid,'m:offline-read',rows.map(row=>row.id));
      return {ok:true};
    }));
    // Offline Messages area (top of the online list): data hooks for the Messenger UI.
    s.on('m:offline-list', safe(async (o = {}) => ready ? { ok: true, messages: await offlineBox().list(uid, { includeRead: !!o?.all }), unread: await offlineBox().unreadCount(uid) } : { error: 'Sign in first.' }));
    s.on('m:offline-dismiss', safe(async ids => ready ? offlineBox().dismiss(uid, ids) : { error: 'Sign in first.' }));
    s.on('m:offline-send', safe(async ({ to, text } = {}) => { if (!ready || flood()) return { error: 'Slow down a little.' }; return offlineBox().send({ id: uid, name: me, master: !!s.data.master }, to, text); }));
    s.on('m:status', safe(async ({ status, msg }) => {
      if (!ready) return; const st = state.get(uid); if (STATUSES.includes(status)) { st.status = status; s.data.messIdle = false; } if (typeof msg === 'string') st.msg = esc(msg.trim().slice(0, 60));
      await db.q('update users set status=$2,status_msg=$3 where id=$1', [uid, st.status, st.msg]); for (const x of online.get(uid)) if (x !== s) x.emit('m:self', { status: st.status, msg: st.msg });
      await broadcast(uid, me); return { ok: true, status: st.status, msg: st.msg };
    }));
    s.on('m:room-label',safe(async()=>({room:hooks.rawRoomOf?hooks.rawRoomOf(me):null})));
    s.on('m:showroom', safe(async on => { if (!ready) return; const st = state.get(uid); st.showRoom = !!on; await db.q('update users set show_room=$2 where id=$1', [uid, !!on]); await broadcast(uid, me); return { ok: true, showRoom: st.showRoom }; }));
    s.on('m:idle', safe(async on => { if (!ready) return; const wasIdle = idleNow(uid); s.data.messIdle = !!on; if (wasIdle !== idleNow(uid)) await broadcast(uid, me); }));
    s.on('m:avatar', safe(async a => { if (!ready || !AVATARS.includes(a)) return { error: 'bad avatar' }; state.get(uid).avatar = a; await db.q('update users set avatar=$2 where id=$1', [uid, a]); await broadcast(uid, me); }));
    let lastContactSearch = 0;
    s.on('m:find-contacts', safe(async ({ query, page } = {}) => {
      if (!ready) return { error: 'Sign in to find contacts.' };
      const term = String(query || '').trim().toLowerCase();
      if (!/^[a-z0-9_.-]{3,20}$/.test(term)) return { error: 'Enter 3–20 screen name characters.' };
      const now = Date.now();
      if (now - lastContactSearch < 200) return { error: 'Please wait a moment and try again.' };
      lastContactSearch = now;
      const offset = Math.min(1000, Math.max(0, Math.trunc(Number(page) || 0))) * 4;
      const rows = await db.q(`
        select u.name, u.id = $1 as self,
          exists(select 1 from contacts where owner=$1 and contact=u.id) as contact,
          exists(select 1 from blocks where owner=$1 and blocked=u.id) as blocked
        from users u
        where strpos(u.name_lc,$2)>0 and not u.banned and not coalesce(u.deactivated,false)
          and not exists(select 1 from blocks where owner=u.id and blocked=$1)
        order by (u.name_lc=$2) desc, (strpos(u.name_lc,$2)=1) desc, u.name_lc
        limit 5 offset $3`, [uid, term, offset]);
      return { people: rows.slice(0, 4), more: rows.length > 4 };
    }));
    s.on('m:add', safe(async ({ name, msg }) => {
      if (!ready || flood()) return { error: 'Slow down a little.' }; const generic = { ok: true, text: 'If ' + esc(String(name).slice(0, 20)) + ' is a Razzle user, they have been sent your request.' };
      const t = await idOf(name); if (!t) return { error: 'No Razzle account found with that screen name. Check the spelling, or ask them to create one and sign in.' }; if (t.id === uid) { await db.q("insert into contacts(owner,contact,grp) values($1,$1,'Friends') on conflict do nothing", [uid]); contactsChangedFn(uid); return { ok: true, self: true, text: 'Added yourself - your entry shows you exactly the way your contacts see you.' }; } // self-entry: added directly, no request
      if (await mutual(uid, t.id)) return { error: esc(t.name) + ' is already in your contacts.' };
      if (await blocked(t.id, uid)) return generic;
      // sending a request to someone you blocked means you want them back: lift your block so the request can be answered
      if (await blocked(uid, t.id)) { await db.q('delete from blocks where owner=$1 and blocked=$2', [uid, t.id]); for (const x of io.sockets.sockets.values()) if (x.data.acct?.id === uid) x.data.blk?.delete(t.id); }
      if((await db.q('select 1 from social_bot_members where user_id=$1',[t.id])).length)return await accept(t);
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
      toUser(t.id, 'm:toast', { text: esc(me) + ' accepted your contact request.' }); return { ok: true, added: true, text: esc(t.name) + ' was added to your contacts.' };
    }
    s.on('m:respond', safe(async ({ name, accept: yes }) => {
      if (!ready) return; const t = await idOf(name); if (!t) return { error: 'Request not found.' };
      const r = await db.q('select 1 from requests where from_id=$1 and to_id=$2', [t.id, uid]); if (!r.length) return { error: 'Request not found.' };
      if (yes) return await accept(t);
      await db.q('delete from requests where from_id=$1 and to_id=$2', [t.id, uid]);
      contactsChangedFn(uid); // Only refresh the recipient's own Messenger windows.
      return { ok: true };
    }));
    s.on('m:remove', safe(async ({ name }) => { if (!ready) return; const t = await idOf(name); if (!t) return; await db.q('delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1)', [uid, t.id]);
      toUser(uid, 'm:gone', { name: t.name }); toUser(t.id, 'm:gone', { name: me }); }));
    s.on('m:block',safe(async ({name,on})=>ready?blockFn(uid,me,name,on!==false):{error:'Sign in first.'}));
    s.on('m:group', safe(async ({ name, group }) => { if (!ready) return; group = String(group || '').trim().slice(0, 24); if (!group || /[<>]/.test(group)) return { error: 'Group names are 1-24 characters.' };
      await db.q('insert into groups(owner,name) values($1,$2) on conflict do nothing', [uid, group]);
      if (name) { const t = await idOf(name); if (t) await db.q('update contacts set grp=$3 where owner=$1 and contact=$2', [uid, t.id, group]); } return { ok: true, group }; }));
    // relay helpers: only between mutual contacts, never to/from blockers
    async function peer(name) { const t = await idOf(name); if (!t || t.id === uid || !(await mutual(uid, t.id)) || (!s.data.master && await blocked(t.id, uid))) return null; return t; }
    s.on('m:im', safe(async m => {
      if (!ready || !m) return;
      const id = /^[0-9a-f-]{36}$/i.test(m.clientId || '') ? m.clientId : crypto.randomUUID();
      const key=uid+':'+id, cached=sentMessages.get(key);
      if(cached && cached.expires>Date.now())return cached.delivery;
      const delivery=sendMessage(m,id).then(result=>{
        if(!result?.ok)sentMessages.delete(key);
        return result;
      },error=>{sentMessages.delete(key);throw error;});
      sentMessages.set(key,{delivery,expires:Date.now()+600000});
      if(sentMessages.size>8192)sentMessages.delete(sentMessages.keys().next().value);
      return delivery;
    }));
    async function sendMessage(m, id) {
      if (!ready || !m) return; if (flood()) return { error: 'Whoa, slow down a little! Wait a few seconds and try again.' };
      const text = String(m.text || '').trim().slice(0, 1000);
      if (!text) return { error: 'Enter a message first.' };
      const floodError = require('./flood').check(me, text, s.data.master);
      if (floodError) return { error: floodError };
      const t = await idOf(m.to);
      if (!t || t.id === uid || await blocked(t.id, uid) || await blocked(uid, t.id))
        return { error: 'This account cannot receive your private messages.' };
      const [recipient] = await db.q('select pm_buddies,banned,deactivated from users where id=$1', [t.id]);
      if (recipient?.banned || recipient?.deactivated)
        return { error: 'This account cannot receive your private messages.' };
      if ((await db.q('select 1 from social_bot_members where user_id=$1', [t.id])).length)
        return { error: t.name + ' only accepts private messages from people on their contact list.' };
      if (recipient?.pm_buddies && !await mutual(t.id, uid))
        return { error: t.name + ' only accepts private messages from people on their contact list.' };
      if (!await mutual(uid, t.id))
        return { error: 'Add ' + t.name + ' to your contacts before sending a private message.' };
      if (online.has(t.id) && state.get(t.id)?.status === 'busy')
        return { error: t.name + ' is in Do Not Disturb. Your message was not sent.' };
      const body = { id, text: esc(text), ...fmt(m), ...(AUDS.includes(m.aud) ? { aud: m.aud } : {}) }, now = Date.now();
      try { const ar = await db.q('select id from users where id = any($1) and archive', [[uid, t.id]]); for (const r of ar) await db.q('insert into im_archive(owner,peer,dir,body) values($1,$2,$3,$4)', [r.id, r.id === uid ? t.name : me, r.id === uid ? 'out' : 'in', body]); } catch { }
      const offline=!online.has(t.id), hidden=!offline&&hiddenUid(t.id); // invisible: delivered live, but the sender is told 'offline' like any offline contact
      if(offline)await db.q('insert into offline(to_id,from_id,body) values($1,$2,$3)',[t.id,uid,body]);
      else toUser(t.id,'m:im',{from:me,t:now,...body});
      for(const x of online.get(uid)||[])if(x!==s)x.emit('m:im-echo',{to:t.name,t:now,...body,offline});
      return {ok:true,offline:offline||hidden,t:now,...body};
    }
    s.on('m:seen', safe(async ({ to }) => { if (!ready) return; const t = await peer(to); if (!t) return;
      const r = await db.q('select count(*)::int n from users where id = any($1) and receipts', [[uid, t.id]]); if (r[0].n === 2) toUser(t.id, 'm:seen', { from: me, t: Date.now() }); }));
    s.on('m:typing', safe(async ({ to }) => { if (!ready) return; const t = await peer(to); if (t) toUser(t.id, 'm:typing', { from: me }); }));
    let lastBuzz = 0;
    // ---- message archive (opt-in) ----
    s.on('m:arch-set', safe(async ({ on }) => { await db.q('update users set archive=$2 where id=$1', [uid, !!on]); return { ok: true, on: !!on }; }));
    s.on('m:arch-get', safe(async ({ q, peer: p } = {}) => { const on = !!(await db.q('select archive from users where id=$1', [uid]))[0]?.archive;
      const rows = await db.q("select peer,dir,body,extract(epoch from t)*1000 as t from im_archive where owner=$1 and ($2='' or lower(peer)=lower($2)) and ($3='' or body->>'text' ilike '%'||$3||'%') order by id desc limit 300", [uid, String(p || '').slice(0, 40), String(q || '').slice(0, 60).replace(/[%_\\]/g, '')]);
      return { ok: true, on, rows: rows.map(r => ({ peer: r.peer, dir: r.dir, text: r.body.text, aud: r.body.aud, t: +r.t })) }; }));
    s.on('m:arch-del', safe(async ({ peer: p } = {}) => { if (p) await db.q('delete from im_archive where owner=$1 and lower(peer)=lower($2)', [uid, String(p).slice(0, 40)]); else await db.q('delete from im_archive where owner=$1', [uid]); return { ok: true }; }));
    // ---- IMVironments: per-conversation theme, shared by both people ----
    const pairKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
    s.on('m:imv', safe(async ({ to, env }) => { if (!IMVS.includes(env)) return { error: 'Unknown IMVironment.' }; const t = await peer(to); if (!t) return { error: 'You can only theme chats with your contacts.' };
      await db.q('insert into imv(k,env) values($1,$2) on conflict(k) do update set env=$2', [pairKey(uid, t.id), env]);
      toUser(uid, 'm:imv', { with: t.name, env, by: me }); toUser(t.id, 'm:imv', { with: me, env, by: me }); return { ok: true }; }));
    s.on('m:imv-get', safe(async ({ with: w }) => { const t = await idOf(w); if (!t) return { env: 'none' }; const r = await db.q('select env from imv where k=$1', [pairKey(uid, t.id)]); return { env: r[0]?.env || 'none' }; }));
    s.on('m:buzz', safe(async ({ to }) => { if (!ready) return; if (Date.now() - lastBuzz < 10000) return { error: 'Please wait before buzzing again.' }; const t = await peer(to); if (!t) return { error: 'Not a contact.' };
      lastBuzz = Date.now(); if (!online.has(t.id) || hiddenUid(t.id)) return { error: esc(t.name) + ' is offline.' }; toUser(t.id, 'm:buzz', { from: me }); return { ok: true }; }));
    s.on('m:invite', safe(async ({ to, room }) => { if (!ready) return; return hooks.invite({ uid, name: me, master: !!s.data.master, room }, to); }));
    s.on('m:invite-decline', safe(async ({ id } = {}) => hooks.inviteAnswer({ uid, name: me }, id, false))); // no notice goes back to the inviter
    s.on('m:invite-accept', safe(async ({ id } = {}) => hooks.inviteAnswer({ uid, name: me }, id, true)));
    // 1:1 calls (voice / webcam) – signaling relay
    for (const ev of ['m:call', 'm:callans', 'm:sig', 'm:hang']) s.on(ev, safe(async d => { if (!ready || !d) return; const t = await peer(d.to); if (!t || !online.has(t.id) || (ev === 'm:call' && hiddenUid(t.id))) return { error: 'They are not available.' };
      if (ev === 'm:sig' && JSON.stringify(d.data || '').length > 60000) return;
      if (d.callId !== undefined && (typeof d.callId !== 'string' || !/^[a-f0-9-]{36}$/i.test(d.callId))) return { error:'Invalid call ID.' };
      let destination;
      if (ev === 'm:call') {
        const route = callRoutes.start(s, uid, t.id, online.get(t.id) || [], d.callId);
        if (route.error) return { error: route.error }; destination = route.target;
      } else destination = callRoutes.relay(s, uid, t.id, ev, !!d.accept, d.callId);
      if (!destination) return { error: 'This call is no longer active in this window.' };
      destination.emit(ev, { from: me, kind: d.kind === 'video' ? 'video' : 'audio', accept: !!d.accept, data: d.data,
        callId:d.callId, ...(ev==='m:hang'&&d.reason==='no-answer'?{reason:d.reason}:{}) }); }));
    s.on('disconnect', async () => { callRoutes.disconnect(s); const set = online.get(uid); if (!set) return;
      const wasIdle = idleNow(uid); set.delete(s); if (!set.size) { online.delete(uid); state.delete(uid); }
      try { await broadcast(uid, me); } catch {} });
  });
}
let isOnlineFn = () => false, isConnectedFn = () => false, setAvFn = async () => {}, presRawFn = null, setStatusFn = async () => {};
let blockFn, presFn = null, toUserFn = () => {}, contactsChangedFn = () => {};
module.exports = { presence: uid => presFn ? presFn(uid) : { online: false }, presenceRaw: uid => presRawFn ? presRawFn(uid) : { online: false }, http, sockets, userFromCookie, isOnline: n => isOnlineFn(n), isConnected: n => isConnectedFn(n), setSignInStatus: (uid, st) => setStatusFn(uid, st), toUser: (u, e, d) => toUserFn(u, e, d), contactsChanged: (...ids) => contactsChangedFn(...ids), blockAccount: (...args) => blockFn(...args), devConflict: null, setAvatar: (uid, av) => setAvFn(uid, av) };

