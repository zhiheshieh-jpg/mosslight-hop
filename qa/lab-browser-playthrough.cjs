const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.join(__dirname,'lab-browser');fs.mkdirSync(out,{recursive:true});
const url=process.env.QA_URL||'http://127.0.0.1:4191/2d/?qa';
const source=fs.readFileSync(path.join(__dirname,'sky-driver.mjs'),'utf8').replace(/^import[^\n]+\n/,'').replaceAll('export function','function').replaceAll('export const','const');
const asset=path.join(__dirname,'../dist/2d/assets/lab.png');
assert.ok(fs.existsSync(asset)&&fs.statSync(asset).size>1000,'Wait for the finished laboratory backdrop before launching browser QA.');

(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  // Only legitimate prerequisite records are seeded. Chapter four is unfinished
  // and god mode locked. The actual run begins through ordinary menu buttons.
  await context.addInitScript(()=>{
   localStorage.setItem('mosslight-pixel-progress',JSON.stringify({version:2,byCharacter:{dragon:[true,true,true,false],claude:[true,true,true,false]},legacyCompleted:[false,false,false,false]}));
   localStorage.setItem('mosslight-pixel-god','false');
   localStorage.setItem('mosslight-pixel-character','dragon');
  });
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.text().startsWith('LAB_ROUTE '))console.log(m.text());else if(m.type()==='error')errors.push(m.text())});
  page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`)});
  await page.goto(url);await page.waitForFunction(()=>window.__pixelQA&&pixelInfo().loaded);if(await page.locator('#account-dialog').evaluate(e=>e.open))await page.locator('.account-done').click();
  await page.evaluate(async code=>{const {hazardState}=await import('./world.js');window.__labPilot=new Function('hazardState',code+';return skyDriver;')(hazardState)},source);
  await page.click('[data-level="3"]');await page.click('#start');
  const initial=await page.evaluate(()=>pixelInfo());
  assert.equal(initial.level,3);assert.equal(initial.characterId,'dragon');assert.equal(initial.godMode,false);assert.equal(initial.usedGodMode,false);assert.equal(initial.progress.godUnlocked,false);assert.equal(initial.deaths,0);assert.equal(initial.checkpointCount,5);assert.ok(initial.player.x<100);assert.equal(initial.player.hp,initial.player.maxHp);assert.equal(initial.progress.byCharacter.dragon[3],false);
  await page.screenshot({path:path.join(out,'normal-route-start.png')});
  console.log('LAB_ROUTE launched real DOM keydown/keyup; read-only structured snapshots; fresh normal lab entrance; 1440x900.');
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const drive=__labPilot(),held=new Set,started=performance.now(),patterns=new Set,sections=new Set,bridges=new Set,checkpoints=new Set([0]),hurts=[],stages=[];
   let lastTime=-1,lastHp=6,lastLog=-1,furthest=0,frames=0,everGod=false,invariantViolation=false,previousX=75,maxMovement=0,minHp=6;
   // The pilot receives copies only; it has no reference to live player/enemy state.
   const observe=()=>structuredClone(__pixelQA.world());
   function set(code,on){
    if(on&&!held.has(code)){window.dispatchEvent(new KeyboardEvent('keydown',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.add(code)}
    else if(!on&&held.has(code)){window.dispatchEvent(new KeyboardEvent('keyup',{code,key:code==='Space'?' ':code.slice(-1).toLowerCase(),bubbles:true}));held.delete(code)}
   }
   function finish(reason){
    for(const code of [...held])set(code,false);const w=observe();
    resolve({reason,initialPosition:75,wallSeconds:(performance.now()-started)/1000,snapshot:pixelInfo(),realTime:w.realTime,everGod,invariantViolation,furthest,maxMovement,minHp,frames,patterns:[...patterns],sections:[...sections].sort((a,b)=>a-b),bridges:[...bridges],checkpoints:[...checkpoints],hurts,stages,controls:'DOM keydown/keyup A,D,Space,J,K,E; pilot receives structuredClone snapshots; no simulation stepping, teleportation, god mode, stat changes or QA mutators'});
   }
   function frame(){
    const w=observe();frames++;everGod ||= w.godMode||w.usedGodMode||w.usedLogo;
    invariantViolation ||= w.characterId!=='dragon'||w.level.index!==3||w.level.checkpoints.length!==5||w.player.maxHp!==6||w.enemies.at(-1).maxHp!==132;
    furthest=Math.max(furthest,w.player.x);maxMovement=Math.max(maxMovement,Math.abs(w.player.x-previousX));previousX=w.player.x;minHp=Math.min(minHp,w.player.hp);
    const boss=w.enemies.find(e=>e.type==='boss');if(boss.pattern)patterns.add(boss.pattern);
    if(w.player.hp<lastHp)hurts.push({x:Math.round(w.player.x),hp:w.player.hp,t:+w.time.toFixed(2)});lastHp=w.player.hp;
    const section=w.level.ground.find(a=>w.player.x>=a.x&&w.player.x<a.x+a.w)?.section;if(section!==undefined)sections.add(section);
    const on=w.platforms.find(a=>a.id===w.player.on);if(on?.kind==='crumble')bridges.add(on.id);checkpoints.add(w.checkpoint);
    if([0,12,24,36,47].includes(section)&&!stages.some(s=>s.section===section))stages.push({section,time:+w.realTime.toFixed(2)});
    const log=Math.floor((performance.now()-started)/15000);
    if(log!==lastLog){lastLog=log;console.log('LAB_ROUTE '+JSON.stringify({wallSeconds:Math.round((performance.now()-started)/1000),time:+w.realTime.toFixed(1),section,x:Math.round(w.player.x),hp:w.player.hp,kills:w.kills,deaths:w.deaths,bossHp:boss.hp,god:w.godMode}))}
    if(w.complete)return finish('complete');if(w.deaths>0)return finish('death');if(everGod||invariantViolation)return finish('invariant');if(performance.now()-started>720000)return finish('timeout');
    if(lastTime!==w.realTime){lastTime=w.realTime;const input=drive(w);set('KeyA',input.x<0);set('KeyD',input.x>0);set('Space',input.jump);set('KeyJ',input.attack);set('KeyK',input.dash);set('KeyE',input.interact)}
    requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  }));
  result.errors=errors;result.timestamp=new Date().toISOString();
  result.persistedProgress=await page.evaluate(async()=>{const {cloudStorage,saveNow}=await import('./account.js');await saveNow();return JSON.parse(cloudStorage.getItem('mosslight-pixel-progress'))});
  fs.writeFileSync(path.join(out,'normal-route-results.json'),JSON.stringify(result,null,2));
  await page.screenshot({path:path.join(out,'normal-route-'+result.reason+'.png')});
  assert.equal(result.reason,'complete',JSON.stringify(result));assert.equal(result.snapshot.complete,true);assert.equal(result.snapshot.mode,'complete');assert.equal(result.snapshot.deaths,0);assert.equal(result.everGod,false);assert.equal(result.invariantViolation,false);assert.equal(result.snapshot.boss.hp,0);assert.equal(result.snapshot.player.grounded,true);
  assert.equal(result.sections.length,48);assert.equal(result.bridges.length,5);assert.equal(result.checkpoints.length,5);assert.equal(result.patterns.length,4);assert.equal(result.snapshot.runMixed,false);assert.equal(result.persistedProgress.byCharacter.dragon[3],true);assert.equal(result.persistedProgress.byCharacter.claude[3],false);assert.equal(result.snapshot.progress.godUnlocked,true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,time:result.snapshot.time,realTime:result.realTime,wallSeconds:result.wallSeconds,deaths:result.snapshot.deaths,godMode:result.snapshot.godMode,kills:result.snapshot.kills,enemies:result.snapshot.enemies,sections:result.sections.length,bridges:result.bridges.length,checkpoints:result.checkpoints.length,bossHp:result.snapshot.boss.hp,patterns:result.patterns,minHp:result.minHp,recordCredited:true,godUnlocked:result.snapshot.progress.godUnlocked,errors,artifacts:out}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
