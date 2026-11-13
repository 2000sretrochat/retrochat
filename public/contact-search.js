// Add a contact (Nov 13, 2026): centered dialog with live, debounced, case-insensitive suggestions after 3 characters.
// The server never lists you or anyone blocked either way; people already in your list show "Already added".
window.RazzleContactSearch = (() => {
  let panel;
  const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  const avatar = person => {
    try { if (window.YAv && YAv.html) return YAv.html(person.name, person.avatar || 'a1', 'sm'); } catch {}
    return '<img class="cd-av" alt="" src="/av/' + encodeURIComponent(person.name) + '?v=' + encodeURIComponent(person.avatar || 'a1') + '">';
  };

  function open({ name, emit, view }) {
    if (panel?.isConnected && !panel._pw?.closed) {
      panel._pw?.focus();
      if (name) {
        panel.querySelector('input').value = name;
        panel.querySelector('input').dispatchEvent(new Event('input'));
      }
      panel.querySelector('input').focus();
      return;
    }
    const dialog = document.createElement('div');
    panel = dialog;
    dialog.className = 'yprof contact-directory';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Add a contact');
    dialog.innerHTML = `<div class="tbar">Add a contact<span class="sp"></span><button type="button" class="x" aria-label="Close">×</button></div>
      <div class="pb"><p class="cd-intro">Find friends by their screen name. Start typing and pick them from the list.</p>
      <label class="cd-field">Screen name <input type="search" maxlength="20" autocomplete="off" spellcheck="false" placeholder="Type at least 3 letters" aria-controls="cd-results"></label>
      <p role="status" class="cd-status">Type at least 3 characters.</p><div class="directory-results" id="cd-results" role="list"></div>
      <div class="directory-pages"><button type="button" data-prev>Previous</button><span></span><button type="button" data-next>Next</button></div>
      <label class="cd-field">Message with your request (optional) <input type="text" maxlength="120" placeholder="Hi! It's me from the Lobby"></label></div>`;
    const [query, message] = dialog.querySelectorAll('input');
    const status = dialog.querySelector('[role=status]');
    const results = dialog.querySelector('.directory-results');
    const pages = dialog.querySelector('.directory-pages');
    const previous = pages.querySelector('[data-prev]');
    const next = pages.querySelector('[data-next]');
    let page = 0, timer, generation = 0;
    pages.hidden = true;
    function row(person) {
      const item = document.createElement('div');
      item.className = 'directory-person';
      item.setAttribute('role', 'listitem');
      item.innerHTML = '<span class="cd-avw">' + avatar(person) + '</span><span class="cd-who"><strong></strong><small></small></span>';
      item.querySelector('strong').textContent = person.name;
      item.querySelector('small').textContent = person.hint || '';
      const profile = document.createElement('button');
      profile.type = 'button'; profile.className = 'cd-link'; profile.textContent = 'Profile';
      profile.onclick = () => view(person.name);
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'cd-add';
      const done = person.contact ? 'Already added' : person.sent ? 'Request sent' : '';
      add.textContent = done || 'Add';
      add.disabled = !!done;
      add.onclick = async () => {
        add.disabled = true; add.textContent = 'Adding…';
        const reply = await emit('m:add', { name: person.name, msg: message.value }).catch(() => ({ error: 'Could not add. Try again.' }));
        const added = reply.self || reply.added;
        status.textContent = reply.error || (added ? person.name + ' was added to your contacts.' : 'Request sent. ' + person.name + ' shows under Pending until they accept.');
        if (reply.error) { add.disabled = false; add.textContent = 'Add'; return; }
        add.textContent = added ? 'Already added' : 'Request sent';
        item.querySelector('small').textContent = added ? 'In your list' : 'Request sent';
      };
      item.append(profile, add);
      return item;
    }
    async function search() {
      const current = ++generation;
      const term = query.value.trim();
      results.replaceChildren();
      pages.hidden = true;
      if (term.length < 3) { status.textContent = 'Type at least 3 characters.'; return; }
      status.textContent = 'Searching…';
      const response = await emit('m:find-contacts', { query: term, page }).catch(() => ({ error: 'Search unavailable. Try again.' }));
      if (current !== generation || !dialog.isConnected) return;
      status.textContent = response.error || (response.people.length ? '' : 'No one found with that screen name.');
      if (response.error) return;
      for (const person of response.people) results.append(row(person));
      previous.disabled = page === 0;
      next.disabled = !response.more;
      pages.hidden = page === 0 && !response.more;
      pages.querySelector('span').textContent = 'Page ' + (page + 1);
    }
    previous.onclick = () => { if (page > 0) { page--; search(); } };
    next.onclick = () => { page++; search(); };
    query.oninput = () => {
      generation++;
      page = 0;
      pages.hidden = true;
      if (query.value.trim().length < 3) { results.replaceChildren(); status.textContent = 'Type at least 3 characters.'; clearTimeout(timer); return; }
      status.textContent = 'Searching…';
      clearTimeout(timer);
      timer = setTimeout(search, 300);
    };
    query.onkeydown = event => {
      if (event.key === 'Enter') { clearTimeout(timer); search(); }
      if (event.key === 'ArrowDown') { const first = results.querySelector('.cd-add:not(:disabled)'); if (first) { event.preventDefault(); first.focus(); } }
    };
    dialog.querySelector('.x').onclick = () => { clearTimeout(timer); dialog.remove(); };
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.querySelector('.x').click(); });
    document.body.append(dialog);
    query.value = name || '';
    query.focus();
    if (query.value.trim().length >= 3) search();
  }

  return { open };
})();
