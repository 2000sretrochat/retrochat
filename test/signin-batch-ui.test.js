'use strict';
// Nov 12 sign-in batch: password eye, bell tooltip, grayed menu bar while signed out, rooms open at the newest message.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const PAGES = ['public/index.html', 'public/social/messenger.html'];

test('every sign-in / sign-up / reset page loads the show-password toggle', () => {
  for (const f of [...PAGES, 'public/reset.html', 'docs/index.html', 'social-next/web/index.html'])
    assert.match(R(f), /<script src="\/password-toggle\.js" defer><\/script>/, f);
  const js = R('public/password-toggle.js');
  assert.match(js, /input\[type=password\]/);
  assert.match(js, /btn\.setAttribute\('aria-label', shown \? 'Hide password' : 'Show password'\)/);
  assert.match(js, /btn\.setAttribute\('aria-pressed', String\(shown\)\)/);
  assert.match(js, /input\.type = shown \? 'text' : 'password'/);
  assert.match(js, /if \(input\.value === SAVED\) return;/, 'the desktop saved-password placeholder is never revealed');
  assert.match(js, /#mwin #fIn>\.pw-field\{max-width:320px;align-self:center\}/, 'keeps the Messenger field width');
  for (const f of PAGES) assert.match(R(f), /menuSignedIn\(true\);window\.RazzlePasswordToggle\?\.hide\(\);/, f + ': hidden again after signing in');
});

test('the Messenger bell says "Show Notifications" on hover and to screen readers', () => {
  const js = R('public/messenger-inbox.js');
  assert.match(js, /bell\.setAttribute\('aria-label', 'Show Notifications'\);\s*bell\.title = 'Show Notifications';/);
  assert.match(js, /bell\.title = count \? 'Show Notifications \('\+count\+' unread\)' : 'Show Notifications';/);
});

test('the Messenger menu bar is grayed out and inert until signed in, and again on sign-out', () => {
  for (const f of PAGES) {
    const h = R(f);
    assert.match(h, /<div id="menu" class="signed-out" aria-disabled="true" inert>/, f);
    assert.match(h, /function menuSignedIn\(on\) \{\r?\n const menu=\$\('menu'\);if\(!menu\)return;\r?\n menu\.classList\.toggle\('signed-out',!on\);menu\.inert=!on;/, f);
    assert.match(h, /function showSigningOut\(\) \{\r?\n menuSignedIn\(false\);/, f);
    assert.match(h, /\$\('signin'\)\.style\.display='none';\$\('main'\)\.style\.display='flex';menuSignedIn\(true\);/, f);
    assert.match(h, /messenger-layout\.css\?v=7/, f);
  }
  assert.match(R('public/messenger-layout.css'), /#mwin #menu\.signed-out > \* \{opacity:\.45;filter:grayscale\(1\);pointer-events:none;cursor:default\}/);
});

test('entering a room scrolls to the newest message and keeps it there while images load', () => {
  const h = R('public/rooms.html');
  assert.match(h, /\$\('log'\)\.innerHTML='';h\.msgs\.forEach\(add\);pinLogBottom\(\)\}\);/);
  assert.match(h, /function pinLogBottom\(ms=5000\)\{/);
  assert.match(h, /for\(const e of \['wheel','touchstart','pointerdown','keydown'\]\)L\.addEventListener\(e,stop/, 'stops when the person scrolls');
  assert.match(h, /if\(!img\.complete\)img\.addEventListener\('load',pin,\{once:true\}\)/);
});

test('Master Console can lift a sign-in lock', () => {
  const m = R('master.js'), h = R('master.html');
  assert.match(m, /else if \(action === 'unlock'\) await q\('delete from login_guard where key=\$1', \['n:' \+ u\.name\.toLowerCase\(\)\]\);/);
  assert.match(m, /d\.locked = \(await q\("select u\.name from login_guard g join users u on g\.key='n:'\|\|u\.name_lc where g\.locked"\)/);
  assert.match(h, /\(d\.locked\|\|\[\]\)\.includes\(a\.name\)\?\[\['unlock','Unlock sign-in'\]\]:\[\]/);
  assert.match(R('reset.js'), /delete from login_guard where key=\(select 'n:'\|\|name_lc from users where id=\$1\)/, 'a password reset lifts the lock');
  assert.match(R('db.js'), /create table if not exists login_guard\(key text primary key/);
});
