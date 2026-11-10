// Master-only room recorder (served only to masters via /api/master/recorder.js).
// Records what this browser / Messenger app already receives in the room - nothing extra is
// pulled from the server - and saves the file on this device:
//   - Razzle Messenger (desktop): streamed to Documents/Razzle Recordings/ as it records
//   - browser: downloaded as a .webm file when you stop
// Modes: 'audio' (all voices mixed with WebAudio), 'video' (open webcams composited into one
// grid on a canvas), 'both'. The server only tracks that a recording is running so every
// client can show the small amber dot by the room name; it never receives the media.
(function () {
  if (window.RazzleRecorder || typeof S === 'undefined' || !document.getElementById('camstrip')) return;
  const W = 1280, H = 720, FPS = 15, SLICE = 1000;
  let cur = null; // { id, mode, rec, ctx, dest, srcs, timer, chunks, bytes, file, name, room }

  const pick = types => types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  const stamp = d => { const p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }; // local time
  const safe = s => String(s || 'room').replace(/[^A-Za-z0-9 _.-]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'room';
  const desk = () => window.RazzleDesktop && window.RazzleDesktop.recordings;

  // ---- audio: every remote voice (<audio id="au<socket>">) + my own mic, mixed into one track ----
  function audioMix() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(); const dest = ctx.createMediaStreamDestination(); const srcs = new Map();
    const bus = ctx.createDynamicsCompressor(); bus.connect(dest); // several voices at once: soft-limit instead of clipping
    const add = (key, stream) => { if (!stream || srcs.has(key) || !stream.getAudioTracks().some(t => t.readyState === 'live')) return;
      try { const n = ctx.createMediaStreamSource(stream); n.connect(bus); srcs.set(key, { n, stream }); } catch (e) { console.warn('[rec] audio source', e.message); } };
    const scan = () => {
      document.querySelectorAll('audio[id^="au"]').forEach(a => add(a.id, a.srcObject));
      try { if (typeof mic !== 'undefined' && mic instanceof MediaStream) add('mic', mic); } catch (e) { }
      for (const [k, v] of srcs) if (!v.stream.getAudioTracks().some(t => t.readyState === 'live')) { try { v.n.disconnect(); } catch (e) { } srcs.delete(k); }
    };
    scan(); ctx.resume && ctx.resume().catch(() => {});
    return { ctx, dest, srcs, scan };
  }

  // ---- video: the webcams I have open in the cam strip, drawn into one grid ----
  function videoGrid() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const draw = () => {
      const tiles = [...document.querySelectorAll('#camstrip .tile')].filter(t => t.dataset.id !== S.id).map(t => ({ v: t.querySelector('video'), name: (t.querySelector('.lbl b') || {}).textContent || '' })).filter(x => x.v && x.v.videoWidth);
      g.fillStyle = '#111'; g.fillRect(0, 0, W, H);
      if (!tiles.length) { g.fillStyle = '#888'; g.font = '24px Arial'; g.textAlign = 'center'; g.fillText('No webcams open', W / 2, H / 2); return; }
      const cols = Math.ceil(Math.sqrt(tiles.length)), rows = Math.ceil(tiles.length / cols), cw = W / cols, ch = H / rows;
      tiles.forEach((t, i) => { const x = (i % cols) * cw, y = Math.floor(i / cols) * ch, s = Math.min(cw / t.v.videoWidth, ch / t.v.videoHeight), w = t.v.videoWidth * s, h = t.v.videoHeight * s;
        try { g.drawImage(t.v, x + (cw - w) / 2, y + (ch - h) / 2, w, h); } catch (e) { }
        g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x + 6, y + ch - 28, Math.min(cw - 12, 12 + t.name.length * 9), 22); g.fillStyle = '#fff'; g.font = '14px Arial'; g.textAlign = 'left'; g.fillText(t.name, x + 12, y + ch - 12); });
    };
    draw(); return { canvas: c, draw };
  }

  async function start(mode) {
    if (cur) return { error: 'Already recording.' };
    if (!window.MediaRecorder) return { error: 'This browser cannot record.' };
    if (!['audio', 'video', 'both'].includes(mode)) return { error: 'Pick audio, video or both.' };
    const r = await new Promise(res => S.emit('rec:start', { mode }, res));
    if (!r || !r.ok) return { error: (r && r.error) || 'Could not start recording.' };
    try {
      const tracks = []; let mix = null, grid = null, timer = null;
      if (mode !== 'video') { mix = audioMix(); tracks.push(...mix.dest.stream.getAudioTracks()); }
      if (mode !== 'audio') { grid = videoGrid(); tracks.push(...grid.canvas.captureStream(FPS).getVideoTracks()); }
      timer = setInterval(() => { mix && mix.scan(); grid && grid.draw(); }, 1000 / FPS);
      const mime = mode === 'audio' ? pick(['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']) : pick(['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm']);
      const rec = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 1500000, audioBitsPerSecond: 96000 } : undefined);
      const name = 'Razzle-' + safe(r.room) + '-' + mode + '-' + stamp(new Date()) + '.webm';
      cur = { id: r.id, mode, rec, mix, timer, chunks: [], bytes: 0, name, room: r.room, file: null, writes: Promise.resolve() };
      const d = desk(); if (d) { try { cur.file = await d.open(name); } catch (e) { cur.file = null; } }
      const me = cur;
      rec.ondataavailable = e => { if (!e.data || !e.data.size) return; me.bytes += e.data.size;
        if (me.file) me.writes = me.writes.then(() => e.data.arrayBuffer()).then(b => desk().write(me.file, b)).catch(err => console.warn('[rec] write', err)); else me.chunks.push(e.data); };
      rec.start(SLICE);
      return { ok: true, id: r.id, mode, file: name };
    } catch (e) { S.emit('rec:stop', { id: r.id }); cleanup(); return { error: 'Could not start recording: ' + e.message }; }
  }

  function cleanup() { if (!cur) return; clearInterval(cur.timer); try { cur.mix && cur.mix.ctx.close(); } catch (e) { } cur = null; }

  // Stops the recorder, saves the file, tells the server (unless the server already ended it).
  function stop(serverEnded) {
    if (!cur) return Promise.resolve({ error: 'Not recording.' });
    const me = cur;
    return new Promise(res => {
      me.rec.onstop = async () => {
        let where = '';
        try {
          await me.writes;
          if (me.file) where = await desk().close(me.file);
          else { const blob = new Blob(me.chunks, { type: me.rec.mimeType || 'video/webm' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = me.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 60e3); where = me.name; }
        } catch (e) { console.warn('[rec] save', e); }
        if (!serverEnded) S.emit('rec:stop', { id: me.id, bytes: me.bytes }, () => {}); else S.emit('rec:bytes', { id: me.id, bytes: me.bytes });
        cleanup(); res({ ok: true, id: me.id, bytes: me.bytes, saved: where });
      };
      try { me.rec.state === 'inactive' ? me.rec.onstop() : me.rec.stop(); } catch (e) { me.rec.onstop(); }
    });
  }

  // Room flag from the server: keep the amber dot hook in sync (styling is left to the theme).
  const dot = on => { const d = document.getElementById('recDot'); if (d) d.hidden = !on; };
  S.on('rec:ended', ({ id }) => { if (cur && cur.id === id) stop(true); });
  S.on('disconnect', () => { if (cur) stop(true); });

  // Master-only Record menu (design handoff Nov 10, item 6): a Record button in the room header opens
  // Audio only / Video only / Both, a divider, then Stop. Start items are disabled while recording; Stop is disabled when idle.
  const ICON = { mic: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="6" height="11" rx="3"/><path d="M4.5 9v1a5.5 5.5 0 0 0 11 0V9M10 15.5v3M7 18.5h6"/></svg>', cam: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="10" height="10" rx="2"/><path d="m12.5 9 5-3v8l-5-3"/></svg>', rec: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="6" fill="currentColor" stroke="none"/></svg>', stop: '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="10" height="10" rx="1"/></svg>' };
  const slot = document.getElementById('hmst');
  if (slot && !document.getElementById('mRecA')) {
    slot.insertAdjacentHTML('afterend', '<span class=rz-recwrap><button type=button class="hb rz-recbtn" id=bRec aria-haspopup=menu aria-expanded=false title="Record this room (masters)">' + ICON.rec + '<span>Record</span></button>' +
      '<div class=rz-menu id=recMenu role=menu hidden>' +
      '<button type=button role=menuitem class=rz-menu-row id=mRecA>' + ICON.mic + '<span>Audio only</span></button>' +
      '<button type=button role=menuitem class=rz-menu-row id=mRecV>' + ICON.cam + '<span>Video only</span></button>' +
      '<button type=button role=menuitem class=rz-menu-row id=mRecB>' + ICON.rec + '<span>Both</span></button>' +
      '<div class=rz-menu-sep role=separator></div>' +
      '<button type=button role=menuitem class="rz-menu-row rz-stop" id=mRecS>' + ICON.stop + '<span>Stop</span></button></div></span>');
    const $ = id => document.getElementById(id), menu = $('recMenu'), btn = $('bRec');
    const ui = () => { ['mRecA', 'mRecV', 'mRecB'].forEach(i => { $(i).disabled = !!cur; }); $('mRecS').disabled = !cur; btn.classList.toggle('on', !!cur); };
    const hide = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    const place = () => { const r = btn.getBoundingClientRect(), w = menu.offsetWidth || 160, h = menu.offsetHeight || 140;
      menu.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
      menu.style.top = (r.bottom + 4 + h > innerHeight - 8 ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px'; };
    btn.onclick = e => { e.stopPropagation(); if (!menu.hidden) return hide(); ui(); menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); place(); };
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { hide(); btn.focus(); } });
    const go = mode => { hide(); start(mode).then(r => { ui(); if (r.error) alert(r.error); }); };
    $('mRecA').onclick = () => go('audio'); $('mRecV').onclick = () => go('video'); $('mRecB').onclick = () => go('both');
    $('mRecS').onclick = () => { hide(); stop(false).then(r => { ui(); if (r.saved) alert('Recording saved: ' + r.saved); }); };
    S.on('rec:ended', () => setTimeout(ui, 0));
    ui();
  }
  window.RazzleRecorder = { start, stop: () => stop(false), get active() { return cur ? { id: cur.id, mode: cur.mode, bytes: cur.bytes, room: cur.room } : null; }, dot };
})();
