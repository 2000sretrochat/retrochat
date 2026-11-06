import http from 'node:http';
import worker from '../dist/server/index.js';
const server=http.createServer(async(req,res)=>{try{const result=await worker.fetch(new Request('http://localhost'+req.url,{method:req.method}));res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}});
server.listen(Number(process.env.PORT||4173),'0.0.0.0');
