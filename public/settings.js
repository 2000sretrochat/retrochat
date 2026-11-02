// Settings window: Privacy (buddy-only private messages), Blocked list, Ignore list. Shared by Rooms and Messenger.
window.YSet=(function(){const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S=null,P={ignored:[],blocked:[],hide:[],pmBuddies:false,account:false};const subs=[];
const fire=()=>subs.forEach(f=>f(P));
function emit(ev,d){return new Promise(r=>d===undefined?S.emit(ev,r):S.emit(ev,d,r))}
async function refresh(){const r=await emit('prefs');if(r&&!r.error){P=r;fire()}return P}
function init(sock){S=sock;S.on('connect',refresh);S.on('signed-elsewhere',d=>{alert((d&&d.text)||'Signed in elsewhere');});
 S.on('connect_error',e=>{if(/Too many users|banned/i.test(e.message)){S.io.opts.reconnection=false;alert(e.message=='banned'?'You are banned.':e.message)}});if(S.connected)refresh()}
const hidden=n=>P.hide.includes(String(n||'').replace(/&#39;/g,"'").toLowerCase());
async function setIgnore(n,on){const r=await emit('ign:set',{name:n,on});if(r.error)alert(r.error);else{P=r;fire()}return r}
async function setBlock(n,on){const r=await emit('blk:set',{name:n,on});if(r.error)alert(r.error);else{P=r;fire()}return r}
async function open(tab){await refresh();document.querySelectorAll('.yset').forEach(x=>x.remove());const w=document.createElement('div');w.className='yprof yset';
 const list=(a,k,lbl)=>a.length?a.map(n=>`<div style="display:flex;align-items:center;gap:8px;padding:3px 0"><b style="flex:1">${E(n)}</b><button data-k=${k} data-n="${E(n)}">${lbl}</button></div>`).join(''):'<div style="color:var(--muted)">Nobody.</div>';
 w.innerHTML=`<div class=tbar>Settings<span class=sp></span><span class=x title=Close>X</span></div><div class=pb style="min-width:300px">
 <h4 style="margin:4px 0">Privacy</h4>${P.account?`<label><input type=checkbox id=ysPm ${P.pmBuddies?'checked':''}> Only allow private messages from people on my buddy list</label>`:'<small>Sign in with a screen name to use privacy settings.</small>'}
 <h4 style="margin:12px 0 4px">Blocked list</h4><small style="color:var(--muted)">Blocked people can't see you online, IM you, add you, or view your cam.</small>${P.account?list(P.blocked,'b','Unblock'):'<div><small>Guests can use Ignore.</small></div>'}
 <h4 style="margin:12px 0 4px">Ignore list</h4><small style="color:var(--muted)">You won't see or hear ignored chatters in rooms.${P.account?'':' (Guests: this session only.)'}</small>${list(P.ignored,'i','Unignore')}</div>`;
 document.body.appendChild(w);w.querySelector('.x').onclick=()=>w.remove();
 const pm=w.querySelector('#ysPm');if(pm)pm.onchange=async()=>{const r=await emit('priv:set',{pmBuddies:pm.checked});if(r.error)alert(r.error);else{P=r;fire()}};
 w.querySelectorAll('button[data-k]').forEach(b=>b.onclick=async()=>{await(b.dataset.k=='b'?setBlock(b.dataset.n,false):setIgnore(b.dataset.n,false));open()})}
if(window.YProf){const ps=YProf.show;YProf.show=async(n,o={})=>{const r=await ps(n,o);const w=document.querySelector('.yprof:not(.yset) .pb');if(S&&w&&o.me!==undefined&&String(n).toLowerCase()!=String(o.me||window.YME||'').toLowerCase()){const lc=String(n).toLowerCase(),d=document.createElement('div');d.style.cssText='margin-top:8px;display:flex;gap:6px';
 const ig=P.ignored.includes(lc),bl=P.blocked.some(x=>x.toLowerCase()==lc);d.innerHTML=`<button data-a=i>${ig?'Unignore':'Ignore'}</button>`+(P.account?`<button data-a=b>${bl?'Unblock':'Block'}</button>`:'');w.appendChild(d);
 d.onclick=async e=>{const a=e.target.dataset.a;if(!a)return;if(a=='b'&&!bl&&!confirm('Block '+n+'?'))return;await(a=='i'?setIgnore(n,!ig):setBlock(n,!bl));document.querySelectorAll('.yprof:not(.yset)').forEach(x=>x.remove())}}return r}}
return{init,refresh,open,hidden,setIgnore,setBlock,get:()=>P,on:f=>subs.push(f)}})();
