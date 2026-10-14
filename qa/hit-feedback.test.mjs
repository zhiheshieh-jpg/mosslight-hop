import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP} from '../dist/2d/world.js';
import {HitFeedback,impactSettings} from '../dist/2d/feedback.js';
test('confirmed hits have distinct light, heavy and kill hitstop; Claude feels weightier',()=>{
 for(const character of ['dragon','claude']){
  const times=[];for(const [stage,kill] of [[0,false],[2,false],[2,true]]){
   const w=new PixelWorld();w.setCharacter(character);const e=w.enemies.find(e=>e.type==='brute');e.hp=kill?1:99;w.player.attackId++;
   w.hitEnemy(e,2,stage);const hit=w.drain().find(e=>e.type==='hit');assert.equal(w.hitstop,impactSettings({heavy:stage===2,kill,character}).hitstop);assert.equal(hit.hitstop,w.hitstop);times.push(w.hitstop);
  }
  assert.ok(times[0]>=.065&&times[0]<times[1]&&times[1]<times[2]&&times[2]<.14);
 }
 assert.ok(impactSettings({character:'claude'}).hitstop>impactSettings({character:'dragon'}).hitstop);
});
test('empty swings do not freeze the world or produce confirmed-hit feedback',()=>{
 for(const character of ['dragon','claude']){const w=new PixelWorld();w.setCharacter(character);w.startAttack();assert.equal(w.hitstop,0);assert.ok(!w.drain().some(e=>e.type==='hit'));}
});
test('hitstop freezes physics but preserves a jump pressed during the stop',()=>{
 const w=new PixelWorld(),e=w.enemies.find(e=>e.type==='brute');w.player.attackId++;w.hitEnemy(e,1,0);const time=w.time,x=w.player.x;
 w.step(STEP,{jump:true});assert.equal(w.time,time);assert.equal(w.player.x,x);assert.ok(w.player.jumpBuffer>0);
 while(w.hitstop>0)w.step(STEP,{jump:true});w.step(STEP,{jump:true});assert.ok(w.player.vy<0);assert.ok(w.time>time);
});
test('multiple targets and duplicate hits cannot stack an unbounded pause',()=>{
 const w=new PixelWorld();w.player.attackId++;for(const e of w.enemies.slice(0,5))w.hitEnemy(e,999,2);
 assert.equal(w.hitstop,impactSettings({heavy:true,kill:true}).hitstop);const before=w.hitstop;w.hitEnemy(w.enemies[0],999,2);assert.equal(w.hitstop,before);
});
test('camera impulses are bounded, directional and settle at different frame rates',()=>{
 for(const hz of [30,60,120]){
  const feedback=new HitFeedback();for(let n=0;n<200;n++)feedback.kick({heavy:true,kill:true,character:'claude',face:1});
  assert.ok(feedback.amplitude<=2.8);let peak=0;for(let i=0;i<hz;i++){const p=feedback.update(1/hz);peak=Math.max(peak,Math.abs(p.x));assert.ok(Math.abs(p.x)<3&&Math.abs(p.y)<1.2);}
  assert.ok(peak>0);assert.deepEqual(feedback.offset,{x:0,y:0});assert.equal(feedback.snapshot().active,false);
 }
 const a=new HitFeedback(),b=new HitFeedback();a.kick({face:1});b.kick({face:-1});assert.equal(a.update(.01).x,-b.update(.01).x);
});
test('saving during a confirmed hit restores the remaining hitstop',()=>{
 const w=new PixelWorld(),e=w.enemies.find(e=>e.type==='brute');w.player.attackId++;w.hitEnemy(e,1,0);const record=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(record),true);assert.equal(copy.hitstop,w.hitstop);const time=copy.time;copy.step(STEP);assert.equal(copy.time,time);
});
