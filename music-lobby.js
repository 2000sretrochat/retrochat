'use strict';
const {randomUUID}=require('node:crypto');
const room='Music Lobby';
const djs=['mel_mixtapes','punkrawk_kid','emo_kid_4ever'];
function createMusicLobby({db,occupied,humanTurn,emit}) {
  let current=null, previous=null, djIndex=0, ticking=false;
  const state=()=>current && {id:current.id,title:current.title,artist:current.artist,duration:current.duration,
    dj:current.dj,nextDj:djs[djIndex%djs.length],startedAt:current.startedAt,pausedAt:current.pausedAt};
  async function tick(){
    if(ticking || !db.status().ready)return;
    ticking=true;
    try {
      const now=Date.now();
      if(!occupied() || humanTurn()){
        if(current && !current.pausedAt){current.pausedAt=now;emit(state());}
        return;
      }
      if(current?.pausedAt){current.startedAt+=now-current.pausedAt;current.pausedAt=null;emit(state());}
      if(current && now-current.startedAt<current.duration*1000)return;
      const [track]=await db.q(`select id,title,artist,duration from room_music_tracks
        order by case when slot>coalesce((select slot from room_music_tracks where id=$1),0) then 0 else 1 end, slot limit 1`,[previous]);
      if(!track){if(current){current=null;emit(null);}return;}
      previous=track.id;
      current={...track,dj:djs[djIndex++%djs.length],startedAt:Date.now(),pausedAt:null};
      emit(state());
    }catch(error){console.error('[music lobby]',error.message);}
    finally{ticking=false;}
  }
  const list=()=>db.q('select id,title,artist,duration from room_music_tracks order by slot');
  async function add({title,artist,duration,audio}){
    const valid=Buffer.isBuffer(audio)&&audio.length>=4&&
      (audio.toString('ascii',0,3)==='ID3'||(audio[0]===255&&(audio[1]&224)===224));
    if(!valid || audio.length>8388608 || !title || !Number.isFinite(duration) || duration<=0 || duration>600)return {error:'Choose a valid MP3 up to 10 minutes long.'};
    const [row]=await db.q(`insert into room_music_tracks(id,slot,title,artist,duration,audio)
      select $1,slot,$2,$3,$4,$5 from generate_series(1,12) as slots(slot)
      where not exists(select 1 from room_music_tracks t where t.slot=slots.slot) order by slot limit 1
      on conflict do nothing returning id`,[randomUUID(),title,artist,duration,audio]);
    if(!row)return {error:'The library is full or another upload just finished. Refresh and try again.'};
    void tick();return row;
  }
  async function remove(id){
    const rows=await db.q('delete from room_music_tracks where id=$1 returning id',[id]);
    if(current?.id===id){current=null;emit(null);}
    return rows.length>0;
  }
  async function audio(req,res){
    if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(req.params.id)||!db.status().ready)return res.sendStatus(404);
    const [row]=await db.q('select audio from room_music_tracks where id=$1',[req.params.id]);
    if(!row)return res.sendStatus(404);
    const bytes=row.audio,size=bytes.length;
    res.set({'Content-Type':'audio/mpeg','Accept-Ranges':'bytes','Cache-Control':'no-store'});
    if(!req.headers.range)return res.send(bytes);
    const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    const start=range?.[1]?Number(range[1]):Math.max(0,size-Number(range?.[2]));
    const end=range?.[1]&&range[2]?Math.min(size-1,Number(range[2])):size-1;
    if(!range || start>end || !Number.isSafeInteger(start))return res.status(416).set('Content-Range','bytes */'+size).end();
    return res.status(206).set('Content-Range','bytes '+start+'-'+end+'/'+size).send(bytes.subarray(start,end+1));
  }
  return {room,state,tick,list,add,remove,audio};
}
module.exports={createMusicLobby,room};
