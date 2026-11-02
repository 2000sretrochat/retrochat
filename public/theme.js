// Light / dark mode toggle (saved in localStorage, shared by Messenger and Chat Rooms)
(function(){const K='ycTheme',apply=t=>{document.documentElement.classList.toggle('dark',t=='dark');const b=document.getElementById('thm');if(b){b.textContent=t=='dark'?'\u2600\uFE0F':'\uD83C\uDF19';b.title=t=='dark'?'Switch to light mode':'Switch to dark mode'}};
let t=localStorage[K]||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');apply(t);
addEventListener('DOMContentLoaded',()=>{const b=document.createElement('button');b.id='thm';b.type='button';b.setAttribute('aria-label','Toggle dark mode');document.body.appendChild(b);apply(t);
 b.onclick=()=>{t=t=='dark'?'light':'dark';localStorage[K]=t;apply(t)}});
addEventListener('storage',e=>{if(e.key==K){t=e.newValue||'light';apply(t)}})})();
