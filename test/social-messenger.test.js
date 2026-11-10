const test = require('node:test'), assert = require('node:assert/strict'), vm = require('node:vm'), fs = require('node:fs'), path = require('node:path');
const users = [{ id: 1, name: 'Alice', status: 'available', status_msg: '', avatar: 'a1', show_room: true }, { id: 2, name: 'Bob', status: 'available', status_msg: '', avatar: 'a2', show_room: true }];
function setup() {
  const database = { status: () => ({ ready: true }), async q(sql, args = []) {
    if (sql.includes('from social_restrictions')) {
      assert.equal(sql, 'select 1 from social_restrictions where user_id=$1 and service=$2');
      assert.equal(args[1], 'messenger');
      return [];
    }
    if (sql.startsWith('select name,status')) return users.filter(u => u.id === args[0]);
    if (sql.startsWith('select id,name from users')) return users.filter(u => u.name.toLowerCase() === args[0]);
    if (sql.startsWith('select owner from contacts')) return [{owner:args[0]===1?2:1}];
    if (sql.startsWith('select 1 from requests')) return [{ exists: 1 }];
    if (sql.startsWith('select 1 from contacts')) return [{ exists: 1 }];
    return [];
  } };
  const mod = { exports: {} }, sandbox = { module: mod, exports: mod.exports, console, setInterval: () => ({ unref() {} }), require(name) {
    if (name === './db') return database;
    if (name === './emails' || name === './geo' || name === './mail') return {};
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
  return { socket, send, accounts:mod.exports };
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

test('a Social friendship change reaches both open Messenger clients', async () => {
  const {socket,send,accounts}=setup(),alice=await socket(1),bob=await socket(2);
  await send(alice,'m:init');
  await send(bob,'m:init');
  accounts.contactsChanged(1,2);
  assert.equal(alice.events.filter(event=>event[0]==='m:contacts-changed').length,1);
  assert.equal(bob.events.filter(event=>event[0]==='m:contacts-changed').length,1);
  assert.ok(Array.isArray((await send(alice,'m:contacts')).contacts));
});

test('repeating the same Messenger send ID delivers one message', async () => {
  const {socket,send}=setup(),alice=await socket(1),bob=await socket(2);
  await send(alice,'m:init');
  await send(bob,'m:init');
  const message={to:'Bob',text:'Hello',clientId:'8bbb7749-8859-43af-b98f-30b2b552a8c5'};
  const [first,second]=await Promise.all([send(alice,'m:im',message),send(alice,'m:im',message)]);
  assert.equal(first.id,second.id);
  assert.equal(bob.events.filter(event=>event[0]==='m:im').length,1);
  alice.disconnect();
  const reconnected=await socket(1);await send(reconnected,'m:init');
  assert.equal((await send(reconnected,'m:im',message)).id,first.id);
  assert.equal(bob.events.filter(event=>event[0]==='m:im').length,1);
  await send(reconnected,'m:im',{...message,clientId:'e49d4c07-3a65-4205-a020-2fae045487ab'});
  assert.equal(bob.events.filter(event=>event[0]==='m:im').length,2);
});

test('declining a contact request updates the recipient only', async () => {
  const {socket,send}=setup(), sender=await socket(1), recipient=await socket(2), dock=await socket(2,'social');
  for(const client of [sender,recipient,dock]) await send(client,'m:init');
  const before=sender.events.length;
  assert.equal((await send(recipient,'m:respond',{name:'Alice',accept:false})).ok,true);
  assert.equal(sender.events.length,before);
  for(const client of [recipient,dock]) assert.ok(client.events.some(event=>event[0]==='m:contacts-changed'));
});

test('idle waits for all windows and yields to a manually selected status', async () => {
  const {socket,send}=setup(), desktop=await socket(1), dock=await socket(1,'social'), viewer=await socket(2);
  for(const client of [desktop,dock,viewer]) await send(client,'m:init');
  const presence=async()=>{
    const status=viewer.events.filter(event=>event[0]==='m:presence').at(-1)?.[1];
    return [status?.status,status?.idle];
  };
  await send(desktop,'m:status',{status:'available'});
  await send(dock,'m:idle',true);
  assert.deepEqual(await presence(),['available',false]);
  await send(desktop,'m:idle',true);
  assert.deepEqual(await presence(),['available',true]);
  await send(desktop,'m:status',{status:'available'});
  assert.deepEqual(await presence(),['available',false]);
  await send(desktop,'m:status',{status:'busy'});
  await send(desktop,'m:idle',true);
  assert.deepEqual(await presence(),['busy',false]);
  await send(desktop,'m:status',{status:'invisible'});
  assert.deepEqual(await presence(),['offline',false]);
});
