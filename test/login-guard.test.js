'use strict';
// Failed sign-in protection: 10 failures -> 5-minute wait; another 10 within 24h -> locked until reset/unlock (+ reset email).
const test = require('node:test'), assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createLoginGuard, MSG } = require('../login-guard');

// In-memory stand-in for the login_guard table (and the few users/sessions queries sign-in makes).
function fakeDb(users = {}) {
  const rows = new Map(), sessions = [];
  return { rows, sessions, status: () => ({ ready: true, error: null }), async q(sql, a = []) {
    if (sql.startsWith('select fails,window_start')) return rows.has(a[0]) ? [{ ...rows.get(a[0]) }] : [];
    if (sql.startsWith('insert into login_guard')) { rows.set(a[0], { fails: a[1], window_start: a[2], locked_until: a[3], strikes: a[4], strike_at: a[5], locked: a[6] }); return []; }
    if (sql.startsWith('delete from login_guard where key=$1')) { rows.delete(a[0]); return []; }
    if (sql.startsWith('select id,name,pw,banned,deactivated,email from users where name_lc=$1')) return users[a[0]] ? [users[a[0]]] : [];
    if (sql.startsWith('insert into sessions')) { sessions.push(a); return []; }
    return [];
  } };
}

test('10 failures -> 5-minute wait; then 10 more within 24h -> locked; a reset/unlock clears it', async () => {
  let t = Date.parse('2026-11-12T20:00:00Z');
  const db = fakeDb(), g = createLoginGuard({ db, now: () => t });
  for (let i = 1; i <= 9; i++) assert.equal((await g.fail('amy', '1.2.3.4')).status, 401);
  assert.equal(await g.check('amy', '1.2.3.4'), null);
  const tenth = await g.fail('amy', '1.2.3.4');
  assert.deepEqual([tenth.status, tenth.error], [429, MSG.wait]);
  assert.equal((await g.check('amy', '9.9.9.9')).status, 429, 'the wait follows the screen name, not just the network');
  t += 4 * 60e3; assert.equal((await g.check('amy')).status, 429);
  t += 61e3; assert.equal(await g.check('amy'), null, 'after 5 minutes they may try again');
  for (let i = 1; i <= 9; i++) assert.equal((await g.fail('amy')).status, 401);
  const lock = await g.fail('amy');
  assert.deepEqual([lock.status, lock.error, lock.lockedNow], [423, MSG.locked, true]);
  t += 7 * 24 * 3600e3;
  assert.equal((await g.check('amy')).status, 423, 'a lock does not expire on its own');
  await g.clear('amy');
  assert.equal(await g.check('amy'), null);
});

test('a second round more than 24 hours later is another 5-minute wait, not a lock', async () => {
  let t = 0; const g = createLoginGuard({ db: fakeDb(), now: () => t });
  for (let i = 0; i < 10; i++) await g.fail('bo');
  t += 25 * 3600e3;
  for (let i = 0; i < 9; i++) await g.fail('bo');
  assert.equal((await g.fail('bo')).status, 429);
});

test('failures spread over more than an hour start a fresh count', async () => {
  let t = 0; const g = createLoginGuard({ db: fakeDb(), now: () => t });
  for (let i = 0; i < 9; i++) await g.fail('cy');
  t += 61 * 60e3;
  assert.equal((await g.fail('cy')).status, 401);
});

test('one network failing 30 times across many names waits 5 minutes (never a lock)', async () => {
  let t = Date.parse('2026-11-12T20:00:00Z'); const g = createLoginGuard({ db: fakeDb(), now: () => t });
  for (let i = 0; i < 29; i++) assert.equal((await g.fail('name' + i, '5.5.5.5')).status, 401);
  assert.equal((await g.fail('other', '5.5.5.5')).status, 429);
  assert.equal((await g.check('fresh', '5.5.5.5')).status, 429);
  assert.equal(await g.check('fresh', '6.6.6.6'), null);
  t += 5 * 60e3 + 1; assert.equal(await g.check('fresh', '5.5.5.5'), null);
});

// End to end through /api/login with the real accounts.js routes (fake database, real express).
async function server(users) {
  const db = fakeDb(users), dbPath = require.resolve('../db'), accPath = require.resolve('../accounts');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
  delete require.cache[accPath];
  const express = require('express'), app = express();
  require('../accounts').http(app, express, {});
  const srv = await new Promise(ok => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const base = 'http://127.0.0.1:' + srv.address().port;
  const login = (name, password) => fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, password }) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  return { db, base, login, close: () => new Promise(ok => srv.close(ok)) };
}

