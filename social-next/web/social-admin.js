(() => {
  if(!window.socialSession.master)return;
  const e=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data={users:[],posts:[],comments:[]};
  let accountDetails;
  const when=value=>value?new Date(value).toLocaleString():'No recorded sign-in';
  function button(action,label,attributes='') {
    return '<button type="button" class="text-action" data-social-admin="'+action+'" '+attributes+'>'+label+'</button>';
  }
  function render() {
    const body=$('#dialog-body');
    body.innerHTML='<h2>Social administration</h2><p>Posting locations are approximate. Actions are recorded in the master audit log.</p>'+
      '<p><a href="/master" target="_blank" rel="noopener">Open master account console</a></p>'+
      '<details id="admin-bot-chat"><summary>Type as a bot</summary><p>Send a chat-room message using a bot screen name. Your admin account is recorded in the audit log.</p>'+
      '<form id="admin-bot-chat-form" hidden><label>Bot<select name="botId" required></select></label> '+
      '<label>Room<select name="room" required></select></label> <label>Message<input name="message" maxlength="300" required></label> '+
      '<button class="primary">Send to room</button></form><p data-bot-chat-status role="status"></p></details>'+
      '<label>Find an account<input id="social-admin-search" type="search" placeholder="Screen name"></label><div id="social-admin-users"></div>'+
      '<details><summary>Recent posts</summary>'+data.posts.map(post=>'<section class="admin-content"><strong>'+e(post.name)+'</strong><p>'+e(post.body)+'</p><small>'+
        e(post.ip)+' · '+e(post.approximate_location || 'Location unavailable')+'</small><div>'+button(post.removed?'restore-post':'remove-post',post.removed?'Restore post':'Remove post','data-id="'+post.id+'"')+
        (post.has_image?button('remove-image','Remove photo','data-id="'+post.id+'"'):'')+'</div></section>').join('')+'</details>'+
      '<details><summary>Recent comments</summary>'+data.comments.map(comment=>'<section class="admin-content"><strong>'+e(comment.name)+'</strong><p>'+e(comment.body)+'</p><small>'+e(comment.ip)+' · '+
        e(comment.approximate_location || 'Location unavailable')+'</small><div>'+button(comment.removed?'restore-comment':'remove-comment',comment.removed?'Restore comment':'Remove comment','data-id="'+comment.id+'"')+'</div></section>').join('')+'</details>';
    const botChat=$('#admin-bot-chat'), form=$('#admin-bot-chat-form'), status=botChat.querySelector('[data-bot-chat-status]');
    botChat.addEventListener('toggle',async()=>{
      if(!botChat.open || !form.hidden || status.textContent==='Loading bots…')return;
      status.textContent='Loading bots…';
      try {
        const {bots,rooms}=await window.socialApi('/admin/bot-chat');
        form.elements.botId.replaceChildren(new Option('Choose a bot',''),...bots.map(bot=>new Option(bot.name,bot.id)));
        form.elements.room.replaceChildren(new Option('Choose a room',''),...rooms.map(room=>new Option(room,room)));
        form.hidden=false;
        status.textContent='';
      } catch(error){status.textContent=error.message;}
    });
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const {botId,room,message}=form.elements, send=form.querySelector('button');
      const payload={botId:botId.value,room:room.value,message:message.value}, name=botId.selectedOptions[0].text;
      send.disabled=true;
      try {
        await window.socialApi('/admin/bot-chat','POST',payload);
        status.textContent='Message sent to '+payload.room+' as '+name+'.';
        message.value='';message.focus();
      } catch(error){status.textContent=error.message;}
      finally{send.disabled=false;}
    });
    const showUsers=query=>{
      $('#social-admin-users').innerHTML=data.users.filter(user=>(user.name+' '+user.display_name).toLowerCase().includes(query.toLowerCase())).map(user=>{
        const attr='data-user-id="'+user.id+'"';
        const restrictions=new Set(user.restrictions.map(item=>item.service));
        return '<section class="admin-account"><strong>'+e(user.display_name || user.name)+'</strong> <small>@'+e(user.name)+'</small>'+
          (user.bot?' <small class="bot-profile-badge">Bot</small>':'')+
          '<details data-account-details="'+user.id+'"><summary>Account details and recent sign-ins</summary><div></div></details>'+
          '<p>'+e(user.last_ip)+' · '+e(user.last_loc || 'Location unavailable')+'</p>'+
          (user.is_master?'<p>Master account. Manage through the master console.</p>':
          '<div>'+['social','messenger'].map(service=>button(restrictions.has(service)?'unrestrict':'restrict',
            (restrictions.has(service)?'Unban ':'Ban ')+(service==='social'?'Social':'Messenger'),attr+' data-service="'+service+'"')).join('')+
            button('clear-portrait','Remove profile image',attr)+button(user.deactivated?'reactivate':'deactivate',user.deactivated?'Reactivate account':'Deactivate account',attr)+'</div>')+'</section>';
      }).join('');
      document.querySelectorAll('[data-account-details]').forEach(details=>details.addEventListener('toggle',async()=>{
        if(!details.open)return;
        const content=details.lastElementChild;
        content.textContent='Loading account details…';
        try {
          accountDetails ||= fetch('/api/master/data',{cache:'no-store'}).then(async response=>{
            if(!response.ok)throw Error('Account details are unavailable.');
            const result=await response.json();
            return new Map(result.accounts.map(account=>[String(account.id),account]));
          });
          const account=(await accountDetails).get(details.dataset.accountDetails);
          if(!account){content.textContent='No account details recorded.';return;}
          content.innerHTML='<p>Email: '+e(account.email || 'None recorded')+'<br>Created: '+e(when(account.created))+
            '<br>Last sign-in: '+e(when(account.last_at))+'</p><strong>Recent sign-ins</strong>'+
            ((account.hist||[]).map(item=>'<p>'+e(when(item.at))+' · '+e(item.kind)+'</p>').join('')||'<p>No recorded sign-ins.</p>');
        } catch(error){accountDetails=null;content.textContent=error.message;}
      }));
    };
    showUsers('');$('#social-admin-search').oninput=event=>showUsers(event.target.value);
  }
  window.openSocialAdmin=async()=>{
    accountDetails=null;
    try {data=await window.socialApi('/admin');modal('<p>Loading administration…</p>');render();}
    catch(error){toast(error.message);}
  };
  $('#dialog').addEventListener('click',async event=>{
    const control=event.target.closest('[data-social-admin]');if(!control)return;
    const action=control.dataset.socialAdmin;
    if(!confirm(control.textContent+'?'))return;
    const reason=action==='restrict'?prompt('Reason for this restriction (optional)',''):'';
    if(reason===null)return;
    control.disabled=true;
    try {
      await window.socialApi('/admin','POST',{action,userId:Number(control.dataset.userId),id:control.dataset.id,service:control.dataset.service,reason});
      data=await window.socialApi('/admin');render();await window.socialRefresh();toast('Administration change saved.');
    } catch(error){toast(error.message);}
    finally{control.disabled=false;}
  });
})();
