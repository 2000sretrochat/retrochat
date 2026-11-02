// YappChat icon set (original, simple stroke icons) + room icon tiles. <i data-i="name"></i> is auto-filled.
(function(){
const P={
 video:'<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
 phone:'<path d="M5 3.5h3.2l1.6 4.2-2.1 1.4a11 11 0 006.2 6.2l1.4-2.1 4.2 1.6V18a2.5 2.5 0 01-2.7 2.5A16.5 16.5 0 012.5 6.2 2.5 2.5 0 015 3.5z"/>',
 bell:'<path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 004 0"/>',
 dots:'<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
 users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M15.5 5.2a3.5 3.5 0 010 6.6M18 14.2a6.5 6.5 0 013.5 5.8"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0115 0"/>',
 mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>',
 micoff:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M3.5 3.5l17 17"/>',
 vol:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
 volx:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
 gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5l5 5"/>',
 smile:'<circle cx="12" cy="12" r="9"/><path d="M8.2 14.2a4.5 4.5 0 007.6 0"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>',
 image:'<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M3.5 17l5.5-5 4 4 2.5-2.5 5 4.5"/>',
 clip:'<path d="M20 11.5l-7.8 7.8a5 5 0 01-7-7L13 4.5a3.3 3.3 0 014.7 4.7l-7.8 7.8a1.7 1.7 0 01-2.4-2.4L15 7.1"/>',
 font:'<path d="M3 18L8 5l5 13M5 13.5h6"/><path d="M15 12.5a3 3 0 016 0V18M21 15.5h-3.3a2 2 0 100 2.5H21"/>',
 webcam:'<circle cx="12" cy="10" r="6.5"/><circle cx="12" cy="10" r="2.6"/><circle cx="12" cy="10" r=".6" fill="currentColor"/><path d="M8.5 16l-2 4.5h11l-2-4.5"/><circle cx="16.2" cy="6.3" r=".5" fill="currentColor"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 refresh:'<path d="M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
 pencil:'<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M14 7l3 3"/>',
 send:'<path d="M3.5 11.5L20.5 4l-7.5 17-2-7.5z"/><path d="M11 13.5l9.5-9.5"/>',
 coffee:'<path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 010 5H16M7 3.5c0 1.5 1.5 1.5 1.5 3M11 3.5c0 1.5 1.5 1.5 1.5 3"/>',
 moon:'<path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z"/>',
 heart:'<path d="M12 20s-7.5-4.5-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.5-7.5 10-7.5 10z"/>',
 star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8z"/>',
 music:'<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
 game:'<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="14" r=".9" fill="currentColor"/>',
 headset:'<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
 shield:'<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z"/>',
 min:'<path d="M5 12.5h14"/>',max:'<rect x="5.5" y="5.5" width="13" height="13" rx="1"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',
 chev:'<path d="M6 9l6 6 6-6"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',out:'<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>'
};
const svg=(n,s)=>`<svg class="ic" viewBox="0 0 24 24" width="${s||20}" height="${s||20}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;
// Logo mark: three rising bubbles (our own SVG)
const logo=(w=26,light)=>`<svg class="lg" viewBox="0 0 34 24" width="${w}" height="${Math.round(w*24/34)}" aria-hidden="true"><circle cx="5" cy="13" r="3" fill="${light?'#fff':'#00A3E0'}" opacity="${light?1:.75}"/><circle cx="13" cy="19" r="4.2" fill="${light?'#fff':'#00A3E0'}" opacity="${light?1:.75}"/><circle cx="26" cy="9" r="7.5" fill="${light?'#fff':'#0033A0'}" opacity="${light?1:.9}"/></svg>`;
const RI={'lobby':['coffee','#8b5cf6','#6d3fd6'],'friends':['users','#ffb020','#f08a00'],'chit chat':['chat','#00A3E0','#0033A0'],'late night':['moon','#3b4f8a','#00205B']};
const POOL=[['star','#ec4899','#c0267a'],['music','#38bdf8','#0033A0'],['game','#a855f7','#7c3aed'],['heart','#f87171','#dc2626'],['headset','#14b8a6','#0f8a7d'],['chat','#60a5fa','#2468D7']];
function room(name,size){const k=String(name).toLowerCase();const r=RI[k]||POOL[[...k].reduce((a,c)=>a+c.charCodeAt(0),0)%POOL.length];size=size||40;
 return `<span class="rtile" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,${r[1]},${r[2]})">${svg(r[0],Math.round(size*.55))}</span>`}
function fill(root){(root||document).querySelectorAll('i[data-i]').forEach(e=>{if(!e.firstChild)e.innerHTML=svg(e.dataset.i,+e.dataset.s||0)})}
window.YI={svg,logo,room,fill,P};document.addEventListener('DOMContentLoaded',()=>fill());
})();
