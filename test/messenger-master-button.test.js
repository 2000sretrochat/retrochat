'use strict';
// Master Console from the Messenger window (no room): button placement, server-role gating, endpoint authorization.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

function fakeDom() {
  const mk = (tag) => {
    const el = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, className: '', id: '', listeners: {}, innerHTML: '', title: '', type: '',
      setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; },
      addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
      click() { (this.listeners.click || []).forEach(f => f({})); },
      append(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = this; this.children.push(c); },
      after(c) { const p = this.parent; if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = p; p.children.splice(p.children.indexOf(this) + 1, 0, c); },
      querySelector(sel) { const cls = sel.replace(/^#menu\s*/, '').replace(/^\./, ''); return this.children.find(c => c.className.split(' ').includes(cls)) || null; },
    };
    return el;
  };
  const menu = mk('div'); menu.id = 'menu';
  ['Messenger', 'Contacts', 'Actions', 'Help'].forEach(() => menu.append(mk('div')));
  const document = { createElement: mk, querySelector: sel => sel === '#menu' ? menu : sel.startsWith('#menu ') ? menu.querySelector(sel) : null };
  return { menu, document, mk };
}

test('master button sits immediately right of the bell, is labelled, idempotent, and opens the console', () => {
  const { menu, document, mk } = fakeDom();
  const bell = mk('button'); bell.className = 'messenger-bell'; menu.append(bell);
  let opened = 0; const window = { openMasterConsole: () => opened++ };
  const ctx = { window, document, MutationObserver: undefined }; vm.createContext(ctx);
  vm.runInContext(read('public/messenger-master.js'), ctx);
  const b = window.createMessengerMasterButton();
  assert.equal(menu.children[menu.children.indexOf(bell) + 1], b, 'directly after the bell');
  assert.equal(b.getAttribute('aria-label'), 'Master Console');
  assert.equal(b.type, 'button');
  assert.match(b.innerHTML, /<span class="mm-l">Master<\/span>/);
  assert.match(b.innerHTML, /aria-hidden="true"/);
  b.click(); assert.equal(opened, 1);
  assert.equal(window.createMessengerMasterButton(), b, 'second call does not add another button');
  assert.equal(menu.children.filter(c => c.className === 'messenger-master').length, 1);
});

test('if the bell is created later, the button moves to its right', () => {
  const { menu, document, mk } = fakeDom();
  let cb; const MutationObserver = function (f) { cb = f; this.observe = () => {}; this.disconnect = () => { cb = null; }; };
  const window = {}; const ctx = { window, document, MutationObserver }; vm.createContext(ctx);
  vm.runInContext(read('public/messenger-master.js'), ctx);
  const b = window.createMessengerMasterButton();
  assert.equal(menu.children.at(-1), b);
  const bell = mk('button'); bell.className = 'messenger-bell'; menu.append(bell); cb();
  assert.equal(menu.children.at(-1), b); assert.equal(menu.children.at(-2), bell);
});

