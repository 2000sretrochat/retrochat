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
 return{favs,toggle,groups,top,star}})();
