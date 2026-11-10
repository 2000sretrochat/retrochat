const {test}=require('node:test');
const assert=require('node:assert/strict');
const createTurnUsage=require('../turn-usage');
const quiet={log(){},warn(){},error(){}};
const T0=Date.UTC(2026,10,9,12,0,0);
const reply=bytesList=>async()=>({ok:true,json:async()=>({data:{viewer:{accounts:[{callsTurnUsageAdaptiveGroups:bytesList.map(b=>({sum:{egressBytes:b}}))}]}}})});
test('under the threshold TURN keeps issuing, summing every key account-wide',async()=>{
  let calls=0,seen;
  const u=createTurnUsage({env:{CF_ANALYTICS_TOKEN:'analytics'},now:()=>T0,log:quiet,request:async(url,opt)=>{calls++;seen={url,opt};return reply([100e9,250e9])();}});
  assert.equal(await u.isPaused(),false);
  assert.equal(seen.url,'https://api.cloudflare.com/client/v4/graphql');
  assert.equal(seen.opt.headers.Authorization,'Bearer analytics');
  const body=JSON.parse(seen.opt.body);
  assert.deepEqual(body.variables,{accountTag:'0bdddec2cebfbf17cee619a645db5c82',start:'2026-11-01',end:'2026-11-09'});
  assert.match(body.query,/callsTurnUsageAdaptiveGroups\(limit:10000/);
  const s=await u.status();
  assert.deepEqual(s,{monthToDateGB:350,pauseAtGB:900,paused:false,guardActive:true,lastCheck:new Date(T0).toISOString()});
  assert.equal(calls,1,'checks at most every 5 minutes');
});
test('at or over the threshold pauses and clears cached credentials',async()=>{
  let cleared=0;const logs=[];
  const u=createTurnUsage({env:{CF_ANALYTICS_TOKEN:'x',TURN_PAUSE_GB:'500',CF_ACCOUNT_ID:'acct'},now:()=>T0,onPause:()=>cleared++,
    log:{log:m=>logs.push(m),warn:m=>logs.push(m),error(){}},request:reply([300e9,200e9])});
  assert.equal(await u.isPaused(),true);
  assert.equal(await u.isPaused(),true);
  assert.equal(cleared,1);
  assert.equal(logs.filter(m=>/paused/.test(m)).length,1,'logs state changes only');
});
test('a stale usage check fails safe to paused, and resumes when checks succeed again',async()=>{
  let clock=T0,fail=false;const logs=[];
  const u=createTurnUsage({env:{CF_ANALYTICS_TOKEN:'x'},now:()=>clock,log:{log:m=>logs.push(m),warn:m=>logs.push(m),error(){}},
    request:async()=>{if(fail)return {ok:false,status:503};return reply([1e9])();}});
  assert.equal(await u.isPaused(),false);
  fail=true;
  clock+=30*60e3;assert.equal(await u.isPaused(),false,'one recent success is still trusted');
  clock+=31*60e3;assert.equal(await u.isPaused(),true,'no success in 60 minutes pauses');
  fail=false;clock+=5*60e3;assert.equal(await u.isPaused(),false);
  assert.ok(logs.some(m=>/resumed/.test(m)));
});
test('a never-successful check is paused',async()=>{
  const u=createTurnUsage({env:{CF_ANALYTICS_TOKEN:'x'},now:()=>T0,log:quiet,request:async()=>{throw Error('timeout');}});
  assert.equal(await u.isPaused(),true);
});
test('missing analytics token leaves the guard inactive with one startup warning',async()=>{
  const warns=[];let calls=0;
  const u=createTurnUsage({env:{},log:{log(){},warn:m=>warns.push(m),error(){}},request:async()=>{calls++;}});
  assert.deepEqual(warns,['TURN usage guard inactive: CF_ANALYTICS_TOKEN not set']);
  assert.equal(await u.isPaused(),false);
  assert.equal((await u.status()).guardActive,false);
  assert.equal(calls,0);
});
test('month rollover resets usage and resumes',async()=>{
  let clock=Date.UTC(2026,10,30,23,59),bytes=950e9;
  const u=createTurnUsage({env:{CF_ANALYTICS_TOKEN:'x'},now:()=>clock,log:quiet,request:async(u,o)=>reply([bytes])()});
  assert.equal(await u.isPaused(),true);
  clock=Date.UTC(2026,11,1,0,1);bytes=0;
  assert.equal(await u.isPaused(),false);
});
