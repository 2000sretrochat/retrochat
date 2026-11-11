// YappChat GIF picker for IMs / private messages (Giphy public API via server proxy; needs GIPHY_KEY on the server)
window.YGif = (function () {
  const RX = /^\s*\[gif:([A-Za-z0-9]{4,40})\]\s*$/;
  const url = (id, s) => 'https://media.giphy.com/media/' + id + '/' + (s ? '200w.gif' : 'giphy.gif');
  const render = t => { const m = RX.exec(String(t || '')); return m ? '<img class=ygif src="' + url(m[1]) + '" alt="GIF" loading=lazy style="max-width:220px;max-height:180px;border-radius:4px;display:block;margin-top:2px">' : null; };
  let pop, outside;
  function close() { if (pop) { outside?.abort(); pop.remove(); pop = null; } }
  function picker(anchor, onPick) {
    const doc = anchor.ownerDocument, view = doc.defaultView;
    if (pop) { const same = pop.ownerDocument === doc && pop.isConnected; close(); if (same) return; }
    outside = new AbortController();
    const signal = outside.signal;
    pop = doc.createElement('div'); pop.className = 'ygifpop';
    pop.style.cssText = 'position:fixed;z-index:99999;width:300px;background:#fff;color:#222;border:1px solid #7f9db9;border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.25);padding:6px;font:12px Tahoma,Arial,sans-serif';
    pop.innerHTML = '<input type=search placeholder="Search GIFs" style="width:100%;box-sizing:border-box;padding:4px;border:1px solid #aaa;border-radius:3px"><div class=yg style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;max-height:240px;overflow:auto;margin-top:6px"></div><div style="text-align:right;color:#888;font-size:10px;margin-top:4px">Powered by GIPHY</div>';
    doc.body.appendChild(pop);
    const r = anchor.getBoundingClientRect(); pop.style.maxWidth = 'calc(100vw - 20px)'; pop.style.left = Math.max(4, Math.min(view.innerWidth - 320, r.left)) + 'px'; pop.style.top = Math.max(4, r.top - 300) + 'px';
    const inp = pop.querySelector('input'), g = pop.querySelector('.yg'); let tmr;
    let request = 0;
    const load = async q => {
      if(signal.aborted)return;
      const current = ++request;
      g.innerHTML = '<span style="grid-column:1/-1;color:#888">Loading…</span>';
      try {
        const res = await fetch('/api/gif?q=' + encodeURIComponent(q || ''), { signal }); const j = await res.json();
        if(signal.aborted || current !== request)return;
        if (j.needKey) { g.innerHTML = '<span style="grid-column:1/-1;color:#a33">GIFs are not set up yet (the server needs a GIPHY API key).</span>'; return; }
        if (!j.items || !j.items.length) { g.innerHTML = '<span style="grid-column:1/-1;color:#888">No GIFs found.</span>'; return; }
        g.innerHTML = j.items.filter(id => /^[A-Za-z0-9]{4,40}$/.test(id)).map(id => '<button type="button" data-id="' + id + '" aria-label="Send GIF" style="padding:0!important"><img alt="" src="' + url(id, 1) + '" style="display:block;width:100%;height:70px;object-fit:cover;border-radius:3px"></button>').join('');
      } catch (e) { if(!signal.aborted && current === request)g.innerHTML = '<span style="grid-column:1/-1;color:#a33">Could not load GIFs.</span>'; }
    };
    g.onclick = e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id) { close(); onPick('[gif:' + id + ']'); } };
    inp.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => load(inp.value.trim()), 350); };
    doc.addEventListener('click', event => { if(!pop?.contains(event.target) && !anchor.contains(event.target))close(); }, { signal });
    doc.addEventListener('keydown', event => { if(event.key === 'Escape')close(); }, { signal });
    view.addEventListener('pagehide', close, { once: true, signal });
    load(''); inp.focus();
  }
  return { render, picker, close };
})();
