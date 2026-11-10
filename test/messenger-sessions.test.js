const test = require('node:test'), assert = require('node:assert/strict');
const { clientKind, replacedSessions, CallRoutes } = require('../messenger-sessions');
const socket = (name, kind = 'messenger') => ({ connected: true, handshake: { auth: { client: kind } }, data: { acct: { name }, mess: true, messClient: kind }, events: [], emit(...args) { this.events.push(args); } });
test('Social preserves desktop sessions and replaces only older Social docks', () => {
  const desktop = socket('A'), social = socket('A', 'social'), next = socket('A', 'social');
  assert.deepEqual(replacedSessions(next, new Set([desktop, social])), [social]);
  assert.deepEqual(replacedSessions(socket('A'), new Set([desktop, social])), [desktop]);
  assert.equal(clientKind({ handshake: { auth: { client: 'admin' } } }), 'messenger');
});
test('calls ring one endpoint and signals stay pinned to that endpoint', () => {
  const routes = new CallRoutes(), a = socket('A', 'social'), b = socket('B'), bs = socket('B', 'social');
  assert.equal(routes.start(a, 1, 2, new Set([bs, b])).target, b);
  assert.equal(routes.relay(bs, 2, 1, 'm:callans', true), null);
  assert.equal(routes.relay(a, 1, 2, 'm:callans', true), null);
  assert.equal(routes.relay(b, 2, 1, 'm:callans', true), a);
  assert.equal(routes.relay(a, 1, 2, 'm:sig'), b);
  assert.ok(routes.start(bs, 2, 1, new Set([a])).error);
  assert.equal(routes.relay(b, 2, 1, 'm:hang'), a);
  assert.equal(routes.calls.size, 0);
});
test('social-only calls work, declines clear routes, and disconnect ends calls', () => {
  const routes = new CallRoutes(), a = socket('A'), b = socket('B', 'social');
  assert.equal(routes.start(a, 1, 2, new Set([b])).target, b);
  routes.relay(b, 2, 1, 'm:callans', false); assert.equal(routes.calls.size, 0);
  routes.start(a, 1, 2, new Set([b])); routes.disconnect(a);
  assert.deepEqual(b.events.pop(), ['m:hang', { from: 'A' }]); assert.equal(routes.calls.size, 0);
});
test('unanswered calls expire at 30 seconds and stale signals cannot reach a retry', () => {
  let now = 0; const routes = new CallRoutes(() => now), a = socket('A'), b = socket('B');
  routes.start(a, 1, 2, new Set([b]), 'first'); now = 29999;
  assert.ok(routes.start(a, 1, 2, new Set([b]), 'second').error);
  now = 30000;
  assert.equal(routes.relay(b, 2, 1, 'm:callans', true, 'first'), null);
  assert.deepEqual(b.events.pop(), ['m:hang', { from:'A',callId:'first',reason:'no-answer' }]);
  assert.equal(routes.start(a, 1, 2, new Set([b]), 'second').target, b);
  assert.equal(routes.relay(b, 2, 1, 'm:callans', true, 'first'), null);
  assert.equal(routes.relay(b, 2, 1, 'm:callans', true, 'second'), a);
  routes.disconnect(a);
});

