import {makeCollectibles,collectionStats} from './collection.js';
import {PALACE_LEVEL} from './palace-level.js';
import {LAB_LEVEL} from './lab-level.js';
export const SPEED=7.6, JUMP=10.5, GRAVITY=25, RADIUS=.32, HEIGHT=1.55;
const platform=(x,z,y,w,d,kind='solid',extra={})=>({x,z,y,w,d,kind,...extra});
export const LEVELS=[
 {name:'林间来信',subtitle:'跨过林间长隙，踏着旋转浮岛向前',checkpoints:[4,9,14,18],platforms:[
 platform(0,0,0,9,8.5),
 platform(0,-10.8,.2,6.6,5),
 platform(-2,-19.6,.6,6.4,5),
 platform(-2,-28.4,.9,6.8,4.2,'rotating',{period:12,direction:1}),
 platform(0,-37.6,.9,8,6.4),
 platform(3,-47.3,1.3,6.2,5),
 platform(1,-56.5,1.7,6.2,5),
 platform(-1,-65.3,2,6.8,4.2,'rotating',{period:11,direction:-1,offset:2}),
 platform(-3,-74.1,1.8,6.2,5),
 platform(0,-83.4,1.8,8,6.4),
 platform(3,-93,2.2,6,5),
 platform(2,-101.8,2.5,6.8,4.2,'rotating',{period:10,direction:1,offset:1}),
 platform(-1,-110.6,2.8,6,5),
 platform(-3,-119.6,2.5,6,5),
 platform(0,-129,2.5,8,6.4),
 platform(3,-138.8,2.9,6,5),
 platform(2,-147.6,3.2,6.8,4.2,'rotating',{period:9.5,direction:-1,offset:3}),
 platform(-1,-156.4,3.5,6,5),
 platform(-3,-165.8,3.5,8,6.4),
 platform(0,-175.4,3.9,6,5),
 platform(2,-184.2,4.2,6.8,4.2,'rotating',{period:9,direction:1,offset:2}),
 platform(0,-194.8,4.2,10,8)]},
 {name:'霓虹天际',subtitle:'观察机关节奏，穿越整座夜城',checkpoints:[4,9,14,19,24],crystals:[2,5,7,10,12],platforms:[
 platform(0,0,0,8,8),
 platform(0,-7.5,.5,4.5,4),
 platform(3,-14,1,4,4,'moving',{amp:1.4,period:5.5}),
 platform(0,-20.5,1.6,5.4,5.8,'sweeper',{period:4.4}),
 platform(-3,-27,1.2,7,6),
 platform(-3,-35,1.5,4.2,4.2,'crumble'),
 platform(1,-41.5,2,4.1,4.1,'moving',{amp:1.3,period:6}),
 platform(3,-48,2.4,4.3,4.3,'crumble'),
 platform(0,-54.5,2,4.8,4.8,'crusher',{period:4.8}),
 platform(-3,-61.5,2.4,7,6),
 platform(0,-69,2.8,5,5,'laser',{period:4.2}),
 platform(3,-76.5,3.2,4,4,'moving',{amp:1.1,period:5}),
 platform(0,-83,3.6,4.3,4.3,'crumble'),
 platform(-3,-89.5,4,4.5,4.5),
 platform(0,-97,4,7,6),
 platform(3,-104.5,4.4,5.4,5.8,'sweeper',{period:3.9}),
 platform(-1,-111.5,4.8,4.8,4.8,'crusher',{period:4.6,offset:1.1}),
 platform(-4,-118.8,5.2,4,4.2,'moving',{amp:1.3,period:4.8}),
 platform(0,-126,5.6,4.6,4.6,'pulse',{period:5.4}),
 platform(3,-133.5,5.4,7,6),
 platform(0,-141,5.9,5,5,'laser',{period:3.8}),
 platform(-3,-148,6.3,5.4,5.8,'sweeper',{period:3.5,offset:1.4}),
 platform(0,-155,6.6,4.8,4.8,'crusher',{period:4.4,offset:2.1}),
 platform(3,-162.2,7,4,4.2,'crumble'),
 platform(-1,-169.5,6.8,7,6),
 platform(-4,-177,7.3,4.2,4.2,'moving',{amp:1.4,period:4.6}),
 platform(0,-184.5,7.8,4.6,4.6,'pulse',{period:5.6,offset:1.2}),
 platform(3,-192,8.1,5.4,5.8,'sweeper',{period:3.3}),
 platform(0,-199.5,8.4,5,5,'laser',{period:4.4}),
 platform(0,-207,8.4,10,9)]}
,PALACE_LEVEL,LAB_LEVEL];
// A rotating deck uses the same local frame for physics, pickups and rendering.
export function platformToLocal(a,x,z){const angle=a.kind==='rotating'?(a.angle||0):0,c=Math.cos(angle),s=Math.sin(angle),dx=x-a.x,dz=z-a.z;return {x:dx*c-dz*s,z:dx*s+dz*c}}
export function platformToWorld(a,x,z){const angle=a.kind==='rotating'?(a.angle||0):0,c=Math.cos(angle),s=Math.sin(angle);return {x:a.x+x*c+z*s,z:a.z-x*s+z*c}}
export function platformContains(a,x,z,margin=0){const q=platformToLocal(a,x,z);return Math.abs(q.x)<a.w/2+margin&&Math.abs(q.z)<a.d/2+margin}
export function mechanismPhase(a,time){return ((time+(a.offset||0))%a.period+a.period)%a.period/a.period}
export function crusherHeight(a,time){const phase=mechanismPhase(a,time);return phase<.66?3.4:phase<.74?3.4-(phase-.66)/.08*3.3:phase<.85?.1:.1+(phase-.85)/.15*3.3}
export function updateMechanism(a,time){
 a.warning=false;
 if(a.kind==='laser'){const seconds=mechanismPhase(a,time)*a.period,safe=a.safeDuration??1.9;a.laserOn=seconds>safe;a.warning=seconds>safe-(a.warningDuration??.65)&&!a.laserOn}
 if(a.kind==='sweeper')a.angle=(time+(a.offset||0))*Math.PI*2/a.period;
 if(a.kind==='rotating')a.angle=(time+(a.offset||0))*Math.PI*2/a.period*(a.direction||1);
 if(a.kind==='crusher'){const phase=mechanismPhase(a,time);a.pressY=crusherHeight(a,time);a.warning=phase>=.46&&phase<.66}
 if(a.kind==='pulse'){const phase=mechanismPhase(a,time);a.gone=phase>=.76;a.warning=phase>=.59&&phase<.76}
}
export function platformHurtsPlayer(a,p){
 const dx=p.x-a.x,dz=p.z-a.z,low=p.y<a.y+1.05&&p.y+HEIGHT>a.y+.35;
 const laser=a.kind==='laser'&&a.laserOn&&Math.abs(dx)<a.w/2+.2&&Math.abs(dz)<.23+RADIUS&&low;
 const sweep=a.kind==='sweeper'&&Math.abs(dx*Math.cos(a.angle)+dz*Math.sin(a.angle))<Math.min(a.w,a.d)*.3+RADIUS&&Math.abs(-dx*Math.sin(a.angle)+dz*Math.cos(a.angle))<.12+RADIUS&&p.y<a.y+.78&&p.y+HEIGHT>a.y+.5;
 const press=a.kind==='crusher'&&Math.abs(dx)<1.05+RADIUS&&Math.abs(dz)<.9+RADIUS&&p.y+HEIGHT>a.y+a.pressY&&p.y<a.y+a.pressY+.65;
 return !!(laser||sweep||press);
}
export class GameWorld {
 constructor(level=0,character='dragon'){this.character=character==='claude'?'claude':'dragon';this.lastNormalCharacter=this.character;this.reset(level)}
 reset(level){if(this.character==='logo')this.character=this.lastNormalCharacter||'dragon';this.level=level;this.def=LEVELS[level];this.restartFromStart=!!(this.def.sky||this.def.restartFromStart);this.dashTime=0;this.dashDirection={x:0,y:0,z:-1};this.time=0;this.attemptTime=0;this.deaths=0;this.godMode=false;this.usedGodMode=false;this.collected=new Set;this.collectibles=makeCollectibles(level);this.checkpoint=0;this.farthest=0;this.complete=false;this.events=[];this.platforms=this.def.platforms.map((p,i)=>{const a={...p,id:i,baseX:p.x,dx:0,triggerAt:null,gone:false,laserOn:false,recoveryUntil:-1};updateMechanism(a,0);return a});this.flightBounds={minX:Math.min(...this.platforms.map(a=>a.x-a.w/2))-18,maxX:Math.max(...this.platforms.map(a=>a.x+a.w/2))+18,minY:-8,maxY:Math.max(...this.platforms.map(a=>a.y))+18,minZ:this.platforms.at(-1).z-14,maxZ:14};this.player={x:0,y:0,z:1.3,vx:0,vz:0,vy:0,grounded:true,on:0,coyote:.14,buffer:0,facing:0,hp:6,maxHp:6};this.respawnGrace=.6;this.jumpHeld=false;this.falls=0;this.fallHistory=[{id:0,x:0,z:1.3}];this.fallRecordAt=-1;}
 emit(type,data={}){this.events.push({type,...data})}
 fallPoint(anchor){
  const a=this.platforms[anchor.id];if(!a)return null;
  return {...platformToWorld(a,anchor.x,anchor.z),y:a.y,on:a.id};
 }
 rememberFallPoint(){
  const p=this.player,a=this.platforms[p.on];
  if(this.godMode||!p.grounded||!a||a.gone||!platformContains(a,p.x,p.z,RADIUS*.72)||Math.abs(p.y-a.y)>.05)return;
  const anchor={id:a.id,...platformToLocal(a,p.x,p.z)},history=this.fallHistory,last=history.at(-1);
  if(last?.id===a.id)history[history.length-1]=anchor;else history.push(anchor);
  if(history.length>128)history.shift();
 }
 restoreFallHistory(history){
  if(history!==undefined&&(!Array.isArray(history)||history.length>128||!history.every(q=>q&&Number.isInteger(q.id)&&this.platforms[q.id]&&Number.isFinite(q.x)&&Number.isFinite(q.z)&&Math.abs(q.x)<=this.platforms[q.id].w/2+RADIUS&&Math.abs(q.z)<=this.platforms[q.id].d/2+RADIUS)))return false;
  this.fallHistory=history?.map(q=>({id:q.id,x:q.x,z:q.z}))||[{id:0,x:0,z:1.3}];this.fallRecordAt=-1;return true;
 }
 recoverFall(){
  const p=this.player;this.falls++;p.hp=Math.max(0,p.hp-2);
  if(p.hp===0){this.respawn();return}
  const point=this.fallPoint(this.fallHistory.at(-1)||{id:0,x:0,z:1.3});
  if(!point){this.respawn();return}
  const a=this.platforms[point.on];if(a.kind==='crumble'){a.triggerAt=this.attemptTime;a.gone=false}if(a.kind==='pulse'){a.recoveryUntil=this.attemptTime+1.5;a.gone=false}
  Object.assign(p,{x:point.x,y:point.y,z:point.z,vx:0,vy:0,vz:0,grounded:true,on:point.on,coyote:.14,buffer:0});
  this.jumpHeld=false;this.dashTime=0;this.respawnGrace=1.5;this.fallRecordAt=-1;this.rememberFallPoint();
  this.emit('fallRecovered',{x:p.x,y:p.y,z:p.z,platform:p.on,damage:2,hp:p.hp});
 }
 setCharacter(id){if(!['dragon','claude','logo'].includes(id)||id==='logo'&&!this.godMode)return false;this.character=id;if(id!=='logo')this.lastNormalCharacter=id;this.dashTime=0;return true}
 setGodMode(enabled){const next=!!enabled;if(this.godMode===next)return;this.godMode=next;this.usedGodMode||=next;this.dashTime=0;if(!next&&this.character==='logo')this.character=this.lastNormalCharacter||'dragon';const p=this.player;p.vy=0;p.buffer=0;p.coyote=0;this.jumpHeld=false;if(next){p.grounded=false;p.on=null}else{p.grounded=false;p.on=null;for(const a of this.platforms){if(a.gone||!platformContains(a,p.x,p.z,RADIUS*.72))continue;if(p.y<a.y&&p.y+HEIGHT>a.y-.65){p.y=a.y;p.grounded=true;p.on=a.id;break}}}this.emit('godMode',{enabled:next})}
 respawn(){this.dashTime=0;this.deaths++;if(this.restartFromStart){this.checkpoint=0;this.farthest=0;this.attemptTime=0;this.collected.clear();for(const a of this.platforms){Object.assign(a,this.def.platforms[a.id],{x:a.baseX,dx:0,dAngle:0,triggerAt:null,gone:false,laserOn:false,angle:0,recoveryUntil:-1});updateMechanism(a,0)}}const c=this.platforms[this.checkpoint],p=this.player;Object.assign(p,{x:c.x,y:c.y,z:this.restartFromStart?1.3:c.z+.5,vx:0,vz:0,vy:0,grounded:true,on:c.id,coyote:.14,buffer:0,hp:p.maxHp});if(this.restartFromStart)this.jumpHeld=false;this.respawnGrace=.8;this.fallHistory=[];this.fallRecordAt=-1;this.rememberFallPoint();this.emit('respawn',{restarted:!!this.restartFromStart});}
 collect(){const p=this.player;for(const item of this.collectibles){if(this.collected.has(item.id))continue;const a=this.platforms[item.platform];if(a.gone)continue;const {x,z}=platformToWorld(a,item.x,item.z),y=a.y+item.y;if(Math.hypot(p.x-x,p.z-z)<.82&&Math.abs(p.y+HEIGHT*.6-y)<1.05){this.collected.add(item.id);this.emit('pickup',{item,x,y,z});if(this.collected.size===this.collectibles.length)this.emit('allCollected')}}}
 finishAtExit(){const p=this.player,end=this.platforms.at(-1),near=Math.hypot(p.x-end.x,p.z-(end.z-1.5))<1.0;if(near&&(this.godMode?Math.abs(p.y-end.y)<2.6:p.grounded&&p.on===end.id)){this.complete=true;this.emit('complete')}}
 step(dt,input={}){if(this.complete)return;this.rememberFallPoint();dt=Math.min(dt,1/30);this.time+=dt;this.attemptTime=this.restartFromStart?this.attemptTime+dt:this.time;const mechanismTime=this.attemptTime;this.respawnGrace=Math.max(0,this.respawnGrace-dt);const p=this.player;for(const a of this.platforms){const old=a.x,oldAngle=a.angle||0;if(a.kind==='moving')a.x=a.baseX+Math.sin(mechanismTime*Math.PI*2/a.period)*a.amp;a.dx=a.x-old;if(a.kind==='crumble'&&a.triggerAt!==null){const age=mechanismTime-a.triggerAt,delay=a.crumbleDelay??1.15,restore=a.restoreDelay??4.2;a.gone=age>delay&&age<restore;if(age>=restore){a.triggerAt=null;a.gone=false}}updateMechanism(a,mechanismTime);if((a.recoveryUntil??-1)>mechanismTime)a.gone=false;a.dAngle=(a.angle||0)-oldAngle;}
 if(this.godMode){let ix=input.x||0,iy=input.y||0,iz=input.z||0;const length=Math.hypot(ix,iy,iz);if(length>1){ix/=length;iy/=length;iz/=length}const logo=this.character==='logo';this.dashTime=Math.max(0,this.dashTime-dt);if(logo&&input.dash&&this.dashTime===0){this.dashTime=.28;const n=Math.hypot(ix,iy,iz);this.dashDirection=n>.1?{x:ix/n,y:iy/n,z:iz/n}:{x:Math.sin(p.facing),y:0,z:Math.cos(p.facing)};this.emit('dash')}const speed=logo?18.5:10.5,blend=1-Math.exp(-18*dt);if(logo&&this.dashTime>0){p.vx=this.dashDirection.x*38;p.vy=this.dashDirection.y*38;p.vz=this.dashDirection.z*38}else{p.vx+=(ix*speed-p.vx)*blend;p.vy+=(iy*speed-p.vy)*blend;p.vz+=(iz*speed-p.vz)*blend}const b=this.flightBounds;p.x=Math.max(b.minX,Math.min(b.maxX,p.x+p.vx*dt));p.y=Math.max(b.minY,Math.min(b.maxY,p.y+p.vy*dt));p.z=Math.max(b.minZ,Math.min(b.maxZ,p.z+p.vz*dt));p.grounded=false;p.on=null;p.coyote=0;p.buffer=0;this.jumpHeld=!!input.jump;if(Math.hypot(p.vx,p.vz)>.3)p.facing=Math.atan2(p.vx,p.vz);for(const a of this.platforms)if(p.z<=a.z)this.farthest=Math.max(this.farthest,a.id);this.collect();this.finishAtExit();return}
 if(p.grounded&&p.on!==null){const a=this.platforms[p.on];p.x+=a.dx;if(a.kind==='rotating'){const dx=p.x-a.x,dz=p.z-a.z,c=Math.cos(a.dAngle),s=Math.sin(a.dAngle);p.x=a.x+dx*c+dz*s;p.z=a.z-dx*s+dz*c;p.facing+=a.dAngle}if(a.gone){p.grounded=false;p.on=null;p.coyote=0}}
 const jump=!!input.jump;if(jump&&!this.jumpHeld)p.buffer=.15;this.jumpHeld=jump;p.buffer=Math.max(0,p.buffer-dt);p.coyote=p.grounded?.14:Math.max(0,p.coyote-dt);
 let ix=input.x||0,iz=input.z||0;const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len}const blend=1-Math.exp(-(p.grounded?20:10)*dt);p.vx+=(ix*SPEED-p.vx)*blend;p.vz+=(iz*SPEED-p.vz)*blend;
 if(p.buffer>0&&p.coyote>0){p.vy=JUMP;p.grounded=false;p.on=null;p.coyote=0;p.buffer=0;this.emit('jump')}
 const oldY=p.y,oldX=p.x,oldZ=p.z;p.x+=p.vx*dt;p.z+=p.vz*dt;if(Math.hypot(p.vx,p.vz)>.3)p.facing=Math.atan2(p.vx,p.vz);p.vy-=GRAVITY*dt;p.y+=p.vy*dt;p.grounded=false;p.on=null;
 for(const a of this.platforms){if(a.gone)continue;if(!platformContains(a,p.x,p.z,RADIUS*.72))continue;if(p.vy<=0&&oldY>=a.y-.06&&p.y<=a.y){p.y=a.y;p.vy=0;p.grounded=true;p.on=a.id;this.farthest=Math.max(this.farthest,a.id);if(a.kind==='crumble'&&a.triggerAt===null){a.triggerAt=mechanismTime;this.emit('crumble')}if(this.def.checkpoints.includes(a.id)&&a.id>this.checkpoint){this.checkpoint=a.id;p.hp=p.maxHp;this.emit('checkpoint')}break;}
 // Solid side walls prevent entering the slab from below or from its sides.
 if(p.y<a.y-.07&&p.y+HEIGHT>a.y-.65){if(p.vy>0&&oldY+HEIGHT<=a.y-.65){p.y=a.y-.65-HEIGHT;p.vy=0}else{const before=platformToLocal(a,oldX,oldZ),now=platformToLocal(a,p.x,p.z);if(Math.abs(before.x)>=a.w/2+RADIUS*.7)now.x=before.x;else if(Math.abs(before.z)>=a.d/2+RADIUS*.7)now.z=before.z;else continue;Object.assign(p,platformToWorld(a,now.x,now.z));p.vx=p.vz=0}}}
 this.collect();
 if(this.respawnGrace<=0){for(const a of this.platforms){
  if(platformHurtsPlayer(a,p)){this.respawn();return}
 }}
 if(p.y<-12){this.recoverFall();return}this.rememberFallPoint();this.finishAtExit();
 }
 stats(){return collectionStats(this.collectibles,this.collected)}
 drain(){return this.events.splice(0)}
}
