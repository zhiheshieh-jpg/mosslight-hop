import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP} from '../dist/2d/world.js';
import {COMBAT_PROFILES} from '../dist/2d/combat.js';
import {getCharacter} from '../dist/2d/characters.js';
import {MUSIC_THEMES,musicEvents,midiFrequency} from '../dist/music.js';
test('the two ordinary profiles have distinct damage, cadence, finishers and dash cooldown',()=>{
 const a=COMBAT_PROFILES.dragon,b=COMBAT_PROFILES.claude;
 assert.ok(a.damage.every((v,i)=>v<b.damage[i]));assert.ok(a.cooldown.every((v,i)=>v<b.cooldown[i]));assert.ok(a.dashCooldown<b.dashCooldown);assert.notEqual(a.skill,b.skill);
 for(const id of ['dragon','claude']){const w=new PixelWorld();w.setCharacter(id);w.startAttack();assert.equal(w.player.attackCooldown,COMBAT_PROFILES[id].cooldown[0]);assert.equal(w.snapshot().combat.skill,COMBAT_PROFILES[id].skill);}
 assert.equal(getCharacter('dragon').name,'GPT（同人形象）');assert.equal(getCharacter('logo').name,'GPT（官方Logo）');
});
test('GPT finisher fires a real moon blade that pierces two distinct enemies only',()=>{
 const w=new PixelWorld(),p=w.player;w.enemies=w.enemies.slice(0,3);
 w.enemies.forEach((e,i)=>Object.assign(e,{id:i,home:w.platforms[0],type:'brute',x:p.x+150+i*55,y:w.platforms[0].y-e.h,hp:99,maxHp:99,vx:0,vy:0,stun:10,dead:false}));
 p.chainWindow=.6;p.attackStage=1;w.startAttack();assert.equal(w.projectiles[0].skill,'moonwave');assert.ok(w.drain().some(e=>e.type==='skill'&&e.kind==='moonwave'));
 for(let i=0;i<110;i++)w.step(STEP,{});
 assert.equal(w.enemies[0].hp,96);assert.equal(w.enemies[1].hp,96);assert.equal(w.enemies[2].hp,99);
});
test('Claude finisher has a bilateral ground shockwave with its own damage and feedback event',()=>{
 const w=new PixelWorld();w.setCharacter('claude');const p=w.player;w.enemies=w.enemies.slice(0,3);
 w.enemies.forEach((e,i)=>Object.assign(e,{id:i,x:p.x+(i===0?-90:i===1?90:190),y:p.y+10,hp:99,maxHp:99,vx:0,stun:10,dead:false}));
 p.chainWindow=.6;p.attackStage=1;w.startAttack();assert.equal(w.projectiles.length,0);assert.equal(w.enemies[0].hp,93);assert.equal(w.enemies[1].hp,93);assert.equal(w.enemies[2].hp,99);assert.ok(w.drain().some(e=>e.type==='skill'&&e.kind==='shockwave'));
});
test('in-flight character projectiles and rolled chest state survive a full save round trip',()=>{
 const w=new PixelWorld(3);w.player.chainWindow=.6;w.player.attackStage=1;w.startAttack();const saved=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(saved),true);assert.deepEqual(copy.exportState(),saved);assert.equal(copy.projectiles[0].remainingHits,2);
});
test('four original chapter scores have distinct arrangements, valid pitches and bounded envelopes',()=>{
 assert.equal(MUSIC_THEMES.length,4);const scores=[];
 for(let level=0;level<4;level++){
  const score=Array.from({length:256},(_,step)=>musicEvents(level,step));scores.push(JSON.stringify(score));assert.ok(score.flat().some(e=>e.voice==='sine'));assert.ok(score.flat().some(e=>['bell','square','triangle'].includes(e.voice)));
  for(const e of score.flat()){assert.ok(e.beats>0&&e.beats<4);assert.ok(e.gain>0&&e.gain<.3);if(e.note!==undefined)assert.ok(midiFrequency(e.note)>20&&midiFrequency(e.note)<10000);}
 }
 assert.equal(new Set(scores).size,4);assert.ok(musicEvents(0,0,true).some(e=>e.voice==='kick'));
});
