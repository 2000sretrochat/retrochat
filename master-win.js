// In-app Master Console window (served only to masters via /api/master/ui.js)
window.openMasterConsole = function () {
  let w = document.getElementById('ymcw'); if (w) { w.style.display = ''; w.classList.remove('min'); w.style.zIndex = ++window._ymz; return; }
  window._ymz = window._ymz || 9000;
  if (!document.getElementById('ymcs')) { const st = document.createElement('style'); st.id = 'ymcs'; st.textContent = `
#ymcw{position:fixed;left:60px;top:50px;width:900px;height:600px;min-width:360px;min-height:200px;background:#fff;border:1px solid #6d86a8;border-radius:8px;box-shadow:0 10px 32px rgba(0,0,0,.35);display:flex;flex-direction:column;resize:both;overflow:hidden;z-index:9000;font:13px system-ui,Arial}
#ymcw .ymtb{display:flex!important;flex-direction:row!important;align-items:center!important;gap:6px;height:auto!important;padding:6px 8px!important;margin:0!important;background:linear-gradient(#2a86ef,#1877e8)!important;color:#fff!important;font:600 13px system-ui!important;cursor:move;user-select:none;border:0!important}
#ymcw .ymtb span{flex:1!important;text-align:left!important;color:#fff!important}#ymcw .ymtb button{all:unset;box-sizing:border-box!important;display:inline-block!important;flex:none!important;width:24px!important;min-width:0!important;height:22px!important;padding:0!important;margin:0!important;border:0!important;box-shadow:none!important;text-align:center!important;line-height:22px!important;border-radius:4px!important;cursor:pointer;background:rgba(255,255,255,.18)!important;color:#fff!important;font:700 12px system-ui!important}#ymcw .ymtb button:hover{background:rgba(255,255,255,.35)!important}#ymcw .ymtb .x:hover{background:#e5484d!important}
#ymcw iframe{flex:1;border:0;width:100%}#ymcw.min{height:auto!important;resize:none}#ymcw.min iframe{display:none}
#ymcw.max{left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0;resize:none}`; document.head.appendChild(st); }
  w = document.createElement('div'); w.id = 'ymcw'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', 'Master Console');
  w.innerHTML = '<div class=ymtb><span>&#9881; Master Console</span><button class=mn title=Minimize>_</button><button class=mx title=Maximize>&#9633;</button><button class=x title=Close>&#10005;</button></div><iframe src="/master?embed=1" title="Master Console"></iframe>';
  document.body.appendChild(w); w.style.zIndex = ++window._ymz;
  const tb = w.querySelector('.ymtb'), fr = w.querySelector('iframe');
  w.querySelector('.x').onclick = () => w.remove();
  w.querySelector('.mn').onclick = () => { w.classList.remove('max'); w.classList.toggle('min'); };
  w.querySelector('.mx').onclick = () => { w.classList.remove('min'); w.classList.toggle('max'); };
  tb.ondblclick = e => { if (e.target === tb || e.target.tagName === 'SPAN') w.querySelector('.mx').click(); };
  w.onpointerdown = () => w.style.zIndex = ++window._ymz;
  tb.onpointerdown = e => { if (e.target.tagName === 'BUTTON' || w.classList.contains('max')) return; const r = w.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top; fr.style.pointerEvents = 'none';
    const mv = ev => { w.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - dx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 30, ev.clientY - dy)) + 'px'; };
    const up = () => { fr.style.pointerEvents = ''; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); };
};
