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
  function show(window,message,buttons=false) {
    const panel=window.querySelector('.call'), label=panel.querySelector('.cs');
    panel.classList.toggle('on',Boolean(window._call));
    panel.querySelectorAll('video').forEach(video=>video.style.display=window._call?.kind==='video'?'':'none');
    label.textContent=message;
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
    clearTimeout(call.recovery);
    if(notify)void send(call,'m:hang',{reason});
    call.unwatchMic?.();
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
    const call={peer,kind,role,id,phase:'ringing',candidates:[],queue:Promise.resolve()};
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
    if(!window.YAV||!window.YAV.onRebuild)return;
    call.unwatchMic=window.YAV.onRebuild(async stream=>{
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
    pc.onicecandidate=event=>{
      if(event.candidate&&active(window,call))void send(call,'m:sig',{data:{ice:event.candidate}});
    };
    pc.ontrack=event=>{
      if(!active(window,call))return;
      let player=window.querySelector('.call video.them');
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
        call.phase='connected';
        const label=window.querySelector('.call .cs'),play=label.querySelector('.call-play');
        show(window,'In a '+(call.kind==='video'?'webcam':'voice')+' call with '+call.peer);
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
      if(!data.sdp||call.phase==='ringing')return;
      const pc=await peerConnection(window,call);
      if(!pc)return;
      await pc.setRemoteDescription(data.sdp);
      for(const candidate of call.candidates.splice(0))await pc.addIceCandidate(candidate);
      if(data.sdp.type==='offer'){
        await pc.setLocalDescription(await pc.createAnswer());
        if(active(window,call))await signal(call,{sdp:pc.localDescription});
      }
    }).catch(error=>{if(active(window,call))endCall(window,true,error.message||'The call could not connect.');});
  }
  function onHang(event) {
    const window=find(event);
    if(window)endCall(window,false,event.reason==='no-answer'?'No answer. Call ended.':event.from+' ended the call.');
  }
  function disconnect() {
    for(const window of calls)endCall(window,false,'Messenger disconnected. Call ended.');
  }
  addEventListener('beforeunload',()=>{for(const window of calls)endCall(window,false,'');});
  return {startCall,onCall,onCallAns,onSig,onHang,disconnect,endCall};
};
