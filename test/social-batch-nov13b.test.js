'use strict';
// Nov 13, 2026 batch: profile picture album, suggestions, pending contact requests, Add a contact dialog,
// docked Messenger polish, "Post it!", parked notice card.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const PP = require('../social-next/profile-pictures');
let PGlite; try { PGlite = require(require.resolve('@electric-sql/pglite', { paths: [process.env.PGLITE_DIR || '/tmp/pgl', __dirname] })).PGlite; } catch {}

const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(80, 1)]);
const png2 = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(80, 2)]);
const dataUrl = b => 'data:image/png;base64,' + b.toString('base64');

test('picture validation: type, magic bytes and the 32 KB limit', () => {
  assert.equal(PP.parsePicture(dataUrl(png)).mime, 'image/png');
  assert.match(PP.parsePicture('data:image/svg+xml;base64,PHN2Zz4=').error, /JPEG, PNG or WebP/);
  assert.match(PP.parsePicture('data:image/png;base64,' + Buffer.alloc(80).toString('base64')).error, /not a valid image/);
  assert.match(PP.parsePicture('data:image/png;base64,' + Buffer.concat([png, Buffer.alloc(33 * 1024)]).toString('base64')).error, /too big|JPEG/);
});

async function setup() {
  const pg = new PGlite(); const src = read('db.js');
  const SQL = src.slice(src.indexOf('const SQL = `') + 13, src.indexOf('`;', src.indexOf('const SQL = `')));
  await pg.exec(SQL); await pg.exec(SQL); // startup twice: idempotent
  const schema = read('social-next/schema.sql'); await pg.exec(schema);
  const db = { q: async (t, p = []) => (await pg.query(t, p)).rows };
  for (const n of ['zainy', 'NEIL_UFO', 'carol', 'dave', 'erin']) await db.q("insert into users(name,name_lc,pw) values($1,lower($1),'x')", [n]);
  return { pg, db };
}
function harness(db, who) {
  const routes = {}, emitted = [];
  const router = { get: (p, h) => routes['GET ' + p] = h, post: (p, h) => routes['POST ' + p] = h, delete: (p, h) => routes['DELETE ' + p] = h };
  const run = h => async (req, res) => { try { await h(req, res); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
  const fail = (m, s = 400) => { throw Object.assign(Error(m), { status: s }); };
  const isBlocked = (o, v) => `exists(select 1 from blocks where (owner=${o} and blocked=${v}) or (owner=${v} and blocked=${o}))`;
  PP.registerProfilePictures(router, db, { run, fail, isBlocked, accounts: { setAvatar: async () => {} }, io: { sockets: { sockets: new Map() }, emit: (...a) => emitted.push(a) } });
  const call = async (method, route, params = {}, body) => {
    let status = 200, out; const res = { status(s) { status = s; return this; }, json(j) { out = j; return this; }, set() { return this; }, type() { return this; }, send(b) { out = b; return this; } };
    await routes[method + ' ' + route]({ params, body, socialAccount: { id: who.id, alias: who.alias, master: false } }, res);
    return { status, out };
  };
  return { call, emitted };
}

test('Postgres: picture history trigger, album privacy, set default, delete rules', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db } = await setup();
  await db.q("insert into avatars(user_id,mime,data) values(1,'image/png',$1)", [png]);
  await db.q("update users set avatar='c1' where id=1");
  await db.q("update avatars set data=$1 where user_id=1", [png2]);
  await db.q("update avatars set data=$1 where user_id=1", [png2]);
  assert.equal((await db.q('select count(*)::int n from avatar_history where user_id=1'))[0].n, 2, 'each new picture kept once');
  const z = harness(db, { id: 1, alias: 'zainy' });
  let r = await z.call('GET', '/api/profile-pictures/:name', { name: 'ZAINY' });
  assert.equal(r.out.pictures.length, 2); assert.equal(r.out.pictures[0].current, true); assert.match(r.out.note, /November 13, 2026/);
  const old = r.out.pictures[1], cur = r.out.pictures[0];
  assert.equal((await z.call('DELETE', '/api/profile-pictures/:id', { id: cur.id })).status, 409, 'current default cannot be deleted');
  r = await z.call('POST', '/api/profile-pictures/:id/default', { id: old.id });
  assert.equal(r.status, 200); assert.match((await db.q('select avatar from users where id=1'))[0].avatar, /^c[0-9a-f]{16}$/);
  assert.deepEqual((await db.q('select data from avatars where user_id=1'))[0].data, new Uint8Array(png));
  assert.equal(z.emitted.at(-1)[0], 'avatar');
  const del = await z.call('DELETE', '/api/profile-pictures/:id', { id: cur.id }); assert.equal(del.status, 200, JSON.stringify(del.out));
  assert.equal((await z.call('POST', '/api/profile-pictures', {}, { image: 'data:text/html;base64,AAAA' })).status, 400);
  const up = await z.call('POST', '/api/profile-pictures', {}, { image: dataUrl(png2) }); assert.equal(up.status, 200, JSON.stringify(up.out));
  // Viewers: a private profile hides the album from non-friends and blocked people; friends see it.
  await db.q(`insert into social_settings(user_id,value) values(1,'{"visibility":"private"}')`);
  const carol = harness(db, { id: 3, alias: 'carol' });
  assert.equal((await carol.call('GET', '/api/profile-pictures/:name', { name: 'zainy' })).status, 404);
  assert.equal((await carol.call('GET', '/api/profile-pictures/:name/:id/image', { name: 'zainy', id: old.id })).status, 404);
  await db.q('insert into contacts(owner,contact) values(1,3)');
  r = await carol.call('GET', '/api/profile-pictures/:name', { name: 'zainy' });
  assert.equal(r.status, 200); assert.equal(r.out.owner, false); assert.equal(r.out.note, '');
  await db.q('insert into blocks(owner,blocked) values(1,3)');
  assert.equal((await carol.call('GET', '/api/profile-pictures/:name', { name: 'zainy' })).status, 404);
  await pg.close();
});

