// Only this dedicated copy of Messenger speaks to the same-origin Social page.
(() => {
  const docked = parent !== window;
  document.documentElement.classList.toggle('messenger-popout', !docked);
  const bar = document.querySelector('#mwin > .tbar');
  bar.querySelector('.lgs').innerHTML = '<img class="razzle-mark" src="/social-next/conversation-circle.svg" alt="">';
  const controls = bar.querySelectorAll('.wb');
  const control = (old, id, label, svg) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wb'; button.id = id;
    button.title = label; button.setAttribute('aria-label', label); button.innerHTML = svg; old.replaceWith(button); return button;
  };
  const min = control(controls[0], 'dock-minimize', 'Collapse Messenger', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14"/></svg>');
  const pop = control(controls[1], 'dock-popout', 'Pop out Messenger and rooms', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M21 3l-10 10M10 5H4v15h15v-6"/></svg>');
  const close = control(controls[2], 'wx', docked ? 'Hide Messenger' : 'Close Messenger window', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'); close.classList.add('x');
  let collapsed = false;
  min.onclick = () => {
    collapsed = !collapsed; document.documentElement.classList.toggle('dock-collapsed', collapsed);
    min.title = collapsed ? 'Expand Messenger' : 'Collapse Messenger'; min.setAttribute('aria-label', min.title);
    if (docked) send({ type: 'collapse', collapsed });
  };
  pop.hidden = !docked;
  pop.onclick = () => send({ type: 'popout' });
  if (!docked) {
    close.onclick = () => window.close();
    addEventListener('message', event => {
      if(event.origin===location.origin && event.source===opener && event.data?.source==='chatbabble-social' && event.data.action==='open-chat' && typeof event.data.name==='string' && /^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(event.data.name) && ME && S?.connected)openIm(event.data.name);
    });
    const showRooms = setInterval(() => { if (!ME || !S?.connected) return; clearInterval(showRooms); document.getElementById('bRooms').click(); }, 200);
    return;
  }
  const send = payload => parent.postMessage({ source: 'chatbabble-messenger', ...payload }, location.origin);
  let last = '', scheduled = false;
  const sync = () => {
    scheduled = false;
    const overlay = !!document.querySelector('.im') || getComputedStyle(document.getElementById('brw')).display !== 'none' || getComputedStyle(document.getElementById('modal')).display !== 'none' || !!document.querySelector('#menu>div.open');
    const hasIm = !!document.querySelector('.im');
    document.documentElement.classList.toggle('has-overlay', overlay);
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
    if (action === 'expand') { collapsed = false; document.documentElement.classList.remove('dock-collapsed'); min.title = 'Collapse Messenger'; min.setAttribute('aria-label', min.title); return; }
    if (!ME || !S?.connected) { send({ type: 'signin-required' }); return; }
    if (action === 'open-chat' && typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(name)) openIm(name);
    if (action === 'add-contact') { document.getElementById('mAdd').click(); if (typeof name === 'string') { const input = document.querySelector('#modal input[type=text]'); if (input) input.value = name; } }
  });
})();
