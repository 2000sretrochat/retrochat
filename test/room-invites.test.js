const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {createRoomInvites,cleanNames,BATCHES_PER_MIN}=require('../room-invites');

test('invites expire after two minutes and only the invitee can answer',()=>{
  let t=1000;const inv=createRoomInvites({now:()=>t,uuid:()=>'id-'+t});
  const a=inv.create({from:'Alice',fromId:1,toId:2,toName:'Bob',room:'Lobby',rating:'PG-13'});
  assert.equal(a.expires,t+120e3);
  assert.deepEqual(inv.answer(3,a.id,true),{error:'This invitation has expired.'},'someone else cannot accept it');
  assert.deepEqual(inv.answer(2,a.id,true),{ok:true,room:'Lobby',from:'Alice'});
  assert.deepEqual(inv.answer(2,a.id,true),{error:'This invitation has expired.'},'one use only');
  t=5000;const b=inv.create({from:'Alice',fromId:1,toId:2,toName:'Bob',room:'Lobby'});
  t+=120e3;assert.deepEqual(inv.answer(2,b.id,true),{error:'This invitation has expired.'});
  assert.equal(inv.size(),0);
});
test('rate limits: batches per minute and a cooldown per person; masters exempt',()=>{
  let t=0;const inv=createRoomInvites({now:()=>t});
  for(let i=0;i<BATCHES_PER_MIN;i++)assert.equal(inv.takeBatch('alice'),null);
  assert.match(inv.takeBatch('alice'),/too fast/);
  assert.equal(inv.takeBatch('zainy',true),null);
  inv.create({from:'Alice',toId:2,toName:'Bob',room:'Lobby'});
  assert.equal(inv.coolingDown('alice','BOB'),true);
  t=61e3;assert.equal(inv.coolingDown('Alice','Bob'),false);assert.equal(inv.takeBatch('alice'),null);
  assert.deepEqual(cleanNames(['Bob',' bob ','',7,'Carol']),['Bob','Carol']);
});

// Real account handlers with a fake database.
const users=[{id:1,name:'Alice'},{id:2,name:'Bob'},{id:3,name:'Carol'},{id:4,name:'Dave'},{id:5,name:'Erin'},{id:6,name:'Frank'}];
const contacts=new Set(['1>2','2>1','1>3','3>1','1>4','4>1','1>5','5>1']); // Frank is not a friend
const blocks=new Set(['3>1']),ignores=new Set(['4>alice']);
const plain=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
function setup(){
  const database={status:()=>({ready:true}),async q(sql,args=[]){
    if(sql.includes('from social_restrictions'))return [];
    if(sql.startsWith('select name,status'))return users.filter(u=>u.id===args[0]).map(u=>({...u,status:'available',status_msg:'',avatar:'a1',show_room:true}));
    if(sql.startsWith('select id,name from users'))return users.filter(u=>u.name.toLowerCase()===args[0]);
    if(sql.startsWith('select 1 from contacts'))return contacts.has(args[0]+'>'+args[1])?[{}]:[];
    if(sql.startsWith('select 1 from blocks'))return blocks.has(args[0]+'>'+args[1])?[{}]:[];
    if(sql.startsWith('select 1 from ignores'))return ignores.has(args[0]+'>'+args[1])?[{}]:[];
    if(sql.startsWith('select adult'))return [{adult:true}];
    return [];
  }};
  const mod={exports:{}},sandbox={module:mod,exports:mod.exports,console,setInterval:()=>({unref(){}}),require(name){
    if(name==='./db')return database;if(name==='./emails'||name==='./geo'||name==='./mail')return {};
    if(name==='bcryptjs')return {hashSync:()=>'dummy'};if(name==='./flood')return {check:()=>null};
    if(name.startsWith('./'))return require('.'+name);return require(name);}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../accounts.js'),'utf8'),sandbox);
  const roomEvents=[];const hooks={rawRoomOf:n=>n==='Alice'?'Lobby':null,roomExists:()=>true,roomRating:()=>'PG-13',toRoomUser:(n,ev,d)=>roomEvents.push([n,ev,d])};
  let connected;mod.exports.sockets({on(e,fn){if(e==='connection')connected=fn}},hooks);
  const socket=async uid=>{const u=users.find(x=>x.id===uid),s={connected:true,handshake:{auth:{client:'messenger'}},data:{acct:{id:u.id,name:u.name}},handlers:{},events:[],
    on(e,fn){this.handlers[e]=fn},emit(...a){this.events.push(a)},disconnect(){this.connected=false;this.handlers.disconnect?.()}};await connected(s);return s};
  const send=async(s,ev,data)=>{let out;await s.handlers[ev](data,r=>{out=r});return plain(out)};
  return {socket,send,hooks,roomEvents};
}
test('inviting checked friends: only online friends get it, blocks/ignores respected, reject tells nobody',async()=>{
  const {socket,send,hooks,roomEvents}=setup();
  const s={};for(const id of [1,2,3,4,6]){s[id]=await socket(id);await send(s[id],'m:init',{offlineInbox:true});}
  // Erin (5) is a friend but offline.
  const r=plain(await hooks.inviteMany({uid:1,name:'Alice',master:false,room:'Lobby'},['Bob','Carol','Dave','Erin','Frank','bob']));
  assert.deepEqual(r.sent,['Bob']);
  assert.deepEqual(r.failed.map(f=>f.name),['Carol','Dave','Erin','Frank']);
  assert.match(r.failed.find(f=>f.name==='Frank').error,/friends list/);
  const invite=s[2].events.find(e=>e[0]==='m:invite')?.[1];
  assert.equal(invite.from,'Alice');assert.equal(invite.room,'Lobby');assert.ok(invite.id);assert.equal(invite.ttl,120e3);
  assert.ok(roomEvents.some(([n,ev])=>n==='Bob'&&ev==='room-invite'),'browser chat room gets it too');
  for(const id of [3,4,6])assert.ok(!s[id].events.some(e=>e[0]==='m:invite'));
  const aliceBefore=s[1].events.length,roomBefore=roomEvents.filter(e=>e[0]==='Alice').length;
  assert.deepEqual(await send(s[2],'m:invite-decline',{id:invite.id}),{ok:true});
  assert.equal(s[1].events.length,aliceBefore,'the inviter is not told about a rejection');
  assert.equal(roomEvents.filter(e=>e[0]==='Alice').length,roomBefore);
  assert.ok(s[2].events.some(e=>e[0]==='m:invite-gone'),'other windows of the invitee drop the popup');
  assert.match((await send(s[2],'m:invite-accept',{id:invite.id})).error,/expired/,'a rejected invite cannot be accepted later');
});
test('accepting returns the room; repeat invites to the same person are throttled',async()=>{
  const {socket,send,hooks}=setup();const a=await socket(1),b=await socket(2);await send(a,'m:init',{});await send(b,'m:init',{});
  const from={uid:1,name:'Alice',master:false,room:'Lobby'};
  assert.deepEqual(plain(await hooks.inviteMany(from,['Bob'])).sent,['Bob']);
  const id=b.events.find(e=>e[0]==='m:invite')[1].id;
  assert.deepEqual(await send(b,'m:invite-accept',{id}),{ok:true,room:'Lobby',from:'Alice'});
  assert.match((await hooks.inviteMany(from,['Bob'])).error,/already invited/);
  assert.match((await hooks.inviteMany(from,[])).error,/Check at least one/);
  assert.match((await hooks.inviteMany({...from,name:'Bob',uid:2,room:null},['Alice'])).error,/Join a chat room first/,'must be in a room');
});