test('Postgres: suggestions skip friends, buddies either way, requests either way, blocks and yourself (any case)', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db } = await setup();
  const api = read('social-next/api.js');
  const block = api.slice(api.indexOf("router.get('/api/suggestions'"));
  const sql = block.slice(block.indexOf('`') + 1, block.indexOf('`', block.indexOf('`') + 1))
    .replace("${isBlocked('u.id','$1')}", 'exists(select 1 from blocks where (owner=u.id and blocked=$1) or (owner=$1 and blocked=u.id))');
  // zainy=1 added NEIL_UFO=2 (one-way contact only), sent carol=3 a request, dave=4 blocked her, erin=5 is new.
  await db.q('insert into contacts(owner,contact) values(2,1)');
  await db.q('insert into requests(from_id,to_id) values(1,3)');
  await db.q('insert into blocks(owner,blocked) values(4,1)');
  const names = (await db.q(sql, [1])).map(r => r.name);
  assert.deepEqual(names, ['erin']);
  await pg.close();
});

test('suggestions: client reloads after friends load and filters sent requests too', () => {
  const js = read('social-next/web/live-account.js');
  assert.match(js, /loadSuggestions\(\); \/\/ friends are known now/);
  assert.match(js, /api\('\/suggestions'\)/);
  assert.match(js, /\.\.\.sentRequests\.map\(person=>person\.name\)\]\.map\(name=>String\(name\)\.toLowerCase\(\)\)/);
  assert.match(js, /<h2>Sent requests<\/h2>/); assert.match(js, /friendAction\(d\.liveCancel,'cancel'\)/);
  assert.match(read('social-next/api.js'), /action==='cancel'/);
});

