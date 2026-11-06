// Desktop app mode: real native windows instead of in-page windows (only when running inside the Razzle Messenger desktop app).
(function(){const D=!!(window.YappDesktop&&window.YappDesktop.isDesktop);window.YD=D;if(!D){window.ydPop=()=>null;window.ydFind=()=>null;return}
 const popped=new Set();window.ydFind=id=>{for(const el of popped){if(el.id==id)return el;const f=el.querySelector('#'+CSS.escape(id));if(f)return f}return null};
 document.documentElement.classList.add('yd');
 const markBody=()=>{if(document.body)document.body.classList.add('desktop-app');};
 document.body?markBody():document.addEventListener('DOMContentLoaded',markBody);
 const css=`html.yd,html.yd body{margin:0!important;padding:0!important;height:100%;overflow:hidden;background:var(--card,#fff)!important}
 html.yd #yfoot,html.yd #ad-slot{display:none!important}
 html.yd body>.win:not(.im):not(#brw),html.yd body>#mwin{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important}
 html.yd body>.win>.tbar,html.yd body>#mwin>.tbar{display:none!important}
 /* Desktop close (X): deep ink, not Windows red — leaves .err/#c00 validation alone */
 html.yd .wb.x,html.yd .tbar .wb.x,html.yd .tbar .x,html.yd .wctl.x,html.yd.ydpop .wb.x,html.yd.ydpop .tbar .x{background:#003876!important;border-color:#003876!important;color:#fff!important}
 html.yd .tbar .wb.x:hover,html.yd .tbar .x:hover,html.yd .wctl.x:hover,html.yd.ydpop .tbar .wb.x:hover,html.yd.ydpop .tbar .x:hover{background:#002a5c!important;color:#fff!important}
 html.yd.ydpop .im,html.yd.ydpop #brw{position:fixed!important;display:flex!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
 html.yd.ydpop .im>.tbar,html.yd.ydpop #brw>.tbar{display:none!important}html.yd.ydpop .im .log{flex:1;height:auto!important}
 .ydlogo{display:inline-flex;align-items:center;gap:5px;font:700 12px system-ui,Segoe UI,Arial;color:#00205B;padding:0 10px 0 6px;align-self:center;white-space:nowrap}html.yd #menu{display:flex;align-items:center;justify-content:flex-start;padding-left:4px!important}
  html.yd #signin{padding:10px 16px 12px!important;gap:4px!important;justify-content:flex-start!important;overflow:auto;min-height:0}
  html.yd #signin .auth-heading{display:flex;flex-direction:column;align-items:center;gap:2px;margin:2px 0 0}
  html.yd #signin .lgbig img{width:48px!important;height:48px!important}
  html.yd #signin .logo{font-size:22px!important;letter-spacing:-.4px!important;line-height:1.05!important;margin:0!important}
  html.yd #signin .messenger-signin-copy{margin:0 0 4px!important;font-size:12px;color:var(--muted,#5b6b85)}
  html.yd #signin label{font-size:12px!important;margin:0!important;line-height:1.2}
  html.yd #signin input:not([type=checkbox]){padding:6px 8px!important;min-height:30px!important;border-radius:8px!important}
  html.yd #signin .row{margin:0!important}
  html.yd #fUp{gap:4px!important}
  html.yd #signin .pri{width:100%;min-height:32px!important;padding:6px 10px!important;margin-top:2px}
  html.yd #signin .err{min-height:12px;font-size:11px;margin:0}
  html.yd #signin .auth-back{margin-top:2px!important;font-size:12px}
  html.yd #signin .privacy{font-size:10px!important;margin-top:4px!important;line-height:1.25}
  html.yd #signin > .messenger-signin-copy:last-of-type,
  html.yd #signin .messenger-signin-copy[style*="margin-top:auto"]{margin-top:8px!important}
  html.yd #menu{min-height:28px}

 /* ===== Classic Messenger buddy list (desktop only) — homepage blue #004990 / left #003876 ===== */
 html.yd #main{display:flex;flex-direction:column;flex:1;min-height:0;background:#f7fafc!important}
 html.yd #me{display:flex!important;flex-direction:row!important;align-items:flex-start!important;gap:12px!important;padding:14px 14px 10px!important;background:#fff!important;border-bottom:1px solid #d7e4f3!important}
 html.yd #myav,html.yd #me .av{width:56px!important;height:56px!important;border-radius:12px!important;border:1px solid #c9daf0!important;box-shadow:none!important;overflow:hidden;background:#fff}
 html.yd #me .nm{font:700 18px system-ui,Segoe UI,Arial!important;color:#003876!important;letter-spacing:-.2px}
 html.yd #me .stw{display:flex;align-items:center;gap:6px;margin:4px 0 6px!important}
 html.yd #me .sdot{width:10px;height:10px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.2)}
 html.yd #stsel{all:unset;font:13px system-ui,Segoe UI,Arial;color:#003876;cursor:pointer;padding-right:14px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6b85' stroke-width='2.4'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") right center/11px no-repeat}
 html.yd #me .mind{border:0!important;background:transparent!important;padding:0!important;color:#8aa0b8}
 html.yd #me .mind input{padding:0!important;font:13px system-ui,Segoe UI,Arial!important;color:#8aa0b8!important}
 html.yd #me .mind input::placeholder{color:#a7b7c9}
 html.yd #me .mind i{display:none!important}
 html.yd #search{margin:8px 14px 6px!important;display:block!important}
 html.yd #search .srch{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #c9daf0;border-radius:999px;padding:8px 12px}
 html.yd #search .srch i{opacity:.55;flex:none}
 html.yd #q{all:unset;flex:1;min-width:0;font:13px system-ui,Segoe UI,Arial;color:#12213F}
 html.yd #q::placeholder{color:#9aafc4}
 html.yd #tabs{display:none!important}
 html.yd #list{flex:1;min-height:0;overflow:auto;margin:0!important;border:0!important;background:transparent!important;border-top:1px solid #e4eef7!important}
 html.yd #tree .grp,html.yd #list .grp{text-transform:none!important;letter-spacing:0!important;font:700 14px system-ui,Segoe UI,Arial!important;color:#003876!important;padding:12px 16px 6px!important;background:transparent!important;border:0!important;display:flex;align-items:center;gap:6px}
 html.yd #tree .grp:before,html.yd #list .grp:before{content:""!important;width:12px;height:12px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23003876' stroke-width='2.6'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") center/12px no-repeat;transition:transform .15s}
 html.yd #tree .grp.closed:before,html.yd #list .grp.closed:before{transform:rotate(-90deg)}
 html.yd #list .ct{padding:8px 14px 8px 16px!important;border-radius:0!important;margin:0!important;gap:12px!important;align-items:center}
 html.yd #list .ct:hover{background:#eef5fc!important}
 html.yd #list .ct.sel{background:#e2eef9!important}
 html.yd #list .ct .av.sm{width:40px!important;height:40px!important;border-radius:10px!important;box-shadow:none!important}
 html.yd #list .ct .avw{position:relative;flex:none}
 html.yd #list .ct .avw .sdot{position:absolute;right:-2px;bottom:-2px;width:11px;height:11px;border:2px solid #f7fafc;border-radius:50%}
 html.yd #list .ct .n{font:650 14px system-ui,Segoe UI,Arial;color:#003876}
 html.yd #list .ct.off .n{color:#7a8ea5;font-weight:600}
 html.yd #list .ct .sm{font-size:12px!important;color:#7f94ac!important}
 html.yd .sdot.available{background:#2db52d}html.yd .sdot.away,html.yd .sdot.brb,html.yd .sdot.idle{background:#e0a800}
 html.yd .sdot.busy{background:#d9251c}html.yd .sdot.offline,html.yd .sdot.invisible{background:#b0b8c4}
 html.yd #reqs{padding:8px 12px 0}
 html.yd #reqs .rq{background:#fff8ec!important;border:1px solid #f3d7a5!important;border-radius:10px!important;margin:0 0 8px!important;padding:10px 12px!important;font-size:12px;color:#003876;box-shadow:0 2px 8px #00387612}
 html.yd #reqs .rq b{color:#004990}
 html.yd #reqs .rq > div{display:flex;gap:8px;margin-top:8px!important}
 html.yd #reqs .rq button{flex:1;min-height:30px;border-radius:8px;font:650 12px system-ui,Segoe UI,Arial;cursor:pointer}
 html.yd #reqs .rq button.pri,html.yd #reqs .rq button[data-y="1"]{background:#004990!important;border:1px solid #004990!important;color:#fff!important}
 html.yd #reqs .rq button:not(.pri):not([data-y="1"]){background:#fff!important;border:1px solid #c9daf0!important;color:#003876!important}
 html.yd .yonline{display:none!important}
 html.yd #bottom{display:flex!important;flex-wrap:nowrap!important;gap:10px!important;padding:12px 14px!important;border-top:1px solid #d7e4f3!important;background:#fff!important}
 html.yd #bottom .btn,html.yd #bAdd,html.yd #bRooms{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:38px;border-radius:10px!important;font:650 13px system-ui,Segoe UI,Arial!important;padding:0 10px!important}
 html.yd #bAdd{background:#fff!important;border:1px solid #b5d1eb!important;color:#003876!important;box-shadow:none!important}
 html.yd #bRooms,html.yd #bottom .btn.pri{background:#004990!important;border:1px solid #004990!important;color:#fff!important}
 html.yd #foot{display:flex!important;align-items:center;justify-content:center;gap:6px;padding:8px 0 10px!important;font-size:13px!important;border-top:1px solid #e4eef7;background:#fff;color:#003876}
 html.yd #foot .brandname .a{color:#004990}html.yd #foot .brandname .b{color:#003876}
 html.yd #pmBadge{top:8px!important;right:12px!important}
 `;
 // Desktop menu: no in-bar logo/name (OS title already shows Razzle Messenger); items stay left-aligned.
 const st=document.createElement('style');st.id='ydcss';st.textContent=css;document.head.appendChild(st);
 // Compact signup branding once the messenger paints its logo/title.
 const polishSignin=()=>{
  const root=document.getElementById('signin'); if(!root)return;
  root.querySelectorAll('.lgbig img').forEach(img=>{img.setAttribute('width','48');img.setAttribute('height','48');});
  const copies=[...root.querySelectorAll('.messenger-signin-copy')];
  if(copies[0] && /^Messenger$/i.test(copies[0].textContent.trim())) copies[0].textContent='Razzle Messenger';
 };
 const schedule=()=>setTimeout(polishSignin,0);
 document.readyState=='loading'?document.addEventListener('DOMContentLoaded',schedule):schedule();
 addEventListener('load',polishSignin);

 // Move an element into its own native window. It keeps running in this page (same socket, same session).
 window.ydPop=function(el,name,w,h,title,onClose){let pw=null;try{pw=window.open('about:blank',name,'width='+w+',height='+h)}catch(e){}if(!pw)return null;
  const d=pw.document;d.open();d.write('<!doctype html><html class="yd ydpop"><head><meta charset=utf-8><base href="'+location.origin+'/"><title></title></head><body></body></html>');d.close();
  document.querySelectorAll('link[rel=stylesheet],style').forEach(n=>d.head.appendChild(n.cloneNode(true)));
  d.documentElement.className=document.documentElement.className+' ydpop';d.body.className=document.body.className;d.title=title||'Razzle';
  d.body.appendChild(el);popped.add(el);el._pw=pw;let done=false;const fin=()=>{if(done)return;done=true;el._pw=null;popped.delete(el);onClose&&onClose()};
  pw.addEventListener('pagehide',fin);pw.addEventListener('beforeunload',fin);return pw};
})();
// v13.6: in-window dialogs (avatar, settings, profile) open as their own native windows in the desktop app.
(function(){if(!window.YD)return;let n=0;
 const sz=el=>el.classList.contains('yae')?[520,680]:el.classList.contains('yset')?[520,640]:[420,600];
 const pop=el=>{if(el._pw||el._ydp)return;el._ydp=1;const [w,h]=sz(el);const t=(el.querySelector('.hd span,.hd,.tbar,h2,h3')||{}).textContent||'Razzle';
  const parent=document.body;let closing=false;
  const pw=window.ydPop(el,'ydlg'+(++n),w,h,t.trim().replace(/\u00d7$/,'').trim()||'Razzle',()=>{closing=true;if(el.isConnected)el.remove()});
  if(!pw)return;// popup blocked: stays in-window
  new MutationObserver((_,o)=>{if(el.parentNode!==pw.document.body){o.disconnect();if(!closing)try{pw.close()}catch(e){}}}).observe(pw.document.body,{childList:true})};
 const start=()=>new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(x=>{if(x.nodeType==1&&x.parentNode==document.body&&(x.classList.contains('yae')||x.classList.contains('yprof')))setTimeout(()=>x.parentNode==document.body&&pop(x))}))).observe(document.body,{childList:true});
 document.body?start():document.addEventListener('DOMContentLoaded',start)})();
