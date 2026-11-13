'use strict';
// "Show the room I'm in" (Nov 13, 2026): visible picker beside the status, buddies see "In <Room>", choose one of
// up to 4 current rooms or Off, fall back when that room is left, never advertise incognito windows or while Invisible.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const RS = require('../room-status');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const sock = (name, room, extra = {}) => ({ data: { name, room, ...extra } });

test('rooms listed for a name skip incognito windows and gone rooms; masters are not excluded', () => {
  const socks = [sock('Zainy', 'Lobby', { master: true }), sock('zainy', 'Music Lobby'), sock('Zainy', 'Secret', { inc: true }), sock('Bob', 'Lobby'), sock('Zainy', 'Gone'), sock('Zainy', 'Lobby')];
  assert.deepEqual(RS.roomsFor(socks, 'ZAINY', r => r !== 'Gone'), ['Lobby', 'Music Lobby']);
  assert.deepEqual(RS.roomsFor([sock('Z', 'A', { inc: true })], 'z', () => true), [], 'all incognito: nothing to advertise');
});

test('advertised room: the chosen one, else the next current room, else nothing; Off shows nothing', () => {
  assert.equal(RS.advertised(['Lobby', 'Music Lobby'], { show: true, room: 'Music Lobby' }), 'Music Lobby');
  assert.equal(RS.advertised(['Lobby'], { show: true, room: 'Music Lobby' }), 'Lobby', 'left the chosen room: fall back');
  assert.equal(RS.advertised([], { show: true, room: 'Music Lobby' }), null);
  assert.equal(RS.advertised(['Lobby'], { show: false, room: 'Lobby' }), null);
  assert.deepEqual(RS.parseChoice({ room: 'Lobby' }), { show: true, room: 'Lobby' });
  assert.deepEqual(RS.parseChoice({ room: null }), { show: false, room: undefined });
  assert.deepEqual(RS.parseChoice(true), { show: true, room: undefined });
  assert.equal(RS.parseChoice({ room: 'x'.repeat(61) }), null); assert.equal(RS.parseChoice('Lobby'), null);
});

test('server: presence uses every room window and the saved choice; Invisible advertises nothing', () => {
  const server = read('server.js'), acc = read('accounts.js');
  assert.match(server, /roomsOf: n => require\('\.\/room-status'\)\.roomsFor\(io\.sockets\.sockets\.values\(\), n, r => !!ROOMS\[r\]\)/);
  assert.match(acc, /const room = on \? roomInfo\(uid\)\.room : null;/);
  assert.match(acc, /on = online\.has\(uid\) && st && st\.status !== 'invisible'/);
  assert.match(acc, /room: RS\.advertised\(rooms, \{ show: st\.showRoom !== false, room: st\.adRoom \}\)/);
  assert.match(acc, /update users set show_room=\$2,ad_room=\$3 where id=\$1/);
  assert.match(acc, /select name,status,status_msg,avatar,show_room,ad_room from users/);
  assert.match(acc, /toUser\(uid, 'm:my-rooms', info\);/);
  assert.match(acc, /if \(!before \|\| before\.room !== info\.room\) broadcast/);
  assert.match(read('db.js'), /alter table users add column if not exists ad_room text;/);
});

test('Messenger: picker beside the status (all users, masters too), buddies see "In <Room>"', () => {
  const c = read('public/messenger-controls.js');
  assert.match(c, /pickRoom\.id = 'adRoom';/); assert.match(c, /status\.after\(pickRoom\);/);
  assert.match(c, /<option value="off" title="Don’t show buddies which room I’m in">Room: hidden<\/option>/);
  assert.match(c, /#me \.stw\{flex-wrap:wrap/, 'wraps instead of clipping in the narrow dock');
  assert.match(c, /'">In ' \+ esc\(r\) \+ '<\/option>'/);
  assert.match(c, /emit\('m:showroom', v === 'off' \? \{room: null\} : v === '\*' \? true : \{room: v\}\)/);
  assert.match(c, /pickRoom\.disabled = invisible;/);
  assert.doesNotMatch(c, /roomItem\.style\.display = me\.m \? 'none'/, 'no longer hidden for masters');
  assert.doesNotMatch(c, /!me\.m && me\.showRoom/);
  assert.match(c, /me\.room \? 'In ' \+ me\.room : ''/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const s = read(f);
    assert.equal(s.split('In ${escT(c.room)}</a>').length - 1, 2, f + ': buddy list + IM header');
    assert.match(s, /S\.on\('m:my-rooms',d=>\{if\(ME&&d\)\{ME\.rooms=d\.rooms\|\|\[\];ME\.room=d\.room;/);
  }
});
