import test from 'node:test';
import assert from 'node:assert/strict';
import {GameWorld,LEVELS,HEIGHT,JUMP,GRAVITY} from '../dist/physics.js';
import {provePalace} from './palace-route.mjs';
const step=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(1/120,input)};
const stand=(w,a,extra={})=>Object.assign(w.player,{x:a.x,y:a.y,z:a.z,vx:0,vz:0,vy:0,grounded:true,on:a.id,...extra});

test('palace is a long intact sky ascent with seven kinds of traps and only the start savepoint',()=>{
 const w=new GameWorld(2);assert.equal(w.def.sky,true);assert.equal(w.platforms.length,44);assert.equal(w.platforms.filter(a=>a.kind!=='solid').length,37);assert.equal(new Set(w.platforms.map(a=>a.kind)).size,8);assert.ok(w.platforms.at(-1).z<-330);assert.ok(w.platforms.at(-1).y>10);assert.deepEqual(w.def.checkpoints,[]);assert.equal(w.checkpoint,0);assert.equal(w.godMode,false);assert.equal(w.usedGodMode,false);assert.equal(w.enemies,undefined);assert.equal('hp' in w.player,false);
});
test('earlier courses retain their original geometry and checkpoint counts',()=>{assert.equal(LEVELS[0].platforms.length,22);assert.equal(LEVELS[1].platforms.length,30);assert.deepEqual(LEVELS[0].checkpoints,[4,9,14,18]);assert.deepEqual(LEVELS[1].checkpoints,[4,9,14,19,24])});
test('palace collectibles live inside actual decks and rare items sit on safe balconies',()=>{
 const w=new GameWorld(2);assert.equal(w.collectibles.length,47);assert.equal(w.stats().maxScore,590);
 for(const item of w.collectibles){const a=w.platforms[item.platform];assert.ok(a);assert.ok(Math.abs(item.x)<a.w/2-.5&&Math.abs(item.z)<a.d/2-.5);assert.ok(item.y<HEIGHT*.6+JUMP*JUMP/(2*GRAVITY));if(item.type==='relic')assert.equal(a.kind,'solid')}
});
test('lethal falling restarts the whole palace attempt, while total time and death count remain',()=>{
 const w=new GameWorld(2);step(w,400);w.collected.add('light-15');w.farthest=21;w.platforms[5].triggerAt=.1;w.platforms[5].gone=true;const total=w.time;w.player.y=-13;w.step(1/120);
 assert.equal(w.deaths,1);assert.ok(w.time>total);assert.equal(w.attemptTime,0);assert.equal(w.collected.size,0);assert.equal(w.farthest,0);assert.equal(w.checkpoint,0);assert.equal(w.player.on,0);assert.equal(w.player.z,1.3);
 const fresh=new GameWorld(2);for(const a of w.platforms){assert.equal(a.triggerAt,null);assert.equal(a.gone,fresh.platforms[a.id].gone);assert.equal(a.x,fresh.platforms[a.id].x);assert.equal(a.angle||0,fresh.platforms[a.id].angle||0)}
 assert.ok(w.drain().some(e=>e.type==='respawn'&&e.restarted));
});
test('third-course laser, sweeper and crusher remain lethal in normal mode',()=>{
 for(const kind of ['laser','sweeper','crusher']){const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);w.respawnGrace=0;w.attemptTime=kind==='laser'?2.4:kind==='crusher'?a.period*.79:0;stand(w,a);w.step(1/120);assert.equal(w.deaths,1,kind);assert.equal(w.player.on,0);assert.equal(w.attemptTime,0)}
});
test('crystal bridges collapse after a readable window and pulse decks retract',()=>{
 for(const kind of ['crumble','pulse']){const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);stand(w,a);if(kind==='crumble'){w.step(1/120);assert.equal(a.triggerAt,w.attemptTime);step(w,190)}else{w.attemptTime=a.period*.8;w.step(1/120)}assert.equal(a.gone,true,kind);assert.equal(w.player.grounded,false)}
});
test('palace timing gives substantial warning before lasers, crushers and pulse gaps',()=>{
 const w=new GameWorld(2);for(const a of w.platforms){if(a.kind==='laser')assert.ok(a.warningDuration>=.7);if(a.kind==='crusher')assert.ok(a.period*.2>=.9);if(a.kind==='pulse')assert.ok(a.period*.17>=1);if(a.kind==='crumble')assert.ok(a.crumbleDelay>=1.4)}
});
test('god mode grants free flight and immunity to every trap without combat',()=>{
 for(const kind of ['laser','sweeper','crusher','crumble','pulse','moving','rotating']){const w=new GameWorld(2),a=w.platforms.find(a=>a.kind===kind);w.setGodMode(true);w.respawnGrace=0;w.attemptTime=kind==='crusher'?a.period*.79:2.4;stand(w,a);a.triggerAt=0;step(w,100);assert.equal(w.deaths,0,kind);assert.equal(w.godMode,true);assert.equal(w.player.grounded,false);assert.equal(w.player.y,a.y);assert.equal(w.enemies,undefined)}
 const w=new GameWorld(2);w.setGodMode(true);step(w,120,{x:1,y:1,z:-1});assert.ok(w.player.x>5&&w.player.y>5&&w.player.z<-3);assert.ok(Math.hypot(w.player.vx,w.player.vy,w.player.vz)<=10.501);step(w,600,{y:-1});assert.equal(w.player.y,w.flightBounds.minY);assert.equal(w.deaths,0);step(w,1200,{y:1});assert.equal(w.player.y,w.flightBounds.maxY);
});
test('switching flight off safely extracts a hero inside a slab without resetting progress',()=>{
 const w=new GameWorld(2),a=w.platforms[24];w.collected.add('light-8');w.farthest=24;w.setGodMode(true);stand(w,a,{y:a.y-.4,grounded:false,on:null});w.setGodMode(false);assert.equal(w.player.y,a.y);assert.equal(w.player.on,24);assert.equal(w.collected.size,1);assert.equal(w.farthest,24);assert.equal(w.usedGodMode,true);assert.equal(w.deaths,0);w.step(1/120,{jump:true});assert.ok(w.player.vy>0);
 const b=w.platforms[25],collectedBefore=w.collected.size;w.setGodMode(true);stand(w,b,{y:b.y+5,grounded:false,on:null});w.setGodMode(false);w.step(1/120);assert.ok(w.player.vy<0);assert.equal(w.collected.size,collectedBefore);assert.ok(w.collected.has('light-8'));
});
test('god mode can complete near the exit; normal mode has to land there',()=>{
 for(const god of [false,true]){const w=new GameWorld(2),a=w.platforms.at(-1);w.setGodMode(god);stand(w,a,{z:a.z-1.5,y:a.y+1.3,grounded:false,on:null});w.step(1/120);assert.equal(w.complete,god);if(!god){step(w,120);assert.equal(w.complete,true);assert.equal(w.player.grounded,true)}}
});
test('flight bounds track the entire climbing route and never cut off the final gate',()=>{
 const w=new GameWorld(2),b=w.flightBounds;for(const a of w.platforms){assert.ok(a.x>b.minX&&a.x<b.maxX);assert.ok(a.y+3<b.maxY);assert.ok(a.z>b.minZ&&a.z<b.maxZ)}
});
test('flying advances the route meter without granting a new checkpoint',()=>{const w=new GameWorld(2);w.setGodMode(true);step(w,1000,{z:-1});assert.ok(w.farthest>=10);assert.equal(w.checkpoint,0);assert.equal(w.player.grounded,false);assert.equal(w.complete,false)});
test('turning flight off restores ordinary trap vulnerability',()=>{
 const w=new GameWorld(2),a=w.platforms.find(a=>a.kind==='laser');w.setGodMode(true);w.attemptTime=2.4;w.respawnGrace=0;stand(w,a);w.step(1/120);assert.equal(w.deaths,0);w.setGodMode(false);w.step(1/120);assert.equal(w.deaths,1);
});
test('a god run reset begins a fresh normal world unless the interface re-enables it',()=>{const w=new GameWorld(2);w.setGodMode(true);w.reset(2);assert.equal(w.godMode,false);assert.equal(w.usedGodMode,false);assert.equal(w.time,0)});
test('the complete normal route works with keyboard input at 120, 60 and 30 Hz',()=>{for(const stride of [1,2,4]){const r=provePalace({stride});assert.equal(r.deaths,0);assert.equal(r.visited,44)}});
test('normal timing remains beatable after idle starts and variable browser input cadence',()=>{for(const delay of [.3,.7,1.1,1.9,3,5.5])provePalace({stride:4,delay});for(const delay of [.2,1.7,4.1,6.3])provePalace({delay,jitter:true})});
