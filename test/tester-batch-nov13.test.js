'use strict';
// Tester feedback batch (Nov 13, 2026).
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('smileys: every picker button fills the picker before opening (rooms web + desktop, Messenger)', () => {
  const assets = read('public/razzle-assets.js'), rooms = read('public/rooms.html'), r137 = read('public/room137.js');
  assert.match(assets, /async function fillSmileys\(picker/);
  assert.match(assets, /renderSmileys, bindSmileys, fillSmileys/);
  assert.match(rooms, /\$\('bSm'\)\.onclick=e=>\{e\.stopPropagation\(\);\$\('smb'\)\.click\(\)\}/, 'visible Smileys button goes through bindSmileys');
  assert.doesNotMatch(rooms, /\$\('bSm'\)\.onclick=e=>\{e\.stopPropagation\(\);\$\('smp'\)\.classList\.toggle\('open'\)\}/);
  assert.match(r137, /RazzleAssets\.fillSmileys\(smp,d\)\.then\(\(\)=>\{if\(!ew\.closed\)box\.innerHTML=smp\.innerHTML\}\)/, 'desktop smiley window is filled');
  assert.doesNotMatch(r137, /box\.innerHTML=smp\.innerHTML;d\.body\.appendChild\(box\)/);
});

test('room input placeholder is just "Type here..." and dictation still attaches', () => {
  const rooms = read('public/rooms.html');
  assert.doesNotMatch(rooms, /Type a message to '\+h\.room/);
  assert.match(rooms, /\$\('msg'\)\.placeholder='Type here\.\.\.'/);
  assert.match(rooms, /<textarea id="msg"[^>]*placeholder="Type here\.\.\."/);
  assert.match(read('public/dictate.js'), /textarea#msg/);
});

test('desktop window titles name the room and the PM partner', () => {
  assert.match(read('public/rooms.html'), /if\(window\.YD\)document\.title=h\.room\+' - Razzle'/);
  const main = read('desktop/main.js');
  assert.match(main, /kindOf\(url, frameName\) === 'im'\) w\.on\('page-title-updated'/);
  assert.match(read('public/index.html'), /name\+' - Private Message'/);
});

test('chat text size: two larger menu sizes and a bigger slider range', () => {
  const rooms = read('public/rooms.html');
  assert.match(rooms, /data-fs="xl">Extra Large Text/); assert.match(rooms, /data-fs="xxl">Huge Text/);
  assert.match(rooms, /#log\.fs-xl\{font-size:19px\}#log\.fs-xxl\{font-size:22px\}/);
  assert.match(rooms, /id="fsr" min="11" max="32"/);
  assert.match(rooms, /Math\.max\(11,Math\.min\(32,/);
  assert.match(rooms, /\+\(\$\('log'\)\.classList\.contains\('fsz'\)\?' fsz':''\)/, 'View menu no longer drops the slider size');
});

function loadTheme(store = {}) {
  const classes = new Set(), styles = {};
  const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, set textContent(v) { this._t = v; }, get textContent() { return this._t; } });
  const document = { documentElement: { classList: { toggle: (c, on) => on ? classes.add(c) : classes.delete(c), remove: c => classes.delete(c) }, clientWidth: 1000 },
    head: { appendChild(n) { styles[n.id] = n; } }, body: { appendChild() {} }, getElementById: id => styles[id] || null, createElement: el, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [] };
  const ctx = { document, localStorage: store, matchMedia: () => ({ matches: false }), addEventListener() {}, dispatchEvent() {}, Event: class {}, setTimeout, window: null };
  ctx.window = ctx; vm.createContext(ctx); vm.runInContext(read('public/theme.js'), ctx);
  return { YTheme: ctx.YTheme, classes, styles, store };
}
test('night light: gray, adjustable 10-85%, saved, replaces the dark-blue mode', () => {
  const t = loadTheme({ ycTheme: 'dark' });
  assert.equal(t.YTheme.night(), true, 'old dark-mode users are moved to night light');
  assert.equal(t.store.ycTheme, 'light'); assert.ok(!t.classes.has('dark')); assert.ok(t.classes.has('nightlight'));
  assert.equal(t.YTheme.setStrength(200), 85); assert.equal(t.YTheme.setStrength(1), 10); assert.equal(t.store.ycNightStrength, '10');
  const [r, g, b] = t.YTheme.tint(85); assert.ok(r > 60 && r < 110 && Math.abs(r - b) < 12, 'gray, not blue');
  assert.deepEqual([...t.YTheme.tint(10)].every(v => v > 230), true, 'light end barely tints');
  assert.match(t.styles['yc-night'].textContent, /mix-blend-mode:multiply/);
  t.YTheme.setNight(false); assert.ok(!t.classes.has('nightlight')); assert.equal(t.store.ycNight, 'off');
  const fresh = loadTheme({}); assert.equal(fresh.YTheme.night(), false);
  assert.match(read('public/mcog.js'), /<span>Night light<\/span>/); assert.match(read('public/mcog.js'), /data-nl min=10 max=85/);
});

test('room access: member rooms open only for owner/admins/masters; up to 4 rooms per name', () => {
  const RA = require('../room-access');
  const u = { ownerLc: 'disco' }, admins = new Set(['kat']);
  assert.equal(RA.canOpenRoom({ uroom: null, nameLc: 'x' }), true, 'built-in rooms always open');
  assert.equal(RA.canOpenRoom({ uroom: u, admins, nameLc: 'disco', acct: true }), true);
  assert.equal(RA.canOpenRoom({ uroom: u, admins, nameLc: 'kat', acct: true }), true);
  assert.equal(RA.canOpenRoom({ uroom: u, admins, nameLc: 'bob', acct: true }), false);
  assert.equal(RA.canOpenRoom({ uroom: u, admins, nameLc: 'kat', acct: false }), false, 'a guest using an admin name cannot open');
  assert.equal(RA.canOpenRoom({ uroom: u, admins, nameLc: 'zainy', acct: true, master: true }), true);
  assert.match(RA.closedRoomError('Disco'), /Disco is closed right now/);
  const mine = (n, room) => ({ id: 's' + n, room, mine: true });
  assert.deepEqual(RA.multiRoomDecision([], 'A'), { ok: true });
  assert.deepEqual(RA.multiRoomDecision([mine(1, 'A'), mine(2, 'B'), mine(3, 'C')], 'D'), { ok: true }, '4th room is fine; nothing is left');
  const full = RA.multiRoomDecision([mine(1, 'A'), mine(2, 'B'), mine(3, 'C'), mine(4, 'D')], 'E');
  assert.equal(full.full, true); assert.match(full.error, /already in 4 rooms\. Please leave one/);
  assert.deepEqual(RA.multiRoomDecision([mine(1, 'A'), mine(2, 'B')], 'B'), { replace: 's2' }, 're-opening the same room hands over');
  assert.match(RA.multiRoomDecision([{ id: 'x', room: 'A', mine: false }], 'B').error, /in use/);
  const server = read('server.js');
  assert.match(server, /RA\.multiRoomDecision\(nameSocks\(lcN\)/);
  assert.doesNotMatch(server, /You are already in a room with this screen name in another tab/);
  assert.match(server, /if \(!roomOpenFor\(s, room, name\)\) return cb\(\{ error: RA\.closedRoomError\(room\), closed: true \}\)/);
  assert.match(server, /already have ' \+ room \+ ' open in another window/);
  assert.match(server, /next = nameSocks\(lcD\)\.find\(o => o !== s\); if \(next\) users\.set\(lcD, next\.id\)/, 'room PMs follow a remaining window');
  // every Messenger link opens each room in its own window
  for (const f of ['public/index.html', 'public/social/messenger.html', 'public/messenger-device.js', 'public/yd.js'])
    assert.doesNotMatch(read(f).replace(/window\.openRoomWindow\?openRoomWindow\([^)]*(\([^)]*\))?[^)]*\):window\.open\([^)]*(\([^)]*\))?[^)]*,'yapprooms'\)/g, ''), /'yapprooms'\)/, f);
  const ctx = { window: {}, location: { origin: 'https://x.test' }, URL }; ctx.window.open = () => ({ closed: false, focus() {} }); vm.createContext(ctx);
  vm.runInContext(read('public/room-windows.js').replace('(function(){', '(function(){const window=globalThis.window;'), ctx);
  assert.equal(ctx.window.RazzleRoomWindows.nameFor('Music Lobby'), 'yroom_music_lobby');
  assert.notEqual(ctx.window.RazzleRoomWindows.nameFor('Lobby'), ctx.window.RazzleRoomWindows.nameFor('Late Night'));
});

