(() => {
  const frame = document.querySelector('#live-social-messenger');
  const send = (action, name) => {
    if (name && Object.hasOwn(sampleBotProfiles, name) && !previewFriends.has(name)) {
      toast('This is a sample profile. Add real contacts from Messenger.');
      return;
    }
    frame.scrollIntoView({block: 'nearest'});
    frame.contentWindow.postMessage({source: 'chatbabble-social', action, name}, location.origin);
  };
  window.privateChat = name => send('open-chat', name);
  window.request = name => send('add-contact', name);
  window.follow = name => send('add-contact', name);
  window.discover = () => send('add-contact');

  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow ||
        event.data?.source !== 'chatbabble-messenger') return;
    const { type, contacts, overlay } = event.data;
    if (type !== 'state') return;
    frame.classList.toggle('expanded', Boolean(overlay));
    if (!Array.isArray(contacts)) return;
    previewFriends.clear();
    contacts.filter(name => typeof name === 'string' && /^[a-z][a-z0-9_.-]{2,19}$/i.test(name))
      .forEach(name => previewFriends.add(name));
    syncPreviewFriends();
    if (current === 'following') relationshipPanel();
  });

  const localNote = document.createElement('p');
  localNote.className = 'preview-limit live-social-local-note';
  localNote.textContent = 'Signed in to Retrochat. Messenger and basic profile details use your account. Social posts, photos, and appearance are saved in this browser.';
  document.querySelector('main .intro').after(localNote);

  document.querySelector('#dialog').addEventListener('submit', async event => {
    const form = event.target;
    if (form.id !== 'edit-form' || form.dataset.accountSaved) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const fields = form.elements;
    const button = form.querySelector('button[type="submit"], button.primary');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          displayName: fields.displayAlias.value.trim(),
          age: fields.age.value,
          location: fields.location.value.trim(),
          bio: fields.bio.value.trim(),
          interests: fields.interests.value.trim(),
          sex: fields.sex.value,
          profileStatus: fields.personalStatus.value.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Profile could not be saved.');
      const updatedName = result.displayName || window.socialSession.alias;
      const state = { name: updatedName, changedAt: 0 };
      Object.assign(profileNameState, state);
      save('profileNameState', state);
      fields.displayAlias.value = updatedName;
      form.dataset.accountSaved = 'true';
      button.disabled = false;
      form.requestSubmit();
    } catch (error) {
      toast(error.message || 'Profile could not be saved.');
    } finally {
      button.disabled = false;
      delete form.dataset.accountSaved;
    }
  }, true);
})();
