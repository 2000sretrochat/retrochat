// Design handoff (Nov 10, 2026): Messenger/rooms visual pass + voice->webcam, Offline Messages, bell, tray, updates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const css = R('public/design-nov10.css');

// ---- tiny DOM stand-ins for the call window ----
function el(name) {
  const attrs = {};
  return { name, hidden: false, disabled: false, textContent: '', innerHTML: '', srcObject: null, muted: false,
    classList: { set: new Set(), toggle(c, on) { on ? this.set.add(c) : this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return attrs[k]; }, querySelector: () => null, append() {}, play: async () => {} };
}
function callWindow() {
  const parts = { '.cs': el('cs'), '.cstage': el('stage'), '.camt': el('camt'), 'video.me': el('me'), '.cpeer': el('peer'), '.cstatus': el('status'), 'video.them': el('them'), '.call .cs': null };
  parts['.cs'].querySelector = () => null;
  const panel = Object.assign(el('call'), { querySelector: s => parts[s] || null, querySelectorAll: s => s === 'video.them' ? [parts['video.them']] : [] });
  const win = { querySelector: s => s === '.call' ? panel : s === '.call video.them' ? parts['video.them'] : s === '.call video.me' ? parts['video.me'] : s === '.call .cs' ? parts['.cs'] : null, querySelectorAll: () => [], append() {} };
  return { win, panel, parts };
}
function setup(role = 'caller') {
  const sent = [], timers = new Map(); let seq = 0;
  class Track { constructor(kind) { this.kind = kind; this.stopped = false; } stop() { this.stopped = true; } }
  class PC {
    constructor() { this.senders = []; this.signalingState = 'stable'; this.connectionState = 'new'; PC.last = this; }
    addTrack(track) { const s = { track, replaceTrack: async t => { s.track = t; } }; this.senders.push(s); return s; }
    getSenders() { return this.senders; }
    async createOffer() { return { type: 'offer', sdp: 'o' }; }
    async createAnswer() { return { type: 'answer', sdp: 'a' }; }
    async setLocalDescription(d) { if (d.type === 'rollback') { this.rolledBack = true; this.signalingState = 'stable'; return; } this.localDescription = d; this.signalingState = d.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async setRemoteDescription(d) { this.remoteDescription = d; this.signalingState = d.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async addIceCandidate() {} close() {}
  }
  const ctx = {
    window: {}, addEventListener() {}, AbortSignal, crypto: require('node:crypto'), MediaStream: class { constructor(t) { this.t = t; } getVideoTracks() { return (this.t || []).filter(x => x.kind === 'video'); } },
    fetch: async () => ({ ok: true, json: async () => ({ iceServers: [] }) }), document: { createElement: () => el('x') },
    setTimeout: (f, ms) => { const id = ++seq; timers.set(id, { f, ms }); return id; }, setInterval: (f, ms) => { const id = ++seq; timers.set(id, { f, ms }); return id; },
    clearTimeout: id => timers.delete(id), clearInterval: id => timers.delete(id),
    navigator: { mediaDevices: { getUserMedia: async c => { const t = c.video ? [new Track('video')] : [new Track('audio')]; return { getTracks: () => t, getVideoTracks: () => t.filter(x => x.kind === 'video'), getAudioTracks: () => t.filter(x => x.kind === 'audio') }; } } },
    RTCPeerConnection: PC
  };
  ctx.globalThis = ctx;
  vm.runInNewContext(R('public/messenger-calls.js'), ctx);
  const conn = { connected: true, timeout() { return this; }, emit(event, data, done) { sent.push({ event, data }); done(null, { ok: true }); } };
  const w = callWindow();
  const calls = ctx.window.createMessengerCalls({ socket: () => conn, contact: () => ({ online: true }), openIm: () => w.win, findIm: () => w.win, notice() {}, toast() {}, sound() {} });
  return { calls, w, sent, PC, Track };
}
async function connectedVoiceCall() {
  const t = setup();
  await t.calls.startCall(t.w.win, 'DiscoKat', 'audio');
  const call = t.w.win._call;
  await t.calls.onCallAns({ from: 'DiscoKat', callId: call.id, accept: true });
  await t.calls.onSig({ from: 'DiscoKat', callId: call.id, data: { sdp: { type: 'answer', sdp: 'a' } } }); await call.queue;
  t.PC.last.connectionState = 'connected'; t.PC.last.onconnectionstatechange();
  return { ...t, call, pc: t.PC.last };
}

test('voice call: camera toggle sits in the call bar and is off until connected', async () => {
  const { w, call } = await connectedVoiceCall();
  assert.equal(call.phase, 'connected');
  assert.equal(w.parts['.camt'].hidden, false);
  assert.equal(w.parts['.camt'].getAttribute('aria-pressed'), 'false');
  assert.match(w.parts['.camt'].innerHTML, /Turn on webcam/);
  assert.equal(w.parts['.cstage'].hidden, true, 'stage collapsed while both cameras are off');
  assert.match(w.parts['.cstatus'].innerHTML, /<b>Voice call<\/b> <span class=ctime>00:0\d<\/span>/);
});

test('voice -> webcam: adds a video track, renegotiates over m:sig and tells the other side', async () => {
  const { calls, w, call, pc, sent } = await connectedVoiceCall();
  const before = sent.length;
  await calls.toggleCamera(w.win);
  assert.equal(call.camOn, true);
  assert.equal(pc.senders.filter(s => s.track && s.track.kind === 'video').length, 1);
  const sigs = sent.slice(before).filter(m => m.event === 'm:sig').map(m => m.data.data);
  assert.ok(sigs.some(d => d.sdp && d.sdp.type === 'offer'), 'renegotiation offer sent');
  assert.ok(sigs.some(d => d.cam === true), 'camera state sent');
  assert.equal(w.parts['.cstage'].hidden, false);
  assert.equal(w.parts['video.me'].hidden, false);
  assert.match(w.parts['.camt'].innerHTML, /Turn off webcam/);
  assert.equal(w.parts['.camt'].getAttribute('aria-pressed'), 'true');
  assert.match(w.parts['.cstatus'].innerHTML, /Video call/);
  // off again: same sender is reused (replaceTrack), no second offer
  const n = sent.length;
  await calls.toggleCamera(w.win);
  assert.equal(call.camOn, false);
  assert.equal(pc.senders.length, 2);
  assert.ok(!sent.slice(n).some(m => m.data.data && m.data.data.sdp), 'turning off needs no renegotiation');
  assert.ok(sent.slice(n).some(m => m.data.data && m.data.data.cam === false));
  assert.equal(w.parts['.cstage'].hidden, true, 'collapsed again when both are off');
});

test('remote camera on/off keeps the remote tile and collapses only when both are off', async () => {
  const { calls, w, call } = await connectedVoiceCall();
  calls.onSig({ from: 'DiscoKat', callId: call.id, data: { cam: true } }); await call.queue;
  assert.equal(call.theirCam, true);
  assert.equal(w.parts['.cstage'].hidden, false);
  assert.equal(w.parts['video.me'].hidden, true, 'my preview hidden while my camera is off');
  assert.equal(w.parts['.cpeer'].hidden, true);
  calls.onSig({ from: 'DiscoKat', callId: call.id, data: { cam: false } }); await call.queue;
  assert.equal(w.parts['.cstage'].hidden, true);
});

test('offer glare: the caller keeps its offer, the callee (polite) rolls back and answers', async () => {
  const a = await connectedVoiceCall();
  a.call.makingOffer = true;
  a.pc.signalingState = 'have-local-offer';
  a.calls.onSig({ from: 'DiscoKat', callId: a.call.id, data: { sdp: { type: 'offer', sdp: 'x' } } }); await a.call.queue;
  assert.notEqual(a.pc.remoteDescription.type, 'offer', 'impolite caller ignores the colliding offer');
  // the callee is the polite side: same collision -> rollback, accept their offer, answer
  const b = await connectedVoiceCall();
  b.call.role = 'callee'; b.call.makingOffer = true; b.pc.signalingState = 'have-local-offer';
  const n = b.sent.length;
  b.calls.onSig({ from: 'DiscoKat', callId: b.call.id, data: { sdp: { type: 'offer', sdp: 'x' } } }); await b.call.queue;
  assert.equal(b.pc.rolledBack, true);
  assert.equal(b.pc.remoteDescription.type, 'offer');
  assert.ok(b.sent.slice(n).some(m => m.data.data && m.data.data.sdp && m.data.data.sdp.type === 'answer'), 'answer sent');
});

test('Messenger call window markup: status, camera toggle, Hang Up, 16:9 stage with 4:3 self preview', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const h = R(f);
    assert.match(h, /<div class=call><div class=callbar><div class=cleft><span class=cstatus><\/span><div class=cs><\/div><\/div><div class=cbtns><button type=button class="rzb camt" aria-pressed=false hidden><\/button><button type=button class="rzb danger hang">Hang Up<\/button><\/div><\/div><div class=cstage hidden>/);
    assert.match(h, /querySelector\('\.camt'\)\.onclick=\(\)=>toggleCamera\(w\)/);
    assert.match(h, /<link rel="stylesheet" href="\/design-nov10\.css(?:\?v=\d+)?">/);
  }
  assert.match(css, /\.call \.cstage\{position:relative;aspect-ratio:16\/9;[^}]*background:#071933/);
  assert.match(css, /video\.me\{position:absolute;right:8px;bottom:8px;width:clamp\(64px,25%,112px\)!important;height:auto!important;aspect-ratio:4\/3/);
  assert.match(css, /@container \(max-width:360px\)\{\.call \.cleft\{flex-basis:100%\}/);
  assert.match(css, /\.rzb\.danger\{background:#B43434!important;border-color:#d67171!important/);
});

test('Offline Messages panel: below the contact toolbar, per-message dismiss that deletes server-side', () => {
  const panel = R('public/offline-panel.js');
  assert.match(panel, /'Dismiss ' \+ m\.from \+ ' message'/);
  assert.match(panel, /<b>Offline Messages<\/b>/);
  assert.match(panel, /m\.offlineId && m\.receivedOffline/);
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const h = R(f);
    assert.match(h, /id="q" placeholder="Search contacts\.\.\."><\/div><\/div>\r?\n  <div id="offlinePanel" hidden><\/div>/);
    assert.match(h, /dismiss:ids=>emit\("m:offline-dismiss",ids\)/);
    assert.match(h, /onRefresh:\(\)=>window\.offlinePanel\.render\(\)/);
    assert.match(h, /<script src="\/offline-panel\.js"><\/script><script src="\/messenger-inbox\.js">/);
  }
  assert.match(R('accounts.js'), /s\.on\('m:offline-dismiss', safe\(async ids => ready \? offlineBox\(\)\.dismiss\(uid, ids\)/);
  assert.match(R('offline-messages.js'), /delete from offline where to_id=\$1 and id=any\(\$2::int\[\]\) returning id[\s\S]{0,120}toUser\(uid, 'm:offline-read', done\)/);
  assert.match(css, /\.rz-offline-row\{display:flex;align-items:center;gap:8px;min-height:52px;padding:8px/);
  assert.match(css, /@media \(max-width:360px\)\{\.rz-offline-body small\{white-space:normal;display:-webkit-box;-webkit-line-clamp:2/);
});

test('bell: order Contact requests > Unread messages (offline rows) > Social; 99+ badge; 336px dropdown', () => {
  const inbox = R('public/messenger-inbox.js'), ic = R('public/messenger-inbox.css');
  const a = inbox.indexOf("section('Contact requests'"), b = inbox.indexOf("section('Unread messages'"), c = inbox.indexOf("section('Social'");
  assert.ok(a > 0 && a < b && b < c, 'section order');
  assert.match(inbox, /' sent an offline message'/);
  assert.match(inbox, /aria-label', 'Unread'/);
  assert.match(inbox, /count > 99 \? '99\+' : count/);
  assert.match(inbox, /w = Math\.min\(336, innerWidth - 24\)/);
  assert.match(ic, /#menu \.messenger-bell\.has-unread\{background:#00205B!important;color:#FF9900!important\}/);
  assert.match(ic, /\.messenger-bell small\{position:absolute;top:1px;right:1px;box-sizing:border-box;min-width:16px;height:16px;padding:0 4px;border:1px solid #fff/);
  assert.match(ic, /\.mn-offline\{[^}]*min-height:60px/);
});

test('Social notifications list offline messages under "Unread messages", above Post activity', () => {
  const la = R('social-next/web/live-account.js');
  assert.match(la, /offlineSection\(\)\+'<h3>Post activity<\/h3>'/);
  assert.match(la, /sent an offline message/);
  assert.match(la, /'sharedNotification','sharedOffline','liveMessage'/);
  assert.match(la, /api\('\/offline-messages\/read','POST',\{ids:\[Number\(d\.sharedOffline\)\]\}\)/);
  assert.match(la, /inbox\.offlineMessages\.filter\(item=>!item\.read\)\.length/);
  assert.ok(la.includes('\r\n'), 'live-account.js keeps CRLF');
});

test('tray icon: 16/32 px PNGs and the 2-size ICO are packaged and used by the tray', () => {
  const png = f => { const b = fs.readFileSync(path.join(__dirname, '..', 'desktop/build', f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(png('tray-16.png'), [16, 16]);
  assert.deepEqual(png('tray-32.png'), [32, 32]);
  const ico = fs.readFileSync(path.join(__dirname, '..', 'desktop/build/razzle-tray.ico'));
  assert.equal(ico.readUInt16LE(4), 2);
  const main = R('desktop/main.js'), pkg = JSON.parse(R('desktop/package.json'));
  assert.match(main, /tray = new Tray\(trayIcon\(\)\)/);
  assert.match(main, /addRepresentation\(\{ scaleFactor: 2, width: 32, height: 32/);
  for (const f of ['build/tray-16.png', 'build/tray-32.png', 'build/razzle-tray.ico']) assert.ok(pkg.build.files.includes(f), f);
});

test('record menu (masters): Audio only, Video only, Both, divider, Stop; amber 6px dot', () => {
  const rec = R('master-recorder.js');
  const order = ['mRecA', 'mRecV', 'mRecB', 'rz-menu-sep', 'mRecS'].map(k => rec.indexOf(k));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'menu order');
  assert.match(rec, /\$\('mRecS'\)\.disabled = !cur/);
  assert.doesNotMatch(R('public/rooms.html'), /mRecA|rec:start/, 'still nothing master-only in the public page');
  assert.match(css, /\.rz-menu\{[^}]*min-width:160px;[^}]*padding:4px;background:#fff;border:1px solid #9DB3CC;border-radius:4px/);
  assert.match(css, /\.rz-menu-row\.rz-stop\{color:#9A3030!important\}/);
  assert.match(css, /#recDot\.rec-dot,\.rec-dot\{width:6px;height:6px;margin-left:-4px;border-radius:50%;background:#FFB020/);
});

test('updates: alert icon on the trailing edge; native dialog copy follows the design', () => {
  const up = R('public/desktop-updates.js'), main = R('desktop/main.js');
  assert.match(up, /margin-left:8px;width:14px;height:14px/);
  assert.match(up, /fill="#FFE066" stroke="#A87800"/);
  for (const s of ['Checking for updates…', "You're up to date.", 'An update is downloading.', 'Update ready to install', 'Razzle Messenger has downloaded an update. Restart the app to install it.', "Couldn't check for updates. Try again later."]) assert.ok(main.includes(s), s);
  assert.match(main, /buttons: \['Later', 'Restart and Install'\], defaultId: 1, cancelId: 0/);
  assert.match(main, /if \(response !== 1 \|\| !updater\) return;/);
});

test('sign-in: chevron control, Edit pinned under a divider, stacked checks', () => {
  const si = R('public/desktop-signin.js');
  assert.match(si, /<div class="rzn-opts">/);
  assert.match(si, /class="rzn-edit" data-edit="1"/);
  assert.match(si, /\.rzn-list \.rzn-edit\{border-top:1px solid #C6D5E7/);
  assert.match(si, /#fIn\.rzn-on #iPw\+\.row\{margin-top:12px\}/);
  assert.match(si, /#fIn\.rzn-on #bIn\{margin-top:12px\}/);
});

test('rooms: invite picker, Edit, cam size, music bar, largest-cam layout, user menu, PM pop-out', () => {
  const rooms = R('public/rooms.html');
  assert.match(rooms, /id=ivC>Cancel<\/button><button type=button class="rzb primary" id=ivS disabled><svg/);
  assert.match(rooms, /c\.closest\('\.ivr'\)\.classList\.toggle\('sel',c\.checked\)/);
  assert.match(css, /\.yprof\.invp\{[^}]*width:min\(392px,calc\(100vw - 24px\)\)!important/);
  assert.match(rooms, /class="guest-room-join rz-edit"/);
  assert.match(rooms, /\$\('camSzL'\)\.textContent=\['Small','Medium','Large'\]\[camSz-1\]/);
  assert.match(css, /#camsz button:disabled\{background:#E7EEF7!important;color:#526781!important;border-color:#B3C4D8!important;opacity:1!important/);
  assert.match(css, /#npme\.rz-music\{display:grid;grid-template-columns:auto minmax\(85px,1fr\) minmax\(65px,1fr\) minmax\(65px,1fr\) auto/);
  assert.match(css, /@media \(max-width:350px\)\{#npme\.rz-music\{grid-template-columns:1fr\}\}/);
  assert.match(css, /#chat:has\(#camstrip\.cs3\.has\)\{display:grid!important;grid-template-columns:minmax\(0,1\.35fr\) minmax\(280px,1fr\)/);
  assert.match(css, /height:calc\(min\(38vh,240px\) \+ 20px\)/);
  assert.match(css, /@media \(max-width:600px\)\{#chat:has\(#camstrip.cs3.has\)>#camstrip\{flex:none!important\}/);
  assert.match(rooms, /m\.style\.left=Math\.max\(8,Math\.min\(ev\.clientX,innerWidth-r\.width-8\)\)/);
  assert.match(rooms, /w\.classList\.add\('rz-popped'\)/);
  assert.match(css, /\.pmwin\.rz-popped\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto auto/);
});
