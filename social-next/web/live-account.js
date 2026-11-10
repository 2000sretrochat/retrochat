(() => {
  const session=window.socialSession, me=session.alias, myId=session.id;
  const frame=$('#live-social-messenger'), peopleByName=new Map(), postsById=new Map();
  const alignFooter=()=>{const footer=document.querySelector('body > .social-footer');if(footer)document.querySelector('body > .app').appendChild(footer);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',alignFooter,{once:true});else alignFooter();
  let feed=[], friends=[], people=[], inbox={notifications:[],requests:[]}, loading=false, profileGeneration=0;
  let settingsQueue=Promise.resolve();

  async function api(path,method='GET',body) {
    const response=await fetch('/social-next/api'+path,{method,cache:'no-store',
      headers:body===undefined?{}:{'Content-Type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body)});
    const result=await response.json().catch(()=>({error:'Social is temporarily unavailable.'}));
    if(!response.ok)throw Error(result.error || 'Request failed. Please retry.');
    return result;
  }
  function remember(person) {
    peopleByName.set(person.name.toLowerCase(),{name:person.name,
      displayName:person.displayName || person.display_name || person.name,
      portrait:person.portrait || person.settings?.portrait || ''});
  }
  remember({name:me,displayName:displayAlias,portrait});
  const displayName=name=>peopleByName.get(name.toLowerCase())?.displayName || name;
  profileAvatar=function(name) {
    const image=peopleByName.get(name.toLowerCase())?.portrait;
    return '<span class="avatar member-thumbnail">'+(image?'<img src="'+esc(image)+'" alt="">':esc(name[0].toUpperCase()))+'</span>';
  };
  profileUserLink=name=>'<a href="/social-next/@'+encodeURIComponent(name.toLowerCase())+'" data-profile-link="'+esc(name)+'">'+esc(displayName(name))+'</a>';
  const author=name=>'<strong class="post-author">'+profileAvatar(name)+profileUserLink(name)+'</strong>';
  window.socialPersist=(key,value)=>{
    if(!['portrait','headline','cover','appearance','visibility','favoriteRooms','musicService','details','defaultPresence'].includes(key))return;
    settingsQueue=settingsQueue.catch(()=>{}).then(()=>api('/settings','PATCH',{[key]:value})).then(settings=>{
      session.settings=settings;
      if(key==='portrait'){remember({name:me,displayName:displayAlias,portrait:value});updateProfilePortraits();}
    }).catch(error=>toast('Could not save this change: '+error.message));
  };
  for(const key of ['portrait','headline','cover','appearance','visibility','favoriteRooms','musicService','details','defaultPresence']) {
    if(Object.hasOwn(session.settings,key))continue;
    try {
      const stored=localStorage.getItem('razzle-social-next:'+myId+':'+key);
      if(stored!==null)window.socialPersist(key,JSON.parse(stored));
    } catch { /* A damaged local preference does not prevent sign-in. */ }
  }
  async function photoData(file) {
    if(!file)return '';
    if(file.size>12000000 || !['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, or WebP under 12 MB.');
    const url=URL.createObjectURL(file);
    try {
      const image=new Image();image.src=url;await image.decode();
      const ratio=Math.min(1,1000/Math.max(image.naturalWidth,image.naturalHeight));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));
      const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      let data=canvas.toDataURL('image/jpeg',0.8);
      if(data.length>700000)data=canvas.toDataURL('image/jpeg',0.55);
      if(data.length>700000)throw Error('Choose a smaller photo.');
      return data;
    } finally {URL.revokeObjectURL(url);}
  }
  function normalize(row) {
    remember(row);(row.comments || []).forEach(remember);
    const post={...row,text:row.body,url:row.link,image:row.image || null,location:row.place,
      createdAt:row.created,time:postTime({createdAt:row.created}),topic:'Your space'};
    postsById.set(post.id,post);return post;
  }
  function eventCard(post){
    if(!post.event_at)return '';
    const start=new Date(post.event_at);
    return '<div class="space-card"><strong>Room event</strong><p>'+esc(post.event_room)+' · '+esc(start.toLocaleString())+'</p>'+
      '<a href="/rooms.html?room='+encodeURIComponent(post.event_room)+'">Open room</a> '+
      (start>Date.now()?'<button type="button" class="secondary" data-event-rsvp="'+post.id+'" aria-pressed="'+post.attending+'">'+(post.attending?'Going · Undo RSVP':'RSVP · Going')+'</button> ':'')+
      '<span>'+post.attendees+' going</span></div>';
  }
  function sharedCard(post) {
    const owner=post.author_id===myId, moderator=session.master || owner || post.wall_id===myId;
    const comments=(post.comments || []).map(comment=>'<div class="shared-comment">'+author(comment.name)+
      '<small>'+esc(new Date(comment.created).toLocaleString())+'</small><p>'+esc(comment.body)+'</p>'+
      ((comment.author_id===myId || post.wall_id===myId || session.master)?'<button type="button" class="text-action" data-shared-comment-remove="'+comment.id+'">Delete comment</button>':'')+'</div>').join('');
    return '<article class="post" data-post-id="'+post.id+'"><div class="post-top">'+author(post.name)+
      '<small>'+esc(new Date(post.createdAt).toLocaleString())+'</small></div>'+postDetailsMarkup(post)+'<p>'+esc(post.text)+'</p>'+eventCard(post)+
      (post.image?'<button type="button" class="profile-photo-open" data-shared-photo="'+post.id+'"><img src="'+esc(post.image)+'" alt="Shared photo"></button>':'')+
      (post.url?'<div class="link-preview">'+postLinkMedia(post.url)+'<a href="'+esc(post.url)+'" target="_blank" rel="noopener noreferrer">'+esc(new URL(post.url).hostname)+'</a></div>':'')+
      '<div class="post-actions"><button type="button" data-shared-like="'+post.id+'" aria-pressed="'+post.liked+'">'+(post.liked?'♥ Liked':'♡ Like')+' '+post.likes+'</button>'+
      '<button type="button" data-shared-comment="'+post.id+'">Comment '+(post.comments?.length || '')+'</button>'+
      (owner?'<button type="button" data-shared-edit="'+post.id+'">Edit</button>':'')+
      (moderator?'<button type="button" data-shared-delete="'+post.id+'">Delete</button>':'')+'</div>'+comments+'</article>';
  }
  card=sharedCard;
  const oldRender=render, ownerProfile=profile;
  render=function() {
    if(current!=='feed'){oldRender();return;}
    const query=q.trim().toLowerCase();
    $('#content').innerHTML=feed.filter(post=>!query || (post.text+' '+post.name+' '+displayName(post.name)).toLowerCase().includes(query))
      .map(sharedCard).join('') || '<section class="empty">No posts yet. Share something or visit a friend’s space.</section>';
  };
  function renderOwner() {
    ownerProfile(me);
    const stream=$('.space-posts');
    stream?.querySelectorAll(':scope > .post').forEach(node=>node.remove());
    if(spaceTab==='posts')stream?.insertAdjacentHTML('beforeend',own.map(sharedCard).join(''));
    loadArticlePreviews();
  }
  profile=function(name) {
    if(!/^[a-z][a-z0-9_.-]{2,19}$/i.test(name))return;
    const generation=++profileGeneration;
    if(name.toLowerCase()===me.toLowerCase()){renderOwner();return;}
    current='profile';window.profileName=name;publicPreview=false;
    history.pushState(null,'','/social-next/@'+encodeURIComponent(name.toLowerCase()));
    $('.write').hidden=true;$('.feed-nav').hidden=true;
    $('#content').innerHTML='<section class="empty">Loading profile…</section>';
    Promise.all([api('/profile/'+encodeURIComponent(name)),api('/posts?wall='+encodeURIComponent(name))]).then(([record,rows])=>{
      if(generation!==profileGeneration)return;
      remember(record);
      $('#content').classList.remove('custom-space');$('#content').removeAttribute('style');
      $('#heading').textContent=record.displayName;$('#subheading').textContent='@'+record.name.toLowerCase();
      const wall=record.friend?'<section class="space-card profile-wall"><h3>Leave a thought</h3><form id="friend-wall-form" data-wall="'+esc(record.name)+'"><textarea name="thought" maxlength="1500" required aria-label="Wall message"></textarea><button class="primary">Post</button></form></section>':'';
      $('#content').innerHTML='<div class="space-layout"><aside class="space-about"><section class="space-card">'+
        (record.settings.portrait?'<img class="profile-portrait" src="'+esc(record.settings.portrait)+'" alt="Profile photo">':profileAvatar(record.name))+
        '<h2>'+esc(record.displayName)+'</h2><span class="handle">@'+esc(record.name.toLowerCase())+'</span>'+(record.bot?'<p class="bot-profile-badge">Chat bot</p>':'')+'<p>'+esc(record.bio || '')+
        '</p><div class="profile-basics">'+esc([record.age,record.sex,record.location].filter(Boolean).join(' · '))+'</div><div class="space-actions">'+
        '<button class="secondary" data-live-message="'+esc(record.name)+'">Message</button>'+
        (!record.friend && !record.blocked?'<button class="secondary" data-live-request="'+esc(record.name)+'">Add friend</button>':'')+
        '<button class="text-action" data-profile-block="'+esc(record.name)+'" data-blocked="'+record.blocked+'">'+(record.blocked?'Unblock':'Block')+'</button>'+
        '<button class="text-action" data-profile-report="'+esc(record.name)+'">Report</button></div></section></aside><section class="space-posts">'+
        (record.private?'<section class="space-card private-notice"><h3>Private profile</h3><p>This person shares their space with friends.</p></section>':wall+rows.map(normalize).map(sharedCard).join(''))+'</section></div>';
      loadArticlePreviews();
    }).catch(error=>{if(generation===profileGeneration)$('#content').innerHTML='<section class="empty">'+esc(error.message)+'</section>';});
  };
  async function refreshView() {
    if(loading)return;
    loading=true;
    try {
      const [rows,mine,contacts]=await Promise.all([api('/posts'),api('/posts?wall='+encodeURIComponent(me)),api('/friends')]);
      feed=rows.map(normalize);own=mine.map(normalize);
      friends=contacts;contacts.forEach(remember);previewFriends.clear();contacts.forEach(person=>previewFriends.add(person.name));
      syncPreviewFriends();
      if(current==='feed')render();
      else if(current==='following')relationshipPanel();
      else if(current==='profile' && window.profileName?.toLowerCase()===me.toLowerCase() && !$('#dialog').open)renderOwner();
      loadArticlePreviews();
    } catch(error){toast(error.message);}
    finally{loading=false;}
  }
  function personRow(person) {return '<div class="suggestion">'+profileAvatar(person.name)+profileUserLink(person.name)+(person.bot?'<small class="bot-profile-badge">Bot</small>':'')+'</div>';}
  renderPeopleDirectory=()=>{
    current='people';$('.write').hidden=true;$('.feed-nav').hidden=true;
    $('#content').classList.remove('custom-space');$('#content').removeAttribute('style');
    $('#heading').textContent='Find your people';$('#subheading').textContent='Registered Razzle members.';
    $('#content').innerHTML='<section class="directory"><h2>Profiles</h2><form id="shared-people-filters" class="people-filters">'+
      '<label>Screen name or profile name<input name="screenName" type="search"></label>'+
      '<label>Age<select name="age"><option value="">Any age</option><option value="18-24">18–24</option><option value="25-34">25–34</option><option value="35-44">35–44</option><option value="45-120">45 and up</option></select></label>'+
      '<label>Sex<select name="sex"><option value="">Any</option><option>Male</option><option>Female</option></select></label>'+
      '<label>Location<input name="location" placeholder="City, state, or country"></label></form><div id="shared-people-list"></div></section>';
    const filters=$('#shared-people-filters');filters.elements.screenName.value=q;
    let timer;
    const update=()=>api('/people?q='+encodeURIComponent(filters.elements.screenName.value)).then(rows=>{
      rows.forEach(remember);
      const f=filters.elements,[min,max]=f.age.value.split('-').map(Number);
      const matches=rows.filter(person=>(!f.age.value || (person.age>=min && person.age<=max)) &&
        (!f.sex.value || person.sex===f.sex.value) && (!f.location.value || (person.location || '').toLowerCase().includes(f.location.value.toLowerCase())));
      if($('#shared-people-list'))$('#shared-people-list').innerHTML=matches.map(personRow).join('') || '<p>No matching profiles.</p>';
    }).catch(error=>toast(error.message));
    filters.onsubmit=event=>event.preventDefault();
    filters.oninput=()=>{clearTimeout(timer);timer=setTimeout(update,250);};
    update();
  };
  searchPeople=function() {
    const room=$('#live-chat-view');
    if(room){room.refreshRooms();return;}
    renderPeopleDirectory();
  };
  suggestions=function() {
    $('#follow-count').textContent=friends.length;
    const excluded=new Set([me,...friends.map(person=>person.name),...inbox.requests.map(person=>person.name)].map(name=>name.toLowerCase()));
    $('#suggestions').innerHTML=people.filter(person=>!excluded.has(person.name.toLowerCase())).slice(0,3).map(person=>
      '<div class="suggestion">'+profileAvatar(person.name)+profileUserLink(person.name)+'<button class="follow" data-live-request="'+esc(person.name)+'">Add friend</button></div>').join('') || '<p>No new suggestions right now.</p>';
  };
  const requestMarkup=person=>'<div class="notification-row">'+profileAvatar(person.name)+profileUserLink(person.name)+
    '<button class="secondary" data-shared-accept="'+esc(person.name)+'">Accept and add back</button><button class="text-action" data-shared-decline="'+esc(person.name)+'">Decline</button></div>';
  relationshipPanel=function() {
    current='following';$('.write').hidden=true;$('.feed-nav').hidden=true;
    $('#heading').textContent='Friends';$('#subheading').textContent='Your Razzle contacts and requests.';
    $('#content').classList.remove('custom-space');$('#content').removeAttribute('style');
    $('#content').innerHTML='<section class="directory"><h2>Friends</h2>'+friends.map(person=>
      '<div class="suggestion">'+profileAvatar(person.name)+profileUserLink(person.name)+'<button class="text-action" data-live-message="'+esc(person.name)+'">Message</button><button class="text-action" data-live-remove="'+esc(person.name)+'">Remove</button></div>').join('')+
      '<h2>Incoming requests</h2>'+inbox.requests.map(requestMarkup).join('')+'</section>';
  };
  async function refreshNotifications() {
    try {
      inbox=await api('/notifications');inbox.requests.forEach(remember);
      const seen=new Set(read('seenSharedRequests',[]));
      const count=inbox.notifications.filter(item=>!item.seen).length+inbox.requests.filter(item=>!seen.has(item.name)).length;
      const bell=$('#notification-bell'),badge=$('#notification-count');
      bell.classList.toggle('has-unread',count>0);badge.hidden=!count;badge.textContent=count?String(count):'';
      bell.setAttribute('aria-label',count?'Notifications, '+count+' new':'Notifications');
      if(current==='following')relationshipPanel();
    } catch {console.warn('Notification refresh unavailable');}
  }
  openNotifications=function() {
    let panel=document.querySelector('#notification-dropdown');
    if(panel){panel.remove();$('#notification-bell').setAttribute('aria-expanded','false');return;}
    panel=document.createElement('section');panel.id='notification-dropdown';panel.setAttribute('aria-label','Notifications');panel.tabIndex=-1;
    panel.innerHTML='<h2>Notifications</h2><h3>Friend requests</h3>'+(inbox.requests.map(requestMarkup).join('') || '<p>No pending requests.</p>')+
      '<h3>Post activity</h3>'+(inbox.notifications.map(item=>'<button class="text-action notification-post" data-shared-notification="'+item.post_id+'">'+esc(item.display_name)+' '+
        ({post:'posted on your wall',comment:'commented on your post',like:'liked your post'}[item.kind] || '')+'</button>').join('') || '<p>No post activity yet.</p>');
    document.querySelector('body > header').appendChild(panel);$('#notification-bell').setAttribute('aria-expanded','true');panel.focus();
    save('seenSharedRequests',inbox.requests.map(item=>item.name));
    api('/notifications/read','POST',{ids:inbox.notifications.map(item=>item.id)}).then(refreshNotifications).catch(error=>toast(error.message));
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('#notification-bell')){event.preventDefault();event.stopImmediatePropagation();openNotifications();}
    else if(!event.target.closest('#notification-dropdown')){document.querySelector('#notification-dropdown')?.remove();$('#notification-bell').setAttribute('aria-expanded','false');}
  },true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#notification-dropdown')?.remove();$('#notification-bell').setAttribute('aria-expanded','false');}});
  updateNotificationBadge=()=>{};
  async function friendAction(name,action) {
    const result=await api('/friends/'+encodeURIComponent(name),'POST',{action});
    await Promise.all([refreshView(),refreshNotifications()]);
    if(current==='following')relationshipPanel();suggestions();
    if(current==='profile'&&window.profileName.toLowerCase()!==me.toLowerCase())profile(window.profileName);
    return result;
  }
  follow=name=>friendAction(name,'request').then(result=>toast(result.accepted?'Added to your friends.':'Friend request sent.')).catch(error=>toast(error.message));
  request=name=>friends.some(person=>person.name===name)?privateChat(name):follow(name);
  const reopenDock=document.createElement('button');
  reopenDock.type='button';reopenDock.className='messenger-reopen';reopenDock.textContent='Open Messenger';reopenDock.hidden=true;frame.before(reopenDock);
  const dockUrl=frame.getAttribute('src');let messengerPopup=null;
  const restoreDock=()=>{
    if(messengerPopup&&!messengerPopup.closed)messengerPopup.close();messengerPopup=null;
    if(frame.getAttribute('src')==='about:blank')frame.src=dockUrl;
    frame.hidden=false;frame.classList.remove('collapsed','expanded');reopenDock.hidden=true;reopenDock.textContent='Open Messenger';
    frame.contentWindow.postMessage({source:'chatbabble-social',action:'expand'},location.origin);
  };
  reopenDock.onclick=restoreDock;
  setInterval(()=>{if(messengerPopup?.closed)restoreDock();},1000);
  privateChat=name=>{
    if(messengerPopup&&!messengerPopup.closed){messengerPopup.focus();messengerPopup.postMessage({source:'chatbabble-social',action:'open-chat',name},location.origin);return;}
    restoreDock();frame.scrollIntoView({block:'nearest'});frame.contentWindow.postMessage({source:'chatbabble-social',action:'open-chat',name},location.origin);
  };
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.source!=='chatbabble-messenger')return;
    if(event.data.type==='close'){frame.hidden=true;frame.classList.remove('expanded');reopenDock.hidden=false;return;}
    if(event.data.type==='collapse'){frame.classList.toggle('collapsed',Boolean(event.data.collapsed));frame.classList.remove('expanded');return;}
    if(event.data.type==='popout'){
      messengerPopup=window.open('/social/messenger.html?popout=1','razzleSocialMessenger','popup=yes,width=1040,height=740,resizable=yes,scrollbars=yes');
      if(!messengerPopup){toast('Allow pop-ups for this site to open Messenger in its own window.');return;}
      frame.src='about:blank';frame.hidden=true;frame.classList.remove('expanded');reopenDock.textContent='Bring Messenger back';reopenDock.hidden=false;return;
    }
    frame.classList.toggle('expanded',Boolean(event.data.overlay)&&!frame.classList.contains('collapsed')&&!frame.hidden);
    if(event.data.type==='state')refreshNotifications();
  });
  function openComment(id) {
    modal('<h2>Add a comment</h2><form id="shared-comment-form" data-post="'+id+'"><textarea name="body" maxlength="1500" required aria-label="Comment"></textarea><button class="primary">Post comment</button></form>');
  }
  comment=openComment;addProfileComment=openComment;
  const eventButton=document.createElement('button');
  eventButton.id='plan-room-event';eventButton.type='button';eventButton.className='text-action';eventButton.textContent='Plan a room event';
  $('#quick-post')?.append(eventButton);
  eventButton.onclick=async()=>{
    try {
      const rooms=await api('/events/rooms');
      modal('<h2>Plan a room event</h2><form id="shared-event-form"><label>Title<input name="title" maxlength="120" required></label>'+
        '<label>Room<select name="room" required>'+rooms.map(room=>'<option>'+esc(room)+'</option>').join('')+'</select></label>'+
        '<label>Starts (your local time)<input name="starts" type="datetime-local" required></label><button class="primary">Share event</button></form>');
      $('#shared-event-form').onsubmit=async event=>{
        event.preventDefault();
        const form=event.currentTarget,send=form.querySelector('button');send.disabled=true;
        try{
          await api('/posts','POST',{body:form.elements.title.value,event:{room:form.elements.room.value,starts:new Date(form.elements.starts.value).toISOString()}});
          $('#dialog').close();await refreshView();toast('Room event shared.');
        }catch(error){toast(error.message);}finally{send.disabled=false;}
      };
    }catch(error){toast(error.message);}
  };
  document.addEventListener('click',async event=>{
    const control=event.target.closest('[data-event-rsvp],[data-profile-report],[data-profile-block]');if(!control)return;
    const {eventRsvp,profileReport,profileBlock,blocked}=control.dataset;
    try{
      if(eventRsvp){
        const going=control.getAttribute('aria-pressed')!=='true';control.disabled=true;
        const update=await api('/events/'+eventRsvp+'/rsvp','PUT',{going});
        control.setAttribute('aria-pressed',String(update.attending));
        control.textContent=update.attending?'Going · Undo RSVP':'RSVP · Going';
        control.nextElementSibling.textContent=update.attendees+' going';
        const post=postsById.get(eventRsvp);if(post)Object.assign(post,update);
      }else if(profileBlock){
        const on=blocked!=='true';if(on&&!confirm('Block '+profileBlock+' and remove them from your contacts?'))return;
        await api('/block/'+encodeURIComponent(profileBlock),'PUT',{blocked:on});profile(profileBlock);
      }else{
        const why=prompt('Report '+profileReport+' to the site moderators. What happened?','');if(!why?.trim())return;
        const response=await fetch('/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({who:profileReport,why})});
        if(!response.ok)throw Error('Could not submit the report.');toast('Report sent.');
      }
    }catch(error){toast(error.message);}finally{control.disabled=false;}
  });
  like=id=>{const post=postsById.get(id);if(post)api('/posts/'+id+'/like','PUT',{liked:!post.liked}).then(refreshView).catch(error=>toast(error.message));};
  document.addEventListener('submit',async event=>{
    const form=event.target;
    if(!['quick-post','wall-post-composer','post-form','shared-comment-form','friend-wall-form','shared-edit-form'].includes(form.id))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(form.dataset.busy)return;
    form.dataset.busy='true';
    const button=form.querySelector('[type=submit],button.primary,.wall-send');if(button)button.disabled=true;
    try {
      if(form.id==='shared-comment-form')await api('/posts/'+form.dataset.post+'/comments','POST',{id:crypto.randomUUID(),body:form.elements.body.value});
      else if(form.id==='shared-edit-form')await api('/posts/'+form.dataset.post,'PATCH',{body:form.elements.body.value,
        link:form.elements.url.value,removeImage:!!form.elements.removeImage?.checked,...readPostDetails(form)});
      else {
        form.dataset.postId ||= crypto.randomUUID();
        await api('/posts','POST',{id:form.dataset.postId,wall:form.dataset.wall || me,
          body:form.elements.thought?.value || form.querySelector('textarea')?.value || '',
          link:form.elements.attachmentUrl?.value || form.querySelector('#post-link')?.value || '',
          image:await photoData(form.querySelector('input[type=file]')?.files[0]),...readPostDetails(form)});
      }
      form.reset();delete form.dataset.postId;$('#dialog').close();await refreshView();await refreshNotifications();
      if(current==='profile' && window.profileName.toLowerCase()!==me.toLowerCase())profile(window.profileName);
      toast('Saved.');
    } catch(error){toast(error.message);}
    finally{delete form.dataset.busy;if(button)button.disabled=false;}
  },true);
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    const d=button.dataset;
    if(!Object.keys(d).some(key=>['sharedLike','sharedComment','sharedCommentRemove','sharedDelete','sharedEdit','sharedPhoto','sharedAccept','sharedDecline','sharedNotification','liveMessage','liveRequest','liveRemove'].includes(key)) && !d.editPost && !d.deletePost && !d.removePhoto)return;
    event.preventDefault();event.stopImmediatePropagation();
    try {
      if(d.sharedLike){like(d.sharedLike);return;}
      if(d.sharedComment){openComment(d.sharedComment);return;}
      if(d.removePhoto) {
        const post=postsById.get(d.removePhoto);if(!post || !confirm('Remove this photo?'))return;
        if(!post.text && !post.url)await api('/posts/'+post.id,'DELETE',{});
        else await api('/posts/'+post.id,'PATCH',{body:post.text,link:post.url,removeImage:true,feeling:post.feeling,location:post.location});
        $('#dialog').close();
      }
      else if(d.sharedCommentRemove){if(!confirm('Delete this comment?'))return;await api('/comments/'+d.sharedCommentRemove,'DELETE',{});}
      else if(d.sharedDelete || d.deletePost){if(!confirm('Delete this post?'))return;await api('/posts/'+(d.sharedDelete || d.deletePost),'DELETE',{});}
      else if(d.sharedEdit || d.editPost) {
        const post=postsById.get(d.sharedEdit || d.editPost);if(!post)return;
        modal('<h2>Edit post</h2><form id="shared-edit-form" data-post="'+post.id+'"><label>Post<textarea name="body" maxlength="3000">'+esc(post.text)+'</textarea></label><label>Link<input name="url" type="url" value="'+esc(post.url)+'"></label>'+
          (post.image?'<label><input type="checkbox" name="removeImage">Remove photo</label>':'')+'<button class="primary">Save</button></form>');
        mountPostDetails($('#shared-edit-form'),post);return;
      } else if(d.sharedPhoto){const post=postsById.get(d.sharedPhoto);if(post?.image)modal('<h2>Photo</h2><img class="profile-photo-detail" src="'+esc(post.image)+'" alt="Shared photo">');return;}
      else if(d.liveMessage){privateChat(d.liveMessage);return;}
      else if(d.liveRequest){const result=await friendAction(d.liveRequest,'request');toast(result.accepted?'Added to your friends.':'Request sent.');return;}
      else if(d.liveRemove){if(confirm('Remove this friend?'))await friendAction(d.liveRemove,'remove');return;}
      else if(d.sharedAccept){await friendAction(d.sharedAccept,'accept');openNotifications();return;}
      else if(d.sharedDecline){await friendAction(d.sharedDecline,'decline');openNotifications();return;}
      else if(d.sharedNotification){document.querySelector('#notification-dropdown')?.remove();$('#dialog').close();show('feed');await refreshView();document.querySelector('[data-post-id="'+CSS.escape(d.sharedNotification)+'"]')?.scrollIntoView({block:'center'});return;}
      await refreshView();if(current==='profile' && window.profileName.toLowerCase()!==me.toLowerCase())profile(window.profileName);
    } catch(error){toast(error.message);}
  },true);
  $('#dialog').addEventListener('submit',async event=>{
    const form=event.target;if(form.id!=='edit-form' || form.dataset.accountSaved)return;
    event.preventDefault();event.stopImmediatePropagation();
    const f=form.elements,button=form.querySelector('button.primary');if(button.disabled)return;button.disabled=true;
    try {
      const response=await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({displayName:f.displayAlias.value.trim(),age:f.age.value,location:f.location.value.trim(),
          bio:f.bio.value.trim(),interests:f.interests.value.trim(),sex:f.sex.value,profileStatus:f.personalStatus.value.trim()})});
      const result=await response.json();if(!response.ok)throw Error(result.error || 'Profile could not be saved.');
      const name=result.displayName || me,state={name,changedAt:0};
      Object.assign(profileNameState,state);save('profileNameState',state);f.displayAlias.value=name;
      form.dataset.accountSaved='true';button.disabled=false;form.requestSubmit();await settingsQueue;
      remember({name:me,displayName:displayAlias,portrait});await refreshView();
    } catch(error){toast(error.message);}
    finally{button.disabled=false;delete form.dataset.accountSaved;}
  },true);
  if(session.master) {
    const button=document.createElement('button');button.className='text-action';button.textContent='Social administration';
    button.id='social-admin-link';button.onclick=()=>window.openSocialAdmin();$('#account-menu').append(button);
  }
  document.querySelector('.live-social-local-note')?.remove();
  document.querySelectorAll('.home-demo').forEach(node=>node.remove());
  const linkedPost=new URLSearchParams(location.search).get('post'); // from the Messenger bell: /social-next/?post=<id>
  Promise.all([api('/people').then(rows=>{people=rows;rows.forEach(remember);suggestions();}),refreshView(),refreshNotifications()]).then(()=>{if(linkedPost&&/^[0-9a-f-]{8,64}$/i.test(linkedPost)){show('feed');refreshView().then(()=>document.querySelector('[data-post-id="'+CSS.escape(linkedPost)+'"]')?.scrollIntoView({block:'center'}));}}).catch(error=>toast(error.message));
  setInterval(()=>{if(document.visibilityState==='visible'){refreshNotifications();if(!$('#dialog').open && current==='feed')refreshView();}},20000);
  window.addEventListener('focus',()=>{refreshNotifications();if(!$('#dialog').open)refreshView();});
  window.socialApi=api;window.socialRefresh=refreshView;
  const destination=new URLSearchParams(location.search).get('view');
  if(['feed','people','following'].includes(destination))show(destination);
  else if(destination==='profile')profile(me);
  if(new URLSearchParams(location.search).get('admin')==='1')document.addEventListener('DOMContentLoaded',()=>window.openSocialAdmin?.(),{once:true});
})();
