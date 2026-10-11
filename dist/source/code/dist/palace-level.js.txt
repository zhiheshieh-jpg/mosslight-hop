// The palace is an intact ceremonial ascent: every balcony is part of the route,
// but only the arrival court is a savepoint. The eight-deck phrases gradually
// tighten without reducing any warning to a frame-perfect reaction.
const kinds=['moving','laser','rotating','crusher','crumble','sweeper','pulse','solid'];
const turns=[0,2.1,3.2,1.3,-1.5,-3.2,-1.6,.7];
const rises=[.35,.3,.25,-.15,.4,.35,.25,.2];
const platforms=[{x:0,z:0,y:0,w:8,d:8,kind:'solid',section:'云门前庭'}];
let height=0,z=0;
for(let i=1;i<=42;i++){
 const phrase=Math.floor((i-1)/8),beat=(i-1)%8,kind=kinds[beat];
 height+=rises[beat];z-=7.7+(phrase%2)*.15;
 const a={x:turns[beat]+Math.sin(phrase*1.7)*.65,z,y:+height.toFixed(2),w:kind==='solid'?6:kind==='rotating'?5.4:kind==='sweeper'?5.1:4.6,d:kind==='solid'?5.8:kind==='rotating'?4.4:kind==='sweeper'?5.8:5.1,kind,section:['绯晶长廊','镜穹回廊','金冠花庭','浮光礼殿','星冕天阶','曙光王座'][phrase]};
 if(kind==='moving')Object.assign(a,{amp:1.25+phrase*.04,period:5.6-phrase*.12});
 if(kind==='rotating')Object.assign(a,{period:8.2-phrase*.18,direction:phrase%2?-1:1,offset:phrase*.9});
 if(kind==='laser')Object.assign(a,{period:4.6-phrase*.1,offset:phrase*.53,safeDuration:1.95,warningDuration:.75});
 if(kind==='crusher')Object.assign(a,{period:5.4-phrase*.12,offset:phrase*.8});
 if(kind==='crumble')Object.assign(a,{crumbleDelay:1.5,restoreDelay:4.8});
 if(kind==='sweeper')Object.assign(a,{period:4.8-phrase*.15,offset:phrase*.61});
 if(kind==='pulse')Object.assign(a,{period:6.8-phrase*.13,offset:phrase*.8});
 platforms.push(a);
}
platforms.push({x:0,z:z-8.1,y:+(height+.3).toFixed(2),w:10,d:8,kind:'solid',section:'曙光王座'});
export const PALACE_LEVEL={name:'绯晶天宫',subtitle:'穿越完整浮空宫殿 · 仅起点存档 · 无战斗极限试炼',sky:true,checkpoints:[],platforms};
