'use strict';
module.exports=function createTurnCredentials({request=fetch,now=Date.now}={}){
  const cache=new Map();
  return async (userId,keyId,token)=>{
    const cached=cache.get(userId);
    if(cached && cached.until>now())return cached.pending;
    const pending=(async()=>{
      const response=await request('https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(keyId)+'/credentials/generate',{
        method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({ttl:14400}),signal:AbortSignal.timeout(4500)
      });
      if(!response.ok)throw Error('TURN credential endpoint returned '+response.status);
      const data=await response.json();
      const relays=[].concat(data.iceServers||[]).filter(server=>server.username&&server.credential)
        .map(server=>({username:server.username,credential:server.credential,
          urls:[].concat(server.urls||[]).filter(url=>typeof url==='string'&&/^turns?:/.test(url)&&!/:53(?:\?|$)/.test(url))}))
        .filter(server=>server.urls.length);
      if(!relays.length)throw Error('TURN credential endpoint returned no relays');
      return relays;
    })();
    cache.set(userId,{until:now()+7200000,pending});
    if(cache.size>1024)cache.delete(cache.keys().next().value);
    try{return await pending;}catch(error){if(cache.get(userId)?.pending===pending)cache.delete(userId);throw error;}
  };
};
