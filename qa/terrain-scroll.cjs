// Browser-rendered regression: world decorations must survive camera scrolling unchanged.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=process.env.SCROLL_QA_URL||'http://127.0.0.1:4186/2d/';
const output=process.env.QA_OUTPUT||path.join(__dirname,'../.deploy/flicker-qa/results');
fs.mkdirSync(output,{recursive:true});
const report={checks:[],errors:[],baseline:[],walks:[]};
const source=fs.readFileSync(path.join(__dirname,'../dist/2d/game.js'),'utf8');
const baseline=process.env.QA_BASELINE&&fs.readFileSync(process.env.QA_BASELINE,'utf8');
function terrainFunction(text){return text.slice(text.indexOf('function terrain(a)'),text.indexOf('function skyDecoration()')).trim()}
function ok(value,name){assert.ok(value,name);report.checks.push(name);console.log('PASS '+name)}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:960,height:540}});
  await context.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'?qa');await page.waitForFunction(()=>pixelInfo?.().loaded);
  // Exercise the actual terrain painter on a browser canvas at integer and fractional camera positions.
  for(const [label,code] of [['fixed',source],...(baseline?[['before',baseline]]:[])]){
   for(const night of [false,true]){
    const measured=await page.evaluate(({code,night})=>{
     const c=document.createElement('canvas');c.width=1440;c.height=540;const ctx=c.getContext('2d',{willReadFrequently:true});
     const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h))};
     const paint=new Function('ctx','world','camera','W','H','rect','a',`return (${code})(a)`);
     const a={id:3,x:200,y:420,w:660,h:200,kind:'ground'},world={level:{night}};
     let first,differences=[],nonempty=0,examples=[];
     for(const camera of [0,7.25,27.75,71,119.2]){
      ctx.clearRect(0,0,1440,540);paint(ctx,world,camera,1440,540,rect,a);
      const pixels=ctx.getImageData(Math.round(a.x-camera),405,a.w,135).data;
      if(!first){first=new Uint8ClampedArray(pixels);nonempty=first.filter((v,i)=>i%4===3&&v>0).length}
      else{let different=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==first[i]||pixels[i+1]!==first[i+1]||pixels[i+2]!==first[i+2]||pixels[i+3]!==first[i+3]){different++;if(examples.length<8)examples.push({camera,x:(i/4)%a.w,y:405+Math.floor(i/4/a.w),before:Array.from(first.slice(i,i+4)),after:Array.from(pixels.slice(i,i+4))})}differences.push(different)}
     }
     return {night,differences,nonempty,examples};
    },{code:terrainFunction(code),night});
    console.log(label,JSON.stringify({night:measured.night,differences:measured.differences}));
    if(label==='fixed'){ok(measured.nonempty>70000,'Rendered '+(night?'city':'forest')+' terrain is populated');ok(measured.differences.every(n=>n===0),'World-aligned '+(night?'city tiles':'grass, flowers and forest tiles')+' remain identical at five camera positions')}
    else{report.baseline.push(measured);ok(measured.differences.some(n=>n>1000),'The previous '+(night?'city':'forest')+' renderer reproduces scrolling flicker')}
   }
  }
  for(const level of [0,1]){
   await page.evaluate(level=>{__pixelQA.home();__pixelQA.begin(level);const w=__pixelQA.world();w.player.x=360;w.player.vx=0},level);
   await page.keyboard.down('d');await page.waitForTimeout(140);
   const frames=[];
   for(let i=0;i<5;i++){
    await page.waitForTimeout(45);
    frames.push(await page.evaluate(()=>{
     const info=pixelInfo(),canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
     const y=406+Math.max(0,canvas.height*.76-420),pixels=ctx.getImageData(Math.round(600-info.camera),Math.round(y),50,14).data;
     const grass=[];for(let n=0;n<pixels.length;n+=4){const r=pixels[n],g=pixels[n+1],b=pixels[n+2];grass.push(r===137&&g===185&&b===97?1:r===240&&g===214&&b===148?2:r===255&&g===237&&b===208?3:0)}
     const wall=ctx.getImageData(Math.round(600-info.camera),432,50,90).data;
     return {camera:info.camera,x:info.player.x,grass,wall:Array.from(wall)};
    }));
   }
   await page.keyboard.up('d');
   ok(frames.at(-1).camera-frames[0].camera>30&&frames.at(-1).x-frames[0].x>40,'Real keyboard walking scrolls chapter '+(level+1));
   if(level===0){ok(frames[0].grass.some(Boolean),'Live walking sample contains grass and flowers');ok(frames.every(f=>JSON.stringify(f.grass)===JSON.stringify(frames[0].grass)),'Live grass and flowers stay attached to the ground while walking')}
   ok(frames.every(f=>f.wall.every((v,i)=>Math.abs(v-frames[0].wall[i])<=1)),'Live chapter '+(level+1)+' ground tiles stay attached while walking');
   report.walks.push({level,cameras:frames.map(f=>f.camera),positions:frames.map(f=>f.x)});
   await page.screenshot({path:path.join(output,level===0?'forest-walking.png':'city-walking.png')});
  }
  ok(report.errors.length===0,'No browser runtime errors');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));
 }catch(error){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:String(error.stack)},null,2));throw error}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
