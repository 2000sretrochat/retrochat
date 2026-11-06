// Desktop app mode: real native windows instead of in-page windows (only when running inside the YappChat app).
(function(){const D=!!(window.YappDesktop&&window.YappDesktop.isDesktop);window.YD=D;if(!D){window.ydPop=()=>null;window.ydFind=()=>null;return}
 const popped=new Set();window.ydFind=id=>{for(const el of popped){if(el.id==id)return el;const f=el.querySelector('#'+CSS.escape(id));if(f)return f}return null};
 document.documentElement.classList.add('yd');
 const css=`html.yd,html.yd body{margin:0!important;padding:0!important;height:100%;overflow:hidden;background:var(--card,#fff)!important}
 html.yd #yfoot,html.yd #foot,html.yd #ad-slot{display:none!important}
 html.yd body>.win:not(.im):not(#brw),html.yd body>#mwin{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;transform:none!important}
 html.yd body>.win>.tbar,html.yd body>#mwin>.tbar{display:none!important}
 html.yd.ydpop .im,html.yd.ydpop #brw{position:fixed!important;display:flex!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
 html.yd.ydpop .im>.tbar,html.yd.ydpop #brw>.tbar{display:none!important}html.yd.ydpop .im .log{flex:1;height:auto!important}
 .ydlogo{display:inline-flex;align-items:center;gap:5px;font:700 13px system-ui,Segoe UI,Arial;color:#00205B;padding:0 10px 0 6px;align-self:center}html.yd #menu{display:flex;align-items:center}`;
 const addLogo=()=>document.querySelectorAll('#menu').forEach(m=>{if(m.querySelector('.ydlogo')||!window.YI)return;const b=document.createElement('span');b.className='ydlogo';b.innerHTML='<img src="/razzle-social.svg" width="22" height="22" alt="" style="display:block">'+'<span>Razzle</span>';m.prepend(b)});document.readyState=='loading'?document.addEventListener('DOMContentLoaded',addLogo):setTimeout(addLogo);
 const st=document.createElement('style');st.id='ydcss';st.textContent=css;document.head.appendChild(st);
 // Move an element into its own native window. It keeps running in this page (same socket, same session).
 window.ydPop=function(el,name,w,h,title,onClose){let pw=null;try{pw=window.open('about:blank',name,'width='+w+',height='+h)}catch(e){}if(!pw)return null;
  const d=pw.document;d.open();d.write('<!doctype html><html class="yd ydpop"><head><meta charset=utf-8><base href="'+location.origin+'/"><title></title></head><body></body></html>');d.close();
  document.querySelectorAll('link[rel=stylesheet],style').forEach(n=>d.head.appendChild(n.cloneNode(true)));
  d.documentElement.className=document.documentElement.className+' ydpop';d.body.className=document.body.className;d.title=title||'YappChat';
  d.body.appendChild(el);popped.add(el);el._pw=pw;let done=false;const fin=()=>{if(done)return;done=true;el._pw=null;popped.delete(el);onClose&&onClose()};
  pw.addEventListener('pagehide',fin);pw.addEventListener('beforeunload',fin);return pw};
})();
// v13.6: in-window dialogs (avatar, settings, profile) open as their own native windows in the desktop app.
(function(){if(!window.YD)return;let n=0;
 const sz=el=>el.classList.contains('yae')?[520,680]:el.classList.contains('yset')?[520,640]:[420,600];
 const pop=el=>{if(el._pw||el._ydp)return;el._ydp=1;const [w,h]=sz(el);const t=(el.querySelector('.hd span,.hd,.tbar,h2,h3')||{}).textContent||'YappChat';
  const parent=document.body;let closing=false;
  const pw=window.ydPop(el,'ydlg'+(++n),w,h,t.trim().replace(/\u00d7$/,'').trim()||'YappChat',()=>{closing=true;if(el.isConnected)el.remove()});
  if(!pw)return;// popup blocked: stays in-window
  new MutationObserver((_,o)=>{if(el.parentNode!==pw.document.body){o.disconnect();if(!closing)try{pw.close()}catch(e){}}}).observe(pw.document.body,{childList:true})};
 const start=()=>new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(x=>{if(x.nodeType==1&&x.parentNode==document.body&&(x.classList.contains('yae')||x.classList.contains('yprof')))setTimeout(()=>x.parentNode==document.body&&pop(x))}))).observe(document.body,{childList:true});
 document.body?start():document.addEventListener('DOMContentLoaded',start)})();
