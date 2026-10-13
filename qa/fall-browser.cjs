// Staged fixtures check recovery and saves; ordinary routes live in fall-recovery.test.mjs.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FALL_QA_URL||'http://127.0.0.1:4186/',merged=process.env.FALL_QA_MERGED==='1';
const output=process.env.QA_OUTPUT||path.join(__dirname,'../.deploy/fall-update/browser');fs.mkdirSync(output,{recursive:true});
const prefix='';
const progress={version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]};
const report={checks:[],errors:[],url:base};
const ok=(value,label)=>{assert.ok(value,label);report.checks.push(label);console.log('PASS '+label)};
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await context.addInitScript(({prefix,progress})=>{for(const mode of ['pixel','3d'])localStorage.setItem(prefix+'mosslight-'+mode+'-progress',JSON.stringify(progress))},{prefix,progress});
  const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message.slice(0,500)));
  const surface=()=>page;
  const ready=mode=>surface().waitForFunction(mode=>mode==='2d'?window.pixelInfo?.().loaded:window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'),mode);
  for(const mode of ['2d','3d']){
   const url=mode==='2d'?new URL(merged?'./?qa':'2d/?qa',base).href:new URL(merged?'3d/?qa':'./?qa',base).href;
   await page.goto(url);await ready(mode);const f=surface();
   for(const level of [0,1,2,3]){
    const previous=await f.evaluate(({mode,level})=>{
     const qa=mode==='2d'?__pixelQA:__qa;qa.home();qa.begin(level);const w=qa.world();
     const a=w.platforms.find(a=>mode==='2d'?a.kind==='ground'&&a.section===3:a.id>=6&&!w.def.checkpoints.includes(a.id)&&a.kind==='solid');
     if(mode==='2d'){
      Object.assign(w.player,{x:a.x+a.w-1.75,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:a.id});
      w.rememberFallPoint();w.player.y=800;w.player.grounded=false;w.player.on=null;
     }else{
      w.checkpoint=w.restartFromStart?0:w.def.checkpoints[0];
      Object.assign(w.player,{x:a.x,y:-20,z:a.z,vx:0,vy:0,vz:0,grounded:false,on:null});
     }
     return {platform:a.id,checkpoint:w.checkpoint};
    },{mode,level});
    await f.waitForFunction(mode=>mode==='2d'?pixelInfo().falls===1:gameInfo().deaths===1,mode);
    await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).pause(),mode);
    const state=await f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
    if(mode==='2d'){
     ok(state.player.hp===4&&state.player.on===previous.platform&&state.checkpoint===previous.checkpoint&&state.deaths===0,'2D chapter '+(level+1)+' retains the last platform for exactly 2 HP');
     const inset=await f.evaluate(()=>{const w=__pixelQA.world(),p=w.player,a=w.platforms.find(a=>a.id===p.on);return Math.abs(p.x-(a.x+a.w-p.w-32))<1e-6});
     ok(inset,'2D chapter '+(level+1)+' returns a short distance inside the edge');
    }else{
     ok(state.player.on===previous.checkpoint&&state.checkpoint===previous.checkpoint&&state.deaths===1,'3D chapter '+(level+1)+' immediately respawns at its checkpoint');
     const noHealth=await f.evaluate(()=>{const w=__qa.world(),r=__qa.exportCurrentRun();return !('hp' in w.player)&&!('maxHp' in w.player)&&!('fallHistory' in r)&&!document.querySelector('#health')});
     ok(noHealth,'3D chapter '+(level+1)+' has no HP system or health HUD');
    }
    await f.click('#cloud-save');
    const saved=await f.evaluate(({prefix,mode})=>JSON.parse(localStorage.getItem(prefix+'mosslight-run-'+mode)),{prefix,mode});
    ok(!!saved&&(mode==='2d'?saved.world.state.player.hp===4:saved.deaths===1&&!('hp' in saved.player)),mode+' chapter '+(level+1)+' saves current recovery state');
    await f.click('#home');await f.click('#cloud-load');
    await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
    const restored=await f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
    ok(mode==='2d'?restored.player.hp===4&&restored.player.on===previous.platform&&restored.falls===1:restored.player.on===previous.checkpoint&&restored.deaths===1&&!('hp' in restored.player),mode+' chapter '+(level+1)+' reload preserves the new rules');
    if(mode==='3d'&&level===0){
     const migration=await f.evaluate(()=>{const old=__qa.exportCurrentRun();old.player.hp=2;old.player.maxHp=6;old.falls=2;old.fallHistory=[{id:3,x:0,z:0}];old.platforms.forEach(a=>a.recoveryUntil=-1);const accepted=__qa.restoreCurrentRun(old),current=__qa.exportCurrentRun();return {accepted,clean:!('hp' in current.player)&&!('maxHp' in current.player)&&!('falls' in current)&&!('fallHistory' in current)}});
     ok(migration.accepted&&migration.clean,'3D older HP saves still load and discard removed fields');
     const malformed=await f.evaluate(()=>{const r=__qa.exportCurrentRun();r.player.x=NaN;return __qa.restoreCurrentRun(r)});
     ok(malformed===false,'3D malformed position is rejected without replacing the run');
    }
   }
   await page.screenshot({path:path.join(output,mode+'-fall-paused.png')});
   await page.reload();await ready(mode);const f2=surface();
   await f2.click('#cloud-load');await f2.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
   const refreshed=await f2.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
   ok(mode==='2d'?refreshed.player.hp===4:refreshed.deaths===1&&refreshed.player.on===0&&!('hp' in refreshed.player),mode+' recovery survives a full page refresh');
   if(mode==='3d'){
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'3d-mobile.png')});
    ok(await f2.evaluate(()=>!document.querySelector('#health')&&!document.querySelector('[data-character],.character-panel,#character-choices')&&document.documentElement.scrollWidth<=innerWidth),'3D mobile fits with no health or character selector');
   }
  }
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log('Checks:',report.checks.length);
 }catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:String(e).slice(0,1200)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(String(e).slice(0,1200));process.exitCode=1});
