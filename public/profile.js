// Profiles + rating badges + 18+ confirm (shared by Messenger and Rooms)
(function(){const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeProfile, pendingProfile;
function openProfile(key, render){
 if(activeProfile?.isConnected && activeProfile.profileKey===key){activeProfile._pw?.focus();activeProfile.focus();return Promise.resolve(activeProfile);}
 if(pendingProfile?.key===key)return pendingProfile.promise;
 const request={key};pendingProfile=request;
 request.promise=Promise.resolve().then(()=>render(request)).finally(()=>{if(pendingProfile===request)pendingProfile=null;});
 return request.promise;
}
function win(title,html,compact=false){activeProfile?.remove();const w=document.createElement('div');w.className=compact?'yprof contact-profile':'yprof';
 w.innerHTML=`<div class=tbar>${E(title)}<span class=sp></span><button type=button class=x aria-label="Close profile">×</button></div><div class=pb>${html}</div>`;w.tabIndex=-1;w.profileKey=pendingProfile?.key;activeProfile=w;document.body.appendChild(w);w.querySelector('.x').onclick=()=>w.remove();
 if(compact)return w;
 const t=w.querySelector('.tbar');t.onmousedown=e=>{if(e.target.closest('.x'))return;const r=w.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;const m=ev=>{w.style.left=ev.clientX-dx+'px';w.style.top=ev.clientY-dy+'px';w.style.transform='none'};const u=()=>{removeEventListener('mousemove',m);removeEventListener('mouseup',u)};addEventListener('mousemove',m);addEventListener('mouseup',u)};return w}
const socialPath=name=>'/social-next/@'+encodeURIComponent(name.toLowerCase());
async function socialApi(path,body,method='PUT'){
 const response=await fetch('/social-next/api'+path,body===undefined?{}:{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>null);if(!response.ok)throw Error(data?.error||'Sign in to Razzle Social to use profile photos.');return data;
}
function show(name,opts={}){return openProfile("view:"+name.toLowerCase(),request=>renderProfile(name,opts,request));}
async function renderProfile(name,opts,request){let p;const record=socialApi('/profile/'+encodeURIComponent(name)).catch(()=>null);
 try{const r=await fetch('/api/profile/'+encodeURIComponent(name));p=await r.json();if(!r.ok)throw p}catch(e){return alert((e&&e.error)||'Could not load that profile.')}
 const social=await record,photos=social?.gallery||[];if(pendingProfile!==request)return;
 const avSrc=(/^bot:[a-z0-9_-]+$/.test(p.avatar||'')?('/bot-av/'+p.avatar.slice(4)):(`/av/${encodeURIComponent(p.name)}?v=${encodeURIComponent(p.avatar||'0')}`)); const av=`<img class=pav src="${E(avSrc)}" alt="">`;
 const pictures=photos.length?photos:(/^(?:c[0-9a-z]+|bot:[a-z0-9_-]+)$/.test(p.avatar||'')?[{image:avSrc}]:[]);
 const pictureMarkup=pictures.length?`<div class="profile-photos" aria-label="Profile photos">
 ${pictures.map((photo,i)=>`<button type="button" class="profile-thumb" data-photo-index="${i}" aria-label="Enlarge photo ${i+1} of ${pictures.length}"><img src="${E(photo.image)}" alt=""><span>${i+1}</span></button>`).join('')}
 </div>`:'';
 if(p.guest)return win(p.name+' - Profile',`<div class=ph>${av}<div><div class=pn>${E(p.name)}</div><div class=pg>${p.online?'online now':'offline'}</div></div></div><p class=pm>This member has a minimal profile.</p>`,true);
 const row=(k,v)=>v?`<tr><th>${k}</th><td>${E(v)}</td></tr>`:'';const since=p.memberSince?new Date(p.memberSince).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}):'';
 const botTag='';
 const w=win(p.name+' – Profile',`<div class=ph>${av}<div><div class=pn>${E(p.displayName||p.name)}${botTag}</div><div class=pg>@${E(p.name)} &middot; ${p.online?'<span class="sdot available"></span> online':'offline'}</div></div></div>
 ${pictureMarkup}
 ${social?.private||p.private?'<p class=pm>Private profile</p>':(p.bio?`<p class=pbio>${E(p.bio)}</p>`:'')+`<table class=pt>${row('Age',p.age)}${p.location?`<tr><th>Location</th><td>${window.YFlag?YFlag(p.location)+' ':''}${E(p.location)}</td></tr>`:''}${row('Interests',p.interests)}${p.bot?row('Room',p.room):''}${row('Member since',since)}</table>`}
 <div class=profile-social-actions><a class=profile-social-link href="${socialPath(p.name)}" target=_blank rel=noopener>View Razzle Social profile</a>
 ${social?.canRequest && !social.owner && !social.friend?`<button type=button data-profile-add ${social.requestPending?'disabled>Request sent':'>Add friend'}</button>`:''}</div>
 ${!p.bot&&opts.me&&opts.me.toLowerCase()==p.name.toLowerCase()?'<div class=pbtn><button class="btn pri" id=pEdit>Edit Profile</button></div>':''}`,true);
 const socialLink=w.querySelector('.profile-social-link');
 if(window.YappDesktop?.openExternal)socialLink.onclick=event=>{event.preventDefault();window.YappDesktop.openExternal(socialLink.href)};
 const add=w.querySelector('[data-profile-add]');
 if(add)add.onclick=async()=>{
  add.disabled=true;
  try{const result=await socialApi('/friends/'+encodeURIComponent(p.name),{action:'request'},'POST');add.textContent=result.accepted?'Friends':'Request sent';}
  catch(error){add.disabled=false;alert(error.message);}
 };
 const details=w.querySelector('.pb');
 details.querySelectorAll('.pbio,.pt td').forEach(node=>node.title=node.textContent);
 details.querySelectorAll('[data-photo-index]').forEach(button=>button.onclick=()=>{
  let index=Number(button.dataset.photoIndex);
  const viewer=document.createElement('section');
  viewer.className='profile-photo-viewer';viewer.setAttribute('aria-label','Profile photo viewer');
  viewer.innerHTML='<button type="button" class="profile-photo-back">‹ All photos</button><img class="profile-photo-large" alt=""><div class="profile-photo-nav"><button type="button" data-photo-step="-1" aria-label="Previous photo">‹</button><span aria-live="polite"></span><button type="button" data-photo-step="1" aria-label="Next photo">›</button></div>';
  function showPhoto(step=0){
   index=(index+step+pictures.length)%pictures.length;
   const image=viewer.querySelector('img');image.src=pictures[index].image;image.alt='Profile photo '+(index+1)+' of '+pictures.length;
   viewer.querySelector('.profile-photo-nav span').textContent=(index+1)+'/'+pictures.length;
  }
  const back=viewer.querySelector('.profile-photo-back');
  back.onclick=()=>{viewer.remove();w.classList.remove('viewing-photo');button.focus();};
  viewer.querySelectorAll('[data-photo-step]').forEach(arrow=>{arrow.disabled=pictures.length<2;arrow.onclick=()=>showPhoto(Number(arrow.dataset.photoStep));});
  viewer.onkeydown=event=>{
   if(!['ArrowLeft','ArrowRight','Escape'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();
   if(event.key==='Escape')back.click();else showPhoto(event.key==='ArrowLeft'?-1:1);
  };
  details.append(viewer);w.classList.add('viewing-photo');showPhoto();back.focus();
 });
 const b=w.querySelector('#pEdit');if(b)b.onclick=()=>edit(p);return w;}
function edit(p){return openProfile("edit",request=>renderEditor(p,request));}
async function renderEditor(p,request){if(!p||!p.name){const me=await fetch('/api/me').then(r=>r.json());if(!me.name)return alert('Sign in with a screen name to edit your profile.');p=await fetch('/api/profile/'+encodeURIComponent(me.name)).then(r=>r.json())}
 if(pendingProfile!==request)return;
 const w=win('Edit My Profile',`<label>Display name<input id=pf1 maxlength=30 value="${E(p.displayName)}"></label><label>Age (optional)<input id=pf2 type=number min=18 max=120 value="${E(p.age??'')}"></label>
 <label>Location (optional) <span id=pfflag style="font-size:18px"></span><input id=pf3 maxlength=50 value="${E(p.location)}" placeholder="Brooklyn, NY"></label><label>About me<textarea id=pf4 maxlength=300 rows=3>${E(p.bio)}</textarea></label>
 <label>Interests<input id=pf5 maxlength=1500 value="${E(p.interests)}" placeholder="music, gaming, movies"></label><div class=perr id=pfe></div><div class=pbtn><button class=btn id=pfphotos>Profile Photos</button><button class=btn id=pfc>Cancel</button><button class="btn pri" id=pfs>Save</button></div>`);
 window.RazzleInterests.mount(w.querySelector('#pf5'));
 w.querySelector('#pfphotos').onclick=()=>editPhotos(p.name).catch(error=>alert(error.message));
 const fl=()=>{const f=w.querySelector('#pfflag');if(f&&window.YFlag)f.textContent=YFlag(w.querySelector('#pf3').value)};w.querySelector('#pf3').oninput=fl;fl();
 w.querySelector('#pfc').onclick=()=>w.remove();w.querySelector('#pfs').onclick=async()=>{const v=i=>w.querySelector('#pf'+i).value;
  const r=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:v(1),age:v(2),location:v(3),bio:v(4),interests:v(5)})});const j=await r.json();
  if(!r.ok)return w.querySelector('#pfe').textContent=j.error||'Could not save.';w.remove();show(p.name,{me:p.name})}}
