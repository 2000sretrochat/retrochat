/* Shared voice and webcam call flow for standalone and embedded Messenger. */
window.createMessengerCalls = function ({ socket, contact, openIm, findIm, notice, toast, sound }) {
  const defaultIce = {iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
  const loadIce = () => fetch('/api/ice',{signal:AbortSignal.timeout(5000)})
    .then(response=>response.ok?response.json():defaultIce)
    .then(config=>Array.isArray(config.iceServers)?config:defaultIce)
    .catch(()=>defaultIce);
  const calls = new Set();
  const mediaName = call => call.kind==='video'?'camera and microphone':'microphone';
  const active = (window,call) => window._call===call;
  const find = ({from,callId}) => {
    const window=findIm(from),call=window?._call;
    return call && (!callId || !call.id || call.id===callId) ? window : null;
  };

  function send(call,event,fields={}) {
    return new Promise(resolve=>{
      const connection=socket();
      if(!connection?.connected){resolve({error:'Messenger disconnected.'});return;}
      connection.timeout(8000).emit(event,{to:call.peer,callId:call.id,...fields},
        (error,response)=>resolve(error?{error:'Messenger did not respond.'}:response||{}));
    });
  }
  // Call bar (design Nov 10): status · camera toggle · Hang Up. Each side controls its own camera; a voice call can
  // turn into a webcam call (and back) without hanging up. The video stage collapses when both cameras are off.
  const ICON={on:'<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="10" height="10" rx="2"/><path d="m12.5 9 5-3v8l-5-3"/></svg>',off:'<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l14 14M9 5h1.5a2 2 0 0 1 2 2v2l5-3v8l-2-1M3 6.5a2 2 0 0 0-.5 1.3V13a2 2 0 0 0 2 2h7"/></svg>'};
  const clock=ms=>{const t=Math.max(0,Math.floor(ms/1000));return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');};
  function render(window) {
    const call=window._call, panel=window.querySelector('.call');
    if(!panel)return;
    const el=selector=>{const node=panel.querySelector(selector);return node&&typeof node.setAttribute==='function'?node:null;};
    const stage=el('.cstage'), toggle=el('.camt'), me=el('video.me');
    const mine=!!call?.camOn, theirs=!!call?.theirCam, live=!!call&&call.phase!=='ringing';
    if(stage)stage.hidden=!call||(!mine&&!theirs);
    if(me)me.hidden=!mine;
    const peerLabel=el('.cpeer');if(peerLabel){peerLabel.textContent=call?call.peer+' · Camera off':'';peerLabel.hidden=theirs;}
    (panel.querySelectorAll('video.them')||[]).forEach(video=>{video.hidden=!theirs;});
    if(toggle){
      toggle.hidden=!live;
      toggle.setAttribute('aria-pressed',String(mine));
      toggle.classList.toggle('active',mine);
      toggle.innerHTML=(mine?ICON.off:ICON.on)+'<span>'+(mine?'Turn off webcam':'Turn on webcam')+'</span>';
      toggle.disabled=!!call?.camBusy||call?.phase!=='connected';
    }
    micButton(window,panel,live);
    const status=el('.cstatus');
    if(status){
      const kind=stage&&!stage.hidden?'Video call':'Voice call';
      status.innerHTML=call&&call.phase==='connected'?'<b>'+kind+'</b> <span class=ctime>'+clock(Date.now()-(call.connectedAt||Date.now()))+'</span>':'';
    }
  }
  // PM calls get the same mic adjustments as rooms (shared settings in av.js): mic volume 0-200%, auto-gain (off by
  // default, so the level never changes on its own), and input device. Changes apply to the live call right away.
  function micButton(window,panel,live) {
    const bar=panel.querySelector('.cbtns');
    if(!bar||typeof bar.insertBefore!=='function'||!bar.ownerDocument?.createElement)return;
    let button=bar.querySelector('.micset');
    if(!button){
      const doc=bar.ownerDocument;button=doc.createElement('button');button.type='button';button.className='rzb micset';
      button.textContent='Mic settings';button.title='Mic volume, auto-gain and input device';
      button.onclick=event=>{event.stopPropagation();void micPanel(window,button);};
      bar.insertBefore(button,bar.querySelector('.hang')||null);
    }
    button.hidden=!live;
    if(!live)bar.ownerDocument.querySelector?.('.rz-micpanel')?.remove();
  }
  async function micPanel(window,button) {
    const doc=button.ownerDocument,old=doc.querySelector('.rz-micpanel');
    if(old){old._stop?.();old.remove();return;}
    const yav=await ensureYav();if(!yav)return notice(window,'Mic settings could not load. Try again.');
    const c=yav.cfg(),devs=await yav.devices(),esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const box=doc.createElement('div');box.className='rz-micpanel';box.setAttribute('role','dialog');box.setAttribute('aria-label','Mic settings');
    box.style.cssText='position:fixed;z-index:9999;width:260px;max-width:calc(100vw - 16px);box-sizing:border-box;background:var(--card,#fff);color:var(--ink,#132849);border:1px solid var(--line,#C6D5E7);border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.18);padding:10px 12px;font:12px Tahoma,"Segoe UI",sans-serif';
    box.innerHTML='<b>Mic settings</b>'
      +'<label style="display:block;margin:8px 0 2px">Mic volume <span class=mv>'+c.boost+'%</span><input type=range class=mb min=0 max=200 step=5 value="'+c.boost+'" style="width:100%"></label>'
      +'<div class=meter style="height:6px;background:#e3ebf5;border-radius:3px;overflow:hidden"><i class=mm style="display:block;height:100%;width:0;background:#2fa84f"></i></div>'
      +'<label style="display:block;margin:8px 0 2px"><input type=checkbox class=ma '+(c.agc?'checked':'')+' style="width:auto;display:inline"> Auto-gain</label><small>Off by default so your mic level never changes on its own.</small>'
      +'<label style="display:block;margin:8px 0 2px">Input device<select class=md style="width:100%"><option value="">Default microphone</option>'+devs.map((d,i)=>'<option value="'+esc(d.deviceId)+'"'+(d.deviceId===c.dev?' selected':'')+'>'+esc(d.label||('Input '+(i+1)))+'</option>').join('')+'</select></label>'
      +'<div style="text-align:right;margin-top:8px"><button type=button class=mx>Close</button></div>';
    doc.body.appendChild(box);
    const r=button.getBoundingClientRect(),view=doc.defaultView;
    box.style.left=Math.max(8,Math.min(r.left,view.innerWidth-box.offsetWidth-8))+'px';
    box.style.top=Math.max(8,r.top-box.offsetHeight-6)+'px';
    let stop=yav.attachMeter(box.querySelector('.mm'));box._stop=()=>stop&&stop();
    box.querySelector('.mb').oninput=e=>{const v=yav.setBoost(+e.target.value);box.querySelector('.mv').textContent=v+'%';};
    const rebuild=async()=>{await yav.recapture();box._stop();stop=yav.attachMeter(box.querySelector('.mm'));};
    box.querySelector('.ma').onchange=e=>{yav.set('agc',e.target.checked);void rebuild();};
    box.querySelector('.md').onchange=e=>{yav.set('dev',e.target.value);void rebuild();};
    box.querySelector('.mx').onclick=()=>{box._stop();box.remove();};
  }
  function show(window,message,buttons=false) {
    const panel=window.querySelector('.call'), label=panel.querySelector('.cs');
    panel.classList.toggle('on',Boolean(window._call));
    if(!panel.querySelector('.cstage'))panel.querySelectorAll('video').forEach(video=>video.style.display=window._call?.kind==='video'?'':'none');
    label.textContent=message;
    render(window);
    if(buttons) for(const [text,accept] of [['Answer',true],['Decline',false]]) {
      const button=document.createElement('button');
      button.type='button';button.textContent=text;
      if(accept)button.className='pri';
      button.onclick=()=>answer(window,accept);
      label.append(' ',button);
    }
  }
  function stopRinging(call) {
    clearInterval(call.ring);
    clearTimeout(call.timeout);
  }
  function endCall(window,notify=true,message='Call ended.',reason) {
    const call=window._call;
    if(!call)return;
    window._call=null;
    calls.delete(window);
    stopRinging(call);
    clearInterval(call.tick);
    call.camTrack?.stop();
    clearTimeout(call.recovery);
    if(notify)void send(call,'m:hang',{reason});
    call.unwatchMic?.();
    window.ownerDocument?.querySelector?.('.rz-micpanel')?.remove();
    call.pc?.close();
    call.stream?.getTracks().forEach(track=>track.stop());
    (call.stream?._parts||[]).forEach(part=>part.getTracks&&part.getTracks().forEach(track=>track.stop()));
    window.querySelectorAll('.call video').forEach(video=>video.srcObject=null);
    call.audio?.remove();
    show(window,'');
    if(message){sound('hangup');notice(window,message);}
  }
  function ring(window,call) {
    sound('ring');
    call.ring=setInterval(()=>sound('ring'),2400);
    call.timeout=setTimeout(()=>endCall(window,true,'No answer. Call ended.','no-answer'),30000);
  }
  function begin(window,peer,kind,role,id) {
    const call={peer,kind,role,id,phase:'ringing',candidates:[],queue:Promise.resolve(),camOn:kind==='video',theirCam:kind==='video'};
    window._call=call;
    calls.add(window);
    return call;
  }
  async function startCall(window,name,kind) {
    if(window._call)return notice(window,'You are already in a call.');
    if(!contact(name)?.online)return notice(window,name+' is offline.');
    const call=begin(window,name,kind,'caller',crypto.randomUUID());
    show(window,'Ringing '+name+'…');
    ring(window,call);
    const result=await send(call,'m:call',{kind});
    if(active(window,call)&&call.phase==='ringing'&&result.error)endCall(window,true,result.error);
  }
  function onCall({from,kind,callId}) {
    const window=openIm(from);
    if(window._call){void send({peer:from,id:callId},'m:callans',{accept:false});return;}
    const call=begin(window,from,kind,'callee',callId);
    show(window,from+' is calling you ('+(kind==='video'?'webcam':'voice')+').',true);
    ring(window,call);
    toast('Incoming '+(kind==='video'?'webcam':'voice')+' call');
  }
  async function ensureYav() {
    if(window.YAV)return window.YAV;
    if(typeof document==='undefined'||!document.head)return null;
    await new Promise(ok=>{
      const script=document.createElement('script');script.src='/av.js?v=3';
      script.onload=script.onerror=ok;document.head.appendChild(script);
    });
    return window.YAV||null;
  }
  async function captureCallMedia(call) {
    const video=call.kind==='video'?{width:{ideal:640},height:{ideal:360}}:false;
    const yav=await ensureYav();
    if(yav&&yav.captureVoice)return yav.captureVoice({video});
    return navigator.mediaDevices.getUserMedia({
      audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false},
      video
    });
  }
  function watchMic(window,call) {
    // `window` here is the PM window element, so read the shared audio settings from the real global.
    const yav=globalThis.YAV;
    if(!yav||!yav.onRebuild)return;
    call.unwatchMic=yav.onRebuild(async stream=>{
      if(!active(window,call)||!stream)return;
      const audio=stream.getAudioTracks()[0];
      const video=(call.stream&&call.stream.getVideoTracks())||[];
      if(audio&&call.pc){
        const sender=call.pc.getSenders().find(item=>item.track&&item.track.kind==='audio');
        if(sender)await sender.replaceTrack(audio).catch(()=>{});
      }
      const next=new MediaStream([audio,...video].filter(Boolean));
      next._parts=stream._parts||[stream];
      call.stream=next;
      if(call.kind==='video')window.querySelector('.call video.me').srcObject=next;
    });
  }
  async function acquire(window,call) {
    try {
      const stream=await captureCallMedia(call);
      if(!active(window,call)){stream.getTracks().forEach(track=>track.stop());return null;}
      call.stream=stream;
      watchMic(window,call);
      if(call.kind==='video')window.querySelector('.call video.me').srcObject=stream;
      return stream;
    } catch(error) {
      if(active(window,call)){
        const message=error.name==='NotAllowedError'?'Allow access to your '+mediaName(call)+' to start a call.':
          'Could not start your '+mediaName(call)+'. Check the device and try again.';
        endCall(window,true,message);
      }
      return null;
    }
  }
  function connecting(window,call) {
    stopRinging(call);
    call.phase='connecting';
    show(window,'Connecting to '+call.peer+'…');
    call.timeout=setTimeout(()=>endCall(window,true,'The connection timed out. Try again.'),25000);
    call.media=acquire(window,call);
  }
  async function answer(window,accept) {
    const call=window._call;
    if(!call||call.phase!=='ringing')return;
    if(!accept){
      void send(call,'m:callans',{accept:false});
      endCall(window,false,'Call declined.');
      return;
    }
    connecting(window,call);
    const result=await send(call,'m:callans',{accept:true});
    if(active(window,call)&&result.error)endCall(window,true,result.error);
  }
  async function peerConnection(window,call) {
    const stream=await call.media;
    const config=await (call.iceConfig ||= loadIce());
    if(!stream||!active(window,call))return null;
    if(call.pc)return call.pc;
    const pc=call.pc=new RTCPeerConnection(config);
    stream.getTracks().forEach(track=>pc.addTrack(track,stream));
    call.videoSender=(typeof pc.getSenders==='function'?pc.getSenders():[]).find(item=>item.track&&item.track.kind==='video')||null;
    pc.onicecandidate=event=>{
      if(event.candidate&&active(window,call))void send(call,'m:sig',{data:{ice:event.candidate}});
    };
    pc.ontrack=event=>{
      if(!active(window,call))return;
      let player=window.querySelector('.call video.them');
      if(call.kind==='audio'&&event.track.kind==='video'){
        // their camera came on during a voice call: show it; the <audio> element keeps playing their voice
        player.muted=true;player.srcObject=new MediaStream([event.track]);player.play().catch(()=>{});
        call.theirCam=true;render(window);return;
      }
      if(call.kind==='audio'){
        if(!call.audio){call.audio=document.createElement('audio');window.append(call.audio);}
        player=call.audio;
      }
      player.srcObject=event.streams[0]||new MediaStream([event.track]);
      player.play().catch(()=>{
        if(!active(window,call))return;
        const label=window.querySelector('.call .cs');
        if(label.querySelector('.call-play'))return;
        const button=document.createElement('button');
        button.type='button';button.className='call-play';button.textContent='Play call audio';
        button.onclick=()=>player.play().then(()=>button.remove()).catch(()=>{});
        label.append(' ',button);
      });
    };
    pc.onconnectionstatechange=()=>{
      if(!active(window,call))return;
      clearTimeout(call.recovery);
      if(pc.connectionState==='connected'){
        clearTimeout(call.timeout);
        if(call.phase!=='connected'){call.phase='connected';call.connectedAt=Date.now();clearInterval(call.tick);call.tick=setInterval(()=>active(window,call)?render(window):clearInterval(call.tick),1000);}
        const label=window.querySelector('.call .cs'),play=label.querySelector('.call-play');
        show(window,'');
        if(play)label.append(' ',play);
      }else if(pc.connectionState==='failed'){
        endCall(window,true,'Could not connect. One of the networks may be blocking the call.');
      }else if(pc.connectionState==='disconnected'){
        call.recovery=setTimeout(()=>endCall(window,true,'The call connection was lost.'),8000);
      }
    };
    return pc;
  }
  async function signal(call,data) {
    const result=await send(call,'m:sig',{data});
    if(result.error)throw Error(result.error);
  }
  async function onCallAns(event) {
    const window=find(event),call=window?._call;
    if(!call||call.role!=='caller'||call.phase!=='ringing')return;
    if(!event.accept){endCall(window,false,event.from+' declined the call.');return;}
    connecting(window,call);
    try {
      const pc=await peerConnection(window,call);
      if(!pc)return;
      await pc.setLocalDescription(await pc.createOffer());
      if(active(window,call))await signal(call,{sdp:pc.localDescription});
    } catch(error){if(active(window,call))endCall(window,true,error.message||'The call could not start.');}
  }
  function onSig(event) {
    const window=find(event),call=window?._call,data=event.data;
    if(!call||!data)return;
    call.queue=call.queue.then(async()=>{
      if(!active(window,call))return;
      if(data.ice){
        if(call.pc?.remoteDescription)await call.pc.addIceCandidate(data.ice);
        else if(call.candidates.length<256)call.candidates.push(data.ice);
        return;
      }
      if(typeof data.cam==='boolean'){call.theirCam=data.cam;render(window);return;}
      if(!data.sdp||call.phase==='ringing')return;
      const pc=await peerConnection(window,call);
      if(!pc)return;
      const collision=data.sdp.type==='offer'&&(call.makingOffer||pc.signalingState!=='stable');
      if(collision&&call.role==='caller')return; // impolite side keeps its own offer; the callee rolls back
      if(collision)await pc.setLocalDescription({type:'rollback'}).catch(()=>{});
      await pc.setRemoteDescription(data.sdp);
      for(const candidate of call.candidates.splice(0))await pc.addIceCandidate(candidate);
      if(data.sdp.type==='offer'){
        await pc.setLocalDescription(await pc.createAnswer());
        if(active(window,call))await signal(call,{sdp:pc.localDescription});
      }
    }).catch(error=>{if(active(window,call))endCall(window,true,error.message||'The call could not connect.');});
  }
  // Turn my webcam on/off in a connected call (voice -> webcam upgrade and back).
  async function toggleCamera(window) {
    const call=window._call;
    if(!call||call.phase!=='connected'||call.camBusy||!call.pc)return;
    call.camBusy=true;render(window);
    try {
      const pc=call.pc;
      let sender=call.videoSender||pc.getSenders().find(item=>item.track&&item.track.kind==='video');
      if(!call.camOn){
        const yav=globalThis.YAV;
        const media=await navigator.mediaDevices.getUserMedia({video:yav&&yav.camConstraints?yav.camConstraints():{width:{ideal:640},height:{ideal:360}},audio:false});
        if(!active(window,call)){media.getTracks().forEach(track=>track.stop());return;}
        const track=media.getVideoTracks()[0];
        call.camTrack=track;
        if(sender){await sender.replaceTrack(track);}
        else{
          sender=call.videoSender=pc.addTrack(track,call.stream||media);
          call.makingOffer=true;
          try{await pc.setLocalDescription(await pc.createOffer());await signal(call,{sdp:pc.localDescription});}
          finally{call.makingOffer=false;}
        }
        call.camOn=true;
        const me=window.querySelector('.call video.me');if(me){me.srcObject=new MediaStream([track]);me.play().catch(()=>{});}
      }else{
        if(sender)await sender.replaceTrack(null).catch(()=>{});
        (call.camTrack||call.stream?.getVideoTracks()[0])?.stop();
        call.camTrack=null;call.camOn=false;
        const me=window.querySelector('.call video.me');if(me)me.srcObject=null;
      }
      await send(call,'m:sig',{data:{cam:call.camOn}});
    } catch(error) {
      if(active(window,call))notice(window,error.name==='NotAllowedError'?'Allow access to your camera to turn on your webcam.':'Could not turn on your webcam. Check the camera and try again.');
    } finally { call.camBusy=false; if(active(window,call))render(window); }
  }
  function onHang(event) {
    const window=find(event);
    if(window)endCall(window,false,event.reason==='no-answer'?'No answer. Call ended.':event.from+' ended the call.');
  }
  function disconnect() {
    for(const window of calls)endCall(window,false,'Messenger disconnected. Call ended.');
  }
  addEventListener('beforeunload',()=>{for(const window of calls)endCall(window,false,'');});
  return {startCall,onCall,onCallAns,onSig,onHang,disconnect,endCall,toggleCamera};
};
