const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMusicLobby}=require('../music-lobby');
test('house DJs pause for real speakers, resume and rotate tracks',async t=>{
  t.mock.method(Date,'now',()=>now);
  let now=1000, occupied=true, humanTurn=false;
  const playlist=[{id:'one',title:'One',artist:'',duration:120},{id:'two',title:'Two',artist:'',duration:120}], states=[];
  const db={status:()=>({ready:true}),q:async(_sql,[previous])=>[playlist[previous==='one'?1:0]]};
  const lobby=createMusicLobby({db,occupied:()=>occupied,humanTurn:()=>humanTurn,emit:state=>states.push(state)});
  await lobby.tick();assert.equal(lobby.state().id,'one');
  now=3000;humanTurn=true;await lobby.tick();assert.equal(lobby.state().pausedAt,3000);
  now=9000;humanTurn=false;await lobby.tick();assert.equal(lobby.state().startedAt,7000);
  now=127000;await lobby.tick();assert.equal(lobby.state().id,'two');
  assert.notEqual(states[0].dj,lobby.state().dj);
  occupied=false;await lobby.tick();assert.equal(lobby.state().pausedAt,now);
  assert.match((await lobby.add({title:'Bad file',duration:12,audio:Buffer.from('fake')})).error,/MP3/);
});
