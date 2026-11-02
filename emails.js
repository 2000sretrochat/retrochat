// One screen name per email (normalized). UNLIMITED_EMAILS (env, comma list) may have any number; masters can override the list (kv 'unlimited_emails').
const db = require('./db');
const DEF = String(process.env.UNLIMITED_EMAILS || 'zainyochka@gmail.com,teslaphx@gmail.com');
function norm(e) { e = String(e || '').trim().toLowerCase(); const i = e.lastIndexOf('@'); if (i < 1) return e; let [u, d] = [e.slice(0, i), e.slice(i + 1)];
  if (d === 'gmail.com' || d === 'googlemail.com') { u = u.split('+')[0].replace(/\./g, ''); d = 'gmail.com'; } return u + '@' + d; }
const parse = s => [...new Set(String(s || '').split(/[\s,;]+/).map(norm).filter(x => x.includes('@')))];
async function list() { try { const r = (await db.q("select v from kv where k='unlimited_emails'"))[0]; if (r) return parse(r.v); } catch { } return parse(DEF); }
async function setList(s) { const l = parse(s); await db.q("insert into kv(k,v) values('unlimited_emails',$1) on conflict(k) do update set v=$1", [l.join(',')]); return l; }
async function taken(email) { const n = norm(email); if (!n || (await list()).includes(n)) return false; return (await db.q('select 1 from users where email_norm=$1 limit 1', [n])).length > 0; }
module.exports = { norm, list, setList, taken };
