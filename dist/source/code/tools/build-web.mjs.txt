import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function buildWeb(){
 const source=path.join(project,'dist'),out=path.resolve(project,'.web');
 // This is the one generated build directory, never a caller-supplied path.
 if(out!==path.join(project,'.web')||!out.startsWith(project+path.sep))throw Error('Invalid build destination');
 fs.rmSync(out,{recursive:true,force:true});
 fs.cpSync(path.join(source,'2d'),out,{recursive:true});
 fs.mkdirSync(path.join(out,'3d'));
 for(const name of fs.readdirSync(source))if(!['2d','source'].includes(name))fs.cpSync(path.join(source,name),path.join(out,'3d',name),{recursive:true});
 for(const [file,before,after] of [
  ['index.html','<a href="../">前往3D</a>','<a href="./3d/">前往3D</a>'],
  ['game.js',"from '../music.js'","from './3d/music.js'"],
  ['3d/index.html','href="./2d/">前往2D</a>','href="../">前往2D</a>'],
  ['index.html','data-api="../api/"','data-api="./api/"'],
  ['3d/index.html','data-api="./api/"','data-api="../api/"']
 ]){const f=path.join(out,file),text=fs.readFileSync(f,'utf8');if(text.split(before).length!==2)throw Error('Missing unique mode link: '+file);fs.writeFileSync(f,text.replace(before,after))}
 const files=[];
 function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())walk(f);else{const data=fs.readFileSync(f);files.push({path:path.relative(out,f).split(path.sep).join('/'),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')})}}}
 walk(out);files.sort((a,b)=>a.path.localeCompare(b.path));
 const version=JSON.parse(fs.readFileSync(path.join(project,'package.json'),'utf8')).version;
 fs.writeFileSync(path.join(out,'release-manifest.json'),JSON.stringify({version,defaultMode:'2d',files},null,2));
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('Built 2D-first application: '+buildWeb());
