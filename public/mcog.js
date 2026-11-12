// v13.6 Messenger quick-settings cogwheel (replaces the floating moon button on the Messenger)
(function(){const $=i=>document.getElementById(i),L=localStorage;
const css=`#thm{display:none!important}#mcog{margin-left:auto;align-self:center;flex:0 0 auto;width:30px;height:28px;border:0;border-radius:8px;background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}#mcog svg{width:19px!important;height:19px!important;min-width:19px;flex:0 0 19px}#mcog{background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}#mcog:hover,#mcog.on{background:var(--soft,#eaf3fd)!important}
#mcogdd{position:fixed;z-index:9999;display:none;background:var(--card,#fff);color:var(--ink,#12213F);border:1px solid var(--line,#d5e2f0);border-radius:12px;box-shadow:var(--shadow,0 8px 24px rgba(0,0,0,.2));padding:6px;width:236px;max-height:calc(100vh - 8px);overflow-y:auto;font-size:13px}
#mcogdd.open{display:block}#mcogdd .it{width:100%;border:0;background:transparent;color:inherit;text-align:left;font:inherit;display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;cursor:pointer;white-space:nowrap}#mcogdd .it:is(:hover,:focus-visible){background:#0033A0;color:#fff}#mcogdd .it .r{margin-left:auto;font-size:12px;opacity:.8}
#mcogdd hr{border:0;border-top:1px solid var(--line,#d5e2f0);margin:4px 0}#mcogdd .fs{display:flex;gap:4px;padding:4px 10px 6px}#mcogdd .fs button{flex:1;text-align:center;border:1px solid var(--line,#d5e2f0);border-radius:8px;padding:3px 0;cursor:pointer}#mcogdd .fs button.on{background:#0033A0;color:#fff;border-color:#0033A0}
#mcogdd .h{font-size:11px;color:var(--muted,#5b6b85);padding:4px 10px 0;font-weight:600}
:root{--messenger-name-size:13px;--messenger-detail-size:12px;--messenger-menu-size:13px;--messenger-message-size:14px}
html.mfs-s{--messenger-name-size:12px;--messenger-detail-size:11px;--messenger-menu-size:12px;--messenger-message-size:12px}
html.mfs-l{--messenger-name-size:17px;--messenger-detail-size:15px;--messenger-menu-size:15px;--messenger-message-size:17px}
#mwin #list .ct .n,#mwin #me .nm{font-size:var(--messenger-name-size)!important}
#mwin #list .ct .sm,#mwin #list .grp,#mwin #me #smsg,#mwin #me #stsel{font-size:var(--messenger-detail-size)!important}
#mwin #menu>div,#mcogdd{font-size:var(--messenger-menu-size)!important}
.im .log,.im .inbox textarea{font-size:var(--messenger-message-size)!important}
@media(max-width:760px){.im .inbox textarea{font-size:max(16px,var(--messenger-message-size))!important}}`;
const COG='<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
const MOON='<svg viewBox="0 0 24 24" width="16" height="16" fill="#3b4f8a"><path d="M20.5 14.6A8.5 8.5 0 019.4 3.5a8.5 8.5 0 1011.1 11.1z"/></svg>',SUN='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f5b301" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="#f5b301"/><path d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"/></svg>';
const fsApply=()=>{const f=L.ycMFs;document.documentElement.classList.toggle('mfs-s',f==='s');document.documentElement.classList.toggle('mfs-l',f==='l')};fsApply();
addEventListener('storage',event=>{if(event.key==='ycMFs')fsApply()});
function init(){const m=$('menu');if(!m||$('mcog'))return;const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
 const b=document.createElement('button');b.id='mcog';b.type='button';b.title='Quick settings';b.setAttribute('aria-label','Quick settings');b.innerHTML=COG;m.appendChild(b);
 const d=document.createElement('div');d.id='mcogdd';document.body.appendChild(d);
 const chk=v=>v?'&#10003;':'';
 const draw=()=>{const dark=window.YTheme&&YTheme.get()=='dark',sr=$('mShowRoomCheck'),f=L.ycMFs||'m';
  d.innerHTML=`<button type=button class=it role=menuitem tabindex=-1 data-a=th>${dark?SUN:MOON}<span>${dark?'Light mode':'Night mode'}</span></button>
  <button type=button class=it role=menuitemcheckbox aria-checked="${L.ycPmPop!='off'}" tabindex=-1 data-a=pmp><span>Pop up new PMs</span><span class=r>${chk(L.ycPmPop!='off')}</span></button><button type=button class=it role=menuitemcheckbox aria-checked="${L.ycSound=='off'}" tabindex=-1 data-a=snd><span>Mute sounds</span><span class=r>${chk(L.ycSound=='off')}</span></button>
  <button type=button class=it role=menuitemcheckbox aria-checked="${L.ycShake!='off'}" tabindex=-1 data-a=shk><span>Buzz shake</span><span class=r>${L.ycShake=='off'?'Off':'On'}</span></button>
  <button type=button class=it role=menuitemcheckbox aria-checked="${L.ycRoomBuzz!='off'}" tabindex=-1 data-a=rb><span>Allow room buzzes</span><span class=r>${chk(L.ycRoomBuzz!='off')}</span></button>
  <div class=h>Font size</div><div class=fs>${[['s','Small'],['m','Medium'],['l','Large']].map(([k,l])=>`<button type=button role=menuitemradio aria-checked="${k===f}" tabindex=-1 data-f=${k} class="${k==f?'on':''}">${l}</button>`).join('')}</div>
  ${sr&&$('mShowRoom').style.display!='none'?`<div class=h>Privacy</div><button type=button class=it role=menuitemcheckbox aria-checked="${sr.checked}" tabindex=-1 data-a=sr><span>Display Room I’m In</span><span class=r>${chk(sr.checked)}</span></button>`:''}
  <hr><button type=button class=it role=menuitem tabindex=-1 data-a=av><span>Audio &amp; Video settings&hellip;</span></button><button type=button class=it role=menuitem tabindex=-1 data-a=all><span>All Settings&hellip;</span></button>`};
 const place=()=>{const r=b.getBoundingClientRect(),W=document.documentElement.clientWidth,H=innerHeight,w=d.offsetWidth,h=d.offsetHeight;d.style.left=Math.max(4,Math.min(r.right-w,W-w-4))+'px';d.style.top=Math.max(4,Math.min(r.bottom+2,H-h-4))+'px'};
 const show=o=>{d.classList.toggle('open',o);b.classList.toggle('on',o);if(o){draw();place()}};
 const refresh=selector=>{if(d.classList.contains('open')){draw();place();d.querySelector(selector)?.focus()}};
 RazzleMessengerControls.attach(b,d,show);
 addEventListener('resize',()=>d.classList.contains('open')&&place());
 d.onclick=e=>{e.stopPropagation();const f=e.target.closest('[data-f]');if(f){L.ycMFs=f.dataset.f;fsApply();refresh('[data-f='+f.dataset.f+']');return}const a=(e.target.closest('[data-a]')||{}).dataset?.a;if(!a)return;
  if(a=='th')window.YTheme&&YTheme.toggle();else if(a=='pmp'){L.ycPmPop=L.ycPmPop=='off'?'on':'off'}else if(a=='snd'){L.ycSound=L.ycSound=='off'?'on':'off';dispatchEvent(new Event('ycsound'))}
  else if(a=='shk')L.ycShake=L.ycShake=='off'?'on':'off';else if(a=='rb')L.ycRoomBuzz=L.ycRoomBuzz=='off'?'on':'off';
  else if(a=='sr'){$('mShowRoomCheck').click();setTimeout(()=>refresh('[data-a=sr]'),400)}
  else if(a=='all'){RazzleMessengerControls.close(true);window.YSet&&YSet.open();return}else if(a=='av'){RazzleMessengerControls.close(true);avPanel();return}refresh('[data-a='+a+']')}}
let devicePanel, openingDevices;
function avPanel(){
 if(devicePanel?.isConnected){devicePanel._pw?.focus();devicePanel.focus();return;}
 if(!openingDevices)openingDevices=renderAvPanel().finally(()=>{openingDevices=null;});
 return openingDevices;
}
async function renderAvPanel(){if(!window.YAV)await new Promise(ok=>{const s=document.createElement('script');s.src='/av.js?v=3';s.onload=s.onerror=ok;document.head.appendChild(s)});if(!window.YAV)return alert('Audio settings are not available right now.');
 if(!window.RazzleMediaTest)await new Promise(resolve=>{const script=document.createElement('script');script.src='/media-device-test.js';script.onload=script.onerror=resolve;document.head.append(script);});
 const c=YAV.cfg(),ds=await YAV.devices(),E=s=>String(s).replace(/[&<>"]/g,x=>'&#'+x.charCodeAt(0)+';');
 const sel=(id,o,v)=>`<select id=${id} style="width:100%;margin:2px 0 8px">${o.map(([k,l])=>`<option value="${E(k)}" ${k==v?'selected':''}>${E(l)}</option>`).join('')}</select>`;
 const w=document.createElement('div');w.className='yprof razzle-settings-dialog device-settings';w.tabIndex=-1;devicePanel=w;w.innerHTML=`<div class=tbar>Audio &amp; Video Settings<span class=sp></span><button type="button" class="x settings-close" aria-label="Close settings" title="Close"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div class=pb style="padding:12px">
 <div class="device-options"><b>Microphone</b>${sel('mavDev',[['','Default microphone'],...ds.map((x,i)=>[x.deviceId,x.label||'Microphone '+(i+1)])],c.dev)}
 <b>Mic mode</b>${sel('mavMode',[['voice','Voice (noise reduction)'],['music','Music (full quality)']],c.mode)}
 <b>Camera quality</b>${sel('mavCam',[['hd','HD'],['normal','Standard'],['low','Low (saves data)']],c.camQ)}
 <label style="font-weight:600"><input type=checkbox id=mavAgc ${c.agc?'checked':''} style="width:auto;display:inline;margin-right:6px"> Let my computer adjust my mic level automatically</label>
 <p style="margin:10px 0 2px">Mic volume <span id=mavBoostLbl>${c.boost}%</span></p>
 <input type=range id=mavBoost min=0 max=200 step=5 value="${c.boost}" style="width:100%">
 <small style="display:block;margin:2px 0 6px;color:var(--muted,#5b6b85)">0&ndash;200%. 100% is normal. Above 100% raises your mic; a soft limiter prevents harsh clipping.</small></div>
 <section class="media-test-area"><h4>Test your devices</h4><div class="media-test-actions"><button type="button" data-test-camera aria-pressed="false">Test webcam</button><button type="button" data-test-mic aria-pressed="false">Test microphone</button></div><label class="mic-test-label">Microphone level<meter data-mic-level min="0" max="100" value="0" aria-label="Microphone test level"></meter></label><p data-device-test-status role="status">Tests are private. Devices turn on only when you click a test button.</p><video data-camera-preview autoplay muted playsinline hidden></video></section>
 <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button id=mavX>Cancel</button><button id=mavOk style="background:#0033A0;color:#fff;border-color:#0033A0">Save</button></div></div>`;
 document.body.appendChild(w);const q=s=>w.querySelector(s),cl=()=>{stopTests();w.remove()};
 const actions=q('#mavOk').parentElement;actions.className='settings-actions';w.append(actions);
 const syncBoost=()=>{const v=YAV.setBoost(+q('#mavBoost').value);q('#mavBoostLbl').textContent=v+'%'};
 q('#mavBoost').oninput=syncBoost;const stopTests=window.RazzleMediaTest?RazzleMediaTest.mount(w):()=>{};
 q('.x').onclick=q('#mavX').onclick=cl;
 q('#mavOk').onclick=async()=>{const old=YAV.cfg();YAV.set('dev',q('#mavDev').value);YAV.set('mode',q('#mavMode').value);YAV.set('camQ',q('#mavCam').value);YAV.set('agc',q('#mavAgc').checked);YAV.setBoost(+q('#mavBoost').value);cl();
  if(old.agc!=YAV.cfg().agc||old.dev!=YAV.cfg().dev||old.mode!=YAV.cfg().mode){try{YAV.recapture&&await YAV.recapture()}catch(e){}}}
}
document.readyState=='loading'?addEventListener('DOMContentLoaded',init):init()})();
