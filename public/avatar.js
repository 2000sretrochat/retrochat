// YappChat avatars: rendering helpers + editor (upload & crop, or build one with the original avatar maker).
(function(){
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const PRE={a1:[':)','#cfe8ff'],a2:['B-)','#ffe0b3'],a3:[';)','#d9f7c8'],a4:[':D','#ffd1dc'],a5:['<):)','#efe0c4'],a6:['O:-)','#e6e0ff'],a7:['>:)','#ffd6cc'],a8:[':ar!','#d4f1f4']};
// html(name, av, cls): av = 'a1'..'a8' preset | 'c<ver>' custom image | '' default
function html(name,av,cls=''){const lc=String(name||'').toLowerCase();av=av||'';
 if(/^a\d$/.test(av)&&PRE[av]&&window.RCSmileys){const v=PRE[av];return `<span class="av yav ${cls}" data-avn="${esc(lc)}" style="background:radial-gradient(circle at 40% 30%,#fff,${v[1]})">${RCSmileys.html(v[0])}</span>`}
 const v=/^c[0-9a-z]+$/.test(av)?av:'0';return `<img class="av yav ${cls}" data-avn="${esc(lc)}" alt="" loading="lazy" src="/av/${encodeURIComponent(name)}?v=${v}">`}
const cache={};
// live update: replace every rendered avatar of that user
function update(name,av){const lc=String(name).toLowerCase();cache[lc]=av;document.querySelectorAll(`.yav[data-avn="${CSS.escape(lc)}"]`).forEach(e=>{const cls=[...e.classList].filter(c=>!['av','yav'].includes(c)).join(' ');const t=document.createElement('template');t.innerHTML=html(name,av,cls);const n=t.content.firstChild;if(e.id)n.id=e.id;if(e.title)n.title=e.title;e.replaceWith(n)})}
// ---------- original avatar maker (simple flat shapes) ----------
const SKIN=['#FDE3CF','#F6C9A4','#E8B48A','#C98E62','#9A633F','#6B4329'],HAIRC=['#2B1B12','#5A3A22','#A0622D','#E3B04B','#D9472B','#9AA4B0','#0033A0','#E86AB0'],BG=['#DCEBFC','#4AB7F2','#0033A0','#10234A','#FFCE00','#B9F5A0','#FFD1DC','#E6E0FF'];
const OPT={face:['round','oval','square'],hair:['short','long','spiky','bun','curly','bob','none'],eyes:['dots','happy','lashes','wink','big'],mouth:['smile','grin','open','tongue','flat'],acc:['none','glasses','shades','cap','bow','headphones']};
function svg(o){const s=o.skin,h=o.hairc,ink='#2a1a12';let g=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96"><rect width="96" height="96" fill="${o.bg}"/>`;
 // hair behind
 if(o.hair=='long')g+=`<path d="M20 50 Q18 22 48 18 Q78 22 76 50 L78 88 L18 88 Z" fill="${h}"/>`;
 if(o.hair=='bob')g+=`<path d="M19 56 Q16 20 48 18 Q80 20 77 56 L70 64 L26 64 Z" fill="${h}"/>`;
 g+=`<path d="M30 88 Q48 72 66 88 Z" fill="${s}"/><rect x="42" y="68" width="12" height="12" fill="${s}"/>`;// neck/shoulders
 g+=o.face=='oval'?`<ellipse cx="48" cy="50" rx="23" ry="28" fill="${s}"/>`:o.face=='square'?`<rect x="24" y="24" width="48" height="52" rx="14" fill="${s}"/>`:`<circle cx="48" cy="50" r="26" fill="${s}"/>`;
 g+=`<circle cx="22.5" cy="52" r="4" fill="${s}"/><circle cx="73.5" cy="52" r="4" fill="${s}"/>`;
 // hair front
 const H={short:`<path d="M22 46 Q22 20 48 20 Q74 20 74 46 Q66 32 48 32 Q30 32 22 46Z" fill="${h}"/>`,long:`<path d="M22 48 Q22 20 48 20 Q74 20 74 48 Q60 30 40 34 Q30 38 22 48Z" fill="${h}"/>`,
  spiky:`<path d="M22 44 L24 26 L32 32 L36 16 L44 28 L50 14 L56 28 L64 16 L66 32 L74 26 L74 44 Q60 32 48 33 Q34 32 22 44Z" fill="${h}"/>`,
  bun:`<circle cx="48" cy="16" r="9" fill="${h}"/><path d="M22 46 Q22 21 48 21 Q74 21 74 46 Q66 31 48 31 Q30 31 22 46Z" fill="${h}"/>`,
  curly:[...Array(9)].map((_,i)=>`<circle cx="${24+i*6}" cy="${30-Math.sin(i/8*Math.PI)*10}" r="7" fill="${h}"/>`).join(''),
  bob:`<path d="M22 50 Q22 21 48 21 Q74 21 74 50 Q70 34 56 30 Q40 36 22 50Z" fill="${h}"/>`,none:''};g+=H[o.hair]||'';
 // eyes
 const E={dots:`<circle cx="39" cy="50" r="3.2" fill="${ink}"/><circle cx="57" cy="50" r="3.2" fill="${ink}"/>`,
  happy:`<path d="M35 51 Q39 46 43 51 M53 51 Q57 46 61 51" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  lashes:`<circle cx="39" cy="51" r="3.4" fill="${ink}"/><circle cx="57" cy="51" r="3.4" fill="${ink}"/><path d="M35 47 L33 44 M38 46 L37.5 42.5 M41.5 46.5 L42.5 43 M54.5 46.5 L53.5 43 M58 46 L58.5 42.5 M61 47 L63 44" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`,
  wink:`<circle cx="39" cy="50" r="3.2" fill="${ink}"/><path d="M53 50 Q57 46 61 50" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  big:`<circle cx="39" cy="50" r="6" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="57" cy="50" r="6" fill="#fff" stroke="${ink}" stroke-width="1.2"/><circle cx="40" cy="51" r="3" fill="${ink}"/><circle cx="58" cy="51" r="3" fill="${ink}"/>`};g+=E[o.eyes]||E.dots;
 g+=`<circle cx="33" cy="60" r="3.5" fill="#ff7a8a" opacity=".35"/><circle cx="63" cy="60" r="3.5" fill="#ff7a8a" opacity=".35"/>`;
 const M={smile:`<path d="M40 62 Q48 69 56 62" stroke="${ink}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,grin:`<path d="M38 61 Q48 74 58 61 Z" fill="#7a1f1f" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/><path d="M40 62 L56 62 L55 64.5 L41 64.5Z" fill="#fff"/>`,
  open:`<ellipse cx="48" cy="64" rx="4.5" ry="5.5" fill="#7a1f1f" stroke="${ink}" stroke-width="1.4"/>`,tongue:`<path d="M40 62 Q48 66 56 62" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M44 63.5 Q44 72 48.5 72 Q53 72 52.5 63.5Z" fill="#ff6b8a" stroke="${ink}" stroke-width="1.2"/>`,
  flat:`<path d="M41 64 L55 64" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>`};g+=M[o.mouth]||M.smile;
 const A={none:'',glasses:`<g stroke="#10234A" stroke-width="2" fill="rgba(255,255,255,.25)"><circle cx="39" cy="50" r="7.5"/><circle cx="57" cy="50" r="7.5"/><path d="M46.5 50 L49.5 50 M31.5 49 L24 46 M64.5 49 L72 46" fill="none"/></g>`,
  shades:`<g fill="#10234A"><path d="M30 45 L46 45 L45 54 Q38 58 31 54Z"/><path d="M50 45 L66 45 L65 54 Q58 58 51 54Z"/><rect x="45" y="46" width="6" height="2"/><path d="M33 47 L37 47" stroke="#4AB7F2" stroke-width="1.5"/><path d="M53 47 L57 47" stroke="#4AB7F2" stroke-width="1.5"/></g>`,
  cap:`<path d="M22 38 Q22 16 48 16 Q74 16 74 38 Z" fill="#0033A0"/><path d="M48 36 L86 38 Q84 43 70 42 L48 40Z" fill="#176FCF"/><circle cx="48" cy="16" r="2.5" fill="#FFCE00"/>`,
  bow:`<g fill="#E86AB0"><path d="M60 22 L72 15 L72 31Z"/><path d="M60 22 L48 15 L48 31Z"/><circle cx="60" cy="23" r="3.5" fill="#c94a90"/></g>`,
  headphones:`<path d="M20 50 Q20 14 48 14 Q76 14 76 50" stroke="#10234A" stroke-width="5" fill="none"/><rect x="14" y="44" width="11" height="17" rx="5" fill="#0033A0"/><rect x="71" y="44" width="11" height="17" rx="5" fill="#0033A0"/>`};g+=A[o.acc]||'';
 return g+'</svg>'}
// ---------- canvas helpers ----------
function toData(cv){for(const [t,qs] of [['image/webp',[.9,.8,.7,.6,.5,.4]],['image/jpeg',[.9,.8,.7,.6,.5,.4,.3]]]){for(const q of qs){const d=cv.toDataURL(t,q);if(!d.startsWith('data:'+t))break;if(d.length*.75<30000)return d}}return null}
// keep transparency: WebP (alpha) first, then PNG; never JPEG
function toDataA(cv){for(const q of [.92,.85,.75,.65,.5,.4]){const d=cv.toDataURL('image/webp',q);if(!d.startsWith('data:image/webp'))break;if(d.length*.75<30000)return d}const p=cv.toDataURL('image/png');return p.length*.75<30000?p:toData(cv)}
function loadImg(src){return new Promise((ok,no)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=no;i.src=src})}
// ---------- editor modal ----------
const CSS=`.yae{position:fixed;inset:0;background:rgba(16,35,74,.45);z-index:500;display:flex;align-items:center;justify-content:center;font:13px var(--sys,system-ui)}
.yae .bx{background:var(--card,#fff);color:var(--ink,#12213F);width:min(440px,96vw);max-height:94vh;overflow:auto;border-radius:16px;box-shadow:0 20px 50px rgba(16,35,74,.35)}
.yae .hd{display:flex;align-items:center;padding:12px 16px;background:linear-gradient(135deg,#4AB7F2,#0033A0);color:#fff;font-weight:700;font-size:15px}.yae .hd span{flex:1}.yae .hd b{cursor:pointer;font-size:18px}
.yae .tabs{display:flex;gap:6px;padding:10px 16px 0}.yae .tabs div{padding:6px 14px;border-radius:999px;cursor:pointer;background:var(--soft,#eaf3fd)}.yae .tabs .on{background:#0033A0;color:#fff}
.yae .pn{padding:12px 16px;display:none}.yae .pn.on{display:block}.yae .prev{display:flex;justify-content:center;margin-bottom:10px}.yae .prev canvas,.yae .prev .sv{width:128px;height:128px;border-radius:50%;box-shadow:0 0 0 4px #DCEBFC,0 4px 14px rgba(0,0,0,.2);touch-action:none}
.yae .row{display:flex;align-items:center;gap:6px;margin:6px 0;flex-wrap:wrap}.yae .row>label{width:84px;font-weight:600;color:var(--muted,#5b6b85)}
.yae .ch{padding:3px 9px;border-radius:999px;border:1px solid var(--line,#d5e2f0);cursor:pointer;font-size:12px;background:var(--card,#fff);color:inherit}.yae .ch.on{background:#0033A0;color:#fff;border-color:#0033A0}
.yae .cs{width:20px;height:20px;border-radius:50%;cursor:pointer;border:2px solid #fff;box-shadow:0 0 0 1px #9ab}.yae .cs.on{box-shadow:0 0 0 3px #FFCE00}
.yae .ft{display:flex;gap:8px;justify-content:flex-end;padding:0 16px 14px;align-items:center}.yae .ft .er{flex:1;color:#d33;font-size:12px}
.yae button{border-radius:10px;padding:7px 16px;border:1px solid var(--line,#d5e2f0);background:var(--card,#fff);color:inherit;cursor:pointer;font:600 13px var(--sys,system-ui)}.yae button.pri{background:#0033A0;border-color:#0033A0;color:#fff}
.yae .pres{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}.yae .pres .av{cursor:pointer}`;
function editor(socket,{onSaved,name}={}){
 if(!document.getElementById('yaecss')){const st=document.createElement('style');st.id='yaecss';st.textContent=CSS;document.head.appendChild(st)}
 const o={face:'round',skin:SKIN[1],hair:'short',hairc:HAIRC[1],eyes:'lashes',mouth:'smile',acc:'none',bg:BG[0]};
 const d=document.createElement('div');d.className='yae';
 d.innerHTML=`<div class=bx role=dialog aria-label="Change my avatar"><div class=hd><span>Change My Avatar</span><b class=cl>&times;</b></div>
 <div class=tabs><div data-t=make class=on>Avatar Maker</div><div data-t=up>Upload Photo</div><div data-t=bm>Snapchat / Bitmoji</div><div data-t=pre>Classic</div><div data-t=qr>&#128247; Phone Photo</div></div>
 <div class="pn on" data-p=make><div class=prev><div class=sv></div></div>
  ${['face','hair','eyes','mouth','acc'].map(k=>`<div class=row><label>${{face:'Face',hair:'Hair',eyes:'Eyes',mouth:'Mouth',acc:'Extras'}[k]}</label>${OPT[k].map(v=>`<span class="ch" data-k=${k} data-v=${v}>${v}</span>`).join('')}</div>`).join('')}
  ${[['skin','Skin',SKIN],['hairc','Hair color',HAIRC],['bg','Background',BG]].map(([k,l,a])=>`<div class=row><label>${l}</label>${a.map(c=>`<span class=cs data-k=${k} data-v="${c}" style="background:${c}"></span>`).join('')}</div>`).join('')}
  <div class=row><button class=rnd type=button>&#127922; Surprise me</button></div></div>
 <div class=pn data-p=up><div class=bmq style="display:none;text-align:center;margin-bottom:10px"><div class=qrb2 style="display:inline-block;padding:10px;background:#fff;border-radius:12px;min-height:200px;min-width:200px">Making your code...</div><p style="margin:8px 0 2px;font-size:15px"><b>Scan with your phone camera</b></p><small style="color:var(--muted,#5b6b85)">Then tap <b>Choose from Snapchat / Photos</b> on your phone. Save your Bitmoji or snap to your camera roll first. Your picture updates here automatically.</small><div class=bmok style="display:none;margin-top:8px;color:#0a8a3a;font-weight:700;font-size:15px">&#10003; Picture updated!</div><div style="margin:12px 0 4px;border-top:1px solid var(--line,#d5e2f0);padding-top:8px;font-weight:600;color:var(--muted,#5b6b85)">Or choose a file on this computer</div></div><div class=bmh style="display:none;font-size:12px;background:var(--soft,#eaf3fd);border-radius:10px;padding:8px;margin-bottom:8px"><b>Use a Snapchat / Bitmoji picture</b><br>1. In Snapchat, tap your Bitmoji, choose a sticker or selfie and tap <i>Save</i> (or long-press a Bitmoji sticker and save it). In the Bitmoji app, tap a sticker &rarr; <i>Save</i>.<br>2. Then choose that saved PNG, JPG or WEBP file below. Transparent backgrounds are kept; it becomes a round emoji-style picture.</div><div class=prev><canvas width=256 height=256 class=cv title="Drag to move"></canvas></div><div class=row><input type=file accept="image/jpeg,image/png,image/webp,image/gif" class=fi></div>
  <div class=row><label>Zoom</label><input type=range class=zm min=1 max=4 step=.05 value=1 style="flex:1"></div><small style="color:var(--muted,#5b6b85)">Drag the picture to position it. It is cropped to a square and shrunk to 96&times;96.</small></div>
 <div class=pn data-p=qr><div style="text-align:center"><div class=qrb style="display:inline-block;padding:10px;background:#fff;border-radius:12px;min-height:180px;min-width:180px">Making your code...</div><p style="margin:8px 0 0;font-size:13px"><b>Scan with your phone camera</b>, snap a selfie, and it becomes your avatar here automatically.<br><small style="color:var(--muted,#5b6b85)">One-time link, expires in 10 minutes. Screen-name accounts only.</small></p></div></div>
 <div class=pn data-p=pre><div class=pres>${Object.keys(PRE).map(k=>`<span data-pre=${k}>${html(name||'x',k)}</span>`).join('')}</div></div>
 <div class=ft><span class=er></span><button class=cn type=button>Cancel</button><button class=pri type=button>Save Avatar</button></div></div>`;
 document.body.appendChild(d);const q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);let tab='make',pre=null,img=null,zoom=1,ox=0,oy=0;
 const close=()=>d.remove();q('.cl').onclick=q('.cn').onclick=close;d.onclick=e=>{if(e.target==d)close()};
 qa('.tabs div').forEach(t=>t.onclick=()=>{tab=t.dataset.t;qa('.tabs div').forEach(x=>x.classList.toggle('on',x==t));const pt=tab=='bm'?'up':tab;qa('.pn').forEach(p=>p.classList.toggle('on',p.dataset.p==pt));q('.bmh').style.display=tab=='bm'?'':'none';q('.bmq').style.display=tab=='bm'?'':'none';q('.ft .pri').style.display=tab=='qr'?'none':'';if(tab=='qr')mkQr('.qrb');if(tab=='bm')mkQr('.qrb2','bm');redraw()});
 const sync=()=>{q('.sv').innerHTML=svg(o).replace('width="96" height="96"','width="128" height="128" style="border-radius:50%;display:block"');qa('[data-k]').forEach(e=>e.classList.toggle('on',o[e.dataset.k]==e.dataset.v))};
 qa('[data-k]').forEach(e=>e.onclick=()=>{o[e.dataset.k]=e.dataset.v;sync()});
 q('.rnd').onclick=()=>{const r=a=>a[Math.floor(Math.random()*a.length)];Object.assign(o,{face:r(OPT.face),hair:r(OPT.hair),eyes:r(OPT.eyes),mouth:r(OPT.mouth),acc:r(OPT.acc),skin:r(SKIN),hairc:r(HAIRC),bg:r(BG)});sync()};sync();
 qa('[data-pre]').forEach(e=>e.onclick=()=>{pre=e.dataset.pre;qa('[data-pre]').forEach(x=>x.style.outline=x==e?'3px solid #FFCE00':'');});
 const mkQr=(sel='.qrb',m)=>{const b=q(sel);socket.emit('snap:token',async r=>{if(!r||r.error){b.textContent=(r&&r.error)||'Not available right now.';return}if(!window.qrcode)await new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='/qrcode.js';sc.onload=ok;sc.onerror=no;document.head.appendChild(sc)}).catch(()=>{});const url=location.origin+'/snap?t='+r.t+(m?'&m='+m:'');if(!window.qrcode){b.textContent=url;return}const qr=qrcode(0,'M');qr.addData(url);qr.make();b.innerHTML=qr.createSvgTag({cellSize:5,margin:2})})};
 const onSnap=()=>{onSaved&&onSaved();const k=q('.bmok');if(tab=='bm'&&k){k.style.display='';setTimeout(close,1500)}else close()};socket.on('snap:done',onSnap);const _cl=close;
 const cv=q('.cv'),cx=cv.getContext('2d');
 const draw=(c,ctx,S)=>{ctx.clearRect(0,0,S,S);ctx.save();if(tab=='bm'){ctx.beginPath();ctx.arc(S/2,S/2,S/2,0,Math.PI*2);ctx.clip()}else{ctx.fillStyle='#DCEBFC';ctx.fillRect(0,0,S,S)}if(!img){ctx.restore();return}const base=Math.min(img.width,img.height)/zoom,sx=Math.max(0,Math.min(img.width-base,(img.width-base)/2+ox)),sy=Math.max(0,Math.min(img.height-base,(img.height-base)/2+oy));ctx.drawImage(img,sx,sy,base,base,0,0,S,S);ctx.restore()};
 const redraw=()=>draw(cv,cx,256);redraw();
 q('.fi').onchange=async e=>{const f=e.target.files[0];q('.er').textContent='';if(!f)return;if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type))return q('.er').textContent='Please choose a JPEG, PNG, WebP or GIF picture.';if(f.size>15e6)return q('.er').textContent='That picture is too large (max 15 MB).';
  const u=URL.createObjectURL(f);try{img=await loadImg(u)}catch{return q('.er').textContent='Could not read that picture.'}finally{URL.revokeObjectURL(u)}zoom=1;ox=oy=0;q('.zm').value=1;redraw()};
 q('.zm').oninput=e=>{zoom=+e.target.value;redraw()};
 cv.onpointerdown=e=>{if(!img)return;cv.setPointerCapture(e.pointerId);let lx=e.clientX,ly=e.clientY;const k=()=>Math.min(img.width,img.height)/zoom/128;
  cv.onpointermove=m=>{ox-=(m.clientX-lx)*k();oy-=(m.clientY-ly)*k();lx=m.clientX;ly=m.clientY;const lim=(img.width-Math.min(img.width,img.height)/zoom)/2,limy=(img.height-Math.min(img.width,img.height)/zoom)/2;ox=Math.max(-lim,Math.min(lim,ox));oy=Math.max(-limy,Math.min(limy,oy));redraw()};
  cv.onpointerup=()=>cv.onpointermove=null};
 q('.pri').onclick=async()=>{q('.er').textContent='';let data;
  if(tab=='pre'){if(!pre)return q('.er').textContent='Pick one of the classic avatars.';data=pre}
  else{const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');
   if(tab=='up'||tab=='bm'){if(!img)return q('.er').textContent='Choose a picture first.';draw(c,ctx,96)}
   else{const i=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg(o)));ctx.drawImage(i,0,0,96,96)}
   data=tab=='bm'?toDataA(c):toData(c);if(!data)return q('.er').textContent='Could not shrink that picture enough. Try another.'}
  q('.pri').disabled=true;socket.emit('avatar:set',data,r=>{q('.pri').disabled=false;if(!r||r.error)return q('.er').textContent=(r&&r.error)||'Could not save.';close();onSaved&&onSaved(r.av)})};
 return d}
window.YAv={html,update,editor,svg,OPT,cache,listen(socket,fn){socket.on('avatar',({name,av})=>{update(name,av);fn&&fn(name,av)})}};
})();
