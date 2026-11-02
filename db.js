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
create table if not exists avatars(user_id int primary key references users(id) on delete cascade, mime text not null, data bytea not null, updated timestamptz not null default now());
alter table users add column if not exists last_ip text;
alter table users add column if not exists last_loc text;
alter table users add column if not exists last_at timestamptz;
create table if not exists login_history(id serial primary key, user_id int not null references users(id) on delete cascade, ip text, loc text, kind text, at timestamptz not null default now());
create index if not exists login_history_u on login_history(user_id, id);
alter table users add column if not exists adult boolean not null default false;
alter table users add column if not exists display_name text not null default '';
alter table users add column if not exists age int;
alter table users add column if not exists location text not null default '';
alter table users add column if not exists bio text not null default '';
alter table users add column if not exists interests text not null default '';
alter table users add column if not exists is_master boolean not null default false;
alter table users add column if not exists m_incog boolean not null default false;
alter table users add column if not exists m_announce boolean not null default false;
alter table users add column if not exists email_norm text;
update users set email_norm = case when split_part(lower(trim(email)),'@',2) in ('gmail.com','googlemail.com') then replace(split_part(split_part(lower(trim(email)),'@',1),'+',1),'.','')||'@gmail.com' else lower(trim(email)) end where email is not null and email <> '' and email_norm is null;
create index if not exists users_email_norm on users(email_norm);
alter table users add column if not exists banned boolean not null default false;
create table if not exists ip_bans(ip text primary key, reason text not null default '', at timestamptz not null default now());
create table if not exists kv(k text primary key, v text);
create table if not exists watch(owner int not null references users(id) on delete cascade, target int not null references users(id) on delete cascade, primary key(owner, target));
create table if not exists reports(id serial primary key, by_name text not null, room text, who text, why text, at timestamptz not null default now(), resolved boolean not null default false, resolved_by text);
create table if not exists room_mod(room text not null, name_lc text not null, kind text not null, until bigint, primary key(room, name_lc, kind));
create table if not exists room_meta(room text primary key, rating text);
alter table room_meta add column if not exists mics int;
alter table room_meta add column if not exists hq boolean;
alter table room_meta add column if not exists mtimer int;
create table if not exists guest_log(id serial primary key, name text not null, ip text, loc text, at timestamptz not null default now());`;
async function init() {
  if (!process.env.DATABASE_URL) { error = 'DATABASE_URL is not set'; console.warn('[db] ' + error + ' - accounts disabled (maintenance mode)'); return; }
  const local = /localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL);
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local || /sslmode=disable/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false }, max: 5 });
  pool.on('error', e => console.error('[db] pool error', e.message));
  for (let i = 0; i < 5; i++) { try { await pool.query(SQL); ready = true; error = null; console.log('[db] ready'); return; } catch (e) { error = e.message; console.error('[db] init failed:', e.message); await new Promise(r => setTimeout(r, 3000)); } }
}
const q = (t, p) => { if (!ready) throw Object.assign(new Error('maintenance'), { maint: true }); return pool.query(t, p).then(r => r.rows); };
module.exports = { init, q, status: () => ({ ready, error: ready ? null : (process.env.DATABASE_URL ? 'Database unavailable' : 'Database not configured') }) };
