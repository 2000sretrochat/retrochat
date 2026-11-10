const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../public/messenger-calls.js'),'utf8');

function setup(){
  const timers=new Map(),sounds=[],sent=[],notices=[];
  let mediaRequests=0,sequence=0;
  const label={textContent:'',querySelector:()=>null};
  const panel={querySelector:()=>label,querySelectorAll:()=>[],classList:{toggle(){}}};
  const chat={querySelector:()=>panel,querySelectorAll:()=>[]};
  class PeerConnection{
    constructor(){this.candidates=[];}
    addTrack(){}
    async createOffer(){return {type:'offer'};}
    async setLocalDescription(description){this.localDescription=description;}
    async setRemoteDescription(description){this.remoteDescription=description;}
    async addIceCandidate(candidate){
      assert.ok(this.remoteDescription,'ICE needs a remote description');
      this.candidates.push(candidate);
    }
    close(){}
  }
  const schedule=(callback,ms)=>{const id=++sequence;timers.set(id,{callback,ms});return id;};
  const context={
    window:{},addEventListener(){},AbortSignal,crypto:require('node:crypto'),
    fetch:async()=>({ok:true,json:async()=>({iceServers:[]})}),
    setTimeout:schedule,setInterval:schedule,clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),
    navigator:{mediaDevices:{getUserMedia:async()=>{mediaRequests++;return {getTracks:()=>[]};}}},
    RTCPeerConnection:PeerConnection
  };
  vm.runInNewContext(script,context);
  const connection={connected:true,timeout(){return this;},emit(event,data,done){sent.push({event,data});done(null,{ok:true});}};
  const calls=context.window.createMessengerCalls({
    socket:()=>connection,contact:()=>({online:true}),openIm:()=>chat,findIm:()=>chat,
    notice:(_window,message)=>notices.push(message),toast(){},sound:kind=>sounds.push(kind)
  });
  return {calls,chat,label,timers,sounds,sent,notices,mediaRequests:()=>mediaRequests};
}

test('ringing waits for the answer and retains early ICE until SDP arrives',async()=>{
  const {calls,chat,label,timers,sounds,mediaRequests}=setup();
  await calls.startCall(chat,'BigTony','audio');
  const call=chat._call;
  assert.match(label.textContent,/Ringing BigTony/);
  assert.equal(mediaRequests(),0);
  assert.ok([...timers.values()].some(timer=>timer.ms===30000));
  assert.deepEqual(sounds,['ring']);
  calls.onSig({from:'BigTony',callId:call.id,data:{ice:{candidate:'early'}}});
  await call.queue;
  await calls.onCallAns({from:'BigTony',callId:call.id,accept:true});
  assert.equal(mediaRequests(),1);
  assert.ok(![...timers.values()].some(timer=>timer.ms===2400||timer.ms===30000));
  calls.onSig({from:'BigTony',callId:call.id,data:{sdp:{type:'answer'}}});
  await call.queue;
  assert.equal(call.pc.candidates[0].candidate,'early');
  calls.endCall(chat,false,'');
});

test('unanswered webcam calls ring again, hang up and release the call window',async()=>{
  const {calls,chat,timers,sounds,sent,notices}=setup();
  await calls.startCall(chat,'BigTony','video');
  [...timers.values()].find(timer=>timer.ms===2400).callback();
  [...timers.values()].find(timer=>timer.ms===30000).callback();
  assert.deepEqual(sounds,['ring','ring','hangup']);
  assert.equal(sent.at(-1).event,'m:hang');
  assert.equal(sent.at(-1).data.reason,'no-answer');
  assert.match(notices.at(-1),/No answer/);
  assert.equal(chat._call,null);
  assert.equal(timers.size,0);
});
