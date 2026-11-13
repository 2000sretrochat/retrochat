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
alter table users add column if not exists show_room boolean default true;
alter table sessions add column if not exists display text;
alter table users add column if not exists last_loc text;
alter table users add column if not exists last_at timestamptz;
create table if not exists login_history(id serial primary key, user_id int not null references users(id) on delete cascade, ip text, loc text, kind text, at timestamptz not null default now());
create index if not exists login_history_u on login_history(user_id, id);
alter table users add column if not exists adult boolean not null default false;
alter table users add column if not exists display_name text not null default '';
alter table users add column if not exists display_name_changed_at timestamptz;
alter table users add column if not exists age int;
alter table users add column if not exists location text not null default '';
alter table users add column if not exists bio text not null default '';
alter table users add column if not exists interests text not null default '';
alter table users add column if not exists sex text not null default '';
alter table users add column if not exists profile_status text not null default '';
alter table users add column if not exists is_master boolean not null default false;
alter table users add column if not exists m_incog boolean not null default false;
alter table users add column if not exists m_announce boolean not null default false;
alter table users add column if not exists email_norm text;
alter table users add column if not exists verified boolean not null default false;
alter table users add column if not exists receipts boolean not null default false;
create table if not exists email_verify(token text primary key, user_id int not null, expires timestamptz not null);
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
alter table room_meta add column if not exists mann int;
alter table room_meta add column if not exists music boolean;
create table if not exists im_archive(id serial primary key, owner int not null references users(id) on delete cascade, peer text not null, dir text not null, body jsonb not null, t timestamptz default now());
create index if not exists im_archive_owner on im_archive(owner, id);
create table if not exists imv(k text primary key, env text not null);
create table if not exists room_ann(room text primary key, text text not null, by text, t timestamptz default now());
create table if not exists stats_day(d date primary key, peak int not null default 0);
create table if not exists user_rooms(name text primary key, cat text not null default 'User Rooms', owner text not null, rating text, mics int, topic text, created timestamptz not null default now());
create table if not exists pw_resets(token text primary key, user_id int not null references users(id) on delete cascade, expires timestamptz not null);
create table if not exists login_guard(key text primary key, fails int not null default 0, window_start timestamptz, locked_until timestamptz, strikes int not null default 0, strike_at timestamptz, locked boolean not null default false, updated timestamptz not null default now());
create table if not exists backups(d date primary key, data jsonb not null, created timestamptz not null default now());
alter table user_rooms add column if not exists icon text;
alter table user_rooms add column if not exists last_used timestamptz;
create table if not exists room_icons(room text primary key, mime text not null, data bytea not null, updated timestamptz not null default now());
alter table users add column if not exists night_pref jsonb;
alter table users add column if not exists ad_room text;
-- Help > Feedback backup copy (Nov 13, 2026); the email is the primary delivery.
create table if not exists feedback(id serial primary key, user_id int references users(id) on delete set null, name text not null,
  category text not null, message text not null, page text not null default '', app text not null default '', ip_hash text not null default '',
  emailed boolean not null default false, created timestamptz not null default now());
-- Profile picture history (Nov 13, 2026): every custom Messenger/profile picture written to avatars (Messenger upload,
-- phone snap, Social photo set) is kept here, deduped by content, newest 30 per account. Starts from the current picture.
create table if not exists avatar_history(id bigserial primary key, user_id int not null references users(id) on delete cascade,
  mime text not null, data bytea not null, hash text not null, created timestamptz not null default now(), unique(user_id, hash));
create or replace function rz_avatar_history() returns trigger language plpgsql as $$ begin
  insert into avatar_history(user_id,mime,data,hash) values(new.user_id,new.mime,new.data,md5(new.data)) on conflict(user_id,hash) do nothing;
  delete from avatar_history where user_id=new.user_id and hash<>md5(new.data) and id not in
    (select id from avatar_history where user_id=new.user_id order by created desc, id desc limit 30);
  return new; end $$;
drop trigger if exists avatars_history on avatars;
create trigger avatars_history after insert or update of data on avatars for each row execute function rz_avatar_history();
insert into avatar_history(user_id,mime,data,hash,created) select user_id,mime,data,md5(data),updated from avatars on conflict(user_id,hash) do nothing;
create table if not exists room_history(id bigserial primary key, room text not null, msg jsonb not null, at timestamptz not null default now());
create index if not exists room_history_r on room_history(room, id);
create table if not exists favorites(owner text not null, room text not null, primary key(owner, room));
create table if not exists ignores(owner int not null references users(id) on delete cascade, name_lc text not null, primary key(owner, name_lc));
alter table users add column if not exists pm_buddies boolean not null default false;
alter table users add column if not exists archive boolean not null default false;
create table if not exists guest_log(id serial primary key, name text not null, ip text, loc text, at timestamptz not null default now());
alter table guest_log add column if not exists room text;
alter table users add column if not exists deactivated boolean not null default false;
create table if not exists master_audit(id bigserial primary key, by_name text not null, action text not null, target text, detail text not null default '', at timestamptz not null default now());
create index if not exists master_audit_at on master_audit(id desc);
create table if not exists bot_profiles(
  name_lc text primary key,
  name text not null,
  display_name text not null default '',
  bio text not null default '',
  location text not null default '',
  interests text not null default '',
  avatar text not null default '',
  room text not null default '',
  interactive boolean not null default false,
  updated timestamptz not null default now(),
  updated_by text
);
alter table bot_profiles add column if not exists bot_id text;
create unique index if not exists bot_profiles_bot_id on bot_profiles(bot_id);
create table if not exists bot_avatars(bot_id text primary key, mime text not null, data bytea not null, updated timestamptz not null default now(), updated_by text);
create table if not exists trivia_scores(name_lc text primary key, name text not null, points int not null default 0, updated timestamptz not null default now());
-- offline messages: keep read ones until dismissed (additive)
alter table offline add column if not exists read_at timestamptz;
create index if not exists offline_to_unread on offline(to_id, id) where read_at is null;
-- master-only recording sessions: metadata only (the media file stays on the master's own device)
create table if not exists recording_sessions(id text primary key, room text not null, master text not null, mode text not null, started_at timestamptz not null default now(), stopped_at timestamptz, end_reason text, bytes bigint);
create index if not exists recording_sessions_started on recording_sessions(started_at desc);`;
async function init() {
  if (!process.env.DATABASE_URL) { error = 'DATABASE_URL is not set'; console.warn('[db] ' + error + ' - accounts disabled (maintenance mode)'); return; }
  const local = /localhost|127\.0\.0\.1|\/tmp/.test(process.env.DATABASE_URL);
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: local || /sslmode=disable/.test(process.env.DATABASE_URL) ? false : { rejectUnauthorized: false }, max: 5 });
  pool.on('error', e => console.error('[db] pool error', e.message));
  for (let i = 0; i < 5; i++) { try { await pool.query(SQL); await pool.query(require('node:fs').readFileSync(require('node:path').join(__dirname,'social-next/schema.sql'),'utf8')); ready = true; error = null; console.log('[db] ready'); return; } catch (e) { error = e.message; console.error('[db] init failed:', e.message); await new Promise(r => setTimeout(r, 3000)); } }
}
const q = (t, p) => { if (!ready) throw Object.assign(new Error('maintenance'), { maint: true }); return pool.query(t, p).then(r => r.rows); };
module.exports = { init, q, status: () => ({ ready, error: ready ? null : (process.env.DATABASE_URL ? 'Database unavailable' : 'Database not configured') }) };
