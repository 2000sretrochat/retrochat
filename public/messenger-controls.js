(() => {
  function bindStatus({getMe, emit, decode, toast, onStatus, markActive}) {
    const status = document.getElementById('stsel');
    const message = document.getElementById('smsg');
    const clear = document.getElementById('clearStatus');
    const roomItem = document.getElementById('mShowRoom');
    const room = document.getElementById('mShowRoomCheck');
    // "Show my room" picker beside the status: Off, or one of the rooms I'm in (up to 4). Buddies see "In <Room>".
    let pickRoom = document.getElementById('adRoom');
    if (!pickRoom && status) {
      pickRoom = document.createElement('select');
      pickRoom.id = 'adRoom';
      pickRoom.setAttribute('aria-label', 'Room shown to buddies');
      status.after(pickRoom);
      const css = document.createElement('style');
      css.textContent = '#adRoom{all:unset;font:12px var(--sys,Tahoma,sans-serif);color:var(--muted,#567);cursor:pointer;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:6px;padding:0 14px 0 4px;border-left:1px solid var(--line,#c6d5e7);background:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 6%27%3E%3Cpath d=%27M0 0l5 6 5-6z%27 fill=%27%23667%27/%3E%3C/svg%3E") no-repeat right 2px center/8px 5px}#adRoom:disabled{opacity:.55;cursor:default}#adRoom:focus-visible{outline:2px solid #2468d7;outline-offset:1px}';
      document.head.appendChild(css);
    }
    const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
    function fillRooms(me, invisible) {
      if (!pickRoom) return;
      const rooms = Array.isArray(me.rooms) ? me.rooms : me.room ? [me.room] : [];
      const on = me.showRoom !== false, current = on ? (me.room || '') : '';
      pickRoom.innerHTML = '<option value="off">Room: Don’t show</option>' +
        (rooms.length ? '' : '<option value="*">Room: Show when I’m in one</option>') +
        rooms.map(r => '<option value="' + esc(r) + '">In ' + esc(r) + '</option>').join('');
      pickRoom.value = !on ? 'off' : current && rooms.includes(current) ? current : rooms.length ? rooms[0] : '*';
      pickRoom.disabled = invisible;
      pickRoom.title = invisible ? 'You are Invisible, so your room is hidden' : on && current ? 'Buddies see: In ' + current : 'Choose a room to show your buddies';
    }
    if (pickRoom) pickRoom.onchange = async () => {
      const me = getMe(); if (!me) return;
      const v = pickRoom.value;
      pickRoom.disabled = true;
      try {
        const result = await emit('m:showroom', v === 'off' ? {room: null} : v === '*' ? true : {room: v});
        if (result?.ok && me === getMe()) Object.assign(me, {showRoom: result.showRoom, adRoom: result.adRoom, room: result.room, rooms: result.rooms || me.rooms});
        else toast('Could not save room visibility');
      } finally {
        pickRoom.disabled = false;
        sync();
      }
    };
    let draft;
    let owner;
    let editVersion = 0;
    let saves = Promise.resolve();

    function sync() {
      const me = getMe();
      if (!me) return;
      if (owner !== me) { owner = me; draft = undefined; editVersion++; }
      status.value = me.status === 'brb' ? 'away' : me.status;
      // Masters can show their room too (incognito room windows are never listed by the server).
      const sharing = me.showRoom !== false;
      const invisible = status.value === 'invisible';
      message.disabled = invisible;
      message.readOnly = sharing;
      message.placeholder = sharing && !invisible ? 'Room sharing on' : "What's on your mind?";
      message.value = sharing && !invisible
        ? (me.room ? 'In ' + me.room : '')
        : draft ?? (me.msg === '[room]' ? '' : decode(me.msg || ''));
      message.title = sharing && !invisible && me.room ? message.value : '';
      clear.hidden = sharing || invisible || !message.value;
      roomItem.style.display = '';
      if (!room.disabled) room.checked = me.showRoom !== false;
      fillRooms(me, invisible);
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
      draft = value;
      const version = ++editVersion;
      saves = saves.catch(() => {}).then(async () => {
        if (me !== getMe()) return;
        const result = await emit('m:status', {msg: value});
        if (me !== getMe()) return;
        if (result?.ok) me.msg = result.msg;
        else toast('Could not save status');
        if (editVersion === version) draft = undefined;
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
      if (message.readOnly || message.disabled) return;
      draft = message.value;
      editVersion++;
      clear.hidden = !message.value;
    };
    message.onblur = () => {
      if (draft !== undefined && !message.readOnly && !message.disabled) save(draft);
    };
    clear.onpointerdown = event => event.preventDefault();
    clear.onclick = () => {
      if (message.readOnly || message.disabled) return;
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
