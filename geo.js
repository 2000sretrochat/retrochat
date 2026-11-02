// Owner-only IP + approximate location logging. Never sent to normal users.
const db = require('./db'), crypto = require('crypto');
const CACHE = new Map(), TTL = 12 * 3600e3, GUESTS = new Map(); // ip -> {loc,t}; name_lc -> guest record
function clientIp(headers, fallback) {
  const xf = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
  let ip = xf || String(fallback || ''); if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip.slice(0, 64);
}
const priv = ip => !ip || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i.test(ip);
async function lookup(ip) {
  if (priv(ip)) return ip ? 'Local/private network' : '';
  const c = CACHE.get(ip); if (c && Date.now() - c.t < TTL) return c.loc;
  let loc = '';
  try {
    const r = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json(); if (j.status === 'success') loc = [j.city, j.regionName, j.country].filter(Boolean).join(', ');
  } catch { }
  if (!loc) try {
    const r = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: AbortSignal.timeout(2500), headers: { 'User-Agent': 'yappchat' } });
    const j = await r.json(); if (!j.error) loc = [j.city, j.region, j.country_name].filter(Boolean).join(', ');
  } catch { }
  if (CACHE.size > 5000) CACHE.clear();
  if (loc) CACHE.set(ip, { loc, t: Date.now() }); // failures not cached: store IP only
  return loc;
}
async function recordAccount(uid, ip, kind) {
  try {
    const loc = await lookup(ip); if (!db.status().ready) return;
    await db.q('update users set last_ip=$2,last_loc=$3,last_at=now() where id=$1', [uid, ip, loc]);
    await db.q('insert into login_history(user_id,ip,loc,kind) values($1,$2,$3,$4)', [uid, ip, loc, kind]);
    await db.q('delete from login_history where user_id=$1 and id not in (select id from login_history where user_id=$1 order by id desc limit 20)', [uid]);
  } catch (e) { console.error('[geo] account', e.message); }
}
async function recordGuest(name, ip) {
  const g = { name, ip, loc: '', at: Date.now(), online: true }; GUESTS.set(name.toLowerCase(), g);
  if (GUESTS.size > 2000) { const old = [...GUESTS.values()].filter(x => !x.online).sort((a, b) => a.at - b.at); for (const x of old.slice(0, 500)) GUESTS.delete(x.name.toLowerCase()); }
  g.loc = await lookup(ip);
  if (db.status().ready) db.q('insert into guest_log(name,ip,loc) values($1,$2,$3)', [name, ip, g.loc]).catch(e => console.error('[geo] guest', e.message));
}
const guestOff = n => { const g = GUESTS.get(String(n).toLowerCase()); if (g) { g.online = false; g.left = Date.now(); } };
function keyOk(k) { const K = process.env.ADMIN_KEY; if (!K || K.length < 16 || typeof k !== 'string') return false; const a = crypto.createHash('sha256').update(k).digest(), b = crypto.createHash('sha256').update(K).digest(); return crypto.timingSafeEqual(a, b); }
function admin(app, isOnline) {
  const fails = new Map();
  app.get('/admin', (req, res) => { res.set({ 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' }); res.sendFile(__dirname + '/admin.html'); });
  app.get('/api/admin/data', async (req, res) => {
    res.set('Cache-Control', 'no-store'); const ip = clientIp(req.headers, req.socket.remoteAddress);
    const f = fails.get(ip) || { n: 0, t: Date.now() }; if (Date.now() - f.t > 900e3) { f.n = 0; f.t = Date.now(); }
    if (f.n >= 10) return res.status(429).json({ error: 'Too many attempts' });
    if (!process.env.ADMIN_KEY) return res.status(503).json({ error: 'ADMIN_KEY not configured' });
    if (!keyOk(req.get('x-admin-key'))) { f.n++; fails.set(ip, f); return res.status(401).json({ error: 'Bad key' }); }
    let accounts = [], guestLog = [];
    if (db.status().ready) {
      accounts = await db.q(`select u.id,u.name,u.email,u.created,u.last_ip,u.last_loc,u.last_at,
        coalesce((select json_agg(h order by h.id desc) from (select ip,loc,kind,at,id from login_history where user_id=u.id order by id desc limit 10) h),'[]') hist
        from users u order by u.last_at desc nulls last, u.created desc limit 1000`);
      accounts.forEach(a => a.online = isOnline(a.name));
      guestLog = await db.q('select name,ip,loc,at from guest_log order by id desc limit 500');
    }
    res.json({ db: db.status().ready, accounts, guests: [...GUESTS.values()].sort((a, b) => b.at - a.at), guestLog });
  });
}
module.exports = { clientIp, lookup, recordAccount, recordGuest, guestOff, admin, keyOk };
