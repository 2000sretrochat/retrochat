'use strict';
function bindRoomMusic(socket,panel){
  const text=panel.querySelector('[data-now-playing]'),button=panel.querySelector('[data-listen]');
  // Short status line next to Listen ("why is nothing playing?"); plain text, existing panel styles.
  const note=document.createElement('span');note.setAttribute('data-music-note','');note.setAttribute('role','status');
  note.style.cssText='margin-left:8px;font-size:12px;opacity:.8';panel.appendChild(note);
  const WHY={off:'House DJs are switched off in this room right now.',
    empty:'No tracks have been added to the House DJ library yet.',
    multi:'House DJs only play when the room is set to a single mic.',
    mic:'House DJs are waiting while someone has the mic or a hand is raised. Music starts again after.',
    starting:'The next track is about to start. Listen is on.',
    blocked:'Your browser blocked the sound. Click Listen again to start the music.'};
  const audio=new Audio();audio.preload='none';
  let room='',track=null,listen=false,trackId=null;
  const say=k=>{note.textContent=k?WHY[k]||'':'';};
  function sync(){
    // House DJs are on hold (members share their own music now); set window.RZ_HOUSE_DJS=true to bring the panel back.
    panel.hidden=!(window.RZ_HOUSE_DJS&&room==='Music Lobby');
    text.textContent=track?(track.pausedAt?'DJ paused for the mic · ':'Now playing · ')+track.title+
      (track.artist?' by '+track.artist:'')+' · '+track.dj+' · Next DJ: '+track.nextDj:'Waiting for a track';
    if(track&&[WHY.empty,WHY.off,WHY.multi,WHY.starting].includes(note.textContent))say(''); // a track showed up
    button.disabled=false; // used to be disabled with no track, so clicking Listen did nothing at all
    button.textContent=listen?'Mute music':'Listen';
    if(panel.hidden || !listen || !track || track.pausedAt){audio.pause();return;}
    if(note.textContent!==WHY.blocked)say('');
    if(trackId!==track.id){trackId=track.id;audio.src='/api/room-music/'+encodeURIComponent(track.id);}
    const elapsed=Math.min(track.duration-0.1,Math.max(0,(Date.now()-track.startedAt)/1000));
    if(audio.readyState>0 && Math.abs(audio.currentTime-elapsed)>2)audio.currentTime=Math.max(0,elapsed);
    audio.play().then(()=>{if(note.textContent===WHY.blocked)say('');}).catch(e=>{
      if(audio.error){listen=false;trackId=null;button.textContent='Retry music';return;}
      if(e&&e.name==='NotAllowedError'){listen=false;button.textContent='Listen';say('blocked');}
    });
  }
  audio.addEventListener('loadedmetadata',sync);
  button.onclick=()=>{
    if(listen){listen=false;say('');sync();return;}
    listen=true;sync();
    // Nothing audible right now: ask the server why and say so. Listen stays on, so music starts when a track does.
    if(!track||track.pausedAt)socket.emit('music:why',r=>{
      if(!listen)return;const k=r&&r.reason;
      if(k==='off'||k==='empty'||k==='multi'){listen=false;sync();}
      if(k&&k!=='playing')say(k);
    });
  };
  socket.on('music:state',value=>{if(room==='Music Lobby'){track=value;sync();}});
  socket.on('disconnect',()=>{track=null;sync();});
  return name=>{
    room=name;track=null;say('');sync();
    if(room==='Music Lobby')socket.emit('music:state',value=>{if(room===name){track=value;sync();}});
  };
}
