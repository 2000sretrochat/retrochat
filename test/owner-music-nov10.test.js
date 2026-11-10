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
  assert.match(server, /const musicDefault = r => r === musicRoom \|\| ROOMS\[r\] === 'Music';/);
});

test('music sharing is a per-room owner setting (default on in music rooms, off elsewhere), saved and broadcast', () => {
  const db = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const master = fs.readFileSync(path.join(__dirname, '..', 'master.js'), 'utf8');
  assert.match(db, /alter table room_meta add column if not exists music boolean;/);
  assert.match(master, /select room,rating,mics,hq,mtimer,mann,music from room_meta/);
  assert.match(master, /const saveMusic = \(room, on\) => q\('insert into room_meta\(room,music\) values\(\$1,\$2\) on conflict\(room\) do update set music=\$2'/);
  const m = server.match(/const MUSICON = \{\}; const musicDefault = (r => [^;]+);\r?\nconst isMusicRoom = (r => [^,]+), NPLAST/);
  assert.ok(m);
  const ROOMS = { 'Music Lobby': 'Music', 'Moon Base Radio': 'Music', Lobby: 'Chat' }, musicRoom = 'Music Lobby', MUSICON = {};
  const musicDefault = eval(m[1]); const isMusicRoom = eval(m[2]);
  assert.deepStrictEqual(['Music Lobby', 'Moon Base Radio', 'Lobby', ''].map(isMusicRoom), [true, true, false, false]);
  MUSICON.Lobby = true; MUSICON['Moon Base Radio'] = false;
  assert.deepStrictEqual(['Lobby', 'Moon Base Radio'].map(isMusicRoom), [true, false]);
  assert.match(server, /s\.on\('room:music', \(on, cb\) => \{[^\n]*\r?\n\s*if \(!room \|\| !UROOMS\.has\(room\) \|\| !isOwner\(\)\) return cb\(\{ error: 'Only the room owner can change music sharing\.' \}\);/);
  assert.match(server, /io\.to\(room\)\.emit\('room:music', \{ room, on \}\)/);
  assert.match(server, /s\.data\.music = !!on && isMusicRoom\(s\.data\.room\)/);
  assert.match(server, /return cb\(\{ error: 'Music sharing is off in this room\.' \}\)/);
  assert.match(server, /QUEUE, MANN, ANN, MUSICON\]\)/);
  assert.match(rooms, /<div id="mMusic" class=rz-own hidden/);
  assert.match(rooms, /mMusic:own\}/);
  assert.match(rooms, /S\.on\('room:music',d=>\{if\(!d\|\|d\.room!=room\)return;isMusic=!!d\.on;/);
});
