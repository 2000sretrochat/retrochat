'use strict';
// Tester batch Nov 13, part 2: items 15-19 and 8b.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(30, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n\x1a\n'), Buffer.alloc(30, 2)]);

test('15: Social posts accept animated GIFs as uploaded (not re-encoded)', () => {
  const { postPhoto } = require('../social-next/api.js');
  const gif = 'data:image/gif;base64,' + GIF.toString('base64');
  assert.equal(postPhoto(gif), gif);
  assert.throws(() => postPhoto('data:image/gif;base64,' + PNG.toString('base64')), /GIF under 2 MB/);
  assert.throws(() => postPhoto('data:image/gif;base64,' + 'R0lGODlh' + 'A'.repeat(2700000)), /GIF under 2 MB/);
  assert.equal(postPhoto(''), '');
  assert.throws(() => postPhoto('data:image/svg+xml;base64,PHN2Zz4='), /JPG, PNG, or WebP/);
  const live = read('social-next/web/live-account.js');
  assert.match(live, /if\(file\.type==='image\/gif'\)return gifData\(file\);/, 'GIFs skip the canvas');
  assert.match(live, /R0lGOD\[ld\]h/);
  assert.match(read('social-next/web/index.html'), /<label>Photo or GIF<input type="file" accept="image\/jpeg,image\/png,image\/webp,image\/gif"><\/label>/);
  assert.match(read('social-next/api.js'), /image=postPhoto\(b\.image\)/);
});