test('desktop app takes priority: browser Messenger is parked, not signed out; calls ring the app', () => {
  const M = require('../messenger-sessions');
  const sock = (device, extra = {}) => { const ev = []; return { handshake: { auth: { device, ...(extra.client ? { client: extra.client } : {}) }, headers: {} }, data: { mess: true, messClient: extra.client || 'messenger' }, connected: true, events: ev, emit: (...a) => ev.push(a) }; };
  const app = sock('desktop'), web = sock('browser'), web2 = sock('browser'), phone = sock('mobile'), dock = sock('browser', { client: 'social' });
  assert.deepEqual(M.replacedSessions(web, [app, web]), [], 'web does not sign the app out');
  assert.deepEqual(M.replacedSessions(app, [app, web]), [], 'app does not sign web out');
  assert.deepEqual(M.replacedSessions(web2, [web, web2]), [web], 'a second browser window still replaces the first');
  const set = new Set([app, web, dock, phone]);
  M.syncParked(set);
  assert.deepEqual(web.events.at(-1), ['m:parked', { on: true, text: 'Razzle Messenger is open in the app' }]);
  assert.equal(dock.data.parked, true); assert.equal(!!app.data.parked, false); assert.equal(!!phone.data.parked, false);
  const n = web.events.length; M.syncParked(set); assert.equal(web.events.length, n, 'no repeat while unchanged');
  set.delete(app); M.syncParked(set); assert.deepEqual(web.events.at(-1), ['m:parked', { on: false, text: '' }]);
  const routes = new M.CallRoutes(), caller = sock('browser'); caller.data.acct = { name: 'A' };
  web.data.acct = app.data.acct = { name: 'B' }; web.data.parked = true;
  assert.equal(routes.start(caller, 1, 2, new Set([web, app]), 'c1').target, app, 'the app rings even when the browser connected first');
  const acc = read('accounts.js');
  assert.match(acc, /if \(s\.data\.parked\) return \{ error: PARKED_TEXT \+ '\. Use the app to call\.' \}/);
  assert.match(acc, /else syncParked\(set\);/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) { assert.match(read(f), /window\.RazzleParked\?\.bind\(S\)/); assert.match(read(f), /messenger-parked\.js/); }
  assert.match(read('public/messenger-parked.js'), /html\.messenger-parked #mwin>\*:not\(\.rz-parked\)/);
});

test('web Messenger is labelled Web; the desktop app never is', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.match(s, /Messenger<small class="web-tag" data-web-only hidden>Web<\/small>/);
    assert.match(s, /IS_DESKTOP_APP=!!\(window\.YappDesktop&&window\.YappDesktop\.isDesktop\),WEB_TAG=IS_DESKTOP_APP\?'':' · Web'/);
    assert.match(s, /if\(!IS_DESKTOP_APP\)document\.querySelectorAll\('\[data-web-only\]'\)/);
  }
  assert.match(read('desktop/main.js'), /win\.on\('page-title-updated', e => \{ e\.preventDefault\(\); win\.setTitle\('Razzle Messenger'\); \}\)/);
});

