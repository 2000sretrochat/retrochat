window.RazzleContactSearch = (() => {
  let panel;

  function open({ name, emit, view, block }) {
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
    dialog.setAttribute('aria-label', 'Find contacts');
    dialog.innerHTML = `<div class="tbar">Find contacts<span class="sp"></span><button type="button" class="x" aria-label="Close">×</button></div>
      <div class="pb"><label>Screen name <input type="text" maxlength="20" autocomplete="off"></label>
      <label>Request message (optional) <input type="text" maxlength="120"></label>
      <p role="status">Type at least 3 characters.</p><div class="directory-results"></div>
      <div class="directory-pages"><button type="button" data-prev>Previous</button><span></span><button type="button" data-next>Next</button></div></div>`;
    const [query, message] = dialog.querySelectorAll('input');
    const status = dialog.querySelector('[role=status]');
    const results = dialog.querySelector('.directory-results');
    const pages = dialog.querySelector('.directory-pages');
    const previous = pages.querySelector('[data-prev]');
    const next = pages.querySelector('[data-next]');
    let page = 0, timer, generation = 0;
    pages.hidden = true;
    const button = (label, action) => {
      const control = document.createElement('button');
      control.type = 'button';
      control.textContent = label;
      control.onclick = action;
      return control;
    };
    async function search() {
      const current = ++generation;
      const term = query.value.trim();
      results.replaceChildren();
      pages.hidden = true;
      if (term.length < 3) { status.textContent = 'Type at least 3 characters.'; return; }
      status.textContent = 'Searching…';
      const response = await emit('m:find-contacts', { query: term, page }).catch(() => ({ error: 'Search unavailable. Try again.' }));
      if (current !== generation || !dialog.isConnected) return;
      status.textContent = response.error || (response.people.length ? '' : 'No matching accounts.');
      if (response.error) return;
      for (const person of response.people) {
        const row = document.createElement('div');
        row.className = 'directory-person';
        const heading = document.createElement('strong');
        heading.textContent = person.name;
        row.append(heading, button('View profile', () => view(person.name)));
        const add = button(person.blocked ? 'Blocked' : person.contact ? 'Added' : 'Add', async () => {
          add.disabled = true;
          const reply = await emit('m:add', { name: person.name, msg: message.value });
          const added = reply.self || reply.added;
          status.textContent = reply.error || (added ? 'Added to your contacts.' : 'Contact request sent.');
          if (reply.error) add.disabled = false;
          else add.textContent = added ? 'Added' : 'Sent';
        });
        add.disabled = person.blocked || person.contact;
        row.append(add);
        if (!person.self && !person.blocked) row.append(button('Block', async () => {
          const reply = await block(person.name);
          if (reply?.ok) search();
        }));
        results.append(row);
      }
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
      results.replaceChildren();
      pages.hidden = true;
      status.textContent = query.value.trim().length < 3 ? 'Type at least 3 characters.' : 'Searching…';
      clearTimeout(timer);
      timer = setTimeout(search, 250);
    };
    query.onkeydown = event => { if (event.key === 'Enter') { clearTimeout(timer); search(); } };
    dialog.querySelector('.x').onclick = () => { clearTimeout(timer); dialog.remove(); };
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.querySelector('.x').click(); });
    document.body.append(dialog);
    query.value = name;
    query.focus();
    search();
  }

  return { open };
})();
