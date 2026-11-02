// Postgres persistence (process.env.DATABASE_URL). Tables auto-created on start.
const { Pool } = require('pg');
let pool = null, ready = false, error = null;
const SQL = `
create table if not exists users(id serial primary key, name text not null, name_lc text not null unique, pw text not null, email text,
  status text not null default 'available', status_msg text not null default '', avatar text not null default 'a1', created timestamptz not null default now());
create table if not exists sessions(token text primary key, user_id int not null references users(id) on delete cascade, expires timestamptz not null);
create table if not exists contacts(owner int not null references users(id) on delete cascade, contact int not null references users(id) on delete cascade,
  grp text not null default 'Friends', primary key(owner, contact));
create table if not exists groups(owner int not null references users(id) on delete cascade, name text not null, primary key(owner, name));
create table if not exists requests(from_id int not null references users(id) on delete cascade, to_id int not null references users(id) on delete cascade,
  msg text not null default '', created timestamptz not null default now(), primary key(from_id, to_id));
create table if not exists blocks(owner int not null references users(id) on delete cascade, blocked int not null references users(id) on delete cascade, primary key(owner, blocked));
create table if not exists offline(id serial primary key, to_id int not null references users(id) on delete cascade, from_id int not null references users(id) on delete cascade,
  body jsonb not null, created timestamptz not null default now());
create index if not exists offline_to on offline(to_id);
create table if not exists avatars(user_id int primary key references users(id) on delete cascade, mime text not null, data bytea not null, updated timestamptz not null default now());`;
async function init() {
  if (!process.env.DATABASE_URL) { error = 'DATABASE_URL is not set'; console.warn('[db] ' + error + ' - accounts disabled (maintenance mode)'); return; }
  const local = /localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL);
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local || /sslmode=disable/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false }, max: 5 });
  pool.on('error', e => console.error('[db] pool error', e.message));
  for (let i = 0; i < 5; i++) { try { await pool.query(SQL); ready = true; error = null; console.log('[db] ready'); return; } catch (e) { error = e.message; console.error('[db] init failed:', e.message); await new Promise(r => setTimeout(r, 3000)); } }
}
const q = (t, p) => { if (!ready) throw Object.assign(new Error('maintenance'), { maint: true }); return pool.query(t, p).then(r => r.rows); };
module.exports = { init, q, status: () => ({ ready, error: ready ? null : (process.env.DATABASE_URL ? 'Database unavailable' : 'Database not configured') }) };
