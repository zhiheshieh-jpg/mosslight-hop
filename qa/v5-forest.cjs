const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('http://127.0.0.1:4186/?qa');
  await page.waitForFunction(()=>window.__qa&&document.querySelector('#loading').classList.contains('hidden'));
  await page.click('#start');await page.waitForFunction(()=>gameInfo().camera.locked&&gameInfo().camera.fullscreen);
  await page.waitForTimeout(350);await page.screenshot({path:'qa/v5-forest-start.png'});
  assert.equal(await page.evaluate(()=>gameInfo().platformCount),22);
  // Teleports below isolate visual/collection checks, not the full-route playthrough in v4-browser.
  await page.evaluate(async()=>{const {platformToWorld}=await import('./physics.js'),w=__qa.world(),a=w.platforms[7];Object.assign(w.player,platformToWorld(a,1.7,.8),{y:a.y,vy:0,vx:0,vz:0,grounded:true,on:a.id});w.checkpoint=4;w.respawnGrace=3});
  await page.waitForTimeout(400);const before=await page.evaluate(()=>gameInfo());await page.screenshot({path:'qa/v5-rotation-before.png'});
  await page.waitForTimeout(1100);const after=await page.evaluate(()=>gameInfo());await page.screenshot({path:'qa/v5-rotation-after.png'});
  assert.equal(after.player.on,7);assert.ok(Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z)>.6);assert.equal(after.deaths,0);
  const a=before.mechanisms.find(a=>a.id===7),b=after.mechanisms.find(a=>a.id===7);assert.equal(a.x,b.x);assert.equal(a.z,b.z);assert.ok(b.angle<a.angle-.35);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused');const paused=await page.evaluate(()=>gameInfo());await page.waitForTimeout(350);const still=await page.evaluate(()=>gameInfo());assert.equal(still.time,paused.time);assert.deepEqual(still.player,paused.player);assert.deepEqual(still.mechanisms,paused.mechanisms);
  await page.click('#modal-primary');await page.waitForFunction(()=>gameInfo().camera.locked);
  await page.evaluate(()=>{const w=__qa.world(),a=w.platforms[19];Object.assign(w.player,{x:a.x,z:a.z+1,y:a.y,vy:0,vx:0,vz:0,grounded:true,on:a.id});w.checkpoint=18});await page.waitForTimeout(400);await page.screenshot({path:'qa/v5-forest-final-stretch.png'});
  for(let i=0;i<25;i++){await page.evaluate(async i=>{const {platformToWorld}=await import('./physics.js'),w=__qa.world(),item=w.collectibles[i],a=w.platforms[item.platform];Object.assign(w.player,platformToWorld(a,item.x,item.z),{y:a.y,vy:0,vx:0,vz:0,grounded:true,on:a.id});w.respawnGrace=1},i);await page.waitForTimeout(80)}
  const collected=await page.evaluate(()=>gameInfo());assert.equal(collected.collection.score,370);assert.equal(collected.collection.total,25);assert.equal(collected.collectionBook.gold,true);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused');await page.click('#home');await page.waitForFunction(()=>!gameInfo().camera.fullscreen);
  const mobile=await browser.newContext({viewport:{width:366,height:650},isMobile:true,hasTouch:true}),phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));
  await phone.goto('http://127.0.0.1:4186/?qa');await phone.waitForFunction(()=>window.__qa&&document.querySelector('#loading').classList.contains('hidden'));await phone.screenshot({path:'qa/v5-forest-mobile-menu.png'});await phone.click('#start');await phone.waitForTimeout(350);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.screenshot({path:'qa/v5-forest-mobile.png'});await mobile.close();
  assert.deepEqual(errors,[]);const report={platforms:22,rotating:5,carryDistance:Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z),paused:true,collection:collected.collection,errors};fs.writeFileSync('qa/v5-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
