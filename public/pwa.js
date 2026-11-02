// PWA: register service worker + Install button (shown when the browser allows install)
(function () { if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  let ev = null; const btn = () => { let b = document.getElementById('pwaInstall'); if (!b) { b = document.createElement('button'); b.id = 'pwaInstall'; b.textContent = '\u2B07 Install YappChat'; b.title = 'Install YappChat as an app';
    b.style.cssText = 'position:fixed;right:10px;bottom:10px;z-index:9000;padding:6px 12px;border-radius:16px;background:#7c3aed;color:#fff;border:0;font:bold 12px Arial;box-shadow:0 2px 8px #0004;cursor:pointer';
    b.onclick = async () => { if (!ev) return; ev.prompt(); await ev.userChoice.catch(() => {}); ev = null; b.remove(); }; document.body.appendChild(b); } return b; };
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); ev = e; if (!matchMedia('(display-mode: standalone)').matches) btn(); });
  addEventListener('appinstalled', () => { const b = document.getElementById('pwaInstall'); b && b.remove(); });
})();

// unverified-email banner (only shows when the server has email verification enabled)
(function(){const q=new URLSearchParams(location.search).get('verified');
 function bar(html){const d=document.createElement('div');d.id='yverify';d.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9400;background:#fff4c2;color:#333;border-bottom:1px solid #d9b500;font:12px Tahoma;padding:5px 10px;text-align:center';d.innerHTML=html+' <a href="#" id="yvx" style="margin-left:8px">\u2715</a>';document.body.appendChild(d);d.querySelector('#yvx').onclick=e=>{e.preventDefault();d.remove()};return d}
 window.YVerify={check(){fetch('/api/verify/status',{credentials:'same-origin'}).then(r=>r.json()).then(j=>{if(!j.need||document.getElementById('yverify'))return;const d=bar('Please verify your email address. Check your inbox for the link. <a href="#" id="yvs">Resend email</a>');
  d.querySelector('#yvs').onclick=e=>{e.preventDefault();fetch('/api/verify/send',{method:'POST',credentials:'same-origin'}).then(r=>r.json()).then(k=>{e.target.textContent=k.error||'Sent!'})}}).catch(()=>{})},
  send(){return fetch('/api/verify/send',{method:'POST',credentials:'same-origin'}).catch(()=>{})}};
 addEventListener('load',()=>{if(q==='1')bar('Thanks, your email is verified.');else if(q==='0')bar('That verification link is invalid or expired.');setTimeout(()=>YVerify.check(),1500)})})();
