'use strict';
// Add-a-contact lookup: case, underscores, pending requests, own blocks, people who blocked you.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const lookup = require('../contact-lookup');
let PGlite; try { PGlite = require(require.resolve('@electric-sql/pglite', { paths: [process.env.PGLITE_DIR || '/tmp/pgl', __dirname] })).PGlite; } catch {}

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

async function setup() {
  const pg = new PGlite();
  const src = read('db.js');
  const SQL = src.slice(src.indexOf('const SQL = `') + 13, src.indexOf('`;', src.indexOf('const SQL = `')));
  await pg.exec(SQL);
  const db = { q: async (t, p = []) => (await pg.query(t, p)).rows };
  // zainy=1, NEIL_UFO=2, carol=3, dave=4, erin=5, plus a banned/deactivated pair
  for (const n of ['zainy', 'NEIL_UFO', 'carol', 'dave', 'erin', 'banned_user', 'gone_user']) {
    await db.q("insert into users(name,name_lc,pw) values($1,lower($1),'x')", [n]);
  }
  await db.q('update users set banned=true where name_lc=$1', ['banned_user']);
  await db.q('update users set deactivated=true where name_lc=$1', ['gone_user']);
  const id = async n => (await db.q('select id from users where name_lc=$1', [n.toLowerCase()]))[0].id;
  return { pg, db, id, zainy: await id('zainy') };
}

test('normalize accepts mixed case, underscores and dots; rejects short or spaced names', () => {
  assert.equal(lookup.normalize('Neil_ufo').term, 'neil_ufo');
  assert.equal(lookup.normalize('  NEIL_UFO  ').term, 'neil_ufo');
  assert.equal(lookup.normalize('neil.ufo').term, 'neil.ufo');
  assert.match(lookup.normalize('Ne').error, /3–20 screen name characters/);
  assert.match(lookup.normalize('Neil ufo').error, /3–20 screen name characters/);
});

test('Postgres: case, underscore, prefix and exact match find NEIL_UFO', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db, zainy } = await setup();
  for (const q of ['Neil_ufo', 'NEIL_UFO', 'neil_ufo', 'neil_']) {
    const r = await lookup.find(db, { uid: zainy, query: q, page: 0 });
    assert.equal(r.people[0].name, 'NEIL_UFO', q);
    assert.equal(r.people[0].sent, false);
    assert.equal(r.people[0].contact, false);
  }
  const exact = await lookup.find(db, { uid: zainy, query: 'Neil_ufo', page: 0 });
  assert.equal(exact.notice, undefined);
  const prefix = await lookup.find(db, { uid: zainy, query: 'nei', page: 0 });
  assert.equal(prefix.people[0].name, 'NEIL_UFO');
  assert.equal(prefix.notice, undefined, 'prefix must not claim an exact already-sent notice');
  await pg.close();
});

test('Postgres: a request already sent is returned clearly, not as "no one found"', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db, zainy, id } = await setup();
  await db.q('insert into requests(from_id,to_id) values($1,$2)', [zainy, await id('NEIL_UFO')]);
  const r = await lookup.find(db, { uid: zainy, query: 'Neil_ufo', page: 0 });
  assert.equal(r.people.length, 1);
  assert.equal(r.people[0].name, 'NEIL_UFO');
  assert.equal(r.people[0].sent, true);
  assert.equal(r.people[0].hint, 'Request sent');
  assert.equal(r.notice, 'Request already sent to NEIL_UFO');
  await pg.close();
});

test('Postgres: an incoming request is listed so Add can accept it', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db, zainy, id } = await setup();
  await db.q('insert into requests(from_id,to_id) values($1,$2)', [await id('NEIL_UFO'), zainy]);
  const r = await lookup.find(db, { uid: zainy, query: 'neil_ufo', page: 0 });
  assert.equal(r.people[0].incoming, true);
  assert.equal(r.notice, 'NEIL_UFO already sent you a request. Add them to accept.');
  await pg.close();
});

test('Postgres: people you blocked are listed (not "no one found"); people who blocked you are hidden', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db, zainy, id } = await setup();
  await db.q('insert into blocks(owner,blocked) values($1,$2)', [zainy, await id('NEIL_UFO')]);
  await db.q('insert into blocks(owner,blocked) values($1,$2)', [await id('dave'), zainy]);
  const neil = await lookup.find(db, { uid: zainy, query: 'Neil_ufo', page: 0 });
  assert.equal(neil.people[0].name, 'NEIL_UFO');
  assert.equal(neil.people[0].blocked, true);
  assert.equal(neil.notice, 'You blocked NEIL_UFO. Unblock them to send a request.');
  const dave = await lookup.find(db, { uid: zainy, query: 'dave', page: 0 });
  assert.deepEqual(dave.people, []);
  assert.equal(dave.notice, undefined);
  await pg.close();
});

test('Postgres: already added, self, banned and deactivated are handled', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const { pg, db, zainy, id } = await setup();
  await db.q('insert into contacts(owner,contact) values($1,$2)', [zainy, await id('carol')]);
  const carol = await lookup.find(db, { uid: zainy, query: 'carol', page: 0 });
  assert.equal(carol.people[0].contact, true);
  assert.equal(carol.notice, 'carol is already in your contacts.');
  const self = await lookup.find(db, { uid: zainy, query: 'zainy', page: 0 });
  assert.deepEqual(self.people, []);
  const banned = await lookup.find(db, { uid: zainy, query: 'banned_user', page: 0 });
  assert.deepEqual(banned.people, []);
  const gone = await lookup.find(db, { uid: zainy, query: 'gone_user', page: 0 });
  assert.deepEqual(gone.people, []);
  await pg.close();
});

test('Messenger wiring: find-contacts uses the lookup helper; UI shows already-sent and unblock', () => {
  const acc = read('accounts.js'), cs = read('public/contact-search.js');
  assert.match(acc, /require\('\.\/contact-lookup'\)/);
  assert.match(acc, /contactLookup\.find\(db, \{ uid, query: term, page \}\)/);
  assert.doesNotMatch(acc, /owner=\$1 and blocked=u\.id\) or \(owner=u\.id and blocked=\$1\)/);
  assert.match(cs, /response\.notice/);
  assert.match(cs, /Request already sent to /);
  assert.match(cs, /person\.blocked/);
  assert.match(cs, /emit\('m:block', \{ name: person\.name, on: false \}\)/);
  assert.match(cs, /They show under Pending until they accept/);
  assert.match(read('public/messenger-pending.js'), /data-g="Pending">Pending \(/);
});
