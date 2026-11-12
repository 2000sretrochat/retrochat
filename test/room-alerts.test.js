'use strict';
// Opt-in room alerts: live-cam alerts reach only friends of the broadcaster or followers of the room.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const { shouldAlert, FRIENDS_SQL } = require('../room-alerts');
const amy = { id: 7, name: 'Amy' }, stranger = { id: 9, name: 'Stranger' };

test('webcam alerts go to the broadcaster\'s friends or followers of the room, not every opted-in member', () => {
  const friends = new Set(['7']), followers = new Set(['fan']);
  assert.equal(shouldAlert('webcam', amy, { friends, followers }), true, 'friend');
  assert.equal(shouldAlert('webcam', { id: 8, name: 'Fan' }, { friends, followers }), true, 'room follower (case-insensitive)');
  assert.equal(shouldAlert('webcam', stranger, { friends, followers }), false, 'opted-in stranger gets nothing');
  assert.equal(shouldAlert('webcam', stranger, {}), false, 'no friends or followers: nobody');
});

test('webcam alerts still skip blocked/ignored people and the broadcaster\'s cam-block list, even for friends', () => {
  const friends = new Set(['7']), followers = new Set(['amy']);
  assert.equal(shouldAlert('webcam', amy, { friends, followers, excluded: new Set(['7']) }), false, 'block or ignore either way');
  assert.equal(shouldAlert('webcam', amy, { friends, followers, camBlock: new Set(['amy']) }), false, 'cam-blocked viewer');
});

test('room-activity alerts stay followers-only (friendship alone is not enough)', () => {
  assert.equal(shouldAlert('room', amy, { followers: new Set(['amy']) }), true);
  assert.equal(shouldAlert('room', amy, { friends: new Set(['7']) }), false);
});

test('friends are mutual contacts and never the broadcaster\'s own self entry', () => {
  assert.match(FRIENDS_SQL, /join contacts r on r\.owner=c\.contact and r\.contact=c\.owner/);
  assert.match(FRIENDS_SQL, /where c\.contact=\$1 and c\.owner<>c\.contact/);
});

test('server.js uses the shared rule and keeps the opt-in, adult-room, kicked and invisible checks', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const fn = src.slice(src.indexOf('async function notifyRoomActivity'), src.indexOf('function roomActivity('));
  assert.match(fn, /ROOM_ALERTS\.shouldAlert\(kind, \{ id, name \}, \{ followers, friends, excluded, camBlock: source\.data\.camBlock \}\)/);
  assert.match(fn, /db\.q\(ROOM_ALERTS\.FRIENDS_SQL, \[actor\.id\]\)/);
  assert.match(fn, /socket\.data\.roomAlerts\?\.\[kind\]/);
  assert.match(fn, /\(!adultR\(room\) \|\| socket\.data\.adult \|\| socket\.data\.master\)/);
  assert.match(fn, /!kickedLeft\(room, socket\.data\.acct\.name\)/);
  assert.match(fn, /acc\.presenceRaw\(actor\.id\)\.status !== 'invisible'/);
  assert.match(fn, /select owner as id from ignores where name_lc=\$2/);
  assert.doesNotMatch(fn, /webcam \? excluded\.has/);
});
