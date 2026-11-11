function createMessengerContactMenu({ contact, selected, blocked, isSelf, canInvite, actions }) {
  let menu = null, anchor = null;
  function close(restoreFocus = false) {
    menu?.remove();
    menu = null;
    if (restoreFocus && anchor?.isConnected) anchor.focus({ preventScroll: true });
    anchor = null;
  }

  document.addEventListener('pointerdown', event => {
    if (menu && !menu.contains(event.target)) close();
  });
  window.addEventListener('resize', () => close());
  window.addEventListener('blur', () => close());
  document.addEventListener('scroll', event => { if (menu && !menu.contains(event.target)) close(); }, true);

  return (event, row) => {
    const name = row.dataset.n;
    if (!contact(name)) return;
    event.preventDefault();
    event.stopPropagation();
    close();
    anchor = row;
    selected(name, row);
    const items = [['View profile', 'profile']];
    if (!isSelf(name)) {
      const isBlocked = blocked(name);
      if (!isBlocked) items.unshift(['Message', 'message']);
      if (!isBlocked && canInvite(name)) items.push(['Invite to room', 'invite']);
      items.push([isBlocked ? 'Unblock' : 'Block', isBlocked ? 'unblock' : 'block']);
    }
    if(!blocked(name))items.push(['Remove contact', 'remove']);

    menu = document.createElement('div');
    menu.className = 'messenger-contact-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Actions for ' + name);
    const buttons = items.map(([label, action]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      button.addEventListener('click', () => {
        close(true);
        actions[action](name);
      });
      menu.append(button);
      return button;
    });
    menu.addEventListener('keydown', keyEvent => {
      const index = buttons.indexOf(document.activeElement);
      if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); close(true); return; }
      if (keyEvent.key === 'Tab') { close(true); return; }
      const last = buttons.length - 1;
      const next = { ArrowDown: (index + 1) % buttons.length, ArrowUp: index <= 0 ? last : index - 1, Home: 0, End: last }[keyEvent.key];
      if (next !== undefined) { keyEvent.preventDefault(); buttons[next].focus({ preventScroll: true }); }
    });
    document.querySelectorAll('#menu > div.open').forEach(item => item.classList.remove('open'));
    document.body.append(menu);
    const rect = row.getBoundingClientRect();
    const keyboard = event.type === 'keydown' || (event.clientX === 0 && event.clientY === 0);
    const x = keyboard ? rect.left + 8 : event.clientX;
    const y = keyboard ? rect.bottom : event.clientY;
    menu.style.left = Math.max(4, Math.min(x, document.documentElement.clientWidth - menu.offsetWidth - 4)) + 'px';
    menu.style.top = Math.max(4, Math.min(y, innerHeight - menu.offsetHeight - 4)) + 'px';
    buttons[0].focus({ preventScroll: true });
  };
}
