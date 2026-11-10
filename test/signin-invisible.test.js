const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('sign-in screens have "Sign in as invisible" right under the remember / save-password row', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.match(s, /id="iRem"> Remember me<\/label><\/div>\s*<div class="row" id="iInvRow"><label style="font-weight:normal"><input type="checkbox" id="iInv"> Sign in as invisible<\/label><\/div>/, f);
    // presence is set after a successful sign-in and before Messenger connects
    assert.match(s, /if\(r\.error\)return \$\('eIn'\)\.textContent=r\.error;(if\(!isRoomSignIn\))?await api\('\/api\/signin-presence',\{invisible:\$\('iInv'\)\.checked\}\)\.catch\(\(\)=>\{\}\);\$\('iPw'\)\.value='';start\(\)/, f);
  }
  assert.match(read('public/index.html'), /\.room-signin #iInvRow \{ display: none !important; \}/);
});

test('desktop remembers the invisible choice per name and passes it through', () => {
  assert.match(read('public/desktop-signin.js'), /inv\.checked = !!\(e && e\.invisible\)/);
  assert.match(read('public/desktop-signin.js'), /invisible: !!\(inv && inv\.checked\)/);
  assert.match(read('desktop/preload.js'), /invisible: typeof o\?\.invisible === 'boolean'/);
  assert.match(read('desktop/main.js'), /invisible: typeof o\.invisible === 'boolean' \? o\.invisible : undefined/);
});

test('server: invisible users look offline to everyone but masters/admin', () => {
  const a = read('accounts.js');
  assert.match(a, /app\.post\('\/api\/signin-presence'/);
  assert.match(a, /presFn = hooks\.presence = uid => online\.has\(uid\) && !hiddenUid\(uid\)/);
  assert.match(a, /isOnlineFn = n => \{ const id = hooks\.onlineName\(n\); return !!id && !hiddenUid\(id\); \}/);
  assert.match(a, /createOfflineMessages\(\{ db, isOnline: n => isOnlineFn\(n\)/);
  assert.match(a, /return \{ok:true,offline:offline\|\|hidden/);
  assert.match(a, /if \(!online\.has\(t\.id\) \|\| hiddenUid\(t\.id\)\) return \{ error: esc\(t\.name\) \+ ' is offline\.' \}/);
  assert.match(read('master.js'), /acc\.presenceRaw/);
  assert.match(read('server.js'), /acc\.isConnected\(name\)/); // guest name collision still sees the real connection
});
