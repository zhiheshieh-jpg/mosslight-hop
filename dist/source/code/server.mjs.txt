import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {buildWeb} from './tools/build-web.mjs';
const root=process.argv.includes('--raw')?path.resolve('dist'):buildWeb();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.zip':'application/zip','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml'};
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
 if(name.startsWith('/api/')){const upstream=http.request(new URL(name,process.env.API_ORIGIN||'http://127.0.0.1:3197'),{method:req.method,headers:{...req.headers,host:req.headers.host}},result=>{res.writeHead(result.statusCode,result.headers);result.pipe(res)});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({message:'本机账号服务尚未启动'}))});req.pipe(upstream);return}
 const file=path.resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data)})}).listen(Number(process.env.PORT)||4186,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${Number(process.env.PORT)||4186}`));
