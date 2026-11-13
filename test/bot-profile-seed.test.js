'use strict';
// Startup error '[bot-profiles] duplicate key value violates unique constraint "bot_profiles_bot_id"' (Nov 13, 2026).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const S = require('../bot-profile-seed');
const BOTS = require('../bots');
const quiet = { log() {}, error() {} };

test('the real seed list has unique ids and names; dedupe drops repeats and blanks', () => {
  assert.equal(S.dedupeSeeds(BOTS.PROFILE_SEEDS).length, BOTS.PROFILE_SEEDS.length);
  const d = S.dedupeSeeds([{ id: 'a', name: 'A' }, { id: 'a', name: 'B' }, { id: 'c', name: 'a' }, { id: '', name: 'X' }, null, { id: 'd', name: 'D' }]);
  assert.deepEqual(d.map(x => x.id), ['a', 'd']);
});

test('one failing bot is logged in one line and the rest still seed', async () => {
  const seen = [], errors = [];
  const db = { async q(sql, p) {
    if (/^insert into bot_profiles/.test(sql)) { if (p[9] === 'b2') throw new Error('duplicate key value violates unique constraint "bot_profiles_bot_id"'); seen.push(p[9]); return [{ inserted: true }]; }
    return [];
  } };
  const r = await S.seedBotProfiles(db, { PROFILE_SEEDS: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }, { id: 'b3', name: 'Three' }] }, { log: { log() {}, error: (...a) => errors.push(a.join(' ')) } });
  assert.deepEqual(seen, ['b1', 'b3']); assert.deepEqual(r.failed, ['b2']); assert.equal(r.inserted, 2);
  assert.equal(errors.length, 1); assert.match(errors[0], /^\[bot-profiles\] b2: duplicate key/);
});

test('master.js uses the idempotent seeder and only touches bot_profiles', () => {
  const m = fs.readFileSync(path.join(__dirname, '..', 'master.js'), 'utf8');
  assert.match(m, /require\('\.\/bot-profile-seed'\)\.seedBotProfiles\(db, C\.BOTMOD \|\| require\('\.\/bots'\), \{ audit \}\)/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'bot-profile-seed.js'), 'utf8');
  assert.doesNotMatch(src, /\busers\b\s+(set|where)|from users|into users/i);
});

// Real Postgres (PGlite) when available locally: PGLITE_DIR=/path/with/node_modules/@electric-sql/pglite
let PGlite; try { PGlite = require(require.resolve('@electric-sql/pglite', { paths: [process.env.PGLITE_DIR || '/tmp/pgl', __dirname] })).PGlite; } catch {}
test('Postgres: renamed bots no longer crash startup, edits survive, two runs are clean', { skip: !PGlite && 'PGlite not installed' }, async () => {
  const pg = new PGlite(); const db = { q: async (s, p) => (await pg.query(s, p)).rows };
  const ddl = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8').match(/create table if not exists bot_profiles\([\s\S]*?\);[\s\S]*?create unique index if not exists bot_profiles_bot_id on bot_profiles\(bot_id\);/)[0];
  await pg.exec(ddl);
  // State left by the pre-rename seed (Nov 11): rows under the old character names already hold the bot_ids.
  await db.q("insert into bot_profiles(name_lc,name,display_name,bio,avatar,bot_id) values('bart_simpson','Bart_Simpson','Bart','old default bio','bart-simpson','bart-simpson')");
  await db.q("insert into bot_profiles(name_lc,name,display_name,bio,bot_id,updated_by) values('sideshow_bob','Sideshow_Bob','Bob','MASTER BIO','sideshow-bob','zainy')");
  await db.q("insert into bot_profiles(name_lc,name,display_name,bio,bot_id) values('ralph_wiggum','Ralph_Wiggum','Ralph','x','ralph-wiggum'), ('mochi_modem','Mochi_Modem','Kept','kept row',null)");
  // The old loop fails exactly like production.
  await assert.rejects(db.q(`insert into bot_profiles(name_lc,name,bot_id) values('patch_pigeon','Patch_Pigeon','bart-simpson') on conflict(name_lc) do update set bot_id=coalesce(bot_profiles.bot_id, excluded.bot_id)`), /bot_profiles_bot_id/);
  const audits = [];
  const r1 = await S.seedBotProfiles(db, BOTS, { log: quiet, audit: async (...a) => audits.push(a) });
  assert.deepEqual(r1.failed, []); assert.equal(r1.renamed, 2);
  const rows = await db.q('select * from bot_profiles');
  assert.equal(rows.filter(r => r.bot_id).length, BOTS.PROFILE_SEEDS.length, 'every seeded bot has a profile');
  const by = id => rows.find(r => r.bot_id === id);
  const pp = by('bart-simpson'); assert.equal(pp.name, 'Patch_Pigeon'); assert.notEqual(pp.bio, 'old default bio', 'untouched row gets the new seed text');
  assert.equal(pp.avatar, BOTS.PROFILE_SEEDS.find(d => d.id === 'bart-simpson').avatar_key || '');
  const vv = by('sideshow-bob'); assert.equal(vv.name, 'Velvet_Vox'); assert.equal(vv.bio, 'MASTER BIO', 'master edit kept'); assert.equal(vv.updated_by, 'zainy');
  const mm = by('ralph-wiggum'); assert.equal(mm.name_lc, 'mochi_modem'); assert.equal(mm.bio, 'kept row', 'existing row under the new name is kept');
  assert.equal(rows.find(r => r.name_lc === 'ralph_wiggum').bot_id, null, 'old row kept, just unlinked');
  assert.equal(audits.length, 2);
  const before = JSON.stringify(await db.q('select * from bot_profiles order by name_lc'));
  const r2 = await S.seedBotProfiles(db, BOTS, { log: quiet });
  assert.deepEqual(r2, { seeds: BOTS.PROFILE_SEEDS.length, inserted: 0, renamed: 0, failed: [] });
  assert.equal(JSON.stringify(await db.q('select * from bot_profiles order by name_lc')), before, 'second startup changes nothing');
  await pg.close();
});
