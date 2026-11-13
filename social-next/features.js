'use strict';
// Social features added Nov 13, 2026: reactions, polls, sharing, @mentions and #room tags, tagging people
// (in posts and on photos), birthdays, and one pinned post. Pure helpers are exported for tests;
// registerFeatures() adds the routes to the Social API router.
const REACTIONS = { like: '👍', love: '❤️', laugh: '😂', wow: '😮', throwup: '🤮', mad: '😡', shocked: '😱' };
const NAME = /^[a-z][a-z0-9_.-]{2,19}$/;
const err = (message, status = 400) => Object.assign(Error(message), { status });

function cleanPoll(value, now = Date.now()) {
  if (value == null) return null;
  if (typeof value !== 'object' || !Array.isArray(value.options)) throw err('Invalid poll.');
  const options = value.options.map(o => typeof o === 'string' ? o.replace(/\s+/g, ' ').trim().slice(0, 80) : '').filter(Boolean);
  if (options.length < 2 || options.length > 6) throw err('A poll needs 2 to 6 options.');
  if (new Set(options.map(o => o.toLowerCase())).size !== options.length) throw err('Poll options must be different.');
  let ends = null;
  if (value.ends) {
    const t = new Date(value.ends);
    if (!Number.isFinite(+t) || +t <= now || +t > now + 90 * 86400e3) throw err('Choose a poll end time within the next 90 days.');
    ends = t.toISOString();
  }
  return { options, ends };
}
const pollOpen = (poll, now = Date.now()) => !!poll && (!poll.ends || +new Date(poll.ends) > now);

