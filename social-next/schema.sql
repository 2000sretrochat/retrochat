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
