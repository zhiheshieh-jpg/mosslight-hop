const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PAUSE_QA_URL||'http://127.0.0.1:4193/';
const output='qa/pause-account3d';
fs.mkdirSync(output,{recursive:true});
const fullProgress={version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]};
const report={checks:[],browser:'Microsoft Edge',errors:[]};
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name)}
async function ready(page){await page.goto(base+'?qa');await page.waitForFunction(()=>window.__qa&&document.querySelector('#cloud-save')&&document.querySelector('#loading').classList.contains('hidden'),{timeout:30000})}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:process.env.PAUSE_QA_HEADED!=='1'});
 report.version=browser.version();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'QA offline fallback'})}));
  await context.addInitScript(progress=>localStorage.setItem('mosslight-3d-progress',JSON.stringify(progress)),fullProgress);
  if(process.env.PAUSE_QA_GRANT==='1'){
   try{const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.setPermission',{permission:{name:'keyboard-lock'},setting:'granted',origin:new URL(base).origin});report.permission='granted'}catch(e){report.permission=String(e)}
  }
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));
  await ready(page);
  await check('Menu captures no run',async()=>assert.equal(await page.evaluate(()=>__qa.exportCurrentRun()),null));
  await page.click('[data-character="claude"]');await page.click('#start');
  await page.waitForFunction(()=>!!document.fullscreenElement);
  await page.waitForFunction(()=>gameInfo().camera.keyboardLock!=='locking');
  report.initialImmersion=await page.evaluate(()=>gameInfo().camera);
  await check('Playing rejects manual character changes',async()=>assert.equal(await page.evaluate(()=>__qa.setCharacter('dragon')),false));
  await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused');
  report.afterEscape=await page.evaluate(()=>({mode:gameInfo().mode,fullscreen:!!document.fullscreenElement,keyboardLock:gameInfo().camera.keyboardLock}));
  await check('Escape freezes game time',async()=>{const before=await page.evaluate(()=>gameInfo().time);await page.waitForTimeout(450);assert.equal(await page.evaluate(()=>gameInfo().time),before)});
  if(report.initialImmersion.keyboardLock==='locked')await check('Escape retains fullscreen when keyboard lock is granted',async()=>assert.equal(report.afterEscape.fullscreen,true));
  await check('Pause offers no character switch',async()=>{assert.equal(await page.locator('#modal [data-character]').count(),0);assert.equal(await page.evaluate(()=>__qa.setCharacter('dragon')),false);assert.equal(await page.evaluate(()=>gameInfo().character),'claude')});
  await page.screenshot({path:output+'/escape-paused.png'});
  await page.click('#modal-primary');await page.waitForFunction(()=>gameInfo().mode==='playing');
  await check('Fullscreen exit pauses without pointer lock',async()=>{await page.evaluate(()=>{window.__originalPointerLock=HTMLCanvasElement.prototype.requestPointerLock;HTMLCanvasElement.prototype.requestPointerLock=undefined;document.exitPointerLock()});await page.waitForFunction(()=>gameInfo().mode==='paused');await page.click('#modal-primary');assert.equal(await page.evaluate(()=>document.pointerLockElement),null);await page.evaluate(()=>document.exitFullscreen());await page.waitForFunction(()=>gameInfo().mode==='paused');const t=await page.evaluate(()=>gameInfo().time);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>gameInfo().time),t);await page.evaluate(()=>HTMLCanvasElement.prototype.requestPointerLock=window.__originalPointerLock)});
  await page.click('#modal-primary');await page.waitForFunction(()=>!!document.fullscreenElement&&gameInfo().mode==='playing');
  await check('Continue restores fullscreen',async()=>assert.equal(await page.evaluate(()=>!!document.fullscreenElement),true));
  await page.evaluate(()=>{const w=__qa.world();w.time=37.5;w.attemptTime=37.5;w.deaths=3;w.checkpoint=4;w.farthest=4;const p=w.platforms[4];Object.assign(w.player,{x:p.x,y:p.y,z:p.z+.5,vx:0,vy:0,vz:0,grounded:true,on:4,coyote:.14,buffer:0});w.collected=new Set([w.collectibles[0].id,w.collectibles[1].id]);w.step(1/120,{});__qa.pause()});
  const saved=await page.evaluate(()=>__qa.exportCurrentRun());fs.writeFileSync(output+'/saved-run.json',JSON.stringify(saved,null,2));
  await page.click('#cloud-save');
  await check('Pause save captures the current run',async()=>{const r=await page.evaluate(async()=>{const account=await import('./account.js');return account.loadRun('3d')});assert.equal(r.time,saved.time);assert.deepEqual(r.player,saved.player);assert.deepEqual(r.collected,saved.collected)});
  await page.click('#home');await page.waitForFunction(()=>gameInfo().mode==='menu');
  await check('Home saves before rebuilding menu',async()=>{const r=await page.evaluate(async()=>{const account=await import('./account.js');return account.loadRun('3d')});assert.equal(r.time,saved.time);assert.deepEqual(r.player,saved.player);assert.equal(await page.evaluate(()=>__qa.exportCurrentRun()),null)});
  await page.click('[data-character="dragon"]');
  await check('Menu permits character changes',async()=>assert.equal(await page.evaluate(()=>gameInfo().character),'dragon'));
  await page.click('#cloud-load');console.log('LOAD',await page.evaluate(()=>({mode:gameInfo().mode,status:document.querySelector('[data-cloud-status]')?.textContent})));await page.waitForFunction(()=>gameInfo().mode==='paused');
  await check('Load restores player, collection, mechanisms and camera exactly',async()=>assert.deepEqual(await page.evaluate(()=>__qa.exportCurrentRun()),saved));
  await check('Invalid save leaves the current run unchanged',async()=>{const result=await page.evaluate(()=>{const before=JSON.stringify(__qa.exportCurrentRun());const record=__qa.exportCurrentRun();record.player.x=NaN;return {accepted:__qa.restoreCurrentRun(record),same:JSON.stringify(__qa.exportCurrentRun())===before}});assert.deepEqual(result,{accepted:false,same:true})});
  for(const level of [1,2,3])await check('Chapter '+(level+1)+' resumes all mechanism state',async()=>{const result=await page.evaluate(level=>{__qa.begin(level);const w=__qa.world();for(let i=0;i<120;i++)w.step(1/120,{});w.platforms.filter(p=>p.kind==='crumble').slice(0,1).forEach(p=>p.triggerAt=w.attemptTime);__qa.pause();const r=__qa.exportCurrentRun();return {accepted:__qa.restoreCurrentRun(r),before:r,after:__qa.exportCurrentRun()}},level);assert.equal(result.accepted,true);assert.deepEqual(result.after,result.before)});
  await page.click('#home');
  await page.evaluate(()=>{__qa.setGodMode(true);__qa.setCharacter('logo')});await page.click('#start');await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused');
  await check('Logo may disable god mode via the required normal-character fallback',async()=>{const result=await page.evaluate(()=>{__qa.setGodMode(false);return {god:gameInfo().godMode,character:gameInfo().character,used:gameInfo().usedGodMode}});assert.equal(result.god,false);assert.notEqual(result.character,'logo');assert.equal(result.used,true)});
  await page.click('#modal-primary');await page.evaluate(()=>{const w=__qa.world();w.emit('checkpoint')});await page.waitForTimeout(150);
  await check('Checkpoint event captures a run',async()=>assert.ok(await page.evaluate(async()=>{const a=await import('./account.js');return a.loadRun('3d')?.schema==='mosslight-3d-run'})));
  await page.evaluate(()=>{const w=__qa.world();w.complete=true;w.emit('complete')});await page.waitForFunction(()=>gameInfo().mode==='complete');
  await check('Completion clears the resumable run',async()=>assert.equal(await page.evaluate(async()=>{const a=await import('./account.js');return a.loadRun('3d')}),null));
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.route('**/api/**',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
  const phone=await mobile.newPage();phone.on('pageerror',e=>report.errors.push(String(e)));await ready(phone);
  await phone.locator('#account-strip').scrollIntoViewIfNeeded();await phone.screenshot({path:output+'/mobile-menu.png'});
  await check('390x844 account and start controls fit within the menu',async()=>{const boxes=await phone.locator('#account-strip,#account-open,#cloud-load,#start').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom}}));for(const b of boxes){assert.ok(b.x>=0&&b.right<=391,JSON.stringify(b));assert.ok(b.y>=0&&b.bottom<=844,JSON.stringify(b))}});
  await phone.tap('#start');await phone.tap('#pause');await phone.screenshot({path:output+'/mobile-paused.png'});
  await check('390x844 pause controls are visible without overlap',async()=>{const boxes=await phone.locator('#cloud-save,#account-pause-open,#modal-primary,#restart,#home').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y,bottom:r.bottom}}));for(let i=0;i<boxes.length;i++){const b=boxes[i];assert.ok(b.x>=0&&b.right<=391&&b.y>=0&&b.bottom<=844,JSON.stringify(b));if(i>1)assert.ok(b.y>=boxes[i-1].bottom-1,JSON.stringify(boxes))}});
  assert.deepEqual(report.errors,[]);
  fs.writeFileSync(output+'/results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
