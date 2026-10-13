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
test('2D safe history excludes disappearing bridges and uses current moving-platform height',()=>{
 const w=new PixelWorld(2),a=w.level.ground[8];land2(w,a);
 const bridge=w.platforms.find(a=>a.kind==='crumble');land2(w,bridge,bridge.x+25);bridge.gone=true;fall(w);
 assert.equal(w.player.on,a.id);assert.equal(w.player.hp,4);
 const city=new PixelWorld(1),moving=city.platforms.find(a=>a.kind==='moving');assert.ok(moving);land2(city,moving,moving.x+30);city.time=2.4;fall(city);
 assert.equal(city.player.on,moving.id);assert.equal(city.player.y,moving.y-city.player.h);
});
test('2D recovery searches nearby safe ground when the former standing point becomes hazardous',()=>{
 const w=new PixelWorld(2),a=w.level.ground[1];land2(w,a,a.x+220);
 const recorded=w.player.x;w.hazards.push({kind:'beam',x:recorded-4,y:a.y-100,w:32,h:100,period:10,on:0,duration:10});
 fall(w);assert.equal(w.player.on,a.id);assert.notEqual(w.player.x,recorded);assert.equal(w.player.hp,4);
 for(const h of w.hazards){const s=hazardState(h,w.time);assert.ok(!s.active||!intersects(w.player,s.rect))}
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
test('3D recovery follows rotated and moving decks, rejecting temporary and missing platforms',()=>{
 for(const kind of ['rotating','moving']){
  const w=new GameWorld(kind==='moving'?1:0),a=w.platforms.find(a=>a.kind===kind);land3(w,a,.4,.3);w.time=2.8;fall(w);
  assert.equal(w.player.on,a.id);const expected=platformToWorld(a,.4,.3);assert.ok(Math.hypot(w.player.x-expected.x,w.player.z-expected.z)<1e-6);
 }
 const w=new GameWorld(2),safe=w.platforms.find(a=>a.id>0&&a.kind==='solid');land3(w,safe);
 for(const kind of ['crumble','pulse']){const a=w.platforms.find(a=>a.kind===kind);land3(w,a);assert.notEqual(w.fallHistory.at(-1).id,a.id)}
 const last=w.fallHistory.at(-1);w.platforms[last.id].gone=true;w.fallHistory.push({id:999,x:0,z:0});fall(w);assert.equal(w.player.on,0);
});
test('3D lasers, sweepers and crushers have safe recovery rims while their mechanisms continue',()=>{
 for(const kind of ['laser','sweeper','crusher']){
  const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);w.attemptTime=kind==='laser'?2.4:kind==='crusher'?a.period*.79:0;
  const point=w.fallPoint({id:a.id,x:0,z:0});assert.ok(point,kind+' has a stable safe rim');
  assert.equal(platformHurtsPlayer(a,point),false);w.fallHistory.push({id:a.id,...point.local});fall(w);
  assert.equal(w.player.on,a.id);assert.equal(w.player.hp,4);assert.equal(platformHurtsPlayer(a,w.player),false);assert.ok(w.respawnGrace>1.4);
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
   if(!injected&&a?.kind==='ground'&&a.section>=(level===3?12:6)&&w.fallHistory.at(-1)?.id===a.id){
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
