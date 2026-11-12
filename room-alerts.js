'use strict';
// Who may receive an opt-in room alert (server.js notifyRoomActivity). Room activity: followers of that room only.
// Live webcam: friends of the broadcaster or followers of that room, never anyone either side blocked or ignored,
// and never anyone on the broadcaster's cam-block list. Opt-in, adult-room and kicked checks stay in server.js.
const FRIENDS_SQL = 'select c.owner from contacts c join contacts r on r.owner=c.contact and r.contact=c.owner where c.contact=$1 and c.owner<>c.contact';
function shouldAlert(kind, recipient, { followers = new Set(), friends = new Set(), excluded = new Set(), camBlock = null } = {}) {
  const lc = String(recipient.name || '').toLowerCase();
  if (kind !== 'webcam') return followers.has(lc);
  if (excluded.has(String(recipient.id)) || camBlock?.has(lc)) return false;
  return friends.has(String(recipient.id)) || followers.has(lc);
}
module.exports = { shouldAlert, FRIENDS_SQL };
