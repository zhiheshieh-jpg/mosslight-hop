import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,createLevel,hazardState,intersects,STEP} from '../dist/2d/world.js';
import {skyDriver} from './sky-driver.mjs';
const step=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(STEP,input)};

test('palace is longer, denser, four-stage and has exactly one starting checkpoint',()=>{
 const a=createLevel(2),city=createLevel(1),w=new PixelWorld(2);
 assert.equal(a.name,'绯晶天宫');assert.equal(a.sky,true);assert.equal(a.zones.length,4);
 assert.equal(a.ground.length,42);assert.ok(a.length>city.length*2);assert.ok(a.enemies.length>=80);
 assert.equal(a.checkpoints.length,1);assert.equal(a.checkpoints[0].section,0);assert.equal(a.checkpoints[0].x,75);
 assert.equal(new Set(a.platforms.map(p=>p.id)).size,a.platforms.length);
 assert.equal(a.platforms.filter(p=>p.kind==='crumble').length,4);
 assert.ok(w.enemies.find(e=>e.type==='boss').hp>=80);
 assert.deepEqual(new Set(a.hazards.map(h=>h.kind)),new Set(['spikes','saw','beam']));
});

test('all traps give a warning, damage interval, safe crossing window and shared moving geometry',()=>{
 const w=new PixelWorld(2);
 for(const h of w.hazards){
  const at=phase=>hazardState(h,phase-h.phase);
  assert.equal(at(h.on-h.warmup/2).warning,true);assert.equal(at(h.on-h.warmup/2).active,false);
  assert.equal(at(h.on+.1).active,true);assert.equal(at(h.on+.1).warning,false);
  assert.equal(at(h.on+h.duration+.1).active,false);assert.equal(at(.1).active,false);
  assert.ok(h.period-h.duration>2.5);
  const a=hazardState(h,1),b=hazardState(h,1);assert.deepEqual(a,b);
  if(h.kind==='saw')assert.notDeepEqual(hazardState(h,0).rect,hazardState(h,1).rect);
 }
 step(w,10);for(const h of w.hazards){const a=hazardState(h,w.time);assert.deepEqual(h.rect,a.rect);assert.equal(h.active,a.active);assert.equal(h.warning,a.warning)}
});

test('a palace death resets combat, pickups, score, traps, crumble, boss and timer to the start',()=>{
 const w=new PixelWorld(2);w.time=85;w.realTime=100;w.kills=10;w.score=900;w.collected.add(3);w.enemies[0].dead=true;
 const b=w.enemies.at(-1);b.hp=8;b.mode='attack';b.x+=150;w.projectiles.push({life:2});
 const a=w.platforms.find(p=>p.kind==='crumble');a.trigger=3;a.gone=true;w.hazards[0].active=true;
 w.respawn();assert.equal(w.deaths,1);assert.equal(w.checkpoint,0);assert.equal(w.player.x,75);assert.equal(w.player.hp,6);
 assert.equal(w.kills,0);assert.equal(w.score,0);assert.equal(w.collected.size,0);assert.equal(w.time,0);assert.equal(w.realTime,100);
 assert.ok(w.enemies.every(e=>!e.dead&&e.hp===e.maxHp));assert.equal(w.enemies.at(-1).mode,'patrol');
 assert.equal(w.projectiles.length,0);assert.ok(w.platforms.every(p=>!p.gone&&p.trigger===-1));
 assert.deepEqual(w.hazards[0].rect,hazardState(w.hazards[0],0).rect);
});

test('lethal projectile and lethal falling after a boss kill both restart the entire attempt',()=>{
 for(const cause of ['projectile','fall']){
  const w=new PixelWorld(2);w.enemies.at(-1).dead=true;w.enemies.at(-1).hp=0;w.enemies[0].dead=true;w.score=900;w.kills=2;w.collected.add(0);
  if(cause==='projectile'){w.player.hp=1;w.projectiles.push({x:w.player.x,y:w.player.y,w:12,h:12,vx:0,vy:0,life:1,owner:'enemy'})}
  else Object.assign(w.player,{x:600,y:721,grounded:false,vy:500,hp:2});
  step(w,1);assert.equal(w.deaths,1);assert.equal(w.player.x,75);assert.equal(w.score,0);assert.equal(w.kills,0);assert.equal(w.collected.size,0);
  assert.ok(w.enemies.every(e=>!e.dead&&e.hp===e.maxHp));assert.equal(w.projectiles.length,0);assert.equal(w.complete,false);
 }
});

test('god toggle preserves progress, cancels hurt/plunge and immediately restores normal damage',()=>{
 const w=new PixelWorld(2);assert.equal(w.godMode,false);w.score=120;w.collected.add(1);w.time=4;
 Object.assign(w.player,{hp:3,hurt:.2,vy:850,invuln:1,dash:.1});const before=w.player.x;
 w.setGodMode(true);assert.equal(w.player.hp,3);assert.equal(w.player.hurt,0);assert.equal(w.player.vy,0);
 assert.equal(w.player.x,before);assert.equal(w.score,120);assert.equal(w.collected.size,1);assert.equal(w.time,4);
 assert.equal(w.hurt(99,100),false);assert.equal(w.player.hp,3);
 w.setGodMode(false);assert.equal(w.godMode,false);assert.equal(w.usedGodMode,true);assert.equal(w.hurt(1,100),true);assert.equal(w.player.hp,2);
});

