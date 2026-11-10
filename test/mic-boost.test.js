const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const avSrc = fs.readFileSync(path.join(root, 'public/av.js'), 'utf8');
const callsSrc = fs.readFileSync(path.join(root, 'public/messenger-calls.js'), 'utf8');
const roomsSrc = fs.readFileSync(path.join(root, 'public/rooms.html'), 'utf8');
const mcogSrc = fs.readFileSync(path.join(root, 'public/mcog.js'), 'utf8');
const recSrc = fs.readFileSync(path.join(root, 'master-recorder.js'), 'utf8');

class FakeParam { constructor(v = 0) { this.value = v; } }
class FakeNode {
  constructor(type) { this.type = type; this.connectedTo = []; this.gain = new FakeParam(1); this.threshold = new FakeParam(0); this.knee = new FakeParam(0); this.ratio = new FakeParam(1); this.attack = new FakeParam(0); this.release = new FakeParam(0); }
  connect(n) { this.connectedTo.push(n); return n; }
}
class FakeStream {
  constructor(tracks) { this._tracks = Array.isArray(tracks) ? tracks.slice() : (tracks && tracks.getTracks ? tracks.getTracks().slice() : []); this.active = true; }
  getTracks() { return this._tracks; }
  getAudioTracks() { return this._tracks.filter(t => t.kind === 'audio'); }
  getVideoTracks() { return this._tracks.filter(t => t.kind === 'video'); }
}

function track(kind, id) { return { kind, id, enabled: true, readyState: 'live', stop() { this.readyState = 'ended'; } }; }

function loadYav(opts = {}) {
  const store = { yav: opts.yav ? JSON.stringify(opts.yav) : null };
  const gum = [];
  const ctxNodes = [];
  class FakeAudioContext {
    constructor() { this.state = 'running'; this.nodes = ctxNodes; }
    resume() { return Promise.resolve(); }
    createGain() { const n = new FakeNode('gain'); ctxNodes.push(n); return n; }
    createDynamicsCompressor() { const n = new FakeNode('compressor'); ctxNodes.push(n); return n; }
    createAnalyser() { const n = new FakeNode('analyser'); n.fftSize = 256; n.getByteTimeDomainData = buf => buf.fill(128); ctxNodes.push(n); return n; }
    createMediaStreamSource(s) { const n = new FakeNode('source'); n.stream = s; ctxNodes.push(n); return n; }
    createMediaStreamDestination() {
      const n = new FakeNode('dest');
      n.stream = new FakeStream([track('audio', 'out-' + ctxNodes.length)]);
      ctxNodes.push(n);
      return n;
    }
  }
  const context = {
    window: opts.window || {},
    localStorage: {
      getItem(k) { return store[k] == null ? null : store[k]; },
      setItem(k, v) { store[k] = String(v); }
    },
    AudioContext: FakeAudioContext,
    MediaStream: FakeStream,
    navigator: {
      mediaDevices: {
        getUserMedia: async (c) => { gum.push(c); const tracks = [track('audio', 'mic-' + gum.length)]; if (c.video) tracks.push(track('video', 'cam-' + gum.length)); return new FakeStream(tracks); },
        getDisplayMedia: async () => new FakeStream([]),
        enumerateDevices: async () => []
      }
    },
    document: { getElementById() { return null; } },
    alert() {},
    Uint8Array,
    requestAnimationFrame: fn => fn()
  };
  vm.runInNewContext(avSrc, context);
  return { YAV: context.window.YAV, store, gum, ctxNodes, context };
}

test('AGC defaults off and getUserMedia uses autoGainControl:false', async () => {
  const { YAV, store, gum } = loadYav();
  assert.equal(YAV.cfg().agc, false);
  assert.equal(YAV.cfg().boost, 100);
  const saved = JSON.parse(store.yav);
  assert.equal(saved.agc, false);
  assert.equal(saved.agcOffV, YAV.AGC_OFF_VER);
  await YAV.buildMic();
  assert.equal(gum[0].audio.autoGainControl, false);
  assert.equal(YAV.audioConstraints().autoGainControl, false);
});

test('saved AGC-on preference is reset once via agcOffV, then user choice is kept', async () => {
  const first = loadYav({ yav: { agc: true, boost: 100 } });
  assert.equal(first.YAV.cfg().agc, false, 'one-time reset to off');
  assert.equal(JSON.parse(first.store.yav).agcOffV, first.YAV.AGC_OFF_VER);
  first.YAV.set('agc', true);
  const again = loadYav({ yav: JSON.parse(first.store.yav) });
  assert.equal(again.YAV.cfg().agc, true, 'after the reset, an explicit opt-in sticks');
  await again.YAV.buildMic();
  assert.equal(again.gum[0].audio.autoGainControl, true);
});

test('music mode never enables autoGainControl even if the user opted in', async () => {
  const { YAV, gum } = loadYav({ yav: { agc: true, agcOffV: 1, mode: 'music' } });
  assert.equal(YAV.cfg().agc, true);
  await YAV.buildMic();
  assert.equal(gum[0].audio.autoGainControl, false);
  assert.equal(gum[0].audio.echoCancellation, false);
});

