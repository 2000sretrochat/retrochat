// Only this dedicated copy of Messenger speaks to the same-origin Social page.
(() => {
  const docked = parent !== window;
  const select=document.getElementById('stsel'),statusInput=document.getElementById('smsg');
  select.querySelector('option[value="showroom"]').textContent="Show Room I'm In";
  const custom=document.createElement('option');custom.value='custom';custom.textContent='Custom…';select.appendChild(custom);statusInput.maxLength=60;
  const oldStatus=select.onchange;
  select.onchange=async()=>{
    if(select.value==='custom'){
      const result=await emit('m:status',{msg:''});if(result.error){select.value=ME.status;return;}
      ME.msg='';roomMode(false);statusInput.focus();return;
    }
    return oldStatus();
  };
  roomMode=on=>{
    statusInput.readOnly=!!on;statusInput.value=on?'Not in a room':dec(ME?.msg||'');
    statusInput.placeholder=on?"Room you're in":'Custom status (up to 60 characters)';select.value=ME?.status||'available';
    if(on&&S?.connected)emit('m:room-label').then(result=>{if(ME?.msg==='[room]')statusInput.value=result.room?'In: '+result.room:'Not in a room';});
  };
  const portraits=new Map();
  const paintPortraits=()=>{
    for(const row of document.querySelectorAll('#tree .ct[data-n]')){
      const source=portraits.get(row.dataset.n.toLowerCase()),av=row.querySelector('.av');if(!source||!av||av.dataset.socialPortrait===source)continue;
      if(av.tagName==='IMG')av.src=source;else {const image=new Image();image.src=source;image.alt=row.dataset.n+' profile photo';image.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit';av.replaceChildren(image);}
      av.dataset.socialPortrait=source;
    }
    const own=portraits.get(ME?.name?.toLowerCase()),av=document.getElementById('myav');if(own&&av?.tagName==='IMG')av.src=own;
  };
  const baseRender=render;render=()=>{baseRender();paintPortraits();};
  const syncProfiles=async()=>{
    if(!ME)return;
    if(ME.msg==='[room]')roomMode(true);
    try{const names=[ME.name,...Object.values(contacts).map(person=>person.name)];const response=await fetch('/social-next/api/portraits?names='+encodeURIComponent(names.join(',')));if(!response.ok)return;
      for(const person of await response.json())if(person.portrait)portraits.set(person.name.toLowerCase(),person.portrait);paintPortraits();
    }catch{}
  };
  setInterval(syncProfiles,10000);setTimeout(syncProfiles,800);
  document.documentElement.classList.toggle('messenger-popout', !docked);
  const bar = document.querySelector('#mwin > .tbar');
  bar.querySelector('.lgs').innerHTML = '<img class="razzle-mark" src="/social-next/conversation-circle.svg" alt="">';
  const controls = bar.querySelectorAll('.wb');
  const control = (old, id, label, svg) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'wb'; button.id = id;
    button.title = label; button.setAttribute('aria-label', label); button.innerHTML = svg; old.replaceWith(button); return button;
  };
  const min = control(controls[0], 'dock-minimize', 'Collapse Messenger', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14"/></svg>');
  const pop = control(controls[1], 'dock-popout', 'Open Messenger in a new window', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M21 3l-10 10M10 5H4v15h15v-6"/></svg>');
  const close = control(controls[2], 'wx', docked ? 'Hide Messenger' : 'Close Messenger window', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>'); close.classList.add('x');
  let collapsed = false;
  min.onclick = () => {
    collapsed = !collapsed; document.documentElement.classList.toggle('dock-collapsed', collapsed);
    min.title = collapsed ? 'Expand Messenger' : 'Collapse Messenger'; min.setAttribute('aria-label', min.title);
    if (docked) send({ type: 'collapse', collapsed });
  };
  pop.hidden = !docked;
  pop.onclick = () => {
    const {width,height}=bar.parentElement.getBoundingClientRect();
    send({type:'popout',width,height:collapsed?Math.min(660,screen.availHeight):height});
  };
  if (!docked) {
    close.onclick = () => window.close();
    addEventListener('message', event => {
      if(event.origin===location.origin && event.source===opener && event.data?.source==='chatbabble-social' && event.data.action==='open-chat' && typeof event.data.name==='string' && /^[A-Za-z][A-Za-z0-9_.]{2,19}$/.test(event.data.name) && ME && S?.connected)openIm(event.data.name);
    });
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
