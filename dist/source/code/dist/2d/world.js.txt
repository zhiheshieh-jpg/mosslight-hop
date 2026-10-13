import {createSkyLevel,hazardState} from './sky-level.js';
import {createLabLevel} from './lab-level.js';
export {hazardState};
export const VIEW_W=960,VIEW_H=540,STEP=1/120;
export const PHYSICS={speed:250,jump:535,airJump:465,gravity:1480,dashSpeed:750,dashTime:.16};
export const LOGO_PHYSICS={speed:440,dashSpeed:1420,dashTime:.22,ringRadius:48,needleRadius:78,needles:8,needleWidth:7};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
// Segment versus expanded AABB, shared with the displayed light-needle endpoints.
function needleTouches(n,rect,width){
 let min=0,max=1;const half=width/2;
 for(const [start,delta,lo,hi] of [[n.x1,n.x2-n.x1,rect.x-half,rect.x+rect.w+half],[n.y1,n.y2-n.y1,rect.y-half,rect.y+rect.h+half]]){
  if(Math.abs(delta)<1e-9){if(start<lo||start>hi)return false;continue}
  const a=(lo-start)/delta,b=(hi-start)/delta;min=Math.max(min,Math.min(a,b));max=Math.min(max,Math.max(a,b));if(min>max)return false;
 }
 return true;
}
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
const THEMES=[{name:'晨露之森',en:'THE VERDANT LETTER',zones:['晨露坡道','树冠栈桥','失落回廊','苔核之庭'],boss:'苔核守卫'},
 {name:'霓虹断层',en:'NEON AFTERIMAGE',zones:['雨夜边城','空中轨道','数据深井','零点中枢'],boss:'零点监察者'}];
