'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const rooms = fs.readFileSync(path.join(__dirname, '..', 'public', 'rooms.html'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('owner-only Room menu items start hidden and carry no "(owner)" clutter', () => {
  assert.match(rooms, /<div id="mTopic" class=rz-own hidden>Change Topic\.\.\.<\/div><div id="mRIcon" class=rz-own hidden>Change Room Icon\.\.\.<\/div><div id="mRename" class=rz-own hidden>Rename Room\.\.\.<\/div>/);
  assert.doesNotMatch(rooms, /\(owner\)\.\.\./);
});

test('ownerMenus shows owner items only to this room\'s owner; masters keep Rename only', () => {
  const i = rooms.indexOf('function ownerMenus(){');
  assert.ok(i > 0);
  const src = rooms.slice(i, rooms.indexOf('\n$(\'mTopic\').onclick', i));
  const els = {}; const $ = id => (els[id] = els[id] || { hidden: true, style: {}, textContent: '' });
  const run = (owner, acct, master) => { const window = { MASTER: master }; new Function('$', 'owner', 'acct', 'window', src + '\nownerMenus();')($, owner, acct, window); return ['mTopic', 'mRIcon', 'mRename'].map(k => !els[k].hidden); };
  assert.deepStrictEqual(run('Zainy', 'zainy', false), [true, true, true]);
  assert.deepStrictEqual(run('Zainy', 'MoonPie', false), [false, false, false]);
  assert.deepStrictEqual(run(null, 'MoonPie', false), [false, false, false]);
  assert.deepStrictEqual(run('Zainy', 'razzle', true), [false, false, true]);
  assert.strictEqual(els.mRename.textContent, 'Rename Room (master)...');
  assert.deepStrictEqual(run(null, 'razzle', true), [false, false, false]);
  assert.match(rooms, /owner=h\.owner;ownerMenus\(\);/);
  assert.match(rooms, /S\.on\('roster',r=>\{ownerMenus\(\);/);
});

test('server still re-checks owner actions', () => {
  assert.match(server, /s\.on\('set-topic', \(t, cb\) => \{ if \(!isOwner\(\)\)/);
  assert.match(server, /!\(isOwner\(\) \|\| s\.data\.master\)\) return cb\(\{ error: 'Only the room owner can rename this room\.' \}\)/);
  assert.match(server, /if \(roleOf\(s, room\) !== 'owner'\) return cb\(\{ error: 'Only the room owner can change the room icon\.' \}\)/);
});

test('music bar stays visible in music rooms with voice on, not only while Talk is held', () => {
  assert.match(rooms, /function npMeSync\(\)\{const on=isMusic&&!!me&&!voff,onMic=/);
  assert.match(rooms, /if\(onMic&&npPend\)\{const d=npPend;npPend=null;S\.emit\('np:set',d/);
  assert.match(rooms, /npPend=d;add\(\{sys:1,text:'Saved/);
  assert.match(rooms, /\$\('vbtn'\)\.onclick=\(\)=>\{voff=!voff;setTimeout\(\(\)=>typeof npMeSync=='function'&&npMeSync\(\)\);/);
  assert.match(server, /isMusicRoom = r => r === musicRoom \|\| ROOMS\[r\] === 'Music'/);
});
