'use strict';
// Rooms batch (Nov 10): one room per screen name + Edit, tab highlight in popped-out Browse, Raise Hand needs a live mic,
// right-panel Ignore/Block toggles, share-your-own-music + "now playing", cam size, room fills the desktop window,
// status dropdown without bullets, footer logo link, Messenger bell (Social section, clamp, unread fill, shake + chime).
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const server = R('server.js'), rooms = R('public/rooms.html'), idx = R('public/index.html'), msg = R('public/social/messenger.html');
const inbox = R('public/messenger-inbox.js'), inboxCss = R('public/messenger-inbox.css'), r137 = R('public/room137.css'), music = R('public/room-music.js');

test('one room per member (masters exempt) and edit-room validates through the shared rename helper', () => {
  assert.match(server, /MAXU = 1;/);
  assert.match(server, /!s\.data\.master && mineR\.length >= MAXU/);
  assert.match(server, /s\.on\('edit-room'/);
  assert.match(server, /async function renameURoom\(old, nn\)[\s\S]{0,400}roomNameError\(name\)/);
  assert.match(server, /s\.on\('rename-room'[\s\S]{0,300}renameURoom\(old, nn\)/);
  assert.match(server, /Mic limit must be 1 to 5/);
});

test('My Rooms: Edit on my room, Create hidden once I own one (web + desktop Messenger + room lobby)', () => {
  for (const h of [idx, msg]) {
    assert.match(h, /rooms\.html\?edit=/);
    assert.match(h, /\$\('brC'\)\.style\.display=own&&!\(ME&&ME\.m\)\?'none':''/);
  }
  assert.match(rooms, /function editRoom\(name\)/);
  assert.match(rooms, /get\('edit'\)/);
  assert.match(rooms, /if\(ownedRoom\(\)&&!window\.MASTER\)return editRoom/);
});

test('browse tabs toggle their own siblings (works when Browse is popped out on desktop)', () => {
  for (const h of [idx, msg]) {
    assert.doesNotMatch(h, /document\.querySelectorAll\('#brw \.tabs div'\)\.forEach\(x=>/);
    assert.match(h, /t\.parentNode\.querySelectorAll\('div'\)\.forEach\(x=>x\.classList\.toggle\('on',x==t\)\)/);
  }
});

test('Raise Hand connects the mic first (server needs voice on)', () => {
  assert.match(rooms, /\$\('hand'\)\.onclick=async\(\)=>\{const up=MQ\.q\.indexOf\(me\)<0;if\(up&&voff\)[\s\S]{0,140}if\(up&&!\(await getMic\(\)\)\)return;/);
});

test('right panel: PM/Report buttons gone, Ignore/Block mirror the selected person', () => {
  assert.doesNotMatch(rooms, /id="bIm"|id="bReport"/);
  assert.match(rooms, /function mbtnSync\(\)/);
  assert.match(rooms, /Un<u>i<\/u>gnore/);
  assert.match(rooms, /'Unblock':'Block'/);
  assert.match(rooms, /data-c=rep>[\s\S]{0,40}Report/); // still in the right-click menu
});

test('music rooms: share your own audio + now playing; House DJs dormant', () => {
  assert.match(server, /const HOUSE_DJS = process\.env\.HOUSE_DJS === '1'/);
  assert.match(server, /occupied:\(\)=>HOUSE_DJS &&/);
  assert.match(server, /s\.on\('np:set'[\s\S]{0,300}isMusicRoom\(room\)[\s\S]{0,200}s\.data\.talk/);
  assert.match(server, /slice\(0, 60\)/);
  assert.match(server, /function npList\(room\)[\s\S]{0,120}!x\.data\.talk\) x\.data\.np = null/);
  assert.match(rooms, /id=npSrc/);
  assert.match(rooms, /is playing &ldquo;/);
  assert.match(music, /panel\.hidden=!\(window\.RZ_HOUSE_DJS&&/);
});

test('cams: own-cam viewer list no longer dims the video; 3 cam sizes persisted', () => {
  assert.match(rooms, /\.tile \.camvw\{bottom:auto!important;max-height:45%!important/);
  assert.match(rooms, /id="camLess"[\s\S]{0,700}id="camMore"/);
  assert.match(rooms, /localStorage\.rzCamSize/);
  assert.match(rooms, /#camstrip\.cs3 \.tile video\{height:285px\}/);
});

test('desktop room window fills the window (no Social sidebar offset)', () => {
  assert.match(r137, /html\.yd body\.chat-room-active #chat\[style\*="flex"\][^{]*\{ inset: 0 !important;/);
});

test('footer logo: one homepage constant, desktop opens it in the default browser', () => {
  assert.match(R('public/site-links.js'), /window\.RAZZLE_HOME_URL = 'https:\/\/retrochat-izzg\.onrender\.com\/'/);
  assert.match(R('desktop/preload.js'), /openExternal: u => ipcRenderer\.send\('yc-open-external'/);
  assert.match(R('desktop/main.js'), /ipcMain\.on\('yc-open-external'[\s\S]{0,120}x\.protocol === 'https:'\) shell\.openExternal/);
});
test('status dropdown has no bullet characters; footer logo is a homepage link', () => {
  for (const h of [idx, msg]) {
    assert.doesNotMatch(h, /<option value="(available|busy|away|brb|invisible)">&#96(79|75);/);
    assert.match(h, /id="footBrand" data-home-link href="\/" target="_blank" rel="noopener noreferrer"/);
    assert.match(h, /<script src="\/site-links\.js"><\/script>/);
  }
});

test('Messenger bell: Social section, stays inside the window, unread fill, shake + throttled chime', () => {
  assert.match(inbox, /section\('Social'/);
  assert.match(inbox, /\/social-next\/api\/notifications/);
  assert.match(inbox, /\/social-next\/api\/notifications\/read/);
  assert.match(inbox, /panel\.style\.left = Math\.max\(12, Math\.min\(bounds\.right - w, innerWidth - w - 12\)\)/);
  assert.match(inbox, /classList\.toggle\('has-unread'/);
  assert.match(inbox, /now - lastChime < 4000/);
  assert.match(inbox, /ycNotifSound === 'off'/);
  assert.match(inbox, /st\.value === 'busy'/);
  assert.match(inboxCss, /#FF9900/);
  assert.match(inboxCss, /prefers-reduced-motion:reduce/);
  assert.match(R('public/settings.js'), /id=ysNsnd/);
});
