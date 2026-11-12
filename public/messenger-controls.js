(() => {
  function bindStatus({getMe, emit, decode, toast, onStatus, markActive}) {
    const status = document.getElementById('stsel');
    const message = document.getElementById('smsg');
    const clear = document.getElementById('clearStatus');
    const roomItem = document.getElementById('mShowRoom');
    const room = document.getElementById('mShowRoomCheck');
    let draft = false;
    let editVersion = 0;
    let saves = Promise.resolve();

    function sync() {
      const me = getMe();
      if (!me) return;
      status.value = me.status === 'brb' ? 'away' : me.status;
      if (!draft) message.value = me.msg === '[room]' ? '' : decode(me.msg || '');
      clear.hidden = !message.value;
      roomItem.style.display = me.m ? 'none' : '';
      if (!room.disabled) room.checked = me.showRoom !== false;
    }

    status.onchange = async () => {
      const me = getMe();
      markActive();
      const result = await emit('m:status', {status: status.value});
      if (me !== getMe()) return;
      if (result?.status) {
        me.status = result.status;
        onStatus();
      } else toast('Could not save status');
      sync();
    };

    room.onchange = async () => {
      const me = getMe();
      room.disabled = true;
      try {
        const result = await emit('m:showroom', room.checked);
        if (result?.ok && me === getMe()) me.showRoom = result.showRoom;
        else toast('Could not save room visibility');
      } finally {
        room.disabled = false;
        sync();
      }
    };

    function save(value) {
      const me = getMe();
      if (!me) return;
      draft = true;
      const version = ++editVersion;
      saves = saves.catch(() => {}).then(async () => {
        if (me !== getMe()) return;
        const result = await emit('m:status', {msg: value});
        if (me !== getMe()) return;
        if (result?.ok) me.msg = result.msg;
        else toast('Could not save status');
        if (editVersion === version) draft = false;
        sync();
      });
    }

    message.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        message.blur();
      }
    });
    message.oninput = () => {
      draft = true;
      editVersion++;
      clear.hidden = !message.value;
    };
    message.onblur = () => {
      if (draft) save(message.value);
    };
    clear.onpointerdown = event => event.preventDefault();
    clear.onclick = () => {
      message.value = '';
      clear.hidden = true;
      message.focus();
      save('');
    };
    return {sync};
  }

  const roles = '[role^="menuitem"]';
  let active;
  let menuId = 0;
  const items = menu => [...menu.querySelectorAll(roles)].filter(
    item => !item.disabled && item.getClientRects().length
  );

  function close(restoreFocus = false) {
    if (!active) return;
    const {button, toggle} = active;
    active = null;
    toggle(false);
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus && button.isConnected) button.focus();
  }

  function attach(button, menu, toggle, peers = () => []) {
    menu.id ||= 'messenger-menu-' + ++menuId;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', button.getAttribute('aria-label') || button.textContent.trim());
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', menu.id);

    function open(last = false) {
      close();
      active = {button, menu, toggle};
      toggle(true);
      button.setAttribute('aria-expanded', 'true');
      const visible = items(menu);
      (last ? visible.at(-1) : visible[0])?.focus();
    }
    button.onclick = () => active?.button === button ? close(true) : open();
    button.onkeydown = event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        open(event.key === 'ArrowUp');
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const buttons = peers();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        buttons[(buttons.indexOf(button) + offset + buttons.length) % buttons.length]?.focus();
      }
    };

    menu.addEventListener('keydown', event => {
      const visible = items(menu);
      const index = visible.indexOf(event.target);
      let next;
      switch (event.key) {
        case 'ArrowDown': next = (index + 1) % visible.length; break;
        case 'ArrowUp': next = (index + visible.length - 1) % visible.length; break;
        case 'Home': next = 0; break;
        case 'End': next = visible.length - 1; break;
        case 'Escape': event.preventDefault(); close(true); return;
        case 'Tab': close(true); return;
        case 'Enter':
          if (event.target.matches('input[type=checkbox]')) {
            event.preventDefault();
            event.target.click();
          }
          return;
        default: return;
      }
      event.preventDefault();
      visible[next]?.focus();
    });
  }

  function itemButton(item) {
    const button = document.createElement('button');
    for (const attr of item.attributes) button.setAttribute(attr.name, attr.value);
    button.type = 'button';
    button.tabIndex = -1;
    if (!button.hasAttribute('role')) button.setAttribute('role', 'menuitem');
    button.innerHTML = item.innerHTML;
    item.replaceWith(button);
    return button;
  }

  function bindMenu(button, menu, toggle, peers) {
    for (const item of menu.querySelectorAll(':scope > div')) {
      const checkbox = item.querySelector('input[type=checkbox]');
      if (checkbox) {
        checkbox.setAttribute('role', 'menuitemcheckbox');
        checkbox.tabIndex = -1;
      } else itemButton(item);
    }
    for (const separator of menu.querySelectorAll('hr')) separator.setAttribute('role', 'separator');
    attach(button, menu, toggle, peers);
    menu.addEventListener('click', event => {
      if (event.target.closest('button' + roles) && active?.menu === menu) {
        const focused = menu.ownerDocument.activeElement;
        close(menu.contains(focused) || focused === menu.ownerDocument.body);
      }
    });
  }

  function bindMenuBar(bar) {
    const buttons = [];
    for (const group of bar.children) {
      const menu = group.querySelector(':scope > .dd');
      if (!menu) continue;
      group.classList.add('desktop-menu-group');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'desktop-menu-trigger';
      button.textContent = group.firstChild.textContent.trim();
      group.firstChild.replaceWith(button);
      buttons.push(button);
      bindMenu(button, menu, open => group.classList.toggle('open', open), () => buttons);
    }
  }

  document.addEventListener('pointerdown', event => {
    if (active && !active.menu.contains(event.target) && !active.button.contains(event.target)) close();
  });
  window.RazzleMessengerControls = {bindStatus, bindMenuBar, bindMenu, attach, close};
})();