test('ignore works on masters too (never reveals them); moderation unaffected', () => {
  const s = read('server.js');
  assert.match(s, /hide: \[\.\.\.new Set\(\[\.\.\.ign, \.\.\.bl\.map\(n => n\.toLowerCase\(\)\)\]\)\], pmBuddies/);
  assert.doesNotMatch(s, /filter\(n => !ms\.has\(n\)\)/);
  assert.match(read('mic-bump.js'), /socket\.data\.master \|\|/, 'masters still exempt from Mic Bump');
});

test('right-click never offers the Room Admin Console; the admin panel menus still do', () => {
  const rooms = read('public/rooms.html');
  assert.doesNotMatch(rooms, /data-c=mod>Room Admin Console/);
  assert.match(rooms, /<div id="mKick" style="display:none">Admin Console\.\.\.<\/div>/);
  assert.match(rooms, /\$\('mKick'\)\.style\.display=myRole\(\)&&!window\.MASTER\?'':'none'/);
});

test('voice button reads Mute voice / Unmute voice and tracks the real state', () => {
  const rooms = read('public/rooms.html');
  assert.match(rooms, /id="vbtn"[^>]*aria-pressed="false"><i data-i=mic><\/i><span>Mute voice<\/span>/);
  assert.match(rooms, /querySelector\('span'\)\.textContent=voff\?'Unmute voice':'Mute voice'/);
});

