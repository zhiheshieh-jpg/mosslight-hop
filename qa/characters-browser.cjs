const {chromium}=require('playwright'),assert=require('node:assert/strict');
const url='http://127.0.0.1:4186/2d/?qa';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url);await page.waitForFunction(()=>pixelInfo().loaded);
 assert.deepEqual(await page.evaluate(()=>pixelInfo().characterFrames),{dragon:8,claude:8});
 assert.equal(await page.locator('#menu-characters button').count(),2);
 assert.equal(await page.evaluate(()=>pixelInfo().characterId),'dragon');
 assert.equal(await page.locator('body').innerText().then(t=>t.includes('星铃')),false);
 await page.screenshot({path:'qa/switch-dragon-menu.png'});
 await page.click('#menu-characters [data-character="claude"]');
 assert.equal(await page.locator('#character-name').innerText(),'Claude');
 await page.screenshot({path:'qa/switch-claude-menu.png'});
 await page.click('#start');await page.keyboard.down('KeyD');await page.waitForTimeout(220);await page.keyboard.up('KeyD');
 assert.ok((await page.evaluate(()=>pixelInfo().player.x))>85);
 await page.screenshot({path:'qa/switch-claude-game.png'});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{const w=__pixelQA.world();w.player.hp=3;w.score=730;w.collected.add(12);w.kills=2;w.enemies[0].dead=true;w.enemies[1].dead=true;w.checkpoint=1});
 const before=await page.evaluate(()=>JSON.stringify(__pixelQA.world()));
 await page.click('#pause-characters [data-character="dragon"]');
 assert.equal(await page.evaluate(()=>pixelInfo().characterId),'dragon');
 assert.equal(await page.evaluate(()=>JSON.stringify(__pixelQA.world())),before,'switch must preserve every simulation field');
 assert.equal(await page.locator('#hero-name').innerText(),'小龙娘');
 await page.screenshot({path:'qa/switch-pause.png'});
 await page.click('#resume');await page.waitForTimeout(120);
 const after=await page.evaluate(()=>pixelInfo());assert.equal(after.mode,'playing');assert.equal(after.player.hp,3);assert.equal(after.score,730);assert.equal(after.checkpoint,1);
 await page.screenshot({path:'qa/switch-dragon-game.png'});
 await page.keyboard.press('Escape');await page.click('#pause-characters [data-character="claude"]');
 await page.reload();await page.waitForFunction(()=>pixelInfo().loaded);assert.equal(await page.evaluate(()=>pixelInfo().characterId),'claude');
 await page.evaluate(()=>localStorage.setItem('mosslight-pixel-character','xingling'));
 await page.reload();await page.waitForFunction(()=>pixelInfo().loaded);assert.equal(await page.evaluate(()=>pixelInfo().characterId),'dragon');
 for(const id of ['dragon','claude']){
  await page.evaluate(id=>{__pixelQA.begin(0);__pixelQA.setCharacter(id);const w=__pixelQA.world(),e=w.enemies[0];Object.assign(w.player,{x:e.x-48,y:e.home.y-42,grounded:true,on:e.home.id,vx:0,vy:0})},id);
  await page.keyboard.down('KeyJ');await page.waitForTimeout(850);await page.keyboard.up('KeyJ');
  assert.ok((await page.evaluate(()=>pixelInfo().kills))>0);
  await page.keyboard.down('Space');await page.waitForTimeout(60);await page.keyboard.up('Space');await page.waitForTimeout(30);assert.ok((await page.evaluate(()=>pixelInfo().player.vy))<0);
  await page.keyboard.down('KeyK');await page.waitForTimeout(60);await page.keyboard.up('KeyK');assert.ok((await page.evaluate(()=>pixelInfo().player.dashCooldown))>0);
  await page.screenshot({path:'qa/switch-'+id+'-combat.png'});
 }
 const m=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await m.newPage();
 p.on('pageerror',e=>errors.push(String(e)));await p.goto(url);await p.waitForFunction(()=>pixelInfo().loaded);await p.screenshot({path:'qa/switch-mobile-menu.png'});
 async function fits(selector){const boxes=await p.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));for(const b of boxes){assert.ok(b.x>=0&&b.y>=0&&b.right<=p.viewportSize().width+1&&b.bottom<=p.viewportSize().height+1,JSON.stringify(b))}}
 await fits('#menu-characters button,#start');
 await p.tap('#menu-characters [data-character="claude"]');await p.tap('#start');await p.tap('#pause');await p.tap('#pause-characters [data-character="dragon"]');assert.equal(await p.evaluate(()=>pixelInfo().characterId),'dragon');await fits('#pause-characters button,#resume,#home');await p.screenshot({path:'qa/switch-mobile-pause.png'});
 await p.setViewportSize({width:844,height:390});await p.screenshot({path:'qa/switch-landscape-pause.png'});await fits('#pause-characters button,#resume,#home');
 await p.tap('#home');await p.screenshot({path:'qa/switch-landscape-menu.png'});await fits('#menu-characters button,#start');
 await p.setViewportSize({width:360,height:640});await p.screenshot({path:'qa/switch-small-menu.png'});await fits('#menu-characters button,#start');
 const denied=await browser.newContext();await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('denied')}}));const d=await denied.newPage();d.on('pageerror',e=>errors.push(String(e)));await d.goto(url);await d.waitForFunction(()=>pixelInfo().loaded);await d.click('#menu-characters [data-character="claude"]');assert.equal(await d.evaluate(()=>pixelInfo().characterId),'claude');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({characters:2,framesPerCharacter:8,progressPreserved:true,persisted:true,legacyFallback:true,deniedStorage:true,mobile:true,errors}));
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});

