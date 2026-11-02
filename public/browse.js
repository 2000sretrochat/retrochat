// Shared room-directory helpers: favorites (DB for accounts, localStorage for guests), ordering, Top Rooms.
window.YBrowse=(function(){
 const LK='ycFav',lf=()=>{try{return new Set(JSON.parse(localStorage.getItem(LK)||'[]'))}catch{return new Set()}};
 function favs(rs,signed){if(!signed){const f=lf();rs.forEach(r=>r.fav=f.has(r.name))}return rs}
 async function toggle(room,on,signed){if(!signed){const f=lf();on?f.add(room):f.delete(room);localStorage.setItem(LK,JSON.stringify([...f]));return true}
  const r=await fetch('/api/fav',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({room,on})});return r.ok}
 function groups(rs){const cats={};rs.forEach(r=>(cats[r.cat]=cats[r.cat]||[]).push(r));return Object.entries(cats)}
 // My Rooms tab: rooms I own or admin, then starred rooms
 function mine(rs,meLc){const m=rs.filter(r=>r.mine||(r.owner&&meLc&&r.owner.toLowerCase()==meLc));return m.concat(rs.filter(r=>r.fav&&!m.includes(r)))}
 const icon=(r,sz)=>r&&r.icon?`<span class=ricon style="display:inline-flex;align-items:center;justify-content:center;width:${sz||18}px;height:${sz||18}px;font-size:${Math.round((sz||18)*.8)}px;line-height:1;flex:none">${r.icon}</span>`:'';
 // nested Yahoo-style tree: category -> subfolders (r.path) -> rooms; open folders survive refreshes
 const OK='ycOpen';let open;try{open=new Set(JSON.parse(sessionStorage.getItem(OK)||'[]'))}catch{open=new Set()}
 document.addEventListener('toggle',e=>{const d=e.target;if(!d.dataset||d.dataset.yk==null)return;d.open?open.add(d.dataset.yk):open.delete(d.dataset.yk);try{sessionStorage.setItem(OK,JSON.stringify([...open]))}catch{}},true);
 function tree(rs,meLc,row,q,sep){const E=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));sep=sep||'';
  const cnt=l=>l.reduce((a,r)=>a+(r.count||0),0),sty='cursor:pointer;padding:4px 8px;font-weight:700;list-style-position:inside';
  const fold=(k,t,l,inner,d)=>`<details data-yk="${E(k)}"${q||open.has(k)?' open':''} style="margin-left:${d?14:0}px"><summary style="${sty};${d?'font-weight:600':'background:var(--soft,#eaf3fd)'}">${E(t)} <small style="font-weight:400;color:#888">(${l.length} room${l.length==1?'':'s'}, ${cnt(l)} online)</small></summary>${inner}</details>`;
  function node(l,key,depth){const here=[],subs={};l.forEach(r=>{const p=r.path||[];p.length>depth?(subs[p[depth]]=subs[p[depth]]||[]).push(r):here.push(r)});
   const sk=Object.keys(subs);if(depth==0)sk.sort((a,b)=>a=='General'?-1:b=='General'?1:0);
   return (here.length?`<div style="margin-left:${depth?14:4}px">${here.map(row).join(sep)}</div>`:'')+sk.map(k=>{const kk=key+'/'+k;
    if(subs[k].length==1&&!(subs[k][0].path||[])[depth+1]&&subs[k][0].name==k)return `<div style="margin-left:14px">${row(subs[k][0])}</div>`;return fold(kk,k,subs[k],node(subs[k],kk,depth+1),1)}).join('')}
  const g=groups(rs);return g.filter(x=>x[1].length).map(([t,l])=>fold(t,t,l,node(l,t,0),0)).join('')}
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
 return{favs,toggle,groups,mine,icon,top,star,tree}})();
