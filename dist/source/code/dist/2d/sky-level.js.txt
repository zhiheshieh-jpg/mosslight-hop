// The palace is intact: broad ceremonial terraces alternate with crystal bridges.
// Every hazard is deterministic, telegraphed, and has an idle crossing window.
export function createSkyLevel(){
 const ground=[],platforms=[],enemies=[],coins=[],checkpoints=[],hazards=[],decor=[];
 let x=0;const count=42,rests=new Set([0,10,21,31]);
 for(let i=0;i<count;i++){
  const last=i===count-1,rest=rests.has(i),w=last?1240:rest?520:660+(i%3)*30,y=420+[0,-12,8,0,12,-8][i%6];
  const slab={id:platforms.length,x,y,w,h:230,kind:'ground',section:i};ground.push(slab);platforms.push(slab);
  if(i===0)checkpoints.push({id:0,x:75,y,section:0});
  if(rest)decor.push({kind:'palace-rest',x:x+130,y,section:i},{kind:'chest',x:x+290,y,section:i});
  if(!rest&&!last){
   const kinds=['runner','sentry','brute','drone'];
   for(let j=0;j<3;j++)enemies.push({type:kinds[(i+j)%4],x:x+130+j*145,y:y-34,home:slab});
   const kindsH=['spikes','saw','beam'],kind=kindsH[(i-1)%3],period=kind==='beam'?4.8:kind==='saw'?4.2:3.8;
   hazards.push({id:hazards.length,kind,x:x+520,y:kind==='beam'?70:kind==='saw'?y-50:y-22,w:kind==='beam'?24:kind==='saw'?32:76,h:kind==='beam'?y-70:kind==='saw'?32:22,period,phase:i*.391,warmup:kind==='beam'?.75:.55,on:kind==='beam'?3:2.35,duration:kind==='beam'?1.05:1.0,travel:kind==='saw'?45:0,section:i});
   // Upper balconies are optional; the floor and bridges form the critical route.
   if(i%4===2){const top={id:platforms.length,x:x+225,y:y-105,w:115,h:18,kind:'ledge',section:i};platforms.push(top);coins.push({x:top.x+55,y:top.y-23,rare:true})}
  }
  for(let j=0;j<4;j++)coins.push({x:x+85+j*(w-150)/4,y:y-32,rare:false});
  decor.push({kind:'sign',x:x+w-35,y,text:rest?(i?'静息之庭 · 无存档':'唯一存档 · 试炼起点'):'二段跳 · 冲刺'});
  if(last){enemies.push({type:'boss',x:x+740,y:y-98,home:slab});decor.push({kind:'gate',x:x+w-75,y})}
  const bridge=[8,18,28,38].includes(i),gap=bridge?470:195+(i%4)*15;
  if(bridge){const a={id:platforms.length,x:x+w+168,y:y-12,w:134,h:20,kind:'crumble',section:i,collapseAfter:.7,restoreAfter:4.5};platforms.push(a);coins.push({x:a.x+67,y:a.y-30,rare:true})}
  x+=w+(last?0:gap);
 }
 return {name:'绯晶天宫',en:'THE CRIMSON CELESTIAL PALACE',zones:['绯云御阶','棱镜回廊','天穹晶桥','裁决王庭'],boss:'绯晶裁决者',index:2,sky:true,night:false,length:x,ground,platforms,enemies,coins,checkpoints,hazards,decor,count};
}

// Rect is both the damage shape and the rendered moving shape. phase is seconds.
export function hazardState(h,time){
 const phase=((time+(h.phase||0))%h.period+h.period)%h.period;
 if(h.kind==='laser')return {phase,active:phase>1.6,warning:phase>1.15&&phase<=1.6,rect:{x:h.x,y:h.y-16,w:h.w,h:26}};
 const on=h.on??2.35,duration=h.duration??1,warmup=h.warmup??.55;
 const rect={x:h.x,y:h.y,w:h.w,h:h.h};
 if(h.kind==='saw'){rect.x+=Math.sin((time+(h.phase||0))*1.7)*(h.travel||0);rect.y-=Math.sin((time+(h.phase||0))*2.2)*34}
 return {phase,active:phase>=on&&phase<on+duration,warning:phase>=on-warmup&&phase<on,rect};
}
