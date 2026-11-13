'use strict';
// razzle shares zainyochka@gmail.com with zainy + zainyochka; bigtony gets teslaphx@gmail.com only if empty and unused;
// the verify-email bar awaits the async unlimited-email list.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const EM = require('../emails');
const { seedSharedEmail, seedBigTonyEmail, BIGTONY_EMAIL } = require('../master-emails');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function fakeDb(users) {
  return { users, async q(sql, a = []) {
    if (sql.startsWith('select id,name,email_norm from users where name_lc=$1')) return users.filter(u => u.name_lc === a[0]);
    if (sql.startsWith("select id,name,email from users where name_lc='bigtony'")) return users.filter(u => u.name_lc === 'bigtony');
    if (sql.startsWith('select id from users where email_norm=$1 and id<>$2')) return users.filter(u => u.email_norm === a[0] && u.id !== a[1]);
    if (sql.startsWith('update users set email=$2,email_norm=$3 where id=$1')) {
      const u = users.find(x => x.id === a[0]); if (!u) return [];
      if (sql.includes("coalesce(trim(email),'')=''") && String(u.email || '').trim()) return [];
      u.email = a[1]; u.email_norm = a[2]; return [{ id: u.id }];
    }
    throw new Error('unexpected sql: ' + sql);
  } };
}

test('razzle is on the zainyochka@gmail.com shared list; outsiders still are not', () => {
  assert.deepEqual(EM.sharedNames('zainyochka@gmail.com'), ['zainy', 'zainyochka', 'razzle']);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'razzle', ['zainy', 'zainyochka']), true);
  assert.equal(EM.sharedOk('zainyochka@gmail.com', 'bigtony', ['zainy']), false);
});

test('startup sets zainyochka@gmail.com on zainy, zainyochka and razzle; idempotent', async () => {
  const db = fakeDb([{ id: 1, name: 'Zainy', name_lc: 'zainy', email_norm: null }, { id: 2, name: 'Razzle', name_lc: 'razzle', email_norm: 'old@x.com' },
    { id: 3, name: 'zainyochka', name_lc: 'zainyochka', email_norm: 'zainyochka@gmail.com' }, { id: 4, name: 'Bob', name_lc: 'bob', email_norm: null }]);
  assert.deepEqual(await seedSharedEmail(db), ['Zainy', 'Razzle']);
  assert.ok(db.users.slice(0, 3).every(u => u.email_norm === 'zainyochka@gmail.com'));
  assert.equal(db.users[3].email_norm, null);
  assert.deepEqual(await seedSharedEmail(db), []);
});

test('bigtony gets teslaphx@gmail.com only when empty and unused; idempotent', async () => {
  assert.equal(BIGTONY_EMAIL, 'teslaphx@gmail.com');
  let db = fakeDb([{ id: 5, name: 'BigTony', name_lc: 'bigtony', email: null, email_norm: null }]);
  assert.equal(await seedBigTonyEmail(db), true);
  assert.equal(db.users[0].email, 'teslaphx@gmail.com'); assert.equal(db.users[0].email_norm, 'teslaphx@gmail.com');
  assert.equal(await seedBigTonyEmail(db), false, 'second start changes nothing');
  db = fakeDb([{ id: 5, name: 'BigTony', name_lc: 'bigtony', email: 'mine@example.com', email_norm: 'mine@example.com' }]);
  assert.equal(await seedBigTonyEmail(db), false); assert.equal(db.users[0].email, 'mine@example.com');
  db = fakeDb([{ id: 5, name: 'BigTony', name_lc: 'bigtony', email: '', email_norm: null }, { id: 6, name: 'Other', name_lc: 'other', email: 'TeslaPHX@gmail.com', email_norm: EM.norm('TeslaPHX@gmail.com') }]);
  assert.equal(await seedBigTonyEmail(db), false, 'address already used by another account (case-insensitive)');
  assert.equal(db.users[0].email, '');
  assert.equal(await seedBigTonyEmail(fakeDb([])), false, 'no bigtony account: nothing created');
});

test('startup wiring: seeds run at load, failures only logged', () => {
  const m = read('master.js');
  assert.match(m, /require\('\.\/master-emails'\)\.seedSharedEmail\(db\)/);
  assert.match(m, /require\('\.\/master-emails'\)\.seedBigTonyEmail\(db\)/);
  assert.match(m, /console\.error\('\[bigtony-email\]', e\.message\)/);
});

test('verify-email bar awaits the async unlimited list', () => {
  const r = read('reset.js');
  assert.match(r, /\(await EM\.list\(\)\)\.includes\(EM\.norm\(r\.email\)\)/);
  assert.doesNotMatch(r, /[^(]EM\.list\(\)\.includes/);
});
