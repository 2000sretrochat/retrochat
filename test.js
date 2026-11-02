// Smoke test: node test.js [url]  (default: spawns nothing; pass a running server URL, e.g. http://localhost:3000)
const {io}=require('socket.io-client');const U=process.argv[2]||'http://localhost:3000';let fail=0;const ok=(c,m)=>{console.log(c?'  ✓':'  ✗',m);if(!c)fail++};
const a=io(U,{transports:['websocket']}),b=io(U,{transports:['websocket']});const sfx=Date.now()%100000;
b.on('msg',m=>{if(m.name){ok(m.text.includes('&lt;b&gt;'),'HTML escaped: '+m.text);ok(m.b===true&&m.color=='#ff0000','formatting kept');setTimeout(()=>{console.log(fail?'FAIL':'PASS');process.exit(fail?1:0)},200)}});
a.emit('login',{name:'Alice'+sfx,room:'Lobby'},r=>{ok(r.ok,'A login');
 b.emit('login',{name:'alice'+sfx,room:'Lobby'},r=>{ok(!!r.error,'duplicate name rejected (case-insensitive)');
  b.emit('login',{name:'Bob'+sfx,room:'Lobby'},r=>{ok(r.ok,'B login');a.emit('say',{text:'hi <b>x</b> :)',color:'#ff0000',b:true})})})});
setTimeout(()=>{console.log('FAIL timeout');process.exit(1)},8000);
