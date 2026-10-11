import assert from 'node:assert/strict';
import {GameWorld} from '../dist/physics.js';
import {palaceDriver} from './palace-driver.mjs';

// This is an actual-input proof. The fresh world is only observed. No fixture
// placement, invulnerability, time edits, collision changes or teleportation.
export function provePalace({stride=1,delay=0,jitter=false,seed=17}={}){
 const w=new GameWorld(2),drive=palaceDriver(),visited=new Set([0]),kinds=new Set(),stages=[];
 let input={},nextInput=0,steps=0,jumps=0,randomState=seed;
 const random=()=>{randomState=(randomState*1664525+1013904223)>>>0;return randomState/4294967296};
 for(let i=0;i<Math.round(delay*120);i++)w.step(1/120,{});
 for(;steps<120*180&&!w.complete&&!w.deaths;steps++){
  if(steps>=nextInput){input=drive(w);nextInput=steps+(jitter?2+Math.floor(random()*3):stride)}
  assert.deepEqual(Object.keys(input).sort(),['jump','x','z']);
  assert.ok([-1,0,1].includes(input.x)&&[-1,0,1].includes(input.z));
  assert.equal(w.godMode,false);assert.equal(w.usedGodMode,false);
  w.step(1/120,input);
  if(w.player.grounded&&w.player.on!==null){const a=w.platforms[w.player.on];if(!visited.has(a.id)&&[8,16,24,32,40,43].includes(a.id))stages.push({id:a.id,time:+w.time.toFixed(3)});visited.add(a.id);kinds.add(a.kind)}
  for(const event of w.drain())if(event.type==='jump')jumps++;
 }
 const result={level:w.def.name,inputHz:jitter?'30–60':120/stride,delay,inputsOnly:true,godMode:w.godMode,usedGodMode:w.usedGodMode,complete:w.complete,deaths:w.deaths,groundedExit:w.player.grounded,platforms:w.platforms.length,visited:visited.size,mechanismKinds:[...kinds].filter(x=>x!=='solid'),mechanisms:w.platforms.filter(a=>a.kind!=='solid').length,checkpointCount:w.def.checkpoints.length+1,checkpoint:w.checkpoint,simulationSeconds:+w.time.toFixed(3),attemptSeconds:+w.attemptTime.toFixed(3),lights:w.stats().lights,jumps,stages};
 assert.equal(result.complete,true,JSON.stringify(result));assert.equal(result.deaths,0);assert.equal(result.groundedExit,true);assert.equal(result.visited,44);assert.equal(result.mechanismKinds.length,7);assert.equal(result.checkpoint,0);
 return result;
}

if(process.argv[1]?.replaceAll('\\','/').endsWith('/palace-route.mjs')){
 const results=[];
 for(const stride of [1,2,4])for(const delay of [0,.3,.7,1.1,1.9,3,5.5])results.push(provePalace({stride,delay}));
 for(const delay of [.2,1.7,4.1,6.3])results.push(provePalace({delay,jitter:true}));
 console.log(JSON.stringify({runs:results.length,allComplete:results.every(r=>r.complete&&r.deaths===0),results},null,2));
}
