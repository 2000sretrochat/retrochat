'use strict';
// Server-side status handling shared by both Messenger pages (main and Social), including older pages
// that still offer "Be Right Back" and the "[room]" status option.
const test = require('node:test'), assert = require('node:assert/strict');

function harness() {
  const user = { name: 'Zed', status: 'available', status_msg: 'hello', avatar: 'a1', show_room: false }, writes = [];
  const dbPath = require.resolve('../db'), accPath = require.resolve('../accounts');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    status: () => ({ ready: true, error: null }),
    q: async (sql, args = []) => {
      if (/^update users/.test(sql)) writes.push({ sql, args });
      if (/from users where id=\$1/.test(sql) && /status_msg/.test(sql)) return [{ ...user }];
      return [];
    } } };
  delete require.cache[accPath];
  const accounts = require('../accounts');
  let connect;
  accounts.sockets({ on: (event, fn) => { if (event === 'connection') connect = fn; }, sockets: { sockets: new Map() } }, {});
  return { writes, async join() {
    const handlers = {}, events = [];
    const s = { connected: true, handshake: { headers: { 'user-agent': 'Mozilla Windows Chrome' }, auth: {} },
      data: { acct: { id: 1, name: 'Zed' } }, on: (e, fn) => { handlers[e] = fn; }, emit: (e, d) => events.push([e, d]), disconnect() {} };
    await connect(s);
    const call = (e, arg) => new Promise(done => handlers[e](arg, done));
    return { init: await call('m:init', {}), call, events };
  } };
}

test('"Be Right Back" from an older page is stored and shown as Away', async () => {
  const h = harness(), z = await h.join();
  const r = await z.call('m:status', { status: 'brb' });
  assert.equal(r.status, 'away');
  assert.ok(h.writes.some(w => /status=\$2,status_msg=\$3/.test(w.sql) && w.args[1] === 'away'));
});

test('the legacy "[room]" status turns on Display Room I\'m In and keeps the typed status message', async () => {
  const h = harness(), z = await h.join();
  assert.equal(z.init.me.showRoom, false);
  const r = await z.call('m:status', { msg: '[room]' });
  assert.equal(r.ok, true);
  assert.equal(r.msg, 'hello', 'status message is not wiped');
  assert.ok(h.writes.some(w => /set show_room=true/.test(w.sql)), 'room visibility persisted');
  assert.ok(z.events.some(([e, d]) => e === 'm:room-visibility' && d === true), 'open Messenger windows update their checkbox');
});

test('a normal status message is escaped and capped at 60 characters', async () => {
  const h = harness(), z = await h.join();
  const r = await z.call('m:status', { msg: '<b>' + 'x'.repeat(80) });
  assert.ok(r.msg.startsWith('&lt;b&gt;'));
  assert.ok(!r.msg.includes('<'));
});
