const {test}=require('node:test');
const assert=require('node:assert/strict');
const {once}=require('node:events');
const express=require('express');
const {registerApi,settingsPatch}=require('../social-next/api');
const interests=require('../public/profile-interests');

test('interests support chat topics and two-word custom interests without vulgar wording',()=>{
  assert.ok(interests.choices.length>=70);
  assert.equal(interests.clean('karaoke, Bird Watching, Karaoke'),'Karaoke, Bird Watching');
  for(const value of ['one two three','sex','s.e.x','porn','fück','sex toys','123'])assert.throws(()=>interests.clean(value));
  assert.equal(interests.clean('Classical Music, Astronomy'),'Classical Music, Astronomy');
  assert.throws(()=>interests.clean(Array(31).fill('Music')),/30/);
});
test('social links restrict host, credentials and protocol and allow clearing',()=>{
  assert.equal(settingsPatch({socialLinks:{'youtube.com':'youtube.com/@razzle'}}).socialLinks['youtube.com'],'https://youtube.com/@razzle');
  assert.deepEqual(settingsPatch({socialLinks:{}}),{socialLinks:{}});
  for(const value of ['https://youtube.com.evil.test/@x','https://youtube.com@evil.test/x','javascript:alert(1)','https://instagram.com/name','https://youtube.com:8080/name'])assert.throws(()=>settingsPatch({socialLinks:{'youtube.com':value}}));
});
test('Messenger gallery saves preserve the Social default and require public new photos',async t=>{
  const id='d503a3f4-4b9e-4f31-951e-05881c2a4720',old='data:image/png;base64,YWJj',image='data:image/png;base64,ZGVm';
  const previous={portrait:'/av/Alice?v=old',galleryAvatarUrl:'/av/Alice?v=old',galleryAvatar:'old',galleryDefault:id,profileGallery:[{id,mode:'private',image:old}],galleryRevision:'r1'};
  const writes=[];const db={q:async(sql,args)=>{
    if(sql==='select value from social_settings where user_id=$1')return [{value:previous}];
    if(sql.startsWith('with saved as')){writes.push({value:JSON.parse(args[1]),snapshot:args[9],bytes:args[8],sql});return [{user_id:4}];}
    return [];
  }};
  const app=express(),router=express.Router();router.use((req,res,next)=>{req.socialAccount={id:4,alias:'Alice',master:false};next();});registerApi(router,express,db,{});app.use(router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const send=body=>fetch('http://127.0.0.1:'+server.address().port+'/api/profile-gallery',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await send({photos:[{id,mode:'private',image}],defaultId:id,revision:'r1'})).status,400);
  assert.equal((await send({photos:[{id,mode:'public',image}],defaultId:id,revision:'r1',publishAll:true})).status,200);
  assert.equal(writes[0].snapshot,old);
  assert.equal(writes[0].value.portrait,undefined);
  assert.match(writes[0].sql,/social_settings.value->>'portrait'=social_settings.value->>'galleryAvatarUrl'/);
  assert.notEqual(writes[0].value.galleryAvatarUrl,previous.galleryAvatarUrl);
  assert.equal(writes[0].value.profileGallery[0].mode,'public');
  const icon='data:image/jpeg;base64,aWNs';
  assert.equal((await send({photos:[{id,mode:'public',image,icon}],defaultId:id,revision:'r1',publishAll:true})).status,200);
  assert.equal(writes[1].value.profileGallery[0].image,image);
  assert.equal(writes[1].value.profileGallery[0].icon,icon);
  assert.equal(writes[1].bytes.toString(),'icl');
  assert.equal((await send({photos:[{id,mode:'public',image,icon:'data:image/jpeg;base64,'+'A'.repeat(100001)}],defaultId:id,revision:'r1'})).status,400);
  assert.equal((await send({photos:[],defaultId:'',revision:'stale'})).status,409);
});
test('pinning is limited to the author on their own profile',async t=>{
  const id='d503a3f4-4b9e-4f31-951e-05881c2a4720';let wall=5;const writes=[];
  const db={q:async(sql,args)=>{if(sql.startsWith('select p.*'))return [{id,author_id:4,wall_id:wall}];writes.push({sql,args});return [];}};
  const app=express(),router=express.Router();router.use((req,res,next)=>{req.socialAccount={id:4,alias:'Alice',master:true};next();});registerApi(router,express,db,{});app.use(router);
  const server=app.listen(0,'127.0.0.1');t.after(()=>server.close());await once(server,'listening');
  const send=()=>fetch('http://127.0.0.1:'+server.address().port+'/api/posts/'+id+'/pin',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({pinned:true})});
  assert.equal((await send()).status,403);wall=4;assert.equal((await send()).status,200);
  assert.ok(writes.some(x=>x.sql.startsWith('update social_posts set pinned')&&x.args[1]===true));
});