function editPhotos(name){return openProfile("photos",request=>renderPhotos(name,request));}
async function renderPhotos(name,request) {
 const profile=await socialApi('/profile/'+encodeURIComponent(name));if(pendingProfile!==request)return;
 const photos=(profile.gallery || []).map(photo=>({...photo}));
 let defaultId=profile.galleryDefault;
 const w=win('Messenger Profile Pictures','<p>Add up to 6 photos. All photos saved here are public. Choose your Messenger default; your Social default stays separate.</p><div class=profile-gallery-editor></div><label class=profile-photo-drop tabindex=0>Drop photos here or choose files<input type=file multiple accept="image/jpeg,image/png,image/webp"></label><p class=perr role=status></p><div class=pbtn><button class=btn data-back>Cancel</button><button class="btn pri" data-save>Save photos</button></div>');
 const list=w.querySelector('.profile-gallery-editor'),input=w.querySelector('input[type=file]'),error=w.querySelector('.perr'),save=w.querySelector('[data-save]');
 function draw(){
  list.innerHTML=photos.map((photo,i)=>`<div class=gallery-row><img src="${E(photo.icon||photo.image)}" alt="Photo ${i+1}"><label><input type=radio name=primary value="${i}" ${photo.id===defaultId?'checked':''}> Default</label><span class=gallery-public>Public</span><button type=button data-crop="${i}">Crop icon</button><button type=button data-remove="${i}">Remove</button></div>`).join('');
  input.disabled=photos.length>=6;
 }
 list.onchange=event=>{
  const target=event.target;
  if(target.name==='primary')defaultId=photos[Number(target.value)].id;
  else if(target.dataset.visibility!==undefined)photos[Number(target.dataset.visibility)].mode=target.value;
 };
 list.onclick=event=>{
  const crop=event.target.closest('[data-crop]');if(crop){cropIcon(photos[Number(crop.dataset.crop)]);return;}
  const button=event.target.closest('[data-remove]');if(!button)return;
  const [removed]=photos.splice(Number(button.dataset.remove),1);
  if(removed.id===defaultId)defaultId=photos[0]?.id||'';
  draw();
 };
 let busy=false;
 async function cropIcon(photo){
  if(busy)return;busy=true;save.disabled=input.disabled=true;list.inert=true;error.textContent='';
  const panel=document.createElement('section');panel.className='profile-icon-crop';
  panel.innerHTML='<h3>Crop your Messenger icon</h3><p>Your full photo stays in the gallery. Drag the preview or adjust the sliders.</p><canvas width=256 height=256 tabindex=0 aria-label="Messenger icon crop preview"></canvas><label>Horizontal position<input type=range data-crop-x min=0 max=100 value=50></label><label>Vertical position<input type=range data-crop-y min=0 max=100 value=50></label><label>Zoom<input type=range data-crop-zoom min=1 max=3 step=.05 value=1></label><div class=pbtn><button type=button data-crop-cancel>Cancel crop</button><button type=button class="btn pri" data-crop-use>Use as Messenger icon</button></div>';
  list.after(panel);const q=s=>panel.querySelector(s),canvas=q('canvas'),x=q('[data-crop-x]'),y=q('[data-crop-y]'),zoom=q('[data-crop-zoom]');
  const close=()=>{panel.remove();busy=false;list.inert=false;save.disabled=false;draw();};q('[data-crop-cancel]').onclick=close;
  try{
   const image=new Image();image.src=photo.image;await image.decode();if(!panel.isConnected)return;
   function drawCrop(){const side=Math.min(image.naturalWidth,image.naturalHeight)/Number(zoom.value),sx=(image.naturalWidth-side)*Number(x.value)/100,sy=(image.naturalHeight-side)*Number(y.value)/100;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,256,256);ctx.drawImage(image,sx,sy,side,side,0,0,256,256);}
   panel.querySelectorAll('input').forEach(control=>control.oninput=drawCrop);
   let drag=null;canvas.onpointerdown=event=>{canvas.setPointerCapture(event.pointerId);drag={x:event.clientX,y:event.clientY,sx:Number(x.value),sy:Number(y.value)};};
   canvas.onpointermove=event=>{if(!drag)return;const side=Math.min(image.naturalWidth,image.naturalHeight)/Number(zoom.value),size=canvas.getBoundingClientRect().width,dx=image.naturalWidth-side,dy=image.naturalHeight-side;if(dx)x.value=Math.max(0,Math.min(100,drag.sx-(event.clientX-drag.x)/size*side/dx*100));if(dy)y.value=Math.max(0,Math.min(100,drag.sy-(event.clientY-drag.y)/size*side/dy*100));drawCrop();};canvas.onpointerup=canvas.onpointercancel=()=>drag=null;
   q('[data-crop-use]').onclick=()=>{let icon='';for(const quality of [.88,.72,.55,.35]){icon=canvas.toDataURL('image/jpeg',quality);if(icon.length<=100000)break;}if(icon.length>100000){error.textContent='Could not compress that icon. Try another photo.';return;}photo.icon=icon;defaultId=photo.id;close();error.textContent='Icon crop ready. Save photos to apply it.';};
   drawCrop();canvas.focus();panel.scrollIntoView({block:'nearest'});
  }catch(e){close();error.textContent='Could not crop that photo. Please try another image.';}
 }
 async function addFiles(files){
  if(busy)return;busy=true;
  if(files.length>6-photos.length){error.textContent='Add up to 6 photos. Remove a photo to make room.';busy=false;return;}
  for(const file of files){if(!file||photos.length>=6)break;
  error.textContent='';save.disabled=input.disabled=true;
  let url='';
  try{
   if(file.size>12000000||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, or WebP under 12 MB.');
   url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();
   const canvas=document.createElement('canvas'),scale=Math.min(1,768/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
   let data=canvas.toDataURL('image/jpeg',0.8);if(data.length>450000)data=canvas.toDataURL('image/jpeg',0.55);
   while(data.length>450000&&canvas.width>256&&canvas.height>256){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);canvas.width=Math.round(canvas.width*.8);canvas.height=Math.round(canvas.height*.8);canvas.getContext('2d').drawImage(copy,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',.65);}
   if(data.length>450000)throw Error('Could not compress that photo. Try another image.');
   const id=crypto.randomUUID();photos.push({id,mode:'public',image:data});if(photos.length===1)defaultId=id;
  }catch(e){error.textContent=e.message;}finally{if(url)URL.revokeObjectURL(url);input.value='';draw();}
  }busy=false;save.disabled=false;draw();
 }
 input.onchange=()=>addFiles([...input.files]);
 const drop=w.querySelector('.profile-photo-drop');
 drop.ondragover=event=>{event.preventDefault();drop.classList.add('drag-over');};
 drop.ondragleave=()=>drop.classList.remove('drag-over');
 drop.ondrop=event=>{event.preventDefault();drop.classList.remove('drag-over');addFiles([...event.dataTransfer.files]);};
 drop.onkeydown=event=>{if(event.target===drop&&(event.key==='Enter'||event.key===' ')){event.preventDefault();input.click();}};
 w.querySelector('[data-back]').onclick=()=>show(name,{me:name});
 save.onclick=async()=>{
  if(busy)return;
  if(photos.length&&!defaultId){error.textContent='Choose one default photo.';return;}
  save.disabled=true;error.textContent='';
  try{await socialApi('/profile-gallery',{photos:photos.map(photo=>({...photo,mode:'public'})),defaultId,revision:profile.galleryRevision,publishAll:true});if(w.isConnected)await show(name,{me:name});}
  catch(e){error.textContent=e.message;}finally{save.disabled=false;}
 };
 draw();
}
const badge=r=>r?`<span class="rate r${r=='PG-13'?'pg':r.toLowerCase()}" title="Rated ${r}">${r}</span>`:'';
function confirm18(){return confirm('This room is rated R (adults only, 18+).\n\nI am 18 or older and want to see R-rated rooms.')}
window.YProf={show,edit,badge,confirm18}})();
