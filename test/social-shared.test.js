const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const express=require('express');
const {registerApi,settingsPatch}=require('../social-next/api');

test('Social settings accept supported fields and reject unsafe images and links',()=>{
  assert.deepEqual(settingsPatch({headline:' Hello ',is_master:true,visibility:'private'}),{headline:'Hello',visibility:'private'});
  assert.throws(()=>settingsPatch({portrait:'javascript:alert(1)'}),/smaller/);
  assert.throws(()=>settingsPatch({musicService:{brand:'spotify',url:'javascript:alert(1)'}}),/http/);
  assert.deepEqual(settingsPatch({details:{orientation:'',zodiac:'Aries',is_master:true}}),{details:{orientation:'',zodiac:'Aries',enabled:false}});
});

test('Social API enforces content ownership, admin permissions, and same-origin writes',async t=>{
  const postId='d503a3f4-4b9e-4f31-951e-05881c2a4720';
  const app=express(),router=express.Router(),queries=[],contactUpdates=[];
  const db={q:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.startsWith('select id,name,avatar,status,status_msg'))return [{id:22,name:'BotPal',avatar:'a1',bot:true}];
    if(sql.startsWith('select p.*'))return [{id:postId,author_id:8,wall_id:9,image:'',body:'Original'}];
    if(sql.startsWith('select c.*,p.wall_id'))return [{id:postId,author_id:8,wall_id:9}];
    if(sql.startsWith('select id,name,is_master'))return [{id:8,name:'Other',is_master:false}];
    if(sql.startsWith('select u.id,u.name,u.display_name'))return [];
    if(sql.includes('p.author_id,p.wall_id'))return [];
    if(sql.startsWith('select c.id,c.post_id'))return [];
    return [];
  }};
  router.use((req,_res,next)=>{req.socialAccount={id:4,alias:'Alice',master:req.headers['x-test-admin']==='yes'};next();});
  registerApi(router,express,db,{contactsChanged:(...ids)=>contactUpdates.push(ids)});
  app.use('/social-next',router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const base='http://127.0.0.1:'+server.address().port+'/social-next/api';
  const request=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  assert.equal((await request('/admin')).status,403);
  assert.equal((await request('/admin','POST',{action:'deactivate',userId:8})).status,403);
  assert.equal((await request('/posts/'+postId,'DELETE',{})).status,403);
  assert.equal((await request('/comments/'+postId,'DELETE',{})).status,403);
  assert.equal((await request('/settings','PATCH',{headline:'Test'},{origin:'https://other.example'})).status,403);
  assert.equal((await request('/posts/'+postId,'DELETE',{}, {'x-test-admin':'yes'})).status,200);
  assert.ok(queries.some(({sql,args})=>sql.startsWith('update social_posts set removed') && args[0]===postId));
  assert.equal((await request('/admin','POST',{action:'restrict',userId:8,service:'social',reason:'test'}, {'x-test-admin':'yes'})).status,200);
  assert.ok(queries.some(({sql,args})=>sql.startsWith('insert into social_restrictions') && args[1]==='social' && args[3]===4));
  const post=await request('/posts','POST',{body:'Link',link:'javascript:alert(1)'});
  assert.equal(post.status,400);
  assert.equal((await request('/friends/BotPal','POST',{action:'decline'})).status,200);
  assert.deepEqual(contactUpdates.splice(0),[[4]]);
  assert.equal((await request('/friends/BotPal','POST',{action:'request'})).status,200);
  assert.ok(queries.some(({sql,args})=>sql.startsWith('insert into contacts(owner,contact) values($1,$2),($2,$1)') && args[0]===4 && args[1]===22));
});

