'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const geo = require('../geo');

const root = path.join(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function fakeIo(sockets) {
  return { sockets: { sockets: new Map(sockets.map((s, i) => [s.id || 's' + i, s])) } };
}

test('listOnlineGuests uses live guest sockets, not the in-memory log map', async () => {
  const io = fakeIo([
    { id: 'a', data: { guest: true, name: 'champ', room: 'Current Events', ip: '10.0.0.11' } },
    { id: 'b', data: { guest: true, name: 'ozyozy', room: 'Current Events', ip: '10.0.0.12' } },
    { id: 'c', data: { acct: { id: 1 }, name: 'zainy', room: 'Current Events', ip: '10.0.0.13' } },
    { id: 'd', data: { guest: true, ip: '10.0.0.14' } }, // no name yet (lobby page)
    { id: 'e', data: { guest: true, name: 'champ', mess: true, ip: '10.0.0.11' } }
  ]);
  const guests = await geo.listOnlineGuests(io);
  assert.deepEqual(guests.map(g => g.name), ['champ', 'ozyozy']);
  const champ = guests.find(g => g.name === 'champ');
  const ozy = guests.find(g => g.name === 'ozyozy');
  assert.equal(champ.ip, '10.0.0.11');
  assert.ok(champ.rooms.includes('Current Events') && champ.rooms.includes('Messenger'), champ.room);
  assert.match(champ.room, /Current Events/);
  assert.match(champ.room, /Messenger/);
  assert.equal(ozy.room, 'Current Events');
  assert.equal(ozy.ip, '10.0.0.12');
  assert.equal(ozy.loc, 'Local/private network');
  assert.equal(guests.length, 2, 'accounts and nameless sockets stay out of Online guests');
});

test('guestPlace is the room, otherwise Messenger, otherwise lobby', () => {
  assert.equal(geo.guestPlace({ data: { room: 'Current Events', mess: true } }), 'Current Events');
  assert.equal(geo.guestPlace({ data: { mess: true } }), 'Messenger');
  assert.equal(geo.guestPlace({ data: { guest: true, name: 'ada' } }), 'lobby');
});

test('mstStamp formats times in America/Phoenix (MST, no daylight saving)', () => {
  const stamp = geo.mstStamp('2026-11-13T12:25:00Z');
  assert.match(stamp, /11\/13\/2026/);
  assert.match(stamp, /5:25/);
  assert.match(stamp, /AM/);
  assert.match(stamp, /MST$/);
});

test('Master Console Users lists live guests with Ban IP and a Past guests log in MST', () => {
  const html = read('master.html');
  const js = read('master.js');
  const geoSrc = read('geo.js');
  const server = read('server.js');
  const db = read('db.js');
  assert.match(html, /<b>Online guests:<\/b> \$\{d\.guests\.map/);
  assert.match(html, /Ban IP/);
  assert.match(html, /g\.room/);
  assert.match(html, /<b>Past guests<\/b>/);
  assert.match(html, /last 500, newest first; times in MST/);
  assert.match(html, /d\.guestLog/);
  assert.match(html, /timeZone:'America\/Phoenix'/);
  assert.match(html, /Time \(MST\)/);
  assert.match(js, /d\.guests = await geo\.listOnlineGuests\(io\)/);
  assert.doesNotMatch(js, /d\.guests\.forEach\(g => g\.room = sockOf/);
  assert.match(geoSrc, /function listOnlineGuests\(io\)/);
  assert.match(geoSrc, /if \(!s \|\| !s\.data \|\| !s\.data\.guest \|\| !s\.data\.name\) continue/);
  assert.match(geoSrc, /insert into guest_log\(name,ip,loc,room\)/);
  assert.match(db, /alter table guest_log add column if not exists room text/);
  assert.match(server, /if \(s\.data\.guest\) geo\.recordGuest\(s\.data\.name, s\.data\.ip \|\| geo\.clientIp\(s\.handshake\.headers, s\.handshake\.address\), room\)/);
  assert.match(server, /if \(s\.data\.acct\) geo\.recordAccount\(s\.data\.acct\.id, ip, 'room'\)/);
});
