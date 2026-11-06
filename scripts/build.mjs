import {readFile,readdir,mkdir,writeFile,rm} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg'};
const assets={};
for(const name of await readdir(resolve(root,'web'))){if(!types[extname(name)])continue;const binary=extname(name)==='.jpg';assets['/'+name]={type:types[extname(name)],content:await readFile(resolve(root,'web',name),binary?'base64':'utf8'),...(binary?{binary}: {})}}
await rm(resolve(root,'dist'),{recursive:true,force:true});
await mkdir(resolve(root,'dist/server'),{recursive:true});await mkdir(resolve(root,'dist/.openai'),{recursive:true});
await writeFile(resolve(root,'dist/server/index.js'),'const ASSETS='+JSON.stringify(assets)+';\n'+await readFile(resolve(root,'worker/index.js'),'utf8'));
await writeFile(resolve(root,'dist/.openai/hosting.json'),await readFile(resolve(root,'.openai/hosting.json'),'utf8'));
console.log('Built Worker with '+Object.keys(assets).length+' embedded assets');
