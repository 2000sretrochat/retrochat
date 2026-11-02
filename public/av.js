// YappChat audio/video options: mic mode, input device, computer audio, cam quality
(function () {
  const LS = k => { try { return JSON.parse(localStorage.getItem('yav') || '{}')[k]; } catch { return undefined; } };
  const set = (k, v) => { let o = {}; try { o = JSON.parse(localStorage.getItem('yav') || '{}'); } catch { } o[k] = v; localStorage.setItem('yav', JSON.stringify(o)); };
  const cfg = () => ({ mode: LS('mode') || 'voice', dev: LS('dev') || '', sys: LS('sys') || 'off', camQ: LS('camQ') || 'low', ptt: LS('ptt') || 'hold' });
  let sysStream = null, ctx = null;
  async function buildMic() {
    const c = cfg(), music = c.mode === 'music';
    const a = { echoCancellation: !music, noiseSuppression: !music, autoGainControl: !music };
    if (music) a.channelCount = 2; if (c.dev) a.deviceId = { exact: c.dev };
    let micS = null; if (c.sys !== 'only') { try { micS = await navigator.mediaDevices.getUserMedia({ audio: a }); } catch (e) { if (c.dev) { set('dev', ''); delete a.deviceId; micS = await navigator.mediaDevices.getUserMedia({ audio: a }); } else throw e; } }
    if (c.sys === 'off') return micS;
    if (!navigator.mediaDevices.getDisplayMedia) { alert('Sharing computer audio is not supported in this browser (try Chrome or Edge).'); if (micS) return micS; throw new Error('no audio source'); }
    if (!sysStream || !sysStream.getAudioTracks().some(t => t.readyState === 'live')) {
      try { sysStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch (e) { if (micS) return micS; throw e; }
      sysStream.getVideoTracks().forEach(t => t.stop());
      if (!sysStream.getAudioTracks().length) { alert('No audio was shared. In the share picker, tick "Share tab audio" / "Share system audio".'); if (micS) return micS; throw new Error('no audio shared'); }
    }
    if (!micS) return new MediaStream(sysStream.getAudioTracks());
    ctx = ctx || new AudioContext(); const dst = ctx.createMediaStreamDestination(); dst.channelCount = 2;
    ctx.createMediaStreamSource(micS).connect(dst); ctx.createMediaStreamSource(new MediaStream(sysStream.getAudioTracks())).connect(dst);
    const out = dst.stream; out._parts = [micS, sysStream]; return out;
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
  window.YAV = { cfg, set, buildMic, munge, tune, camBitrate, camConstraints, devices, Q, stopSys() { sysStream && sysStream.getTracks().forEach(t => t.stop()); sysStream = null; } };
})();
