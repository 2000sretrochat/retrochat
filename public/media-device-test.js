window.RazzleMediaTest={mount(w){
  const q=s=>w.querySelector(s);let camera=null,mic=null,context=null,animation=0,camPending=false,micPending=false,disposed=false;
  const alive=()=>!disposed&&w.isConnected&&!w.ownerDocument.defaultView?.closed;
  const status=q('[data-device-test-status]'),video=q('[data-camera-preview]'),meter=q('[data-mic-level]'),camButton=q('[data-test-camera]'),micButton=q('[data-test-mic]');
  function stopCamera(){camera?.getTracks().forEach(t=>t.stop());camera=null;video.srcObject=null;video.hidden=true;camButton.textContent='Test webcam';camButton.setAttribute('aria-pressed','false');}
  function stopMic(){mic?.getTracks().forEach(t=>t.stop());mic=null;cancelAnimationFrame(animation);context?.close().catch(()=>{});context=null;meter.value=0;micButton.textContent='Test microphone';micButton.setAttribute('aria-pressed','false');}
  function close(){if(disposed)return;disposed=true;stopCamera();stopMic();clearInterval(lifecycle);window.removeEventListener('pagehide',close);}
  function error(e){status.textContent=e?.name==='NotAllowedError'?'Permission was denied. Allow access in your browser or system settings and try again.':e?.name==='NotFoundError'?'No matching device was found. Connect your webcam or microphone and try again.':'Could not start that device. Check whether another app is using it.';}
  camButton.onclick=async()=>{if(camPending)return;if(camera){stopCamera();status.textContent='Webcam test stopped.';return;}camPending=true;camButton.disabled=true;status.textContent='Requesting webcam access…';try{
    const quality=q('#mavCam').value;const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:quality==='hd'?1280:quality==='low'?320:640},height:{ideal:quality==='hd'?720:quality==='low'?240:480},frameRate:{ideal:15,max:24}}});
    if(!alive()){stream.getTracks().forEach(t=>t.stop());return;}camera=stream;video.srcObject=stream;video.hidden=false;video.play().catch(()=>{});camButton.textContent='Stop webcam';camButton.setAttribute('aria-pressed','true');status.textContent='Webcam preview · visible only to you.';w.ownerDocument.defaultView.addEventListener('pagehide',close,{once:true});
  }catch(e){if(alive())error(e);}finally{camPending=false;camButton.disabled=false;}};
  micButton.onclick=async()=>{if(micPending)return;if(mic){stopMic();status.textContent='Microphone test stopped.';return;}micPending=true;micButton.disabled=true;status.textContent='Requesting microphone access…';try{
    const dev=q('#mavDev').value,music=q('#mavMode').value==='music';const stream=await navigator.mediaDevices.getUserMedia({video:false,audio:{...(dev?{deviceId:{exact:dev}}:{}),echoCancellation:!music,noiseSuppression:!music,autoGainControl:!music&&q('#mavAgc').checked}});
    if(!alive()){stream.getTracks().forEach(t=>t.stop());return;}mic=stream;context=new AudioContext();await context.resume();const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);const samples=new Uint8Array(analyser.fftSize);
    const tick=()=>{if(!mic||!alive()){stopMic();return;}analyser.getByteTimeDomainData(samples);let peak=0;for(const n of samples)peak=Math.max(peak,Math.abs(n-128)/128);meter.value=Math.min(100,peak*100*(Number(q('#mavBoost').value)/100));animation=requestAnimationFrame(tick);};tick();micButton.textContent='Stop microphone';micButton.setAttribute('aria-pressed','true');status.textContent='Speak to check the level. Your microphone is not broadcast or played through your speakers.';w.ownerDocument.defaultView.addEventListener('pagehide',close,{once:true});
  }catch(e){stopMic();if(alive())error(e);}finally{micPending=false;micButton.disabled=false;}};
  for(const id of ['#mavDev','#mavMode','#mavAgc'])q(id).addEventListener('change',()=>{stopMic();status.textContent='Click Test microphone to check the new setting.';});
  q('#mavCam').addEventListener('change',()=>{stopCamera();status.textContent='Click Test webcam to check the new quality.';});
  const lifecycle=setInterval(()=>{if(!alive())close();},500);window.addEventListener('pagehide',close,{once:true});return close;
}};
