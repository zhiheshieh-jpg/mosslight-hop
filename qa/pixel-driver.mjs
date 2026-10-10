// Route pilot sends only normal movement, jump, slash and dash inputs.
export function pixelDriver(){let jumpRelease=0,lastDeath=0;
 return w=>{const p=w.player,t=w.realTime;if(lastDeath!==w.deaths){lastDeath=w.deaths;jumpRelease=t+.1}
  let x=1,jump=false,dash=false,attack=true;
  const floor=w.level.ground.find(a=>p.x+p.w/2>=a.x&&p.x+p.w/2<a.x+a.w),next=w.level.ground.find(a=>a.x>p.x+p.w/2);
  const foe=w.enemies.filter(e=>!e.dead&&Math.abs(e.x-p.x)<220&&Math.abs(e.y-p.y)<180&&e.y<p.y+90).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
  if(foe){const dx=foe.x+foe.w/2-(p.x+p.w/2),dist=Math.abs(dx),desired=foe.w/2+47;
   x=dist>desired?Math.sign(dx):dist<desired-17?-Math.sign(dx):0;
   if(x===0&&p.face!==Math.sign(dx))x=Math.sign(dx);
   if(['wisp','drone'].includes(foe.type)&&p.grounded&&dist<105)jump=true;
   if(foe.type==='boss'&&foe.mode==='windup'&&dist<200&&p.grounded)jump=true;
   if(foe.type==='boss'&&foe.mode==='attack'&&dist<95&&p.dashCooldown<=0){x=-Math.sign(dx);dash=true}
  }
  // Cross gaps deliberately; use the second jump when descending over the gap.
  if(x>0&&floor&&p.grounded&&floor.x+floor.w-(p.x+p.w)<48)jump=true;
  if(!p.grounded&&p.jumps>0&&p.vy>80&&(!floor||p.y+p.h>floor.y-30)&&next&&next.x-p.x<250)jump=true;
  const hazard=w.hazards.find(h=>h.x>p.x&&h.x-p.x<90);if(hazard&&p.grounded&&(hazard.active||hazard.warning))jump=true;
  if(jump&&t>=jumpRelease){jumpRelease=t+.13}else jump=false;
  return {x,jump,attack,dash};
 };
}
