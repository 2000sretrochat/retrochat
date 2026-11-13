// Focused local tests for t205u member management + bot profiles (no deploy).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('syntax: core modules parse', () => {
  for (const f of ['master.js', 'accounts.js', 'emails.js', 'bots.js', 'db.js', 'server.js', 'reset.js']) {
    require('child_process').execFileSync(process.execPath, ['--check', path.join(root, f)]);
  }
});

test('example names LumaKite PixelOrchard MossComet are reserved via master.reserved', () => {
  const db = { status: () => ({ ready: false }), q: async () => [] };
  const stubs = {
    './db': db, './emails': require('../emails'), './mail': { enabled: () => false }, './reset': { send: async () => {}, makeLink: async () => '' },
    './bots': require('../bots'), path: require('path'), bcryptjs: require('bcryptjs'), express: () => ({}),
  };
  const C = {
    app: { get() {}, post() {} }, express: { json: () => (req, res, next) => next() },
    io: { sockets: { sockets: new Map() }, emit() {} }, db, acc: {}, geo: {}, users: new Map(),
    ROOMS: {}, UROOMS: new Map(), RATE: {}, TOPICS: {}, OFFICIAL: new Set(), MOD: {}, mod: () => ({ admins: new Set(), mt: new Set(), mm: new Set(), kicked: new Map(), dot: new Map() }),
    socks: () => [], upd() {}, history: {}, closeRoom() {}, setRating() {}, setTopic() {}, modAct() {}, esc: s => s,
    MICS: {}, setMics() {}, micsOf: () => 1, HQ: {}, MTIMER: {}, MANN: {}, setMicOpts() {}, RATINGS: ['PG-13', 'R'], KICK_MS: 1,
    resetLink: async () => 'http://x/reset', applyBotProfiles: async () => {},
  };
  // Load master with a require cache isolation
  const modPath = require.resolve('../master.js');
  delete require.cache[modPath];
  const masterFactory = require('../master');
  const api = masterFactory(C);
  assert.equal(api.reserved('LumaKite'), true);
  assert.equal(api.reserved('pixelorchard'), true);
  assert.equal(api.reserved('MossComet'), true);
  assert.equal(api.reserved('SomeNormalName'), false);
  assert.ok(api.EXAMPLE_BLOCKED.includes('lumakite'));
});

test('shared email allowlist: only zainy + zainyochka + razzle may share zainyochka@gmail.com', async () => {
  const EM = require('../emails');
  assert.deepEqual(EM.sharedNames('zainy.ochka+tag@gmail.com'), ['zainy', 'zainyochka', 'razzle']);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'zainy', []), true);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'zainyochka', ['zainy']), true);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'intruder', ['zainy']), false);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'zainy', ['intruder']), false);
  assert.equal(EM.sharedNames('other@example.com'), null);

  // taken() with in-memory fake db
  const rows = [];
  const db = require('../db');
  const real = { status: db.status, q: db.q, init: db.init };
  db.status = () => ({ ready: true });
  db.q = async (sql, args) => {
    if (sql.includes("unlimited_emails")) return [];
    if (sql.startsWith('select name_lc from users where email_norm')) return rows.filter(r => r.email_norm === args[0]).map(r => ({ name_lc: r.name_lc }));
    return [];
  };
  try {
    assert.equal(await EM.taken('zainyochka@gmail.com', 'zainy'), false);
    rows.push({ name_lc: 'zainy', email_norm: 'zainyochka@gmail.com' });
    assert.equal(await EM.taken('zainyochka@gmail.com', 'zainyochka'), false);
    assert.equal(await EM.taken('zainyochka@gmail.com', 'third'), true);
    assert.equal(await EM.taken('solo@example.com', 'alice'), false);
    rows.push({ name_lc: 'alice', email_norm: 'solo@example.com' });
    assert.equal(await EM.taken('solo@example.com', 'bob'), true);
  } finally {
    db.status = real.status; db.q = real.q; db.init = real.init;
  }
});

test('every bot has a profile seed; no bot passwords; no "[bot]" suffix', () => {
  const { PROFILE_SEEDS, BOTS } = require('../bots');
  assert.equal(PROFILE_SEEDS.length, BOTS.length);
  for (const b of PROFILE_SEEDS) { assert.equal('password' in b, false); assert.equal('pw' in b, false); }
  assert.equal(BOTS.some(b => /\[bot\]/i.test(b.name)), false);
  const src = fs.readFileSync(path.join(root, 'master.js'), 'utf8') + fs.readFileSync(path.join(root, 'master.html'), 'utf8');
  assert.equal(/master password for bots|login as (the )?bots? with/i.test(src), false);
  assert.match(src, /no login passwords|not.*login accounts|There is no universal bot password/i);
});

test('db SQL includes deactivated, master_audit, bot_profiles migrations', () => {
  const src = fs.readFileSync(path.join(root, 'db.js'), 'utf8');
  assert.match(src, /deactivated boolean/);
  assert.match(src, /master_audit/);
  assert.match(src, /bot_profiles/);
});

test('master.html exposes member + bot controls; nonmaster 404 retained in master.js', () => {
  const html = fs.readFileSync(path.join(root, 'master.html'), 'utf8');
  for (const needle of ['deactivate', 'clear-profile', 'clear-avatar', 'reset-email', 'bot-profiles', 'Audit', 'Bots']) {
    assert.match(html, new RegExp(needle));
  }
  const mj = fs.readFileSync(path.join(root, 'master.js'), 'utf8');
  assert.match(mj, /Cannot GET/);
  assert.match(mj, /Cannot remove the last master/);
  assert.match(mj, /clear-avatar/);
  assert.match(mj, /deactivate/);
});
