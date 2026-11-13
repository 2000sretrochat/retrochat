// Night light (saved in localStorage, shared by Messenger and Chat Rooms).
// Owner request (Nov 13, 2026): the old dark-blue night mode was too dark and plain white too bright, so night light
// is now a soft gray tint over the normal (light) look, with a strength slider each chatter picks (10-85%).
(function(){const K='ycTheme',NK='ycNight',SK='ycNightStrength',MIN=10,MAX=85,DEF=45,H=document.documentElement;
const clampS=v=>{v=Math.round(+v);return Number.isFinite(v)?Math.max(MIN,Math.min(MAX,v)):DEF};
// Gray, slightly warm target: whites become this color at full strength (less blue light, never pitch dark).
const tint=s=>{const f=clampS(s)/100,T=[74,72,68];return T.map(c=>Math.round(255-(255-c)*f))};
const nightCss=s=>{const [r,g,b]=tint(s);return 'html.nightlight::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;background:rgb('+r+','+g+','+b+');mix-blend-mode:multiply}'};
let on,str=clampS(localStorage[SK]||DEF);
// One-time migration: anyone on the old dark-blue mode (or with a dark OS setting and no choice saved) gets night light.
if(localStorage[NK]==null){on=localStorage[K]=='dark'||(!localStorage[K]&&matchMedia('(prefers-color-scheme: dark)').matches);try{localStorage[NK]=on?'on':'off';localStorage[K]='light'}catch(e){}}else on=localStorage[NK]=='on';
const M='<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z"/></svg>',U='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';
const apply=()=>{H.classList.remove('dark');H.classList.toggle('nightlight',on);let st=document.getElementById('yc-night');if(!st){st=document.createElement('style');st.id='yc-night';(document.head||H).appendChild(st)}st.textContent=on?nightCss(str):'';
 const b=document.getElementById('thm');if(b){b.innerHTML=on?U:M;b.style.color=on?'#f5b301':'#3b4f8a';b.title=on?'Night light is on: click for strength or to turn it off':'Turn on night light';b.setAttribute('aria-pressed',on?'true':'false')}
 const r=document.getElementById('ycNightRange');if(r){r.value=str;r.disabled=!on}const v=document.getElementById('ycNightVal');if(v)v.textContent=str+'%';const c=document.getElementById('ycNightOn');if(c)c.checked=on;
 dispatchEvent(new Event('ycnight'))};
const save=()=>{try{localStorage[NK]=on?'on':'off';localStorage[SK]=String(str)}catch(e){}};
const setOn=v=>{on=!!v;save();apply();return on},setStrength=v=>{str=clampS(v);save();apply();return str};
// Small, quiet popover beside the moon button: on/off plus a strength slider.
let pop=null;const closePop=()=>{if(pop){pop.remove();pop=null}};
const openPop=b=>{if(pop)return closePop();pop=document.createElement('div');pop.id='ycNightPop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Night light');
 pop.style.cssText='position:fixed;z-index:2147483646;background:var(--card,#fff);color:var(--ink,#132849);border:1px solid var(--line,#C6D5E7);border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:10px 12px;font:12px Tahoma,"Segoe UI",sans-serif;width:200px';
 pop.innerHTML='<label style="display:flex;align-items:center;gap:6px;font-weight:600"><input type=checkbox id=ycNightOn> Night light</label><label style="display:block;margin-top:8px">Strength <span id=ycNightVal style="float:right;color:var(--muted,#667)"></span><input type=range id=ycNightRange min='+MIN+' max='+MAX+' step=1 style="width:100%;accent-color:#0033A0"></label>';
 document.body.appendChild(pop);const r=b.getBoundingClientRect(),W=H.clientWidth;pop.style.left=Math.max(4,Math.min(r.right-200,W-204))+'px';pop.style.top=(r.bottom+4)+'px';
 pop.querySelector('#ycNightOn').onchange=e=>setOn(e.target.checked);pop.querySelector('#ycNightRange').oninput=e=>setStrength(e.target.value);apply();
 setTimeout(()=>document.addEventListener('pointerdown',function f(e){if(pop&&!pop.contains(e.target)&&e.target!==b&&!b.contains(e.target)){closePop();document.removeEventListener('pointerdown',f)}}),0)};
apply();
addEventListener('DOMContentLoaded',()=>{const b=document.createElement('button');b.id='thm';b.type='button';b.setAttribute('aria-label','Night light');(document.getElementById('rhead')||document.body).appendChild(b);apply();
 b.onclick=()=>{if(!on){setOn(true);closePop();openPop(b)}else openPop(b)}});
addEventListener('storage',e=>{if(e.key==NK){on=e.newValue=='on';apply()}else if(e.key==SK){str=clampS(e.newValue);apply()}});
window.YTheme={get:()=>on?'night':'light',night:()=>on,strength:()=>str,setNight:setOn,setStrength,toggle:()=>setOn(!on)?'night':'light',tint,clamp:clampS,MIN,MAX}})();
;(function(){function fix(){document.querySelectorAll('#menu>div').forEach(function(m){var d=m.querySelector(':scope>.dd');if(!d)return;if(!m.classList.contains('open')){d.classList.remove('ddfix');d.style.left=d.style.top='';return}
d.classList.add('ddfix');var r=m.getBoundingClientRect(),W=document.documentElement.clientWidth,H=window.innerHeight;d.style.left='0px';d.style.top='0px';var w=d.offsetWidth,h=d.offsetHeight;var x=Math.max(4,Math.min(r.left,W-w-4)),y=r.bottom+2;if(y+h>H-4)y=Math.max(4,H-h-4);d.style.left=x+'px';d.style.top=y+'px'})}
document.addEventListener('click',function(){setTimeout(fix,0)});document.addEventListener('contextmenu',function(){setTimeout(fix,0)});window.addEventListener('resize',fix)})();
