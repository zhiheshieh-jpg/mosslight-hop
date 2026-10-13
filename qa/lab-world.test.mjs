import test from 'node:test';
import assert from 'node:assert/strict';
import {PixelWorld,createLevel,hazardState,STEP,PHYSICS,LOGO_PHYSICS} from '../dist/2d/world.js';
import {labRoute} from './lab-route.mjs';
const step=(w,n,input={})=>{for(let i=0;i<n;i++)w.step(STEP,input)};

test('laboratory is a longer intact fourth route with five safe checkpoint decks',()=>{
 const l=createLevel(3),sky=createLevel(2),w=new PixelWorld(3);
 assert.equal(l.lab,true);assert.equal(l.sky,false);assert.equal(l.zones.length,4);assert.equal(l.ground.length,48);assert.ok(l.length>sky.length);
 assert.equal(new Set(l.platforms.map(a=>a.id)).size,l.platforms.length);assert.equal(l.platforms.filter(a=>a.kind==='crumble').length,5);
 assert.deepEqual(l.checkpoints.map(c=>c.section),[0,12,24,36,47]);
 for(const c of l.checkpoints){const floor=l.ground.find(a=>a.section===c.section);assert.ok(c.x>floor.x+22&&c.x+22<floor.x+floor.w);assert.equal(c.y,floor.y);assert.ok(!l.hazards.some(h=>h.section===c.section))}
 assert.ok(l.enemies.length>sky.enemies.length);assert.equal(w.enemies.at(-1).hp,132);assert.equal(sky.checkpoints.length,1);
});

test('lab machinery shares damage/render geometry, at least .65s warnings and safe crossing windows',()=>{
 const w=new PixelWorld(3);assert.deepEqual(new Set(w.hazards.map(a=>a.kind)),new Set(['beam','saw','spikes']));
 for(const h of w.hazards){
  assert.ok(h.warmup>=.65);assert.ok(h.period-h.duration>=2.5);
  const at=t=>hazardState(h,t-h.phase);
  assert.equal(at(h.on-h.warmup/2).warning,true);assert.equal(at(h.on-h.warmup/2).active,false);
  assert.equal(at(h.on+.1).active,true);assert.equal(at(h.on+h.duration+.1).active,false);
 }
 step(w,20);for(const h of w.hazards){const state=hazardState(h,w.time);assert.deepEqual(h.rect,state.rect);assert.equal(h.active,state.active)}
});

test('lab deaths retain completed route and respawn at maintenance checkpoint with a fresh living boss',()=>{
 const w=new PixelWorld(3);w.checkpoint=3;w.score=321;w.kills=7;w.collected.add(4);w.enemies[0].dead=true;
 const boss=w.enemies.at(-1);Object.assign(boss,{hp:12,x:boss.x-200,phase:8,mode:'attack',pattern:'charge',enraged:true,stun:.2});
 w.projectiles.push({life:2});w.respawn();
 assert.equal(w.deaths,1);assert.equal(w.player.x,w.level.checkpoints[3].x);assert.equal(w.player.hp,6);assert.equal(w.score,321);assert.equal(w.kills,7);assert.equal(w.collected.size,1);assert.equal(w.enemies[0].dead,true);
 assert.equal(boss.x,boss.spawnX);assert.equal(boss.hp,boss.maxHp);assert.equal(boss.mode,'patrol');assert.equal(boss.phase,0);assert.equal(boss.stun,0);assert.equal(boss.enraged,false);assert.equal(w.projectiles.length,0);
});

