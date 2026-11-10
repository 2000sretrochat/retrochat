// YappChat audio/video options: mic mode, input device, computer audio, cam quality
(function () {
  const AGC_OFF_VER = 1;
  const LS = k => { try { return JSON.parse(localStorage.getItem('yav') || '{}')[k]; } catch { return undefined; } };
  const load = () => { try { return JSON.parse(localStorage.getItem('yav') || '{}') || {}; } catch { return {}; } };
  const save = o => { localStorage.setItem('yav', JSON.stringify(o)); };
  const set = (k, v) => { const o = load(); o[k] = v; save(o); };
  function migrate() {
    const o = load();
    if (o.agcOffV !== AGC_OFF_VER) { o.agc = false; o.agcOffV = AGC_OFF_VER; save(o); }
  }
  migrate();
  const clampBoost = pct => Math.max(0, Math.min(200, Math.round(Number(pct) || 0)));
  const cfg = () => { migrate(); return { mode: LS('mode') || 'voice', dev: LS('dev') || '', sys: LS('sys') || 'off', camQ: LS('camQ') || 'normal', ptt: LS('ptt') || 'hold', agc: LS('agc') === true, boost: clampBoost(LS('boost') == null ? 100 : LS('boost')) }; };
  let sysStream = null, ctx = null, gainNode = null, limiter = null, liveOut = null, lastVoiceOpts = { video: false };
  const rebuildFns = new Set();
  function onRebuild(fn) { rebuildFns.add(fn); return () => rebuildFns.delete(fn); }
  function audioConstraints() {
    const c = cfg(), music = c.mode === 'music';
    const a = { echoCancellation: !music, noiseSuppression: !music, autoGainControl: !music && !!c.agc }; // never auto-change mic level unless the user opted in
    if (music) a.channelCount = 2; if (c.dev) a.deviceId = { exact: c.dev };
    return a;
  }
  function applyLimiter(pct) {
    if (!limiter) return;
    if (pct > 100) {
      limiter.threshold.value = -1.5; limiter.knee.value = 8; limiter.ratio.value = 20;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
    } else {
      limiter.threshold.value = 0; limiter.knee.value = 0; limiter.ratio.value = 1;
      limiter.attack.value = 0.003; limiter.release.value = 0.05;
    }
  }
  // outgoing mic: raw mic -> GainNode -> soft limiter (active only above 100%) -> MediaStreamDestination
  function boosted(src, pct) {
    try {
      ctx = ctx || new AudioContext(); ctx.resume && ctx.resume();
      const dst = ctx.createMediaStreamDestination();
      const g = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      pct = clampBoost(pct);
      g.gain.value = pct / 100;
      ctx.createMediaStreamSource(src).connect(g); g.connect(comp); comp.connect(dst);
      gainNode = g; limiter = comp; applyLimiter(pct);
      const out = dst.stream; out._parts = [src]; return out;
    } catch { return src; }
  }
  function setBoost(pct) {
    pct = clampBoost(pct); set('boost', pct);
    if (gainNode) gainNode.gain.value = pct / 100;
    applyLimiter(pct);
    try { const el = typeof document !== 'undefined' && document.getElementById('micLv'); if (el) el.textContent = pct + '%'; } catch { }
    return pct;
  }
  async function openMic(extra) {
    const a = audioConstraints();
    const want = { audio: a, ...(extra || {}) };
    try { return await navigator.mediaDevices.getUserMedia(want); }
    catch (e) {
      if (cfg().dev) { set('dev', ''); delete a.deviceId; want.audio = a; return await navigator.mediaDevices.getUserMedia(want); }
      throw e;
    }
  }
  async function buildMic() {
    const c = cfg();
    let micS = null; if (c.sys !== 'only') { const raw = await openMic(); micS = c.mode === 'music' ? raw : boosted(raw, c.boost); } // Music/stereo source (rooms 'Play from'): raw 2-channel, EC/NS/AGC off, no voice gain/limiter
    if (c.sys === 'off') { liveOut = micS; return micS; }
    if (!navigator.mediaDevices.getDisplayMedia) { alert('Sharing computer audio is not supported in this browser (try Chrome or Edge).'); if (micS) { liveOut = micS; return micS; } throw new Error('no audio source'); }
    if (!sysStream || !sysStream.getAudioTracks().some(t => t.readyState === 'live')) {
      try { sysStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch (e) { if (micS) { liveOut = micS; return micS; } throw e; }
      sysStream.getVideoTracks().forEach(t => t.stop());
      if (!sysStream.getAudioTracks().length) { alert('No audio was shared. In the share picker, tick "Share tab audio" / "Share system audio".'); if (micS) { liveOut = micS; return micS; } throw new Error('no audio shared'); }
    }
    if (!micS) { const out = new MediaStream(sysStream.getAudioTracks()); liveOut = out; return out; }
    ctx = ctx || new AudioContext(); const dst = ctx.createMediaStreamDestination(); dst.channelCount = 2;
    ctx.createMediaStreamSource(micS).connect(dst); ctx.createMediaStreamSource(new MediaStream(sysStream.getAudioTracks())).connect(dst);
    const out = dst.stream; out._parts = [micS, sysStream]; liveOut = out; return out;
  }
  // 1:1 Messenger calls: same AGC default and GainNode pipeline, no system-audio mix
  async function captureVoice(opts) {
    lastVoiceOpts = opts || lastVoiceOpts || { video: false };
    const video = lastVoiceOpts.video || false;
    const raw = await openMic(video ? { video } : { video: false });
    const audioIn = new MediaStream(raw.getAudioTracks());
    const boostedAudio = boosted(audioIn, cfg().boost);
    const tracks = [...boostedAudio.getAudioTracks(), ...raw.getVideoTracks()];
    const out = new MediaStream(tracks);
    out._parts = [raw]; liveOut = out; return out;
  }
  async function recapture() {
    if (!liveOut || !liveOut.getAudioTracks().some(t => t.readyState === 'live')) return null;
    const next = await captureVoice(lastVoiceOpts);
    for (const fn of rebuildFns) { try { await fn(next); } catch { } }
    return next;
  }
  function attachMeter(el) {
    if (!el || !liveOut) return () => {};
    try {
      ctx = ctx || new AudioContext(); ctx.resume && ctx.resume();
      const an = ctx.createAnalyser(); an.fftSize = 256;
      ctx.createMediaStreamSource(liveOut).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let on = true;
      const tick = () => { if (!on) return; if (an.getByteTimeDomainData) { an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); el.style.width = Math.min(100, (m / 128) * 250) + '%'; } requestAnimationFrame(tick); };
      tick(); return () => { on = false; };
    } catch { return () => {}; }
  }
  // stereo Opus in SDP (Music mode)
  function munge(desc) {
    if (cfg().mode !== 'music' && cfg().sys === 'off' || !desc || !desc.sdp) return desc;
    const m = desc.sdp.match(/a=rtpmap:(\d+) opus\/48000/i); if (!m) return desc; const pt = m[1];
    let sdp = desc.sdp.replace(new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)'), (all, p) => 'a=fmtp:' + pt + ' ' + p.split(';').filter(x => !/^(stereo|sprop-stereo|maxaveragebitrate)=/.test(x.trim())).concat(['stereo=1', 'sprop-stereo=1', 'maxaveragebitrate=128000']).join(';'));
    return { type: desc.type, sdp };
  }
  async function tune(pc) { const music = cfg().mode === 'music' || cfg().sys !== 'off';
    for (const s of pc.getSenders()) { if (!s.track) continue; try { const p = s.getParameters(); p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}];
      if (s.track.kind === 'audio') p.encodings[0].maxBitrate = music ? 128000 : 40000; else p.encodings[0].maxBitrate = camBitrate(window.YAV_viewers || 1);
      await s.setParameters(p); } catch { } } }
  const Q = { low: { w: 320, h: 240, f: 15, br: 250000 }, normal: { w: 640, h: 480, f: 24, br: 700000 }, hd: { w: 1280, h: 720, f: 30, br: 1500000 } };
  function camBitrate(viewers) { const b = (Q[cfg().camQ] || Q.low).br; return Math.max(120000, Math.round(b / (viewers <= 2 ? 1 : viewers <= 5 ? 1.6 : viewers <= 10 ? 2.5 : 4))); }
  const camConstraints = () => { const q = Q[cfg().camQ] || Q.low; return { width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: q.f } }; };
  async function devices() { try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'); } catch { return []; } }
  window.YAV = { cfg, set, buildMic, captureVoice, recapture, onRebuild, setBoost, attachMeter, audioConstraints, munge, tune, camBitrate, camConstraints, devices, Q, AGC_OFF_VER, stopSys() { sysStream && sysStream.getTracks().forEach(t => t.stop()); sysStream = null; }, _nodes() { return { gainNode, limiter, liveOut }; } };
})();
