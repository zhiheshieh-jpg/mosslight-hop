// Original, self-contained four-chapter score: no downloads or external audio assets.
export const MUSIC_THEMES=Object.freeze([
 {name:'晨露轻吟',bpm:84,root:60,scale:[0,2,4,5,7,9,11],chords:[0,5,3,4,0,5,1,4],lead:'bell',pad:'sine',drums:false},
 {name:'霓虹脉冲',bpm:118,root:57,scale:[0,2,3,5,7,8,10],chords:[0,5,3,6,0,2,5,4],lead:'square',pad:'triangle',drums:true},
 {name:'云上绯晶',bpm:94,root:62,scale:[0,2,4,6,7,9,11],chords:[0,4,5,3,0,2,3,4],lead:'bell',pad:'sine',drums:true},
 {name:'星穹序列',bpm:132,root:54,scale:[0,2,3,5,7,9,10],chords:[0,3,1,5,0,6,3,4],lead:'triangle',pad:'triangle',drums:true}
]);
const motifs=[[0,2,4,6,4,2,1,4],[4,3,2,0,1,2,4,1],[0,4,5,6,7,6,4,2],[2,1,0,2,4,5,3,1]];
export const midiFrequency=n=>440*2**((n-69)/12);
export function musicEvents(level,step,boss=false){
 const t=MUSIC_THEMES[level]||MUSIC_THEMES[0],bar=Math.floor(step/16)%16,pos=step%16,degree=t.chords[bar%8];
 const note=d=>t.root+t.scale[((d%7)+7)%7]+Math.floor(d/7)*12,events=[];
 if(pos===0)for(const d of [0,2,4])events.push({voice:t.pad,note:note(degree+d),beats:3.8,gain:.046});
 if(pos%4===0)events.push({voice:'sine',note:note(degree)-24+(pos===12?7:0),beats:.7,gain:.17});
 if(pos%2===0){const phrase=motifs[(Math.floor(bar/4)+level)%4],d=degree+phrase[pos/2];events.push({voice:t.lead,note:note(d)+12,beats:level===0?.8:.38,gain:level===0?.14:.11});}
 if(t.drums||boss){
  if(pos===0||pos===8||boss&&pos===14)events.push({voice:'kick',beats:.35,gain:.23});
  if(pos===4||pos===12)events.push({voice:'snare',beats:.23,gain:.075});
  if(pos%2===0)events.push({voice:'hat',beats:.09,gain:pos%4===0?.028:.018});
 }
 return events;
}
export class BackgroundMusic{
 constructor(){this.context=null;this.enabled=true;this.active=false;this.level=0;this.boss=false;this.step=0;this.notes=0;this.voices=new Set();this.next=0;this.mode='menu';}
 attach(context){
  if(this.context===context)return;this.clear();this.context=context;
  const bus=context.createGain(),compressor=context.createDynamicsCompressor(),meter=context.createAnalyser();
  bus.gain.value=0;compressor.threshold.value=-18;compressor.ratio.value=3;meter.fftSize=1024;
  bus.connect(compressor);compressor.connect(meter);meter.connect(context.destination);this.bus=bus;this.meter=meter;this.samples=new Float32Array(meter.fftSize);
  const delay=context.createDelay(.6),feedback=context.createGain();delay.delayTime.value=.23;feedback.gain.value=.18;delay.connect(feedback);feedback.connect(delay);delay.connect(bus);this.echo=delay;
  this.noise=context.createBuffer(1,Math.ceil(context.sampleRate*.3),context.sampleRate);let seed=17;const data=this.noise.getChannelData(0);for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
  this.next=context.currentTime+.03;
 }
 clear(){for(const voice of this.voices){try{voice.stop()}catch{}}this.voices.clear();}
 update({level=0,mode='menu',enabled=true,boss=false}={}){
  this.enabled=enabled;this.mode=mode;const ctx=this.context;if(!ctx)return;
  if(level!==this.level||boss!==this.boss){this.clear();this.level=level;this.boss=boss;this.step=0;this.next=ctx.currentTime+.04;}
  const active=enabled&&!globalThis.document?.hidden&&['menu','playing'].includes(mode)&&ctx.state==='running';
  if(active!==this.active){this.active=active;this.bus.gain.cancelScheduledValues(ctx.currentTime);this.bus.gain.setTargetAtTime(active?(mode==='menu'?.12:.24):0,ctx.currentTime,.035);if(!active)this.clear();else this.next=ctx.currentTime+.04;}
  if(!active)return;this.bus.gain.setTargetAtTime(mode==='menu'?.12:.24,ctx.currentTime,.06);
  if(this.next<ctx.currentTime-.25)this.next=ctx.currentTime+.03;
  const theme=MUSIC_THEMES[this.level]||MUSIC_THEMES[0],beat=60/(theme.bpm*(boss?1.12:1));
  while(this.next<ctx.currentTime+.14){for(const event of musicEvents(this.level,this.step,boss))this.play(event,this.next,beat);this.step=(this.step+1)%256;this.next+=beat/4;}
 }
 play(event,at,beat){
  const ctx=this.context,duration=event.beats*beat,env=ctx.createGain(),filter=ctx.createBiquadFilter();
  filter.type=event.voice==='hat'?'highpass':'lowpass';filter.frequency.value=event.voice==='hat'?7000:event.voice==='square'?1700:6000;
  env.gain.setValueAtTime(.0001,at);env.gain.linearRampToValueAtTime(event.gain,at+.008);env.gain.exponentialRampToValueAtTime(.0001,at+duration);
  env.connect(filter);filter.connect(this.bus);if(event.voice==='bell')filter.connect(this.echo);
  const source=['hat','snare'].includes(event.voice)?ctx.createBufferSource():ctx.createOscillator();
  if('buffer' in source)source.buffer=this.noise;else{source.type=event.voice==='bell'||event.voice==='kick'?'sine':event.voice;source.frequency.setValueAtTime(event.voice==='kick'?135:midiFrequency(event.note),at);if(event.voice==='kick')source.frequency.exponentialRampToValueAtTime(42,at+duration);}
  source.connect(env);this.voices.add(source);source.onended=()=>{source.disconnect();env.disconnect();filter.disconnect();this.voices.delete(source)};source.start(at);source.stop(at+duration+.025);this.notes++;
 }
 snapshot(){let rms=0;if(this.meter){this.meter.getFloatTimeDomainData(this.samples);for(const v of this.samples)rms+=v*v;rms=Math.sqrt(rms/this.samples.length);}const theme=MUSIC_THEMES[this.level]||MUSIC_THEMES[0];return {theme:theme.name,bpm:theme.bpm,active:this.active,enabled:this.enabled,mode:this.mode,notes:this.notes,voices:this.voices.size,contextState:this.context?.state||'idle',rms};}
}
