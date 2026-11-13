const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('live app must not link Social to ChatGPT preview / demo host', () => {
  for (const f of ['public/index.html', 'public/rooms.html', 'public/reset.html']) {
    const s = read(f);
    assert.doesNotMatch(s, /chatgpt\.site/);
    assert.doesNotMatch(s, /social-chat-preview/);
    assert.match(s, /href="\/social(-next)?\/"/); // Social links point at the live Social app (/social-next/ since Nov 11)
  }
});

test('post-signin socialDestination returns to same-origin /social/', () => {
  const s = read('public/index.html');
  assert.match(s, /socialDestination\s*=\s*\{\s*'1':\s*'\/social\/'/);
  assert.match(s, /pages:\s*'\/social\/'/);
});

test('social bootstrap requires real /api/me name before loading preview scripts', () => {
  const s = read('public/social/bootstrap.js');
  assert.match(s, /fetch\('\/api\/me'/);
  assert.match(s, /credentials:\s*'same-origin'/);
  assert.match(s, /if\s*\(!me\s*\|\|\s*!me\.name\)/);
  assert.match(s, /location\.replace\(\s*(next|'\/\?chat=1&social=1')/);
  assert.match(s, /LIVE_AUTH\s*=\s*true/);
  assert.doesNotMatch(s, /currentAlias\s*=\s*me\.name\s*\|\|\s*'Guest'/);
});

test('GH social-sign-in success redirects to /social/ not account stub only', () => {
  assert.match(read('accounts.js'), /code === 200 \? '\/social\/'/);
});

test('live.js clears synthetic seed feed when LIVE_AUTH', () => {
  const s = read('public/social/live.js');
  assert.match(s, /LIVE_AUTH/);
  assert.match(s, /seeds\.splice\(0,\s*seeds\.length\)/);
  assert.doesNotMatch(s, /SOCIAL PREVIEW · LIVE MESSENGER/);
  assert.doesNotMatch(s, /INTERACTIVE CONCEPT/);
});