test('Social bot introductions use stable IDs and never overwrite member aliases',async()=>{
  const {seedSocialBots}=require('../social-next/bots'),queries=[];
  const database={q:async(sql,args=[])=>{
    queries.push({sql,args});
    if(sql.startsWith('select user_id from social_bot_members') && args[0]==='sk8rboi_1987')return [{user_id:22}];
    return [];
  }};
  await seedSocialBots(database);await seedSocialBots(database);
  const posts=queries.filter(q=>q.sql.includes('insert into social_posts'));
  assert.equal(posts.length,2);assert.equal(posts[0].args[0],posts[1].args[0]);
  assert.match(posts[0].args[0],/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.ok(!queries.some(q=>q.sql.includes('update users')));
  assert.ok(queries.filter(q=>q.sql.includes('insert into users')).every(q=>q.sql.includes('on conflict(name_lc) do nothing')));
});

test('chat bots and Social profiles share stable aliases, and quiet visitors have blank profiles',async()=>{
  const {BOTS,PROFILE_SEEDS}=require('../bots');
  assert.equal(new Set(BOTS.map(bot=>bot.name.toLowerCase())).size,BOTS.length);
  assert.deepEqual(BOTS.map(bot=>bot.id),PROFILE_SEEDS.map(seed=>seed.id));
  // Seeds are keyed by id (not position): the preview profiles stay together and in order after the Springfield characters.
  const ids=PROFILE_SEEDS.map(seed=>seed.id),at=ids.indexOf('preview-nightowl');
  assert.deepEqual(ids.slice(at,at+3),['preview-nightowl','preview-retrofan','preview-mialuvs']);
  assert.deepEqual(ids.slice(at-3,at),['bart-simpson','sideshow-bob','ralph-wiggum']);
  assert.ok(PROFILE_SEEDS.filter(seed=>seed.id.startsWith('preview-')||['bart-simpson','sideshow-bob','ralph-wiggum'].includes(seed.id)).every(seed=>seed.display_name&&seed.bio&&!seed.silent));
  const visitor=BOTS.find(bot=>bot.silent),queries=[];
  const {seedSocialBots}=require('../social-next/bots');
  await seedSocialBots({q:async(sql,args=[])=>{
    queries.push({sql,args});
    return sql.startsWith('select user_id from social_bot_members') && args[0]===visitor.id ? [{user_id:22}] : [];
  }});
  const row=queries.find(q=>q.args[7]===visitor.id);
  assert.equal(visitor.av,'');
  assert.deepEqual(row.args.slice(4,7),['','','']);
  assert.ok(!queries.some(q=>q.sql.includes('insert into social_posts') || q.sql.includes('insert into social_settings')));
});

test('bot chat is master-only and audits the real operator before sending',async t=>{
  const app=express(),router=express.Router(),audit=[],sent=[];
  const db={q:async(sql,args=[])=>{
    if(sql.startsWith('select b.bot_id'))return [{bot_id:'preview-nightowl'}];
    if(sql.startsWith('select 1 from social_bot_members'))return args[0]==='preview-nightowl'?[{}]:[];
    if(sql.startsWith('insert into master_audit'))audit.push(args);
    return [];
  }};
  router.use((req,_res,next)=>{req.socialAccount={id:4,alias:'Operator',master:req.headers['x-test-admin']==='yes'};next();});
  registerApi(router,express,db,{},null,{rooms:()=>['Lobby'],say:(room,bot,message)=>sent.push([room,bot.name,message])});
  app.use(router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/admin/bot-chat';
  const request=(body,admin=true)=>fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','x-test-admin':admin?'yes':'no'},body:body?JSON.stringify(body):undefined});
  const message={botId:'preview-nightowl',room:'Lobby',message:'  Hello there  '};
  assert.equal((await request(null,false)).status,403);
  assert.equal((await request(message,false)).status,403);
  assert.deepEqual(await (await request()).json(),{bots:[{id:'preview-nightowl',name:'NightOwl'}],rooms:['Lobby']});
  assert.equal((await request({...message,room:'Unknown'})).status,400);
  assert.equal((await request({...message,botId:'preview-retrofan'})).status,404);
  assert.equal((await request(message)).status,200);
  assert.deepEqual(audit,[['Operator','bot-chat','NightOwl','Lobby']]);
  assert.deepEqual(sent,[['Lobby','NightOwl','Hello there']]);
});

test('visible future room events support idempotent RSVP and undo',async t=>{
  const id='d503a3f4-4b9e-4f31-951e-05881c2a4720', app=express(),router=express.Router(),people=new Set();
  const db={q:async(sql,args=[])=>{
    if(sql.startsWith('select p.*'))return [{id, event_at:new Date(Date.now()+3600000)}];
    if(sql.startsWith('insert into social_event_rsvps'))people.add(args[1]);
    if(sql.startsWith('delete from social_event_rsvps'))people.delete(args[1]);
    if(sql.startsWith('select count(*)'))return [{attendees:people.size}];
    return [];
  }};
  router.use((req,_res,next)=>{req.socialAccount={id:4,alias:'Member',master:false};next();});
  registerApi(router,express,db,{},null,{rooms:()=>['Music Lobby']});
  app.use(router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port+'/api/events/';
  assert.deepEqual(await (await fetch(url+'rooms')).json(),['Music Lobby']);
  const rsvp=going=>fetch(url+id+'/rsvp',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({going})}).then(r=>r.json());
  assert.deepEqual(await rsvp(true),{attending:true,attendees:1});
  assert.deepEqual(await rsvp(true),{attending:true,attendees:1});
  assert.deepEqual(await rsvp(false),{attending:false,attendees:0});
});
