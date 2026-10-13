import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP,intersects} from '../dist/2d/world.js';
import {skyDriver} from './sky-driver.mjs';

const approach=(w,c,offset=-55)=>Object.assign(w.player,{x:c.x+offset,y:c.y-w.player.h,vx:0,vy:0,grounded:true,on:c.platformId});
const pickup=(w,c)=>{approach(w,c);w.interact();Object.assign(w.player,{x:w.powerup.x,y:c.y-w.player.h});w.step(STEP);assert.equal(w.attackBoost,true)};

test('each chapter has boxes on real platforms and exactly one randomly selected reward',()=>{
 for(let level=0;level<4;level++)for(let run=0;run<8;run++){
  const w=new PixelWorld(level);assert.ok(w.chests.length>=3);assert.equal(w.chests.filter(c=>c.reward).length,1);
  assert.equal(w.rewardChestId,w.chests.find(c=>c.reward).id);
  for(const c of w.chests){const a=w.platforms.find(a=>a.id===c.platformId);assert.ok(a);assert.ok(c.x>=a.x&&c.x+24<=a.x+a.w);assert.equal(c.y,a.y);assert.equal(c.opened,false);assert.equal(c.collected,false);if(level>=2){assert.equal(a.kind,'ground');assert.ok(!w.hazards.some(h=>h.section===a.section));assert.ok(!w.enemies.some(e=>e.home.section===a.section))}}
 }
});

test('opening an empty chest emits the required message once and requires proximity',()=>{
 const w=new PixelWorld(),c=w.chests.find(c=>!c.reward);assert.equal(w.interact(),null);approach(w,c);assert.equal(w.interact(),c);assert.equal(w.interact(),null);assert.equal(w.powerup,null);
 const opened=w.drain().filter(e=>e.type==='chestOpened');assert.equal(opened.length,1);assert.equal(opened[0].empty,true);assert.equal(opened[0].message,'好像只是一个空箱子...');
});

test('interaction uses a press edge and a reward can be dropped and collected only once',()=>{
 const w=new PixelWorld(),c=w.chests.find(c=>c.reward);approach(w,c);w.step(STEP,{interact:true});assert.equal(c.opened,true);assert.ok(w.powerup);assert.equal(w.attackBoost,false);
 const item={...w.powerup};w.step(STEP,{interact:true});assert.deepEqual(w.powerup,item);assert.equal(w.drain().filter(e=>e.type==='chestOpened').length,1);
 Object.assign(w.player,{x:item.x,y:c.y-w.player.h});w.step(STEP);assert.equal(c.collected,true);assert.equal(w.powerup,null);assert.equal(w.attackMultiplier,2);assert.equal(w.drain().filter(e=>e.type==='attackBuff').length,1);w.interact();w.step(STEP);assert.equal(w.powerup,null);
});

test('reward doubles ordinary slash and reflected projectile damage',()=>{
 for(const boost of [false,true])for(const kind of ['slash','reflected']){
  const w=new PixelWorld(),c=w.chests.find(c=>c.reward);if(boost)pickup(w,c);
  const e=w.enemies.find(e=>e.type==='brute');Object.assign(w.player,{x:e.x-48,y:e.home.y-42,vx:0,vy:0,grounded:true,on:e.home.id,attack:0,attackCooldown:0,attackStage:0,chainWindow:0});w.hitstop=0;
  if(kind==='slash'){for(let n=0;n<8;n++)w.step(STEP,{attack:true});assert.equal(e.hp,e.maxHp-(boost?2:1))}
  else{w.projectiles.push({x:e.x+4,y:e.y+3,w:12,h:12,vx:0,vy:0,life:2,owner:'player'});w.step(STEP);assert.equal(e.hp,e.maxHp-(boost?4:2))}
 }
});

test('death removes the buff without reopening boxes or rolling another reward, including palace restart',()=>{
 for(let level=0;level<4;level++){
  const w=new PixelWorld(level),c=w.chests.find(c=>c.reward),id=c.id;pickup(w,c);w.respawn();assert.equal(w.attackBoost,false);assert.equal(w.attackMultiplier,1);assert.equal(w.rewardChestId,id);
  const same=w.chests.find(c=>c.id===id);assert.equal(same.opened,true);assert.equal(same.collected,true);assert.equal(w.powerup,null);approach(w,same);assert.equal(w.interact(),null);
 }
});

