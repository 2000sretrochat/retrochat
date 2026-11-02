// Speech-to-text dictation (Web Speech API). Adds a small keyboard-mic button to chat inputs; text is typed into the box, never auto-sent.
(function(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return; // unsupported (e.g. Firefox): no button
 const LK='ycDictLang',lang=()=>localStorage.getItem(LK)||navigator.language||'en-US';let rec=null,cur=null;
 const ICON='<svg width=14 height=14 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v3"/><rect x="2" y="20" width="20" height="3" rx="1" stroke-width="1.5"/></svg>';
 function stop(){if(rec)try{rec.stop()}catch{}}
 function start(ta,btn){if(rec){const same=cur===ta;stop();if(same)return}
  if(window.YTalking&&YTalking())return flash(btn,'Turn off your voice mic first');
  rec=new SR();cur=ta;rec.lang=lang();rec.interimResults=true;rec.continuous=true;const base=ta.value?ta.value.replace(/\s*$/,' '):'';let fin='';
  rec.onresult=e=>{let im='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;e.results[i].isFinal?fin+=t:im+=t}const max=ta.maxLength>0?ta.maxLength:1e4;ta.value=(base+fin+im).slice(0,max);ta.dispatchEvent(new Event('input',{bubbles:true}))};
  rec.onerror=e=>{if(e.error!='no-speech'&&e.error!='aborted')flash(btn,e.error=='not-allowed'?'Microphone blocked':'Dictation error')};
  rec.onend=()=>{btn.classList.remove('ydon');btn.title='Dictate (speech to text)';if(cur===ta){rec=null;cur=null}ta.focus()};
  try{rec.start();btn.classList.add('ydon');btn.title='Listening... click to stop'}catch{rec=null;cur=null}}
 function flash(b,t){b.title=t;b.classList.add('yderr');setTimeout(()=>b.classList.remove('yderr'),1500)}
 const st=document.createElement('style');st.textContent='.ydict{position:absolute;right:4px;bottom:4px;z-index:3;cursor:pointer;border:1px solid transparent;border-radius:3px;background:transparent;color:#557;padding:2px;line-height:0}.ydict:hover{border-color:#7f9db9;background:var(--pale,#eef)}.ydict.ydon{color:#fff;background:#c33;animation:ydp 1s infinite}.ydict.yderr{background:#fc0}@keyframes ydp{50%{opacity:.6}}';document.head.appendChild(st);
 function attach(ta){if(ta.dataset.yd)return;ta.dataset.yd=1;const p=ta.parentElement;if(getComputedStyle(p).position=='static')p.style.position='relative';
  const b=document.createElement('button');b.type='button';b.className='ydict';b.title='Dictate (speech to text)';b.innerHTML=ICON;b.tabIndex=-1;
  b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=e=>{e.stopPropagation();start(ta,b)};ta.style.paddingRight=Math.max(parseInt(getComputedStyle(ta).paddingRight)||0,24)+'px';p.appendChild(b);
  ta.addEventListener('keydown',e=>{if(e.key=='Enter'&&cur===ta)stop()})}
 const scan=()=>document.querySelectorAll('textarea[placeholder^="Type a message"]').forEach(attach);
 new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});addEventListener('DOMContentLoaded',scan);scan();
 window.YDict={lang,setLang:l=>l?localStorage.setItem(LK,l):localStorage.removeItem(LK),supported:true,stop};
})();
