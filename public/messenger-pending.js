// Contact requests I sent that are still waiting (Nov 13, 2026). Shown as a "Pending" group under Online/Offline so a
// contact you added doesn't seem to disappear until they accept. Cancel withdraws the request.
(function () {
  let list = [];
  const key = n => String(n || '').toLowerCase();
  const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  function set(names) { list = [...new Set((names || []).map(String))].sort((a, b) => a.localeCompare(b)); }
  function add(name) { if (name && !list.some(n => key(n) === key(name))) set([...list, name]); }
  function remove(name) { list = list.filter(n => key(n) !== key(name)); }
  function names() { return list.slice(); }
  // contacts: the page's contacts map (lowercase keys) so someone who already accepted never shows twice.
  function html({ contacts = {}, closed = false, q = '', av = () => '' } = {}) {
    const rows = list.filter(n => !contacts[key(n)] && (!q || key(n).includes(q)));
    if (!rows.length) return '';
    return '<div class="grp' + (closed ? ' closed' : '') + '" data-g="Pending">Pending (' + rows.length + ')</div>' + (closed ? '' : rows.map(n =>
      '<div class="ct off pct" data-pending="' + esc(n) + '" title="Waiting for ' + esc(n) + ' to accept your contact request">' +
      '<span class=avw>' + av(n) + '<span class="sdot offline"></span></span><div class=t><div class=n>' + esc(n) + '</div>' +
      '<div class=sm>Waiting to accept &middot; <button type=button class=pct-cancel data-cancel-req="' + esc(n) + '">Cancel</button></div></div></div>').join(''));
  }
  function bind(socket, rerender, emit, toast) {
    if (!socket || socket._rzPending) return; socket._rzPending = true;
    socket.on('m:sent', d => { if (!d || !d.name) return; d.on ? add(d.name) : remove(d.name); rerender(); });
    document.addEventListener('click', async ev => {
      const b = ev.target.closest && ev.target.closest('[data-cancel-req]'); if (!b) return;
      ev.preventDefault(); ev.stopPropagation(); b.disabled = true;
      const r = await emit('m:cancel-request', { name: b.dataset.cancelReq }).catch(() => ({ error: 'Could not cancel. Try again.' }));
      if (r && r.error) { b.disabled = false; toast && toast(esc(r.error)); return; }
      remove(b.dataset.cancelReq); rerender();
    }, true);
  }
  const css = document.createElement('style');
  css.textContent = '#tree .pct .sm{display:flex;align-items:center;gap:4px;flex-wrap:wrap}#tree .pct .n{opacity:.8}.pct-cancel{all:unset;cursor:pointer;color:inherit;text-decoration:underline;font:inherit}.pct-cancel:hover,.pct-cancel:focus-visible{opacity:.8;outline:none}';
  (document.head || document.documentElement).appendChild(css);
  window.RazzlePending = { set, add, remove, names, html, bind };
})();