test('uncollected reward remains a single drop after a death and moving chests follow their platforms',()=>{
 for(let level=0;level<4;level++){
  const w=new PixelWorld(level),c=w.chests.find(c=>c.reward);approach(w,c);w.interact();const id=c.id;w.respawn();assert.equal(w.powerup.chestId,id);assert.equal(w.chests.find(c=>c.id===id).opened,true);assert.equal(w.chests.filter(c=>c.reward).length,1);
 }
 const w=new PixelWorld(1),c=w.chests.find(c=>w.platforms.find(a=>a.id===c.platformId).kind==='moving');assert.ok(c);const before=c.y;w.step(STEP);assert.notEqual(c.y,before);assert.equal(c.y,w.platforms.find(a=>a.id===c.platformId).y);
});

test('ordinary and god kills never restore HP, including every boss; checkpoints still do',()=>{
 for(let level=0;level<4;level++)for(const god of [false,true]){
  const w=new PixelWorld(level);if(god)w.setGodMode(true);w.player.hp=2;
  for(const e of w.enemies){w.player.attackId++;w.hitEnemy(e,e.hp,2);assert.equal(w.player.hp,2)}assert.ok(!w.drain().some(e=>e.type==='heal'));
  if(w.level.checkpoints.length>1){const c=w.level.checkpoints[1];Object.assign(w.player,{x:c.x,y:c.y-w.player.h,vx:0,vy:0});w.hitstop=0;w.step(STEP);assert.equal(w.player.hp,w.player.maxHp)}
 }
});

test('collecting powerup requires actual contact',()=>{
 const w=new PixelWorld(),c=w.chests.find(c=>c.reward);approach(w,c);w.interact();assert.equal(intersects(w.player,w.powerup),false);assert.equal(w.collectPowerup(),false);assert.equal(w.attackBoost,false);
});

test('restarting rerolls the unique reward while respawning does not draw randomness',()=>{
 const original=Math.random;let draws=0;
 try{Math.random=()=>++draws===1?.01:.99;const w=new PixelWorld(2),first=w.rewardChestId;assert.equal(draws,1);w.respawn();assert.equal(draws,1);assert.equal(w.rewardChestId,first);w.reset(2);assert.equal(draws,2);assert.notEqual(w.rewardChestId,first)}finally{Math.random=original}
});

test('saved chest drops, active buff, full combat state and god audit restore without changing the reward',()=>{
 for(let level=0;level<4;level++)for(const collected of [false,true]){
  const w=new PixelWorld(level),c=w.chests.find(c=>c.reward);approach(w,c);w.interact();if(collected){Object.assign(w.player,{x:w.powerup.x,y:c.y-w.player.h});w.step(STEP)}
  w.setGodMode(true);w.setCharacter('logo');w.setGodMode(false);w.player.hp=3;w.player.attackId=21;w.hitEnemy(w.enemies[0],1,1);w.time=13.25;w.realTime=15.5;w.collected.add(2);
  const record=w.exportState(),restored=new PixelWorld((level+1)%4);assert.equal(restored.importState(record),true);assert.deepEqual(restored.exportState(),record);assert.equal(restored.usedGodMode,true);assert.equal(restored.usedLogo,true);assert.equal(restored.attackBoost,collected);
  restored.respawn();assert.equal(restored.attackBoost,false);assert.equal(restored.rewardChestId,c.id);assert.equal(restored.chests[c.id].opened,true);assert.equal(restored.chests[c.id].collected,collected);
 }
});

test('both hard routes complete with real digital inputs for every possible reward chest and no kill healing',()=>{
 for(const level of [2,3])for(let reward=0;reward<4;reward++){
  const original=Math.random;let w;try{Math.random=()=>(reward+.25)/4;w=new PixelWorld(level)}finally{Math.random=original}
  assert.equal(w.rewardChestId,reward);const drive=skyDriver();let hp=w.player.hp;
  for(let n=0;n<120*420&&!w.complete&&!w.deaths;n++){
   const input=drive(w);assert.ok([-1,0,1].includes(input.x));w.step(STEP,input);const events=w.drain();
   if(w.player.hp>hp)assert.ok(events.some(e=>e.type==='checkpoint'),'only a checkpoint may restore HP');hp=w.player.hp;
   assert.equal(w.godMode,false);assert.equal(w.usedGodMode,false);assert.ok(!events.some(e=>e.type==='heal'));
  }
  assert.equal(w.complete,true,`chapter ${level+1}, reward ${reward}`);assert.equal(w.deaths,0);assert.equal(w.enemies.at(-1).dead,true);assert.equal(w.player.grounded,true);assert.equal(w.chests[reward].collected,true);
 }
});
