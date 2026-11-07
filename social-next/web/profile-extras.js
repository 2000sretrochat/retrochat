// Browser-local profile customization. No real names are required.
const profileNameState = read('profileNameState', { name: read('displayAlias', 'Zainy'), changedAt: 0 });
const profileNameWait = 7 * 24 * 60 * 60 * 1000;
let displayAlias=window.socialSession.profile.display_name || window.socialSession.alias,portrait=read('portrait',''),details={orientation:'',zodiac:'',enabled:false,...read('details',{}),age:window.socialSession.profile.age ?? '',location:window.socialSession.profile.location || '',sex:window.socialSession.profile.sex || '',status:window.socialSession.profile.profile_status || ''},playlist=read('playlist',[]),walls=read('walls',{});
const baseProfile=profile,baseEdit=editProfile;
function persistProfile(k,v){try{save(k,v);return true}catch{toast('Browser storage is full. Try a smaller image.');return false}}
function youtubeId(url){try{const u=new URL(url);let id;if(u.hostname==='youtu.be')id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname))id=u.searchParams.get('v')||u.pathname.split('/').filter(Boolean)[1];return /^[\w-]{11}$/.test(id||'')?id:null}catch{return null}}
profile=function(n){baseProfile(n);const me=n==='Zainy',about=$('.space-about'),posts=$('.space-posts');if(me){$('.space-card h2').textContent=displayAlias;$('.personal-cover strong').textContent=displayAlias;const avatar=$('.space-card>.avatar');avatar.outerHTML=`<img class="profile-portrait" src="${esc(portrait || 'colorful-leaf.svg')}" alt="${esc(displayAlias)} profile image">`;$('.space-card .handle').insertAdjacentHTML('afterend',`<blockquote class="profile-thought">“${esc(headline)}”</blockquote>`)}
if(me&&details.enabled){const entries=[['Status',details.status],['Orientation',details.orientation],['Zodiac',details.zodiac]].filter(x=>x[1]);about.insertAdjacentHTML('beforeend',`<section class="space-card"><h3>A little more about me</h3>${entries.length?'<dl class="personal-details">'+entries.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')+'</dl>':'<p>Add only the details you want to share.</p>'}</section>`)}
if(me)posts.insertAdjacentHTML('afterbegin',`<section class="space-card music-box"><div class="box-heading"><h3>My soundtrack</h3><button class="text-action" onclick="managePlaylist()">Arrange playlist ↗</button></div><div id="music-player"></div><ol class="track-list">${playlist.map((t,i)=>`<li><button onclick="playTrack(${i})"><span>▶</span> ${esc(t.title)}</button><small>${t.kind==='youtube'?'YouTube':'Audio'}</small></li>`).join('')}</ol>${playlist.length?'':'<p>Collect the songs that feel like you. Add YouTube links or direct audio links, then arrange them in your order.</p><button class="secondary" onclick="managePlaylist()">＋ Add your first song</button>'}</section>`);
posts.insertAdjacentHTML('beforeend',`<section class="space-card profile-wall"><div class="box-heading"><h3>${me?'My wall':n+'’s wall'}</h3><span>Leave a little something.</span></div><p class="wall-note">Profile wall preview · Messages stay in this browser.</p><form id="wall-form"><label for="wall-text">Post on this space</label><textarea id="wall-text" placeholder="A hello, a thought, something worth sharing…" maxlength="1500" required></textarea><button class="primary">Post to wall</button></form><div class="wall-entries">${(walls[n]||[]).map(w=>`<article class="wall-entry"><strong>${esc(displayAlias)}</strong><small>${esc(w.time)}</small><p>${esc(w.text)}</p><button class="text-action" onclick="comment('${w.id}')">♧ Reply ${(comments[w.id]||[]).length||''}</button>${(comments[w.id]||[]).map(c=>'<p class="wall-reply"><strong>'+esc(displayAlias)+'</strong> '+esc(c)+'</p>').join('')}${me?`<button class="text-action remove-wall" onclick="removeWall('${w.id}')">Remove</button>`:''}</article>`).join('')||'<p>No wall posts yet. This is a place for your people to say hello.</p>'}</div></section>`);
$('#wall-form').onsubmit=e=>{e.preventDefault();const text=$('#wall-text').value.trim();if(!text)return;const next={...walls,[n]:[{id:'wall-'+Date.now(),text,time:new Date().toLocaleDateString()},...(walls[n]||[])]};if(persistProfile('walls',next)){walls=next;profile(n)}};
};
function removeWall(id){const n=window.profileName,next={...walls,[n]:(walls[n]||[]).filter(w=>w.id!==id)};if(persistProfile('walls',next)){walls=next;profile(n)}}
editProfile=function(){baseEdit();const form=$('#edit-form');form.insertAdjacentHTML('afterbegin',`<label>Public alias / display name<input name="displayAlias" value="${esc(displayAlias)}" maxlength="60" required><small>A nickname is enough. You never need to use your real name.</small></label><label>Profile image<input name="portrait" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><button type="button" class="text-action" id="remove-portrait">Remove profile image</button>`);form.querySelector('label:has([name=headline])').firstChild.textContent='Your thought / status note';form.insertAdjacentHTML('beforeend',`<fieldset class="details-editor"><legend>Optional profile details</legend><label class="checkbox-label"><input name="detailsEnabled" type="checkbox" ${details.enabled?'checked':''}> Show this box on my page</label><label>Status<input name="personalStatus" value="${esc(details.status)}" maxlength="70" placeholder="Share only if you want to"></label><label>Orientation<input name="orientation" value="${esc(details.orientation)}" maxlength="70" placeholder="Optional"></label><label>Zodiac<input name="zodiac" value="${esc(details.zodiac)}" maxlength="40" placeholder="Optional"></label></fieldset>`);form.appendChild(form.querySelector('button.primary'));let nextPortrait=portrait, imagePending=false, imageRequest=0;
const preview=document.createElement('img');
preview.className='profile-portrait';
preview.alt='Profile picture preview';
preview.src=nextPortrait||'colorful-leaf.svg';
form.elements.portrait.closest('label').after(preview);
preview.insertAdjacentHTML('afterend', '<fieldset id="portrait-crop" hidden><legend>Position your square profile picture</legend>' +
  '<label>Horizontal position<input name="cropX" type="range" min="0" max="100" value="50"></label>' +
  '<label>Vertical position<input name="cropY" type="range" min="0" max="100" value="50"></label>' +
  '<label>Zoom<input name="cropZoom" type="range" min="100" max="300" value="100"></label></fieldset>');
const cropControls = form.querySelector('#portrait-crop');
let cropImage;
function updateCrop() {
  if (!cropImage) return;
  const { cropX, cropY, cropZoom } = form.elements;
  const { naturalWidth, naturalHeight } = cropImage;
  const side = Math.min(naturalWidth, naturalHeight) * 100 / Number(cropZoom.value);
  const x = (naturalWidth - side) * Number(cropX.value) / 100;
  const y = (naturalHeight - side) * Number(cropY.value) / 100;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 384;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, 384, 384);
  context.drawImage(cropImage, x, y, side, side, 0, 0, 384, 384);
  nextPortrait = canvas.toDataURL('image/jpeg', 0.86);
  preview.src = nextPortrait;
}
cropControls.addEventListener('input', updateCrop);
const nameInput = form.elements.displayAlias;
const unlockAt = profileNameState.changedAt + profileNameWait;
if (unlockAt > Date.now()) {
  nameInput.readOnly = true;
  nameInput.closest('label').insertAdjacentHTML('beforeend', '<small>Next name change: ' +
    esc(new Date(unlockAt).toLocaleString()) + '</small>');
}
const submitButton=form.querySelector('button.primary');
$('#remove-portrait').onclick=()=>{
  imageRequest++;
  imagePending=false;
  submitButton.disabled=false;
  form.elements.portrait.value='';
  cropImage = null;
  cropControls.hidden = true;
  nextPortrait='';
  preview.src='colorful-leaf.svg';
  toast('Profile image will be removed when you save.');
};
form.elements.portrait.onchange=async event=>{
  const file=event.target.files[0];
  if(!file)return;
  if(file.size>12000000||!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){
    event.target.value='';toast('Choose a JPG, PNG, WebP, or GIF under 12 MB.');return;
  }
  const request=++imageRequest;
  imagePending=true;
  submitButton.disabled=true;
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();
    image.src=url;
    await image.decode();
    if(request!==imageRequest)return;
    cropImage = image;
    form.elements.cropX.value = form.elements.cropY.value = '50';
    form.elements.cropZoom.value = '100';
    cropControls.hidden = false;
    updateCrop();
  } catch { if(request===imageRequest){event.target.value='';toast('That image could not be opened. Choose another picture.');} }
  finally { URL.revokeObjectURL(url); if(request===imageRequest){imagePending=false;submitButton.disabled=false;} }
};
const submit=form.onsubmit;form.onsubmit=e=>{if(imagePending){e.preventDefault();return;}const f=form.elements,newDetails={enabled:f.detailsEnabled.checked,status:f.personalStatus.value.trim(),orientation:f.orientation.value.trim(),zodiac:f.zodiac.value.trim()},newAlias=f.displayAlias.value.trim();if(!newAlias){e.preventDefault();return}const storedName = read('profileNameState', profileNameState);
if (newAlias !== storedName.name && Date.now() < storedName.changedAt + profileNameWait) {
  e.preventDefault();
  toast('You can change your profile name once every 7 days.');
  return;
}
if(!persistProfile('portrait',nextPortrait)){e.preventDefault();return}
if (newAlias !== storedName.name) {
  const nextName = { name: newAlias, changedAt: Date.now() };
  if (!persistProfile('profileNameState', nextName)) { e.preventDefault(); return; }
  Object.assign(profileNameState, nextName);
}
portrait=nextPortrait;displayAlias=newAlias;details=newDetails;save('details',details);submit(e)}};
function playTrack(i){const t=playlist[i];if(!t)return;$('#music-player').innerHTML=`<p class="now-playing">Now playing · ${esc(t.title)}</p>`+(t.kind==='youtube'?`<iframe title="YouTube player: ${esc(t.title)}" src="https://www.youtube-nocookie.com/embed/${t.id}?playlist=${playlist.slice(i+1).filter(x=>x.kind==='youtube').map(x=>x.id).join(',')}&autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="wall-note">If embedding is unavailable, <a href="https://www.youtube.com/watch?v=${t.id}" target="_blank" rel="noopener">open this song on YouTube ↗</a>.</p>`:`<audio controls autoplay src="${esc(t.url)}"></audio><p class="wall-note">If this audio link is unavailable, edit the playlist to replace it.</p>`)}
function managePlaylist(){modal(`<h2>Your soundtrack. Your order.</h2><p>Add a YouTube video, or a direct HTTPS audio link for audio-only playback. Use audio you have permission to share.</p><form id="track-form"><label>Song title<input name="title" required maxlength="120" placeholder="Artist — song"></label><label>YouTube or audio URL<input name="url" required type="url" placeholder="https://…"></label><button class="primary">＋ Add song</button></form><div id="track-editor"></div>`);drawTracks();$('#track-form').onsubmit=e=>{e.preventDefault();const f=e.target.elements,url=f.url.value.trim(),id=youtubeId(url);let u;try{u=new URL(url)}catch{return}if(u.protocol!=='https:'||(!id&&!/\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url))){toast('Use a YouTube video link or a direct HTTPS .mp3, .m4a, .ogg, or .wav link.');return}const next=[...playlist,{title:f.title.value.trim(),kind:id?'youtube':'audio',id,url}];if(!persistProfile('playlist',next))return;playlist=next;f.title.value='';f.url.value='';drawTracks();profile('Zainy')}}
function drawTracks(){$('#track-editor').innerHTML=playlist.map((t,i)=>`<div class="track-editor-row"><span>${i+1}. ${esc(t.title)}</span><button aria-label="Move ${esc(t.title)} up" onclick="moveTrack(${i},-1)" ${i===0?'disabled':''}>↑</button><button aria-label="Move ${esc(t.title)} down" onclick="moveTrack(${i},1)" ${i===playlist.length-1?'disabled':''}>↓</button><button aria-label="Remove ${esc(t.title)}" onclick="moveTrack(${i},0)">×</button></div>`).join('')||'<p>No songs yet.</p>'}
function moveTrack(i,d){const next=[...playlist];if(!d)next.splice(i,1);else if(next[i+d])[next[i],next[i+d]]=[next[i+d],next[i]];if(persistProfile('playlist',next)){playlist=next;drawTracks();profile('Zainy')}}