test('god flight crosses platform slabs, stays visible, never falls and normal mode snaps out of a slab',()=>{
 const w=new PixelWorld(2),view={x:0,y:0,w:960,h:540};w.setGodMode(true);
 step(w,40,{y:1,view});assert.ok(w.player.y>420);assert.equal(w.player.grounded,false);
 step(w,300,{y:-1,view});assert.equal(w.player.y,8);
 step(w,1000,{y:1,view});assert.equal(w.player.y,490);assert.equal(w.deaths,0);
 w.setGodMode(false);assert.equal(w.player.y,378);assert.equal(w.player.grounded,true);
 w.setGodMode(true);step(w,20,{x:1,y:-1,view});const x=w.player.x;step(w,1,{x:1,dash:true,view});assert.ok(w.player.x-x>6);
 w.setGodMode(false);const y=w.player.y;step(w,10);assert.ok(w.player.y>y);
});

test('god mode blocks active trap, contact and projectile damage in the running simulation',()=>{
 const w=new PixelWorld(2),h=w.hazards.find(h=>h.kind==='beam');w.time=h.on+.2-h.phase;
 Object.assign(w.player,{x:h.x,y:h.y+60,hp:2});const enemy=w.enemies[0];Object.assign(enemy,{x:h.x,y:w.player.y,baseY:w.player.y});
 w.setGodMode(true);w.projectiles.push({x:h.x,y:w.player.y,w:12,h:12,vx:0,vy:0,life:2,owner:'enemy'});
 step(w,1);assert.equal(h.active,true);assert.ok(intersects(w.player,h.rect));assert.equal(w.player.hp,2);assert.equal(w.deaths,0);
});

test('god slash kills every visible enemy including boss, regardless of facing or range, and clears only visible hostile bullets',()=>{
 const w=new PixelWorld(2),[near,far,off,above]=w.enemies,boss=w.enemies.at(-1),view={x:0,y:50,w:800,h:400};
 Object.assign(near,{x:20,y:150});Object.assign(far,{x:600,y:300});Object.assign(off,{x:900,y:300});Object.assign(above,{x:300,y:0});Object.assign(boss,{x:710,y:280});
 const hpOff=off.hp,hpAbove=above.hp;w.player.face=-1;w.setGodMode(true);
 w.projectiles.push({x:600,y:200,w:12,h:12,vx:0,vy:0,life:3,owner:'enemy'},{x:950,y:200,w:12,h:12,vx:0,vy:0,life:3,owner:'enemy'});
 step(w,1,{attack:true,view});assert.equal(near.dead,true);assert.equal(far.dead,true);assert.equal(boss.dead,true);
 assert.equal(off.hp,hpOff);assert.equal(above.hp,hpAbove);assert.equal(w.projectiles.length,1);assert.equal(w.projectiles[0].x,950);
});

test('normal slash remains local after switching god mode off',()=>{
 const w=new PixelWorld(2),e=w.enemies[0];w.setGodMode(true);w.setGodMode(false);const hp=e.hp;
 step(w,12,{attack:true,view:{x:0,y:0,w:2000,h:540}});assert.equal(e.hp,hp);
});

test('sky boss visibly telegraphs three patterns and accelerates below half HP',()=>{
 const w=new PixelWorld(2),e=w.enemies.at(-1),modes=new Set,patterns=new Set;
 e.timer=0;w.updateSkyBoss(e,0,-100);assert.equal(e.mode,'windup');const calmWindup=e.timer;
 e.hp=40;e.mode='patrol';e.timer=0;w.updateSkyBoss(e,0,-100);assert.ok(e.timer<calmWindup);assert.equal(e.enraged,true);
 for(let i=0;i<2000;i++){e.timer-=STEP;w.updateSkyBoss(e,STEP,-100);modes.add(e.mode);patterns.add(e.pattern)}
 assert.deepEqual(patterns,new Set(['charge','fan','cross']));assert.ok(modes.has('windup')&&modes.has('attack')&&modes.has('recover'));
});

test('god exit accepts flight while the normal exit still requires grounding',()=>{
 for(const god of [false,true]){const w=new PixelWorld(2);w.enemies.at(-1).dead=true;Object.assign(w.player,{x:w.level.length-90,y:120,grounded:false});if(god)w.setGodMode(true);step(w,1);assert.equal(w.complete,god)}
});

test('full normal palace route completes with ordinary inputs, zero deaths and all boss patterns',()=>{
 const w=new PixelWorld(2),drive=skyDriver(),patterns=new Set,stages=new Set,used=new Set;let steps=0;
 for(;steps<120*360&&!w.complete;steps++){
  const input=drive(w);assert.deepEqual(Object.keys(input).sort(),['attack','dash','interact','jump','x']);
  for(const key of ['jump','dash','attack'])if(input[key])used.add(key);
  w.step(STEP,input);assert.equal(w.godMode,false);assert.equal(w.usedGodMode,false);
  const s=w.level.ground.find(a=>w.player.x>=a.x&&w.player.x<a.x+a.w)?.section;
  if([0,10,21,31,41].includes(s))stages.add(s);
  for(const e of w.drain())if(e.type==='warning'&&e.pattern)patterns.add(e.pattern);
 }
 assert.equal(w.complete,true);assert.equal(w.deaths,0);assert.equal(w.player.grounded,true);assert.equal(w.enemies.at(-1).dead,true);
 assert.ok(w.kills>80);assert.equal(w.checkpoint,0);assert.equal(w.level.checkpoints.length,1);
 assert.deepEqual(stages,new Set([0,10,21,31,41]));assert.deepEqual(patterns,new Set(['charge','fan','cross']));assert.equal(used.size,3);
});

