const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const users = [{ id: 1, name: 'Alice', status: 'available', status_msg: '', avatar: 'a1', show_room: true }, { id: 2, name: 'Bob', status: 'available', status_msg: '', avatar: 'a2', show_room: true }];
function setup() {
  const database = { status: () => ({ ready: true }), async q(sql, args = []) {
    if (sql.startsWith('select name,status')) return users.filter(u => u.id === args[0]);
    if (sql.startsWith('select id,name from users')) return users.filter(u => u.name.toLowerCase() === args[0]);
    if (sql.startsWith('select 1 from contacts')) return [{ exists: 1 }];
    return [];
  } };
  const mod = { exports: {} }, sandbox = { module: mod, exports: mod.exports, console, setInterval: () => ({ unref() {} }), require(name) {
    if (name === './db') return database;
    if (name === './emails' || name === './geo') return {};
    if (name === 'bcryptjs') return { hashSync: () => 'dummy' };
    if (name === './flood') return { check: () => null };
    if (name === './messenger-sessions') return require('../messenger-sessions');
    return require(name);
  } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../accounts.js'), 'utf8'), sandbox);
  let connected; mod.exports.sockets({ on(event, fn) { if (event === 'connection') connected = fn; } }, {});
  const socket = async (uid, kind = 'messenger') => {
    const u = users.find(u => u.id === uid), s = { connected: true, handshake: { auth: { client: kind } }, data: { acct: u ? { id: u.id, name: u.name } : null }, handlers: {}, events: [],
      on(e, fn) { this.handlers[e] = fn; }, emit(...args) { this.events.push(args); }, disconnect() { this.connected = false; this.handlers.disconnect?.(); } };
    await connected(s); return s;
  };
  const send = async (s, event, data) => { let result; const cb = r => { result = r; }; if (data === undefined) await s.handlers[event](cb); else await s.handlers[event](data, cb); return result; };
  return { socket, send };
}
test('real account handlers permit one Social and one normal messenger together', async () => {
  const { socket, send } = setup(), desktop = await socket(1), social = await socket(1, 'social');
  assert.equal((await send(desktop, 'm:init')).me.name, 'Alice');
  assert.equal((await send(social, 'm:init')).me.name, 'Alice');
  assert.equal(desktop.connected, true);
  const replacement = await socket(1); await send(replacement, 'm:init');
  assert.equal(desktop.connected, false); assert.equal(social.connected, true);
  const nextSocial = await socket(1, 'social'); await send(nextSocial, 'm:init');
  assert.equal(social.connected, false); assert.equal(replacement.connected, true);
});
test('account call handlers deliver signals to one chosen recipient window', async () => {
  const { socket, send } = setup(), alice = await socket(1, 'social'), bob = await socket(2), bobSocial = await socket(2, 'social');
  for (const s of [alice, bob, bobSocial]) await send(s, 'm:init');
  await send(alice, 'm:call', { to: 'Bob', kind: 'video' });
  assert.equal(bob.events.filter(e => e[0] === 'm:call').length, 1);
  assert.equal(bobSocial.events.filter(e => e[0] === 'm:call').length, 0);
  assert.ok((await send(bobSocial, 'm:callans', { to: 'Alice', accept: true })).error);
  await send(bob, 'm:callans', { to: 'Alice', accept: true });
  await send(alice, 'm:sig', { to: 'Bob', data: { ice: 'candidate' } });
  assert.equal(bob.events.filter(e => e[0] === 'm:sig').length, 1);
  assert.equal(bobSocial.events.filter(e => e[0] === 'm:sig').length, 0);
  alice.disconnect(); assert.ok(bob.events.some(e => e[0] === 'm:hang'));
});
test('an unauthenticated Social client gets no account handlers', async () => {
  const { socket } = setup(), anonymous = await socket(null, 'social');
  assert.deepEqual(Object.keys(anonymous.handlers), []);
});
