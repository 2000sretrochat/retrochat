create table if not exists social_settings (
  user_id int primary key references users(id) on delete cascade,
  value jsonb not null default '{}'
);
create table if not exists social_restrictions (
  user_id int not null references users(id) on delete cascade,
  service text not null check (service in ('social','messenger')),
  reason text not null default '',
  created timestamptz not null default now(),
  by_user int references users(id) on delete set null,
  primary key(user_id, service)
);
create table if not exists social_posts (
  id uuid primary key,
  author_id int not null references users(id) on delete cascade,
  wall_id int not null references users(id) on delete cascade,
  body text not null default '',
  link text not null default '',
  image text not null default '',
  feeling text not null default '',
  place text not null default '',
  created timestamptz not null default now(),
  updated timestamptz not null default now(),
  removed boolean not null default false,
  ip text not null default '',
  approximate_location text not null default ''
);
create index if not exists social_posts_wall on social_posts(wall_id, created desc);
create index if not exists social_posts_author on social_posts(author_id, created desc);
create table if not exists social_comments (
  id uuid primary key,
  post_id uuid not null references social_posts(id) on delete cascade,
  author_id int not null references users(id) on delete cascade,
  body text not null,
  created timestamptz not null default now(),
  removed boolean not null default false,
  ip text not null default '',
  approximate_location text not null default ''
);
create index if not exists social_comments_post on social_comments(post_id, created);
create table if not exists social_likes (
  post_id uuid not null references social_posts(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  created timestamptz not null default now(),
  primary key(post_id,user_id)
);
create table if not exists social_notifications (
  id bigserial primary key,
  recipient_id int not null references users(id) on delete cascade,
  actor_id int not null references users(id) on delete cascade,
  kind text not null check(kind in ('post','comment','like')),
  post_id uuid not null references social_posts(id) on delete cascade,
  reference_id text not null,
  created timestamptz not null default now(),
  seen boolean not null default false,
  unique(recipient_id,actor_id,kind,reference_id)
);
create index if not exists social_notifications_inbox on social_notifications(recipient_id, created desc);
create table if not exists social_bot_members(user_id int primary key references users(id) on delete cascade,bot_id text not null unique,photo_index int not null);

alter table social_posts add column if not exists event_room text;
alter table social_posts add column if not exists event_at timestamptz;
create table if not exists social_event_rsvps (
  post_id uuid not null references social_posts(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  primary key (post_id,user_id)
);

create table if not exists room_music_tracks (
  id uuid primary key,
  slot integer not null unique check (slot between 1 and 12),
  title text not null,
  artist text not null,
  duration double precision not null check (duration > 0 and duration <= 600),
  audio bytea not null check (octet_length(audio) between 4 and 8388608)
);

alter table social_posts add column if not exists audience jsonb not null default '{}';

-- Freeze legacy Social defaults before Messenger avatars change independently.
update social_settings s set value=jsonb_set(s.value,'{portrait}',p.image)
from (select ss.user_id,photo.entry->'image' as image from social_settings ss,
  lateral jsonb_array_elements(coalesce(ss.value->'profileGallery','[]'::jsonb)) photo(entry)
  where ss.value->>'portrait'=ss.value->>'galleryAvatarUrl' and photo.entry->>'id'=ss.value->>'galleryDefault') p
where s.user_id=p.user_id;
alter table social_posts add column if not exists pinned boolean not null default false;

alter table social_posts add column if not exists tape jsonb;

-- Nov 13, 2026: optional post font (allow-listed in social-next/api.js)
alter table social_posts add column if not exists font text not null default '';

-- Nov 13, 2026: reactions (existing likes become 'like'), polls, sharing, tagging, birthday/mention/room notifications
alter table social_likes add column if not exists reaction text not null default 'like';
alter table social_posts add column if not exists poll jsonb;
create table if not exists social_poll_votes (
  post_id uuid not null references social_posts(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  choice int not null check (choice between 0 and 5),
  created timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table social_posts add column if not exists shared_from uuid references social_posts(id) on delete set null;
alter table social_posts add column if not exists tags jsonb not null default '[]';
alter table social_posts add column if not exists photo_tags jsonb not null default '[]';
alter table social_notifications alter column post_id drop not null;
alter table social_notifications drop constraint if exists social_notifications_kind_check;
alter table social_notifications add constraint social_notifications_kind_check check(kind in ('post','comment','like','mention','tag','share','birthday','room'));
-- keep only the newest pin per profile (pins are one at a time from now on)
update social_posts p set pinned=false where p.pinned and exists(select 1 from social_posts q where q.wall_id=p.wall_id and q.pinned and (q.updated,q.id)>(p.updated,p.id));
