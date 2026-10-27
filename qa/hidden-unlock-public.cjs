// Real account/API smoke check; never writes credentials to output or disk.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const url=process.env.QA_URL||'http://124.221.255.132/mosslight/',out=process.env.QA_OUTPUT||'.deploy/hidden-unlock-update/public-unlock';
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));const ok=(v,label)=>{assert.ok(v,label);checks.push(label);console.log('PASS '+label)};
 if(process.env.QA_ASSET_CACHE){const root=path.resolve(process.env.QA_ASSET_CACHE),prefix=new URL(url).pathname;await context.route('**/*',route=>{const u=new URL(route.request().url()),file=path.resolve(root,u.pathname.slice(prefix.length));if(u.origin===new URL(url).origin&&u.pathname.startsWith(prefix)&&file.startsWith(root+path.sep)&&/\.(png|glb)$/.test(file)&&fs.existsSync(file))return route.fulfill({path:file});return route.continue()})}
 try{
  await page.goto(url);await page.waitForFunction(()=>window.pixelInfo?.().loaded);if(await page.locator('#account-dialog').evaluate(e=>e.open))await page.click('.account-done');
  ok(!await page.evaluate(()=>pixelInfo().progress.godUnlocked),'Fresh public account is locked');
  for(const key of ['m','a','n'])await page.keyboard.down(key);for(const key of ['m','a','n'])await page.keyboard.up(key);
  ok(await page.locator('#unlock-input-dialog').evaluate(e=>e.open)&&!await page.locator('#unlock-input-dialog input').getAttribute('placeholder'),'Native hidden chord opens a plain input with no hint');
  await page.screenshot({path:path.join(out,'input.png')});await page.locator('#unlock-input-dialog input').fill('What can I say');await page.keyboard.press('Enter');await page.waitForFunction(()=>pixelInfo().progress.godUnlocked&&!document.querySelector('#unlock-input-dialog').open);
  ok(await page.evaluate(()=>!pixelInfo().godMode&&pixelInfo().progress.completed.every(v=>!v)&&!pixelInfo().progress.unlocked[3]),'Public unlock preserves disabled preference and ordinary chapter requirements');
  await page.waitForFunction(async()=>{const session=JSON.parse(localStorage.getItem('mosslight-account-session-v1')),r=await fetch(new URL('api/me',location.href),{headers:{Authorization:'Bearer '+session.token}}),v=await r.json();return v.document?.storage?.['mosslight-secret-god-unlocked']==='true'});
  ok(true,'Actual API stores the account entitlement');
  await page.reload();await page.waitForFunction(()=>window.pixelInfo?.().loaded);ok(await page.evaluate(()=>pixelInfo().progress.godUnlocked&&!pixelInfo().godMode),'Public reload retains unlock without auto-enabling it');
  await page.click('#god-menu');ok(await page.evaluate(()=>pixelInfo().godMode),'Existing public switch can enable unlocked god mode');await page.click('#god-menu');
  await page.getByRole('link',{name:'前往3D',exact:true}).click();await page.waitForFunction(()=>window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'));
  ok(await page.evaluate(()=>gameInfo().progress.godUnlocked&&!gameInfo().godMode&&gameInfo().progress.completed.every(v=>!v)),'Same public account shares unlock with 3D without completing chapters');
  ok(await page.locator('[data-character],#health').count()===0,'3D keeps the white block and has no combat/health UI');assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,url,checks,errors},null,2));
 }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e.stack),checks,errors},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