test('16: custom room icons are validated, stored in Postgres and served safely', async () => {
  const R = require('../room-icons');
  const png = R.parseIcon('data:image/png;base64,' + PNG.toString('base64'));
  assert.equal(png.mime, 'image/png'); assert.ok(Buffer.isBuffer(png.data));
  assert.match(R.parseIcon('data:image/png;base64,' + GIF.toString('base64')).error, /not a valid picture/, 'type must match the bytes');
  assert.match(R.parseIcon('data:image/svg+xml;base64,PHN2Zz4=').error, /PNG, JPG, WebP or GIF/);
  assert.match(R.parseIcon('data:image/png;base64,' + Buffer.concat([PNG, Buffer.alloc(R.ICON_MAX)]).toString('base64')).error, /too big/);
  assert.ok(R.isUploaded(R.newMark())); assert.ok(!R.isUploaded('🎵')); assert.ok(!R.isUploaded('img:<x>'));
  const routes = {}, app = { get: (p, h) => { routes[p] = h; } }, rows = { Disco: { mime: 'image/png', data: PNG } };
  R.route(app, { q: async (_sql, [room]) => rows[room] ? [rows[room]] : [] }, n => n === 'Disco');
  const res = () => { const r = { headers: {}, code: 200, set(h) { Object.assign(r.headers, h); return r; }, status(c) { r.code = c; return r; }, end(b) { r.body = b; return r; } }; return r; };
  const ok = res(); await routes['/api/room-icon/:room']({ params: { room: 'Disco' } }, ok);
  assert.equal(ok.headers['Content-Type'], 'image/png'); assert.equal(ok.headers['X-Content-Type-Options'], 'nosniff'); assert.match(ok.headers['Content-Security-Policy'], /sandbox/); assert.equal(ok.body, PNG);
  const no = res(); await routes['/api/room-icon/:room']({ params: { room: 'Lobby' } }, no); assert.equal(no.code, 404);
  const db = read('db.js'), server = read('server.js'), rooms = read('public/rooms.html');
  assert.match(db, /create table if not exists room_icons\(room text primary key, mime text not null, data bytea not null/);
  assert.match(server, /s\.on\('room:icon-upload', async \(dataUrl, cb\) =>/);
  assert.match(server, /if \(roleOf\(s, room\) !== 'owner'\) return cb\(\{ error: 'Only the room owner can change the room icon\.' \}\);\s*const icon = RICON\.parseIcon/);
  assert.match(server, /'favorites', 'room_icons'\]/, 'renaming a room keeps its icon');
  assert.match(rooms, /async function roomIconData\(f\)/); assert.match(rooms, /c\.width=c\.height=96/);
  assert.match(read('public/browse.js'), /const iconInner=r=>/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) assert.match(read(f), /<span class=rtileic>\$\{YBrowse\.iconInner\(r\)\}<\/span>/);
  // the shared renderer escapes emoji text and builds a safe image URL
  const ctx = { window: {}, document: { addEventListener() {}, querySelectorAll: () => [] }, localStorage: {}, fetch: async () => ({}), setInterval: () => 0, setTimeout: () => 0, addEventListener() {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read('public/browse.js'), ctx);
  assert.match(ctx.YBrowse.iconInner({ name: "Bob's Room", icon: 'img:abc' }), /src="\/api\/room-icon\/Bob%27s%20Room\?v=abc"/);
  assert.equal(ctx.YBrowse.iconInner({ name: 'x', icon: '<b>' }), '&#60;b&#62;');
});

test('17: dictation explains problems visibly and uses Windows voice typing in the desktop app', () => {
  const d = read('public/dictate.js');
  assert.match(d, /if\(!SR&&!DESK\)return;/);
  assert.match(d, /if\(DESK\)\{ta\.focus\(\);return flash\(btn,WINH\)\}/);
  assert.match(d, /Windows key \+ H/);
  assert.match(d, /'not-allowed':'Microphone blocked/);
  assert.match(d, /n\.className='ydnote'/);
  assert.match(d, /textarea#msg/);
});

test('18: links in room messages are clickable and safe; the desktop app has a text right-click menu', () => {
  const rooms = read('public/rooms.html');
  const escT = t => String(t).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';'), smile = t => t.replace(/:\)/g, '<img alt=smile>');
  const src = rooms.slice(rooms.indexOf('const URLRX='), rooms.indexOf('function add(m){'));
  const ctx = { escT, smile, URL }; vm.createContext(ctx); vm.runInContext(src + ';this.linkMsg=linkMsg', ctx);
  const out = ctx.linkMsg('hi :) see https://ex.com/a?b=1&amp;c=2. bye');
  assert.match(out, /^hi <img alt=smile> see <a href="https:\/\/ex\.com\/a\?b=1&#38;c=2" target="_blank" rel="noopener noreferrer" class=rlink>https:\/\/ex\.com\/a\?b=1&amp;c=2<\/a>\. bye$/);
  assert.equal(ctx.linkMsg('javascript:alert(1) ftp://x.com'), 'javascript:alert(1) ftp://x.com');
  assert.match(ctx.linkMsg('http://a.com/&quot;onmouseover=&quot;x'), /href="http:\/\/a\.com\/"[^>]*>http:\/\/a\.com\/<\/a>&quot;onmouseover/);
  assert.match(rooms, /else\{let t=linkMsg\(m\.text\);/);
  const main = read('desktop/main.js');
  assert.match(main, /wc\.on\('context-menu', \(_e, params\) =>/);
  for (const l of ["'Cut'", "'Copy'", "'Paste'", "'Select All'", "'Copy Link'"]) assert.ok(main.includes('label: ' + l), l);
  assert.match(main, /if \(\/\^\(https\?\|mailto\):\/\.test\(url\)\) shell\.openExternal\(url\); return \{ action: 'deny' \};/, 'new-window links open in the real browser');
});

test('19: no green dot next to names in the room member list', () => {
  const rooms = read('public/rooms.html');
  assert.doesNotMatch(rooms, /<span class=sdot><\/span>\$\{m\.talk/);
  assert.doesNotMatch(rooms.slice(rooms.indexOf('const row=m=>')).split('\n')[0], /sdot/);
});

test('8b: night light is saved to the account and synced, with the browser as fallback', async () => {
  const N = require('../night-pref');
  assert.deepEqual(N.clean({ on: true, strength: 200 }), { on: true, strength: 85 });
  assert.deepEqual(N.clean({ on: false, strength: '3' }), { on: false, strength: 10 });
  assert.equal(N.clean({ on: 'yes', strength: 40 }), null); assert.equal(N.clean(null), null);
  const routes = {}, app = { get: (p, h) => { routes['GET ' + p] = h; }, post: (p, _m, h) => { routes['POST ' + p] = h; } }, saved = [];
  const db = { q: async (sql, args) => { if (sql.startsWith('update')) { saved.push(args); return []; } return [{ night_pref: { on: true, strength: 60 } }]; } };
  N.route(app, { json: () => null }, db, async req => req.who ? { id: 7 } : null);
  const res = () => { const r = { code: 200, set() { return r; }, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } }; return r; };
  let r = res(); await routes['GET /api/night-pref']({ who: 1 }, r); assert.deepEqual(r.body, { on: true, strength: 60 });
  r = res(); await routes['GET /api/night-pref']({}, r); assert.equal(r.code, 401);
  r = res(); await routes['POST /api/night-pref']({ who: 1, headers: { origin: 'https://evil.test', host: 'razzle.test' }, body: { on: true, strength: 50 } }, r); assert.equal(r.code, 403);
  r = res(); await routes['POST /api/night-pref']({ who: 1, headers: { origin: 'https://razzle.test', host: 'razzle.test' }, body: { on: true, strength: 50 } }, r);
  assert.equal(r.code, 200); assert.deepEqual(saved[0], [7, '{"on":true,"strength":50}']);
  assert.match(read('db.js'), /alter table users add column if not exists night_pref jsonb;/);
  const theme = read('public/theme.js');
  assert.match(theme, /fetch\('\/api\/night-pref',\{credentials:'same-origin',cache:'no-store'\}\)/);
  assert.match(theme, /const setOn=v=>\{on=!!v;save\(\);apply\(\);push\(\);return on\}/);
});
