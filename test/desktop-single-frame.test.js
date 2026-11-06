const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const yd = fs.readFileSync(path.join(root, 'public/yd.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const rooms = fs.readFileSync(path.join(root, 'public/rooms.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8');
const fix17 = fs.readFileSync(path.join(root, '_preview/17-native-chat-single-frame-fixture.html'), 'utf8');

test('desktop hides messenger fake chrome and duplicate blue room tbar', () => {
  assert.match(yd, /html\.yd #mwin>\.tbar\{display:none/);
  // Careful selector: #chat>.tbar (not body> child trap); hide duplicate of native OS title
  assert.match(yd, /html\.yd #chat>\.tbar\{display:none!important\}/);
  assert.match(rooms, /html\.yd #chat>\.tbar\{display:none!important\}/);
  // Must not rely only on body>#chat
  assert.doesNotMatch(yd, /html\.yd body>#chat>\.tbar/);
});

test('desktop keeps full rich room body under menus (rhead/log/people/voice/input)', () => {
  const need = [
    /id=["']?rhead["']?/, /id=["']?bInv["']?/, /id=["']?cam["']?/, /id=["']?vbtn["']?/,
    /id=["']?hmst["']?/, /id=["']?log["']?/, /id=["']?mem["']?/, /id=["']?bIm["']?/,
    /id=["']?bIgn["']?/, /id=["']?vrow["']?/, /id=["']?talk["']?/, /id=["']?form["']?/,
    /id=["']?msg["']?/, /id=["']?bAa["']?/, /id=["']?bSm["']?/,
    />Room</, />Edit</, />View</, />Actions</, />Help</,
  ];
  for (const re of need) assert.match(rooms, re);
  // Leave stays in Room menu; blue-bar buttons remain in HTML for browser
  assert.match(rooms, /id="mLeave">Leave Room \/ Sign Out</);
  assert.match(rooms, /id="room-popout"/);
  assert.match(rooms, /id="wx" class="room-title-action">Leave room</);
});

test('desktop removes Social site chrome (one native outer frame)', () => {
  assert.match(yd, /html\.yd #social-chat-header/);
  assert.match(yd, /html\.yd \.auth-site-header/);
  assert.match(yd, /html\.yd \.site-sidebar/);
  assert.match(yd, /html\.yd #brand/);
});

test('Master button is runtime/master-only (empty #hmst in static HTML)', () => {
  assert.match(rooms, /id=hmst><\/span>/);
  assert.match(rooms, /r\.m&&!window\.MASTER/);
  assert.match(rooms, /Master Console \(only you can see this\)/);
});

test('Electron native frame only for window controls; titles set in main.js', () => {
  assert.match(main, /frame:\s*true/);
  assert.match(main, /Menu\.setApplicationMenu\(null\)/);
  assert.match(main, /Razzle Chat/);
});

test('preview 17: no blue strip; native title → menus → rich Late Night; fictional users', () => {
  assert.match(fix17, /Preview/i);
  assert.match(fix17, /1180/);
  assert.match(fix17, /Late Night/);
  assert.match(fix17, /fictional|example|not (live|real)/i);
  assert.match(fix17, /xXmoonchildXx/);
  assert.match(fix17, /nightowl_jen/);
  assert.match(fix17, /sk8rboi_1987/);
  assert.match(fix17, /Master/);
  assert.match(fix17, /Following/);
  assert.match(fix17, /Invite/);
  assert.match(fix17, /Webcam/);
  assert.match(fix17, /Voice/);
  assert.match(fix17, /Hands Free/);
  assert.match(fix17, /orange|Send|➤/i);
  // Frame content: no blue .tbar element between ostitle and menu
  const frame = fix17.split('id="frame"')[1];
  assert.ok(frame);
  const beforeMenu = frame.split('id="menu"')[0];
  assert.doesNotMatch(beforeMenu, /class="tbar"/);
  assert.match(fix17, /Blue room-name strip removed|duplicates native OS title|#chat>\.tbar hidden/i);
  assert.match(fix17, /Leave stays under|Room menu/i);
  assert.doesNotMatch(fix17, /zainyochka@gmail\.com/);
  assert.doesNotMatch(fix17, /\bpassword\b|\btoken\b|\bsecret\b/i);
});

test('messenger signed-out gate still present', () => {
  assert.match(index, /id="mwin" class="win"/);
  assert.match(yd, /html\.yd:not\(\.yd-in\) #mwin #bAdd/);
  assert.match(yd, /classList\.toggle\('yd-in'/);
  assert.match(yd, /html\.yd #mwin>\.tbar\{display:none/);
});

test('desktop signed-out rules must not hide rooms #main (chat log + People)', () => {
  // Root cause of white blank region: html.yd:not(.yd-in) #main { display:none }
  assert.doesNotMatch(yd, /html\.yd:not\(\.yd-in\) #main,/);
  assert.match(yd, /html\.yd:not\(\.yd-in\) #mwin #main/);
  assert.match(yd, /html\.yd #chat #main\{display:flex!important/);
  assert.match(rooms, /html\.yd #chat #main\{display:flex/);
});

test('desktop hides all ad placeholders (.adph / #adRoom / #ad-slot)', () => {
  assert.match(yd, /html\.yd #adRoom/);
  assert.match(yd, /html\.yd \.adph/);
  assert.match(rooms, /html\.yd #ad-slot,html\.yd #adRoom,html\.yd \.adph/);
  // Web placeholders remain in HTML for non-desktop
  assert.match(rooms, /id=adRoom>Advertisement/);
  assert.match(index, /adph/);
});