export function createLevel(index){
 if(index===2)return createSkyLevel();
 if(index===3)return createLabLevel();
 const random=rng(index?2418:927),night=!!index,ground=[],platforms=[],enemies=[],coins=[],checkpoints=[],hazards=[],decor=[];
 let x=0;const count=night?32:24;
 for(let i=0;i<count;i++){
  const last=i===count-1,safe=i%6===0||last;
  const w=last?850:i===0?660:safe?520:290+Math.floor(random()*100),y=420+([0,-16,12,0,-30,8][i%6]);
  const slab={id:platforms.length,x,y,w,h:200,kind:'ground',section:i};ground.push(slab);platforms.push(slab);
  if(safe){checkpoints.push({id:checkpoints.length,x:x+75,y,section:i});decor.push({kind:'camp',x:x+75,y})}
  if(i>0&&!last){
   const kinds=night?['runner','drone','sentry','brute']:['slime','wisp','slime','brute'];
   enemies.push({type:kinds[i%4],x:x+w*.62,y:y-34,home:slab});
   if(i%3===2)enemies.push({type:night?'runner':'slime',x:x+w*.3,y:y-34,home:slab});
  }
  // Upper routes are optional: the ground route always remains traversable.
  if(i>1&&!last&&i%3!==0){const top={id:platforms.length,x:x+40,y:y-110-(i%2)*35,w:110+random()*45,h:18,kind:night&&i%5===0?'moving':'ledge',baseY:y-130,phase:i};platforms.push(top);coins.push({x:top.x+top.w/2,y:top.y-22,rare:i%5===0});if(i%4===2)decor.push({kind:'chest',x:top.x+25,y:top.y})}
  if(night&&i%5===3){hazards.push({x:x+w*.44,y:y-10,w:66,h:10,kind:'laser',period:3.6,phase:i*.27})}
  if(night&&i%7===4){const top={id:platforms.length,x:x+w-80,y:y-70,w:100,h:18,kind:'crumble'};platforms.push(top)}
  for(let j=0;j<3;j++)coins.push({x:x+110+j*(w-140)/3,y:y-35,rare:false});
  if(last){enemies.push({type:'boss',x:x+540,y:y-(night?86:76),home:slab});decor.push({kind:'gate',x:x+w-75,y});}
  const gap=night?105+(i%4)*15:78+(i%4)*12;
  decor.push({kind:'sign',x:x+w-28,y,text:i<2?'跳跃 × 2':i%6===5?'存档点 →':''});
  x+=w+(last?0:gap);
 }
 return {...THEMES[index],index,night,length:x,ground,platforms,enemies,coins,checkpoints,hazards,decor,count};
}
export class PixelWorld{
 constructor(level=0){this.godMode=false;this.usedGodMode=false;this.characterId='dragon';this.usedLogo=false;this.reset(level)}
 reset(level,{chests,powerup=null}={}){this.attemptSerial=(this.attemptSerial||0)+1;this.level=createLevel(level);this.time=0;this.realTime=0;this.events=[];this.deaths=0;this.kills=0;this.score=0;this.collected=new Set;this.checkpoint=0;this.complete=false;this.hitstop=0;this.combo=0;this.comboTimer=0;this.bestCombo=0;this.attackSerial=0;this.logoAngle=0;this.projectiles=[];this.hazards=this.level.hazards.map(h=>({...h,...(()=>{const a=hazardState(h,0);return {active:a.active,warning:a.warning,rect:a.rect}})()}));this.platforms=this.level.platforms.map(p=>({...p,trigger:-1,gone:false}));this.enemies=this.level.enemies.map((e,id)=>({...e,id,w:e.type==='boss'?(level===3?84:level===2?76:64):e.type==='brute'?38:28,h:e.type==='boss'?(level===3?108:level===2?98:level?86:76):e.type==='brute'?42:e.type==='drone'||e.type==='wisp'?26:30,maxHp:e.type==='boss'?(level===3?132:level===2?84:level?36:24):e.type==='brute'?5:e.type==='sentry'?3:2,hp:e.type==='boss'?(level===3?132:level===2?84:level?36:24):e.type==='brute'?5:e.type==='sentry'?3:2,vx:0,vy:0,dir:-1,mode:'patrol',timer:level>=2&&e.type==='boss'?1:.5+id*.17,flash:0,stun:0,baseY:e.y,spawnX:e.x,dead:false,hitBy:-1,phase:0}));this.player={x:75,y:378,w:22,h:42,vx:0,vy:0,face:1,grounded:true,on:0,jumps:2,coyote:.1,jumpBuffer:0,hp:6,maxHp:6,invuln:0,dash:0,dashCooldown:0,attack:0,attackStage:0,attackCooldown:0,chainWindow:0,attackQueued:false,attackId:0,hurt:0};this.previous={};this.falls=0;this.fallHistory=[{id:0,x:75}];this.fallRecordAt=-1;this.attackBoost=false;this.chests=this.level.decor.filter(d=>d.kind==='chest').map((d,id)=>({id,x:d.x,y:d.y,platformId:this.level.platforms.find(a=>d.x>=a.x&&d.x+24<=a.x+a.w&&d.y===a.y)?.id,opened:!!chests?.[id]?.opened,reward:!!chests?.[id]?.reward,collected:!!chests?.[id]?.collected}));this.rewardChestId=chests?this.chests.find(c=>c.reward)?.id:Math.floor(Math.random()*this.chests.length);if(!chests&&this.chests.length)this.chests[this.rewardChestId].reward=true;this.powerup=powerup?{...powerup}:null;this.updateChests();}
 emit(type,data={}){this.events.push({type,...data})}
 // Record the exact last grounded foot position, including platform edges and temporary bridges.
 fallPoint(anchor){
  const a=this.platforms.find(a=>a.id===anchor.id);if(!a)return null;
  return {x:a.x+anchor.x,y:a.y-this.player.h,w:this.player.w,h:this.player.h,on:a.id};
 }
 rememberFallPoint(){
  const p=this.player,a=this.platforms.find(a=>a.id===p.on);
  if(this.godMode||!p.grounded||!a||a.gone||p.x+p.w<=a.x||p.x>=a.x+a.w||Math.abs(p.y+p.h-a.y)>.05)return;
  const anchor={id:a.id,x:p.x-a.x},history=this.fallHistory,last=history.at(-1);
  if(last?.id===a.id)history[history.length-1]=anchor;else history.push(anchor);
  if(history.length>128)history.shift();
 }
 restoreFallHistory(history){
  if(history!==undefined&&(!Array.isArray(history)||history.length>128||!history.every(q=>q&&Number.isInteger(q.id)&&this.platforms.some(a=>a.id===q.id&&Number.isFinite(q.x)&&q.x>=-this.player.w&&q.x<=a.w))))return false;
  this.fallHistory=history?.map(q=>({id:q.id,x:q.x}))||[{id:0,x:75}];this.fallRecordAt=-1;return true;
 }
 recoverFall(){
  const p=this.player;this.falls++;p.hp=Math.max(0,p.hp-2);
  if(p.hp===0){this.respawn();return}
  const point=this.fallPoint(this.fallHistory.at(-1)||{id:0,x:75});
  if(!point){this.respawn();return}
  const a=this.platforms.find(a=>a.id===point.on);if(a.kind==='crumble'){a.trigger=this.time;a.gone=false}
  Object.assign(p,{x:point.x,y:point.y,vx:0,vy:0,grounded:true,on:point.on,jumps:2,coyote:.1,jumpBuffer:0,dash:0,attack:0,attackQueued:false,hurt:0,invuln:1.5});
  this.hitstop=0;this.fallRecordAt=-1;this.rememberFallPoint();
  this.emit('fallRecovered',{x:p.x,y:p.y,platform:p.on,damage:2,hp:p.hp});
 }
 drain(){return this.events.splice(0)}
 get attackMultiplier(){return this.attackBoost?2:1}
 updateChests(){
  for(const c of this.chests){const a=this.platforms.find(a=>a.id===c.platformId);if(a)c.y=a.y}
  if(this.powerup){const c=this.chests.find(c=>c.id===this.powerup.chestId);if(c)this.powerup.y=c.y-52}
 }
 interact(){
  if(this.complete)return null;const p=this.player;
  const nearby=this.chests.filter(c=>!c.opened&&!this.platforms.find(a=>a.id===c.platformId)?.gone).map(c=>({c,d:Math.hypot(p.x+p.w/2-c.x-12,p.y+p.h/2-c.y+10)})).filter(a=>a.d<=90).sort((a,b)=>a.d-b.d);
  const c=nearby[0]?.c;if(!c)return null;c.opened=true;
  if(c.reward&&!c.collected)this.powerup={chestId:c.id,x:c.x+2,y:c.y-52,w:20,h:24};
  this.emit('chestOpened',{id:c.id,x:c.x,y:c.y,empty:!c.reward,reward:c.reward,message:c.reward?'箱中发现了攻击强化！':'好像只是一个空箱子...'});return c;
 }
 collectPowerup(){
  if(!this.powerup||!intersects(this.player,this.powerup))return false;
  const item=this.powerup,c=this.chests.find(c=>c.id===item.chestId);if(!c||c.collected){this.powerup=null;return false}
  c.collected=true;this.powerup=null;this.attackBoost=true;
  this.emit('attackBuff',{id:c.id,x:item.x+item.w/2,y:item.y+item.h/2,multiplier:this.attackMultiplier});return true;
 }
 get logoActive(){return this.godMode&&this.characterId==='logo'}
 setCharacter(id){
  const requested=['dragon','claude','logo'].includes(id)?id:'dragon';
  if(requested==='logo'&&!this.godMode){this.emit('characterLocked',{id:'logo',reason:'godModeRequired'});return this.characterId}
  if(this.characterId==='logo'&&requested!=='logo'){this.player.dash=0;this.player.attack=0;this.player.attackCooldown=0}
  this.characterId=requested;this.usedLogo ||= this.logoActive;
  if(this.logoActive){this.player.dashCooldown=0;this.usedGodMode=true}
  this.emit('character',{id:this.characterId});return this.characterId;
 }
 viewport(view){const p=this.player;return view&&[view.x,view.y,view.w,view.h].every(Number.isFinite)&&view.w>0&&view.h>0?{x:view.x,y:view.y,w:view.w,h:view.h}:{x:clamp(p.x+p.w/2-VIEW_W/2,0,Math.max(0,this.level.length-VIEW_W)),y:0,w:VIEW_W,h:VIEW_H}}
 clearViewport(view,stage=2){
  const viewport=this.viewport(view);if(!this.godMode)return viewport;
  this.player.attackId=++this.attackSerial;
  for(const e of this.enemies)if(!e.dead&&intersects(viewport,e))this.hitEnemy(e,e.hp,stage);
  this.projectiles=this.projectiles.filter(b=>b.owner!=='enemy'||!intersects(viewport,b));
  return viewport;
 }
 logoRingState(){
  const p=this.player,x=p.x+p.w/2,y=p.y+p.h/2,angle=this.logoAngle,radius=LOGO_PHYSICS.ringRadius,tipRadius=LOGO_PHYSICS.needleRadius;
  return {active:this.logoActive,x,y,angle,radius,tipRadius,needleCount:LOGO_PHYSICS.needles,thickness:LOGO_PHYSICS.needleWidth,needles:Array.from({length:LOGO_PHYSICS.needles},(_,i)=>{const a=angle+i*Math.PI*2/LOGO_PHYSICS.needles,c=Math.cos(a),s=Math.sin(a);return {x1:x+c*radius,y1:y+s*radius,x2:x+c*tipRadius,y2:y+s*tipRadius}})};
 }
 updateLogoRing(){
  if(!this.logoActive)return;const ring=this.logoRingState();let kills=0;
  for(const e of this.enemies){
   const dx=ring.x-clamp(ring.x,e.x,e.x+e.w),dy=ring.y-clamp(ring.y,e.y,e.y+e.h);
   if(!e.dead&&(dx*dx+dy*dy<=ring.radius*ring.radius||ring.needles.some(n=>needleTouches(n,e,ring.thickness)))){this.player.attackId=++this.attackSerial;this.hitEnemy(e,e.hp,2);kills++}
  }
  if(kills)this.emit('logoPulse',{x:ring.x,y:ring.y,radius:ring.tipRadius,angle:ring.angle,kills});
 }
 respawn(){this.attackBoost=false;if(this.level.sky){const deaths=this.deaths+1,elapsed=this.realTime,falls=this.falls,chests=this.chests,powerup=this.powerup;this.reset(2,{chests,powerup});this.deaths=deaths;this.realTime=elapsed;this.falls=falls;this.player.invuln=1.5;this.emit('respawn',{x:this.player.x,y:this.player.y,freshAttempt:true});return}const p=this.player,c=this.level.checkpoints[this.checkpoint];this.deaths++;Object.assign(p,{x:c.x,y:c.y-p.h,vx:0,vy:0,hp:p.maxHp,invuln:1.5,grounded:true,on:this.level.ground.find(a=>a.section===c.section).id,jumps:2,dash:0,attack:0,hurt:0});this.projectiles=[];this.combo=0;this.fallHistory=[];this.fallRecordAt=-1;this.rememberFallPoint();this.emit('respawn',{x:p.x,y:p.y});for(const e of this.enemies)if(e.type==='boss'&&!e.dead){e.hp=e.maxHp;e.x=e.spawnX;e.y=e.home.y-e.h;e.vx=e.vy=0;e.mode='patrol';e.timer=1;e.phase=0;e.enraged=false;e.pattern=null;e.attackZone=null;e.hitBy=-1;e.stun=e.flash=0}}
 hurt(damage,sourceX){const p=this.player;if(this.godMode||p.invuln>0||p.dash>0||this.complete)return false;p.hp-=damage;p.invuln=1.1;p.hurt=.2;p.vx=(p.x<sourceX?-1:1)*260;p.vy=-240;p.grounded=false;p.attack=0;this.combo=0;this.hitstop=.055;this.emit('hurt',{x:p.x+p.w/2,y:p.y+20,damage});if(p.hp<=0)this.respawn();return true}
 startAttack(view){const p=this.player;if(p.attackCooldown>0)return;if(this.logoActive){p.attack=.42;p.attackCooldown=.55;p.attackQueued=false;const viewport=this.clearViewport(view,2);this.emit('logoExplosion',{x:p.x+p.w/2,y:p.y+p.h/2,viewport,radius:Math.hypot(viewport.w,viewport.h)});return}p.attackStage=p.chainWindow>0?(p.attackStage+1)%3:0;p.attack=p.attackStage===2?.34:.26;p.attackCooldown=p.attackStage===2?.40:.27;p.chainWindow=.68;p.attackId=++this.attackSerial;p.attackQueued=false;p.vx+=p.face*(p.attackStage===2?130:55);this.emit('swing',{stage:p.attackStage,x:p.x+p.w/2,y:p.y+18,face:p.face});if(this.godMode)this.clearViewport(view,p.attackStage)}
 hitEnemy(e,damage,stage){if(e.dead||e.hitBy===this.player.attackId)return;e.hitBy=this.player.attackId;e.hp=Math.max(0,e.hp-damage);e.flash=.13;const charging=this.level.lab&&e.type==='boss'&&e.mode==='attack'&&e.pattern==='charge';e.stun=charging?0:e.type==='boss'?.09:stage===2?.5:.24;if(!charging)e.vx=this.player.face*(e.type==='boss'?45:stage===2?390:200);if(e.type!=='boss'&&stage===2)e.vy=-230;this.combo++;this.comboTimer=2;this.bestCombo=Math.max(this.bestCombo,this.combo);this.score+=damage*20;this.hitstop=Math.max(this.hitstop,e.hp<=0?.085:stage===2?.07:.045);this.emit('hit',{x:e.x+e.w/2,y:e.y+e.h/2,damage,heavy:stage===2,kill:e.hp<=0,face:this.player.face});if(e.hp<=0){e.dead=true;this.kills++;this.score+=e.type==='boss'?1000:100;this.emit('kill',{x:e.x+e.w/2,y:e.y+e.h/2,boss:e.type==='boss'});if(e.type==='boss')this.emit('bossDefeated')}}
 setGodMode(enabled){this.godMode=!!enabled;this.usedGodMode ||= this.godMode;const p=this.player;Object.assign(p,{hurt:0,vy:0,invuln:0,dash:0,jumpBuffer:0});this.hitstop=0;if(!this.godMode){if(this.characterId==='logo')this.setCharacter('dragon');const slabs=this.platforms.filter(a=>!a.gone&&intersects(p,a)).sort((a,b)=>a.y-b.y);if(slabs.length){const a=slabs[0];p.y=a.y-p.h;p.grounded=true;p.on=a.id;p.jumps=2}}this.emit('godMode',{enabled:this.godMode});return this.godMode}
 step(dt,input={}){
  if(this.complete)return;this.rememberFallPoint();this.usedGodMode ||= this.godMode;this.usedLogo ||= this.logoActive;dt=Math.min(dt,1/30);this.realTime+=dt;
  const attempt=this.attemptSerial,p=this.player,jumpEdge=!!input.jump&&!this.previous.jump,dashEdge=!!input.dash&&!this.previous.dash,interactEdge=!!input.interact&&!this.previous.interact;
  if(interactEdge)this.interact();if(jumpEdge)p.jumpBuffer=.13;if(input.attack)p.attackQueued=true;this.previous={...input};
  if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return}
  this.time+=dt;if(this.logoActive)this.logoAngle=(this.logoAngle+dt*(p.dash>0?18:2.8))%(Math.PI*2);this.comboTimer-=dt;if(this.comboTimer<=0)this.combo=0;
  for(const key of ['invuln','dashCooldown','attack','attackCooldown','chainWindow','hurt','jumpBuffer'])p[key]=Math.max(0,p[key]-dt);
  for(const a of this.platforms){const oldY=a.y;if(a.kind==='moving')a.y=a.baseY+Math.sin(this.time*1.5+a.phase)*28;if(a.kind==='crumble'&&a.trigger>=0){const age=this.time-a.trigger;a.gone=age>(a.collapseAfter??1)&&age<(a.restoreAfter??4);if(age>=(a.restoreAfter??4)){a.trigger=-1;a.gone=false}}if(p.grounded&&p.on===a.id){p.y+=a.y-oldY;if(a.gone){p.grounded=false;p.on=null}}}
  this.updateChests();
  p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);
  const axis=clamp(input.x||0,-1,1);if(axis)p.face=Math.sign(axis);
  if(p.attackQueued&&p.attackCooldown<=0){this.startAttack(input.view)}p.attackQueued=false;
  if((this.logoActive?input.dash&&p.dash<=0:dashEdge)&&p.dashCooldown<=0){p.dash=this.logoActive?LOGO_PHYSICS.dashTime:PHYSICS.dashTime;p.dashCooldown=this.logoActive?0:.7;p.invuln=Math.max(p.invuln,.22);p.vy=0;this.emit('dash',{x:p.x,y:p.y,face:p.face});if(this.logoActive){const viewport=this.clearViewport(input.view,2);this.emit('logoDash',{x:p.x+p.w/2,y:p.y+p.h/2,face:p.face,viewport,rotation:this.logoRingState().angle})}}
  if(!this.godMode&&p.jumpBuffer>0&&(p.coyote>0||p.jumps>0)&&p.dash<=0){const grounded=p.coyote>0;p.vy=grounded?-PHYSICS.jump:-PHYSICS.airJump;p.jumps=grounded?1:p.jumps-1;p.grounded=false;p.on=null;p.coyote=0;p.jumpBuffer=0;this.emit('jump',{x:p.x+11,y:p.y+42,air:!grounded})}
  if(this.godMode){const movement=this.logoActive?LOGO_PHYSICS:PHYSICS;p.vx=axis*movement.speed;p.vy=clamp(input.y||0,-1,1)*movement.speed;if(p.dash>0){p.dash=Math.max(0,p.dash-dt);p.vx=p.face*movement.dashSpeed}p.jumps=2;p.jumpBuffer=0}else if(p.dash>0){p.dash=Math.max(0,p.dash-dt);p.vx=p.face*PHYSICS.dashSpeed;p.vy=0}else {if(p.hurt<=0)p.vx+=(axis*PHYSICS.speed-p.vx)*(1-Math.exp(-(p.grounded?18:9)*dt));p.vy+=PHYSICS.gravity*dt}
  const oldY=p.y,oldX=p.x;p.x=clamp(p.x+p.vx*dt,0,this.level.length-p.w);p.y+=p.vy*dt;if(this.godMode){const v=input.view;p.y=clamp(p.y,v&&Number.isFinite(v.y)?v.y+8:-120,v&&Number.isFinite(v.y)&&v.h>p.h+16?v.y+v.h-p.h-8:650)};p.grounded=false;p.on=null;
  for(const a of this.platforms){if(this.godMode||a.gone||p.x+p.w<=a.x||p.x>=a.x+a.w)continue;if(p.vy>=0&&oldY+p.h<=a.y+5&&p.y+p.h>=a.y&&p.y<a.y+a.h){p.y=a.y-p.h;p.vy=0;p.grounded=true;p.on=a.id;p.jumps=2;if(a.kind==='crumble'&&a.trigger<0)a.trigger=this.time;break}if(a.kind==='ground'&&intersects(p,a)&&oldY+p.h>a.y+5){p.x=oldX;p.vx=0}}
  for(const c of this.level.checkpoints){if(c.id>this.checkpoint&&Math.abs(p.x-c.x)<110&&Math.abs(p.y+p.h-c.y)<220){this.checkpoint=c.id;p.hp=p.maxHp;this.emit('checkpoint',{id:c.id,x:c.x,y:c.y})}}
  for(let i=0;i<this.level.coins.length;i++){if(this.collected.has(i))continue;const c=this.level.coins[i];if(Math.hypot(p.x+p.w/2-c.x,p.y+p.h/2-c.y)<30){this.collected.add(i);this.score+=c.rare?100:10;this.emit('coin',{x:c.x,y:c.y,rare:c.rare})}}
  this.collectPowerup();
  const duration=p.attackStage===2?.34:.26,elapsed=duration-p.attack;
  if(!this.godMode&&p.attack>0&&elapsed>.035&&elapsed<.20){const reach=p.attackStage===2?88:68,hit={x:p.face>0?p.x+5:p.x-reach+17,y:p.y-9,w:reach,h:p.h+24};for(const e of this.enemies)if(!e.dead&&intersects(hit,e))this.hitEnemy(e,(p.attackStage===2?2:1)*this.attackMultiplier,p.attackStage);for(const b of this.projectiles)if(b.owner==='enemy'&&intersects(hit,b)){b.owner='player';b.vx=p.face*480;b.vy=-25;this.emit('parry',{x:b.x,y:b.y});this.hitstop=.065}}
  if(this.logoActive)this.updateLogoRing();
  for(const e of this.enemies){this.updateEnemy(e,dt);if(attempt!==this.attemptSerial)return}
  for(const b of this.projectiles){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(b.owner==='enemy'&&intersects(b,p)){this.hurt(b.damage||1,b.x);b.life=0}else if(b.owner==='player'){for(const e of this.enemies)if(!e.dead&&intersects(b,e)){e.hitBy=-1;this.hitEnemy(e,2*this.attackMultiplier,1);b.life=0;break}}}
  this.projectiles=this.projectiles.filter(b=>b.life>0);
  if(attempt!==this.attemptSerial)return;for(const h of this.hazards){const state=hazardState(h,this.time);h.active=state.active;h.warning=state.warning;h.rect=state.rect;if(h.active&&intersects(p,h.rect))this.hurt(this.level.sky||this.level.lab?2:1,h.rect.x+h.rect.w/2);if(attempt!==this.attemptSerial)return}
  if(!this.godMode&&p.y>720){this.recoverFall();return}this.rememberFallPoint();
  const boss=this.enemies.find(e=>e.type==='boss');if(p.x>this.level.length-115&&boss.dead&&(p.grounded||this.godMode)){this.complete=true;this.emit('complete')}
 }
 projectile(e,vx,vy=0){this.projectiles.push({x:e.x+e.w/2,y:(this.level.sky||this.level.lab)&&e.type==='boss'?e.home.y-27:e.y+e.h*.45,w:12,h:12,vx,vy,life:4,damage:(this.level.sky||this.level.lab)&&e.type==='boss'?2:1,owner:'enemy'});this.emit('shoot',{x:e.x,y:e.y})}
 updateEnemy(e,dt){
  if(e.dead)return;const p=this.player;e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);const dx=p.x-e.x,near=Math.abs(dx)<520;
  if(!near)return;e.timer-=dt;const flying=['wisp','drone'].includes(e.type);
  if(e.stun>0){e.x+=e.vx*dt;e.vx*=Math.exp(-dt*7)}else if(e.type==='boss'&&this.level.lab){this.updateLabBoss(e,dt,dx)}else if(e.type==='boss'&&this.level.sky){this.updateSkyBoss(e,dt,dx)}else if(e.type==='boss'){
   e.dir=dx<0?-1:1;
   if(e.mode==='patrol'&&e.timer<=0){e.mode='windup';e.timer=.8;e.phase++;this.emit('warning',{x:e.x+e.w/2,y:e.y-16,boss:true})}
   else if(e.mode==='windup'&&e.timer<=0){e.mode='attack';e.timer=.32;if(e.phase%2){e.vx=e.dir*(this.level.night?580:440);this.emit('bossDash',{x:e.x,y:e.y})}else {e.vx=0;for(const s of [-1,1]){this.projectile(e,s*230,0);if(this.level.night)this.projectile(e,s*190,-95)}this.emit('slam',{x:e.x+e.w/2,y:e.home.y})}}
   else if(e.mode==='attack'){e.x+=e.vx*dt;if(e.timer<=0){e.mode='recover';e.timer=e.hp<e.maxHp/2?.7:1.1;e.vx=0}}
   else if(e.mode==='recover'&&e.timer<=0){e.mode='patrol';e.timer=.45}
  }else if(e.type==='sentry'||e.type==='drone'){
   e.dir=dx<0?-1:1;if(e.timer<.55&&e.timer>0)e.mode='windup';if(e.timer<=0){this.projectile(e,e.dir*220);e.timer=2.1;e.mode='patrol'}
  }else if(e.type==='brute'){
   e.dir=dx<0?-1:1;if(e.mode==='patrol'&&Math.abs(dx)<135&&e.timer<=0){e.mode='windup';e.timer=.6}
   else if(e.mode==='windup'&&e.timer<=0){e.mode='attack';e.timer=.28;e.vx=e.dir*310}
   else if(e.mode==='attack'){e.x+=e.vx*dt;if(e.timer<=0){e.mode='patrol';e.timer=1.3}}
   else if(Math.abs(dx)>80)e.x+=e.dir*36*dt;
  }else {e.x+=e.dir*(e.type==='runner'?92:e.type==='wisp'?45:42)*dt;if(e.x<e.home.x+18)e.dir=1;if(e.x+e.w>e.home.x+e.home.w-18)e.dir=-1;}
  if(flying)e.y=e.baseY-55+Math.sin(this.time*2.4+e.id)*16;else{e.vy+=PHYSICS.gravity*dt;e.y+=e.vy*dt;if(e.y+e.h>e.home.y){e.y=e.home.y-e.h;e.vy=0}}
  e.x=clamp(e.x,e.home.x+8,e.home.x+e.home.w-e.w-8);
  if(intersects(p,e))this.hurt((this.level.sky||this.level.lab)&&e.type==='boss'?2:1,e.x+e.w/2);
 }
 updateSkyBoss(e,dt,dx){
  e.enraged=e.hp<e.maxHp/2;e.dir=dx<0?-1:1;
  if(e.mode==='patrol'&&e.timer<=0){e.mode='windup';e.phase++;e.pattern=['charge','fan','cross'][(e.phase-1)%3];e.timer=e.enraged?.5:.7;e.aim=e.dir;this.emit('warning',{x:e.x+e.w/2,y:e.y-16,boss:true,pattern:e.pattern})}
  else if(e.mode==='windup'&&e.timer<=0){e.mode='attack';e.timer=e.enraged?.29:.32;e.vx=0;if(e.pattern==='charge'){e.vx=e.aim*(e.enraged?810:700);this.emit('bossDash',{x:e.x,y:e.y})}else if(e.pattern==='fan'){for(const dir of [-1,1])for(const vy of [0,-130,-260])this.projectile(e,dir*(e.enraged?285:245),vy);this.emit('slam',{x:e.x+e.w/2,y:e.home.y})}else{for(const dir of [-1,1]){this.projectile(e,dir*(e.enraged?390:330),0);this.projectile(e,dir*240,-200)}this.emit('slam',{x:e.x+e.w/2,y:e.home.y})}}
  else if(e.mode==='attack'){e.x+=e.vx*dt;if(e.timer<=0){e.mode='recover';e.timer=e.enraged?.85:1.15;e.vx=0}}
  else if(e.mode==='recover'&&e.timer<=0){e.mode='patrol';e.timer=e.enraged?.22:.35}
 }
 updateLabBoss(e,dt,dx){
  e.enraged=e.hp<e.maxHp/2;e.dir=dx<0?-1:1;
  if(e.mode==='patrol'&&e.timer<=0){
   e.mode='windup';e.phase++;e.pattern=['charge','fan','cross','burst'][(e.phase-1)%4];e.timer=e.enraged?.62:.8;e.aim=e.dir;e.targetX=this.player.x+this.player.w/2;
   // The aim locks at the start of the warning, so crossing behind is a real dodge.
   const distance=(e.enraged?1020:900)*.32;
   e.attackZone=e.pattern==='charge'?{x:e.aim<0?e.x-distance:e.x,y:e.home.y-e.h,w:e.w+distance,h:e.h}:{x:e.home.x,y:e.home.y-38,w:e.home.w,h:38};
   this.emit('warning',{x:e.x+e.w/2,y:e.y-18,boss:true,pattern:e.pattern,aim:e.aim,targetX:e.targetX,duration:e.timer,zone:{...e.attackZone}});
  }else if(e.mode==='windup'&&e.timer<=0){
   e.mode='attack';e.timer=.32;e.vx=0;
   if(e.pattern==='charge'){e.vx=e.aim*(e.enraged?1020:900);this.emit('bossDash',{x:e.x,y:e.y,lab:true})}
   else if(e.pattern==='fan'){for(const dir of [-1,1])for(const vy of [0,-150,-295])this.projectile(e,dir*(e.enraged?330:295),vy)}
   else if(e.pattern==='cross'){for(const dir of [-1,1]){this.projectile(e,dir*(e.enraged?440:390),0);this.projectile(e,dir*265,-225)}}
   else {for(const dir of [-1,1]){this.projectile(e,dir*(e.enraged?490:430),0);this.projectile(e,dir*320,-110);this.projectile(e,dir*240,-290)}}
   if(e.pattern!=='charge')this.emit('slam',{x:e.x+e.w/2,y:e.home.y,lab:true,pattern:e.pattern});
  }else if(e.mode==='attack'){e.x+=e.vx*dt;if(e.timer<=0){e.mode='recover';e.timer=e.enraged?1:1.25;e.vx=0}}
  else if(e.mode==='recover'&&e.timer<=0){e.mode='patrol';e.timer=e.enraged?.2:.3}
 }
 exportState(){
  const state={};for(const key of ['fallHistory','falls','godMode','usedGodMode','characterId','usedLogo','attemptSerial','time','realTime','deaths','kills','score','checkpoint','complete','hitstop','combo','comboTimer','bestCombo','attackSerial','logoAngle','player','platforms','enemies','projectiles','hazards','chests','rewardChestId','powerup','attackBoost'])state[key]=this[key];
  state.collected=[...this.collected];return JSON.parse(JSON.stringify({version:1,level:this.level.index,state}));
 }
 importState(record){
  try{
   const finite=value=>typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e9;
   const tree=(value,depth=0)=>depth<16&&(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<500||finite(value)||Array.isArray(value)&&value.length<1500&&value.every(v=>tree(v,depth+1))||value&&typeof value==='object'&&Object.keys(value).length<100&&Object.values(value).every(v=>tree(v,depth+1)));
   if(record?.version!==1||!Number.isInteger(record.level)||record.level<0||record.level>3||!tree(record))return false;
   const s=record.state,candidate=new PixelWorld(record.level),p=s?.player;
   if(!s||!['dragon','claude','logo'].includes(s.characterId)||!['godMode','usedGodMode','usedLogo','attackBoost','complete'].every(k=>typeof s[k]==='boolean')||s.complete||s.godMode&&!s.usedGodMode||s.characterId==='logo'&&(!s.godMode||!s.usedLogo))return false;
   if(!['attemptSerial','time','realTime','deaths','kills','score','checkpoint','hitstop','combo','comboTimer','bestCombo','attackSerial','logoAngle'].every(k=>finite(s[k]))||s.time<0||s.realTime<0||!Number.isInteger(s.checkpoint)||!candidate.level.checkpoints[s.checkpoint])return false;
   if(!p||!Object.keys(candidate.player).filter(k=>k!=='on').every(k=>typeof p[k]===typeof candidate.player[k])||!['x','y','w','h','vx','vy','hp','maxHp','attack','dash'].every(k=>finite(p[k]))||p.w!==22||p.h!==42||p.maxHp!==6||p.hp<=0||p.hp>6||typeof p.grounded!=='boolean'||!Number.isInteger(p.on)&&p.on!==null||p.on!==null&&!candidate.platforms.some(a=>a.id===p.on))return false;
   if(!Array.isArray(s.platforms)||s.platforms.length!==candidate.platforms.length||!s.platforms.every((a,i)=>a.id===candidate.platforms[i].id&&a.kind===candidate.platforms[i].kind&&a.w===candidate.platforms[i].w&&a.h===candidate.platforms[i].h&&finite(a.x)&&finite(a.y)&&typeof a.gone==='boolean'&&finite(a.trigger)))return false;
   if(!Array.isArray(s.enemies)||s.enemies.length!==candidate.enemies.length||!s.enemies.every((e,i)=>e.id===i&&e.type===candidate.enemies[i].type&&e.maxHp===candidate.enemies[i].maxHp&&finite(e.hp)&&e.hp>=0&&e.hp<=e.maxHp&&typeof e.dead==='boolean'&&Object.keys(candidate.enemies[i]).every(k=>typeof e[k]===typeof candidate.enemies[i][k])&&e.home&&['x','y','w'].every(k=>finite(e.home[k]))))return false;
   if(!Array.isArray(s.hazards)||s.hazards.length!==candidate.hazards.length||!s.hazards.every((h,i)=>h.kind===candidate.hazards[i].kind&&h.rect&&['x','y','w','h'].every(k=>finite(h.rect[k]))))return false;
   if(!Array.isArray(s.collected)||new Set(s.collected).size!==s.collected.length||!s.collected.every(i=>Number.isInteger(i)&&i>=0&&i<candidate.level.coins.length)||!Array.isArray(s.projectiles)||!s.projectiles.every(b=>['x','y','w','h','vx','vy','life'].every(k=>finite(b[k]))&&['enemy','player'].includes(b.owner)))return false;
   if(!Array.isArray(s.chests)||s.chests.length!==candidate.chests.length||!s.chests.every((c,i)=>c.id===i&&c.platformId===candidate.chests[i].platformId&&finite(c.x)&&finite(c.y)&&['opened','reward','collected'].every(k=>typeof c[k]==='boolean')&&(!c.collected||c.opened&&c.reward))||s.chests.filter(c=>c.reward).length!==1||s.rewardChestId!==s.chests.find(c=>c.reward).id||s.attackBoost&&!s.chests.some(c=>c.reward&&c.collected))return false;
   if(s.powerup!==null&&(!s.powerup||!s.chests.some(c=>c.id===s.powerup.chestId&&c.reward&&c.opened&&!c.collected)||!['x','y','w','h'].every(k=>finite(s.powerup[k]))))return false;
   if(s.falls!==undefined&&(!Number.isInteger(s.falls)||s.falls<0||s.falls>1e7)||!candidate.restoreFallHistory(s.fallHistory))return false;
   const data=JSON.parse(JSON.stringify(s));for(const key of Object.keys(candidate))if(key!=='level'&&key!=='collected'&&key!=='events'&&key!=='previous'&&Object.hasOwn(data,key))candidate[key]=data[key];candidate.collected=new Set(s.collected);candidate.events=[];candidate.previous={};candidate.updateChests();candidate.restoreFallHistory(s.fallHistory);if(s.fallHistory===undefined)candidate.rememberFallPoint();Object.assign(this,candidate);return true;
  }catch{return false}
 }
 snapshot(){return {falls:this.falls,fallHistory:this.fallHistory.map(q=>({...q})),godMode:this.godMode,usedGodMode:this.usedGodMode,characterId:this.characterId,usedLogo:this.usedLogo,logoActive:this.logoActive,attempt:this.attemptSerial,level:this.level.index,length:this.level.length,platforms:this.level.ground.length,enemies:this.enemies.length,remaining:this.enemies.filter(e=>!e.dead).length,kills:this.kills,score:this.score,collected:this.collected.size,attackBoost:this.attackBoost,attackMultiplier:this.attackMultiplier,chests:this.chests.map(c=>({...c})),powerup:this.powerup?{...this.powerup}:null,checkpoint:this.checkpoint,checkpointCount:this.level.checkpoints.length,time:this.time,hitstop:this.hitstop,combo:this.combo,bestCombo:this.bestCombo,deaths:this.deaths,complete:this.complete,player:{...this.player},boss:this.enemies.find(e=>e.type==='boss')};}
}
