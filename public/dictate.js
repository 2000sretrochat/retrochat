// Speech-to-text dictation (Web Speech API). Adds a small keyboard-mic button to chat inputs; text is typed into the box, never auto-sent.
// The desktop app (Electron) has the SpeechRecognition object but no Google speech service behind it, so it always failed
// with a "network" error. There the button points to Windows voice typing (Windows key + H), which is free and types into any box.
(function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition,DESK=!!(window.YappDesktop&&window.YappDesktop.isDesktop);if(!SR&&!DESK)return; // unsupported (e.g. Firefox): no button
 const WINH='Dictation in the app: click in the box, then press the Windows key + H to talk (Windows voice typing).';
 const ERR={'not-allowed':'Microphone blocked. Allow the microphone for this site, then try again.','service-not-allowed':'Dictation is turned off in this browser. Try Chrome or Edge.','audio-capture':'No microphone found.','network':DESK?WINH:'Dictation could not reach the speech service. Check your connection, or use Chrome or Edge.','language-not-supported':'Dictation does not support this language.'};
 const LK='ycDictLang',lang=()=>localStorage.getItem(LK)||navigator.language||'en-US';let rec=null,cur=null;
 const ICON='<svg width=14 height=14 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v3"/><rect x="2" y="20" width="20" height="3" rx="1" stroke-width="1.5"/></svg>';
 function stop(){if(rec)try{rec.stop()}catch{}}
 function start(ta,btn){if(rec){const same=cur===ta;stop();if(same)return}
  if(DESK){ta.focus();return flash(btn,WINH)}
  if(window.YTalking&&YTalking())return flash(btn,'Turn off your voice mic first, then dictate.');
  rec=new SR();cur=ta;rec.lang=lang();rec.interimResults=true;rec.continuous=true;const base=ta.value?ta.value.replace(/\s*$/,' '):'';let fin='';
  rec.onresult=e=>{let im='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;e.results[i].isFinal?fin+=t:im+=t}const max=ta.maxLength>0?ta.maxLength:1e4;ta.value=(base+fin+im).slice(0,max);ta.dispatchEvent(new Event('input',{bubbles:true}))};
  rec.onerror=e=>{if(e.error!='no-speech'&&e.error!='aborted')flash(btn,ERR[e.error]||'Dictation stopped ('+e.error+'). Try again.')};
  rec.onend=()=>{btn.classList.remove('ydon');btn.title='Dictate (speech to text)';if(cur===ta){rec=null;cur=null}ta.focus()};
  try{rec.start();btn.classList.add('ydon');btn.title='Listening... click to stop'}catch{rec=null;cur=null;flash(btn,'Dictation could not start. Try again.')}}
 // Problems used to show only as a tooltip, so a click looked like it did nothing. Now a small note appears above the button.
 function flash(b,t){b.title=t;b.classList.add('yderr');setTimeout(()=>b.classList.remove('yderr'),1500);const d=b.ownerDocument,n=d.createElement('div');n.className='ydnote';n.setAttribute('role','status');n.textContent=t;
  b.parentElement.querySelectorAll('.ydnote').forEach(x=>x.remove());b.parentElement.appendChild(n);setTimeout(()=>n.remove(),6000)}
 const st=document.createElement('style');st.textContent='.ydict{position:absolute;right:4px;bottom:4px;z-index:3;cursor:pointer;border:1px solid transparent;border-radius:3px;background:transparent;color:#557;padding:2px;line-height:0}.ydict:hover{border-color:#7f9db9;background:var(--pale,#eef)}.ydict.ydon{color:#fff;background:#c33;animation:ydp 1s infinite}.ydict.yderr{background:#fc0}.ydnote{position:absolute;right:4px;bottom:calc(100% + 4px);z-index:5;max-width:280px;background:#ffffe1;color:#222;border:1px solid #999;border-radius:4px;padding:4px 7px;font:12px Tahoma,Arial,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.2)}@keyframes ydp{50%{opacity:.6}}';document.head.appendChild(st);
 function attach(ta){if(ta.dataset.yd)return;ta.dataset.yd=1;const p=ta.parentElement;if(getComputedStyle(p).position=='static')p.style.position='relative';
  const b=document.createElement('button');b.type='button';b.className='ydict';b.title='Dictate (speech to text)';b.innerHTML=ICON;b.tabIndex=-1;
  b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=e=>{e.stopPropagation();start(ta,b)};ta.style.paddingRight=Math.max(parseInt(getComputedStyle(ta).paddingRight)||0,24)+'px';p.appendChild(b);
  ta.addEventListener('keydown',e=>{if(e.key=='Enter'&&cur===ta)stop()})}
 const scan=()=>document.querySelectorAll('textarea[placeholder^="Type a message"],textarea#msg').forEach(attach);
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});addEventListener('DOMContentLoaded',scan);scan();
 window.YDict={lang,setLang:l=>l?localStorage.setItem(LK,l):localStorage.removeItem(LK),supported:true,stop};
})();
