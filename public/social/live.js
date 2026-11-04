(() => {
  const dock = document.getElementById('live-dock'), frame = document.getElementById('live-messenger');
  const reopen = document.getElementById('reopen');
  const send = (action, name) => { openMessenger(); frame.contentWindow.postMessage({ source: 'chatbabble-social', action, name }, location.origin); };
  // Route messenger actions to the real app. Social follows stay local and separate.
  window.closeMessenger = () => { dock.hidden = true; reopen.hidden = false; };
  window.openMessenger = () => { dock.hidden = false; reopen.hidden = true; };
  window.privateChat = name => send('open-chat', name);
  window.request = name => send('add-contact', name);
  window.discover = () => send('add-contact');
  window.compose = (() => { const original = compose; return () => { if (currentAlias === 'Guest') { openMessenger(); toast('Sign in through Messenger to use your Social preview.'); return; } original(); }; })();
  window.info = () => modal('<h2>ChatBabble Social + your messenger</h2><p>The messenger uses your real account, contacts, contact requests, and presence. Close its panel to hide it; use its Sign Out menu to end the login.</p><p>The Social feed is still a local preview: posts, photos, follows, and comments stay in this browser, separated by your signed-in alias. Sample posts and profiles are examples, not live users. Voice and webcam use your existing messenger.</p>');
  const updateIdentity = () => {
    document.querySelectorAll('.identity strong').forEach(e => e.textContent = currentAlias);
    document.querySelectorAll('.identity small').forEach(e => e.textContent = currentAlias === 'Guest' ? 'Sign in through Messenger' : '@' + currentAlias.toLowerCase() + ' · Your chat identity');
    document.querySelectorAll('.avatar.z').forEach(e => e.textContent = currentAlias[0].toUpperCase());
    const title = document.querySelector('.banner-copy strong'); if (title) title.textContent = 'This is your space, ' + currentAlias + '.';
    const side = document.querySelector('.identity'); if (side) side.onclick = () => currentAlias === 'Guest' ? openMessenger() : profile(currentAlias);
    document.querySelector('[aria-label="Your profile"]').onclick = side.onclick;
    const yourSpace = [...document.querySelectorAll('.menu button')].find(e => e.textContent.includes('Your space')); if (yourSpace) yourSpace.onclick = side.onclick;
    document.querySelector('.banner-copy button').onclick = side.onclick;
  };
  updateIdentity();
  const note = document.createElement('p'); note.className = 'social-local-note'; note.textContent = 'Social is a local preview. Messenger uses your existing account.';
  document.querySelector('main .intro').after(note);
  const label = document.querySelector('.demo'); if (label) label.textContent = 'SOCIAL PREVIEW · LIVE MESSENGER';
  const sampleNote = document.createElement('div'); sampleNote.className = 'example-feed-note'; sampleNote.textContent = 'Sample community posts below. Your own Social posts are saved only in this browser; Messenger connects to your existing chat service.';
  document.getElementById('content').before(sampleNote);
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
      else if (!data.name && currentAlias !== 'Guest') fetch('/api/me', { cache: 'no-store' }).then(r => r.json()).then(me => { if (!me.name) location.reload(); }).catch(() => {});
    }
  });
})();
