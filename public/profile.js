// Profiles + rating badges + 18+ confirm (shared by Messenger and Rooms)
(function(){const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function win(title,html){document.querySelectorAll('.yprof').forEach(x=>x.remove());const w=document.createElement('div');w.className='yprof';
 w.innerHTML=`<div class=tbar>${E(title)}<span class=sp></span><span class=x title=Close>X</span></div><div class=pb>${html}</div>`;document.body.appendChild(w);w.querySelector('.x').onclick=()=>w.remove();
 const t=w.querySelector('.tbar');t.onmousedown=e=>{if(e.target.closest('.x'))return;const r=w.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;const m=ev=>{w.style.left=ev.clientX-dx+'px';w.style.top=ev.clientY-dy+'px';w.style.transform='none'};const u=()=>{removeEventListener('mousemove',m);removeEventListener('mouseup',u)};addEventListener('mousemove',m);addEventListener('mouseup',u)};return w}
async function show(name,opts={}){let p;try{const r=await fetch('/api/profile/'+encodeURIComponent(name));p=await r.json();if(!r.ok)throw p}catch(e){return alert((e&&e.error)||'Could not load that profile.')}
 const av=`<img class=pav src="/av/${encodeURIComponent(p.name)}?v=${encodeURIComponent(p.avatar||'0')}" alt="">`;
 if(p.guest)return win(p.name+' – Profile',`<div class=ph>${av}<div><div class=pn>${E(p.name)}</div><div class=pg>Guest &middot; ${p.online?'online now':'offline'}</div></div></div><p class=pm>Guests have a minimal profile. They haven't registered a screen name.</p>`);
 const row=(k,v)=>v?`<tr><th>${k}</th><td>${E(v)}</td></tr>`:'';const since=p.memberSince?new Date(p.memberSince).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'';
 const w=win(p.name+' – Profile',`<div class=ph>${av}<div><div class=pn>${E(p.displayName||p.name)}</div><div class=pg>@${E(p.name)} &middot; ${p.online?'<span class="sdot available"></span> online':'offline'}</div></div></div>
 ${p.bio?`<p class=pbio>${E(p.bio)}</p>`:''}<table class=pt>${row('Age',p.age)}${p.location?`<tr><th>Location</th><td>${window.YFlag?YFlag(p.location)+' ':''}${E(p.location)}</td></tr>`:''}${row('Interests',p.interests)}${row('Member since',since)}</table>
 ${opts.me&&opts.me.toLowerCase()==p.name.toLowerCase()?'<div class=pbtn><button class="btn pri" id=pEdit>Edit Profile</button></div>':''}`);
 const b=w.querySelector('#pEdit');if(b)b.onclick=()=>edit(p)}
async function edit(p){if(!p||!p.name){const me=await fetch('/api/me').then(r=>r.json());if(!me.name)return alert('Sign in with a screen name to edit your profile.');p=await fetch('/api/profile/'+encodeURIComponent(me.name)).then(r=>r.json())}
 const w=win('Edit My Profile',`<label>Display name<input id=pf1 maxlength=30 value="${E(p.displayName)}"></label><label>Age (optional)<input id=pf2 type=number min=18 max=120 value="${E(p.age??'')}"></label>
 <label>Location (optional) <span id=pfflag style="font-size:18px"></span><input id=pf3 maxlength=50 value="${E(p.location)}" placeholder="Brooklyn, NY"></label><label>About me<textarea id=pf4 maxlength=300 rows=3>${E(p.bio)}</textarea></label>
 <label>Interests<input id=pf5 maxlength=150 value="${E(p.interests)}" placeholder="music, gaming, movies"></label><div class=perr id=pfe></div><div class=pbtn><button class=btn id=pfc>Cancel</button><button class="btn pri" id=pfs>Save</button></div>`);
 const fl=()=>{const f=w.querySelector('#pfflag');if(f&&window.YFlag)f.textContent=YFlag(w.querySelector('#pf3').value)};w.querySelector('#pf3').oninput=fl;fl();
 w.querySelector('#pfc').onclick=()=>w.remove();w.querySelector('#pfs').onclick=async()=>{const v=i=>w.querySelector('#pf'+i).value;
  const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:v(1),age:v(2),location:v(3),bio:v(4),interests:v(5)})});const j=await r.json();
  if(!r.ok)return w.querySelector('#pfe').textContent=j.error||'Could not save.';w.remove();show(p.name,{me:p.name})}}
const badge=r=>r?`<span class="rate r${r=='PG-13'?'pg':r.toLowerCase()}" title="Rated ${r}">${r}</span>`:'';
function confirm18(){return confirm('This room is rated R (adults only, 18+).\n\nI am 18 or older and want to see R-rated rooms.')}
window.YProf={show,edit,badge,confirm18}})();
