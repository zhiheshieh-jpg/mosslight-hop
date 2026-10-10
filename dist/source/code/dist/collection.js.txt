export function makeCollectibles(level){
 const platforms=level===0?Array.from({length:22},(_,i)=>i):[0,1,2,3,4,5,6,7,9,10,11,12,13,14,15,17,18,19,20,21,23,24,25,29];
 const lights=platforms.map((platform,i)=>({id:`light-${i}`,type:'light',platform,x:level===0&&[3,7,11,16,20].includes(platform)?1.1:0,z:i===0?-1.8:0,y:level===1&&[3,10,15,20,21].includes(platform)?2.3:1.1,points:10,name:'微光'}));
 const rare=level===0?[[4,2.55,.7,'林间琥珀'],[14,-2.55,.6,'风铃种子'],[21,3.4,.9,'晨露之星']]:[[4,2.25,.5,'霓虹芯片'],[19,-2.25,.5,'量子棱镜'],[29,-3.4,.9,'天际星核']];
 return [...lights,...rare.map(([platform,x,z,name],i)=>({id:`relic-${i}`,type:'relic',platform,x,z,y:1.25,points:50,name}))];
}
export function collectionStats(items,collected){let lights=0,relics=0,score=0;for(const c of items)if(collected.has(c.id)){c.type==='light'?lights++:relics++;score+=c.points}const lightMax=items.filter(x=>x.type==='light').length,relicMax=items.length-lightMax,maxScore=items.reduce((s,x)=>s+x.points,0),maxTotal=items.length,all=lights+relics===maxTotal;return {lights,relics,score,total:lights+relics,lightMax,relicMax,maxScore,maxTotal,all,rank:all?'全收集大师':score>=maxScore*.66?'星光收藏家':score>=maxScore*.29?'微光探索者':'初次远行'}}
