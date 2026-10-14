import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,STEP,intersects} from '../dist/2d/world.js';
import {skyDriver} from './sky-driver.mjs';
const approach=(w,c,offset=-55)=>Object.assign(w.player,{x:c.x+offset,y:c.y-w.player.h,vx:0,vy:0,grounded:true,on:c.platformId});
const open=(w,c,roll=0)=>{approach(w,c);return w.interact(()=>roll)};
const pickup=(w,c)=>{open(w,c);Object.assign(w.player,{x:w.powerup.x,y:c.y-w.player.h});w.step(STEP);assert.equal(w.attackBoost,true)};
test('all chapters have real, initially unrolled boxes without a guaranteed reward',()=>{
 for(let level=0;level<4;level++){
  const w=new PixelWorld(level);assert.ok(w.chests.length>=3);assert.equal(w.chests.filter(c=>c.reward).length,0);
  for(const c of w.chests){const a=w.platforms.find(a=>a.id===c.platformId);assert.ok(a);assert.ok(c.x>=a.x&&c.x+24<=a.x+a.w);assert.equal(c.y,a.y);assert.equal(c.opened,false);assert.equal(c.collected,false)}
 }
});
test('independent chest rolls use an exact 5-percent threshold and can yield none or several',()=>{
 const w=new PixelWorld(),c=w.chests[0];let rewards=0;
 for(let n=0;n<1000;n++){c.opened=c.reward=c.collected=false;open(w,c,(n+.5)/1000);rewards+=c.reward?1:0;w.drain()}
 assert.equal(rewards,50);
 for(const roll of [.05,.2,.999999]){c.opened=c.reward=false;open(w,c,roll);assert.equal(c.reward,false)}
 for(const roll of [0,.049999]){c.opened=c.reward=false;open(w,c,roll);assert.equal(c.reward,true)}
 const many=new PixelWorld();for(const box of many.chests)open(many,box,0);assert.equal(many.powerups.length,many.chests.length);
 const none=new PixelWorld();for(const box of none.chests)open(none,box,.5);assert.equal(none.powerup,null);assert.equal(none.powerups.length,0);
});
test('empty boxes require proximity, display the exact message, and never reroll',()=>{
 const w=new PixelWorld(),c=w.chests[0];let draws=0;const random=()=>{draws++;return .5};
 assert.equal(w.interact(random),null);approach(w,c);assert.equal(w.interact(random),c);assert.equal(w.interact(random),null);assert.equal(draws,1);assert.equal(w.powerup,null);
 const events=w.drain().filter(e=>e.type==='chestOpened');assert.equal(events.length,1);assert.equal(events[0].message,'好像只是一个空箱子...');assert.equal(events[0].empty,true);
});
test('interact press edges open once and rewards require contact and cannot be farmed',()=>{
 const w=new PixelWorld(),c=w.chests[0];const original=w.interact.bind(w);w.interact=()=>original(()=>0);approach(w,c);
 w.step(STEP,{interact:true});assert.equal(c.opened,true);assert.ok(w.powerup);assert.equal(w.attackBoost,false);
 const item={...w.powerup};w.step(STEP,{interact:true});assert.deepEqual(w.powerup,item);assert.equal(w.drain().filter(e=>e.type==='chestOpened').length,1);
 assert.equal(intersects(w.player,w.powerup),false);assert.equal(w.collectPowerup(),false);
 Object.assign(w.player,{x:item.x,y:c.y-w.player.h});w.step(STEP);assert.equal(c.collected,true);assert.equal(w.attackMultiplier,2);assert.equal(w.powerup,null);assert.equal(w.drain().filter(e=>e.type==='attackBuff').length,1);
});
test('the reward doubles each ordinary character slash and reflected projectile damage',()=>{
 for(const id of ['dragon','claude'])for(const boost of [false,true])for(const kind of ['slash','reflected']){
  const w=new PixelWorld();w.setCharacter(id);if(boost)pickup(w,w.chests[0]);
  const e=w.enemies.find(e=>e.type==='brute');e.hp=e.maxHp=40;e.stun=10;
  Object.assign(w.player,{x:e.x-48,y:e.home.y-42,vx:0,vy:0,grounded:true,on:e.home.id,attack:0,attackCooldown:0,attackStage:0,chainWindow:0});w.hitstop=0;
  if(kind==='slash'){for(let n=0;n<8;n++)w.step(STEP,{attack:true});assert.equal(e.hp,40-w.combat.damage[0]*(boost?2:1))}
  else{w.projectiles.push({x:e.x+4,y:e.y+3,w:12,h:12,vx:0,vy:0,life:2,owner:'player'});w.step(STEP);assert.equal(e.hp,40-(boost?4:2))}
 }
});
test('death removes boost but preserves rolled outcomes and unclaimed drops in all chapters',()=>{
 for(let level=0;level<4;level++)for(const collected of [false,true]){
  const w=new PixelWorld(level),c=w.chests[0];if(collected)pickup(w,c);else open(w,c);
  w.respawn();const box=w.chests[0];assert.equal(w.attackBoost,false);assert.equal(box.opened,true);assert.equal(box.reward,true);assert.equal(box.collected,collected);
  assert.equal(w.powerups.length,collected?0:1);approach(w,box);assert.equal(w.interact(()=>0),null);
 }
});
test('multiple pending rewards survive saves and collecting one does not erase the others',()=>{
 const w=new PixelWorld();open(w,w.chests[0]);open(w,w.chests[1]);const save=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(save),true);assert.deepEqual(copy.exportState(),save);assert.equal(copy.powerups.length,2);
 const item=copy.powerups[0];Object.assign(copy.player,{x:item.x,y:item.y});assert.equal(copy.collectPowerup(),true);assert.equal(copy.powerups.length,1);assert.equal(copy.powerups[0].chestId,1);
});
test('new saves round trip and legacy predetermined unopened rewards become ordinary unopened boxes',()=>{
 for(const collected of [false,true]){
  const w=new PixelWorld(3);if(collected)pickup(w,w.chests[0]);else open(w,w.chests[0]);const save=w.exportState(),copy=new PixelWorld();assert.equal(copy.importState(save),true);assert.deepEqual(copy.exportState(),save);
 }
 const w=new PixelWorld(),legacy=w.exportState();delete legacy.state.lootVersion;legacy.state.rewardChestId=0;legacy.state.chests[0].reward=true;
 const copy=new PixelWorld();assert.equal(copy.importState(legacy),true);assert.equal(copy.chests[0].reward,false);open(copy,copy.chests[0],.5);assert.equal(copy.chests[0].reward,false);
 const invalid=w.exportState();invalid.state.chests[0].reward=true;assert.equal(new PixelWorld().importState(invalid),false);
});
test('construction, save restoration and respawn consume no loot rolls',()=>{
 const original=Math.random;try{Math.random=()=>{throw Error('Unexpected loot roll')};const w=new PixelWorld(2);w.respawn();const copy=new PixelWorld();assert.equal(copy.importState(w.exportState()),true);w.reset(2)}finally{Math.random=original}
});
test('ordinary and god kills never restore HP; checkpoints still do',()=>{
 for(let level=0;level<4;level++)for(const god of [false,true]){const w=new PixelWorld(level);if(god)w.setGodMode(true);w.player.hp=2;for(const e of w.enemies){w.player.attackId++;w.hitEnemy(e,e.hp,2);assert.equal(w.player.hp,2)}assert.ok(!w.drain().some(e=>e.type==='heal'));if(w.level.checkpoints.length>1){const c=w.level.checkpoints[1];Object.assign(w.player,{x:c.x,y:c.y-w.player.h,vx:0,vy:0});w.hitstop=0;w.step(STEP);assert.equal(w.player.hp,6)}}
});
test('both normal characters can complete both hard routes without any rare reward',()=>{
 for(const id of ['dragon','claude'])for(const level of [2,3]){const w=new PixelWorld(level);w.setCharacter(id);const interact=w.interact.bind(w);w.interact=()=>interact(()=>.5);const drive=skyDriver();
  for(let n=0;n<120*900&&!w.complete&&w.deaths<4;n++){w.step(STEP,drive(w));assert.equal(w.godMode,false);assert.equal(w.attackBoost,false);assert.ok(!w.drain().some(e=>e.type==='heal'))}
  assert.equal(w.complete,true,JSON.stringify({id,level,deaths:w.deaths,x:w.player.x,boss:w.enemies.at(-1).hp}));assert.ok(w.deaths<4);assert.equal(w.enemies.at(-1).dead,true);
 }
});
