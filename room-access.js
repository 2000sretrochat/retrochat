'use strict';
// Owner requests (Nov 13, 2026):
// - Member-created rooms only OPEN when their owner, one of their admins, or a master walks in. Once open, anyone may join,
//   and the room stays open as long as anyone is still inside (even after the owner/admins leave).
// - A screen name may be in up to MAX_ROOMS rooms at once (one window/tab per room). Joining never force-leaves another room.
const MAX_ROOMS = 4;

function canOpenRoom({ uroom, admins, nameLc, acct, master, site }) {
  if (!uroom) return true; // built-in rooms are always open
  if (master || site) return true;
  if (!acct) return false;
  const lc = String(nameLc || '').toLowerCase();
  return uroom.ownerLc === lc || !!(admins && admins.has(lc));
}
const closedRoomError = room => room + ' is closed right now. It opens when its owner or one of its admins is in the room.';
const roomsFullError = () => 'You are already in ' + MAX_ROOMS + ' rooms. Please leave one of them first, then join this room.';

// existing: this screen name's other live room connections [{ id, room, mine }]; mine = same account/computer.
// Returns { ok } | { replace: id } (same room re-opened: hand over that connection) | { error, full? }.
function multiRoomDecision(existing, room, { inUseError = 'That screen name is in use right now. Try another.' } = {}) {
  const list = (existing || []).filter(Boolean);
  if (list.some(x => !x.mine)) return { error: inUseError };
  const same = list.find(x => x.room === room);
  if (same) return { replace: same.id };
  if (list.length >= MAX_ROOMS) return { error: roomsFullError(), full: true };
  return { ok: true };
}

module.exports = { MAX_ROOMS, canOpenRoom, closedRoomError, roomsFullError, multiRoomDecision };