test('/api/login: same replies for real and unknown names, correct password blocked during the wait and after a lock', async () => {
  const pw = bcrypt.hashSync('right-password', 4);
  const s = await server({ amy: { id: 1, name: 'Amy', pw, banned: false, deactivated: false, email: null } });
  try {
    for (let i = 0; i < 9; i++) {
      const [real, ghost] = [await s.login('Amy', 'wrong'), await s.login('Nobody_here', 'wrong')];
      assert.deepEqual([real.status, real.body.error], [401, 'Invalid screen name or password.']);
      assert.deepEqual(ghost, real, 'unknown names get the identical reply');
    }
    const [real, ghost] = [await s.login('Amy', 'wrong'), await s.login('Nobody_here', 'wrong')];
    assert.equal(real.status, 429); assert.equal(real.body.error, MSG.wait); assert.deepEqual(ghost, real);
    assert.equal((await s.login('Amy', 'right-password')).status, 429, 'even the right password waits');
    assert.equal(s.db.sessions.length, 0);
    // jump past the wait, fail another round -> locked (and the same for the unknown name)
    for (const k of ['n:amy', 'n:nobody_here']) s.db.rows.get(k).locked_until = new Date(Date.now() - 1000);
    for (const k of [...s.db.rows.keys()]) if (k.startsWith('ip:')) s.db.rows.delete(k); // (this test's 40 failures share one network)
    for (let i = 0; i < 9; i++) { await s.login('Amy', 'wrong'); await s.login('Nobody_here', 'wrong'); }
    const [lr, lg] = [await s.login('Amy', 'wrong'), await s.login('Nobody_here', 'wrong')];
    assert.equal(lr.status, 423); assert.equal(lr.body.error, MSG.locked); assert.deepEqual(lg, lr);
    assert.equal((await s.login('Amy', 'right-password')).status, 423);
    s.db.rows.delete('n:amy'); // what a password reset or a master's "Unlock sign-in" does
    assert.equal((await s.login('Amy', 'right-password')).status, 200);
    assert.equal(s.db.sessions.length, 1);
  } finally { await s.close(); }
});

test('a correct password clears earlier failures', async () => {
  const pw = bcrypt.hashSync('pw-12345', 4);
  const s = await server({ bo: { id: 2, name: 'Bo', pw, banned: false, deactivated: false, email: null } });
  try {
    for (let i = 0; i < 8; i++) await s.login('Bo', 'nope');
    assert.equal((await s.login('Bo', 'pw-12345')).status, 200);
    assert.equal(s.db.rows.has('n:bo'), false);
  } finally { await s.close(); }
});

test('sign-out always completes: /api/logout accepts body-less POSTs, the client sends JSON and never waits forever', async () => {
  const s = await server({});
  try {
    const bare = await fetch(s.base + '/api/logout', { method: 'POST' });
    assert.equal(bare.status, 200); assert.deepEqual(await bare.json(), { ok: true });
    assert.match(bare.headers.get('set-cookie') || '', /yc_sid=;/);
    const json = await fetch(s.base + '/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(json.status, 200);
    const other = await fetch(s.base + '/api/logout', { method: 'POST', headers: { Origin: 'https://evil.example' } });
    assert.equal(other.status, 403, 'cross-site sign-outs are still refused');
    const bad = await fetch(s.base + '/api/receipts', { method: 'POST', body: 'x' });
    assert.equal(bad.status, 415, 'other writes still require JSON');
  } finally { await s.close(); }
  const fs = require('fs'), path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'razzle-reconnect.js'), 'utf8');
  assert.match(src, /headers: \{ 'Content-Type': 'application\/json' \}, body: '\{\}'/);
  assert.match(src, /if \(response\.status < 500\) \{\s*localStorage\.removeItem\(key\);/);
  assert.match(src, /Date\.now\(\) - started >= LOGOUT_GIVE_UP_MS\) \{\s*localStorage\.removeItem\(key\);/);
  const social = fs.readFileSync(path.join(__dirname, '..', 'social-next', 'web', 'social-home.js'), 'utf8');
  assert.match(social, /fetch\('\/api\/logout', \{method:'POST', headers:\{'Content-Type':'application\/json'\}, body:'\{\}'\}\)/);
});
