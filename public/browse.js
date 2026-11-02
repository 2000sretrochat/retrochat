// Shared room-directory helpers: favorites (DB for accounts, localStorage for guests), ordering, Top Rooms.
window.YBrowse=(function(){
 const LK='ycFav',lf=()=>{try{return new Set(JSON.parse(localStorage.getItem(LK)||'[]'))}catch{return new Set()}};
 function favs(rs,signed){if(!signed){const f=lf();rs.forEach(r=>r.fav=f.has(r.name))}return rs}
 async function toggle(room,on,signed){if(!signed){const f=lf();on?f.add(room):f.delete(room);localStorage.setItem(LK,JSON.stringify([...f]));return true}
  const r=await fetch('/api/fav',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room,on})});return r.ok}
 function groups(rs,meLc){const mine=rs.filter(r=>r.mine||(r.owner&&meLc&&r.owner.toLowerCase()==meLc)),fav=rs.filter(r=>r.fav),cats={};
  rs.forEach(r=>(cats[r.cat]=cats[r.cat]||[]).push(r));if(!cats['User Rooms'])cats['User Rooms']=[];
  const g=[];if(mine.length)g.push(['My Rooms (owner/admin)',mine,1]);if(fav.length)g.push(['\u2605 Favorites',fav,1]);
  const uc=cats['User Rooms'];delete cats['User Rooms'];return g.concat(Object.entries(cats),[['User Rooms',uc]])}
 const top=rs=>rs.filter(r=>r.count>0).sort((a,b)=>b.count-a.count||b.cams-a.cams||a.name.localeCompare(b.name)).slice(0,10);
 const star=r=>`<span class=ystar data-fav="${String(r.name).replace(/"/g,'&quot;')}" title="${r.fav?'Remove from':'Add to'} favorites" style="cursor:pointer;color:${r.fav?'#f5a623':'#bbb'};font-size:15px">${r.fav?'\u2605':'\u2606'}</span>`;
 // room preview on hover / long-press
 let tip=null,tmr=null,cur='';const hide=()=>{clearTimeout(tmr);tip&&tip.remove();tip=null;cur=''};
 const roomOf=el=>{const e=el&&el.closest&&el.closest('.room[data-r],.rrow');if(!e)return null;return{e,r:e.dataset.r||(e.querySelector('[data-r]')||{}).dataset?.r}};
 async function show(o,x,y){if(!o||!o.r||cur==o.r)return;cur=o.r;const j=await fetch('/api/peek?room='+encodeURIComponent(o.r),{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({names:[]}));if(cur!=o.r)return;
  tip&&tip.remove();tip=document.createElement('div');tip.className='ypeek';tip.style.cssText='position:fixed;z-index:9500;max-width:240px;background:var(--card,#fffde8);color:inherit;border:1px solid #889;border-radius:4px;padding:6px 8px;font:12px Tahoma;box-shadow:2px 2px 8px #0003;pointer-events:none';
  const E=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));tip.innerHTML='<b>'+E(o.r)+'</b><br>'+(j.names.length?j.names.map(E).join(', ')+(j.more?' +'+j.more+' more':''):'<i>Nobody here yet</i>');
  document.body.appendChild(tip);tip.style.left=Math.min(x+12,innerWidth-250)+'px';tip.style.top=Math.min(y+12,innerHeight-tip.offsetHeight-8)+'px'}
 document.addEventListener('mouseover',e=>{const o=roomOf(e.target);if(!o){if(cur)hide();return}clearTimeout(tmr);tmr=setTimeout(()=>show(o,e.clientX,e.clientY),350)});
 document.addEventListener('touchstart',e=>{const o=roomOf(e.target);hide();if(!o)return;const t=e.touches[0];tmr=setTimeout(()=>show(o,t.clientX,t.clientY),500)},{passive:true});
 document.addEventListener('touchend',()=>{clearTimeout(tmr);setTimeout(hide,2500)},{passive:true});
 // "N people online" (includes bots)
 let onl=null;const fillOn=()=>{if(onl!=null)document.querySelectorAll('.yonline').forEach(e=>{const t=onl+' '+(onl==1?'person':'people')+' online';if(e.textContent!=t)e.textContent=t})};
 const getOn=()=>fetch('/api/online').then(r=>r.json()).then(j=>{onl=j.n;fillOn()}).catch(()=>{});getOn();setInterval(getOn,30e3);setInterval(fillOn,1500);
 return{favs,toggle,groups,top,star}})();
