const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'lab3d-browser');fs.mkdirSync(out,{recursive:true});
const url=process.env.QA_URL||'http://127.0.0.1:4199/?qa';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],results={};
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(45000);
 const ready=async()=>{await page.goto(url);await page.waitForFunction(()=>window.__qa&&document.getElementById('loading').classList.contains('hidden'))};
 await ready();await page.screenshot({path:path.join(out,'01-menu.png')});
 assert.equal(await page.evaluate(()=>__qa.begin(3)),false);assert.equal(await page.evaluate(()=>__qa.setGodMode(true)),false);assert.equal(await page.evaluate(()=>__qa.setCharacter('logo')),false);await page.keyboard.press('g');assert.equal(await page.evaluate(()=>gameInfo().godMode),false);
 await page.evaluate(()=>{__qa.begin(0);__qa.pause();__qa.setCharacter('claude')});assert.equal(await page.evaluate(()=>gameInfo().mixedCharacters),true);
 await page.evaluate(()=>{const w=__qa.world(),a=w.platforms.at(-1);Object.assign(w.player,{x:a.x,y:a.y,z:a.z-1.5,grounded:true,on:a.id,vx:0,vy:0,vz:0});__qa.resume()});await page.waitForFunction(()=>gameInfo().mode==='complete');assert.equal(await page.evaluate(()=>gameInfo().progress.byCharacter.claude[0]),false);
 results.lockedAndMixedRun=true;
 await page.evaluate(()=>{localStorage.setItem('mosslight-3d-progress',JSON.stringify({version:2,byCharacter:{dragon:[true,true,true,false],claude:[true,true,true,false]},legacyCompleted:[false,false,false,false]}));localStorage.setItem('mosslight-3d-god','true')});
 await ready();assert.equal(await page.evaluate(()=>gameInfo().godMode),false);assert.equal(await page.evaluate(()=>__qa.begin(3)),true);await page.evaluate(()=>__qa.pause());await page.screenshot({path:path.join(out,'02-lab-pause.png')});
 await page.evaluate(()=>__qa.resume());await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'03-lab-start.png')});
 // Input-only proof in the live browser world; no placement/time/god-mode edits.
 const driver=fs.readFileSync(path.join(__dirname,'palace-driver.mjs'),'utf8').replace(/^import[^\n]+\n/,'').replace('export function palaceDriver','function palaceDriver');
 results.route=await page.evaluate(async source=>{
  const {mechanismPhase,crusherHeight,platformToLocal}=await import('./physics.js');
  const make=new Function('mechanismPhase','crusherHeight','platformToLocal',source+';return palaceDriver()'),drive=make(mechanismPhase,crusherHeight,platformToLocal),w=__qa.world(),visited=new Set([0]);
  for(let i=0;i<120*180&&!w.complete&&!w.deaths;i++){w.step(1/120,drive(w));if(w.player.grounded)visited.add(w.player.on)}
  return {complete:w.complete,deaths:w.deaths,visited:visited.size,usedGodMode:w.usedGodMode,character:w.character};
 },driver);
 assert.equal(results.route.complete,true);assert.equal(results.route.deaths,0);assert.equal(results.route.visited,50);assert.equal(results.route.usedGodMode,false);
 await page.waitForFunction(()=>gameInfo().mode==='complete');assert.equal(await page.evaluate(()=>gameInfo().progress.godUnlocked),true);await page.screenshot({path:path.join(out,'04-lab-complete.png')});
 await page.evaluate(()=>{__qa.home();__qa.setGodMode(true);__qa.setCharacter('logo');__qa.begin(3)});await page.waitForTimeout(150);const before=await page.evaluate(()=>gameInfo());assert.equal(before.logoMeshes>0,true);assert.equal(before.needleCount,24);
 await page.screenshot({path:path.join(out,'05-logo.png')});await page.keyboard.down('w');await page.keyboard.down('x');await page.waitForTimeout(280);await page.keyboard.up('x');await page.keyboard.up('w');const after=await page.evaluate(()=>gameInfo());assert.ok(Math.hypot(after.player.vx,after.player.vz)>25);results.logo={meshes:before.logoMeshes,needles:before.needleCount,dashSpeed:Math.hypot(after.player.vx,after.player.vz)};
 await page.evaluate(()=>__qa.pause());await page.locator('#modal [data-character="claude"]').click();await page.locator('#modal [data-character="logo"]').click();await page.evaluate(()=>__qa.setGodMode(false));assert.equal(await page.evaluate(()=>gameInfo().character),'claude');assert.equal(await page.evaluate(()=>gameInfo().godMode),false);assert.equal(await page.evaluate(()=>gameInfo().usedGodMode),true);
 for(const size of [{width:390,height:844},{width:296,height:550},{width:844,height:390}]){
  await page.setViewportSize(size);await page.evaluate(()=>__qa.home());await page.screenshot({path:path.join(out,`menu-${size.width}.png`)});
  const menu=await page.locator('#menu').evaluate(el=>({client:el.clientHeight,scroll:el.scrollHeight,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));assert.ok(menu.left>=0&&menu.right<=size.width&&menu.top>=55&&menu.bottom<=size.height);
  await page.locator('#to-2d').scrollIntoViewIfNeeded();assert.ok(await page.locator('#to-2d').isVisible());await page.locator('#start').scrollIntoViewIfNeeded();await page.locator('#start').click();await page.waitForTimeout(80);await page.screenshot({path:path.join(out,`play-${size.width}.png`)});await page.evaluate(()=>__qa.pause());await page.screenshot({path:path.join(out,`pause-${size.width}.png`)});
 }
 assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
