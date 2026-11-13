// Settings window: Privacy (buddy-only private messages), Blocked list, Ignore list. Shared by Rooms and Messenger.
window.YSet=(function(){const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S=null,P={ignored:[],blocked:[],hide:[],pmBuddies:false,account:false};const subs=[];
const alertKeys={room:'ycFollowedRoomAlerts',webcam:'ycWebcamAlerts'};
const alertEnabled=kind=>localStorage.getItem(alertKeys[kind])==='on';
const syncAlerts=()=>{if(S?.connected)S.emit('room-alerts:set',{room:alertEnabled('room'),webcam:alertEnabled('webcam')});};
addEventListener('storage',event=>{if(Object.values(alertKeys).includes(event.key))syncAlerts();});
function showRoomAlert(alert,join){
 if(!alert || !Object.hasOwn(alertKeys,alert.kind) || !alertEnabled(alert.kind) || document.hidden) return;
 const recent=JSON.parse(localStorage.getItem('ycRecentRoomAlerts')||'[]');
 if(recent.includes(alert.id))return;
 localStorage.setItem('ycRecentRoomAlerts',JSON.stringify([...recent.slice(-19),alert.id]));
 let stack=document.querySelector('.room-alert-stack');
 if(!stack){stack=document.createElement('aside');stack.className='room-alert-stack';stack.setAttribute('aria-label','Room notifications');document.body.append(stack);}
 if(stack.children.length>=3)stack.firstElementChild.remove();
 const toast=document.createElement('div');toast.className='room-activity-toast';
 const message=document.createElement('span');message.setAttribute('role','status');
 message.textContent=alert.kind==='webcam'?alert.name+' went live on webcam in '+alert.room:alert.room+' is active now';
 const button=document.createElement('button');button.type='button';button.textContent='Join';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Dismiss notification');
 let timer;const dismiss=()=>{clearTimeout(timer);toast.remove();if(!stack.children.length)stack.remove();};
 const expire=()=>{clearTimeout(timer);timer=setTimeout(dismiss,12_000);};
 button.onclick=()=>{dismiss();join(alert.room);};close.onclick=dismiss;
 toast.onmouseenter=()=>clearTimeout(timer);toast.onmouseleave=()=>{if(!toast.contains(document.activeElement))expire();};
 toast.onfocusin=()=>clearTimeout(timer);toast.onfocusout=event=>{if(!toast.contains(event.relatedTarget)&&!toast.matches(':hover'))expire();};
 toast.append(message,button,close);stack.append(toast);expire();
}
const fire=()=>subs.forEach(f=>f(P));
function emit(ev,d){return new Promise(r=>d===undefined?S.emit(ev,r):S.emit(ev,d,r))}
const GKEY='ycIgnore';
function loadGuestIgn(){try{return JSON.parse(localStorage.getItem(GKEY)||'[]').map(n=>String(n).toLowerCase()).filter(Boolean)}catch{return[]}}
function saveGuestIgn(names){try{localStorage.setItem(GKEY,JSON.stringify([...new Set((names||[]).map(n=>String(n).toLowerCase()).filter(Boolean))]))}catch{}}
function mergeGuestIgn(r){if(!r||r.account)return r;const ignored=[...new Set([...(r.ignored||[]),...loadGuestIgn()])];return Object.assign({},r,{ignored,hide:[...new Set([...(r.hide||[]),...ignored])]})}
function applyRemote(r){if(!r||r.error)return;P=r.account?r:mergeGuestIgn(r);if(!P.account)saveGuestIgn(P.ignored);fire()}
let ignCh;try{ignCh=typeof BroadcastChannel==='function'?new BroadcastChannel('yc-ignore'):null}catch(e){ignCh=null}
function tellGuestIgn(){if(P.account)return;saveGuestIgn(P.ignored);try{ignCh&&ignCh.postMessage({ignored:P.ignored})}catch(e){}}
if(ignCh)ignCh.onmessage=ev=>{if(P.account||!ev||!ev.data||!ev.data.ignored)return;saveGuestIgn(ev.data.ignored);P=mergeGuestIgn(Object.assign({},P,{ignored:[]}));fire();replayGuestIgn()};
addEventListener('storage',ev=>{if(ev.key!==GKEY||P.account)return;P=mergeGuestIgn(Object.assign({},P,{ignored:[]}));fire();replayGuestIgn()});
async function replayGuestIgn(){if(!S||!S.connected||P.account)return;for(const n of loadGuestIgn()){if(!P.ignored.includes(n)){const r=await emit('ign:set',{name:n,on:true});if(r&&!r.error)P=mergeGuestIgn(r)}}fire()}
async function refresh(){const r=await emit('prefs');if(r&&!r.error){applyRemote(r);if(!P.account)await replayGuestIgn()}return P}
function init(sock,join){S=sock;S.on('connect',refresh);S.on('prefs:update',applyRemote);if(join){S.on('connect',syncAlerts);S.on('room-alert',alert=>showRoomAlert(alert,join));syncAlerts();}S.on('signed-elsewhere',d=>{alert((d&&d.text)||'Signed in elsewhere');});
 S.on('connect_error',e=>{if(/Too many users|banned/i.test(e.message)){S.io.opts.reconnection=false;alert(e.message=='banned'?'You are banned.':e.message)}});if(S.connected)refresh()}
const hidden=n=>P.hide.includes(String(n||'').replace(/&#39;/g,"'").toLowerCase());
async function setIgnore(n,on){const r=await emit('ign:set',{name:n,on});if(r.error)alert(r.error);else{applyRemote(r);tellGuestIgn()}return r}
async function setBlock(n,on){const r=await emit('blk:set',{name:n,on});if(r.error)alert(r.error);else applyRemote(r);return r}
let settingsPanel, openingSettings;
function open(tab){
 if(settingsPanel?.isConnected){settingsPanel._pw?.focus();settingsPanel.focus();return;}
 if(!openingSettings)openingSettings=renderSettings(tab).finally(()=>{openingSettings=null;});
 return openingSettings;
}
async function renderSettings(tab){await refresh();const w=document.createElement('div');w.className='yprof yset razzle-settings-dialog';w.tabIndex=-1;settingsPanel=w;
 const list=(a,k,lbl)=>a.length?a.map(n=>`<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><b style="flex:1">${E(n)}</b><button data-k=${k} data-n="${E(n)}">${lbl}</button></div>`).join(''):'<div style="color:var(--muted)">Nobody.</div>';
 w.innerHTML=`<div class=tbar>Settings<span class=sp></span><button type="button" class="x settings-close" aria-label="Close settings" title="Close"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div class=pb style="min-width:300px">
 <h4 style="margin:4px 0">Privacy</h4>${P.account?`<label><input type=checkbox id=ysPm ${P.pmBuddies?'checked':''}> Only allow private messages from people on my buddy list</label>`:'<small>Sign in with a screen name to use privacy settings.</small>'}
 <h4 style="margin:12px 0 4px">Blocked list</h4><small style="color:var(--muted)">Blocked people can't see you online, PM you, add you, or view your cam.</small>${P.account?list(P.blocked,'b','Unblock'):'<div><small>Guests can use Ignore.</small></div>'}
 <h4 style="margin:12px 0 4px">Ignore list</h4><small style="color:var(--muted)">You won't see or hear ignored chatters in rooms.${P.account?'':' (Guests: saved on this device until you unignore them.)'}</small>${list(P.ignored,'i','Unignore')}
 ${P.account?`<h4 style="margin:12px 0 4px">Notifications</h4><label><input type=checkbox id=ysRoomAlerts ${alertEnabled('room')?'checked':''}> Followed rooms become active</label><br><label><input type=checkbox id=ysWebcamAlerts ${alertEnabled('webcam')?'checked':''}> Someone goes live on webcam</label><p class="archive-help">Show a quiet Join notification while Razzle is open.</p>`:''}
 <h4 style="margin:12px 0 4px">Sounds</h4><label><input type=checkbox id=ysMute ${localStorage.ycSound=='off'?'checked':''}> Mute all sounds</label><br><label><input type=checkbox id=ysPmPop ${localStorage.ycPmPop!='off'?'checked':''}> Pop up new private messages</label><br><label><input type=checkbox id=ysNsnd ${localStorage.ycNotifSound!='off'?'checked':''}> Notification sound (soft chime for new notifications)</label><br><label><input type=checkbox id=ysShake ${localStorage.ycShake=='off'?'checked':''}> Disable buzz shake</label><br><label><input type=checkbox id=ysRb ${localStorage.ycRoomBuzz!='off'?'checked':''}> Allow room buzzes (sound + shake)</label><br><label><input type=checkbox id=ysDoor ${localStorage.ycDoor!='off'?'checked':''}> Play door open/close sounds when buddies sign in or out</label><h4 style="margin:12px 0 4px">Read receipts</h4><label><input type=checkbox id=ysRr> Read receipts (show &quot;Seen&quot; in PMs; only works when both people turn it on)</label>
 ${window.YDict?`<h4 style="margin:12px 0 4px">Dictation</h4><label>Speech-to-text language <select id=ysDl><option value="">Browser default</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="es-ES">Español</option><option value="fr-FR">Français</option><option value="de-DE">Deutsch</option><option value="it-IT">Italiano</option><option value="pt-BR">Português</option><option value="ru-RU">Русский</option><option value="zh-CN">中文 (普通话)</option><option value="zh-HK">粵語</option><option value="ja-JP">日本語</option><option value="ko-KR">한국어</option><option value="fil-PH">Filipino</option><option value="vi-VN">Tiếng Việt</option><option value="th-TH">ไทย</option><option value="id-ID">Bahasa Indonesia</option><option value="ms-MY">Bahasa Melayu</option><option value="hi-IN">हिन्दी</option><option value="ta-IN">தமிழ்</option><option value="te-IN">తెలుగు</option><option value="pa-IN">ਪੰਜਾਬੀ</option><option value="bn-IN">বাংলা</option><option value="gu-IN">ગુજરાતી</option><option value="mr-IN">मराठी</option><option value="ur-PK">اردو</option><option value="ar-SA">العربية</option><option value="tr-TR">Türkçe</option><option value="pl-PL">Polski</option><option value="nl-NL">Nederlands</option></select></label>`:''}
 <h4 style="margin:12px 0 4px">Message Archive</h4>${P.account?`<label><input type=checkbox id=ysArc> Save new private messages</label><p class="archive-help">Turning this off stops saving new messages. Messages already saved stay here until you delete them.</p><div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px"><input id=ysAq placeholder="Search messages or a screen name" style="flex:1"><button id=ysAs>Search</button><button id=ysAd>Delete all</button></div><div id=ysAr style="font-size:12px;margin-top:4px"></div>`:'<small>Sign in with a screen name to keep an archive.</small>'}</div>`;
 sectionSettings(w,tab);
 document.body.appendChild(w);w.querySelector('.x').onclick=()=>w.remove();
 {const dl=w.querySelector('#ysDl');if(dl){dl.value=localStorage.ycDictLang||'';dl.onchange=()=>YDict.setLang(dl.value)}}
 for(const [id,kind] of [['ysRoomAlerts','room'],['ysWebcamAlerts','webcam']]){const input=w.querySelector('#'+id);if(input)input.onchange=()=>{localStorage.setItem(alertKeys[kind],input.checked?'on':'off');syncAlerts();};}
 w.querySelector('#ysPmPop').onchange=e=>{localStorage.ycPmPop=e.target.checked?'on':'off'};w.querySelector('#ysNsnd').onchange=e=>{localStorage.ycNotifSound=e.target.checked?'on':'off'};w.querySelector('#ysMute').onchange=e=>{localStorage.ycSound=e.target.checked?'off':'on';try{window.dispatchEvent(new Event('ycsound'))}catch(x){}};
 w.querySelector('#ysDoor').onchange=e=>localStorage.ycDoor=e.target.checked?'on':'off';w.querySelector('#ysShake').onchange=e=>localStorage.ycShake=e.target.checked?'off':'on';w.querySelector('#ysRb').onchange=e=>localStorage.ycRoomBuzz=e.target.checked?'on':'off';
 {const rr=w.querySelector('#ysRr');fetch('/api/receipts').then(r=>r.json()).then(j=>rr.checked=!!j.on).catch(()=>{});rr.onchange=()=>fetch('/api/receipts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:rr.checked})}).then(r=>r.json()).then(j=>{window.YRR=!!j.on})}
 const arc=w.querySelector('#ysArc');if(arc){let archivePage=0;const show=async()=>{const r=await emit('m:arch-get',{q:w.querySelector('#ysAq').value.trim()});if(r.error)return;arc.checked=r.on;
   const output=w.querySelector('#ysAr');const pages=Math.max(1,r.rows.length);archivePage=Math.min(archivePage,pages-1);
   output.innerHTML=r.rows.length?r.rows.slice(archivePage,archivePage+1).map(x=>`<div style="padding:2px 0;border-bottom:1px dotted #ccc"><small>${new Date(x.t).toLocaleString()}</small> <b>${x.dir=='out'?'To':'From'} ${E(x.peer)}:</b> ${x.text} <a href=# data-del="${E(x.peer)}" title="Delete conversation with ${E(x.peer)}">&times;</a></div>`).join(''):'<div style="color:var(--muted)">'+'No saved messages.'+'</div>';
   if(pages>1)pageControls(output,archivePage,pages,n=>{archivePage=n;show();});
   w.querySelectorAll('[data-del]').forEach(a=>a.onclick=async e=>{e.preventDefault();if(confirm('Delete all saved messages with '+a.dataset.del+'?')){await emit('m:arch-del',{peer:a.dataset.del});show()}})};
  arc.onchange=async()=>{await emit('m:arch-set',{on:arc.checked});show()};w.querySelector('#ysAs').onclick=()=>{archivePage=0;show();};w.querySelector('#ysAq').onkeydown=e=>e.key=='Enter'&&show();
  w.querySelector('#ysAd').onclick=async()=>{if(confirm('Delete your whole message archive?')){await emit('m:arch-del',{});show()}};show()}
 const pm=w.querySelector('#ysPm');if(pm)pm.onchange=async()=>{const r=await emit('priv:set',{pmBuddies:pm.checked});if(r.error)alert(r.error);else{P=r;fire()}};
 w.querySelectorAll('button[data-k]').forEach(b=>b.onclick=async()=>{await(b.dataset.k=='b'?setBlock(b.dataset.n,false):setIgnore(b.dataset.n,false));const tab=w.querySelector('.settings-sections select').value;w.remove();open(tab)})}
function pageControls(container,page,total,selectPage){
 const nav=document.createElement('div');nav.className='directory-pages';
 const back=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
 back.textContent='Previous';next.textContent='Next';label.textContent='Page '+(page+1)+' of '+total;
 back.disabled=page===0;next.disabled=page+1===total;
 back.onclick=()=>selectPage(page-1);next.onclick=()=>selectPage(page+1);
 nav.append(back,label,next);container.append(nav);return nav;
}
function sectionSettings(windowElement,tab){
 const body=windowElement.querySelector('.pb');
 const sections=[...body.querySelectorAll(':scope > h4')].map(heading=>{
  const section=document.createElement('section');
  heading.before(section);let node=heading;
  do{const next=node.nextSibling;section.append(node);node=next;}while(node&&node.nodeName!=='H4');
  return section;
 });
 const navigation=document.createElement('label');navigation.className='settings-sections';
 navigation.textContent='Settings section ';
 const select=document.createElement('select');navigation.append(select);body.prepend(navigation);
 sections.forEach((section,index)=>{
  const label=section.querySelector('h4').textContent;
  select.add(new Option(label,label));
  const rows=[...section.querySelectorAll(':scope > div')].filter(row=>row.querySelector('button[data-k]'));
  if(rows.length>5){
   let nav;const render=page=>{nav?.remove();rows.forEach((row,i)=>row.hidden=Math.floor(i/5)!==page);nav=pageControls(section,page,Math.ceil(rows.length/5),render);};
   render(0);
  }
 });
 if(sections.some(section=>section.querySelector('h4').textContent===tab))select.value=tab;
 select.onchange=()=>sections.forEach(section=>section.hidden=section.querySelector('h4').textContent!==select.value);
 select.onchange();
}
if(window.YProf){const ps=YProf.show;YProf.show=async(n,o={})=>{const r=await ps(n,o);const w=r?.querySelector('.pb');if(S&&w&&!w.querySelector('.profile-moderation')&&o.me!==undefined&&String(n).toLowerCase()!=String(o.me||window.YME||'').toLowerCase()){const lc=String(n).toLowerCase(),d=document.createElement('div');d.className='profile-moderation';d.style.cssText='margin-top:8px;display:flex;gap:6px';
 const ig=P.ignored.includes(lc),bl=P.blocked.some(x=>x.toLowerCase()==lc);d.innerHTML=`<button data-a=i>${ig?'Unignore':'Ignore'}</button>`+(P.account?`<button data-a=b>${bl?'Unblock':'Block'}</button>`:'')+'<button data-a=r>Report</button>';w.appendChild(d);
 d.onclick=async e=>{const a=e.target.dataset.a;if(!a)return;if(a=='r'){const why=prompt('Report '+n+' to the site moderators.\nWhat happened?','');if(why!==null){const r=await fetch('/api/report',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({who:n,why})}).then(r=>r.json()).catch(()=>({}));if(r.error)S.emit('report',{who:n,why});alert('Thanks. Your report was sent to the site moderators.')}return}if(a=='b'&&!bl&&!confirm('Block '+n+'?'))return;await(a=='i'?setIgnore(n,!ig):setBlock(n,!bl));r.remove()}}return r}}
return{init,refresh,open,hidden,setIgnore,setBlock,get:()=>P,on:f=>subs.push(f)}})();
