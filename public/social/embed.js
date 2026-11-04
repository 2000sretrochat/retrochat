// Only this dedicated copy of Messenger speaks to the same-origin Social page.
(() => {
  if (parent === window) return;
  const send = payload => parent.postMessage({ source: 'chatbabble-messenger', ...payload }, location.origin);
  let last = '', scheduled = false;
  const sync = () => {
    scheduled = false;
    const overlay = !!document.querySelector('.im') || getComputedStyle(document.getElementById('brw')).display !== 'none' || getComputedStyle(document.getElementById('modal')).display !== 'none' || !!document.querySelector('#menu>div.open');
    const hasIm = !!document.querySelector('.im');
    if (document.documentElement.classList.contains('has-im') !== hasIm) document.documentElement.classList.toggle('has-im', hasIm);
    const state = { type: 'state', name: ME?.name || null, connected: !!S?.connected, overlay, contacts: Object.values(contacts).map(c => c.name) };
    const next = JSON.stringify(state); if (next !== last) { last = next; send(state); }
  };
  const observer = new MutationObserver(() => { if (!scheduled) { scheduled = true; requestAnimationFrame(sync); } });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  setInterval(sync, 1500); sync();
  // Close the dock, without signing out or disconnecting the account.
  document.getElementById('wx').onclick = () => send({ type: 'close' });
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== parent || event.data?.source !== 'chatbabble-social') return;
    const { action, name } = event.data;
    if (!ME || !S?.connected) { send({ type: 'signin-required' }); return; }
    if (action === 'open-chat' && typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(name)) openIm(name);
    if (action === 'add-contact') { document.getElementById('mAdd').click(); if (typeof name === 'string') { const input = document.querySelector('#modal input[type=text]'); if (input) input.value = name; } }
  });
})();