test('lab boss locks aim, warns before every one of four attacks, and keeps a punishable recovery',()=>{
 for(const enraged of [false,true]){
  const w=new PixelWorld(3),b=w.enemies.at(-1);if(enraged)b.hp=60;
  const patterns=new Set;
  for(let i=0;i<4;i++){
   b.mode='patrol';b.timer=0;w.updateLabBoss(b,0,-120);
   assert.equal(b.mode,'windup');assert.ok(b.timer>=.6);assert.equal(b.aim,-1);patterns.add(b.pattern);
   const warning=w.drain().find(a=>a.type==='warning');assert.equal(warning.duration,b.timer);assert.ok(warning.zone.w>0);assert.equal(w.projectiles.length,0);
   b.timer=.1;w.updateLabBoss(b,STEP,120);assert.equal(b.aim,-1);assert.equal(b.mode,'windup');assert.equal(w.projectiles.length,0);
   b.timer=0;w.updateLabBoss(b,STEP,120);assert.equal(b.mode,'attack');
   if(b.pattern==='charge'){assert.ok(b.vx< -800);assert.equal(w.projectiles.length,0)}else assert.ok(w.projectiles.length>=4);
   b.timer=0;w.updateLabBoss(b,STEP,120);assert.equal(b.mode,'recover');assert.ok(b.timer>=1);
   w.projectiles=[];
  }
  assert.deepEqual(patterns,new Set(['charge','fan','cross','burst']));
 }
});

test('lab charge is faster than palace, cannot be stalled by a slash, and is bounded to its arena',()=>{
 const w=new PixelWorld(3),b=w.enemies.at(-1),sky=new PixelWorld(2),s=sky.enemies.at(-1);
 b.mode=s.mode='patrol';b.timer=s.timer=0;w.updateLabBoss(b,0,-50);sky.updateSkyBoss(s,0,-50);
 b.timer=s.timer=0;w.updateLabBoss(b,STEP,-50);sky.updateSkyBoss(s,STEP,-50);assert.ok(Math.abs(b.vx)>Math.abs(s.vx));
 const vx=b.vx;w.player.attackId=21;w.hitEnemy(b,1,1);assert.equal(b.vx,vx);assert.equal(b.stun,0);
 Object.assign(w.player,{x:b.home.x+20,y:150});b.x=b.home.x+9;b.timer=.32;w.updateEnemy(b,STEP);assert.ok(b.x>=b.home.x+8);
});

test('logo selection requires god mode and sticky run audit survives switches, reset and death',()=>{
 const w=new PixelWorld(3);assert.equal(w.characterId,'dragon');assert.equal(w.setCharacter('logo'),'dragon');assert.equal(w.logoActive,false);
 w.setCharacter('claude');assert.equal(w.setCharacter('logo'),'claude');assert.equal(w.usedLogo,false);
 w.setGodMode(true);assert.equal(w.setCharacter('logo'),'logo');assert.equal(w.logoActive,true);assert.equal(w.usedLogo,true);
 w.setGodMode(false);assert.equal(w.characterId,'dragon');assert.equal(w.logoActive,false);assert.equal(w.usedGodMode,true);
 w.reset(2);w.respawn();w.reset(3);const snapshot=w.snapshot();assert.equal(snapshot.usedGodMode,true);assert.equal(snapshot.usedLogo,true);assert.equal(snapshot.characterId,'dragon');
});

test('logo moves faster and repeated held dash has no cooldown; ordinary god characters retain normal speed/cooldown',()=>{
 for(const character of ['dragon','claude','logo']){
  const w=new PixelWorld(3);w.setGodMode(true);w.setCharacter(character);step(w,1,{x:1,y:-1});
  assert.equal(w.player.vx,character==='logo'?LOGO_PHYSICS.speed:PHYSICS.speed);
  w.drain();step(w,35,{x:1,dash:true,view:{x:0,y:0,w:360,h:540}});const dashes=w.drain().filter(e=>e.type==='dash');
  if(character==='logo'){assert.equal(w.player.dashCooldown,0);assert.ok(dashes.length>=2);assert.equal(w.player.vx,LOGO_PHYSICS.dashSpeed)}
  else {assert.equal(dashes.length,1);assert.ok(w.player.dashCooldown>0);assert.equal(w.player.dash,0)}
 }
});

