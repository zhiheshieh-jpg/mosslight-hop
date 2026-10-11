const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'sky-browser');fs.mkdirSync(out,{recursive:true});
const url=process.env.QA_URL||'http://127.0.0.1:4186/2d/?qa';
const source=fs.readFileSync(path.join(__dirname,'sky-driver.mjs'),'utf8').replace(/^import[^\n]+\n/,'').replaceAll('export function','function').replaceAll('export const','const');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 // The only setup is legitimately persisted prior-chapter completions. The third
 // chapter starts at its real entrance with an untouched fresh world.
 await context.addInitScript(()=>{localStorage.setItem('mosslight-pixel-progress',JSON.stringify({version:1,completed:[true,true,false]}));localStorage.setItem('mosslight-pixel-god','false')});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.text().startsWith('SKY_ROUTE '))console.log(m.text());else if(m.type()==='error')errors.push(m.text())});
 await page.goto(url);await page.waitForFunction(()=>window.__pixelQA&&pixelInfo().loaded);
 await page.evaluate(async source=>{const {hazardState}=await import('./world.js');window.__skyPilot=new Function('hazardState',source+';return skyDriver;')(hazardState)},source);
 await page.click('[data-level="2"]');await page.click('#start');
 const initial=await page.evaluate(()=>pixelInfo());assert.equal(initial.level,2);assert.equal(initial.godMode,false);assert.equal(initial.deaths,0);assert.equal(initial.checkpointCount,1);assert.ok(initial.player.x<100);assert.equal(initial.player.hp,initial.player.maxHp);
 await page.screenshot({path:path.join(out,'normal-route-start.png')});
 console.log('SKY_ROUTE launched actual DOM keyboard events; no world writes; 1440x900; one checkpoint; normal mode.');
 const result=await page.evaluate(()=>new Promise(resolve=>{
  const drive=__skyPilot(),held=new Set(),started=performance.now(),patterns=new Set(),hurts=[],stages=[];let lastTime=-1,lastHp=__pixelQA.world().player.hp,lastLog=-1,furthest=0,frames=0,everGod=false,checkpointViolation=false,previousX=__pixelQA.world().player.x,maxMovement=0;
  function set(code,on){if(on&&!held.has(code)){window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.add(code)}else if(!on&&held.has(code)){window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.delete(code)}}
  function finish(reason){for(const code of [...held])set(code,false);const w=__pixelQA.world();resolve({reason,initialPosition:75,wallSeconds:(performance.now()-started)/1000,snapshot:pixelInfo(),realTime:w.realTime,everGod,checkpointViolation,furthest,maxMovement,frames,patterns:[...patterns],hurts,stages,controls:'DOM keydown/keyup A,D,Space,J,K; no simulation stepping or state writes'})}
  function frame(){const w=__pixelQA.world();frames++;everGod ||= w.godMode||w.usedGodMode;checkpointViolation ||= w.level.checkpoints.length!==1;furthest=Math.max(furthest,w.player.x);maxMovement=Math.max(maxMovement,Math.abs(w.player.x-previousX));previousX=w.player.x;
   const boss=w.enemies.find(e=>e.type==='boss');if(boss.pattern)patterns.add(boss.pattern);if(w.player.hp<lastHp)hurts.push({x:Math.round(w.player.x),hp:w.player.hp,t:+w.time.toFixed(2)});lastHp=w.player.hp;
   const section=w.level.ground.find(a=>w.player.x>=a.x&&w.player.x<a.x+a.w)?.section;if([0,10,21,31,41].includes(section)&&!stages.includes(section))stages.push(section);
   const log=Math.floor(w.realTime/30);if(log!==lastLog){lastLog=log;console.log('SKY_ROUTE '+JSON.stringify({time:+w.realTime.toFixed(1),x:Math.round(w.player.x),hp:w.player.hp,kills:w.kills,deaths:w.deaths,bossHp:boss.hp,god:w.godMode}))}
   if(w.complete)return finish('complete');if(w.deaths>0)return finish('death');if(everGod||checkpointViolation)return finish('invariant');if(performance.now()-started>720000)return finish('timeout');
   if(lastTime!==w.realTime){lastTime=w.realTime;const input=drive(w);set('KeyA',input.x<0);set('KeyD',input.x>0);set('Space',input.jump);set('KeyJ',input.attack);set('KeyK',input.dash)}requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
 }));
 result.errors=errors;result.timestamp=new Date().toISOString();fs.writeFileSync(path.join(out,'normal-route-results.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(out,'normal-route-'+result.reason+'.png')});
 assert.equal(result.reason,'complete',JSON.stringify(result));assert.equal(result.snapshot.complete,true);assert.equal(result.snapshot.mode,'complete');assert.equal(result.snapshot.deaths,0);assert.equal(result.everGod,false);assert.equal(result.checkpointViolation,false);assert.equal(result.snapshot.boss.hp,0);assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mosslight-pixel-progress')).completed[2]),true);
 console.log(JSON.stringify({passed:true,time:result.snapshot.time,realTime:result.realTime,wallSeconds:result.wallSeconds,deaths:result.snapshot.deaths,godMode:result.snapshot.godMode,kills:result.snapshot.kills,enemies:result.snapshot.enemies,checkpoints:result.snapshot.checkpointCount,bossHp:result.snapshot.boss.hp,patterns:result.patterns,stages:result.stages,errors,artifacts:out}));
}finally{await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
