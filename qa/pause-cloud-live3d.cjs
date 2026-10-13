const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.PAUSE_QA_LIVE_URL||'http://127.0.0.1:4186/';
const output='qa/pause-account3d';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:process.env.PAUSE_QA_HEADED!=='1'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('mosslight-3d-progress',JSON.stringify({version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]})));
  await page.goto(base+'?qa');await page.waitForFunction(()=>window.__qa&&document.querySelector('#cloud-save')&&document.querySelector('#loading').classList.contains('hidden'));
  if(await page.locator('#account-dialog[open]').count())await page.locator('#account-dialog .account-done').click();
  await page.click('[data-character="claude"]');await page.click('#start');await page.waitForFunction(()=>!!document.fullscreenElement&&gameInfo().camera.keyboardLock!=='locking');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused');
  const saved=await page.evaluate(()=>__qa.exportCurrentRun());
  const synchronized=await page.evaluate(async()=>{const account=await import('./account.js');return account.saveNow()});assert.equal(synchronized,true);
  const serverMatch=await page.evaluate(async()=>{const session=JSON.parse(localStorage.getItem('mosslight-account-session-v1'));const r=await fetch('./api/me',{headers:{Authorization:'Bearer '+session.token}});const data=await r.json();const run=JSON.parse(data.document.storage['mosslight-run-3d']);return {level:run.level,time:run.time,character:run.character}});
  assert.deepEqual(serverMatch,{level:saved.level,time:saved.time,character:saved.character});
  await page.reload();await page.waitForFunction(()=>window.__qa&&document.querySelector('#cloud-load')&&!document.querySelector('#cloud-load').disabled&&document.querySelector('#loading').classList.contains('hidden'));
  await page.click('#cloud-load');await page.waitForFunction(()=>gameInfo().mode==='paused');assert.deepEqual(await page.evaluate(()=>__qa.exportCurrentRun()),saved);
  await page.click('#home');await page.setViewportSize({width:390,height:844});await page.locator('#account-strip').scrollIntoViewIfNeeded();await page.screenshot({path:output+'/mobile-live-account.png'});
  assert.deepEqual(errors,[]);
  const report={browser:'Microsoft Edge '+browser.version(),realApi:true,cloudUploadVerified:true,reloadRestoresExactRun:true,registeredAccounts:1,errors};
  fs.writeFileSync(output+'/live-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
