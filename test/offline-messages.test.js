const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const express=require('express');
const {createOfflineMessages,PER_SENDER_UNREAD}=require('../offline-messages');
const {registerApi}=require('../social-next/api');

// Minimal fake of the tables offline messages touch.
function fakeDb({users=[],blocks=[],ignores=[],contacts=[],restricted=[]}={}){
  const offline=[];let seq=0;
  const q=async(sql,args)=>{
    if(sql.startsWith('select id,name,pm_buddies from users'))return users.filter(u=>u.name.toLowerCase()===args[0]&&!u.banned).map(({id,name,pm_buddies})=>({id,name,pm_buddies:!!pm_buddies}));
    if(sql.startsWith('select\n        exists(select 1 from blocks')){const [from,to,nameLc]=args;return [{
      blocked:blocks.some(([o,b])=>(o===from&&b===to)||(o===to&&b===from)),
      ignored:ignores.some(([o,n])=>o===to&&n===nameLc),
      contact:contacts.some(([o,c])=>o===to&&c===from),
      restricted:restricted.includes(from)}];}
    if(sql.startsWith('select count(*) filter')){const [to,from]=args;const unread=offline.filter(o=>o.to_id===to&&!o.read_at);return [{mine:unread.filter(o=>o.from_id===from).length,total:unread.length}];}
    if(sql.startsWith('insert into offline')){const row={id:++seq,to_id:args[0],from_id:args[1],body:args[2],created:Date.now(),read_at:null};offline.push(row);return [{id:row.id,t:row.created}];}
    if(sql.startsWith('select o.id,u.name,o.body,o.read_at')){const [uid,all]=args;return offline.filter(o=>o.to_id===uid&&(all||!o.read_at)&&!blocks.some(([ow,b])=>ow===uid&&b===o.from_id))
      .map(o=>({id:o.id,name:users.find(u=>u.id===o.from_id).name,body:o.body,read_at:o.read_at,t:o.created,contact:contacts.some(([ow,c])=>ow===uid&&c===o.from_id)}));}
    if(sql.startsWith('select count(*)::int as n from offline'))return [{n:offline.filter(o=>o.to_id===args[0]&&!o.read_at).length}];
    if(sql.startsWith('update offline set read_at'))return offline.filter(o=>o.to_id===args[0]&&args[1].includes(o.id)).map(o=>{o.read_at=o.read_at||new Date();return {id:o.id};});
    if(sql.startsWith('delete from offline')){const gone=offline.filter(o=>o.to_id===args[0]&&args[1].includes(o.id));for(const g of gone)offline.splice(offline.indexOf(g),1);return gone.map(o=>({id:o.id}));}
    throw new Error('unexpected query: '+sql.slice(0,60));
  };
  return {q,offline};
}
const people=[{id:1,name:'Alice'},{id:2,name:'Bob'},{id:3,name:'Carol',pm_buddies:true},{id:4,name:'Dave'}];
const alice={id:1,name:'Alice',master:false};

test('stores a message for an offline person whose settings allow it, and delivers it on sign-in',async()=>{
  const db=fakeDb({users:people}),events=[];
  const box=createOfflineMessages({db,isOnline:()=>false,toUser:(...a)=>events.push(a),uuid:()=>'00000000-0000-4000-8000-000000000001'});
  const sent=await box.send(alice,'bob','  Hi <b>Bob</b>  ');
  assert.equal(sent.ok,true);assert.equal(sent.offline,true);assert.equal(sent.to,'Bob');
  assert.equal(db.offline[0].body.text,'Hi &lt;b&gt;Bob&lt;/b&gt;','text is escaped before storage');
  const list=await box.list(2);
  assert.equal(list.length,1);assert.equal(list[0].from,'Alice');assert.equal(list[0].read,false);assert.equal(list[0].contact,false);
  assert.equal(await box.unreadCount(2),1);
  assert.equal((await box.list(1)).length,0,'only the recipient sees it');
});

