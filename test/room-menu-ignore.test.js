const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function roomMenu(section) {
  const rooms = read('public/rooms.html');
  const m = rooms.match(new RegExp('<div>' + section + '<div class="dd">([\\s\\S]*?)</div></div>'));
  assert.ok(m, section + ' menu should exist');
  return m[1];
}

test('Room menu keeps essentials and drops Join, Favorites, and Top Rooms', () => {
  const dd = roomMenu('Room');
  assert.match(dd, /id="mInfo">Room Info/);
  assert.match(dd, /id="mTopic"/);
  assert.match(dd, /id="mRIcon"/);
  assert.match(dd, /id="mRename"/);
  assert.match(dd, /id="mMusic"/);
  assert.match(dd, /id="mMess">Open Messenger/);
  assert.match(dd, /id="mCreate"[^>]*>Create Room/);
  assert.match(dd, /id="mLeave">Leave Room \/ Sign Out/);
  assert.doesNotMatch(dd, /mJoin|Join Room|mRooms|Favorites|Top Rooms/);
  const rooms = read('public/rooms.html');
  assert.match(rooms, /function isDeskApp\(\)\{return !!\(window\.YD\|\|\(window\.YappDesktop&&window\.YappDesktop\.isDesktop\)\)\}/);
  assert.match(rooms, /mess\.hidden=hide;mess\.style\.display=hide\?'none':''\}/);
  assert.match(rooms, /const show=!!acct&&\(!own\|\|!!window\.MASTER\);cr\.hidden=!show/);
  assert.match(rooms, /\$\('mInfo'\)\.parentNode;dd\.insertAdjacentHTML\('afterbegin','<div id=mMcon/);
  assert.doesNotMatch(rooms, /\$\('mJoin'\)/);
  assert.doesNotMatch(rooms, /\$\('mRooms'\)/);
});

test('View menu no longer lists text sizes; Actions keeps lists and tools, not people-list duplicates', () => {
  const view = roomMenu('View');
  assert.match(view, /id="mTs">Show Timestamps/);
  assert.match(view, /id="mJl"[^>]*>Show Join\/Leave Notices/);
  assert.match(view, /id="mMute">Mute Sounds/);
  assert.doesNotMatch(view, /data-fs|Small Text|Medium Text|Large Text|Text size/);
  const actions = roomMenu('Actions');
  assert.match(actions, /id="mIgnL">Ignore &amp; Blocked Lists/);
  assert.match(actions, /id="mSet">Settings \/ Privacy/);
  assert.match(actions, /id="mInvR">Invite to Room/);
  assert.match(actions, /id="mMyProf">Edit My Profile/);
  assert.match(actions, /id="mAv">Change My Avatar/);
  assert.match(actions, /id="mKick"[^>]*>Admin Console/);
  assert.match(actions, /id="mBuzz"[^>]*>Buzz Room/);
  assert.match(actions, /id="mClear">Clear Chat Window/);
  assert.doesNotMatch(actions, /mIgn"|mIm"|mAddF|mProf"|mRep"|Ignore \/ Unignore Selected|Send PM to Selected|Add Selected User as Friend|View Profile of Selected|Report Abuse/);
  const rooms = read('public/rooms.html');
  assert.match(rooms, /id="bIgn"/, 'people-list Ignore button stays');
  assert.match(rooms, /data-c=ign/, 'people-list context menu still has Ignore');
  assert.match(rooms, /data-c=im/, 'people-list context menu still has PM');
  assert.match(rooms, /data-c=add/, 'people-list context menu still has Add Friend');
  assert.match(rooms, /data-c=p>/, 'people-list context menu still has Profile');
  assert.match(rooms, /data-c=rep/, 'people-list context menu still has Report');
});

test('in-room Admin Console already lets the owner (and masters) add or remove admins', () => {
  const rooms = read('public/rooms.html');
  assert.match(rooms, /id=mAdm>Make Admin/);
  assert.match(rooms, /\$\('mAdm'\)\.textContent=t\.role=='admin'\?'Remove Admin':'Make Admin'/);
  assert.match(rooms, /doMod\(t\.role=='admin'\?'unadmin':'admin'\)/);
  assert.match(rooms, /const myRole=\(\)=>window\.MASTER\?'owner'/);
  const server = read('server.js');
  assert.match(server, /if \(x\.data\.site \|\| x\.data\.master\) return 'owner'/);
  assert.match(server, /\['admin', 'unadmin', 'ban', 'unban'\]\.includes\(action\) && me !== 'owner'/);
  assert.match(server, /const needHere = \['kick', 'dot', 'admin'\]\.includes\(action\)/);
});

test('ignore is persisted on the account, pushed to every open socket, and kept for guests on this device', () => {
  const server = read('server.js');
  assert.match(server, /insert into ignores\(owner,name_lc\) values\(\$1,\$2\) on conflict do nothing/);
  assert.match(server, /delete from ignores where owner=\$1 and name_lc=\$2/);
  assert.match(server, /select name_lc from ignores where owner=\$1/);
  assert.match(server, /const sameSib = x =>/);
  assert.match(server, /x\.data\.acct\?\.id === s\.data\.acct\.id/);
  assert.match(server, /x\.data\.name\.toLowerCase\(\) === s\.data\.name\.toLowerCase\(\)/);
  assert.match(server, /x\.emit\('prefs:update', payload\)/);
  assert.match(server, /await pushPrefs\(\)/);
  assert.equal((server.match(/await pushPrefs\(\)/g) || []).length, 3, 'ign:set, blk:set, and priv:set all notify siblings');
  const settings = read('public/settings.js');
  assert.match(settings, /S\.on\('prefs:update',applyRemote\)/);
  assert.match(settings, /const GKEY='ycIgnore'/);
  assert.match(settings, /BroadcastChannel\('yc-ignore'\)/);
  assert.match(settings, /async function replayGuestIgn/);
  assert.match(settings, /Guests: saved on this device until you unignore them/);
  assert.doesNotMatch(settings, /this session only/);
  const accounts = read('accounts.js');
  assert.match(accounts, /select 1 from ignores where owner=\$1 and name_lc=\$2', \[t\.id, me\.toLowerCase\(\)\]/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    assert.match(read(f), /if\(window\.YSet&&YSet\.hidden\(message\.from\)\)return;/);
    assert.match(read(f), /settings\.js\?v=8/);
  }
  assert.match(read('public/rooms.html'), /settings\.js\?v=8/);
});

test('sameSib matches every window of an account or guest name so unignore is global', () => {
  const sameSib = (s, x) => {
    if (x === s) return false;
    if (s.data.acct) return x.data.acct?.id === s.data.acct.id;
    return !!(!x.data.acct && s.data.name && x.data.name && x.data.name.toLowerCase() === s.data.name.toLowerCase());
  };
  const acct = { data: { acct: { id: 7 }, name: 'Ada' } };
  const room = { data: { acct: { id: 7 }, name: 'Ada', room: 'Lobby' } };
  const messenger = { data: { acct: { id: 7 }, name: 'Ada' } };
  const other = { data: { acct: { id: 8 }, name: 'Bob' } };
  const guestA = { data: { name: 'Guest_One' } };
  const guestB = { data: { name: 'guest_one' } };
  const guestOther = { data: { name: 'Guest_Two' } };
  const guestSignedIn = { data: { acct: { id: 9 }, name: 'Guest_One' } };
  assert.equal(sameSib(acct, acct), false);
  assert.equal(sameSib(acct, room), true);
  assert.equal(sameSib(acct, messenger), true);
  assert.equal(sameSib(acct, other), false);
  assert.equal(sameSib(guestA, guestB), true, 'guest ignore follows the screen name across windows');
  assert.equal(sameSib(guestA, guestOther), false);
  assert.equal(sameSib(guestA, guestSignedIn), false, 'a signed-in account is not a guest sibling');
});

test('guest ignore lists persist in localStorage and merge into prefs until unignored', () => {
  const settings = read('public/settings.js');
  const start = settings.indexOf("const GKEY='ycIgnore'");
  const end = settings.indexOf('async function refresh()');
  assert.ok(start >= 0 && end > start);
  const store = {};
  const sandbox = {
    localStorage: {
      getItem: k => Object.hasOwn(store, k) ? store[k] : null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    BroadcastChannel: function () { this.postMessage = () => {}; },
    addEventListener() {},
    Object, Set, JSON, String
  };
  vm.createContext(sandbox);
  vm.runInContext(settings.slice(start, end) + '\nthis.out={GKEY,loadGuestIgn,saveGuestIgn,mergeGuestIgn};', sandbox, { filename: 'settings.js' });
  const { loadGuestIgn, saveGuestIgn, mergeGuestIgn, GKEY } = sandbox.out;
  assert.equal(GKEY, 'ycIgnore');
  assert.deepEqual(loadGuestIgn(), []);
  saveGuestIgn(['Neil_ufo', 'ADA', 'ada', '']);
  assert.deepEqual(loadGuestIgn(), ['neil_ufo', 'ada']);
  const merged = mergeGuestIgn({ account: false, ignored: ['bob'], hide: ['bob'], blocked: [] });
  assert.equal(JSON.stringify([...merged.ignored].sort()), JSON.stringify(['ada', 'bob', 'neil_ufo']));
  assert.ok(merged.hide.includes('ada') && merged.hide.includes('neil_ufo') && merged.hide.includes('bob'));
  const account = mergeGuestIgn({ account: true, ignored: ['zoe'], hide: ['zoe'] });
  assert.equal(JSON.stringify(account.ignored), JSON.stringify(['zoe']), 'signed-in prefs stay on the account, not the guest device list');
  saveGuestIgn(['bob']);
  assert.deepEqual(loadGuestIgn(), ['bob'], 'unignore anywhere can shrink the stored guest list');
});
