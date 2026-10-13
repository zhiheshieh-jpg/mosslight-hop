import test from 'node:test';
import assert from 'node:assert/strict';
import {GameWorld,LEVELS,HEIGHT,JUMP,GRAVITY} from '../dist/physics.js';
import {proveLab} from './lab3d-route.mjs';
const step=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(1/120,input)};
test('final laboratory is a full 50-deck challenge with seven trap types and a single savepoint',()=>{
 const w=new GameWorld(3);assert.equal(LEVELS.length,4);assert.equal(w.def.lab,true);assert.equal(w.platforms.length,50);assert.equal(w.platforms.filter(a=>a.kind!=='solid').length,42);assert.equal(new Set(w.platforms.map(a=>a.kind)).size,8);assert.equal(w.def.checkpoints.length,0);assert.equal(w.restartFromStart,true);assert.ok(w.platforms.at(-1).z<-380);assert.equal(w.enemies,undefined);
 for(const item of w.collectibles){const a=w.platforms[item.platform];assert.ok(Math.abs(item.x)<a.w/2-.5&&Math.abs(item.z)<a.d/2-.5);assert.ok(item.y<HEIGHT*.6+JUMP*JUMP/(2*GRAVITY));if(item.type==='relic')assert.equal(a.kind,'solid')}
 assert.equal(w.collectibles.length,53);assert.equal(w.stats().maxScore,650);
});
test('a lethal laboratory fall resets every mechanism, collection and route to its only savepoint',()=>{
 const w=new GameWorld(3);step(w,300);w.collected.add('light-20');w.farthest=26;w.platforms[5].triggerAt=.1;w.player.hp=2;w.player.y=-13;w.step(1/120);const fresh=new GameWorld(3);assert.equal(w.deaths,1);assert.equal(w.time>2,true);assert.equal(w.attemptTime,0);assert.equal(w.collected.size,0);assert.equal(w.farthest,0);assert.equal(w.player.on,0);assert.equal(w.player.z,1.3);for(const a of w.platforms){assert.equal(a.gone,fresh.platforms[a.id].gone);assert.equal(a.x,fresh.platforms[a.id].x);assert.equal(a.triggerAt,null)}
});
test('logo selection needs god mode and disabling it restores the previous ordinary character',()=>{
 const w=new GameWorld(3,'claude');assert.equal(w.setCharacter('logo'),false);assert.equal(w.character,'claude');w.setGodMode(true);assert.equal(w.setCharacter('logo'),true);w.setGodMode(false);assert.equal(w.character,'claude');assert.equal(w.setCharacter('unknown'),false);w.setGodMode(true);w.setCharacter('logo');w.reset(3);assert.equal(w.godMode,false);assert.equal(w.character,'claude');
});
test('logo moves faster, repeatedly dashes without cooldown, and cannot grant ordinary characters that ability',()=>{
 const ordinary=new GameWorld(3);ordinary.setGodMode(true);step(ordinary,120,{z:-1,dash:true});assert.ok(ordinary.player.vz>-10.501);assert.equal(ordinary.dashTime,0);
 const logo=new GameWorld(3);logo.setGodMode(true);logo.setCharacter('logo');step(logo,120,{z:-1});assert.ok(logo.player.vz<-18);const before=logo.player.z;step(logo,240,{z:-1,dash:true});assert.ok(logo.player.z<before-75);assert.equal(logo.deaths,0);assert.ok(logo.drain().filter(e=>e.type==='dash').length>=7);logo.setGodMode(false);assert.equal(logo.dashTime,0);assert.equal(logo.character,'dragon');assert.equal(logo.usedGodMode,true);
});
test('both ordinary heroes beat all 50 decks using only normal keyboard movement and jump inputs',()=>{
 for(const character of ['dragon','claude'])for(const stride of [1,2,4]){const result=proveLab({character,stride});assert.equal(result.character,character);assert.equal(result.visited,50);assert.equal(result.deaths,0)}
});
test('the full normal laboratory route also survives delayed starts and variable input cadence',()=>{
 for(const delay of [.3,.7,1.1,1.9,3,5.5])proveLab({stride:4,delay});for(const delay of [.2,1.7,4.1,6.3])proveLab({delay,jitter:true});
});
