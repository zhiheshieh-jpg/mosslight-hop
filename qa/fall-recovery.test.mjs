import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP,hazardState,intersects} from '../dist/2d/world.js';
import {GameWorld,platformContains,platformHurtsPlayer,platformToWorld} from '../dist/physics.js';
import {skyDriver} from './sky-driver.mjs';
import {palaceDriver} from './palace-driver.mjs';
const advance=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(STEP,input)};
function land2(w,a,x=a.x+60){Object.assign(w.player,{x,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:a.id});w.fallRecordAt=-1;w.rememberFallPoint()}
function land3(w,a,x=0,z=0){Object.assign(w.player,{...platformToWorld(a,x,z),y:a.y,vx:0,vy:0,vz:0,grounded:true,on:a.id});w.fallRecordAt=-1;w.rememberFallPoint()}
function fall(w){w.player.y=w instanceof PixelWorld?800:-20;w.player.grounded=false;w.player.on=null;w.step(STEP,{})}

test('2D falling costs exactly two HP and returns to the latest standing area in every chapter',()=>{
 for(let level=0;level<4;level++){
  const w=new PixelWorld(level),a=w.level.ground[3];land2(w,a);
  w.score=1234;w.kills=5;w.collected.add(0);w.enemies[0].dead=true;w.attackBoost=true;const chest=w.chests[0];chest.opened=true;
  const before=w.time;fall(w);
  assert.equal(w.player.hp,4);assert.equal(w.player.on,a.id);assert.equal(w.checkpoint,0);assert.equal(w.deaths,0);assert.equal(w.falls,1);assert.ok(w.time>before);
  assert.equal(w.score,1234);assert.equal(w.kills,5);assert.equal(w.collected.size,1);assert.equal(w.enemies[0].dead,true);assert.equal(w.attackBoost,true);assert.equal(chest.opened,true);
  assert.equal(w.player.vx,0);assert.equal(w.player.vy,0);assert.equal(w.player.grounded,true);
  w.step(STEP,{jump:true});assert.ok(w.player.vy<0,'jump remains usable after recovery');
 }
});
test('2D records temporary bridges and restores the exact position at the current moving-platform height',()=>{
 const w=new PixelWorld(2),bridge=w.platforms.find(a=>a.kind==='crumble');land2(w,bridge,bridge.x+bridge.w-1.5);const x=w.player.x;
 bridge.gone=true;fall(w);assert.equal(w.player.on,bridge.id);assert.equal(w.player.x,x);assert.equal(bridge.gone,false);assert.equal(bridge.trigger,w.time);assert.equal(w.player.hp,4);
 w.step(STEP,{jump:true});assert.ok(w.player.vy<0);
 const city=new PixelWorld(1),moving=city.platforms.find(a=>a.kind==='moving');land2(city,moving,moving.x+30);city.time=2.4;fall(city);
 assert.equal(city.player.on,moving.id);assert.equal(city.player.x,moving.x+30);assert.equal(city.player.y,moving.y-city.player.h);
});
test('2D returns to the same coordinate even if a hazard now occupies that coordinate',()=>{
 const w=new PixelWorld(2),a=w.level.ground[1];land2(w,a,a.x+220);
 const x=w.player.x;w.hazards.push({kind:'beam',x:x-4,y:a.y-100,w:32,h:100,period:10,on:0,duration:10});
 fall(w);assert.equal(w.player.on,a.id);assert.equal(w.player.x,x);assert.equal(w.player.hp,4);
 w.step(STEP,{});assert.equal(w.player.hp,4,'brief recovery protection applies without relocating the player');
});
test('2D records the final grounded frame at the edge, without sampling delay or clamping',()=>{
 const w=new PixelWorld(0),a=w.platforms[0];land2(w,a,a.x+a.w-.5);const x=w.player.x;
 w.player.vx=250;w.step(STEP,{x:1});assert.equal(w.player.grounded,false);fall(w);
 assert.equal(w.player.x,x);assert.equal(w.player.on,a.id);assert.equal(w.player.hp,4);
 const save=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(save),true);assert.deepEqual(copy.fallHistory,w.fallHistory);
});
test('2D falls bypass dash immunity and only a lethal fall invokes the existing death reset',()=>{
 const w=new PixelWorld(2),a=w.level.ground[2];land2(w,a);w.score=900;w.player.invuln=99;w.player.dash=.1;fall(w);
 assert.equal(w.player.hp,4);assert.equal(w.score,900);assert.equal(w.deaths,0);
 fall(w);assert.equal(w.player.hp,2);assert.equal(w.deaths,0);fall(w);
 assert.equal(w.player.hp,6);assert.equal(w.deaths,1);assert.equal(w.score,0);assert.equal(w.player.x,75);assert.equal(w.falls,3);
 fall(w);assert.equal(w.player.x,75,'death removes landing anchors from the failed attempt');
});
test('2D save round trips retain HP, fall count and landing history; old saves and invalid anchors are handled',()=>{
 const w=new PixelWorld(3);land2(w,w.level.ground[5]);fall(w);const save=w.exportState(),copy=new PixelWorld(0);
 assert.equal(copy.importState(save),true);assert.deepEqual(copy.exportState(),save);fall(copy);assert.equal(copy.player.hp,2);assert.equal(copy.player.on,w.player.on);
 const old=structuredClone(save);delete old.state.fallHistory;delete old.state.falls;assert.equal(new PixelWorld().importState(old),true);
 for(const q of [{id:999,x:2},{id:0,x:1e8},{id:0,x:NaN}]){const bad=structuredClone(save);bad.state.fallHistory=[q];assert.equal(new PixelWorld().importState(bad),false)}
});
test('3D falling returns to a recent platform without resetting collection, clocks or route progress',()=>{
 for(let level=0;level<4;level++){
  const w=new GameWorld(level),a=w.platforms.find(a=>a.id>=3&&['solid','rotating','moving'].includes(a.kind));land3(w,a);
  w.collected.add(w.collectibles[0].id);w.farthest=a.id;w.attemptTime=2.3;w.time=2.3;fall(w);
  assert.equal(w.player.hp,4);assert.equal(w.player.maxHp,6);assert.equal(w.player.on,a.id);assert.equal(w.deaths,0);assert.equal(w.falls,1);assert.equal(w.collected.size,1);assert.equal(w.farthest,a.id);assert.ok(w.attemptTime>2.3);
  assert.equal(w.player.vx,0);assert.equal(w.player.vy,0);assert.equal(w.player.vz,0);assert.ok(platformContains(w.platforms[w.player.on],w.player.x,w.player.z));
  w.step(STEP,{jump:true});assert.ok(w.player.vy>0,'jump works after safe restoration');
 }
});
test('3D recovery follows the same foot position on moving and rotating decks',()=>{
 for(const kind of ['rotating','moving']){
  const w=new GameWorld(kind==='moving'?1:0),a=w.platforms.find(a=>a.kind===kind);land3(w,a,.4,.3);w.time=2.8;fall(w);
  assert.equal(w.player.on,a.id);const expected=platformToWorld(a,.4,.3);assert.ok(Math.hypot(w.player.x-expected.x,w.player.z-expected.z)<1e-6);
 }
});
test('3D temporary platforms return at the original coordinate with a fresh standing window',()=>{
 for(const kind of ['crumble','pulse']){
  const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);land3(w,a,.4,.3);a.gone=true;fall(w);
  const expected=platformToWorld(a,.4,.3);assert.equal(w.player.on,a.id);assert.ok(Math.hypot(w.player.x-expected.x,w.player.z-expected.z)<1e-6);assert.equal(a.gone,false);
  if(kind==='pulse')assert.ok(a.recoveryUntil>w.attemptTime+1.4);else assert.equal(a.triggerAt,w.attemptTime);
  w.step(STEP,{jump:true});assert.ok(w.player.vy>0);assert.equal(w.player.hp,4);
 }
});
test('3D retains the final grounded edge coordinate and accepts that edge in saved history',()=>{
 const w=new GameWorld(0),a=w.platforms[0];land3(w,a,a.w/2+.2,0);const x=w.player.x;
 w.player.vx=7.6;w.step(STEP,{x:1});assert.equal(w.player.grounded,false);fall(w);
 assert.equal(w.player.x,x);assert.equal(w.player.on,0);assert.equal(w.player.hp,4);
 assert.equal(new GameWorld().restoreFallHistory(w.fallHistory),true);
});
test('3D recovery preserves the former coordinate even when a trap is active there',()=>{
 for(const kind of ['laser','sweeper','crusher']){
  const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);w.attemptTime=kind==='laser'?2.4:kind==='crusher'?a.period*.79:0;land3(w,a,0,0);fall(w);
  assert.equal(w.player.on,a.id);assert.equal(w.player.x,a.x);assert.equal(w.player.z,a.z);assert.equal(w.player.hp,4);assert.ok(w.respawnGrace>1.4);
 }
});
test('3D third fall invokes the ordinary death rule and checkpoint health is restored only when activated',()=>{
 const w=new GameWorld(2),a=w.platforms.find(a=>a.id>0&&a.kind==='solid');land3(w,a);w.collected.add(w.collectibles[0].id);
 fall(w);fall(w);assert.equal(w.player.hp,2);assert.equal(w.deaths,0);fall(w);
 assert.equal(w.deaths,1);assert.equal(w.player.hp,6);assert.equal(w.player.on,0);assert.equal(w.collected.size,0);assert.equal(w.falls,3);
 const forest=new GameWorld(0);forest.player.hp=2;const camp=forest.platforms[4];land3(forest,camp);forest.step(STEP,{});assert.equal(forest.player.hp,6);assert.equal(forest.checkpoint,4);
});
test('3D safe landing data is bounded and rejects malformed cloud records',()=>{
 const w=new GameWorld(3);land3(w,w.platforms.find(a=>a.id>0&&a.kind==='solid'));
 const history=structuredClone(w.fallHistory),copy=new GameWorld(3);assert.equal(copy.restoreFallHistory(history),true);assert.deepEqual(copy.fallHistory,history);
 for(const invalid of [{id:999,x:0,z:0},{id:0,x:999,z:0},{id:0,x:0,z:NaN}])assert.equal(copy.restoreFallHistory([invalid]),false);
 assert.equal(copy.restoreFallHistory(undefined),true);assert.equal(copy.fallHistory[0].id,0);
});
test('Both hard 2D routes remain completable with ordinary controls after one staged fall recovery',()=>{
 for(const level of [2,3]){
  const w=new PixelWorld(level);let drive=skyDriver(),injected=false;
  for(let tick=0;tick<120*600&&!w.complete&&w.deaths<3;tick++){
   w.step(STEP,drive(w));w.drain();
   const a=w.platforms.find(a=>a.id===w.player.on);
   if(!injected&&a?.kind==='ground'&&a.section>=(level===3?12:6)&&w.player.x>a.x+40&&w.player.x<a.x+120&&w.fallHistory.at(-1)?.id===a.id){
    const score=w.score,hp=w.player.hp;fall(w);assert.equal(w.player.hp,hp-2);assert.equal(w.score,score);injected=true;drive=skyDriver();
   }
  }
  assert.equal(injected,true);assert.equal(w.complete,true,JSON.stringify({level,time:w.time,hp:w.player.hp,deaths:w.deaths,falls:w.falls,checkpoint:w.checkpoint,x:w.player.x,boss:w.enemies.at(-1).hp}));assert.ok(w.deaths<3);assert.equal(w.falls,1);assert.equal(w.godMode,false);
 }
});
test('Both hard 3D routes remain completable with ordinary controls after one staged fall recovery',()=>{
 for(const level of [2,3]){
  const w=new GameWorld(level);let drive=palaceDriver(),injected=false;
  for(let tick=0;tick<120*180&&!w.complete&&!w.deaths;tick++){
   w.step(STEP,drive(w));w.drain();
   const a=w.platforms[w.player.on];
   if(!injected&&a?.kind==='solid'&&a.id>=6&&w.fallHistory.at(-1)?.id===a.id){fall(w);assert.equal(w.player.hp,4);injected=true;drive=palaceDriver()}
  }
  assert.equal(injected,true);assert.equal(w.complete,true,`3D chapter ${level+1}`);assert.equal(w.deaths,0);assert.equal(w.falls,1);assert.equal(w.godMode,false);
 }
});
