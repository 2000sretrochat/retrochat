// v13.7: room pop-overs never get cut off. Desktop app: native pop-up windows. Web: kept inside the viewport.
(function(){const $=id=>document.getElementById(id)||(window.ydFind&&ydFind(id));
 const clamp=(el,anchor,gap=6)=>{if(!el||!anchor)return;el.style.position='fixed';el.style.bottom='auto';el.style.right='auto';const a=anchor.getBoundingClientRect(),W=document.documentElement.clientWidth,H=innerHeight;
  el.style.left='0px';el.style.top='0px';const w=el.offsetWidth,h=el.offsetHeight;let x=Math.max(4,Math.min(a.left,W-w-4)),y=a.top-h-gap;if(y<4)y=Math.min(a.bottom+gap,H-h-4);el.style.left=x+'px';el.style.top=Math.max(4,y)+'px'};
 const init=()=>{const chat=$('chat'),rh=$('rhead');if(!chat||!rh)return;
  // People toggle for narrow windows
  const pb=document.createElement('button');pb.className='hb';pb.id='bPpl';pb.title='Show/hide people in room';pb.innerHTML='&#128101; <span>People</span>';
  const inv=$('bInv');inv?rh.insertBefore(pb,inv):rh.appendChild(pb);pb.onclick=e=>{e.stopPropagation();chat.classList.toggle('pplon');pb.classList.toggle('on',chat.classList.contains('pplon'))};
  document.addEventListener('click',e=>{if(chat.classList.contains('pplon')&&!e.target.closest('#mpane,#bPpl,.yctx'))chat.classList.remove('pplon'),pb.classList.remove('on')});
  const smp=$('smp'),msg=$('msg');
  if(window.YD){// ---- desktop: native windows ----
   let ew=null;const openEmoji=()=>{if(ew&&!ew.closed){ew.focus();return}
    ew=window.open('about:blank','yemoji'+Date.now(),'width=340,height=380');if(!ew)return false;const d=ew.document;
    d.write('<!doctype html><html class="'+document.documentElement.className+' ydpop"><head><meta charset=utf-8><title>Smileys</title></head><body style="margin:0"></body></html>');d.close();
    document.querySelectorAll('link[rel=stylesheet],style').forEach(n=>d.head.appendChild(n.cloneNode(true)));
    const st=d.createElement('style');st.textContent='html,body{height:100%;overflow:hidden;background:var(--card,#fff)}#ep{box-sizing:border-box;height:100vh;overflow:auto;padding:8px;display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:2px;align-content:start;justify-items:center}#ep span{cursor:pointer;padding:3px;border-radius:6px}#ep span:hover{background:var(--hover,#eaf3fd)}';d.head.appendChild(st);
    document.querySelectorAll('body>svg').forEach(n=>{if(n.querySelector('defs'))d.body.appendChild(n.cloneNode(true))});const box=d.createElement('div');box.id='ep';box.innerHTML=smp.innerHTML;d.body.appendChild(box);
    box.onclick=e=>{const s=e.target.closest('span[data-k]');if(!s)return;const t=document.createElement('textarea');t.innerHTML=s.dataset.k;msg.value+=' '+t.value+' ';msg.dispatchEvent(new Event('input',{bubbles:true}));if(!e.shiftKey)ew.close();window.focus();msg.focus()};
    ew.addEventListener('keydown',e=>{if(e.key=='Escape')ew.close()});return true};
   ['bSm','smb'].forEach(id=>{const b=$(id);if(b)b.onclick=e=>{e.stopPropagation();if(openEmoji()===false)smp.classList.toggle('open')}});
   // generic: pop a body-level element into its own window; when closed, put it back hidden
   const pop=(el,w,h,title,back)=>{if(el._pw)return;const pw=window.ydPop(el,'yrp'+Math.random().toString(36).slice(2),w,h,title,()=>{if(back){el.style.display='none';document.body.appendChild(el)}else if(el.isConnected)el.remove()});return pw};
   const css=document.createElement('style');css.textContent='html.yd.ydpop #modw,html.yd.ydpop #avp,html.yd.ydpop .ygifpop{position:static!important;transform:none!important;left:auto!important;top:auto!important;width:auto!important;max-width:none!important;min-height:100vh;box-sizing:border-box;border:0!important;border-radius:0!important;box-shadow:none!important;overflow:auto}html.yd.ydpop #modw>.tbar{display:none!important}';document.head.appendChild(css);
   new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(x=>{if(x.nodeType!=1||x.parentNode!=document.body)return;
    if(x.id=='avp')setTimeout(()=>{if(x.parentNode!=document.body)return;const pw=pop(x,380,520,'Voice & Camera Settings');if(pw)new MutationObserver((_,o)=>{if(x.parentNode!==pw.document.body){o.disconnect();try{pw.close()}catch(e){}}}).observe(pw.document.body,{childList:true})});
    if(x.classList.contains('ygifpop'))setTimeout(()=>{if(x.parentNode!=document.body)return;const pw=pop(x,330,420,'GIFs');if(pw)new MutationObserver((_,o)=>{if(x.parentNode!==pw.document.body){o.disconnect();try{pw.close()}catch(e){}}}).observe(pw.document.body,{childList:true})})}))).observe(document.body,{childList:true});
   const mw=$('modw');if(mw){let pw=null;new MutationObserver(()=>{const on=mw.style.display!='none';if(on&&!mw._pw){pw=pop(mw,420,560,'Room Admin Console',true)}else if(!on&&mw._pw){const p=mw._pw;try{p.close()}catch(e){}}}).observe(mw,{attributes:true,attributeFilter:['style']})}
  }else{// ---- web: keep pop-overs inside the viewport ----
   const fix=()=>{if(smp.classList.contains('open'))clamp(smp,$('bSm')&&$('bSm').offsetParent?$('bSm'):$('smb'))};
   new MutationObserver(fix).observe(smp,{attributes:true,attributeFilter:['class']});addEventListener('resize',fix);
   const fitBox=el=>{if(!el||el.style.display=='none')return;const r=el.getBoundingClientRect(),W=document.documentElement.clientWidth,H=innerHeight;if(r.right>W-4||r.left<4||r.bottom>H-4||r.top<4){el.style.maxWidth=(W-8)+'px';el.style.maxHeight=(H-8)+'px';el.style.overflow='auto';el.style.transform='none';const w=el.offsetWidth,h=el.offsetHeight;el.style.left=Math.max(4,Math.min(r.left,W-w-4))+'px';el.style.top=Math.max(4,Math.min(r.top,H-h-4))+'px'}};
   const all=()=>document.querySelectorAll('#modw,#avp,.yprof,.ygifpop,.yctx,.pmwin,.camwin').forEach(fitBox);
   new MutationObserver(()=>setTimeout(all,0)).observe(document.body,{childList:true});addEventListener('resize',all);document.addEventListener('click',()=>setTimeout(all,0));document.addEventListener('contextmenu',()=>setTimeout(all,30));
  }};
 document.readyState=='loading'?document.addEventListener('DOMContentLoaded',init):init()})();
