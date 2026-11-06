(() => {
  const dock = document.getElementById('live-dock'), frame = document.getElementById('live-messenger');
  const reopen = document.getElementById('reopen');
  const send = (action, name) => { openMessenger(); frame.contentWindow.postMessage({ source: 'chatbabble-social', action, name }, location.origin); };
  window.closeMessenger = () => { dock.hidden = true; reopen.hidden = false; };
  window.openMessenger = () => { dock.hidden = false; reopen.hidden = true; };
  window.privateChat = name => send('open-chat', name);
  window.request = name => send('add-contact', name);
  const previewDiscover = discover;
  window.discover = (asModal = true) => asModal === false ? previewDiscover(false) : send('add-contact');
  window.compose = (() => { const original = compose; return () => { if (!window.LIVE_AUTH || currentAlias === 'Guest') { openMessenger(); toast('Sign in through Messenger first.'); return; } original(); }; })();
  window.info = () => modal('<h2>Razzle Social + Messenger</h2><p>You are signed in with your real Razzle account. Messenger uses your contacts, requests, and presence on this server.</p><p>Your own wall posts are saved in this browser for your screen name. Suggested profiles in Find your people are examples until you connect with real contacts in Messenger.</p>');

  // Live auth: do not mix synthetic seed posts into the signed-in feed.
  if (window.LIVE_AUTH && Array.isArray(seeds)) seeds.splice(0, seeds.length);

  const updateIdentity = () => {
    document.querySelectorAll('.identity strong').forEach(e => e.textContent = currentAlias);
    document.querySelectorAll('.identity small').forEach(e => e.textContent = '@' + currentAlias.toLowerCase() + ' · Your chat identity');
    document.querySelectorAll('.avatar.z').forEach(e => e.textContent = currentAlias[0].toUpperCase());
    const title = document.querySelector('.banner-copy strong'); if (title) title.textContent = 'This is your space, ' + currentAlias + '.';
    const side = document.querySelector('.identity'); if (side) side.onclick = () => profile(currentAlias);
    const profileBtn = document.querySelector('[aria-label="Your profile"]'); if (profileBtn) profileBtn.onclick = side.onclick;
    const yourSpace = [...document.querySelectorAll('.menu button')].find(e => e.textContent.includes('Your space')); if (yourSpace) yourSpace.onclick = side.onclick;
    const banBtn = document.querySelector('.banner-copy button'); if (banBtn) banBtn.onclick = side.onclick;
  };
  updateIdentity();

  const label = document.querySelector('.demo');
  if (label) { label.textContent = 'SIGNED IN'; label.classList.add('live-auth'); }
  document.querySelectorAll('.privacy-note button').forEach(b => { b.textContent = 'About Social'; });
  const foot = document.querySelector('.left footer'); if (foot) foot.innerHTML = 'Razzle Social<br><a href="/rooms.html">Room directory</a>';
  const note = document.createElement('p'); note.className = 'social-local-note';
  note.textContent = 'Signed in as ' + currentAlias + '. Messenger on the right is your live account.';
  document.querySelector('main .intro')?.after(note);

  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.source !== 'chatbabble-messenger') return;
    const data = event.data;
    if (data.type === 'close') closeMessenger();
    if (data.type === 'signin-required') { openMessenger(); toast('Sign in inside Messenger first.'); }
    if (data.type === 'state') {
      if (Array.isArray(data.contacts)) names.splice(0, names.length, ...data.contacts.filter(n => typeof n === 'string'));
      dock.classList.toggle('expanded', !!data.overlay);
      if (data.overlay) openMessenger();
      if (data.name && data.name !== currentAlias) location.reload();
      else if (!data.name && currentAlias !== 'Guest') fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }).then(r => r.json()).then(me => { if (!me.name) location.replace('/?chat=1&social=1'); }).catch(() => {});
    }
  });

  if (typeof render === 'function') render();
})();
