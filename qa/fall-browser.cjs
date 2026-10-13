// Fixtures exercise recovery and save compatibility; route proofs live in fall-recovery.test.mjs.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.FALL_QA_URL||'http://127.0.0.1:4186/';
const merged=process.env.FALL_QA_MERGED==='1';
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
  for(const mode of ['2d','3d']){
   const url=mode==='2d'?new URL(merged?'./?qa':'2d/?qa',base).href:new URL(merged?'3d/?qa':'./?qa',base).href;
   await page.goto(url);const f=surface();
   await f.waitForFunction(mode=>mode==='2d'?window.pixelInfo?.().loaded:window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'),mode);
   for(const level of [0,1,2,3]){
    const previous=await f.evaluate(({mode,level})=>{
     const qa=mode==='2d'?__pixelQA:__qa;qa.home();qa.begin(level);const w=qa.world();
     const a=w.platforms.find(a=>mode==='2d'?a.kind==='ground'&&a.section===3:a.id>=3&&!w.def.checkpoints.includes(a.id)&&['solid','rotating','moving'].includes(a.kind));
     if(mode==='2d')Object.assign(w.player,{x:a.x+60,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:a.id});
     else Object.assign(w.player,{x:a.x,y:a.y,z:a.z,vx:0,vy:0,vz:0,grounded:true,on:a.id});
     w.fallRecordAt=-1;w.rememberFallPoint();w.player.y=mode==='2d'?800:-20;w.player.grounded=false;w.player.on=null;
     return {platform:a.id,checkpoint:w.checkpoint,score:mode==='2d'?w.score:w.stats().score};
    },{mode,level});
    await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).falls===1,mode);
    await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).pause(),mode);
    const state=await f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
    ok(state.player.hp===4&&state.player.on===previous.platform&&state.checkpoint===previous.checkpoint&&state.deaths===0,mode+' chapter '+(level+1)+' recovers to the recent platform for exactly 2 HP');
    if(mode==='3d')ok((await f.locator('#health').textContent()).includes('4 / 6'),'3D chapter '+(level+1)+' health HUD matches recovery');
    await f.click('#cloud-save');
    const saved=await f.evaluate(({prefix,mode})=>JSON.parse(localStorage.getItem(prefix+'mosslight-run-'+mode)),{prefix,mode});
    ok(!!saved&&(mode==='2d'?saved.world.state.player.hp:saved.player.hp)===4,mode+' chapter '+(level+1)+' saves reduced health');
    await f.click('#home');await f.click('#cloud-load');
    await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
    const restored=await f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
    ok(restored.player.hp===4&&restored.player.on===previous.platform&&restored.falls===1,mode+' chapter '+(level+1)+' reload preserves health and landing history');
    if(mode==='3d'&&level===0){
     const migration=await f.evaluate(()=>{const old=__qa.exportCurrentRun();delete old.player.hp;delete old.player.maxHp;delete old.falls;delete old.fallHistory;return {ok:__qa.restoreCurrentRun(old),hp:gameInfo().player.hp,on:gameInfo().player.on}});
     ok(migration.ok&&migration.hp===6&&migration.on===previous.platform,'Legacy 3D runs without health or landing history remain loadable');
     const malformed=await f.evaluate(()=>{const r=__qa.exportCurrentRun();r.fallHistory=[{id:999,x:0,z:0}];return __qa.restoreCurrentRun(r)});
     ok(malformed===false,'Invalid landing history is rejected before replacing a saved 3D run');
    }
   }
   await page.screenshot({path:path.join(output,mode+'-fall-paused.png')});
   await page.reload();await surface().waitForFunction(mode=>mode==='2d'?window.pixelInfo?.().loaded:window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'),mode);
   const f2=surface();await f2.click('#cloud-load');await f2.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
   ok(await f2.evaluate(mode=>(mode==='2d'?pixelInfo():gameInfo()).player.hp,mode)===4,mode+' reduced health survives a full page refresh');
   if(mode==='3d'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(output,'3d-health-mobile.png')});ok(await f2.evaluate(()=>document.querySelector('#health').getBoundingClientRect().right<=innerWidth),'3D health remains inside the mobile viewport')}
  }
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log('Checks:',report.checks.length);
 }catch(e){fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({...report,error:String(e).slice(0,1200)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(String(e).slice(0,1200));process.exitCode=1});
