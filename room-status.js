'use strict';
// "Display Room I'm In": which room a Messenger user advertises to buddies (shown as "In <Room>").
// With up to 4 rooms open, the user picks one of the rooms they are in, or Off. If the picked room is left,
// the next current room is advertised instead (or nothing when no rooms are open). Incognito room windows are never
// listed, and Invisible users advertise nothing (accounts.js pres()).
const ROOM_MAX = 60;
// Rooms this screen name is in, in a stable order, skipping incognito windows and rooms that no longer exist.
function roomsFor(sockets, name, roomExists) {
  const lc = String(name || '').toLowerCase(), out = [];
  for (const x of sockets) {
    const d = x && x.data; if (!d || !d.name || d.name.toLowerCase() !== lc || !d.room || d.inc) continue;
    if (roomExists(d.room) && !out.includes(d.room)) out.push(d.room);
  }
  return out;
}
function advertised(rooms, pref) {
  if (!pref || pref.show === false) return null;
  if (pref.room && rooms.includes(pref.room)) return pref.room;
  return rooms[0] || null;
}
// m:showroom payload: true/false (old clients) or { room: 'Name' | null }.
function parseChoice(v) {
  if (typeof v === 'boolean') return { show: v, room: undefined };
  if (v && typeof v === 'object') {
    if (v.room === null || v.room === '' || v.room === false) return { show: false, room: undefined };
    if (typeof v.room === 'string' && v.room.length <= ROOM_MAX) return { show: true, room: v.room };
  }
  return null;
}
module.exports = { roomsFor, advertised, parseChoice };
