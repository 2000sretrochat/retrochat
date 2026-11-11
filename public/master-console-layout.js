(function(){
  const boundsKey='razzleMasterConsoleBounds';
  function saved(){try{return JSON.parse(localStorage.getItem(boundsKey))||{};}catch{return {};}}
  function options(){const b=saved(),sw=screen.availWidth||1000,sh=screen.availHeight||720,left=screen.availLeft||0,top=screen.availTop||0;
    const width=Math.min(sw,Math.max(Math.min(480,sw),Number(b.width)||1000)),height=Math.min(sh,Math.max(Math.min(360,sh),Number(b.height)||720));
    const x=Math.max(left,Math.min(left+sw-width,Number(b.x)||left)),y=Math.max(top,Math.min(top+sh-height,Number(b.y)||top));
    return {width,height,x,y};
  }
  function features(){const b=options();return 'popup=yes,width='+b.width+',height='+b.height+',left='+b.x+',top='+b.y+',resizable=yes,scrollbars=yes';}
  let namePromise;
  async function member(){return namePromise ||= fetch('/api/me',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(m=>m.m?m.name.toLowerCase():null).catch(()=>null);}
  function seenKey(name){return 'razzleReportsSeen:'+name;}
  async function markRead(reports){const name=await member();if(!name)return;try{const old=Number(localStorage.getItem(seenKey(name)))||0;localStorage.setItem(seenKey(name),String(Math.max(old,...reports.map(r=>Number(r.id)||0))));}catch{}}
  function watch(button){let timer,busy=false,stopped=false;const badge=document.createElement('small');badge.className='master-report-badge';badge.hidden=true;button.append(badge);
    async function refresh(){if(busy||stopped||!button.isConnected)return;busy=true;try{const name=await member();if(!name)return;const response=await fetch('/api/master/reports',{cache:'no-store'});if(!response.ok)return;const reports=await response.json();let seen=0;try{seen=Number(localStorage.getItem(seenKey(name)))||0;}catch{}const count=reports.filter(r=>!r.resolved&&Number(r.id)>seen).length;badge.hidden=!count;badge.textContent=count>99?'99+':String(count);button.setAttribute('aria-label',count?'Master Console, '+count+' unread reports':'Master Console');button.title=count?count+' unread reports':'Master Console (masters only)';}catch{}finally{busy=false;}}
    refresh();timer=setInterval(refresh,30000);window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh);},{once:true});
  }
  window.RazzleMasterWindow={options,features};window.RazzleMasterReports={watch,markRead};
  if(/^\/master\/?$/.test(location.pathname)&&!new URLSearchParams(location.search).has('embed')){
    const store=()=>{if(!window.outerWidth||!window.outerHeight)return;try{localStorage.setItem(boundsKey,JSON.stringify({x:window.screenX,y:window.screenY,width:window.outerWidth,height:window.outerHeight}));}catch{}};
    if(window.opener){const b=options();try{window.resizeTo(b.width,b.height);window.moveTo(b.x,b.y);}catch{}}
    let timer=setInterval(store,1000);window.addEventListener('resize',store);window.addEventListener('pagehide',()=>{store();clearInterval(timer);},{once:true});
  }
})();
