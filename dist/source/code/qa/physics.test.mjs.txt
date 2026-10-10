import test from 'node:test';
import assert from 'node:assert/strict';
import {GameWorld,LEVELS,JUMP,GRAVITY,SPEED,platformToLocal,platformToWorld} from '../dist/physics.js';
const step=(w,n,i={})=>{for(let t=0;t<n;t++)w.step(1/120,i)};
test('standing is stable; world steps are bounded',()=>{const w=new GameWorld;step(w,240);assert.equal(w.player.y,0);assert.equal(w.player.grounded,true);assert.equal(w.deaths,0);});
test('jump rises and lands; held jump never repeats',()=>{const w=new GameWorld;w.step(1/120,{jump:true});assert.ok(w.player.vy>9);step(w,60,{jump:true});assert.ok(w.player.y>1);step(w,180,{jump:true});assert.equal(w.player.y,0);assert.equal(w.drain().filter(e=>e.type==='jump').length,1)});
test('movement matches axes and diagonal speed is normalized',()=>{const w=new GameWorld;step(w,30,{x:1,z:-1});assert.ok(w.player.x>0);assert.ok(w.player.z<1.3);assert.ok(Math.hypot(w.player.vx,w.player.vz)<=SPEED+.001)});
test('falling restores last checkpoint and retains crystals',()=>{const w=new GameWorld;w.checkpoint=4;w.collected.add("light-1");w.player.y=-13;w.step(1/120);assert.equal(w.deaths,1);assert.equal(w.player.on,4);assert.equal(w.player.x,w.platforms[4].x);assert.equal(w.collected.size,1)});
test('checkpoint and optional gem register on landing',()=>{const w=new GameWorld;const a=w.platforms[4];Object.assign(w.player,{x:a.x,z:a.z,y:a.y+.01,vy:-1,grounded:false});step(w,2);assert.equal(w.checkpoint,4);const before=w.collected.size;const b=w.platforms[5];Object.assign(w.player,{x:b.x,z:b.z,y:b.y+.01,vy:-1});step(w,2);assert.equal(w.collected.size,before+1)});
test('moving platform carries standing player',()=>{const w=new GameWorld(1);const a=w.platforms[2];Object.assign(w.player,{x:a.x,z:a.z,y:a.y,vy:0,grounded:true,on:2});step(w,60);assert.ok(Math.abs(w.player.x-a.x)<.01);assert.equal(w.player.on,2)});
test('crumbling platform disappears then recovers',()=>{const w=new GameWorld(1);const a=w.platforms[5];a.triggerAt=0;w.time=1.2;w.step(1/120);assert.equal(a.gone,true);w.time=4.3;w.step(1/120);assert.equal(a.gone,false);assert.equal(a.triggerAt,null)});
test('laser damages at low height and permits a jump above it',()=>{const w=new GameWorld(1),a=w.platforms[10];w.time=2.2;w.respawnGrace=0;Object.assign(w.player,{x:a.x,z:a.z,y:a.y+.1,vy:0});w.step(1/120);assert.equal(w.deaths,1);w.respawnGrace=0;Object.assign(w.player,{x:a.x,z:a.z,y:a.y+1.3,vy:0});w.step(1/120);assert.equal(w.deaths,1)});
test('goal completes without requiring optional crystals',()=>{for(const l of [0,1]){const w=new GameWorld(l),a=w.platforms.at(-1);Object.assign(w.player,{x:a.x,z:a.z-1.5,y:a.y+.01,vy:-1,grounded:false});step(w,3);assert.equal(w.complete,true);assert.equal(w.collected.size,0)}});
test('all consecutive gaps fit jump envelope, including moving extremes',()=>{for(const level of LEVELS){for(let i=1;i<level.platforms.length;i++){const a=level.platforms[i-1],b=level.platforms[i],rise=b.y-a.y;const air=(JUMP+Math.sqrt(JUMP*JUMP-2*GRAVITY*rise))/GRAVITY;const dx=Math.max(0,Math.abs(b.x-a.x)+(a.amp||0)+(b.amp||0)-(a.w+b.w)/2+.7);const dz=Math.max(0,Math.abs(b.z-a.z)-(a.d+b.d)/2+.7);assert.ok(Math.hypot(dx,dz)<air*SPEED-.35,`Level ${level.name}, jump ${i}`)}}});
test('rotating arms can be jumped and leave a safe landing rim',()=>{const w=new GameWorld(1),a=w.platforms[3];w.respawnGrace=0;Object.assign(w.player,{x:a.x,z:a.z,y:a.y,vy:0});w.step(1/120);assert.equal(w.deaths,1);w.respawnGrace=0;Object.assign(w.player,{x:a.x,z:a.z,y:a.y+.95,vy:0});w.step(1/120);assert.equal(w.deaths,1);Object.assign(w.player,{x:a.x,z:a.z+a.d/2-.2,y:a.y,vy:0});step(w,90);assert.equal(w.deaths,1)});
test('crushers warn while raised, close, and reopen with a safe walking window',()=>{const w=new GameWorld(1),a=w.platforms[8];w.respawnGrace=0;w.time=a.period*.5;Object.assign(w.player,{x:a.x,z:a.z,y:a.y,vy:0});w.step(1/120);assert.equal(a.warning,true);assert.equal(w.deaths,0);w.time=a.period*.78;w.step(1/120);assert.equal(w.deaths,1);w.respawnGrace=0;w.time=a.period*.03;Object.assign(w.player,{x:a.x,z:a.z,y:a.y,vy:0});step(w,30);assert.equal(w.deaths,1)});
test('pulse platforms warn before retracting and always return',()=>{const w=new GameWorld(1),a=w.platforms[18];w.time=a.period*.65;Object.assign(w.player,{x:a.x,z:a.z,y:a.y,vy:0,grounded:true,on:a.id});w.step(1/120);assert.equal(a.warning,true);assert.equal(a.gone,false);w.time=a.period*.8;w.step(1/120);assert.equal(a.gone,true);assert.equal(w.player.grounded,false);w.time=a.period*1.01;w.step(1/120);assert.equal(a.gone,false)});
test('extended city has thirty platforms, six mechanism types and five safe checkpoints',()=>{const w=new GameWorld(1);assert.equal(w.platforms.length,30);assert.ok(w.platforms.at(-1).z<=-200);assert.equal(new Set(w.platforms.filter(a=>a.kind!=='solid').map(a=>a.kind)).size,6);assert.equal(w.def.checkpoints.length,5);for(const id of w.def.checkpoints)assert.equal(w.platforms[id].kind,'solid')});

