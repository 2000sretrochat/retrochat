'use strict';
function bindRoomMusic(socket,panel){
  const text=panel.querySelector('[data-now-playing]'),button=panel.querySelector('[data-listen]');
  const audio=new Audio();audio.preload='none';
  let room='',track=null,listen=false,trackId=null;
  function sync(){
    panel.hidden=room!=='Music Lobby';
    text.textContent=track?(track.pausedAt?'DJ paused for the mic · ':'Now playing · ')+track.title+
      (track.artist?' by '+track.artist:'')+' · '+track.dj+' · Next DJ: '+track.nextDj:'Waiting for a track';
    button.disabled=!track&&!listen;
    button.textContent=listen?'Mute music':'Listen';
    if(panel.hidden || !listen || !track || track.pausedAt){audio.pause();return;}
    if(trackId!==track.id){trackId=track.id;audio.src='/api/room-music/'+encodeURIComponent(track.id);}
    const elapsed=Math.min(track.duration-0.1,Math.max(0,(Date.now()-track.startedAt)/1000));
    if(audio.readyState>0 && Math.abs(audio.currentTime-elapsed)>2)audio.currentTime=Math.max(0,elapsed);
    audio.play().catch(()=>{if(!audio.error)return;listen=false;trackId=null;button.textContent='Retry music';});
  }
  audio.addEventListener('loadedmetadata',sync);
  button.onclick=()=>{listen=!listen;sync();};
  socket.on('music:state',value=>{if(room==='Music Lobby'){track=value;sync();}});
  socket.on('disconnect',()=>{track=null;sync();});
  return name=>{
    room=name;track=null;sync();
    if(room==='Music Lobby')socket.emit('music:state',value=>{if(room===name){track=value;sync();}});
  };
}
