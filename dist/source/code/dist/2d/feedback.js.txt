export function impactSettings({heavy=false,kill=false,character='dragon'}={}){
 const weight=character==='claude'?1:0;
 return {hitstop:(kill?.125:heavy?.095:.065)+weight*.008,amplitude:(kill?2.5:heavy?1.9:1.25)+weight*.15,duration:kill?.24:heavy?.2:.16};
}
// One damped impulse, never a sum of impulses: crowds cannot amplify camera motion.
export class HitFeedback{
 constructor(){this.impacts=0;this.clear()}
 clear(){this.elapsed=0;this.duration=0;this.amplitude=0;this.face=1;this.offset={x:0,y:0}}
 kick(event){const config=impactSettings(event);this.impacts++;this.amplitude=Math.min(2.8,Math.max(this.amplitude,config.amplitude));this.duration=config.duration;this.elapsed=0;this.face=event.face<0?-1:1;return config}
 update(dt){
  this.elapsed+=Math.max(0,dt);
  if(this.elapsed>=this.duration){this.amplitude=0;this.offset={x:0,y:0};return this.offset}
  const age=this.elapsed/this.duration,envelope=(1-age)**2,phase=this.elapsed*92;
  this.offset={x:-this.face*Math.cos(phase)*this.amplitude*envelope,y:Math.sin(phase*.8)*this.amplitude*.42*envelope};return this.offset;
 }
 snapshot(){return {impacts:this.impacts,active:this.amplitude>0,amplitude:this.amplitude,offset:{...this.offset}}}
}