test('rotating decks keep their center fixed and carry a standing player in either direction',()=>{
 for(const id of [3,7]){const w=new GameWorld(0),a=w.platforms[id],center={x:a.x,z:a.z};
  Object.assign(w.player,platformToWorld(a,1.5,.7),{y:a.y,vy:0,vx:0,vz:0,grounded:true,on:id});const start={...w.player};
  step(w,a.period/4*120);const local=platformToLocal(a,w.player.x,w.player.z);
  assert.ok(Math.abs(local.x-1.5)<1e-8&&Math.abs(local.z-.7)<1e-8);assert.equal(w.player.on,id);assert.equal(w.deaths,0);
  assert.deepEqual({x:a.x,z:a.z},center);assert.ok(Math.hypot(w.player.x-start.x,w.player.z-start.z)>2);
  w.step(1/120,{jump:true});const airborne={...w.player};step(w,25);
  assert.equal(w.player.grounded,false);assert.equal(w.player.x,airborne.x);assert.equal(w.player.z,airborne.z);
 }
});
test('landing follows the rotated rectangle instead of its original or bounding box',()=>{
 for(const [dx,dz,lands] of [[3,0,false],[0,2.9,true],[2.9,2.9,false]]){
  const w=new GameWorld(0),a=w.platforms[3];w.time=a.period/4;
  Object.assign(w.player,{x:a.x+dx,z:a.z+dz,y:a.y+.01,vy:-2,grounded:false,on:null});step(w,2);
  assert.equal(w.player.on===a.id,lands,`${dx},${dz}`);
 }
});
test('forest gaps require jumps, stay separated throughout rotation and fit the jump range',()=>{
 const level=LEVELS[0];assert.equal(level.platforms.length,22);assert.equal(level.platforms.filter(p=>p.kind==='rotating').length,5);
 assert.ok(-level.platforms.at(-1).z>190);assert.equal(level.checkpoints.length,4);
 for(let i=1;i<level.platforms.length;i++){
  const a=level.platforms[i-1],b=level.platforms[i],rise=b.y-a.y,air=(JUMP+Math.sqrt(JUMP*JUMP-2*GRAVITY*rise))/GRAVITY;
  const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
  const extent=(p,angle)=>{const c=Math.cos(angle),s=Math.sin(angle),x=(dx*c-dz*s)/len,z=(dx*s+dz*c)/len;return Math.min(p.w/2/Math.abs(x),p.d/2/Math.abs(z))};
  for(let j=0;j<72;j++){
   const angle=j*Math.PI/36,gap=len-extent(a,a.kind==='rotating'?angle:0)-extent(b,b.kind==='rotating'?angle:0);
   assert.ok(gap>2,`jump ${i} never closes up`);assert.ok(gap+.7<air*SPEED-.35,`jump ${i} angle ${j} has landing margin`);
  }
 }
});
