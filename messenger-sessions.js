'use strict';
// UI clients are a session category only; authentication and contact checks
// remain in accounts.js. One Social dock and one normal messenger may coexist.
const clientKind = s => s.handshake?.auth?.client === 'social' ? 'social' : 'messenger';
const replacedSessions = (s, sessions) => [...sessions].filter(x => x !== s && x.data.mess && (x.data.messClient || 'messenger') === clientKind(s));
class CallRoutes {
  constructor(now = Date.now) { this.calls = new Map(); this.now = now; }
  key(a, b) { return [String(a), String(b)].sort().join(':'); }
  start(from, uid, targetUid, sessions) {
    const key = this.key(uid, targetUid), old = this.calls.get(key);
    if (old && this.now() - old.at < (old.accepted ? 7200000 : 90000)) return { error: 'A call is already active between you.' };
    if (old) { old.from.emit('m:hang', { from: old.toName }); old.to.emit('m:hang', { from: old.fromName }); this.calls.delete(key); }
    const candidates = [...sessions].filter(x => x.connected !== false && x.data.mess);
    const target = candidates.find(x => x.data.messClient !== 'social') || candidates[0];
    if (!target) return { error: 'They are not available.' };
    this.calls.set(key, { from, to: target, fromName: from.data.acct.name, toName: target.data.acct.name, at: this.now(), accepted: false });
    return { target };
  }
  relay(s, uid, targetUid, event, accepted) {
    const key = this.key(uid, targetUid), c = this.calls.get(key);
    if (!c || (s !== c.from && s !== c.to) || (event === 'm:callans' && s !== c.to)) return null;
    const target = s === c.from ? c.to : c.from;
    if (event === 'm:hang' || (event === 'm:callans' && !accepted)) this.calls.delete(key);
    else if (event === 'm:callans') c.accepted = true;
    return target;
  }
  disconnect(s) {
    for (const [key, c] of this.calls) if (c.from === s || c.to === s) {
      const target = c.from === s ? c.to : c.from;
      target.emit('m:hang', { from: s.data.acct.name }); this.calls.delete(key);
    }
  }
}
module.exports = { clientKind, replacedSessions, CallRoutes };
