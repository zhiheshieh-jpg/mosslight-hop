const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'palace-browser');fs.mkdirSync(out,{recursive:true});
const url=process.env.QA_URL||'http://127.0.0.1:4186/?qa';
const driver=fs.readFileSync(path.join(__dirname,'palace-driver.mjs'),'utf8');
const source=driver.replace(/^import[^\n]+\n/gm,'').replaceAll('export function','function').replaceAll('export const','const');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];let page;
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 // This is the sole setup: persisted completion of the previous two 3D levels.
 // A fresh context leaves god mode disabled and the third world is untouched.
 await context.addInitScript(()=>localStorage.setItem('mosslight-3d-progress',JSON.stringify({version:1,completed:[true,true,false]})));
 page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.text().startsWith('PALACE_ROUTE '))console.log(m.text());else if(m.type()==='error')errors.push(m.text())});
 await page.goto(url);await page.waitForFunction(()=>window.__qa&&document.querySelector('#loading').classList.contains('hidden'));
 await page.evaluate(async source=>{const physics=await import('./physics.js');window.__palacePilot=new Function(...Object.keys(physics),source+';return palaceDriver;')(...Object.values(physics))},source);
 await page.click('[data-level="2"]');await page.click('#start');
 const initial=await page.evaluate(()=>gameInfo());assert.equal(initial.level,2);assert.equal(initial.godMode,false);assert.equal(initial.deaths,0);assert.equal(initial.checkpointCount,1);assert.equal(initial.checkpoint,0);assert.ok(initial.player.z>0);
 await page.screenshot({path:path.join(out,'normal-route-start.png')});
 console.log('PALACE_ROUTE launched actual DOM keyboard events; no world writes; 1440x900; one start checkpoint; normal mode.');
 const result=await page.evaluate(()=>new Promise(resolve=>{
  const drive=__palacePilot(),held=new Set(),started=performance.now(),landed=new Set(),trapKinds=new Set();let lastTime=-1,lastLog=-1,furthest=0,frames=0,everGod=false,checkpointViolation=false,lastPosition={...__qa.world().player},maxFrameMovement=0;
  function set(code,on){if(on&&!held.has(code)){window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.add(code)}else if(!on&&held.has(code)){window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.delete(code)}}
  function finish(reason){for(const code of [...held])set(code,false);resolve({reason,wallSeconds:(performance.now()-started)/1000,snapshot:gameInfo(),everGod,checkpointViolation,furthest,maxFrameMovement,frames,landed:[...landed],trapKinds:[...trapKinds],controls:'DOM keydown/keyup A,D,W,S,Space; no simulation stepping or state writes'})}
  function frame(){const w=__qa.world(),p=w.player;frames++;everGod ||= !!w.godMode||!!w.usedGodMode;checkpointViolation ||= w.def.checkpoints.length!==0||w.checkpoint!==0;furthest=Math.max(furthest,w.farthest);maxFrameMovement=Math.max(maxFrameMovement,Math.hypot(p.x-lastPosition.x,p.y-lastPosition.y,p.z-lastPosition.z));lastPosition={...p};
   if(p.grounded&&p.on!==null){landed.add(p.on);trapKinds.add(w.platforms[p.on].kind)}
   const log=Math.floor(w.time/30);if(log!==lastLog){lastLog=log;console.log('PALACE_ROUTE '+JSON.stringify({time:+w.time.toFixed(1),platform:p.on,furthest:w.farthest,x:+p.x.toFixed(2),y:+p.y.toFixed(2),z:+p.z.toFixed(2),deaths:w.deaths,god:w.godMode,checkpoint:w.checkpoint}))}
   if(w.complete)return finish('complete');if(w.deaths>0)return finish('death');if(everGod||checkpointViolation)return finish('invariant');if(performance.now()-started>900000)return finish('timeout');if(gameInfo().mode!=='playing')return finish('not-playing');
   if(lastTime!==w.time){lastTime=w.time;const input=drive(w),yaw=gameInfo().camera.yaw,c=Math.cos(yaw),s=Math.sin(yaw),x=input.x*c-input.z*s,z=input.z*c+input.x*s;set('KeyA',x<-.1);set('KeyD',x>.1);set('KeyW',z<-.1);set('KeyS',z>.1);set('Space',input.jump)}requestAnimationFrame(frame);
  }requestAnimationFrame(frame);
 }));
 result.errors=errors;result.timestamp=new Date().toISOString();fs.writeFileSync(path.join(out,'normal-route-results.json'),JSON.stringify(result,null,2));await page.screenshot({path:path.join(out,'normal-route-'+result.reason+'.png')});
 assert.equal(result.reason,'complete',JSON.stringify(result));assert.equal(result.snapshot.complete,true);assert.equal(result.snapshot.mode,'complete');assert.equal(result.snapshot.deaths,0);assert.equal(result.everGod,false);assert.equal(result.checkpointViolation,false);assert.equal(result.snapshot.checkpointCount,1);assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mosslight-3d-progress')).completed[2]),true);
 console.log(JSON.stringify({passed:true,time:result.snapshot.time,wallSeconds:result.wallSeconds,deaths:result.snapshot.deaths,godMode:result.snapshot.godMode,checkpoints:result.snapshot.checkpointCount,platforms:result.snapshot.platformCount,visited:result.landed.length,trapKinds:result.trapKinds,errors,artifacts:out}));
}catch(error){if(page&&!page.isClosed())await page.screenshot({path:path.join(out,'normal-route-failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