test('Messenger: sent requests show under Pending with Cancel; accept clears it', () => {
  const acc = read('accounts.js');
  assert.match(acc, /sent: await sentRequests\(uid\)/);
  assert.match(acc, /toUser\(uid, 'm:sent', \{ name: t\.name, on: true \}\); return \{ \.\.\.generic, pending: true, name: t\.name \};/);
  assert.match(acc, /toUser\(uid, 'm:sent', \{ name: t\.name, on: false \}\); toUser\(t\.id, 'm:sent', \{ name: me, on: false \}\);/);
  assert.match(acc, /s\.on\('m:cancel-request'/);
  const P = read('public/messenger-pending.js');
  assert.match(P, /data-g="Pending">Pending \(/); assert.match(P, /data-cancel-req=/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.match(s, /<script src="\/messenger-pending\.js"><\/script>/);
    assert.match(s, /RazzlePending\.html\(\{contacts,closed:closedG\.has\('Pending'\),q,/);
    assert.match(s, /\.ct:not\(\.wct\):not\(\.pct\)/);
    assert.match(s, /window\.RazzlePending\?\.set\(result\.sent\)/);
  }
});

test('Pending list renders once per name, hides people who already accepted', () => {
  const vm = require('node:vm');
  const ctx = { window: {}, document: { createElement: () => ({}), head: { appendChild() {} }, addEventListener() {} } };
  vm.runInNewContext(read('public/messenger-pending.js'), ctx);
  const P = ctx.window.RazzlePending; P.set(['neil_ufo', 'Carol']); P.add('NEIL_UFO');
  assert.equal(JSON.stringify(P.names()), JSON.stringify(['Carol', 'neil_ufo']));
  const html = P.html({ contacts: { carol: {} } });
  assert.match(html, /Pending \(1\)/); assert.match(html, /neil_ufo/); assert.doesNotMatch(html, /data-pending="Carol"/);
  P.remove('Neil_UFO'); assert.equal(P.html({ contacts: { carol: {} } }), '');
});

test('Add a contact: centered, live suggestions, rate limited, no self/blocked, Already added', () => {
  const acc = read('accounts.js'), cs = read('public/contact-search.js'), css = read('public/messenger-polish.css');
  assert.match(acc, /if \(hits\.length >= 40\)/);
  assert.match(acc, /contactLookup\.find\(db, \{ uid, query: term, page \}\)/);
  assert.match(acc, /const p = r\.contact \? \(hooks\.botContact\?\.\(r\.name\) \|\| pres\(r\.id\)\) : null;/, 'presence only for people already in the list');
  assert.match(cs, /person\.contact \? 'Already added'/); assert.match(cs, /timer = setTimeout\(search, 300\)/);
  assert.match(cs, /response\.notice/);
  assert.match(css, /transform: translate\(-50%, -50%\) !important;/);
  assert.match(read('public/yd.js'), /pw\.moveTo\(Math\.max\(al,/);
});

test('docked Messenger: close button stays visible, panel flush at top; Post it! labels; parked card', () => {
  const embed = read('public/social/embed.css');
  assert.match(embed, /#mwin>\.tbar>span:nth-child\(2\)\{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis\}/);
  assert.match(embed, /#mwin>\.tbar>\.wb\{flex:none!important\}/);
  assert.match(read('social-next/web/social-home.css'), /\.right:has\(> \.live-social-messenger:first-child\)\{padding-top:0\}/);
  assert.match(read('social-next/web/social-home.js'), /label\.textContent = 'Post it!';/);
  assert.match(read('social-next/web/live-account.js'), /wall-note-icon'\)\.outerHTML\+'Post it!<\/button>/);
  const parked = read('public/messenger-parked.js');
  assert.match(parked, /<strong>Open in the Razzle app<\/strong><span>This window will reconnect when you close the app\.<\/span>/);
  assert.doesNotMatch(parked, /class=dot/);
  assert.match(parked, /const host = doc\.getElementById\('mwin'\) \|\| doc\.body;/);
});

test('rooms: redundant bottom-right cog removed (View menu stays); voice settings panel never cut off', () => {
  const r = read('public/rooms.html');
  assert.doesNotMatch(r, /id=bGear/); assert.doesNotMatch(r, /\$\('bGear'\)/);
  assert.doesNotMatch(read('public/room137.css'), /#bGear/);
  assert.match(r, /max-height:calc\(100vh - 16px\);max-height:calc\(100dvh - 16px\);overflow-y:auto/);
  assert.match(r, /id="avb"/, 'the Settings cog next to Talk stays');
});
