const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_URL||'http://127.0.0.1:4186/2d/?qa',out=process.env.QA_OUTPUT||'.deploy/hit-feel-update/browser';fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],cases:[],url:base};const ok=(v,label)=>{assert.ok(v,label);report.checks.push(label);console.log('PASS '+label)};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 const surface=()=>page;
 await page.goto(base);const f=surface();await f.waitForFunction(()=>window.pixelInfo?.().loaded);
 if(await f.locator('#account-dialog').count()&&await f.locator('#account-dialog').evaluate(e=>e.open))await f.click('.account-done');
 for(const config of [{id:'dragon',stage:0,hp:99,label:'light'},{id:'dragon',stage:2,hp:99,label:'finisher'},{id:'claude',stage:2,hp:1,label:'kill'}]){
  await f.evaluate(()=>__pixelQA.home());await f.click('#menu-characters button[data-character="'+config.id+'"]');await f.click('#start');await f.waitForFunction(()=>pixelInfo().music.active);
  await f.evaluate(config=>{const w=__pixelQA.world();window.__impactAudit={events:[],samples:[]};const emit=w.emit.bind(w);w.emit=(type,data)=>{if(type==='hit')window.__impactAudit.events.push({...data});return emit(type,data)};
   document.querySelector('#game').addEventListener('mousedown',()=>{
    const p=w.player,a=w.platforms[0],e=w.enemies.find(e=>e.type==='brute');w.enemies.forEach(e=>e.dead=true);
    Object.assign(e,{home:a,x:p.x+48,y:a.y-e.h,hp:config.hp,maxHp:99,vx:0,vy:0,stun:2,dead:false,hitBy:-1});
    Object.assign(p,{face:1,attack:0,attackCooldown:0,attackStage:config.stage===2?1:0,chainWindow:config.stage===2?.6:0});w.hitstop=0;
    let n=0;const observe=()=>{const s=pixelInfo();window.__impactAudit.samples.push({time:s.time,camera:s.camera,hitstop:s.hitstop,feedback:s.hitFeedback,music:s.music.active});if(n++<55)requestAnimationFrame(observe)};requestAnimationFrame(observe);
   },{once:true,capture:true});
  },config);
  await f.locator('#game').click({position:{x:600,y:350}});await f.waitForFunction(()=>window.__impactAudit.samples.length>50);
  const audit=await f.evaluate(()=>window.__impactAudit);report.cases.push({config,...audit});const hits=audit.events,samples=audit.samples;
  ok(hits.length>0&&hits.some(e=>config.label==='light'?e.hitstop>=.065&&!e.heavy:config.label==='finisher'?e.heavy&&e.hitstop>=.095:e.kill&&e.hitstop>=.125),config.label+' mouse hit uses its intended hitstop and impact weight');
  ok(samples.some((s,i)=>i>0&&s.hitstop>0&&samples[i-1].hitstop>0&&s.time===samples[i-1].time&&s.camera===samples[i-1].camera),config.label+' freezes the combat world and camera while hits connect');
  ok(samples.every(s=>Math.abs(s.feedback.screenOffset.x)<=3&&Math.abs(s.feedback.screenOffset.y)<=3)&&samples.some(s=>s.feedback.screenOffset.x!==0||s.feedback.screenOffset.y!==0),config.label+' produces visible but bounded light screen shake');
  ok(samples.some(s=>s.feedback.marks>0)&&!samples.at(-1).feedback.active&&samples.at(-1).feedback.marks===0,config.label+' displays local impact sparks and settles cleanly');
  ok(samples.every(s=>s.music),config.label+' hitstop keeps the BGM playing');
  await page.screenshot({path:path.join(out,config.label+'.png')});
 }
 await f.evaluate(()=>__pixelQA.home());await f.click('#start');const before=await f.evaluate(()=>pixelInfo().hitFeedback.impacts);await f.locator('#game').click({position:{x:600,y:350}});await page.waitForTimeout(180);
 ok(await f.evaluate(()=>pixelInfo().hitstop===0&&pixelInfo().hitFeedback.marks===0&&pixelInfo().hitFeedback.impacts)===before,'An empty swing has no hitstop or camera impulse');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'mobile.png')});ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Feedback keeps the mobile canvas inside the viewport');
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log('Checks:',report.checks.length);
 }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({...report,error:String(e.stack)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
