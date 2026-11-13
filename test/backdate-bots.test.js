'use strict';
// razzle shows as created 10/23/2026; bot accounts get stable, natural-looking join dates 10/23-11/13/2026.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const B = require('../backdate'), { PROFILE_SEEDS } = require('../bots');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const mst = d => new Date(d).toLocaleString('en-US', { timeZone: 'America/Phoenix', hour12: false });

test('razzle: 10/23/2026 12:00 PM MST, only that name, idempotent', async () => {
  assert.equal(B.RAZZLE_AT, '2026-10-23T19:00:00Z');
  assert.equal(mst(B.RAZZLE_AT), '10/23/2026, 12:00:00');
  const users = [{ name: 'Razzle', name_lc: 'razzle', created: new Date('2026-11-12T00:00:00Z') }, { name: 'Bob', name_lc: 'bob', created: new Date('2026-11-12T00:00:00Z') }];
  const db = { async q(sql, a) { assert.match(sql, /where name_lc='razzle' and created is distinct from \$1::timestamptz/); const out = [];
    for (const u of users) if (u.name_lc === 'razzle' && +u.created !== +new Date(a[0])) { u.created = new Date(a[0]); out.push({ name: u.name }); } return out; } };
  assert.deepEqual(await B.applyRazzleBackdate(db), ['Razzle']);
  assert.deepEqual(await B.applyRazzleBackdate(db), []);
  assert.equal(users[1].created.toISOString(), '2026-11-12T00:00:00.000Z');
});

test('bot dates are deterministic, inside 10/23-11/13/2026, MST daytime, and spread out', () => {
  const dates = PROFILE_SEEDS.map(s => B.botCreatedAt(s.id));
  assert.deepEqual(dates, PROFILE_SEEDS.map(s => B.botCreatedAt(s.id)), 'stable');
  assert.equal(B.botCreatedAt('Preview-NightOwl'), B.botCreatedAt('preview-nightowl'));
  const days = new Set();
  for (const d of dates) {
    const t = +new Date(d), local = mst(d), hour = +local.split(', ')[1].split(':')[0];
    assert.ok(t >= Date.UTC(2026, 9, 23, 7) && t < Date.UTC(2026, 10, 14, 7), d);
    assert.ok(hour >= 8 && hour <= 21, 'daytime MST: ' + local);
    days.add(local.split(',')[0]);
  }
  assert.ok(days.size >= 18, 'spread over most days, got ' + days.size);
  assert.ok(dates.some(d => mst(d).startsWith('11/13/2026')), 'a few on 11/13');
});

// Fake db: users + social_bot_members, understanding the two queries applyBotBackdates runs.
function fakeDb() {
  const old = new Date('2026-11-12T20:00:00Z');
  const users = [
    { id: 1, name: 'NightOwl', pw: '!social-bot:x', created: old }, { id: 2, name: 'sk8rboi_1987', pw: '!social-bot:y', created: old },
    { id: 3, name: 'RealMember', pw: '$2a$12$hash', created: old }, // a real account that happens to be linked: never touched
    { id: 4, name: 'Zainy', pw: '$2a$12$hash', created: new Date('2026-11-11T19:00:00Z') },
  ];
  const members = [{ user_id: 1, bot_id: 'preview-nightowl' }, { user_id: 2, bot_id: 'sk8rboi_1987' }, { user_id: 3, bot_id: 'somebot' }];
  const writes = [];
  return { users, writes, async q(sql, a) {
    if (sql.startsWith('select')) return members.map(m => ({ ...users.find(u => u.id === m.user_id), bot_id: m.bot_id })).filter(u => u.pw.startsWith('!social-bot:')).map(u => ({ id: u.id, created: u.created, bot_id: u.bot_id }));
    assert.match(sql, /^update users u set created=v\.at from unnest\(\$1::int\[\],\$2::timestamptz\[\]\) as v\(id,at\)/);
    assert.match(sql, /u\.pw like '!social-bot:%' and exists\(select 1 from social_bot_members b where b\.user_id=u\.id\)/);
    writes.push(a); const out = [];
    a[0].forEach((id, i) => { const u = users.find(x => x.id === id); if (u.pw.startsWith('!social-bot:') && +u.created !== +new Date(a[1][i])) { u.created = new Date(a[1][i]); out.push({ name: u.name }); } });
    return out;
  } };
}

test('applyBotBackdates updates only bot accounts, never future dates, idempotent', async () => {
  const db = fakeDb(), later = new Date('2026-11-20T00:00:00Z');
  assert.deepEqual((await B.applyBotBackdates(db, later)).sort(), ['NightOwl', 'sk8rboi_1987']);
  assert.equal(db.users[0].created.toISOString(), B.botCreatedAt('preview-nightowl').replace('Z', '').replace(/(\.\d+)?$/, '.000') + 'Z');
  assert.equal(db.users[2].created.toISOString(), '2026-11-12T20:00:00.000Z', 'real member untouched');
  assert.equal(db.users[3].created.toISOString(), '2026-11-11T19:00:00.000Z');
  assert.equal(db.users.length, 4, 'no accounts created');
  const n = db.writes.length; assert.deepEqual(await B.applyBotBackdates(db, later), []); assert.equal(db.writes.length, n, 'nothing to do the second time');
  const early = fakeDb(); // server clock before some dates: those are skipped, never set in the future
  const now = new Date(B.botCreatedAt('preview-nightowl')); now.setTime(now.getTime() - 1000);
  await B.applyBotBackdates(early, now);
  assert.equal(early.users[0].created.toISOString(), '2026-11-12T20:00:00.000Z');
  for (const w of early.writes) for (const at of w[1]) assert.ok(+new Date(at) <= +now);
});

test('startup runs razzle + bot backdates after the masters; errors are only logged', () => {
  const m = read('master.js');
  assert.ok(m.indexOf("applyBackdates(db)") < m.indexOf('applyRazzleBackdate(db)'));
  assert.match(m, /bb = await B\.applyBotBackdates\(db\);/);
  assert.match(m, /catch \(e\) \{ console\.error\('\[backdate-bots\]', e\.message\); \}/);
});

test('preview join dates for bot profiles match their computed dates', () => {
  const day = id => new Date(B.botCreatedAt(id)).toLocaleDateString('en-CA', { timeZone: 'America/Phoenix' });
  for (const f of ['social-next/web/space.js', 'docs/space.js']) {
    const s = read(f);
    for (const [name, id] of [['NightOwl', 'preview-nightowl'], ['RetroFan', 'preview-retrofan'], ['MiaLuvs', 'preview-mialuvs']]) assert.ok(s.includes(`['${name}', '${day(id)}']`), f + ' ' + name);
  }
});
