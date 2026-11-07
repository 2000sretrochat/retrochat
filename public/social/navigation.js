/* The room browser uses the same member navigation as Social. */
(()=>{
  const sidebar=document.querySelector('#social-chat-layout>.site-sidebar');if(!sidebar)return;
  const esc=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const styles=document.createElement('style');styles.textContent=`.site-sidebar .menu [aria-current=page]{background:#4d90cd!important;box-shadow:none!important;border-left:0!important}.site-sidebar .identity{display:flex;align-items:center;gap:10px;padding:18px 12px;color:#fff;text-decoration:none}.site-sidebar .identity img{width:38px;height:38px;object-fit:cover;border:1px solid #000;border-radius:8px}.site-sidebar .identity small{display:block;font-size:12px;font-weight:400;color:#b8d4ed}.site-sidebar .post-wall{display:block;background:#4d90cd;color:#fff;padding:12px;margin:8px 0 20px;text-align:center;text-decoration:none;border-radius:5px}`;document.head.appendChild(styles);
  fetch('/social-next/api/navigation',{cache:'no-store'}).then(async response=>{
    if(!response.ok)return;const member=await response.json(),menu=sidebar.querySelector('.menu');
    menu.innerHTML=`<a href="/social-next/">⌂ <span>Social</span></a><a href="/social-next/?view=feed">☷ <span>Your feed</span></a><a href="/social-next/?view=profile">◈ <span>Your space</span></a><a href="/social-next/?view=people">⌕ <span>Find your people</span></a><a href="/social-next/?view=following">♡ <span>Friends</span><small>${Number(member.friends)||0}</small></a><a href="/rooms.html" aria-current="page">▦ <span>Chat</span><span>↗</span></a>`;
    const identity=document.createElement('a');identity.className='identity';identity.href='/social-next/@'+encodeURIComponent(member.name);
    identity.innerHTML=(member.portrait?'<img src="'+esc(member.portrait)+'" alt="">':'')+'<span><strong>'+esc(member.display_name)+'</strong><small>@'+esc(member.name)+'</small></span>';
    const post=document.createElement('a');post.className='post-wall';post.href='/social-next/?view=profile';post.textContent='＋ Post on wall';menu.after(identity,post);
    if(member.master){const admin=document.createElement('a');admin.href='/social-next/?admin=1';admin.textContent='Social administration';document.querySelector('#social-chat-header').appendChild(admin);}
  }).catch(()=>{});
})();