test('respects blocks, ignores, Only-friends-can-PM-me, and Messenger restrictions',async()=>{
  const db=fakeDb({users:people,blocks:[[2,1]],ignores:[[4,'alice']],contacts:[],restricted:[]});
  const box=createOfflineMessages({db});
  assert.match((await box.send(alice,'bob','hi')).error,/isn't accepting/,'blocked by recipient');
  assert.match((await box.send(alice,'dave','hi')).error,/isn't accepting/,'ignored by recipient');
  assert.match((await box.send(alice,'carol','hi')).error,/isn't accepting/,'Carol only takes PMs from friends');
  assert.match((await box.send(alice,'nobody','hi')).error,/No Razzle account/);
  assert.match((await box.send(alice,'alice','hi')).error,/yourself/);
  assert.match((await box.send(alice,'bob','   ')).error,/Type a message/);
  assert.equal(db.offline.length,0);
  const friends=createOfflineMessages({db:fakeDb({users:people,contacts:[[3,1]]})});
  assert.equal((await friends.send(alice,'carol','hi friend')).ok,true,'a friend may message Carol');
  const restricted=createOfflineMessages({db:fakeDb({users:people,restricted:[1]})});
  assert.match((await restricted.send(alice,'bob','hi')).error,/restricted/);
  const master=createOfflineMessages({db:fakeDb({users:people,blocks:[[2,1]]})});
  assert.equal((await master.send({...alice,master:true},'bob','site notice')).ok,true,'masters are not blocked');
});

test('refuses when the person is online and caps unread messages per sender',async()=>{
  const db=fakeDb({users:people});
  const online=createOfflineMessages({db,isOnline:n=>n==='Bob'});
  const r=await online.send(alice,'bob','hi');assert.equal(r.online,true);assert.match(r.error,/online now/);
  const box=createOfflineMessages({db});
  for(let i=0;i<PER_SENDER_UNREAD;i++)assert.equal((await box.send(alice,'bob','m'+i)).ok,true);
  assert.match((await box.send(alice,'bob','one more')).error,/Wait until they read/);
});

test('mark read keeps the message for later, dismiss removes it, and both notify Messenger windows',async()=>{
  const db=fakeDb({users:people}),events=[];const box=createOfflineMessages({db,toUser:(...a)=>events.push(a)});
  const a=await box.send(alice,'bob','one'),b=await box.send(alice,'bob','two');
  assert.deepEqual((await box.markRead(2,[a.offlineId,'x',-1])).ids,[a.offlineId]);
  assert.deepEqual((await box.list(2)).map(m=>m.offlineId),[b.offlineId],'read messages leave the unread list');
  assert.deepEqual((await box.list(2,{includeRead:true})).map(m=>m.offlineId),[a.offlineId,b.offlineId]);
  assert.deepEqual((await box.markRead(1,[b.offlineId])).ids,[],'cannot touch someone else\'s messages');
  assert.deepEqual((await box.dismiss(2,[b.offlineId])).ids,[b.offlineId]);
  assert.equal(db.offline.length,1);
  assert.deepEqual(events,[[2,'m:offline-read',[a.offlineId]],[2,'m:offline-read',[b.offlineId]]]);
});

test('Social API: offline message routes, notifications include them, and requesting someone who asked you makes it mutual',async t=>{
  const db=fakeDb({users:people});const base=db.q,queries=[],changed=[];
  db.q=async(sql,args)=>{queries.push(sql);
    if(sql.startsWith('select id,name,avatar,status,status_msg'))return [{id:2,name:'Bob',bot:false}];
    if(sql.startsWith('select 1 from blocks'))return [];
    if(sql.startsWith('with pending as (delete from requests where from_id=$2'))return [{owner:1},{owner:2}];
    if(sql.startsWith('select n.id,n.kind')||sql.startsWith('select u.id,u.name,coalesce'))return [];
    if(sql.startsWith('delete from requests'))return [];
    return base(sql,args);};
  const app=express(),router=express.Router();
  router.use((req,_res,next)=>{req.socialAccount={id:Number(req.headers['x-user']||1),alias:req.headers['x-alias']||'Alice',master:false};next();});
  registerApi(router,express,db,{contactsChanged:(...ids)=>changed.push(ids),isOnline:()=>false,toUser(){}});
  app.use('/social-next',router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/social-next/api';
  const call=(path,method='GET',body,headers={})=>fetch(url+path,{method,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const sent=await call('/offline-messages','POST',{to:'Bob',text:'see you later'});
  assert.equal(sent.status,201);
  assert.equal((await call('/offline-messages','POST',{to:'Bob',text:'x'},{origin:'https://evil.example'})).status,403,'same-origin writes only');
  const bob={'x-user':'2','x-alias':'Bob'};
  const inbox=await (await call('/offline-messages','GET',undefined,bob)).json();
  assert.equal(inbox.unread,1);assert.equal(inbox.messages[0].text,'see you later');
  const notes=await (await call('/notifications','GET',undefined,bob)).json();
  assert.equal(notes.offlineMessages.length,1,'shows as a Social notification');
  assert.deepEqual((await (await call('/offline-messages/read','POST',{ids:[inbox.messages[0].offlineId]},bob)).json()).ids,[inbox.messages[0].offlineId]);
  assert.equal((await (await call('/offline-messages','GET',undefined,bob)).json()).unread,0);
  assert.deepEqual((await (await call('/offline-messages/dismiss','POST',{ids:[inbox.messages[0].offlineId]},bob)).json()).ids,[inbox.messages[0].offlineId]);
  const add=await (await call('/friends/bob','POST',{action:'request'})).json();
  assert.deepEqual(add,{ok:true,accepted:true},'Bob had already asked Alice, so both are now friends');
  assert.deepEqual(changed.at(-1),[1,2]);
  assert.ok(!queries.some(sql=>sql.startsWith('insert into requests')),'no new one-way request is left behind');
});