test('follow notice goes only to the room owner, admins and masters', () => {
  const s = read('server.js');
  assert.match(s, /function followNotice\(room, name\) \{[^}]*text: esc\(name\) \+ ' followed this room\.' \};\s*for \(const x of socks\(room\)\) if \(roleOf\(x, room\)\) x\.emit\('msg', m\); \}/);
  assert.match(s, /on conflict do nothing returning room'/);
  assert.match(s, /if \(req\.body\?\.on && added && added\.length\) followNotice\(room, a\.name\)/);
});

test('room names cannot contain underscores (server and client)', () => {
  const s = read('server.js');
  assert.match(s, /function roomNameError\(n\) \{\s*if \(\/_\/\.test\(n\)\) return 'Room names cannot contain underscores/);
  const rooms = read('public/rooms.html');
  assert.match(rooms, /const ROOM_UNDERSCORE='Room names cannot contain underscores/);
  assert.match(rooms, /if\(\/_\/\.test\(w\.querySelector\('#crN'\)\.value\)\)return w\.querySelector\('#crE'\)\.textContent=ROOM_UNDERSCORE/);
  assert.match(rooms, /if\(\/_\/\.test\(q\('#edN'\)\.value\)\)return q\('#edE'\)\.textContent=ROOM_UNDERSCORE/);
  assert.match(rooms, /if\(n&&\/_\/\.test\(n\)\)return alert\(ROOM_UNDERSCORE\)/);
});

test('PM calls get the room mic adjustments and live mic rebuilds reach the call', () => {
  const c = read('public/messenger-calls.js');
  assert.match(c, /function micButton\(window,panel,live\)/);
  assert.match(c, /class=mb min=0 max=200 step=5/); assert.match(c, /yav\.setBoost\(\+e\.target\.value\)/);
  assert.match(c, /yav\.set\('agc',e\.target\.checked\)/); assert.match(c, /yav\.set\('dev',e\.target\.value\)/);
  assert.match(c, /const yav=globalThis\.YAV;\s*if\(!yav\|\|!yav\.onRebuild\)return;/, 'watchMic reads the real global, not the PM element');
});

test('Social: emoji + font + attachments on friend walls; YouTube links in text play inline', () => {
  const home = read('social-next/web/social-home.js'), live = read('social-next/web/live-account.js'), api = read('social-next/api.js');
  assert.match(home, /function mountPostStyle\(form, post = \{\}\)/);
  assert.match(home, /function mountPostDetails\(form, post = \{\}\) \{\s*mountPostStyle\(form, post\);/);
  assert.match(home, /if \(form\.elements\.postFont\) details\.font = POST_FONTS\.includes/);
  assert.match(live, /upgradeFriendWall\(\$\('#friend-wall-form'\)\);/);
  assert.match(live, /'<p'\+postFontStyle\(post\.font\)\+'>'\+\(SF\?SF\.richText\(post\.text\):esc\(post\.text\)\)\+'<\/p>'/);
  assert.match(live, /SF\.sharedBox\(post\):''\)\+textVideo\(post\)/);
  assert.match(api, /const postFonts = new Set\(\['','Arial'/);
  assert.match(api, /tape && JSON\.stringify\(tape\),postFont\(b\.font\)\]\)/);
  assert.match(read('social-next/schema.sql'), /alter table social_posts add column if not exists font text not null default ''/);
  assert.match(read('social-next/index.js'), /frame-src 'self' https:\/\/www\.youtube-nocookie\.com/);
  assert.match(home, /'https:\/\/www\.youtube-nocookie\.com\/embed\/' \+ button\.dataset\.playPostVideo/);
  // the ID check that guards the embed
  const ctx = { URL }; vm.createContext(ctx); vm.runInContext(read('social-next/web/profile-extras.js').split('\n').find(l => l.startsWith('function youtubeId')), ctx);
  assert.equal(ctx.youtubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(ctx.youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3'), 'dQw4w9WgXcQ');
  assert.equal(ctx.youtubeId('https://www.youtube.com/watch?v=bad"><script>'), null);
  assert.equal(ctx.youtubeId('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
});
