'use strict';
// zainy, zainyochka, tony, bigtony show as created 11/11/2026 (users.created drives every displayed creation date).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { applyBackdates, BACKDATED_NAMES, BACKDATE_AT } = require('../backdate');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

// In-memory users table that understands the one update applyBackdates runs.
function fakeDb(users) {
  const calls = [];
  return { users, calls, async q(sql, a = []) {
    calls.push(sql);
    assert.match(sql, /^update users set created=\$1::timestamptz where lower\(name_lc\) = any\(\$2::text\[\]\) and created is distinct from \$1::timestamptz returning name$/);
    const at = new Date(a[0]).getTime(), out = [];
    for (const u of users) if (a[1].includes(u.name_lc.toLowerCase()) && u.created.getTime() !== at) { u.created = new Date(at); out.push({ name: u.name }); }
    return out;
  } };
}

test('the four names (any case) get 11/11/2026 12:00 PM MST; others untouched; idempotent', async () => {
  assert.deepEqual([...BACKDATED_NAMES], ['zainy', 'zainyochka', 'tony', 'bigtony']);
  assert.equal(BACKDATE_AT, '2026-11-11T19:00:00Z');
  assert.equal(new Date(BACKDATE_AT).toLocaleString('en-US', { timeZone: 'America/Phoenix' }), '11/11/2026, 12:00:00 PM');
  const now = new Date('2026-11-12T22:00:00Z');
  const db = fakeDb([
    { name: 'Zainy', name_lc: 'zainy', created: now }, { name: 'zainyochka', name_lc: 'zainyochka', created: now },
    { name: 'BigTony', name_lc: 'bigtony', created: now }, { name: 'Razzle', name_lc: 'razzle', created: now },
  ]); // "tony" does not exist here: nothing is created for it
  assert.deepEqual(await applyBackdates(db), ['Zainy', 'zainyochka', 'BigTony']);
  assert.equal(db.users.length, 4);
  for (const u of db.users) assert.equal(u.created.toISOString(), u.name_lc === 'razzle' ? now.toISOString() : '2026-11-11T19:00:00.000Z');
  assert.deepEqual(await applyBackdates(db), [], 'second start changes nothing');
});

test('startup runs the backdate next to the shared-email seeding, and failures are only logged', () => {
  const m = read('master.js');
  assert.match(m, /require\('\.\/backdate'\)\.applyBackdates\(db\)/);
  assert.ok(m.indexOf("[shared-email]") < m.indexOf("[backdate]"));
  assert.match(m, /catch \(e\) \{ console\.error\('\[backdate\]', e\.message\); \}/);
});

test('every displayed creation date reads users.created', () => {
  assert.match(read('server.js'), /u\.created,[\s\S]*memberSince: r\.created/, 'Messenger profile "Member since"');
  assert.match(read('social-next/api.js'), /u\.created,exists[\s\S]*memberSince:row\.created/, 'Social profile memberSince');
  assert.match(read('geo.js'), /select u\.id,u\.name,u\.email,u\.created/, 'Master Console / Social admin / admin page "Created"');
  for (const f of ['social-next/web/space.js', 'docs/space.js']) assert.match(read(f), /\['Zainy', '2026-11-11'\]/, f + ' preview join date');
});
