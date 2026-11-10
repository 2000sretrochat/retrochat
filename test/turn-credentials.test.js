
const {test}=require('node:test');
const assert=require('node:assert/strict');
const createTurnCredentials=require('../turn-credentials');
test('TURN credentials are scoped to a member, cached, and browser-safe',async()=>{
  let requests=0,clock=1000;
  const load=createTurnCredentials({now:()=>clock,request:async(url,options)=>{
    requests++;
    assert.match(url,/\/key-id\/credentials\/generate-ice-servers$/);
    assert.equal(JSON.parse(options.body).ttl,3600);
    return {ok:true,json:async()=>({iceServers:[
      {urls:['stun:stun.cloudflare.com:3478']},
      {urls:['turn:turn.cloudflare.com:53?transport=udp','turns:turn.cloudflare.com:443?transport=tcp'],username:'short-lived',credential:'temporary'}
    ]})};
  }});
  const [first,second]=await Promise.all([load(1,'key-id','private'),load(1,'key-id','private')]);
  assert.deepEqual(first,second);
  assert.equal(requests,1);
  assert.deepEqual(first,[{urls:['turns:turn.cloudflare.com:443?transport=tcp'],username:'short-lived',credential:'temporary'}]);
  await load(2,'key-id','private');assert.equal(requests,2);
  clock+=1800001;await load(1,'key-id','private');assert.equal(requests,3);
});
test('failed credential requests can be retried',async()=>{
  let attempts=0;
  const load=createTurnCredentials({request:async()=>({ok:false,status:++attempts===1?401:503})});
  await assert.rejects(load(1,'key','private'),/401/);
  await assert.rejects(load(1,'key','private'),/503/);
});

