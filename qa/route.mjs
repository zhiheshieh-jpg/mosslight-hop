import {GameWorld} from '../dist/physics.js';
import {routeDriver} from './driver.mjs';
const results=[];
for(const level of [0,1])for(const delay of level?[0,.7,1.9,3.4]:[0,1.5,3,5,7.5]){
 const w=new GameWorld(level),drive=routeDriver(),checkpoints=[];
 for(let i=0;i<Math.round(delay*120);i++)w.step(1/120,{});
 for(let frame=0;frame<120*240&&!w.complete;frame++){
  w.step(1/120,drive(w));
  for(const e of w.drain())if(e.type==='checkpoint')checkpoints.push(w.checkpoint);
 }
 results.push({level,delay,complete:w.complete,time:+w.time.toFixed(2),deaths:w.deaths,lights:w.stats().lights,farthest:w.farthest,checkpoints});
}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.complete))process.exitCode=1;
