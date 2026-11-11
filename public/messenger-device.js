(function(){
  const paths={mobile:'<rect x="5" y="1.5" width="10" height="17" rx="2"/><path d="M9 15.5h2"/>',browser:'<rect x="1.5" y="3" width="17" height="14" rx="2"/><path d="M2 7h16M5 5h.1M8 5h.1"/>'};
  function icon(kind,online=true){if(!online||!paths[kind])return '';const label=kind==='mobile'?'Using mobile':'Using a browser';return '<span class="messenger-device" title="'+label+'" role="img" aria-label="'+label+'"><svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">'+paths[kind]+'</svg></span>';}
  function auth(client){const desktop=window.YappDesktop?.isDesktop;const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1;return {...(client?{client}:{}),device:desktop?'desktop':mobile?'mobile':'browser'};}
  function showGuest(){
    document.documentElement.classList.add('guest-messenger');
    document.getElementById('signin').style.display='none';document.getElementById('main').style.display='flex';
    document.getElementById('myname').textContent='Guest';
    for(const id of ['search','reqs','offlinePanel','tabs']){const el=document.getElementById(id);if(el)el.hidden=true;}
    const presence=document.getElementById('stsel')?.closest('.me');if(presence)presence.hidden=true;
    document.getElementById('tree').innerHTML='<section class="guest-messenger-notice"><h2>Your contacts</h2><p>Guests can visit chat rooms, but cannot add friends or be added.</p><p>Create a free screen name or sign in to keep a contact list.</p><a class="btn pri" href="https://github.com/2000sretrochat/retrochat/releases/latest/download/RazzleMessenger-Setup.exe">Download Messenger</a><p><a href="/?chat=1&amp;signup=1">Create an account</a> · <a href="/?chat=1">Sign in</a></p></section>';
    document.querySelectorAll('#menu > div').forEach(el=>el.hidden=true);
    const add=document.getElementById('bAdd');if(add){add.disabled=true;add.title='Sign in with an account to add friends';}
    const rooms=document.getElementById('bRooms');if(rooms)rooms.onclick=()=>window.open('/rooms.html','yapprooms');
    const status=document.getElementById('smsg');if(status){status.disabled=true;status.value='Guest · Chat rooms only';}
    const select=document.getElementById('stsel');if(select)select.disabled=true;
    const x=document.getElementById('wx');if(x)x.onclick=()=>window.close();
  }
  window.RazzleDevice={icon,auth,showGuest};
  // A guest entry opens an empty list, never an account socket or saved contacts.
  const guestEntry=()=>{if(new URLSearchParams(location.search).get('guest')==='1')fetch('/api/me',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(me=>{if(!me.name)showGuest();}).catch(()=>{});};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',guestEntry,{once:true});else guestEntry();
})();
