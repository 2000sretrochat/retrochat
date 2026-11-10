// Chat room invitations: pending store with expiry, plus rate limits.
// Rejecting an invite never notifies the inviter; it just disappears.
const TTL = 120e3, MAX_BATCH = 20, BATCHES_PER_MIN = 4, PAIR_COOLDOWN = 30e3;
function createRoomInvites({ now = () => Date.now(), ttl = TTL, uuid = () => require('node:crypto').randomUUID() } = {}) {
  const pending = new Map(), batches = new Map(), pairs = new Map();
  function sweep() {
    const t = now();
    for (const [id, inv] of pending) if (inv.expires <= t) pending.delete(id);
    for (const [k, until] of pairs) if (until <= t) pairs.delete(k);
    for (const [k, list] of batches) { const keep = list.filter(x => t - x < 60e3); if (keep.length) batches.set(k, keep); else batches.delete(k); }
  }
  // One click on "Invite" = one batch. Returns an error string when the sender is going too fast.
  function takeBatch(fromLc, master) {
    sweep(); if (master) return null;
    const list = batches.get(fromLc) || [];
    if (list.length >= BATCHES_PER_MIN) return 'You are sending invites too fast. Please wait a minute.';
    list.push(now()); batches.set(fromLc, list); return null;
  }
  const pairKey = (a, b) => String(a).toLowerCase() + '>' + String(b).toLowerCase();
  const coolingDown = (from, to) => (pairs.get(pairKey(from, to)) || 0) > now();
  function create({ from, fromId, toId, toName, room, rating }) {
    sweep();
    const inv = { id: uuid(), from, fromId, toId, toName, room, rating, expires: now() + ttl };
    pending.set(inv.id, inv); pairs.set(pairKey(from, toName), now() + PAIR_COOLDOWN);
    return { id: inv.id, from, room, rating, expires: inv.expires, ttl };
  }
  // Accept returns the room to join; reject just removes it. Only the invitee may answer.
  function answer(toId, id, accept) {
    const inv = pending.get(id);
    if (!inv || inv.toId !== toId) return accept ? { error: 'This invitation has expired.' } : { ok: true };
    pending.delete(id);
    if (inv.expires <= now()) return accept ? { error: 'This invitation has expired.' } : { ok: true };
    return accept ? { ok: true, room: inv.room, from: inv.from } : { ok: true };
  }
  return { takeBatch, coolingDown, create, answer, size: () => (sweep(), pending.size) };
}
const cleanNames = list => { const seen = new Map();
  for (const n of Array.isArray(list) ? list : [list]) if (typeof n === 'string' && n.trim()) { const k = n.trim().toLowerCase().slice(0, 40); if (!seen.has(k)) seen.set(k, n.trim().slice(0, 40)); }
  return [...seen.values()]; };
module.exports = { createRoomInvites, cleanNames, TTL, MAX_BATCH, BATCHES_PER_MIN, PAIR_COOLDOWN };
