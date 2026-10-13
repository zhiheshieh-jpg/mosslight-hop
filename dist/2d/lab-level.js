// A working orbital research complex: sealed decks, lit bridges and reactor halls.
// The critical route is always reachable with the ordinary double jump and dash.
export function createLabLevel(){
 const ground=[],platforms=[],enemies=[],coins=[],checkpoints=[],hazards=[],decor=[];
 const count=48,rests=new Set([0,12,24,36,47]),bridges=new Set([8,18,28,38,44]);let x=0;
 for(let i=0;i<count;i++){
  const last=i===count-1,rest=rests.has(i),w=last?1480:rest?590:760+(i%3)*32,y=420+[0,-14,10,-6,14,0][i%6];
  const slab={id:platforms.length,x,y,w,h:240,kind:'ground',section:i};ground.push(slab);platforms.push(slab);
  if(rest){checkpoints.push({id:checkpoints.length,x:x+85,y,section:i});decor.push({kind:'lab-rest',x:x+145,y,section:i})}
  if(!rest&&!last){
   const kinds=['sentry','runner','drone','brute'];
   for(let j=0;j<3;j++)enemies.push({type:kinds[(i+j)%4],x:x+145+j*158,y:y-34,home:slab});
   const kind=['beam','saw','spikes'][(i-1)%3],period=kind==='beam'?4.3:kind==='saw'?4:3.7;
   hazards.push({id:hazards.length,kind,x:x+598,y:kind==='beam'?62:kind==='saw'?y-52:y-24,w:kind==='beam'?30:kind==='saw'?36:84,h:kind==='beam'?y-62:kind==='saw'?36:24,period,phase:i*.317,warmup:kind==='beam'?.8:.65,on:kind==='beam'?2.8:2.2,duration:kind==='beam'?1.15:1.1,travel:kind==='saw'?42:0,section:i,lab:true});
   if(i%4===2){const top={id:platforms.length,x:x+280,y:y-108,w:128,h:18,kind:'ledge',section:i};platforms.push(top);coins.push({x:top.x+64,y:top.y-24,rare:true})}
   decor.push({kind:'lab-console',x:x+82,y,section:i},{kind:'lab-reactor',x:x+480,y,section:i});
  }
  for(let j=0;j<4;j++)coins.push({x:x+98+j*(w-170)/4,y:y-34,rare:false});
  decor.push({kind:'sign',x:x+w-35,y,text:rest?'维护舱 · 存档补给':'预警后通行 · 二段跳'});
  if(last){enemies.push({type:'boss',x:x+880,y:y-108,home:slab});decor.push({kind:'gate',x:x+w-75,y})}
  const bridge=bridges.has(i),gap=bridge?490:215+(i%4)*15;
  if(bridge){const a={id:platforms.length,x:x+w+176,y:y-10,w:138,h:20,kind:'crumble',section:i,collapseAfter:.85,restoreAfter:4.2};platforms.push(a);coins.push({x:a.x+69,y:a.y-30,rare:true})}
  x+=w+(last?0:gap);
 }
 return {name:'星穹实验室',en:'THE ORBITAL RESEARCH COMPLEX',zones:['无菌接驳舱','量子计算廊','聚变反应区','欧米伽主控室'],boss:'欧米伽主脑',index:3,lab:true,sky:false,night:false,length:x,ground,platforms,enemies,coins,checkpoints,hazards,decor,count};
}
