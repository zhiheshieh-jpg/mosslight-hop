import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP} from '../dist/2d/world.js';
import {GameWorld,platformToWorld} from '../dist/physics.js';
import {skyDriver} from './sky-driver.mjs';
import {palaceDriver} from './palace-driver.mjs';
const advance=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(STEP,input)};
function land2(w,a,x=a.x+60){Object.assign(w.player,{x,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:a.id});w.fallRecordAt=-1;w.rememberFallPoint()}
function land3(w,a,x=0,z=0){Object.assign(w.player,{...platformToWorld(a,x,z),y:a.y,vx:0,vy:0,vz:0,grounded:true,on:a.id});}
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
test('2D restores temporary bridges slightly inside their edge and follows moving-platform height',()=>{
 const w=new PixelWorld(2),bridge=w.platforms.find(a=>a.kind==='crumble');land2(w,bridge,bridge.x+bridge.w-1.5);const x=w.player.x;
 bridge.gone=true;fall(w);assert.equal(w.player.on,bridge.id);assert.equal(w.player.x,bridge.x+bridge.w-w.player.w-32);assert.ok(w.player.x<x);assert.equal(bridge.gone,false);assert.equal(bridge.trigger,w.time);assert.equal(w.player.hp,4);
 w.step(STEP,{jump:true});assert.ok(w.player.vy<0);
 const city=new PixelWorld(1),moving=city.platforms.find(a=>a.kind==='moving');land2(city,moving,moving.x+60);city.time=2.4;fall(city);
 assert.equal(city.player.on,moving.id);assert.equal(city.player.x,moving.x+60);assert.equal(city.player.y,moving.y-city.player.h);
});
test('2D returns to the same coordinate even if a hazard now occupies that coordinate',()=>{
 const w=new PixelWorld(2),a=w.level.ground[1];land2(w,a,a.x+220);
 const x=w.player.x;w.hazards.push({kind:'beam',x:x-4,y:a.y-100,w:32,h:100,period:10,on:0,duration:10});
 fall(w);assert.equal(w.player.on,a.id);assert.equal(w.player.x,x);assert.equal(w.player.hp,4);
 w.step(STEP,{});assert.equal(w.player.hp,4,'brief recovery protection applies without relocating the player');
});
test('2D keeps the last platform but adds a small inward margin at either edge',()=>{
 for(const side of [-1,1]){
  const w=new PixelWorld(0),a=w.level.ground[3];land2(w,a,side<0?a.x-w.player.w+.5:a.x+a.w-.5);
  w.player.vx=250*side;w.step(STEP,{x:side});assert.equal(w.player.grounded,false);fall(w);
  const x=side<0?a.x+32:a.x+a.w-w.player.w-32;
  assert.equal(w.player.x,x);assert.equal(w.player.on,a.id);assert.equal(w.player.hp,4);
  advance(w,14,{x:side});assert.equal(w.player.grounded,true,'held movement leaves a short reaction window');
  const save=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(save),true);assert.deepEqual(copy.fallHistory,w.fallHistory);
 }
});
test('2D narrow platforms center the body without shifting to a different platform',()=>{
 const w=new PixelWorld(0),a=w.platforms[0];a.w=30;land2(w,a,a.x+29);fall(w);
 assert.equal(w.player.x,a.x+4);assert.equal(w.player.on,a.id);assert.equal(w.player.hp,4);
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
test('3D every fall immediately uses the chapter checkpoint rule and has no health system',()=>{
 for(let level=0;level<4;level++){
  const w=new GameWorld(level),checkpoint=w.restartFromStart?0:w.def.checkpoints[0],camp=w.platforms[checkpoint];
  land3(w,camp);w.step(STEP,{});assert.equal(w.checkpoint,checkpoint);
  w.collected.clear();w.collected.add(w.collectibles[0].id);w.time=2.3;w.attemptTime=2.3;
  const away=w.platforms.find(a=>a.id>checkpoint&&a.kind==='solid');land3(w,away);w.farthest=away.id;
  fall(w);
  assert.equal(w.player.on,checkpoint);assert.equal(w.player.x,camp.x);assert.equal(w.player.z,w.restartFromStart?1.3:camp.z+.5);
  assert.equal(w.deaths,1);assert.equal(w.checkpoint,checkpoint);assert.ok(w.time>2.3);
  assert.equal('hp' in w.player,false);assert.equal('maxHp' in w.player,false);assert.equal('fallHistory' in w,false);
  assert.equal(w.collected.size,w.restartFromStart?0:1);assert.equal(w.attemptTime,w.restartFromStart?0:w.time);
  fall(w);assert.equal(w.deaths,2);assert.equal(w.player.on,checkpoint);assert.equal('hp' in w.player,false);
 }
});
test('3D checkpoint respawn clears velocity and supports an immediate jump',()=>{
 const w=new GameWorld(0),camp=w.platforms[w.def.checkpoints[0]];land3(w,camp);w.step(STEP,{});
 Object.assign(w.player,{vx:7,vy:-12,vz:7});fall(w);
 assert.equal(w.player.vx,0);assert.equal(w.player.vy,0);assert.equal(w.player.vz,0);
 w.step(STEP,{jump:true});assert.ok(w.player.vy>0);
});
test('3D single-start trials reset their mechanisms and collection on the first fall',()=>{
 for(const level of [2,3]){
  const w=new GameWorld(level),a=w.platforms.find(a=>a.kind==='crumble');a.triggerAt=.1;a.gone=true;
  w.attemptTime=4;w.time=4;w.collected.add(w.collectibles[0].id);w.farthest=8;fall(w);
  assert.equal(w.deaths,1);assert.equal(w.checkpoint,0);assert.equal(w.farthest,0);assert.equal(w.attemptTime,0);
  assert.equal(w.collected.size,0);assert.equal(a.triggerAt,null);assert.equal(a.gone,false);
 }
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
test('Both hard 3D routes remain completable after a staged fall restarts the single-start trial',()=>{
 for(const level of [2,3]){
  const w=new GameWorld(level);let drive=palaceDriver(),injected=false;
  for(let tick=0;tick<120*240&&!w.complete&&w.deaths<=1;tick++){
   w.step(STEP,drive(w));w.drain();
   const a=w.platforms[w.player.on];
   if(!injected&&a?.kind==='solid'&&a.id>=6){fall(w);assert.equal(w.deaths,1);assert.equal(w.player.on,0);injected=true;drive=palaceDriver()}
  }
  assert.equal(injected,true);assert.equal(w.complete,true,`3D chapter ${level+1}`);assert.equal(w.deaths,1);assert.equal('hp' in w.player,false);assert.equal(w.godMode,false);
 }
});
