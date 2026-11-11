'use strict';
// UI clients are a session category only; authentication and contact checks
// remain in accounts.js. One Social dock and one normal messenger may coexist.
const clientKind = s => s.handshake?.auth?.client === 'social' ? 'social' : 'messenger';
const deviceKind = s => {
  const agent=s.handshake?.headers?.['user-agent'] || '';
  if(/Electron\//i.test(agent)||s.handshake?.auth?.device==='desktop')return 'desktop';
  if(/Android|iPhone|iPad|iPod/i.test(agent)||s.handshake?.auth?.device==='mobile')return 'mobile';
  return 'browser';
};
const presenceDevice = (sessions,visible=true) => {
  if(!visible)return null;
  const kinds=[...sessions].filter(s=>s.data?.mess&&s.connected!==false).map(deviceKind);
  if(!kinds.length||kinds.includes('desktop'))return null;
  return kinds.includes('mobile')?'mobile':'browser';
};
const replacedSessions = (s, sessions) => [...sessions].filter(x => x !== s && x.data.mess && (x.data.messClient || 'messenger') === clientKind(s));
class CallRoutes {
  constructor(now = Date.now) { this.calls = new Map(); this.now = now; }
  key(a, b) { return [String(a), String(b)].sort().join(':'); }
  start(from, uid, targetUid, sessions, id) {
    const key = this.key(uid, targetUid), old = this.calls.get(key);
    if (old && this.now() - old.at < (old.accepted ? 7200000 : 30000)) return { error: 'A call is already active between you.' };
    if (old) this.expire(key, old);
    const candidates = [...sessions].filter(x => x.connected !== false && x.data.mess);
    const target = candidates.find(x => x.data.messClient !== 'social') || candidates[0];
    if (!target) return { error: 'They are not available.' };
    const call = { from, to: target, fromName: from.data.acct.name, toName: target.data.acct.name, at: this.now(), accepted: false, id };
    call.timer = setTimeout(() => this.expire(key, call), 30000);
    call.timer.unref?.();
    this.calls.set(key, call);
    return { target };
  }
  expire(key, call) {
    if (this.calls.get(key) !== call) return;
    this.remove(key, call);
    const details = { callId:call.id, reason:call.accepted?'ended':'no-answer' };
    call.from.emit('m:hang', { from: call.toName, ...details });
    call.to.emit('m:hang', { from: call.fromName, ...details });
  }
  remove(key, call) {
    clearTimeout(call.timer);
    this.calls.delete(key);
  }
  relay(s, uid, targetUid, event, accepted, id) {
    const key = this.key(uid, targetUid), c = this.calls.get(key);
    if (!c || (id && id !== c.id) || (s !== c.from && s !== c.to) || (event === 'm:callans' && (s !== c.to || c.accepted))) return null;
    if (!c.accepted && this.now()-c.at >= 30000) { this.expire(key,c); return null; }
    const target = s === c.from ? c.to : c.from;
    if (event === 'm:hang' || (event === 'm:callans' && !accepted)) this.remove(key, c);
    else if (event === 'm:callans') { clearTimeout(c.timer); c.accepted = true; c.at = this.now(); }
    return target;
  }
  disconnect(s) {
    for (const [key, c] of this.calls) if (c.from === s || c.to === s) {
      const target = c.from === s ? c.to : c.from;
      target.emit('m:hang', { from: s.data.acct.name, ...(c.id?{callId:c.id}:{}) });
      this.remove(key,c);
    }
  }
}
module.exports = { clientKind, deviceKind, presenceDevice, replacedSessions, CallRoutes };
