const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_URL||'http://127.0.0.1:4186/',merged=process.env.QA_MERGED==='1',out=process.env.QA_OUTPUT||'.deploy/character-music-update/browser';fs.mkdirSync(out,{recursive:true});
const prefix='';
const report={checks:[],errors:[],url:base};
const progress={version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]};
const ok=(v,s)=>{assert.ok(v,s);report.checks.push(s);console.log('PASS '+s)};
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
 await context.addInitScript(({prefix,progress})=>{for(const mode of ['pixel','3d'])localStorage.setItem(prefix+'mosslight-'+mode+'-progress',JSON.stringify(progress))},{prefix,progress});
 const page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 const surface=()=>page;
 const target=mode=>new URL(mode==='2d'?(merged?'./?qa':'2d/?qa'):(merged?'3d/?qa':'./?qa'),base).href;
 await page.goto(target('2d'));let f=surface();await f.waitForFunction(()=>window.pixelInfo?.().loaded);
 if(await f.locator('#account-dialog').count()&&await f.locator('#account-dialog').evaluate(e=>e.open))await f.click('.account-done');
 ok((await f.title()).includes('苔光跃迁')&&(await f.title()).includes('2D'),'2D shares the Mosslight title with a 2D suffix');
 ok(await f.locator('#menu-characters button[data-character="dragon"] strong').textContent()==='GPT（同人形象）'&&await f.locator('#menu-characters button[data-character="logo"] strong').textContent()==='GPT（官方Logo）','Both GPT names use the requested labels');
 for(const [id,skill,damage] of [['dragon','moonwave',2],['claude','shockwave',3]]){
  await f.evaluate(()=>__pixelQA.home());await f.click('#menu-characters button[data-character="'+id+'"]');
  ok(await f.locator('#character-stats').textContent().then(t=>t.includes(id==='dragon'?'2 / 2 / 4':'3 / 3 / 6')),'Menu displays '+id+' distinct combat values');
  await f.click('#start');await f.waitForFunction(()=>pixelInfo().music.active&&pixelInfo().music.notes>5&&pixelInfo().music.rms>.0001);
  ok(await f.evaluate(()=>pixelInfo().music.contextState)==='running','Audible BGM starts with '+id+' gameplay');
  const result=await f.evaluate(()=>{const w=__pixelQA.world();window.__skillEffectSeen=false;const emit=w.emit.bind(w);w.emit=(type,data)=>{if(type==='skill')window.__skillSeen=data;return emit(type,data)};document.querySelector('#game').addEventListener('mousedown',()=>{w.player.chainWindow=.6;w.player.attackStage=1},{once:true,capture:true});let n=0;const watch=()=>{if(pixelInfo().skillEffects>0)window.__skillEffectSeen=true;else if(n++<240)requestAnimationFrame(watch)};requestAnimationFrame(watch);return w.combat.skill});
  await f.locator('#game').click({position:{x:600,y:350}});await f.waitForFunction(()=>window.__skillEffectSeen&&window.__skillSeen);
  ok(result===skill&&await f.evaluate(()=>pixelInfo().combat.damage[0])===damage,id+' actual left click triggers the correct finisher and damage profile');
  await page.screenshot({path:path.join(out,id+'-skill.png')});
  await f.evaluate(()=>__pixelQA.pause());await page.waitForTimeout(350);
  ok(await f.evaluate(()=>!pixelInfo().music.active&&pixelInfo().music.voices===0&&pixelInfo().music.rms<.0001),'Pause stops '+id+' BGM and scheduled notes');
 }
 await f.evaluate(()=>__pixelQA.home());await f.click('#menu-characters button[data-character="dragon"]');await f.click('#start');
 const outcomes=await f.evaluate(()=>{const w=__pixelQA.world(),near=c=>Object.assign(w.player,{x:c.x-55,y:c.y-w.player.h,vx:0,vy:0,grounded:true,on:c.platformId});near(w.chests[0]);w.interact(()=>.05);near(w.chests[1]);w.interact(()=>.049999);const r=w.exportState(),copy=Object.create(Object.getPrototypeOf(w));return {empty:!w.chests[0].reward,reward:w.chests[1].reward,drops:w.powerups.length,save:copy.importState(r),opened:r.state.chests.filter(c=>c.opened).length}});
 ok(outcomes.empty&&outcomes.reward&&outcomes.drops===1&&outcomes.save&&outcomes.opened===2,'Exact 95/5 chest boundary and rolled outcomes survive a save');
 const themes=[];
 for(let level=0;level<4;level++){await f.evaluate(level=>{__pixelQA.home();__pixelQA.begin(level)},level);await f.waitForFunction(level=>pixelInfo().music.active&&pixelInfo().level===level&&pixelInfo().music.theme===['晨露轻吟','霓虹脉冲','云上绯晶','星穹序列'][level],level);themes.push(await f.evaluate(()=>pixelInfo().music.theme));}
 ok(new Set(themes).size===4,'Each 2D chapter selects its own BGM composition');
 await f.click('#sound');await page.waitForTimeout(350);ok(await f.evaluate(()=>!pixelInfo().music.active&&pixelInfo().music.rms<.0001),'Mute silences 2D music');await f.click('#sound');await f.waitForFunction(()=>pixelInfo().music.active&&pixelInfo().music.rms>.0001);ok(true,'Unmute resumes 2D BGM');
 const rendered=await f.evaluate(async()=>{const {BackgroundMusic,MUSIC_THEMES,musicEvents}=await import('../music.js'),results=[];for(let level=0;level<4;level++){const ctx=new OfflineAudioContext(1,44100*8,44100),music=new BackgroundMusic();music.attach(ctx);music.bus.gain.value=.24;const beat=60/MUSIC_THEMES[level].bpm;for(let step=0;step<64;step++)for(const event of musicEvents(level,step))music.play(event,.05+step*beat/4,beat);const buffer=await ctx.startRendering(),data=buffer.getChannelData(0);let square=0,peak=0;for(const v of data){square+=v*v;peak=Math.max(peak,Math.abs(v))}results.push({level,rms:Math.sqrt(square/data.length),peak});}return results;});
 report.audio=rendered;ok(rendered.every(r=>r.rms>.001&&r.rms<.5&&r.peak<.95),'All four scores render audible PCM without clipping');
 await page.goto(target('3d'));f=surface();await f.waitForFunction(()=>window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'));
 ok((await f.title()).includes('苔光跃迁')&&(await f.title()).includes('3D'),'3D uses the matching title with a 3D suffix');
 await f.click('#start');await f.waitForFunction(()=>gameInfo().music.active&&gameInfo().music.contextState==='running'&&gameInfo().music.rms>.0001);
 ok(await f.evaluate(()=>gameInfo().characterName==='白色方块'&&!('hp' in gameInfo().player)&&!document.querySelector('[data-character]')),'3D preserves the fixed block and has no character selector or health system');
 const theme3=[];for(let level=0;level<4;level++){await f.evaluate(()=>__qa.home());await page.waitForTimeout(250);await f.evaluate(level=>__qa.setSelected(level),level);await f.click('#start');await f.waitForFunction(level=>gameInfo().level===level&&gameInfo().music.active&&gameInfo().music.theme===['晨露轻吟','霓虹脉冲','云上绯晶','星穹序列'][level],level);theme3.push(await f.evaluate(()=>gameInfo().music.theme));}
 ok(new Set(theme3).size===4,'All four 3D chapters play their respective scores');
 await f.evaluate(()=>{const w=__qa.world();w.player.y=-20;w.player.grounded=false;w.player.on=null});await f.waitForFunction(()=>gameInfo().deaths===1);
 ok(await f.evaluate(()=>gameInfo().player.on===0&&!('hp' in gameInfo().player)),'3D still immediately returns to the checkpoint after a fall');
 await f.evaluate(()=>__qa.pause());await page.waitForTimeout(350);ok(await f.evaluate(()=>!gameInfo().music.active&&gameInfo().music.voices===0),'3D pause stops the soundtrack');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'3d-mobile.png')});ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'3D mobile layout remains within the viewport');
 await page.goto(target('2d'));f=surface();await f.waitForFunction(()=>window.pixelInfo?.().loaded);await page.screenshot({path:path.join(out,'2d-mobile.png')});ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'2D names and character stat cards fit mobile');
 assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log('Checks:',report.checks.length);
 }catch(e){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({...report,error:String(e.stack)},null,2));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
