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
  const app=express(),router=express.Router(),queries=[];
  const db={q:async(sql,args)=>{
    queries.push({sql,args});
    if(sql.startsWith('select p.*'))return [{id:postId,author_id:8,wall_id:9,image:'',body:'Original'}];
    if(sql.startsWith('select c.*,p.wall_id'))return [{id:postId,author_id:8,wall_id:9}];
    if(sql.startsWith('select id,name,is_master'))return [{id:8,name:'Other',is_master:false}];
    if(sql.startsWith('select u.id,u.name,u.display_name'))return [];
    if(sql.includes('p.author_id,p.wall_id'))return [];
    if(sql.startsWith('select c.id,c.post_id'))return [];
    return [];
  }};
  router.use((req,_res,next)=>{req.socialAccount={id:4,alias:'Alice',master:req.headers['x-test-admin']==='yes'};next();});
  registerApi(router,express,db,{});
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
});
