/* One room-invitation popup for every surface (Messenger web, Social, chat room, desktop app).
   Browser: a single modal centered over the whole page (the top page, even from the Social Messenger panel).
   Desktop app: its own small always-on-top window, centered, only one per invite across the app's windows.
   Accept/Reject are handled by the caller; close(id) clears it when answered elsewhere or expired. */
(function () {
  if (window.RazzleInvite) return;
  const open = new Map();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const boxHtml = inv => `<div class="razzle-invite" role="dialog" aria-modal="true" aria-labelledby="razzle-invite-title" style="width:320px;max-width:92vw;background:#fff;border:2px solid #36c;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:13px Arial,sans-serif;color:#222;overflow:hidden">
<div id="razzle-invite-title" style="background:#36c;color:#fff;padding:6px 10px;font-weight:bold">Chat Room Invitation</div>
<div style="padding:12px"><b>${esc(inv.from)}</b> has invited you to join the chat room <b>${esc(inv.room)}</b>${inv.rating === 'R' ? ' <span style="color:#c00">(R, 18+)</span>' : ''}.
<div style="text-align:right;margin-top:12px"><button type="button" data-a="d">Reject</button> <button type="button" data-a="j">Accept</button></div></div></div>`;
  function hostDoc() { try { if (window.top !== window && window.top.document) return window.top.document; } catch (e) {} return document; }
  function wire(root, inv, act, close) {
    root.querySelector('[data-a=j]').onclick = () => { close(); act.onAccept && act.onAccept(inv); };
    root.querySelector('[data-a=d]').onclick = () => { close(); act.onReject && act.onReject(inv); };
    setTimeout(() => { try { root.querySelector('[data-a=j]').focus(); } catch (e) {} }, 50);
  }
  function overlay(inv, act, done) {
    const doc = hostDoc(), o = doc.createElement('div');
    o.className = 'razzle-invite-overlay';
    o.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.25);z-index:2147483000';
    o.innerHTML = boxHtml(inv); doc.body.appendChild(o);
    const close = () => { o.remove(); done(); };
    wire(o, inv, act, close); return close;
  }
  function nativeWindow(inv, act, done) {
    let pw = null; try { pw = window.open('about:blank', 'yinvite_' + String(inv.id).replace(/[^a-z0-9]/gi, '').slice(0, 12)); } catch (e) {}
    if (!pw) return null;
    const d = pw.document; d.open();
    d.write('<!doctype html><html><head><meta charset=utf-8><base href="' + location.origin + '/"><title>Chat Room Invitation</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f8fc">' + boxHtml(inv) + '</body></html>');
    d.close();
    let closed = false;
    const close = () => { if (closed) return; closed = true; try { pw.close(); } catch (e) {} done(); };
    wire(d, inv, act, close);
    // Closing the window with its own X counts as Reject (silent).
    pw.addEventListener('beforeunload', () => { if (!closed) { closed = true; done(); act.onReject && act.onReject(inv); } });
    try { pw.focus(); } catch (e) {}
    return close;
  }
  function show(inv, act = {}) {
    if (!inv || !inv.id || open.has(inv.id)) return;
    const ttl = Math.max(1000, Math.min(120e3, inv.ttl || 120e3));
    const run = release => {
      const entry = {}; open.set(inv.id, entry);
      const done = () => { clearTimeout(entry.timer); open.delete(inv.id); release && release(); };
      const desktop = !!(window.YappDesktop && window.YappDesktop.inviteWindows);
      entry.close = (desktop && nativeWindow(inv, act, done)) || overlay(inv, act, done);
      entry.timer = setTimeout(() => entry.close(), ttl);
    };
    // Desktop app: several app windows get the same invite; only one shows it.
    if (window.YappDesktop && navigator.locks) navigator.locks.request('razzle-invite-' + inv.id, { ifAvailable: true }, lock => lock ? new Promise(run) : null);
    else run();
  }
  function close(id) { open.get(id)?.close(); }
  window.RazzleInvite = { show, close, isOpen: id => open.has(id) };
})();
