// Procedural foregrounds, machines and effects match the simulated geometry.
const box=(c,x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))};
export function drawLogo(c,image,x,y,size,rotation=0,halo=null,alpha=1){
 c.save();c.globalAlpha=alpha;c.translate(x,y);
 if(halo){const r=halo.radius||size*.8,tip=halo.needleRadius||r*1.4,a=halo.angle||0;
  c.save();c.rotate(a);c.strokeStyle='#b8ffff';c.shadowColor='#59f5ec';c.shadowBlur=12;c.lineWidth=2;
  c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke();c.lineWidth=1;c.strokeStyle='#7bd8ff70';c.beginPath();c.arc(0,0,r-6,0,Math.PI*2);c.stroke();
  for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.fillStyle=i%2?'#eaffff':'#a7fff2';c.beginPath();c.moveTo(r-5,-3);c.lineTo(tip,0);c.lineTo(r-5,3);c.closePath();c.fill();c.restore()}c.restore();
 }
 c.rotate(rotation);c.shadowColor='#66ffed';c.shadowBlur=9;if(image)c.drawImage(image,-size/2,-size/2,size,size);c.restore();
}
export function labBackdrop(c,img,W,H,camera,time){
 box(c,0,0,W,H,'#071a2b');if(img){const s=Math.max(W/img.width,H/img.height)*1.1;c.drawImage(img,Math.round((W-img.width*s)/2-Math.sin(camera*.00013)*W*.03),Math.round((H-img.height*s)/2),Math.ceil(img.width*s),Math.ceil(img.height*s))}
 const tint=c.createLinearGradient(0,0,0,H);tint.addColorStop(0,'#07172a44');tint.addColorStop(.6,'#11385225');tint.addColorStop(1,'#091e3988');c.fillStyle=tint;c.fillRect(0,0,W,H);
 for(let i=Math.floor(camera*.19/260)-1;i<(camera*.19+W)/260+1;i++){const x=i*260-camera*.19,y=H*.22+(i%3)*27;
  box(c,x,y,12,H-y,'#193f5266');box(c,x+3,y+14,2,H-y-40,'#73f8f04d');box(c,x,y,190,5,'#a6e6ea38');
  box(c,x+35,y+40,110,58,'#092b405e');for(let j=0;j<4;j++)box(c,x+43,y+48+j*11,56+(i*j%4)*10,2,j===2?'#7effb654':'#7dcdef40');
 }
 for(let i=0;i<23;i++){const x=((i*197-camera*.09+time*7)%(W+80)+W+80)%(W+80),y=(i*113)%H;box(c,x,y,2,2,i%3?'#90f7e299':'#ffcf9299')}
}
export function labTerrain(c,a,camera,time){
 const x=a.x-camera,y=a.y,h=Math.min(a.h,a.kind==='ground'?105:23);if(a.gone){box(c,x,y,a.w,2,'#faaf7255');return}
 box(c,x,y,a.w,h,'#172e45');box(c,x,y,a.w,5,'#def6f1');box(c,x,y+5,a.w,3,'#73eddf');box(c,x+4,y+12,a.w-8,h-18,'#8aaeb9');
 for(let px=x+10;px<x+a.w-8;px+=43){box(c,px,y+16,32,h-27,'#1b354b');box(c,px+4,y+21,21,3,'#64bdbf');box(c,px+4,y+29,2,Math.max(2,h-48),'#2c5163')}
 box(c,x,y+h-6,a.w,3,'#44d9d8');if(a.kind==='moving'){for(let px=x+17;px<x+a.w;px+=27){box(c,px,y+h+2,9,3,'#c4fff2');box(c,px+2,y+h+5,5,6+Math.sin(time*9)*3,'#50f9e488')}}
 if(a.kind==='crumble'&&a.trigger>=0){for(let i=0;i<4;i++)box(c,x+a.w*(i+.5)/4,y+2,3,h-4,'#ffc692');}
}
export function labDecoration(c,world,camera,W,time,drawHazard,label){
 for(const a of world.level.ground){const x=a.x-camera;if(x+a.w<-80||x>W+80)continue;
  for(const px of [x+24,x+a.w-35]){box(c,px,a.y-70,5,68,'#638d9f');box(c,px-8,a.y-70,22,5,'#c6ecee');box(c,px-4,a.y-65,14,3,'#58f6e6');}
  if(a.section%3===1){const px=x+a.w*.57;box(c,px-21,a.y-91,42,6,'#a0d6e3');box(c,px-18,a.y-85,36,75,'#4adfe514');box(c,px-18,a.y-85,2,75,'#80f5e288');box(c,px+16,a.y-85,2,75,'#80f5e288');for(let j=0;j<4;j++)box(c,px-12,a.y-66+j*12,24,2,'#65e8e566');box(c,px-23,a.y-10,46,10,'#4d7a90')}
 }
 for(const p of world.level.checkpoints){const x=p.x-camera;if(x<-70||x>W+70)continue;box(c,x-15,p.y-7,30,7,'#a1dce3');box(c,x-5,p.y-53,10,46,'#456b86');box(c,x-13,p.y-62,26,25,p.id<=world.checkpoint?'#9cffe1':'#558094');box(c,x-9,p.y-59,18,15,'#092e46');label('维护站',x,p.y-75,8,'#c8fff0','center')}
 for(const d of world.level.decor){const x=d.x-camera;if(x<-100||x>W+100)continue;if(d.kind==='gate'){const open=world.enemies.find(e=>e.type==='boss').dead;
  for(const px of [x-35,x+27]){box(c,px,d.y-119,8,119,'#cce7ed');box(c,px+2,d.y-110,3,100,open?'#81ffee':'#ffbf92')}
  box(c,x-35,d.y-125,70,8,'#658ca7');box(c,x-27,d.y-117,54,112,open?'#5ffff233':'#e57d9030');label(open?'离开实验室':'解除核心封锁',x,d.y-143,9,'#d3ffff','center');
 }else if(d.kind==='sign'&&d.text){box(c,x-40,d.y-50,80,22,'#142d49');box(c,x-40,d.y-50,80,2,'#6bece5');label(d.text,x,d.y-35,8,'#c7fff4','center')}}
 for(const h of world.hazards)drawHazard(h);
}
export function labEnemy(c,e,x,y,time,label){
 const white=e.flash>0?'#ffffff':'#d0e5ed',dark='#15344c',accent=e.mode==='windup'?'#ffbe83':'#83ffee',cx=x+e.w/2;
 if(e.type==='boss'){
  const bob=Math.sin(time*3)*3;box(c,x+11,y+19+bob,e.w-22,e.h-29,dark);box(c,x+18,y+17+bob,e.w-36,e.h-32,white);box(c,x+25,y+34+bob,e.w-50,39,'#28566a');
  c.save();c.translate(cx,y+48+bob);c.rotate(time*(e.enraged?3.1:1.2));c.strokeStyle=accent;c.lineWidth=3;c.strokeRect(-23,-23,46,46);c.rotate(Math.PI/4);c.strokeStyle='#bbd6ff';c.lineWidth=1;c.strokeRect(-30,-30,60,60);c.restore();
  box(c,cx-8,y+40+bob,16,16,accent);for(const d of [-1,1]){const px=cx+d*57;box(c,px-10,y+27+bob,20,49,dark);box(c,px-6,y+31+bob,12,31,white);box(c,px-8,y+70+bob,16,4,accent);box(c,cx+d*23-7,y+e.h-16,14,16,white)}
  if(e.mode==='windup'){const words={charge:'相位突进',fan:'离子扇阵',cross:'交叉脉冲',burst:'超频爆发',rain:'轨道轰击',sweep:'地面扫束',orbital:'轨道轰击',barrage:'弹幕封锁',laser:'聚焦射线'};label(words[e.pattern]||'核心蓄能',cx,y-40,10,'#ffd4a1','center');c.save();c.strokeStyle='#ffca9280';c.setLineDash([7,6]);c.beginPath();if(e.pattern==='charge'&&e.attackZone){const z=e.attackZone;c.fillStyle='#ffba741c';c.fillRect(z.x-e.x+x,z.y,z.w,z.h);c.strokeRect(z.x-e.x+x,z.y,z.w,z.h)}else{const speeds=e.pattern==='cross'?[[390,0],[265,-225]]:e.pattern==='burst'?[[430,0],[320,-110],[240,-290]]:[[295,0],[295,-150],[295,-295]];for(const d of [-1,1])for(const [vx,vy] of speeds){c.moveTo(cx,y+e.h*.4);c.lineTo(cx+d*vx*.48,y+e.h*.4+vy*.48)}}c.stroke();c.restore()}
  if(e.targetX!==undefined&&e.mode==='windup'){const tx=e.targetX-e.x+x;box(c,tx-27,e.home.y-3,54,3,'#ffd19b');}
  if(e.enraged)label('OVERCLOCK',cx,y-22,8,'#ffb78f','center');
 }else if(e.type==='drone'||e.type==='wisp'){box(c,x+2,y+7,e.w-4,e.h-10,dark);box(c,x+7,y+4,e.w-14,e.h-6,white);box(c,x+9,y+11,e.w-18,4,accent);for(const d of [-1,1])box(c,cx+d*21-9,y+7+Math.sin(time*12+e.id)*3,18,3,'#7bb9d2');
 }else{box(c,x+4,y+12,e.w-8,e.h-17,dark);box(c,x+7,y+14,e.w-14,e.h-21,white);box(c,x+4,y+1,e.w-8,13,white);box(c,x+7,y+6,e.w-14,4,accent);box(c,x+4,y+e.h-8,7,8,'#7b9daf');box(c,x+e.w-11,y+e.h-8,7,8,'#7b9daf');if(e.type==='sentry')box(c,e.dir>0?x+e.w-1:x-15,y+14,17,6,accent);if(e.type==='brute'){box(c,x-9,y+16,13,24,'#648799');box(c,x+e.w-4,y+16,13,24,'#648799')}}
 if(e.hp<e.maxHp&&e.type!=='boss'){box(c,x,y-9,e.w,3,'#143149');box(c,x,y-9,e.w*e.hp/e.maxHp,2,'#6dffed')}
}
export function logoExplosion(c,fx,W,H,camera,offset,dt){
 for(const f of fx){const age=1-f.life/f.max,x=f.x-camera,y=f.y+offset,r=Math.hypot(W,H)*Math.min(1.25,age*2.4),alpha=Math.pow(1-age,1.3);
  c.save();c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,0,x,y,Math.max(1,r));g.addColorStop(0,'#edfffa50');g.addColorStop(.55,'#51ffff24');g.addColorStop(.83,'#0df7df0a');g.addColorStop(1,'#9affef00');c.fillStyle=g;c.fillRect(0,0,W,H);
  for(let i=0;i<3;i++){c.strokeStyle=i===0?'#f4ffff':'#80ffe7';c.lineWidth=i===0?8:3;c.beginPath();c.arc(x,y,Math.max(0,r-i*35),0,Math.PI*2);c.stroke()}
  for(let i=0;i<32;i++){const a=i*Math.PI/16+f.spin;c.strokeStyle=i%2?'#aefee9aa':'#f4ffff';c.lineWidth=i%3?1:3;c.beginPath();c.moveTo(x+Math.cos(a)*r*.72,y+Math.sin(a)*r*.72);c.lineTo(x+Math.cos(a)*r*1.12,y+Math.sin(a)*r*1.12);c.stroke()}
  if(age<.2)box(c,0,0,W,H,`rgba(176,255,236,${(.2-age)*1.6})`);c.restore();f.life-=dt;
 }
}
