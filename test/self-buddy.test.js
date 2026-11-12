'use strict';
// You can put your own screen name on your list: added directly (no request), shown with the public presence view.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const acc = R('accounts.js'), api = R('social-next/api.js');

test('m:add on yourself inserts the self contact directly instead of refusing', () => {
  assert.doesNotMatch(acc, /You cannot add yourself/);
  assert.match(acc, /if \(t\.id === uid\) \{ await db\.q\("insert into contacts\(owner,contact,grp\) values\(\$1,\$1,'Friends'\) on conflict do nothing"/);
});
test('self entry uses the public presence (invisible looks offline), not raw status', async () => {
  // Behavioral: run the real Messenger socket handlers against an in-memory fake database.
  const USERS = { 1: { name: 'Zed', status: 'invisible' }, 2: { name: 'Amy', status: 'available' } };
  const CONTACTS = { 1: [1], 2: [1, 2] }; // Zed lists himself; Amy lists Zed and herself
  const dbPath = require.resolve('../db');
  const saved = require.cache[dbPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    status: () => ({ ready: true, error: null }),
    q: async (sql, args = []) => {
      if (/from users where id=\$1/.test(sql) && /status_msg/.test(sql)) { const u = USERS[args[0]]; return [{ ...u, status_msg: '', avatar: 'a1', show_room: true }]; }
      if (/from contacts c join users u on u\.id=c\.contact/.test(sql)) return CONTACTS[args[0]].map(id => ({ id, name: USERS[id].name, grp: 'Friends' }));
      if (/select owner from contacts where contact=\$1/.test(sql)) return Object.keys(CONTACTS).filter(o => CONTACTS[o].includes(args[0])).map(o => ({ owner: +o }));
      return [];
    } } };
  const accPath = require.resolve('../accounts');
  delete require.cache[accPath];
  try {
    const accounts = require('../accounts');
    let connect;
    accounts.sockets({ on: (event, fn) => { if (event === 'connection') connect = fn; }, sockets: { sockets: new Map() } }, {});
    const join = async uid => {
      const handlers = {}, events = [];
      const s = { connected: true, handshake: { headers: { 'user-agent': 'Mozilla Windows Chrome' }, auth: {} },
        data: { acct: { id: uid, name: USERS[uid].name } }, on: (e, fn) => { handlers[e] = fn; }, emit: (e, d) => events.push([e, d]), disconnect() {} };
      await connect(s);
      const init = await new Promise(done => handlers['m:init']({}, done));
      assert.ok(!init.error, init.error);
      return init;
    };
    const zed = await join(1), amy = await join(2);
    const entry = (init, name) => init.contacts.find(c => c.name === name);
    assert.equal(zed.me.status, 'invisible', 'the invisible member still sees their own real status');
    assert.deepEqual([entry(zed, 'Zed').online, entry(zed, 'Zed').status], [false, 'offline'], 'self entry shows the public (offline) view');
    assert.deepEqual([entry(amy, 'Zed').online, entry(amy, 'Zed').status, entry(amy, 'Zed').device], [false, 'offline', null], 'friends see an invisible member as offline');
    assert.deepEqual([entry(amy, 'Amy').online, entry(amy, 'Amy').status], [true, 'available'], 'a visible self entry is online');
    assert.equal(accounts.presence(1).online, false);
    assert.equal(accounts.presenceRaw(1).status, 'invisible');
  } finally {
    delete require.cache[accPath];
    if (saved) require.cache[dbPath] = saved; else delete require.cache[dbPath];
  }
});
test('PM / BUZZ / typing / IMVironment to yourself are refused (peer() excludes self)', () => {
  assert.match(acc, /async function peer\(name\) \{ const t = await idOf\(name\); if \(!t \|\| t\.id === uid \|\|/);
});
test('Social friend count and friends list ignore the self entry', () => {
  assert.match(api, /contacts where owner=u\.id and contact<>owner\) as friends/);
  assert.match(api, /where c\.owner=\$1 and c\.contact<>c\.owner/);
});
test('Messenger: self-entry does not open a profile on double-click; no door sound for yourself', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const h = R(f);
    assert.match(h, /This is your own contact entry\. Right-click to view your profile/);
    assert.doesNotMatch(h,/e\.ondblclick=[^;]*YProf\.show/);
    assert.match(h, /if\(ME&&k==ME\.name\.toLowerCase\(\)\)\{/);
  }
});
