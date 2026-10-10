const {chromium}=require('playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const driverSource=fs.readFileSync('qa/driver.mjs','utf8').replace(/^import[^\n]+\n/,'').replace('export function','function');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',e=>{if(e.text().startsWith('ROUTE '))console.log(e.text())});
 await page.goto('http://127.0.0.1:4186/?qa');await page.waitForFunction(()=>window.__qa&&document.querySelector('#loading').classList.contains('hidden'));
 await page.evaluate(async source=>{const m=await import('./physics.js');window.routePilot=new Function('mechanismPhase','crusherHeight',source+';return routeDriver;')(m.mechanismPhase,m.crusherHeight)},driverSource);
 await page.click('#start');
 const run=()=>page.evaluate(()=>new Promise(resolve=>{
  const drive=routePilot(),held=new Set;let checkpoint=-1;
  const started=performance.now();
  function set(code,on){if(on&&!held.has(code)){dispatchEvent(new KeyboardEvent('keydown',{code}));held.add(code)}else if(!on&&held.has(code)){dispatchEvent(new KeyboardEvent('keyup',{code}));held.delete(code)}}
  const timer=setInterval(()=>{
   const w=__qa.world();
   if(checkpoint!==w.checkpoint){checkpoint=w.checkpoint;console.log(`ROUTE level ${w.level+1}, checkpoint ${checkpoint}, deaths ${w.deaths}`)}
   if(w.complete||performance.now()-started>180000){clearInterval(timer);for(const code of [...held])set(code,false);resolve(gameInfo());return}
   const input=drive(w);set('KeyA',input.x<0);set('KeyD',input.x>0);set('KeyW',input.z<0);set('KeyS',input.z>0);set('Space',input.jump);
  },12);
 }));
 const forest=await run();assert.equal(forest.complete,true);await page.screenshot({path:'qa/v4-forest-complete.png'});
 await page.click('#modal-primary');
 const city=await run();assert.equal(city.complete,true);assert.equal(city.platformCount,30);assert.equal(city.checkpoint,24);await page.screenshot({path:'qa/v4-city-complete.png'});
 await page.click('#home');await page.waitForFunction(()=>!gameInfo().camera.fullscreen);await page.click('#start');await page.waitForFunction(()=>gameInfo().camera.locked);
 for(const [id,name] of [[3,'sweeper'],[8,'crusher'],[18,'pulse'],[28,'final']]){
  await page.evaluate(id=>{const w=__qa.world(),a=w.platforms[id];w.checkpoint=w.def.checkpoints.filter(x=>x<id).at(-1)||0;Object.assign(w.player,{x:a.x,z:a.z+a.d/2-.35,y:a.y,vy:0,vx:0,vz:0,grounded:true,on:id});w.respawnGrace=5},id);
  await page.waitForTimeout(450);await page.screenshot({path:`qa/v4-${name}.png`});
 }
 await page.keyboard.press('Escape');await page.waitForFunction(()=>gameInfo().mode==='paused'&&!gameInfo().camera.locked);await page.click('#home');await page.waitForFunction(()=>!gameInfo().camera.fullscreen);
 const mobile=await browser.newContext({viewport:{width:366,height:650},isMobile:true,hasTouch:true});const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(String(e)));await phone.goto('http://127.0.0.1:4186/?qa');await phone.waitForFunction(()=>window.__qa&&document.querySelector('#loading').classList.contains('hidden'));await phone.click('[data-level="1"]');await phone.click('#start');await phone.waitForTimeout(350);assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await phone.screenshot({path:'qa/v4-phone.png'});await mobile.close();
 assert.deepEqual(errors,[]);
 const report={forest:{complete:forest.complete,time:forest.time,deaths:forest.deaths},city:{complete:city.complete,time:city.time,deaths:city.deaths,platforms:city.platformCount,checkpoints:city.checkpoint},errors};
 fs.writeFileSync('qa/v4-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
