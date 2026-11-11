// Desktop app mode: real native windows instead of in-page windows (only when running inside the Razzle Messenger desktop app).
(function(){const D=!!(window.YappDesktop&&window.YappDesktop.isDesktop);window.YD=D;if(!D){window.ydPop=()=>null;window.ydFind=()=>null;return}
 const popped=new Set();window.ydFind=id=>{for(const el of popped){if(el.id==id)return el;const f=el.querySelector('#'+CSS.escape(id));if(f)return f}return null};
 document.documentElement.classList.add('yd');
 const markBody=()=>{if(document.body)document.body.classList.add('desktop-app');};
 document.body?markBody():document.addEventListener('DOMContentLoaded',markBody);
 const css=`html.yd,html.yd body{margin:0!important;padding:0!important;height:100%;overflow:hidden;background:var(--card,#fff)!important;font-family:Tahoma,Verdana,Arial,sans-serif}
html.yd #yfoot,html.yd #ad-slot,html.yd #adRoom,html.yd .adph,html.yd #pwaInstall{display:none!important}
/* Hide Social website chrome — desktop is one native app window, not a page-in-a-page */
html.yd .auth-site-header,html.yd .auth-site-sidebar,html.yd .auth-chat-art,
html.yd #social-chat-header,html.yd .social-chat-header,html.yd .site-sidebar,
html.yd #brand,html.yd #room-popout-status{display:none!important}
html.yd .social-chat-layout,html.yd .auth-site-layout{display:block!important;padding:0!important;margin:0!important;min-height:0!important;gap:0!important;background:transparent!important;grid-template-columns:none!important}
html.yd .social-chat-main,html.yd .auth-site-main{padding:0!important;margin:0!important;min-width:0!important;min-height:0!important}
/* Main surfaces fill the native Electron frame (#mwin is nested under <main>, so no body> child combinator) */
html.yd #mwin,html.yd #chat{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important;inset:0!important;z-index:5}
/* Strip fake inner title bars / min-max-x — OS title + #menu only */
/* Messenger only: hide fake window chrome (min/max/×). */
html.yd #mwin>.tbar{display:none!important}
/* Desktop room: hide blue #chat>.tbar (duplicates native OS title). Menus + full rich rhead/chat stay. Leave via Room menu. */
html.yd #chat{display:flex!important;flex-direction:column!important;overflow:hidden!important}
html.yd #chat>.tbar{display:none!important}
/* Grow middle: messages + People. Never collapse under messenger signed-out rules. */
html.yd #chat #main{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow:hidden!important}
html.yd #chat #lpane{flex:1 1 auto!important;min-height:0!important;min-width:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
html.yd #chat #log{flex:1 1 auto!important;height:auto!important;min-height:80px!important;overflow:auto!important}
html.yd #chat #mpane{flex:none!important;width:220px!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important}
html.yd #chat #mem{flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow:auto!important}
html.yd #chat #vrow,html.yd #chat #form,html.yd #chat #erow,html.yd #chat #menu,html.yd #chat #rhead,html.yd #chat #sty,html.yd #chat #hq,html.yd #chat #camstrip{flex:none!important}
html.yd #pwaInstall,html.yd .pwa-install{display:none!important}
/* In real popups (IM/Browse/dialogs) keep one native OS title; hide duplicate web tbar; neutral X */
html.yd .wb.x,html.yd .tbar .wb.x,html.yd .tbar .x,html.yd .wctl.x,html.yd.ydpop .wb.x,html.yd.ydpop .tbar .x{background:var(--card,#fff)!important;border-color:#aab4c2!important;color:#424950!important}
html.yd .tbar .wb.x:hover,html.yd .tbar .x:hover,html.yd .wctl.x:hover,html.yd.ydpop .tbar .wb.x:hover,html.yd.ydpop .tbar .x:hover{background:var(--bg,#eef5fc)!important;color:#424950!important}
html.yd.ydpop .im,html.yd.ydpop #brw,html.yd.ydpop .yae,html.yd.ydpop .yprof,html.yd.ydpop .yset{position:fixed!important;display:flex!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
html.yd.ydpop .im>.tbar,html.yd.ydpop #brw>.tbar,html.yd.ydpop .yae>.tbar,html.yd.ydpop .yprof>.tbar,html.yd.ydpop .yset>.tbar,html.yd.ydpop .yae>.hd,html.yd.ydpop .yprof>.hd{display:none!important}html.yd.ydpop .im .log{flex:1;height:auto!important}
.ydlogo{display:none!important}html.yd #menu{display:flex;align-items:center;justify-content:flex-start;padding-left:4px!important;min-height:28px}

/* ===== Signed-out: compact centered classic Messenger form (no buddy chrome) ===== */
/* Messenger signed-out gate ONLY (#mwin). Do NOT target rooms.html #main (log+People). */
html.yd:not(.yd-in) #mwin #main,
html.yd:not(.yd-in) #mwin #me,
html.yd:not(.yd-in) #mwin #search,
html.yd:not(.yd-in) #mwin #list,
html.yd:not(.yd-in) #mwin #reqs,
html.yd:not(.yd-in) #mwin #bottom,
html.yd:not(.yd-in) #mwin #bAdd,
html.yd:not(.yd-in) #mwin #bRooms,
html.yd:not(.yd-in) #mwin #foot,
html.yd:not(.yd-in) #mwin #tabs,
html.yd:not(.yd-in) #mwin #avpick,
html.yd:not(.yd-in) #mwin .yonline{display:none!important}
html.yd body>#foot{display:none!important}
html.yd #signin{padding:18px 28px 20px!important;gap:6px!important;justify-content:center!important;align-items:center!important;overflow:hidden!important;min-height:0;background:#fff!important}
html.yd #signin .auth-heading{display:flex;flex-direction:column;align-items:center;gap:4px;margin:0 0 6px}
html.yd #signin .lgbig img{width:56px!important;height:56px!important}
html.yd #signin .logo{font:700 22px Tahoma,Verdana,Arial!important;letter-spacing:-.3px!important;line-height:1.05!important;margin:0!important}
html.yd #signin .messenger-signin-copy{display:none!important}
html.yd #signin label{font:700 12px Tahoma,Verdana,Arial!important;margin:0!important;line-height:1.25;align-self:stretch;color:#003876!important}
html.yd #signin input:not([type=checkbox]){padding:7px 9px!important;min-height:32px!important;border-radius:6px!important;font:13px Tahoma,Verdana,Arial!important;align-self:stretch}
html.yd #signin .row{margin:0!important;align-self:stretch}
html.yd #fUp{gap:5px!important;align-self:stretch!important}
html.yd #signin .pri{width:100%;min-height:34px!important;padding:7px 10px!important;margin-top:4px;border-radius:6px!important;font:700 13px Tahoma,Verdana,Arial!important;background:#004990!important;border:1px solid #004990!important;color:#fff!important}
html.yd #signin .err{min-height:14px;font-size:11px;margin:0;align-self:stretch}
html.yd #signin .auth-back{margin-top:4px!important;font-size:12px;align-self:stretch}
html.yd #signin .privacy{font-size:10px!important;margin-top:4px!important;line-height:1.25}
html.yd #signin label,html.yd #signin input:not([type=checkbox]),html.yd #signin .row,html.yd #signin .pri,html.yd #signin .err,html.yd #signin #fUp,html.yd #signin > div:not(.auth-heading):not(.messenger-signin-copy):not(#maint){width:100%;max-width:320px;align-self:center}
html.yd #signin #fUp{align-self:center!important}
html.yd #chat-signin-footer{display:flex!important;justify-content:center;gap:12px;margin-top:10px;font:11px Tahoma,Verdana,Arial;color:#5b6b85;align-self:stretch}
html.yd #chat-signin-footer[hidden]{display:flex!important}
html.yd #chat-signin-footer a{color:#5b6b85;font-weight:500;text-decoration:underline}
html.yd #chat-signin-footer a:not(#chat-guest-entry){display:none}

/* ===== Classic Messenger buddy list (signed-in desktop only) ===== */
html.yd.yd-in #signin{display:none!important}
html.yd.yd-in #mwin #main{display:flex!important;flex-direction:column;flex:1;min-height:0;background:#f7fafc!important}
html.yd.yd-in #me{display:flex!important;flex-direction:row!important;align-items:flex-start!important;gap:12px!important;padding:14px 14px 10px!important;background:#fff!important;border-bottom:1px solid #d7e4f3!important}
html.yd.yd-in #myav,html.yd.yd-in #me .av{width:56px!important;height:56px!important;border-radius:12px!important;border:1px solid #c9daf0!important;box-shadow:none!important;overflow:hidden;background:#fff}
html.yd.yd-in #me .nm{font:700 18px Tahoma,Verdana,Arial!important;color:#003876!important;letter-spacing:-.2px}
html.yd.yd-in #me .stw{display:flex;align-items:center;gap:6px;margin:4px 0 6px!important}
html.yd.yd-in #me .sdot{width:10px;height:10px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.2)}
html.yd.yd-in #stsel{all:unset;font:13px Tahoma,Verdana,Arial;color:#003876;cursor:pointer;padding-right:14px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6b85' stroke-width='2.4'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right center/11px no-repeat}
html.yd.yd-in #me .mind{border:0!important;background:transparent!important;padding:0!important;color:#8aa0b8}
html.yd.yd-in #me .mind input{padding:0!important;font:13px Tahoma,Verdana,Arial!important;color:#8aa0b8!important}
html.yd.yd-in #me .mind input::placeholder{color:#a7b7c9}
html.yd.yd-in #me .mind i{display:none!important}
html.yd.yd-in #search{margin:8px 14px 6px!important;display:block!important}
html.yd.yd-in #search .srch{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #c9daf0;border-radius:999px;padding:8px 12px}
html.yd.yd-in #search .srch i{opacity:.55;flex:none}
html.yd.yd-in #q{all:unset;flex:1;min-width:0;font:13px Tahoma,Verdana,Arial;color:#12213F}
html.yd.yd-in #q::placeholder{color:#9aafc4}
html.yd.yd-in #tabs{display:none!important}
html.yd.yd-in #list{display:block!important;flex:1;min-height:0;overflow:auto;margin:0!important;border:0!important;background:transparent!important;border-top:1px solid #e4eef7!important}
html.yd.yd-in #tree .grp,html.yd.yd-in #list .grp{text-transform:none!important;letter-spacing:0!important;font:700 14px Tahoma,Verdana,Arial!important;color:#003876!important;padding:12px 16px 6px!important;background:transparent!important;border:0!important;display:flex;align-items:center;gap:6px}
html.yd.yd-in #tree .grp:before,html.yd.yd-in #list .grp:before{content:""!important;width:12px;height:12px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23003876' stroke-width='2.6'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") center/12px no-repeat;transition:transform .15s}
html.yd.yd-in #tree .grp.closed:before,html.yd.yd-in #list .grp.closed:before{transform:rotate(-90deg)}
html.yd.yd-in #list .ct{padding:8px 14px 8px 16px!important;border-radius:0!important;margin:0!important;gap:12px!important;align-items:center}
html.yd.yd-in #list .ct:hover{background:#eef5fc!important}
html.yd.yd-in #list .ct.sel{background:#e2eef9!important}
html.yd.yd-in #list .ct .av.sm{width:40px!important;height:40px!important;border-radius:10px!important;box-shadow:none!important}
html.yd.yd-in #list .ct .avw{position:relative;flex:none}
html.yd.yd-in #list .ct .avw .sdot{position:absolute;right:-2px;bottom:-2px;width:11px;height:11px;border:2px solid #f7fafc;border-radius:50%}
html.yd.yd-in #list .ct .n{font:650 14px Tahoma,Verdana,Arial;color:#003876}
html.yd.yd-in #list .ct.off .n{color:#7a8ea5;font-weight:600}
html.yd.yd-in #list .ct .sm{font-size:12px!important;color:#7f94ac!important}
html.yd .sdot.available{background:#2db52d}html.yd .sdot.away,html.yd .sdot.brb,html.yd .sdot.idle{background:#e0a800}
html.yd .sdot.busy{background:#d9251c}html.yd .sdot.offline,html.yd .sdot.invisible{background:#b0b8c4}
html.yd.yd-in #reqs{display:block!important;padding:8px 12px 0}
html.yd.yd-in #reqs .rq{background:#fff8ec!important;border:1px solid #f3d7a5!important;border-radius:10px!important;margin:0 0 8px!important;padding:10px 12px!important;font-size:12px;color:#003876;box-shadow:0 2px 8px #00387612}
html.yd.yd-in #reqs .rq b{color:#004990}
html.yd.yd-in #reqs .rq > div{display:flex;gap:8px;margin-top:8px!important}
html.yd.yd-in #reqs .rq button{flex:1;min-height:30px;border-radius:8px;font:650 12px Tahoma,Verdana,Arial;cursor:pointer}
html.yd.yd-in #reqs .rq button.pri,html.yd.yd-in #reqs .rq button[data-y="1"]{background:#004990!important;border:1px solid #004990!important;color:#fff!important}
html.yd.yd-in #reqs .rq button:not(.pri):not([data-y="1"]){background:#fff!important;border:1px solid #c9daf0!important;color:#003876!important}
html.yd .yonline{display:none!important}
html.yd.yd-in #bottom{display:flex!important;flex-wrap:nowrap!important;gap:10px!important;padding:12px 14px!important;border-top:1px solid #d7e4f3!important;background:#fff!important}
html.yd.yd-in #bottom .btn,html.yd.yd-in #bAdd,html.yd.yd-in #bRooms{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-radius:10px!important;font:650 13px Tahoma,Verdana,Arial!important;padding:0 10px!important}
html.yd.yd-in #bAdd{background:#fff!important;border:1px solid #b5d1eb!important;color:#003876!important;box-shadow:none!important}
html.yd.yd-in #bRooms,html.yd.yd-in #bottom .btn.pri{background:#004990!important;border:1px solid #004990!important;color:#fff!important}
html.yd.yd-in #foot{display:flex!important;align-items:center;justify-content:center;gap:6px;padding:8px 0 10px!important;font-size:13px!important;border-top:1px solid #e4eef7;background:#fff;color:#003876}
html.yd.yd-in #foot .brandname .a{color:#004990}html.yd.yd-in #foot .brandname .b{color:#003876}
html.yd #pmBadge{top:8px!important;right:12px!important}
`;
 // Desktop menu: no in-bar logo/name (OS title already shows Razzle Messenger); items stay left-aligned.
 const st=document.createElement('style');st.id='ydcss';st.textContent=css;document.head.appendChild(st);

 // Auth gate: buddy/status/search/contact/rooms/footer only while signed in.
 const syncAuth=()=>{
  const si=document.getElementById('signin');
  const signedIn=!!(si && si.style.display==='none');
  document.documentElement.classList.toggle('yd-in', signedIn);
 };
 const watchAuth=()=>{
  syncAuth();
  const si=document.getElementById('signin');
  const main=document.getElementById('main');
  const obs=new MutationObserver(syncAuth);
  if(si) obs.observe(si,{attributes:true,attributeFilter:['style','class','hidden']});
  if(main) obs.observe(main,{attributes:true,attributeFilter:['style','class','hidden']});
 };
 // Compact signed-out branding: one logo/wordmark, small guest link, no duplicate titles.
 const polishSignin=()=>{
  const root=document.getElementById('signin'); if(!root)return;
  root.querySelectorAll('.lgbig img').forEach(img=>{img.setAttribute('width','56');img.setAttribute('height','56');});
  root.querySelectorAll('.messenger-signin-copy').forEach(el=>{el.style.display='none';});
  const guest=document.getElementById('chat-signin-footer');
  if(guest){
   guest.hidden=false;
   const g=document.getElementById('chat-guest-entry');
   if(g){
    g.textContent='Continue as guest';
    g.onclick=ev=>{if(window.YD){ev.preventDefault();window.open('/rooms.html','yapprooms')}};
   }
  }
  // Forgot password → /reset.html (Master Console / moderator path when email reset is off)
  root.querySelectorAll('a[href*="reset"]').forEach(a=>{
   const href=a.getAttribute('href')||'';
   if(/^\/reset(\.html)?(\?.*)?$/i.test(href.split('#')[0]) || href==='/reset' || href.startsWith('/reset?')){
    const q=href.includes('?')?href.slice(href.indexOf('?')):'';
    a.setAttribute('href','/reset.html'+q);
   }
  });
  syncAuth();
 };
 const schedule=()=>{watchAuth();setTimeout(polishSignin,0)};
 document.readyState=='loading'?document.addEventListener('DOMContentLoaded',schedule):schedule();
 addEventListener('load',polishSignin);

 // Move an element into its own native window. It keeps running in this page (same socket, same session).
 window.ydPop=function(el,name,w,h,title,onClose){let pw=null;try{pw=window.open('about:blank',name,'width='+w+',height='+h)}catch(e){}if(!pw)return null;
  const d=pw.document;d.open();d.write('<!doctype html><html class="yd ydpop"><head><meta charset=utf-8><base href="'+location.origin+'/"><title></title></head><body></body></html>');d.close();
  document.querySelectorAll('link[rel=stylesheet],style').forEach(n=>d.head.appendChild(n.cloneNode(true)));
  d.documentElement.className=document.documentElement.className+' ydpop';d.body.className=document.body.className;d.title=title||'Razzle';
  d.body.appendChild(el);if(el.matches('.razzle-settings-dialog,.contact-directory,.contact-profile,.im'))try{pw.resizeTo(w,h)}catch{}popped.add(el);el._pw=pw;let done=false;const fin=()=>{if(done)return;done=true;el._pw=null;popped.delete(el);onClose&&onClose()};
  pw.addEventListener('pagehide',fin);pw.addEventListener('beforeunload',fin);return pw};
})();
// v13.6: in-window dialogs (avatar, settings, profile) open as their own native windows in the desktop app.
(function(){if(!window.YD)return;let n=0;
 const sz=el=>el.matches('.contact-profile')?[520,el.querySelector('.profile-photos')?535:390]:el.matches('.device-settings,.contact-directory')?[560,520]:el.classList.contains('razzle-settings-dialog')?[500,440]:el.classList.contains('yae')?[520,680]:el.classList.contains('yset')?[520,640]:[420,600];
 const pop=el=>{if(el._pw||el._ydp)return;el._ydp=1;const [w,h]=sz(el);const t=(el.querySelector('.hd span,.hd,.tbar,h2,h3')||{}).textContent||'Razzle';
  let closing=false;
  const pw=window.ydPop(el,'ydlg'+(++n),w,h,t.trim().replace(/[×x]$/,'').trim()||'Razzle',()=>{closing=true;if(el.isConnected)el.remove()});
  if(!pw)return;// popup blocked: stays in-window
  new MutationObserver((_,o)=>{if(el.parentNode!==pw.document.body){o.disconnect();if(!closing)try{pw.close()}catch(e){}}}).observe(pw.document.body,{childList:true})};
 const start=()=>new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(x=>{if(x.nodeType==1&&x.parentNode==document.body&&(x.classList.contains('yae')||x.classList.contains('yprof')))setTimeout(()=>x.parentNode==document.body&&pop(x))}))).observe(document.body,{childList:true});
 document.body?start():document.addEventListener('DOMContentLoaded',start)})();
