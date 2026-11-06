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

  const avatarSocket = io();
  const profileData = name => fetch('/api/profile/' + encodeURIComponent(name), { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Profile could not load.');
      return response.json();
    });

  function rememberAvatar(record) {
    const alias = record.name.toLowerCase();
    if (!Object.hasOwn(YAv.cache, alias)) YAv.update(record.name, record.avatar);
  }

  window.socialAvatar = name => {
    const alias = name.toLowerCase();
    if (alias === currentAlias.toLowerCase() || Object.hasOwn(YAv.cache, alias)) {
      return YAv.html(name, YAv.cache[alias], 'avatar');
    }
    const user = person(name);
    return `<span class="avatar" style="background:${user.color};color:${user.ink}">${esc(name[0].toUpperCase())}</span>`;
  };
  YAv.listen(avatarSocket);

  function editProfileImage() {
    if (!avatarSocket.connected) { toast('Messenger is reconnecting. Try again in a moment.'); return; }
    YAv.editor(avatarSocket, { name: currentAlias, onSaved: version => YAv.update(currentAlias, version) });
  }

  const originalProfile = profile;
  window.profile = name => {
    originalProfile(name);
    const owner = name.toLowerCase() === currentAlias.toLowerCase();
    const body = document.querySelector('.profile-body');
    if (!body) return;
    const thumbnail = body.querySelector('.avatar');
    if (owner) {
      thumbnail.outerHTML = YAv.html(currentAlias, YAv.cache[currentAlias.toLowerCase()], 'avatar profile-portrait');
      const editImage = document.createElement('button');
      editImage.className = 'secondary';
      editImage.type = 'button';
      editImage.textContent = 'Edit profile image';
      editImage.onclick = editProfileImage;
      body.querySelector('.profile-controls').append(editImage);
    }

    profileData(name).then(record => {
      if (record.bot || record.guest) return;
      rememberAvatar(record);
      if (!body.isConnected) return;
      if (!owner) thumbnail.outerHTML = socialAvatar(record.name);
      body.querySelector('.profile-facts')?.remove();
      const facts = [['Age', record.age], ['Location', record.location], ['Sex', record.sex], ['Status', record.profileStatus]];
      const visibleFacts = owner ? facts : facts.filter(([, value]) => value);
      if (visibleFacts.length) body.querySelector('.handle').insertAdjacentHTML('afterend',
        '<dl class="profile-facts">' + visibleFacts.map(([label, value]) =>
          `<dt>${label}</dt><dd>${esc(value || 'Not set')}</dd>`).join('') + '</dl>');
      if (record.bio || owner) body.querySelector(':scope > p').textContent = record.bio || '';
    }).catch(() => { if (owner && body.isConnected) toast('Profile details could not load.'); });

    if (!owner) return;
    const groups = document.createElement('div');
    groups.className = 'profile-room-groups';
    body.append(groups);
    fetch('/api/rooms', { cache: 'no-store' }).then(response => {
      if (!response.ok) throw new Error('Room list could not load.');
      return response.json();
    }).then(rooms => {
      const roomLinks = list => '<ul>' + list.map(room =>
        `<li><a href="/rooms.html?room=${encodeURIComponent(room.name)}">${esc(room.name)}</a></li>`).join('') + '</ul>';
      const owned = rooms.filter(room => room.mine === 'owner' || room.owner?.toLowerCase() === currentAlias.toLowerCase());
      const favorites = rooms.filter(room => room.fav);
      groups.innerHTML = (owned.length ? '<h3>' + (owned.length === 1 ? 'My room' : 'My rooms') + '</h3>' + roomLinks(owned) : '') +
        '<h3>My favorite rooms</h3>' + (favorites.length ? roomLinks(favorites) : '<p>No rooms followed yet.</p>') +
        '<a href="/rooms.html">Choose rooms ↗</a>';
    }).catch(() => { groups.textContent = 'Rooms could not load.'; });
  };

  window.editProfile = async () => {
    let record;
    try { record = await profileData(currentAlias); }
    catch { toast('Profile could not load. Try again in a moment.'); return; }
    if (current !== 'profile' || window.profileName !== currentAlias || $('#dialog').open) return;
    modal(`<h2>Customize your space</h2>
      <form id="edit-form">
        <label>About your chat identity<textarea name="bio" maxlength="300">${esc(record.bio || '')}</textarea></label>
        <label>Age<input name="age" type="number" min="18" max="120" value="${esc(record.age ?? '')}"></label>
        <label>Location<input name="location" maxlength="50" value="${esc(record.location || '')}"></label>
        <label>Sex<input name="sex" maxlength="40" value="${esc(record.sex || '')}"></label>
        <label>Status<input name="profileStatus" maxlength="70" value="${esc(record.profileStatus || '')}"></label>
        <label>Cover color<input name="cover" type="color" value="${esc(cover)}"></label>
        <p>These fields are optional and appear on your public profile when filled in.</p>
        <p role="alert"></p>
        <button class="primary">Save your space</button>
      </form>`);
    const form = $('#edit-form');
    form.onsubmit = async event => {
      event.preventDefault();
      const data = new FormData(form);
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        const response = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            displayName: record.displayName, interests: record.interests,
            bio: data.get('bio'), age: data.get('age'), location: data.get('location'),
            sex: data.get('sex'), profileStatus: data.get('profileStatus')
          })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Profile could not be saved.');
        bio = data.get('bio');
        cover = data.get('cover');
        try { save('bio', bio); save('cover', cover); } catch { toast('Profile saved. Browser storage could not save your cover color.'); }
        if (form.isConnected && $('#dialog').open) {
          $('#dialog').close();
          profile(currentAlias);
        }
      } catch (error) {
        form.querySelector('[role="alert"]').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    };
  };

  const updateIdentity = () => {
    document.querySelectorAll('.identity strong').forEach(e => e.textContent = currentAlias);
    document.querySelectorAll('.identity small').forEach(e => e.textContent = '@' + currentAlias.toLowerCase() + ' · Your chat identity');
    document.querySelectorAll('.avatar.z').forEach(element => { element.outerHTML = socialAvatar(currentAlias); });
    const title = document.querySelector('.banner-copy strong'); if (title) title.textContent = 'This is your space, ' + currentAlias + '.';
    const side = document.querySelector('.identity'); if (side) side.onclick = () => profile(currentAlias);
    const profileBtn = document.querySelector('[aria-label="Your profile"]'); if (profileBtn) profileBtn.onclick = side.onclick;
    const yourSpace = [...document.querySelectorAll('.menu button')].find(e => e.textContent.includes('Your space')); if (yourSpace) yourSpace.onclick = side.onclick;
    const banBtn = document.querySelector('.banner-copy button'); if (banBtn) banBtn.onclick = side.onclick;
  };
  updateIdentity();
  profileData(currentAlias).then(rememberAvatar).catch(() => {});

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

  show('feed');
})();
