import {hazardState} from '../dist/2d/world.js';
// Fixed-step observer: reads state and returns only real gameplay inputs.
export function skyDriver(){
 let jumpRelease=0,lastDeath=0,crossing=null,hazardCross=null,combatJump=false,dashCommit=0,dashDir=1,lastTick=-1,lastInput=null;
 return w=>{
  const p=w.player,t=w.realTime;
  // A 30 Hz observer also proves the route does not require frame-perfect input.
  const tick=Math.floor((t+1e-7)*30);if(tick===lastTick&&lastInput)return lastInput;lastTick=tick;
  if(w.deaths!==lastDeath){lastDeath=w.deaths;crossing=null;hazardCross=null;combatJump=false;jumpRelease=t+.1}
  let x=1,jump=false,dash=false,attack=true;
  const interact=w.chests.some(c=>!c.opened&&Math.hypot(p.x+p.w/2-c.x-12,p.y+p.h/2-c.y+10)<75);
  const floor=w.platforms.find(a=>!a.gone&&['ground','crumble'].includes(a.kind)&&p.x+p.w/2>=a.x&&p.x+p.w/2<a.x+a.w);
  const on=w.platforms.find(a=>a.id===p.on);
  const next=w.platforms.filter(a=>!a.gone&&['ground','crumble'].includes(a.kind)&&a.x>p.x+p.w/2).sort((a,b)=>a.x-b.x)[0];
  if(crossing&&p.grounded){crossing=null;combatJump=false}
  if(crossing){
   x=1;attack=false;
   if(p.jumps>0&&p.vy>40&&p.x+p.w<crossing.x+15)jump=true;
   if(p.jumps===0&&p.vy>80&&p.x+p.w<crossing.x-30&&p.dashCooldown<=0)dash=true;
  }else{
   const foes=w.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<(e.type==='boss'?1500:250)&&Math.abs(e.y-p.y)<200&&(!floor||e.home.section===floor.section));
   const foe=foes.sort((a,b)=>(['wisp','drone'].includes(a.type)?1:0)-(['wisp','drone'].includes(b.type)?1:0)||Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
   if(foe){
    const dx=foe.x+foe.w/2-(p.x+p.w/2),dist=Math.abs(dx),desired=foe.w/2+50;
    x=dist>desired?Math.sign(dx):0;
    if(x===0&&p.face!==Math.sign(dx))x=Math.sign(dx);
    if(['wisp','drone'].includes(foe.type)&&p.grounded&&dist<100){jump=true;combatJump=true}
    if(foe.type==='boss'&&foe.mode==='windup'&&foe.pattern==='charge'&&foe.timer<.16&&dist<200&&p.dashCooldown<=0){dash=true;dashDir=Math.sign(dx);dashCommit=t+.24}
    if(foe.type==='boss'&&foe.mode==='attack'&&foe.pattern==='charge'&&dist<110&&p.dashCooldown<=0){dash=true;dashDir=Math.sign(dx);dashCommit=t+.24}if(foe.type==='boss'&&dashCommit>t)x=dashDir;
    if(foe.type==='brute'&&foe.mode==='windup'&&foe.timer<.16&&dist<170&&p.dashCooldown<=0){dash=true;dashDir=Math.sign(dx);dashCommit=t+.24}
    if(dashCommit>t)x=dashDir;
   }else if(combatJump&&!p.grounded){x=0;attack=false}else if(p.grounded)combatJump=false;
   if(!foe&&!combatJump){
    const hazard=w.hazards.find(h=>p.x<h.x+h.w+(h.travel||0)+12&&h.x-p.x<190&&h.section===floor?.section);
    if(hazard){
     const left=hazard.x-(hazard.travel||0),right=hazard.x+hazard.w+(hazard.travel||0);
     if(hazardCross===hazard.id&&p.x>right+8)hazardCross=null;
     if(hazardCross!==hazard.id){
      const waitX=left-p.w-38;
      if(p.x>=waitX-5){
       const transit=(right+12-p.x)/240+.15;
       let safe=true;for(let dt=0;dt<transit;dt+=.04)if(hazardState(hazard,w.time+dt).active)safe=false;
       if(safe)hazardCross=hazard.id;else {x=p.x>waitX+3?-1:0;attack=false}
      }
     }
    }
    if(x>0&&on&&['ground','crumble'].includes(on.kind)&&p.grounded&&on.x+on.w-(p.x+p.w)<35&&next){jump=true;crossing=next;attack=false}
   }
  }
  if(jump&&t>=jumpRelease)jumpRelease=t+.13;else jump=false;
  return lastInput={x,jump,attack,dash,interact};
 };
}
export const pixelDriver=skyDriver;
