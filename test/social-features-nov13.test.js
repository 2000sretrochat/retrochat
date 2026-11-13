'use strict';
// Social features Nov 13, 2026 (items 24-31): link previews, sharing, birthdays, polls, reactions, mentions/room tags,
// one pinned post, tagging people in posts and photos.
const test = require('node:test'), assert = require('node:assert/strict');
const { once } = require('node:events'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const express = require('express');
const F = require('../social-next/features');
const LP = require('../social-next/link-preview');
const { registerApi, settingsPatch } = require('../social-next/api');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const POST = 'd503a3f4-4b9e-4f31-951e-05881c2a4720';

async function server(t, post, extra = () => null, account = { id: 4, alias: 'Alice', master: false }) {
  const writes = [];
  const db = { q: async (sql, args) => { if (sql.startsWith('select p.* from social_posts')) return post ? [post] : []; const x = extra(sql, args); if (x) return x; writes.push({ sql, args }); return []; } };
  const app = express(), router = express.Router();
  router.use((req, res, next) => { req.socialAccount = account; next(); });
  registerApi(router, express, db, {}, null, { rooms: () => ['Music Lobby'] }); app.use(router);
  const s = app.listen(0, '127.0.0.1'); t.after(() => s.close()); await once(s, 'listening');
  const call = (p, method, body) => fetch('http://127.0.0.1:' + s.address().port + p, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  return { call, writes };
}

test('24: link previews block private addresses, sign proxied images and cache results', async () => {
  for (const u of ['http://127.0.0.1/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data', 'https://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://0x7f000001/',
    'https://localhost/', 'https://printer.local/', 'http://example.com:8080/', 'https://a:b@example.com/', 'file:///etc/passwd', 'ftp://example.com/'])
    assert.equal(LP.publicUrl(u), null, u);
  assert.ok(LP.publicUrl('https://example.com/news?id=1'));
  for (const ip of ['127.0.0.1', '10.1.1.1', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) assert.ok(LP.privateIp(ip), ip);
  assert.equal(LP.privateIp('93.184.216.34'), false);
  await new Promise(resolve => LP.safeLookup('localhost', {}, err => { assert.equal(err?.code, 'EBLOCKED'); resolve(); }));
  const m = LP.parseMeta('<title>Fallback</title><meta property="og:title" content="News &amp; Views"><meta name="description" content="A story">' +
    '<meta property="og:image" content="/img/a.jpg"><meta property="og:site_name" content="Daily">', 'https://example.com/story');
  assert.deepEqual(m, { title: 'News & Views', description: 'A story', image: 'https://example.com/img/a.jpg', site: 'Daily' });
  assert.equal(LP.parseMeta('<meta property="og:image" content="http://192.168.0.2/x.jpg">', 'https://example.com/').image, null, 'private image hosts are dropped');
  let pages = 0;
  const fetchPage = async (u, o) => o.accept.startsWith('text/') ? (pages++, { type: 'text/html', url: u, body: Buffer.from('<meta property="og:title" content="Hi"><meta property="og:image" content="https://cdn.example.com/p.png">') })
    : { type: 'image/png', body: Buffer.from([1, 2, 3]) };
  const lp = LP.createLinkPreviews({ secret: Buffer.from('k'), fetchPage });
  const a = await lp.preview('https://example.com/a'), b = await lp.preview('https://example.com/a');
  assert.equal(pages, 1, 'cached'); assert.deepEqual(a, b); assert.equal(a.title, 'Hi');
  const img = new URL(a.image, 'https://razzle.test');
  assert.equal(img.pathname, '/social-next/link-image');
  assert.ok(await lp.image(img.searchParams.get('u'), img.searchParams.get('s')));
  assert.equal(await lp.image('https://evil.example/x.png', img.searchParams.get('s')), null, 'unsigned image URLs are refused');
  const svg = LP.createLinkPreviews({ secret: Buffer.from('k'), fetchPage: async () => ({ type: 'image/svg+xml', body: Buffer.from('<svg/>') }) });
  assert.equal(await svg.image('https://cdn.example.com/p.png', lp.sign('https://cdn.example.com/p.png')), null, 'only jpeg/png/gif/webp are proxied');
  assert.deepEqual(await lp.preview('http://127.0.0.1/'), {});
  assert.ok(LP.isImageLink('https://example.com/cat.GIF')); assert.ok(!LP.isImageLink('https://example.com/cat.html'));
  const home = read('social-next/web/social-home.js');
  assert.match(home, /\/\\\.\(\?:jpe\?g\|png\|gif\|webp\)\$\/i\.test\(url\.pathname\)/);
  assert.match(home, /referrerpolicy="no-referrer"/);
  assert.match(home, /if \(image && \/\^\\\/social-next\\\/link-image\\\?\/\.test\(image\)\)/);
  assert.match(home, /part\.textContent = value;/, 'preview text is inserted as text, never HTML');
  assert.match(read('social-next/index.js'), /linkPreviews\.routes\(router\);/);
});

test('25: sharing respects privacy, credits the original and stays no wider than it', async t => {
  const priv = await server(t, { id: POST, author_id: 9, wall_id: 9, audience: { post: { mode: 'private' } } });
  assert.equal((await priv.call('/api/posts/' + POST + '/share', 'POST', {})).status, 403);
  const ok = await server(t, { id: POST, author_id: 9, wall_id: 9, audience: { post: { mode: 'friends' } } }, sql => sql.startsWith('select id from users') ? [{ id: 4 }] : sql.startsWith('select author_id') ? [{ author_id: 9 }] : null);
  const r = await ok.call('/api/posts/' + POST + '/share', 'POST', { body: 'look' });
  assert.equal(r.status, 201);
  const insert = ok.writes.find(w => w.sql.startsWith('insert into social_posts'));
  assert.equal(insert.args[5], POST, 'credits the original'); assert.deepEqual(JSON.parse(insert.args[4]).post, { mode: 'friends' }, 'friends-only stays friends-only');
  assert.ok(ok.writes.some(w => /insert into social_notifications/.test(w.sql) && w.args[2] === 'share' && w.args[0] === 9));
  const api = read('social-next/api.js');
  assert.match(api, /from social_posts o join users ou on ou\.id=o\.author_id where o\.id=p\.shared_from and not o\.removed[\s\S]*?and \$\{access\('o','\$1',master\)\}\) as shared/, 'original shown only to people who can see it');
  assert.match(read('social-next/web/social-features.js'), /Originally posted by/);
});

test('26: birthdays are optional, hidden by default, year hidden unless chosen; friends get a 7-day notice', () => {
  assert.deepEqual(F.cleanBirthday({ month: 3, day: 4 }), { month: 3, day: 4, year: null, show: false, showYear: false });
  assert.deepEqual(F.cleanBirthday({ month: 3, day: 4, year: 1990, show: true }), { month: 3, day: 4, year: 1990, show: true, showYear: false });
  assert.throws(() => F.cleanBirthday({ month: 2, day: 30 })); assert.throws(() => F.cleanBirthday({ month: 2, day: 29, year: 2001 }));
  assert.equal(F.cleanBirthday(null), null);
  assert.equal(F.publicBirthday({ month: 3, day: 4, year: 1990, show: false }), null);
  assert.deepEqual(F.publicBirthday({ month: 3, day: 4, year: 1990, show: true, showYear: false }), { month: 3, day: 4 });
  assert.deepEqual(F.publicBirthday({ month: 3, day: 4, year: 1990, show: true, showYear: true }), { month: 3, day: 4, year: 1990 });
  const today = new Date(2026, 11, 29);
  assert.equal(F.daysUntil({ month: 12, day: 29 }, today), 0); assert.equal(F.daysUntil({ month: 1, day: 2 }, today), 4);
  assert.equal(F.daysUntil({ month: 2, day: 29 }, new Date(2027, 1, 27)), 1, 'Feb 29 counts as Feb 28 in other years');
  assert.deepEqual(settingsPatch({ birthday: { month: 7, day: 1, show: true } }).birthday, { month: 7, day: 1, year: null, show: true, showYear: false });
  const feat = read('social-next/features.js');
  assert.match(feat, /\(s\.value->'birthday'->>'show'\)::boolean is true/); assert.match(feat, /filter\(r => r\.birthday && r\.days <= 7\)/);
  assert.match(feat, /values\(\$1,\$2,'birthday',null,\$3\) on conflict do nothing/);
  assert.match(read('social-next/schema.sql'), /check\(kind in \('post','comment','like','mention','tag','share','birthday','room'\)\)/);
});

test('27: polls take 2-6 options, one vote each, results after voting, optional end time', async t => {
  assert.throws(() => F.cleanPoll({ options: ['only one'] }), /2 to 6/);
  assert.throws(() => F.cleanPoll({ options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }), /2 to 6/);
  assert.throws(() => F.cleanPoll({ options: ['a', 'A'] }), /different/);
  assert.throws(() => F.cleanPoll({ options: ['a', 'b'], ends: '2000-01-01' }), /90 days/);
  assert.deepEqual(F.cleanPoll({ options: [' Yes ', 'No', ''] }), { options: ['Yes', 'No'], ends: null });
  assert.equal(F.pollOpen({ options: [], ends: '2000-01-01T00:00:00Z' }), false);
  const poll = { options: ['a', 'b'], ends: null };
  const once1 = await server(t, { id: POST, author_id: 9, wall_id: 9, poll }, sql => sql.startsWith('insert into social_poll_votes') ? [{ choice: 1 }] : null);
  assert.equal((await once1.call('/api/posts/' + POST + '/vote', 'POST', { choice: 1 })).status, 200);
  assert.equal((await once1.call('/api/posts/' + POST + '/vote', 'POST', { choice: 5 })).status, 400);
  const again = await server(t, { id: POST, author_id: 9, wall_id: 9, poll });
  assert.equal((await again.call('/api/posts/' + POST + '/vote', 'POST', { choice: 0 })).status, 409, 'second vote refused');
  const ended = await server(t, { id: POST, author_id: 9, wall_id: 9, poll: { options: ['a', 'b'], ends: '2001-01-01T00:00:00Z' } });
  assert.equal((await ended.call('/api/posts/' + POST + '/vote', 'POST', { choice: 0 })).status, 409);
  assert.match(read('social-next/api.js'), /case when p\.poll is not null and \(p\.author_id=\$1 or exists\(select 1 from social_poll_votes where post_id=p\.id and user_id=\$1\)/);
});

test('28: reactions replace Like (one per person, switchable), old likes become "like"', async t => {
  assert.deepEqual(Object.keys(F.REACTIONS), ['like', 'love', 'laugh', 'wow', 'throwup', 'mad', 'shocked']);
  const s = await server(t, { id: POST, author_id: 9, wall_id: 9 });
  assert.equal((await s.call('/api/posts/' + POST + '/react', 'PUT', { reaction: 'hug' })).status, 400);
  assert.equal((await s.call('/api/posts/' + POST + '/react', 'PUT', { reaction: 'love' })).status, 200);
  assert.ok(s.writes.some(w => /on conflict\(post_id,user_id\) do update set reaction=\$3/.test(w.sql) && w.args[2] === 'love'));
  assert.equal((await s.call('/api/posts/' + POST + '/react', 'PUT', { reaction: null })).status, 200);
  assert.ok(s.writes.some(w => w.sql.includes('delete from social_likes')));
  assert.match(read('social-next/schema.sql'), /alter table social_likes add column if not exists reaction text not null default 'like';/);
  assert.match(read('social-next/features.js'), /not \$\{isBlocked\('u\.id', '\$2'\)\} order by l\.created desc limit 100/, 'hover list hides blocked people');
});

test('29: @mentions and #room tags', () => {
  assert.deepEqual(F.mentionsIn('hi @Bob and @carol_1. also email a@b.com and @bob'), ['bob', 'carol_1']);
  assert.deepEqual(F.roomTagsIn('party in #MusicLobby and #nope, #music-lobby', ['Music Lobby', 'Lobby']), ['Music Lobby']);
  const feat = read('social-next/features.js');
  assert.match(feat, /join contacts c on c\.owner=\$1 and c\.contact=u\.id[\s\S]*?and not \$\{isBlocked\('u\.id', '\$1'\)\}/, 'only friends, never blocked');
  assert.match(feat, /select lower\(owner\) from user_rooms where name=\$1 union select name_lc from room_mod where room=\$1 and kind='admin'/);
  assert.match(feat, /where not exists\(select 1 from blocks where \(owner=\$1 and blocked=\$2\) or \(owner=\$2 and blocked=\$1\)\)/);
  const api = read('social-next/api.js');
  assert.match(api, /await features\.afterText\(\{actor:req\.socialAccount\.id,postId:id,text:body,ref:id\}\);/);
  assert.match(api, /await features\.afterText\(\{actor:req\.socialAccount\.id,postId:post\.id,text:body,ref:id\}\);/, 'comments too');
  // the client renders mentions/room tags as links and keeps everything else escaped
  const doc = { addEventListener() {} }; const ctx = { window: {}, document: doc, HTMLTextAreaElement: class {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('social-next/web/social-features.js'), ctx);
  const html = ctx.SocialFeatures.richText('<b>hi</b> @bob #MusicLobby #nothing', new Map([['musiclobby', 'Music Lobby']]));
  assert.equal(html, '&lt;b&gt;hi&lt;/b&gt; <a class="mention" href="/social-next/@bob" data-profile-link="bob">@bob</a> <a class="room-tag" href="/rooms.html?room=Music%20Lobby" target="_blank" rel="noopener">#MusicLobby</a> #nothing');
  assert.match(read('social-next/web/social-features.js'), /className = 'mention-pick'/);
});

test('30: one pinned post at a time', () => {
  assert.match(read('social-next/api.js'), /update social_posts set pinned=\(id=\$1\) where wall_id=\$2 and \(pinned or id=\$1\)/);
  assert.match(read('social-next/schema.sql'), /update social_posts p set pinned=false where p\.pinned and exists/);
});

test('31: tagging friends in posts and on photos; tagged people can remove their own tag', async t => {
  assert.deepEqual(F.cleanTagNames(['Bob', 'bob', 'x', 'carol']), ['bob', 'carol']);
  assert.deepEqual(F.cleanPhotoTag({ name: 'Bob', x: 0.25, y: 0.5 }), { name: 'bob', x: 0.25, y: 0.5 });
  assert.throws(() => F.cleanPhotoTag({ name: 'bob', x: 2, y: 0 }));
  const notAuthor = await server(t, { id: POST, author_id: 9, wall_id: 9, image: 'data:image/png;base64,AA==', photo_tags: [] });
  assert.equal((await notAuthor.call('/api/posts/' + POST + '/photo-tags', 'PUT', { name: 'bob', x: .5, y: .5 })).status, 403);
  assert.equal((await notAuthor.call('/api/posts/' + POST + '/tags/carol', 'DELETE', {})).status, 403, 'cannot remove someone else’s tag');
  const own = await server(t, { id: POST, author_id: 9, wall_id: 9, tags: [{ id: 4, name: 'Alice' }, { id: 5, name: 'Carol' }], photo_tags: [{ id: 4, name: 'Alice', x: .1, y: .1 }] });
  assert.equal((await own.call('/api/posts/' + POST + '/tags/alice', 'DELETE', {})).status, 200);
  const w = own.writes.find(x => x.sql.startsWith('update social_posts set tags'));
  assert.deepEqual(JSON.parse(w.args[1]).map(x => x.name), ['Carol']); assert.deepEqual(JSON.parse(w.args[2]), []);
  const author = await server(t, { id: POST, author_id: 4, wall_id: 4, image: 'data:image/png;base64,AA==', photo_tags: [] }, sql => sql.includes('join contacts c on c.owner=$1') ? [{ id: 7, name: 'Bob', name_lc: 'bob' }] : null);
  assert.equal((await author.call('/api/posts/' + POST + '/photo-tags', 'PUT', { name: 'bob', x: .5, y: .4 })).status, 200);
  assert.deepEqual(JSON.parse(author.writes.find(x => x.sql.startsWith('update social_posts set photo_tags')).args[1]), [{ id: 7, name: 'Bob', x: .5, y: .4 }]);
  assert.ok(author.writes.some(x => /insert into social_notifications/.test(x.sql) && x.args[2] === 'tag' && x.args[0] === 7));
  assert.match(read('social-next/api.js'), /tags:visibleTags\(row\.tags\),photo_tags:visibleTags\(row\.photo_tags\)/, 'tags of blocked people are hidden');
  assert.match(read('social-next/web/social-features.js'), /class="post-with">— with ' \+ list/);
});