test('Mic volume is 0-200%, defaults to 100, and is applied live through a GainNode', async () => {
  const { YAV, ctxNodes } = loadYav();
  const out = await YAV.buildMic();
  const gain = ctxNodes.find(n => n.type === 'gain');
  const comp = ctxNodes.find(n => n.type === 'compressor');
  const dest = ctxNodes.find(n => n.type === 'dest');
  assert.ok(gain && comp && dest);
  assert.equal(gain.gain.value, 1);
  assert.equal(comp.ratio.value, 1, 'limiter is bypassed at 100%');
  assert.equal(out.getAudioTracks()[0].id, dest.stream.getAudioTracks()[0].id, 'peers get the destination track, not the raw mic');
  const src = ctxNodes.find(n => n.type === 'source');
  assert.deepEqual(src.connectedTo, [gain]);
  assert.deepEqual(gain.connectedTo, [comp]);
  assert.deepEqual(comp.connectedTo, [dest]);
  assert.equal(YAV.setBoost(150), 150);
  assert.equal(gain.gain.value, 1.5);
  assert.ok(comp.ratio.value > 1, 'soft limiter only engages above 100%');
  assert.ok(comp.threshold.value < 0);
  assert.equal(YAV.cfg().boost, 150);
  assert.equal(YAV.setBoost(250), 200);
  assert.equal(gain.gain.value, 2);
  assert.equal(YAV.setBoost(-20), 0);
  assert.equal(gain.gain.value, 0);
  YAV.setBoost(100);
  assert.equal(comp.ratio.value, 1, 'limiter turns back off at 100%');
});

test('desktop Messenger still uses the WebAudio boost path (so volume can go above 100%)', async () => {
  const { YAV, ctxNodes } = loadYav({ window: { YappDesktop: { micVol: { get: async () => 80, step: async () => 85 } } } });
  await YAV.buildMic();
  YAV.setBoost(180);
  const gain = ctxNodes.find(n => n.type === 'gain');
  assert.equal(gain.gain.value, 1.8);
});

test('captureVoice wraps the mic for 1:1 calls and recapture notifies replaceTrack listeners', async () => {
  const { YAV, gum } = loadYav();
  const first = await YAV.captureVoice({ video: { width: { ideal: 640 } } });
  assert.equal(gum[0].audio.autoGainControl, false);
  assert.equal(first.getVideoTracks().length, 1);
  assert.equal(first.getAudioTracks().length, 1);
  const seen = [];
  YAV.onRebuild(stream => { seen.push(stream.getAudioTracks()[0].id); });
  const next = await YAV.recapture();
  assert.equal(gum.length, 2);
  assert.equal(seen[0], next.getAudioTracks()[0].id);
  assert.notEqual(seen[0], first.getAudioTracks()[0].id);
});

test('room and Messenger settings include a Mic volume slider; recorder mixes the outgoing mic stream', () => {
  assert.match(roomsSrc, /id=avBoost min=0 max=200/);
  assert.match(roomsSrc, /Mic volume/);
  assert.match(roomsSrc, /YAV\.setBoost\(\+\$\('avBoost'\)\.value\)/);
  assert.match(roomsSrc, /av\.js\?v=3/);
  assert.match(mcogSrc, /id=mavBoost min=0 max=200/);
  assert.match(mcogSrc, /Mic volume/);
  assert.match(mcogSrc, /Let my computer adjust my mic level automatically/);
  assert.match(recSrc, /if \(typeof mic !== 'undefined' && mic instanceof MediaStream\) add\('mic', mic\)/);
  assert.match(roomsSrc, /snd\.replaceTrack\(nt\)/);
});

test('Messenger calls request autoGainControl:false when YAV is not loaded yet', async () => {
  const constraints = [];
  const context = {
    window: {}, addEventListener() {}, AbortSignal, crypto: require('node:crypto'),
    fetch: async () => ({ ok: true, json: async () => ({ iceServers: [] }) }),
    setTimeout() { return 1; }, setInterval() { return 1; }, clearTimeout() {}, clearInterval() {},
    navigator: { mediaDevices: { getUserMedia: async (c) => { constraints.push(c); return { getTracks: () => [], getAudioTracks: () => [], getVideoTracks: () => [] }; } } },
    RTCPeerConnection: class { addTrack() {} async createOffer() { return { type: 'offer' }; } async setLocalDescription(d) { this.localDescription = d; } async setRemoteDescription(d) { this.remoteDescription = d; } async addIceCandidate() {} close() {} }
  };
  vm.runInNewContext(callsSrc, context);
  const chat = { _call: null, querySelector: () => ({ querySelector: () => ({ textContent: '', querySelector: () => null, append() {} }), querySelectorAll: () => [], classList: { toggle() {} } }), querySelectorAll: () => [] };
  const connection = { connected: true, timeout() { return this; }, emit(_e, _d, done) { done(null, { ok: true }); } };
  const calls = context.window.createMessengerCalls({
    socket: () => connection, contact: () => ({ online: true }), openIm: () => chat, findIm: () => chat,
    notice() {}, toast() {}, sound() {}
  });
  await calls.startCall(chat, 'BigTony', 'audio');
  await calls.onCallAns({ from: 'BigTony', callId: chat._call.id, accept: true });
  assert.equal(constraints[0].audio.autoGainControl, false);
  calls.endCall(chat, false, '');
});