// @name mentions (screen names) and #RoomName tags in text. Room tags match a room name with spaces and punctuation removed.
function mentionsIn(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/(^|[^\w@/.])@([a-z][a-z0-9_.-]{2,19})/gi)) out.add(m[2].replace(/[.]+$/, '').toLowerCase());
  return [...out].filter(n => NAME.test(n)).slice(0, 10);
}
const roomKey = name => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function roomTagsIn(text, rooms) {
  const byKey = new Map(rooms.map(r => [roomKey(r), r])), out = new Set();
  for (const m of String(text || '').matchAll(/(^|[^\w&#/])#([A-Za-z0-9][A-Za-z0-9_-]{1,40})/g)) { const r = byKey.get(roomKey(m[2])); if (r) out.add(r); }
  return [...out].slice(0, 5);
}
function cleanTagNames(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw err('Invalid tags.');
  return [...new Set(value.map(n => String(n || '').toLowerCase().trim()).filter(n => NAME.test(n)))].slice(0, 10);
}
function cleanPhotoTag(value) {
  const x = +value?.x, y = +value?.y, name = String(value?.name || '').toLowerCase();
  if (!NAME.test(name) || !(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw err('Click a spot on the photo and choose a friend.');
  return { name, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}
// Birthday: month and day; year optional and hidden unless showYear. Hidden from everyone unless show is on.
function cleanBirthday(value) {
  if (value == null || value === '') return null;
  if (typeof value !== 'object') throw err('Invalid birthday.');
  const month = Math.trunc(+value.month), day = Math.trunc(+value.day), year = value.year ? Math.trunc(+value.year) : null;
  const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!max || !(day >= 1 && day <= max)) throw err('Choose a valid birthday.');
  if (year !== null && !(year >= 1900 && year <= new Date().getFullYear())) throw err('Choose a valid birth year.');
  if (year !== null && month === 2 && day === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) throw err('Choose a valid birthday.');
  return { month, day, year, show: value.show === true, showYear: value.show === true && value.showYear === true && year !== null };
}
const publicBirthday = b => b && b.show ? { month: b.month, day: b.day, ...(b.showYear && b.year ? { year: b.year } : {}) } : null;
// Days from `today` until the next month/day (0 = today). Feb 29 is celebrated on Feb 28 in non-leap years.
function daysUntil(b, today = new Date()) {
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  for (const y of [today.getFullYear(), today.getFullYear() + 1]) {
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0), day = b.month === 2 && b.day === 29 && !leap ? 28 : b.day;
    const d = (Date.UTC(y, b.month - 1, day) - base) / 86400e3;
    if (d >= 0) return d;
  }
  return 400;
}

function registerFeatures(router, db, h) {
  const { run, fail, visiblePost, access, isBlocked, rooms = () => [] } = h;
  // Friends of `author` among `names`, not blocked either way with the author.
  async function friendIds(author, names) {
    if (!names.length) return [];
    return db.q(`select u.id,u.name,u.name_lc from users u join contacts c on c.owner=$1 and c.contact=u.id
      where u.name_lc=any($2::text[]) and u.id<>$1 and not u.banned and not coalesce(u.deactivated,false)
      and not ${isBlocked('u.id', '$1')}`, [author, names]);
  }
  async function notify(recipients, actor, kind, postId, ref) {
    for (const r of recipients) if (r !== actor) await db.q(`insert into social_notifications(recipient_id,actor_id,kind,post_id,reference_id)
      select $1,$2,$3,$4,$5 where not exists(select 1 from blocks where (owner=$1 and blocked=$2) or (owner=$2 and blocked=$1)) on conflict do nothing`, [r, actor, kind, postId, ref]);
  }
  async function allRooms() {
    let user = []; try { user = (await db.q('select name from user_rooms')).map(r => r.name); } catch { }
    return [...new Set([...(rooms() || []), ...user])];
  }
  // Called after a post or comment is saved: notify mentioned friends who can see the post, and the owner/admins of tagged rooms.
  async function afterText({ actor, postId, text, ref, kind = 'mention' }) {
    const names = mentionsIn(text);
    for (const u of await friendIds(actor, names)) {
      const [ok] = await db.q(`select 1 from social_posts p where p.id=$1 and ${access('p', '$2')}`, [postId, u.id]);
      if (ok) await notify([u.id], actor, kind, postId, ref + ':' + u.id);
    }
    for (const room of roomTagsIn(text, await allRooms())) {
      const staff = await db.q(`select u.id from users u where u.name_lc in (
        select lower(owner) from user_rooms where name=$1 union select name_lc from room_mod where room=$1 and kind='admin')`, [room]);
      await notify(staff.map(s => s.id), actor, 'room', postId, ref + ':room:' + room);
    }
  }
  h.afterText = afterText;
  async function tagRows(actor, names) { return (await friendIds(actor, cleanTagNames(names))).map(u => ({ id: u.id, name: u.name })); }
  h.tagRows = tagRows;
  h.notify = notify;

  router.put('/api/posts/:id/react', run(async (req, res) => {
    const post = await visiblePost(req, req.params.id), r = req.body?.reaction;
    if (r !== null && !Object.hasOwn(REACTIONS, r)) fail('Choose a reaction.');
    if (r === null) await db.q(`with gone as (delete from social_likes where post_id=$1 and user_id=$2 returning post_id)
      delete from social_notifications where post_id=$1 and actor_id=$2 and kind='like'`, [post.id, req.socialAccount.id]);
    else {
      await db.q(`insert into social_likes(post_id,user_id,reaction) values($1,$2,$3) on conflict(post_id,user_id) do update set reaction=$3`, [post.id, req.socialAccount.id, r]);
      await notify([post.author_id], req.socialAccount.id, 'like', post.id, post.id);
    }
    res.json({ ok: true });
  }));
  router.get('/api/posts/:id/reactions', run(async (req, res) => {
    const post = await visiblePost(req, req.params.id);
    res.json(await db.q(`select u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,l.reaction from social_likes l join users u on u.id=l.user_id
      where l.post_id=$1 and not u.banned and not coalesce(u.deactivated,false) and not ${isBlocked('u.id', '$2')} order by l.created desc limit 100`, [post.id, req.socialAccount.id]));
  }));
  router.post('/api/posts/:id/vote', run(async (req, res) => {
    const post = await visiblePost(req, req.params.id), choice = req.body?.choice;
    if (!post.poll) fail('This post has no poll.', 404);
    if (!pollOpen(post.poll)) fail('This poll has ended.', 409);
    if (!Number.isInteger(choice) || choice < 0 || choice >= post.poll.options.length) fail('Choose an option.');
    const [added] = await db.q('insert into social_poll_votes(post_id,user_id,choice) values($1,$2,$3) on conflict do nothing returning choice', [post.id, req.socialAccount.id, choice]);
    if (!added) fail('You already voted in this poll.', 409);
    res.json({ ok: true });
  }));
  router.post('/api/posts/:id/share', run(async (req, res) => {
    const original = await visiblePost(req, req.params.id), b = req.body || {};
    const source = original.shared_from || original.id; // sharing a share credits the first poster
    if (source !== original.id) await visiblePost(req, source);
    const mode = original.audience?.post?.mode || 'profile';
    if (['private', 'selected'].includes(mode) && original.author_id !== req.socialAccount.id) fail('This post is private, so it cannot be shared.', 403);
    const [wall] = await db.q('select id from users where name_lc=$1 and not banned and not coalesce(deactivated,false)', [String(b.wall || req.socialAccount.alias).toLowerCase()]);
    if (!wall) fail('Profile unavailable.', 404);
    if (wall.id !== req.socialAccount.id) {
      const [friend] = await db.q('select 1 from contacts where owner=$1 and contact=$2', [wall.id, req.socialAccount.id]);
      if (!friend) fail('Only friends can share on this wall.', 403);
      const [ok] = await db.q(`select 1 from social_posts p where p.id=$1 and ${access('p', '$2')}`, [source, wall.id]);
      if (!ok) fail('That friend cannot see the original post.', 403);
    }
    const id = require('node:crypto').randomUUID(), body = typeof b.body === 'string' ? b.body.trim().slice(0, 3000) : '';
    // A share is never wider than the original: friends-only stays friends-only.
    const audience = { post: { mode: mode === 'friends' ? 'friends' : 'profile' }, photo: { mode: 'post' } };
    await db.q(`insert into social_posts(id,author_id,wall_id,body,audience,shared_from) values($1,$2,$3,$4,$5,$6)`, [id, req.socialAccount.id, wall.id, body, JSON.stringify(audience), source]);
    const [orig] = await db.q('select author_id from social_posts where id=$1', [source]);
    await notify([orig.author_id], req.socialAccount.id, 'share', id, id);
    if (wall.id !== req.socialAccount.id) await notify([wall.id], req.socialAccount.id, 'post', id, id);
    if (body) await afterText({ actor: req.socialAccount.id, postId: id, text: body, ref: id });
    res.status(201).json({ id });
  }));
  router.put('/api/posts/:id/photo-tags', run(async (req, res) => {
    const post = await visiblePost(req, req.params.id);
    if (post.author_id !== req.socialAccount.id) fail('Only the person who posted the photo can tag it.', 403);
    if (!post.image) fail('This post has no photo.');
    const tag = cleanPhotoTag(req.body);
    const [u] = await friendIds(req.socialAccount.id, [tag.name]);
    if (!u) fail('You can tag your friends only.', 403);
    const tags = (post.photo_tags || []).filter(t => t.id !== u.id);
    if (tags.length >= 20) fail('A photo can have up to 20 tags.');
    tags.push({ id: u.id, name: u.name, x: tag.x, y: tag.y });
    await db.q('update social_posts set photo_tags=$2 where id=$1', [post.id, JSON.stringify(tags)]);
    await notify([u.id], req.socialAccount.id, 'tag', post.id, post.id + ':photo:' + u.id);
    res.json({ ok: true });
  }));
  // Remove a tag: the tagged person removes their own; the poster can remove anyone's.
  router.delete('/api/posts/:id/tags/:name', run(async (req, res) => {
    const post = await visiblePost(req, req.params.id), name = String(req.params.name || '').toLowerCase();
    const mine = name === req.socialAccount.alias.toLowerCase();
    if (!mine && post.author_id !== req.socialAccount.id) fail('You can remove only your own tag.', 403);
    const keep = t => String(t.name).toLowerCase() !== name;
    await db.q('update social_posts set tags=$2,photo_tags=$3 where id=$1', [post.id, JSON.stringify((post.tags || []).filter(keep)), JSON.stringify((post.photo_tags || []).filter(keep))]);
    res.json({ ok: true });
  }));
  router.get('/api/birthdays', run(async (req, res) => res.json(await upcomingBirthdays(req.socialAccount.id))));
  async function upcomingBirthdays(viewer, today = new Date()) {
    const rows = await db.q(`select u.id,u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,s.value->'birthday' as birthday
      from contacts c join users u on u.id=c.contact join social_settings s on s.user_id=u.id
      where c.owner=$1 and c.contact<>$1 and (s.value->'birthday'->>'show')::boolean is true
      and not u.banned and not coalesce(u.deactivated,false) and not ${isBlocked('u.id', '$1')}`, [viewer]);
    return rows.map(r => ({ name: r.name, display_name: r.display_name, birthday: publicBirthday(r.birthday), days: daysUntil(r.birthday, today) }))
      .filter(r => r.birthday && r.days <= 7).sort((a, b) => a.days - b.days);
  }
  // One Social notification per friend per birthday, created when the inbox is read.
  h.birthdayNotifications = async viewer => {
    for (const b of await upcomingBirthdays(viewer)) {
      const year = new Date(Date.now() + b.days * 86400e3).getFullYear();
      const [u] = await db.q('select id from users where name=$1', [b.name]);
      if (u) await db.q(`insert into social_notifications(recipient_id,actor_id,kind,post_id,reference_id) values($1,$2,'birthday',null,$3) on conflict do nothing`, [viewer, u.id, 'birthday:' + u.id + ':' + year]);
    }
  };
  h.upcomingBirthdays = upcomingBirthdays;
}
module.exports = { REACTIONS, cleanPoll, pollOpen, mentionsIn, roomTagsIn, roomKey, cleanTagNames, cleanPhotoTag, cleanBirthday, publicBirthday, daysUntil, registerFeatures };
