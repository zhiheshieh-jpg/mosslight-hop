import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {PixelWorld,STEP} from '../dist/2d/world.js';
import {skyDriver} from './sky-driver.mjs';

// Fresh world, unmodified production stats. This observer sends only real inputs.
export function labRoute(stride=1){
 assert.ok(Number.isInteger(stride)&&stride>=1&&stride<=4);
 const w=new PixelWorld(3),drive=skyDriver(),patterns=new Set,sections=new Set,bridges=new Set,checkpoints=new Set([0]);
 const interact=w.interact.bind(w);w.interact=()=>interact(()=>.5); // Fixed empty rolls prove the route needs no rare buff.
 const inputs={jumps:0,dashes:0,slashes:0};let input={},minHp=6,parries=0;
 for(let n=0;n<120*420&&!w.complete&&!w.deaths;n++){
  if(n%stride===0)input=drive(w);
  assert.deepEqual(Object.keys(input).sort(),['attack','dash','interact','jump','x']);
  w.step(STEP,input);minHp=Math.min(minHp,w.player.hp);
  const on=w.platforms.find(a=>a.id===w.player.on);if(on?.kind==='crumble')bridges.add(on.id);
  const section=w.level.ground.find(a=>w.player.x>=a.x&&w.player.x<a.x+a.w)?.section;if(section!==undefined)sections.add(section);
  for(const e of w.drain()){
   if(e.type==='warning'&&e.pattern)patterns.add(e.pattern);if(e.type==='checkpoint')checkpoints.add(e.id);
   if(e.type==='parry')parries++;if(e.type==='jump')inputs.jumps++;if(e.type==='dash')inputs.dashes++;if(e.type==='swing')inputs.slashes++;
  }
 }
 const result={level:w.level.name,inputHz:120/stride,inputsOnly:true,characterId:w.characterId,godMode:w.godMode,usedGodMode:w.usedGodMode,usedLogo:w.usedLogo,complete:w.complete,deaths:w.deaths,groundedExit:w.player.grounded,length:w.level.length,groundSections:w.level.ground.length,sectionsVisited:sections.size,checkpointCount:w.level.checkpoints.length,checkpointsUsed:[...checkpoints],hazards:w.hazards.length,crumbleBridgesUsed:bridges.size,enemies:w.enemies.length,kills:w.kills,bossMaxHp:w.enemies.at(-1).maxHp,bossHp:w.enemies.at(-1).hp,bossPatterns:[...patterns],simulationSeconds:+w.time.toFixed(3),elapsedSeconds:+w.realTime.toFixed(3),minHp,finalHp:w.player.hp,inputs,parries};
 assert.equal(result.complete,true);assert.equal(result.deaths,0);assert.equal(result.godMode,false);assert.equal(result.usedGodMode,false);assert.equal(result.usedLogo,false);assert.equal(result.groundedExit,true);assert.equal(result.sectionsVisited,48);assert.equal(result.crumbleBridgesUsed,5);assert.equal(result.checkpointsUsed.length,5);assert.equal(result.bossHp,0);assert.equal(result.bossPatterns.length,4);
 return result;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const stride=Number(process.argv.find(a=>a.startsWith('--stride='))?.split('=')[1]||1);
 console.log(JSON.stringify(labRoute(stride),null,2));
}
