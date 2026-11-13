// One screen name per email (normalized). UNLIMITED_EMAILS (env, comma list) may have any number; masters can override the list (kv 'unlimited_emails').
// Controlled shared-email exception: a specific email may be shared ONLY by an exact allowlisted set of screen names (not unlimited).
const db = require('./db');
const DEF = String(process.env.UNLIMITED_EMAILS || '');
// Hard allowlist: zainy + zainyochka + razzle may share zainyochka@gmail.com (Gmail-normalized). No other names on that address.
const SHARED_EMAIL_NAMES = Object.freeze({
  'zainyochka@gmail.com': Object.freeze(['zainy', 'zainyochka', 'razzle'])
});
function norm(e) { e = String(e || '').trim().toLowerCase(); const i = e.lastIndexOf('@'); if (i < 1) return e; let [u, d] = [e.slice(0, i), e.slice(i + 1)];
  if (d === 'gmail.com' || d === 'googlemail.com') { u = u.split('+')[0].replace(/\./g, ''); d = 'gmail.com'; } return u + '@' + d; }
const parse = s => [...new Set(String(s || '').split(/[\s,;]+/).map(norm).filter(x => x.includes('@')))];
async function list() { try { const r = (await db.q("select v from kv where k='unlimited_emails'"))[0]; if (r) return parse(r.v); } catch { } return parse(DEF); }
async function setList(s) { const l = parse(s); await db.q("insert into kv(k,v) values('unlimited_emails',$1) on conflict(k) do update set v=$1", [l.join(',')]); return l; }
function sharedNames(email) { const n = norm(email); return SHARED_EMAIL_NAMES[n] ? [...SHARED_EMAIL_NAMES[n]] : null; }
function sharedOk(email, name, existingNameLcs) {
  const allowed = sharedNames(email); if (!allowed) return false;
  const lc = String(name || '').toLowerCase(); if (!allowed.includes(lc)) return false;
  const have = (existingNameLcs || []).map(x => String(x).toLowerCase());
  return have.every(h => allowed.includes(h));
}
async function taken(email, name) {
  const n = norm(email); if (!n || (await list()).includes(n)) return false;
  const rows = await db.q('select name_lc from users where email_norm=$1', [n]);
  if (!rows.length) return false;
  if (name && sharedOk(email, name, rows.map(r => r.name_lc))) return false;
  return true;
}
module.exports = { norm, list, setList, taken, sharedNames, sharedOk, SHARED_EMAIL_NAMES };
