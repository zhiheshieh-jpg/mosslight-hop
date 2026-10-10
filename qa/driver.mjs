import {mechanismPhase,crusherHeight,platformToLocal} from '../dist/physics.js';
// QA pilot uses only movement and jump inputs. It never moves the player or changes mechanics.
export function routeDriver(){
 let landed=0,deathCount=0,jumpUntil=-1,crossing=null;
 return w=>{
  const p=w.player;
  if(w.deaths!==deathCount){deathCount=w.deaths;crossing=null;jumpUntil=-1}
  if(p.grounded&&p.on!==null)landed=p.on;
  const a=w.platforms[landed],last=landed===w.platforms.length-1;
  let target=w.platforms[Math.min(landed+1,w.platforms.length-1)],tx=target.x,tz=last?target.z-1.5:target.z;
  if(!last&&['sweeper','crusher','laser'].includes(target.kind))tz=target.z+target.d/2-.42;
  if(['sweeper','laser'].includes(a.kind)&&p.z>a.z-1.5){crossing=a.id}
  if(crossing!==null){
   const c=w.platforms[crossing];
   if(p.grounded&&p.on===c.id&&p.z<c.z-1.4){crossing=null}
   else {target=c;tx=c.x;tz=c.z-1.8}
  }
  let dx=tx-p.x,dz=tz-p.z,len=Math.hypot(dx,dz),ix=dx/(len||1),iz=dz/(len||1),jump=false,wait=false;
  if(!p.grounded){ix=dx*1.8-p.vx*.1;iz=dz*1.8-p.vz*.1}
  if(p.grounded){
   const q=platformToLocal(a,p.x,p.z),v=platformToLocal(a,a.x+ix,a.z+iz);
   const ex=v.x>0?(a.w/2-.38-q.x)/v.x:v.x<0?(-a.w/2+.38-q.x)/v.x:Infinity;
   const ez=v.z>0?(a.d/2-.38-q.z)/v.z:v.z<0?(-a.d/2+.38-q.z)/v.z:Infinity;
   const edge=Math.min(ex,ez);
   if(target.id!==a.id&&!last)jump=edge<.72;
   if(crossing===a.id)jump=true;
   if(a.kind==='crusher'&&p.z>a.z+1.35){wait=a.warning||crusherHeight(a,w.time+.75)<2.1||a.pressY<2.1}
   if(target.kind==='pulse'&&target.id!==a.id&&edge<1.4){wait=mechanismPhase(target,w.time+.75)>.59||mechanismPhase(target,w.time+1.15)>.76}
   if(wait){ix=-p.vx*.4;iz=-p.vz*.4;jump=false}
  }
  if(jump&&w.time>=jumpUntil){jumpUntil=w.time+.16}else jump=false;
  return {x:Math.abs(ix)<.12?0:Math.sign(ix),z:Math.abs(iz)<.12?0:Math.sign(iz),jump};
 };
}
