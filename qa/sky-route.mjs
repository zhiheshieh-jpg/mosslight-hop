import assert from 'node:assert/strict';
import {PixelWorld,STEP} from '../dist/2d/world.js';
import {skyDriver} from './sky-driver.mjs';
// No fixture edits: the pilot observes a fresh world and sends only actual inputs.
const stride=Number(process.argv.find(a=>a.startsWith('--stride='))?.split('=')[1]||1);
assert.ok(Number.isInteger(stride)&&stride>=1&&stride<=4);
const w=new PixelWorld(2),drive=skyDriver(),patterns=new Set(),stages=[],sections=new Set(),bridges=new Set();
const inputs={jumps:0,dashes:0,slashes:0},hurts=[];let input={},steps=0,minHp=6,parries=0;
for(;steps<120*360&&!w.complete&&!w.deaths;steps++){
 if(steps%stride===0)input=drive(w);
 assert.deepEqual(Object.keys(input).sort(),['attack','dash','interact','jump','x']);
 w.step(STEP,input);minHp=Math.min(minHp,w.player.hp);
 const platform=w.platforms.find(a=>a.id===w.player.on);
 if(platform?.kind==='crumble')bridges.add(platform.id);
 const section=w.level.ground.find(a=>w.player.x>=a.x&&w.player.x<a.x+a.w)?.section;
 if(section!==undefined)sections.add(section);
 if([0,10,21,31,41].includes(section)&&!stages.some(a=>a.section===section))stages.push({section,time:+w.time.toFixed(2)});
 for(const e of w.drain()){
  if(e.type==='hurt')hurts.push({x:Math.round(e.x),hp:w.player.hp,time:+w.time.toFixed(2)});
  if(e.type==='warning'&&e.pattern)patterns.add(e.pattern);
  if(e.type==='parry')parries++;
  if(e.type==='jump')inputs.jumps++;if(e.type==='dash')inputs.dashes++;if(e.type==='swing')inputs.slashes++;
 }
}
const result={level:w.level.name,inputHz:120/stride,inputsOnly:true,godMode:w.godMode,usedGodMode:w.usedGodMode,complete:w.complete,deaths:w.deaths,groundedExit:w.player.grounded,length:w.level.length,groundSections:w.level.ground.length,sectionsVisited:sections.size,checkpointCount:w.level.checkpoints.length,checkpoint:w.checkpoint,hazards:w.hazards.length,crumbleBridgesUsed:bridges.size,enemies:w.enemies.length,kills:w.kills,bossMaxHp:w.enemies.at(-1).maxHp,bossHp:w.enemies.at(-1).hp,bossPatterns:[...patterns],simulationSeconds:+w.time.toFixed(3),elapsedSeconds:+w.realTime.toFixed(3),minHp,finalHp:w.player.hp,inputs,parries,stages,hurts};
console.log(JSON.stringify(result,null,2));
assert.equal(result.complete,true);assert.equal(result.deaths,0);assert.equal(result.godMode,false);assert.equal(result.usedGodMode,false);assert.equal(result.groundedExit,true);assert.equal(result.sectionsVisited,42);assert.equal(result.crumbleBridgesUsed,4);assert.equal(result.bossHp,0);assert.equal(result.bossPatterns.length,3);