test('eight rotating light needles annihilate touching enemies including bosses, with no remote kill',()=>{
 const w=new PixelWorld(3);w.setGodMode(true);w.setCharacter('logo');const ring=w.logoRingState(),[near,far]=w.enemies,boss=w.enemies.at(-1);
 Object.assign(near,{x:ring.x+56,y:ring.y-8,w:12,h:16});Object.assign(far,{x:ring.x+90,y:ring.y-8,w:12,h:16});Object.assign(boss,{x:ring.x-70,y:ring.y-7,w:12,h:14});
 assert.equal(ring.needles.length,8);w.updateLogoRing();assert.equal(near.dead,true);assert.equal(boss.dead,true);assert.equal(far.dead,false);
 const pulse=w.drain().find(e=>e.type==='logoPulse');assert.equal(pulse.kills,2);assert.equal(pulse.radius,ring.tipRadius);
 step(w,20);assert.notEqual(w.logoRingState().angle,ring.angle);
 const before=far.hp;w.setGodMode(false);w.updateLogoRing();assert.equal(far.hp,before);
});

test('the circular aura kills between needle rays while nearby targets outside both shapes survive',()=>{
 const w=new PixelWorld(3);w.setGodMode(true);w.setCharacter('logo');const ring=w.logoRingState(),[contact,outside]=w.enemies,angle=Math.PI/8;
 Object.assign(contact,{x:ring.x+47*Math.cos(angle)-2,y:ring.y+47*Math.sin(angle)-2,w:4,h:4});
 Object.assign(outside,{x:ring.x+61*Math.cos(angle)-2,y:ring.y+61*Math.sin(angle)-2,w:4,h:4});
 w.updateLogoRing();assert.equal(contact.dead,true);assert.equal(outside.dead,false);assert.equal(w.drain().find(e=>e.type==='logoPulse').kills,1);
});

test('logo dash and self-explosion clear exactly the supplied visible rectangle and preserve player health',()=>{
 for(const action of ['dash','attack']){
  const w=new PixelWorld(3),view={x:300,y:90,w:360,h:400};w.setGodMode(true);w.setCharacter('logo');w.player.hp=3;
  const [visible,outside,above]=w.enemies,boss=w.enemies.at(-1);
  Object.assign(visible,{x:340,y:190});Object.assign(outside,{x:680,y:190});Object.assign(above,{x:400,y:10});Object.assign(boss,{x:600,y:300});
  w.projectiles.push({x:350,y:200,w:12,h:12,vx:0,vy:0,life:2,owner:'enemy'},{x:700,y:200,w:12,h:12,vx:0,vy:0,life:2,owner:'enemy'},{x:450,y:200,w:12,h:12,vx:0,vy:0,life:2,owner:'player'});
  // Unit fixtures position enemies; production route tests below never do this.
  step(w,1,{[action]:true,view});
  assert.equal(visible.dead,true);assert.equal(boss.dead,true);assert.equal(outside.dead,false);assert.equal(above.dead,false);assert.equal(w.player.hp,3);assert.equal(w.deaths,0);
  assert.equal(w.projectiles.filter(b=>b.owner==='enemy').length,1);assert.equal(w.projectiles.filter(b=>b.owner==='player').length,1);
  const event=w.drain().find(e=>e.type===(action==='dash'?'logoDash':'logoExplosion'));assert.deepEqual(event.viewport,view);
 }
 const w=new PixelWorld(3);w.setGodMode(true);w.setCharacter('logo');w.player.hp=3;step(w,1,{attack:true,view:{x:0,y:0,w:360,h:540}});assert.equal(w.player.hp,3);
});

test('regular god attacks retain screen slash behavior and cannot emit logo powers',()=>{
 for(const id of ['dragon','claude']){
  const w=new PixelWorld(3);w.setGodMode(true);w.setCharacter(id);step(w,1,{attack:true,dash:true});
  const events=w.drain();assert.ok(events.some(e=>e.type==='swing'));assert.ok(events.some(e=>e.type==='dash'));assert.ok(!events.some(e=>e.type.startsWith('logo')));
 }
});

test('full lab route is feasible with unmodified ordinary inputs at 120, 60 and 30Hz',()=>{
 for(const stride of [1,2,4]){const result=labRoute(stride);assert.ok(result.kills>110);assert.ok(result.parries>0);assert.ok(result.inputs.jumps>80);assert.ok(result.finalHp>0)}
});
