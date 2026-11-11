const test=require('node:test'),assert=require('node:assert/strict');
const {deviceKind,presenceDevice}=require('../messenger-sessions');
const socket=(agent,device)=>({connected:true,handshake:{headers:{'user-agent':agent},auth:{device}},data:{mess:true}});
test('mobile and browser markers stay hidden for desktop, invisible and offline members',()=>{
  const phone=socket('Mozilla iPhone Mobile'),browser=socket('Mozilla Windows Chrome'),desktop=socket('Mozilla Electron/39');
  assert.equal(deviceKind(phone),'mobile');assert.equal(deviceKind(browser),'browser');assert.equal(deviceKind(desktop),'desktop');
  assert.equal(deviceKind(socket('Macintosh','mobile')),'mobile');
  assert.equal(presenceDevice([phone]),'mobile');assert.equal(presenceDevice([browser]),'browser');
  assert.equal(presenceDevice([phone,browser,desktop]),null);assert.equal(presenceDevice([phone],false),null);assert.equal(presenceDevice([]),null);
  phone.connected=false;assert.equal(presenceDevice([phone,browser]),'browser');
});
test('guest sockets receive explicit refusals and cannot initialize contacts or send requests',async()=>{
  const handlers={};let connect;
  const io={on:(event,fn)=>{if(event==='connection')connect=fn;},sockets:{sockets:new Map()}};
  require('../accounts').sockets(io,{});
  await connect({data:{},on:(event,fn)=>{handlers[event]=fn;}});
  for(const event of ['m:init','m:contacts','m:add','m:respond']){
    let response;handlers[event]({name:'RegisteredMember'},r=>response=r);assert.match(response.error,/Guests cannot add friends/);
  }
});
