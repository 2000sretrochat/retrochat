const {io}=require('socket.io-client');const U=process.argv[2];
const a=io(U,{transports:['websocket']}),b=io(U,{transports:['websocket']});
b.on('msg',m=>console.log('B got:',JSON.stringify(m)));
a.emit('login',{name:'Alice',room:'Arizona'},r=>{console.log('A',r.ok);
 b.emit('login',{name:'alice',room:'Arizona'},r=>{console.log('dup:',r.error);
  b.emit('login',{name:'Bob',room:'Arizona'},r=>{console.log('B',r.ok);
   a.emit('say',{text:'hi <b>x</b> :)',color:'#ff0000',b:true});setTimeout(()=>process.exit(),2000)})})});
