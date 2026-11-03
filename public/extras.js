// YappChat: Audibles (original synthesized clips) + IMVironments (conversation themes)
window.YAud = (function () {
  let C; const ac = () => (C = C || new (window.AudioContext || window.webkitAudioContext)());
  const note = (f, t0, d, type = 'sine', g = .18, slide) => { if (localStorage.ycSound === 'off') return; const c = ac(), o = c.createOscillator(), v = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0); if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + t0 + d); v.gain.setValueAtTime(g, c.currentTime + t0); v.gain.exponentialRampToValueAtTime(.001, c.currentTime + t0 + d); o.connect(v).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + .02); };
  const noise = (t0, d, g = .15) => { const c = ac(), b = c.createBuffer(1, c.sampleRate * d, c.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length); const s = c.createBufferSource(), v = c.createGain(); v.gain.value = g; s.buffer = b; s.connect(v).connect(c.destination); s.start(c.currentTime + t0); };
  const A = {
    lol: { e: '\u{1F602}', l: 'LOL', p() { [0, .14, .28, .42].forEach((t, i) => note(520 - i * 30, t, .11, 'triangle', .2, 380 - i * 30)); } },
    doh: { e: '\u{1F926}', l: "D'oh!", p() { note(300, 0, .12, 'sawtooth', .15, 260); note(220, .13, .35, 'sawtooth', .15, 140); } },
    woohoo: { e: '\u{1F389}', l: 'Woohoo!', p() { note(400, 0, .25, 'square', .1, 900); note(500, .3, .35, 'square', .1, 1200); } },
    wave: { e: '\u{1F44B}', l: 'Hey there!', p() { note(660, 0, .12); note(880, .14, .2); } },
    kiss: { e: '\u{1F48B}', l: 'Mwah!', p() { noise(0, .06, .3); note(1200, .05, .15, 'sine', .15, 1800); } },
    drumroll: { e: '\u{1F941}', l: 'Drumroll...', p() { for (let i = 0; i < 16; i++) noise(i * .05, .04, .12); noise(.85, .4, .35); note(150, .85, .4, 'sine', .3, 60); } }
  };
  function play(k, box) { const a = A[k]; if (!a) return; try { a.p(); } catch { }
    if (box) { const d = document.createElement('div'); d.className = 'yaud'; d.innerHTML = '<span>' + a.e + '</span><b>' + a.l + '</b>'; box.appendChild(d); setTimeout(() => d.remove(), 2200); } }
  const css = document.createElement('style'); css.textContent = `.yaud{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;animation:yaud 2.2s ease-out forwards;z-index:5}.yaud span{display:block;font-size:64px}.yaud b{font:bold 18px Arial;color:#fff;text-shadow:0 2px 4px #000}
@keyframes yaud{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15) rotate(-8deg)}30%{transform:translate(-50%,-50%) scale(1) rotate(6deg)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-90%)}}
.imv-beach .log{background:linear-gradient(#bfe9ff,#fff3c4 70%,#f5d58c)!important}.imv-space .log{background:radial-gradient(circle at 20% 30%,#fff 1px,transparent 2px) 0 0/40px 40px,radial-gradient(circle at 70% 60%,#ccf 1px,transparent 2px) 0 0/55px 55px,linear-gradient(#0b0b2e,#2a1050)!important;color:#eef}
.imv-hearts .log{background:radial-gradient(circle,#ffb3c8 3px,transparent 4px) 0 0/30px 30px,#fff0f5!important}.imv-city .log{background:linear-gradient(transparent 70%,#2d3550 70%),linear-gradient(#ff9a5a,#5a3d7a)!important;color:#fff}
.imv-retro .log{background:repeating-linear-gradient(45deg,#ffe36e 0 12px,#7fe0d0 12px 24px,#ff8fb1 24px 36px)!important}.imv-space .log b,.imv-city .log b{color:#ffd}`;
  document.head.appendChild(css);
  return { A, play, IMVS: { none: 'None', beach: 'Beach', space: 'Outer Space', hearts: 'Hearts', city: 'City Night', retro: 'Retro 90s' } };
})();
