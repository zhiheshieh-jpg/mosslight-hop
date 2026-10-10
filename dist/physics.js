import {makeCollectibles,collectionStats} from './collection.js';
export const SPEED=7.6, JUMP=10.5, GRAVITY=25, RADIUS=.32, HEIGHT=1.55;
const platform=(x,z,y,w,d,kind='solid',extra={})=>({x,z,y,w,d,kind,...extra});
export const LEVELS=[
 {name:'林间来信',subtitle:'跟着微光，抵达林间光门',checkpoints:[4,8],crystals:[1,3,5,7,10],platforms:[
 platform(0,0,0,10.8,9.9),platform(0,-8,.2,7.2,5.5),platform(-3,-14.5,.8,7.2,5.5),platform(-4,-21,1.2,7.2,5.5),platform(0,-27.5,1,9.6,6.6),platform(3,-35,1.5,6.72,5.5),platform(0,-41.5,1.9,7.2,5.5),platform(-3,-48,1.5,6.72,5.5),platform(0,-55,1.8,9.6,6.6),platform(3,-62.5,2.3,6.6,5.5),platform(0,-69,2.8,6.6,5.5),platform(0,-77,2.8,12,9.9)]},
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
];
export function mechanismPhase(a,time){return ((time+(a.offset||0))%a.period+a.period)%a.period/a.period}
export function crusherHeight(a,time){const phase=mechanismPhase(a,time);return phase<.66?3.4:phase<.74?3.4-(phase-.66)/.08*3.3:phase<.85?.1:.1+(phase-.85)/.15*3.3}
export function updateMechanism(a,time){
 a.warning=false;
 if(a.kind==='laser'){const seconds=mechanismPhase(a,time)*a.period;a.laserOn=seconds>1.9;a.warning=seconds>1.25&&!a.laserOn}
 if(a.kind==='sweeper')a.angle=(time+(a.offset||0))*Math.PI*2/a.period;
 if(a.kind==='crusher'){const phase=mechanismPhase(a,time);a.pressY=crusherHeight(a,time);a.warning=phase>=.46&&phase<.66}
 if(a.kind==='pulse'){const phase=mechanismPhase(a,time);a.gone=phase>=.76;a.warning=phase>=.59&&phase<.76}
}
export class GameWorld {
 constructor(level=0){this.reset(level)}
 reset(level){this.level=level;this.def=LEVELS[level];this.time=0;this.deaths=0;this.collected=new Set;this.collectibles=makeCollectibles(level);this.checkpoint=0;this.farthest=0;this.complete=false;this.events=[];this.platforms=this.def.platforms.map((p,i)=>{const a={...p,id:i,baseX:p.x,dx:0,triggerAt:null,gone:false,laserOn:false};updateMechanism(a,0);return a});this.player={x:0,y:0,z:1.3,vx:0,vz:0,vy:0,grounded:true,on:0,coyote:.14,buffer:0,facing:0};this.respawnGrace=.6;this.jumpHeld=false;}
 emit(type,data={}){this.events.push({type,...data})}
 respawn(){this.deaths++;const c=this.platforms[this.checkpoint],p=this.player;Object.assign(p,{x:c.x,y:c.y,z:c.z+.5,vx:0,vz:0,vy:0,grounded:true,on:c.id,coyote:.14,buffer:0});this.respawnGrace=.8;this.emit('respawn');}
 step(dt,input={}){if(this.complete)return;dt=Math.min(dt,1/30);this.time+=dt;this.respawnGrace=Math.max(0,this.respawnGrace-dt);const p=this.player;for(const a of this.platforms){const old=a.x;if(a.kind==='moving')a.x=a.baseX+Math.sin(this.time*Math.PI*2/a.period)*a.amp;a.dx=a.x-old;if(a.kind==='crumble'&&a.triggerAt!==null){const age=this.time-a.triggerAt;a.gone=age>1.15&&age<4.2;if(age>=4.2){a.triggerAt=null;a.gone=false}}updateMechanism(a,this.time);}
 if(p.grounded&&p.on!==null){const a=this.platforms[p.on];p.x+=a.dx;if(a.gone){p.grounded=false;p.on=null;p.coyote=0}}
 const jump=!!input.jump;if(jump&&!this.jumpHeld)p.buffer=.15;this.jumpHeld=jump;p.buffer=Math.max(0,p.buffer-dt);p.coyote=p.grounded?.14:Math.max(0,p.coyote-dt);
 let ix=input.x||0,iz=input.z||0;const len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len}const blend=1-Math.exp(-(p.grounded?20:10)*dt);p.vx+=(ix*SPEED-p.vx)*blend;p.vz+=(iz*SPEED-p.vz)*blend;
 if(p.buffer>0&&p.coyote>0){p.vy=JUMP;p.grounded=false;p.on=null;p.coyote=0;p.buffer=0;this.emit('jump')}
 const oldY=p.y,oldX=p.x,oldZ=p.z;p.x+=p.vx*dt;p.z+=p.vz*dt;if(Math.hypot(p.vx,p.vz)>.3)p.facing=Math.atan2(p.vx,p.vz);p.vy-=GRAVITY*dt;p.y+=p.vy*dt;p.grounded=false;p.on=null;
 for(const a of this.platforms){if(a.gone)continue;const overlap=Math.abs(p.x-a.x)<a.w/2+RADIUS*.72&&Math.abs(p.z-a.z)<a.d/2+RADIUS*.72;if(!overlap)continue;if(p.vy<=0&&oldY>=a.y-.06&&p.y<=a.y){p.y=a.y;p.vy=0;p.grounded=true;p.on=a.id;this.farthest=Math.max(this.farthest,a.id);if(a.kind==='crumble'&&a.triggerAt===null){a.triggerAt=this.time;this.emit('crumble')}if(this.def.checkpoints.includes(a.id)&&a.id>this.checkpoint){this.checkpoint=a.id;this.emit('checkpoint')}break;}
 // Solid side walls prevent entering the slab from below or from its sides.
 if(p.y<a.y-.07&&p.y+HEIGHT>a.y-.65){if(p.vy>0&&oldY+HEIGHT<=a.y-.65){p.y=a.y-.65-HEIGHT;p.vy=0}else if(Math.abs(oldX-a.x)>=a.w/2+RADIUS*.7){p.x=oldX;p.vx=0}else if(Math.abs(oldZ-a.z)>=a.d/2+RADIUS*.7){p.z=oldZ;p.vz=0}}}
 for(const item of this.collectibles){if(this.collected.has(item.id))continue;const a=this.platforms[item.platform];if(a.gone)continue;const x=a.x+item.x,z=a.z+item.z,y=a.y+item.y;if(Math.hypot(p.x-x,p.z-z)<.82&&Math.abs(p.y+HEIGHT*.6-y)<1.05){this.collected.add(item.id);this.emit('pickup',{item,x,y,z});if(this.collected.size===this.collectibles.length)this.emit('allCollected')}}
 if(this.respawnGrace<=0){for(const a of this.platforms){
  const dx=p.x-a.x,dz=p.z-a.z,low=p.y<a.y+1.05&&p.y+HEIGHT>a.y+.35;
  const laser=a.kind==='laser'&&a.laserOn&&Math.abs(dx)<a.w/2+.2&&Math.abs(dz)<.23+RADIUS&&low;
  const sweep=a.kind==='sweeper'&&Math.abs(dx*Math.cos(a.angle)+dz*Math.sin(a.angle))<Math.min(a.w,a.d)*.3+RADIUS&&Math.abs(-dx*Math.sin(a.angle)+dz*Math.cos(a.angle))<.12+RADIUS&&p.y<a.y+.78&&p.y+HEIGHT>a.y+.5;
  const press=a.kind==='crusher'&&Math.abs(dx)<1.05+RADIUS&&Math.abs(dz)<.9+RADIUS&&p.y+HEIGHT>a.y+a.pressY&&p.y<a.y+a.pressY+.65;
  if(laser||sweep||press){this.respawn();return}
 }}
 if(p.y<-12){this.respawn();return}const end=this.platforms.at(-1);if(p.grounded&&p.on===end.id&&Math.hypot(p.x-end.x,p.z-(end.z-1.5))<1.0){this.complete=true;this.emit('complete')}
 }
 stats(){return collectionStats(this.collectibles,this.collected)}
 drain(){return this.events.splice(0)}
}