test('both Messenger pages create the button only from the server role (/api/me m), never from names', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.match(s, /<script src="\/messenger-master\.js"><\/script><script src="\/offline-panel\.js"><\/script><script src="\/messenger-inbox\.js">/, f);
    assert.match(s, /function masterInit\(\)\{[^\n]*\n[^\n]*ms\.onerror=\(\)=>\{const b=\$\('bMaster'\);if\(b\)b\.remove\(\)\};document\.head\.appendChild\(ms\);window\.createMessengerMasterButton&&createMessengerMasterButton\(\);/, f);
    assert.match(s, /RazzleStartup\.getJSON\('\/api\/me', \$\('eIn'\)\)/, f);
    assert.match(s, /initialSession\.then\(m=>\{if\(m\?\.name&&!RazzleReconnect\.pending\(\)\)\{start\(\);if\(m\.m\)masterInit\(\)\}\}\)/, f);
    assert.equal((s.match(/createMessengerMasterButton\(/g) || []).length, 1, f + ': only called from masterInit');
    assert.doesNotMatch(s, /['"](zainy|tony|bigtony|zainyochka)['"]/i, f + ': no master names in the client');
  }
  assert.doesNotMatch(read('public/messenger-master.js'), /zainy|bigtony|zainyochka|['"]razzle['"]/i);
  // /api/me only says m:true when users.is_master is true in the database
  assert.match(read('accounts.js'), /m = !!\(await db\.q\('select is_master from users where id=\$1', \[u\.id\]\)\)\[0\]\?\.is_master;[^\n]*res\.json\(u \? \(m \? \{ name: u\.name, m: true \}/);
  const css = read('public/messenger-inbox.css');
  assert.match(css, /#menu \.messenger-master\{display:inline-flex!important;/);
  assert.match(css, /html\.dark #menu \.messenger-master\{color:#E8EEF7!important\}/);
  assert.match(css, /@media \(max-width:379px\)\{#menu \.messenger-master\{width:36px;/);
});

function loadMaster(usersById) {
  const routes = { get: {}, post: {} };
  const db = { status: () => ({ ready: true }), q: async (sql, p) => { if (/select is_master from users where id=\$1/.test(sql)) { const u = usersById[p[0]]; return u ? [{ is_master: u.master }] : []; } return [{ d: 0, w: 0, peak: 0 }]; } };
  const C = {
    app: { get(p, ...h) { routes.get[p] = h.at(-1); }, post(p, ...h) { routes.post[p] = h.at(-1); }, use() {} }, express: { json: () => (q, r, n) => n(), static: () => (q, r, n) => n() },
    io: { sockets: { sockets: new Map() }, emit() {}, to: () => ({ emit() {} }) }, db,
    acc: { userFromCookie: async c => { const m = /sid=(\d+)/.exec(c || ''); return m && usersById[m[1]] ? { id: +m[1], name: usersById[m[1]].name } : null; } },
    geo: {}, users: new Map(), ROOMS: {}, UROOMS: new Map(), RATE: {}, TOPICS: {}, OFFICIAL: new Set(), MOD: {},
    mod: () => ({ admins: new Set(), mt: new Set(), mm: new Set(), kicked: new Map(), dot: new Map() }), socks: () => [], upd() {}, history: {}, closeRoom() {}, setRating() {}, setTopic() {}, modAct() {}, esc: s => s,
    MICS: {}, setMics() {}, micsOf: () => 1, HQ: {}, MTIMER: {}, MANN: {}, MUSICON: {}, setMicOpts() {}, RATINGS: ['PG-13', 'R'], KICK_MS: 1,
    resetLink: async () => '', applyBotProfiles: async () => {}, stats: () => ({ online: 3, peak: 4, rooms: 2 }), roomList: () => [],
  };
  delete require.cache[require.resolve('../master.js')];
  require('../master')(C);
  return routes;
}
const call = async (h, cookie) => { const res = { code: 200, body: null, headers: {}, status(c) { this.code = c; return this; }, type() { return this; }, set(k, v) { this.headers[k] = v; return this; }, send(b) { this.body = b; return this; }, json(b) { this.body = b; return this; }, sendFile(f) { this.body = 'file:' + path.basename(f); return this; } };
  await h({ headers: { cookie }, query: {}, body: {} }, res); return res; };

test('console endpoints: master gets them with no room joined; non-masters and signed-out get a plain 404', async () => {
  const routes = loadMaster({ 1: { name: 'razzle', master: true }, 2: { name: 'MoonPie', master: false } });
  for (const p of ['/master', '/api/master/ui.js', '/api/master/stats']) {
    assert.ok(routes.get[p], p + ' is registered');
    const m = await call(routes.get[p], 'sid=1');
    assert.equal(m.code, 200, p + ' master');
    const n = await call(routes.get[p], 'sid=2');
    assert.equal(n.code, 404, p + ' non-master'); assert.equal(n.body, 'Cannot GET');
    const g = await call(routes.get[p], '');
    assert.equal(g.code, 404, p + ' signed out');
  }
  assert.equal((await call(routes.get['/master'], 'sid=1')).body, 'file:master.html');
  assert.equal((await call(routes.get['/api/master/ui.js'], 'sid=1')).body, 'file:master-win.js');
  assert.deepEqual((await call(routes.get['/api/master/stats'], 'sid=1')).body.online, 3);
});

test('the console page and window need no room: no room/socket state is read to open them', () => {
  const win = read('master-win.js'), html = read('master.html');
  assert.doesNotMatch(win, /\b(room|S\.emit|socket)\b/);
  assert.match(win, /<iframe src="\/master\?embed=1" title="Master Console"><\/iframe>/);
  assert.match(win, /if \(innerWidth < 980 \|\| innerHeight < 680\) w\.classList\.add\('max'\);/);
  assert.doesNotMatch(html, /socket\.io|S\.emit|window\.parent|opener/);
  // room-specific actions keep an explicit room chosen in the Rooms tab
  assert.match(html, /api\('room',\{room,\.\.\.b\}\)/);
  assert.match(html, /api\('roommod',\{room,action:b\.dataset\.a,who/);
});

test('signing in through the form (desktop app always does: session cookie) also turns on master tools', async () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.match(s, /\$\('iPw'\)\.value='';start\(\);masterCheck\(\)\}/, f + ': doIn runs the master check after start()');
    const m = s.match(/function masterCheck\(\)\{[^\r\n]*\}/); assert.ok(m, f);
    for (const [me, want] of [[{ name: 'razzle', m: true }, 1], [{ name: 'MoonPie' }, 0], [{ name: null }, 0]]) {
      let inits = 0; const ctx = { MW: null, masterInit() { inits++; ctx.MW = 1; }, fetch: async (u, o) => { assert.equal(u, '/api/me'); assert.equal(o.cache, 'no-store'); return { json: async () => me }; } };
      vm.createContext(ctx); vm.runInContext(m[0] + '\nthis.masterCheck=masterCheck;', ctx);
      ctx.masterCheck(); ctx.masterCheck(); await new Promise(r => setTimeout(r, 10));
      assert.equal(inits, want, f + ' ' + JSON.stringify(me) + ': masterInit once for masters only, never twice');
    }
  }
  // the desktop app signs in with remember:false, so every launch starts signed out and goes through doIn
  assert.match(read('desktop/main.js'), /siteRequest\('POST', '\/api\/login', \{ name, password, remember: false \}\)/);
});
