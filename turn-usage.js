'use strict';
// Free-tier guard for Cloudflare Realtime TURN: reads month-to-date TURN egress (all keys, account-wide)
// from Cloudflare's GraphQL Analytics API and reports "paused" once it reaches TURN_PAUSE_GB.
// Never logs tokens or credentials.
const GB=1e9, CHECK_EVERY=5*60e3, STALE_AFTER=60*60e3;
const QUERY='query($accountTag:String!,$start:Date!,$end:Date!){viewer{accounts(filter:{accountTag:$accountTag}){callsTurnUsageAdaptiveGroups(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{egressBytes}}}}}';
module.exports=function createTurnUsage({request=fetch,now=Date.now,env=process.env,log=console,onPause=()=>{}}={}){
  const token=env.CF_ANALYTICS_TOKEN||'';
  const accountTag=env.CF_ACCOUNT_ID||'0bdddec2cebfbf17cee619a645db5c82';
  const pauseGB=Number(env.TURN_PAUSE_GB)>0?Number(env.TURN_PAUSE_GB):900;
  const guardActive=!!token;
  let bytes=0,month='',lastOk=0,lastTry=0,pending=null,state=null,failing=false;
  const monthOf=t=>new Date(t).toISOString().slice(0,7);
  async function fetchUsage(){
    const t=now(),day=new Date(t).toISOString().slice(0,10),start=day.slice(0,8)+'01';
    const r=await request('https://api.cloudflare.com/client/v4/graphql',{method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({query:QUERY,variables:{accountTag,start,end:day}}),signal:AbortSignal.timeout(8000)});
    if(!r.ok)throw Error('analytics returned '+r.status);
    const j=await r.json();
    if(j.errors&&j.errors.length)throw Error('analytics error: '+String(j.errors[0]?.message||'unknown').slice(0,200));
    const acct=j.data?.viewer?.accounts?.[0];
    if(!acct)throw Error('analytics returned no account');
    bytes=[].concat(acct.callsTurnUsageAdaptiveGroups||[]).reduce((s,g)=>s+(Number(g?.sum?.egressBytes)||0),0);
    month=monthOf(t);lastOk=now();
    if(failing){failing=false;log.log('TURN usage check recovered');}
  }
  function refresh(){
    if(!pending){lastTry=now();pending=fetchUsage().catch(e=>{if(!failing){failing=true;log.error('TURN usage check failed:',e.message);}}).finally(()=>{pending=null;});}
    return pending;
  }
  const usedGB=()=>lastOk&&month===monthOf(now())?bytes/GB:0;
  async function isPaused(){
    if(!guardActive)return false;
    if(now()-lastTry>=CHECK_EVERY||(lastOk&&month!==monthOf(now())))await refresh();
    const stale=!lastOk||now()-lastOk>STALE_AFTER;
    const paused=stale||usedGB()>=pauseGB;
    if(paused!==state){
      const prev=state;state=paused;
      const used=usedGB().toFixed(2)+' GB used of '+pauseGB+' GB pause limit';
      if(paused){log.warn('TURN relays paused: '+(stale?'no successful usage check in the last 60 minutes ('+used+')':used));onPause();}
      else if(prev!==null)log.log('TURN relays resumed: '+used);
    }
    return paused;
  }
  async function status(){
    const paused=await isPaused();
    return {monthToDateGB:Math.round(usedGB()*1000)/1000,pauseAtGB:pauseGB,paused,guardActive,lastCheck:lastOk?new Date(lastOk).toISOString():null};
  }
  if(!guardActive)log.warn('TURN usage guard inactive: CF_ANALYTICS_TOKEN not set');
  return {guardActive,pauseGB,isPaused,status,refresh};
};
