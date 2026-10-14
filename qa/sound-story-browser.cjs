// Browser integration coverage. Staged fixtures arrange targets; trusted mouse and
// keyboard events still enter the game's ordinary input handlers.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=process.env.QA_URL||'http://127.0.0.1:4186/';
const merged=process.env.QA_MERGED==='1',privateEdition=process.env.QA_PRIVATE==='1';
const output=process.env.QA_OUTPUT||'.deploy/sound-story-update/browser';
const prefix=privateEdition?'mosslight-immune-only-v251:':'';
const progress={version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]};
const report={url:base,merged,privateEdition,checks:[],errors:[],combat:[],audio:[],story:[],layouts:[]};
fs.mkdirSync(output,{recursive:true});
function ok(value,label){assert.ok(value,label);report.checks.push(label);console.log('PASS '+label)}
function target(mode){
 if(privateEdition){const u=/^[a-z]+:/i.test(base)?new URL(base):pathToFileURL(path.resolve(base));u.search='?qa';u.hash=mode;return u.href}
 return new URL(mode==='2d'?(merged?'./?qa':'2d/?qa'):(merged?'3d/?qa':'./?qa'),base).href;
}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let page,f;
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{}'}));
  await context.addInitScript(({prefix,progress})=>{try{for(const mode of ['pixel','3d'])localStorage.setItem(prefix+'mosslight-'+mode+'-progress',JSON.stringify(progress))}catch{}},{prefix,progress});
  page=await context.newPage();page.setDefaultTimeout(privateEdition?90000:30000);page.on('pageerror',e=>report.errors.push(e.message));
  async function open(mode){
   await page.goto(target(mode));
   if(privateEdition){await page.locator('iframe').waitFor();f=await(await page.locator('iframe').elementHandle()).contentFrame();assert.ok(f,'Private game iframe exists')}
   else f=page;
   await f.waitForFunction(mode=>mode==='2d'?window.pixelInfo?.().loaded:window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'),mode);
   const account=f.locator('#account-dialog');if(await account.count()&&await account.evaluate(e=>e.open))await f.click('.account-done');
   ok(await f.evaluate(mode=>!!(mode==='2d'?window.__pixelQA:window.__qa),mode),mode+' exposes the QA surface');
  }
  const ticks=n=>f.evaluate(n=>new Promise(resolve=>{const next=()=>--n<=0?resolve():requestAnimationFrame(next);requestAnimationFrame(next)}),n);
  const info=mode=>f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
  async function begin2d(character='dragon',god=false){
   await f.evaluate(god=>{__pixelQA.home();__pixelQA.setGodMode(god)},god);
   await f.click('#menu-characters [data-character="'+character+'"]');await f.click('#start');
   await f.waitForFunction(()=>pixelInfo().mode==='playing'&&pixelInfo().combatAudio.active&&pixelInfo().music.active);
  }
  async function stopped(label){
   await f.waitForFunction(()=>{const a=pixelInfo().combatAudio;return !a.active&&!a.chainsaw.active&&a.chainsaw.retiring===0&&a.voices===0&&a.sources===0&&a.rms<.0001});
   ok(true,label+' stops the motor, retiring chains, effect voices and PCM output');
  }
  await open('2d');
  for(const character of ['dragon','claude']){
   await begin2d(character);
   const musicBefore=(await info('2d')).music;
   await f.evaluate(()=>{const w=__pixelQA.world(),emit=w.emit.bind(w);window.__combatAudit={events:[],maxRms:0,maxSources:0,musicAlwaysOn:true,done:false};w.emit=(type,data)=>{if(['swing','hit','skill'].includes(type))__combatAudit.events.push({type,...data});return emit(type,data)};const watch=()=>{const s=pixelInfo();__combatAudit.maxRms=Math.max(__combatAudit.maxRms,s.combatAudio.rms);__combatAudit.maxSources=Math.max(__combatAudit.maxSources,s.combatAudio.sources);__combatAudit.musicAlwaysOn&&=s.music.active;if(!__combatAudit.done)requestAnimationFrame(watch)};requestAnimationFrame(watch)});
   for(const stage of [0,1,2]){
    const before=(await info('2d')).combatAudio.byType;
    await f.evaluate(stage=>{const w=__pixelQA.world();document.querySelector('#game').addEventListener('mousedown',()=>{
     const p=w.player,a=w.platforms[0],enemy=w.enemies.find(e=>e.type==='brute');w.enemies.forEach(e=>e.dead=true);
     Object.assign(p,{x:75,y:a.y-p.h,vx:0,vy:0,grounded:true,on:a.id,face:1,attack:0,attackCooldown:0,attackQueued:false,attackStage:stage===0?0:stage-1,chainWindow:stage===0?0:.6});
     Object.assign(enemy,{home:a,x:p.x+48,y:a.y-enemy.h,hp:99,maxHp:99,vx:0,vy:0,stun:2,dead:false,hitBy:-1});w.hitstop=0;
    },{once:true,capture:true})},stage);
    await f.locator('#game').click({position:{x:600,y:330}});
    await f.waitForFunction(before=>pixelInfo().combatAudio.byType.swing>before.swing&&pixelInfo().combatAudio.byType.hit>before.hit,before);
    const s=await info('2d');
    ok(s.player.attackStage===stage,character+' native left click produces combo stage '+(stage+1));
    if(stage===2)ok(s.combatAudio.byType.skill>before.skill,character+' finisher dispatches its skill sound');
    report.combat.push({character,stage,audio:s.combatAudio});
   }
   await f.waitForFunction(()=>__combatAudit.maxRms>.0001);
   const audit=await f.evaluate(()=>{__combatAudit.done=true;return __combatAudit});
   const current=await info('2d');
   ok(audit.maxSources>0&&audit.maxRms>.0001,character+' native swings and hits reach live Web Audio output');
   ok(audit.musicAlwaysOn&&current.music.active&&current.music.theme===musicBefore.theme,character+' combat effects preserve its chapter BGM');
   report.combat.push({character,audit});
   await page.screenshot({path:path.join(output,character+'-combo.png')});
  }
  const firstHit=character=>report.combat.find(c=>c.character===character&&c.stage===0).audio.lastEvents.findLast(e=>e.type==='hit');
  const gpt=firstHit('dragon'),claude=firstHit('claude');
  ok(claude.bodyGain>gpt.bodyGain&&claude.pitch!==gpt.pitch&&claude.character!==gpt.character,'GPT and Claude emit distinct documented impact timbres');
  await f.evaluate(()=>{__pixelQA.home();__pixelQA.setGodMode(false)});
  const lockedCharacter=(await info('2d')).characterId;await f.locator('#menu-characters [data-character="logo"]').click({force:true});
  ok((await info('2d')).characterId===lockedCharacter&&await f.locator('[data-character="logo"]').first().getAttribute('aria-disabled')==='true','Logo selection is gated by god mode');
  await f.click('#god-menu');await f.click('#menu-characters [data-character="logo"]');await f.click('#start');
  await f.waitForFunction(()=>pixelInfo().godMode&&pixelInfo().characterId==='logo'&&pixelInfo().combatAudio.chainsaw.active&&pixelInfo().combatAudio.rms>.0001);
  ok(true,'God-mode Logo starts an audible idle chainsaw');
  const canvas=await f.locator('#game').boundingBox();
  async function rightDown(){const before=(await info('2d')).combatAudio.byType.logoDash;await page.mouse.move(canvas.x+canvas.width*.7,canvas.y+canvas.height*.4);await page.mouse.down({button:'right'});await f.waitForFunction(before=>pixelInfo().combatAudio.chainsaw.revving&&pixelInfo().combatAudio.byType.logoDash>before,before)}
  await rightDown();const rev=await info('2d');
  ok(rev.combatAudio.chainsaw.frequency>74&&rev.combatAudio.chainsaw.gainTarget>.34&&rev.music.active,'Native right button raises chainsaw speed and gain while BGM plays');
  await page.mouse.up({button:'right'});await f.waitForFunction(()=>!pixelInfo().combatAudio.chainsaw.revving);
  const explosions=(await info('2d')).combatAudio.byType.logoExplosion;
  await f.locator('#game').click({position:{x:600,y:330}});await f.waitForFunction(n=>pixelInfo().combatAudio.byType.logoExplosion>n,explosions);
  ok((await info('2d')).music.active,'Native Logo left click dispatches explosion audio and retains BGM');
  await rightDown();await f.evaluate(()=>__pixelQA.pause());await page.mouse.up({button:'right'});await stopped('Pause');
  await f.evaluate(()=>__pixelQA.resume());await f.waitForFunction(()=>pixelInfo().combatAudio.chainsaw.active);await rightDown();
  await f.evaluate(()=>__pixelQA.home());await page.mouse.up({button:'right'});await stopped('Return to menu');
  await f.click('#start');await f.waitForFunction(()=>pixelInfo().combatAudio.chainsaw.active);await f.click('#sound');await stopped('Mute');
  ok(!(await info('2d')).music.active,'Mute also follows the existing BGM preference');
  await f.click('#sound');await f.waitForFunction(()=>pixelInfo().combatAudio.chainsaw.active&&pixelInfo().music.active);
  ok(true,'Unmute resumes the Logo motor and the chapter BGM');
  report.audio=await f.evaluate(async privateEdition=>{
   const {CombatAudio}=await import(privateEdition?'mosslight/2d/combat-audio.js':'./combat-audio.js');
   const results=[];
   async function render(character){
    const rate=48000,ctx=new OfflineAudioContext(1,rate*2.2,rate),a=new CombatAudio();a.attach(ctx);a.update({mode:'playing',enabled:true,character,hidden:false});
    const timeline=character==='logo'?[
     [.4,()=>{a.update({dashing:true,hidden:false});a.play('logoDash')}],
     [.9,()=>a.play('logoExplosion')],[1.5,()=>a.update({mode:'menu',hidden:false})]
    ]:[
     [.05,()=>a.play('swing',{stage:0,character})],[.11,()=>a.play('hit',{character})],
     [.35,()=>a.play('swing',{stage:1,character})],[.41,()=>a.play('hit',{character})],
     [.65,()=>a.play('swing',{stage:2,character})],[.71,()=>{a.play('hit',{character,heavy:true});a.play('skill',{character,kind:character==='claude'?'shockwave':'moonwave'})}],
     [1.5,()=>a.update({mode:'menu',hidden:false})]
    ];
    const pending=timeline.map(([at,play])=>ctx.suspend(at).then(()=>{play();return ctx.resume()}));
    const rendered=await ctx.startRendering();await Promise.all(pending);const pcm=rendered.getChannelData(0);let square=0,peak=0,delta=0,tail=0;
    for(let i=0;i<pcm.length;i++){const v=pcm[i];square+=v*v;peak=Math.max(peak,Math.abs(v));if(i)delta+=(v-pcm[i-1])**2;if(i>=rate*2)tail+=v*v}
    results.push({character,rms:Math.sqrt(square/pcm.length),peak,roughness:Math.sqrt(delta/pcm.length),tailRms:Math.sqrt(tail/(pcm.length-rate*2)),snapshot:a.snapshot()});
   }
   for(const character of ['dragon','claude','logo'])await render(character);return results;
  },privateEdition);
  ok(report.audio.every(a=>a.rms>.001&&a.rms<.5&&a.peak<.95),'Normal combos and Logo motor/explosion render audible real PCM without clipping');
  ok(report.audio.every(a=>a.tailRms<.0001),'All rendered sound tails become silent after stop');
  const renderedHit=character=>report.audio.find(a=>a.character===character).snapshot.lastEvents.find(e=>e.type==='hit');
  ok(renderedHit('claude').pitch<renderedHit('dragon').pitch&&renderedHit('claude').crackGain<renderedHit('dragon').crackGain,'Deterministic first-hit PCM uses Claude lower pitch and softer crack');
  ok(Math.abs(report.audio[0].roughness-report.audio[1].roughness)>.00001,'GPT and Claude combo PCM has measurably different timbre');

  // Story integration coverage is below; it uses snapshots and in-game events.
  await runStory('2d');
  await open('3d');
  ok(await f.evaluate(()=>gameInfo().characterName==='白色方块'&&!('hp' in gameInfo().player)&&!('maxHp' in gameInfo().player)&&!document.querySelector('[data-character],#health')),'3D retains the white block with no character selector or health system');
  const physics=await f.evaluate(async privateEdition=>{
   const {GameWorld,SPEED,JUMP,GRAVITY,RADIUS,HEIGHT}=await import(privateEdition?'mosslight/physics.js':'./physics.js');
   const w=new GameWorld();w.step(1/120,{jump:true});const velocity=w.player.vy;
   for(let i=0;i<360;i++)w.step(1/120,{jump:true});const jumps=w.drain().filter(e=>e.type==='jump').length,landed=w.player.grounded&&w.player.y===0;
   w.player.y=-20;w.step(1/120);return {constants:{SPEED,JUMP,GRAVITY,RADIUS,HEIGHT},velocity,jumps,landed,recovered:w.deaths===1&&w.player.on===0&&!('hp' in w.player)};
  },privateEdition);
  assert.deepEqual(physics.constants,{SPEED:7.6,JUMP:10.5,GRAVITY:25,RADIUS:.32,HEIGHT:1.55});
  ok(physics.velocity>10&&physics.jumps===1&&physics.landed&&physics.recovered,'3D keeps ordinary jump, held-key, gravity, landing and immediate checkpoint recovery behavior');
  await runStory('3d');
  assert.deepEqual(report.errors,[]);ok(true,'Both dimensions complete without browser runtime errors');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));
  console.log(JSON.stringify({passed:true,checks:report.checks.length,output}));

  async function runStory(mode){
   async function home(){await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).home(),mode);await ticks(3)}
   async function archive(label){
    const before=(await info(mode)).mode;await f.locator('#story-open').scrollIntoViewIfNeeded();await f.click('#story-open');
    await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).story.archiveOpen,mode);
    ok(await f.locator('#story-archive [role="tab"]').count()===4,label+' archive exposes all four chapters');
    for(let chapter=0;chapter<4;chapter++){
     const tab=f.locator('#story-archive [data-story-chapter="'+chapter+'"]');await tab.scrollIntoViewIfNeeded();await tab.click();
     ok(await tab.getAttribute('aria-selected')==='true'&&(await f.locator('[data-story-content]').textContent()).length>80,label+' archive chapter '+(chapter+1)+' is readable and selectable');
    }
    await page.screenshot({path:path.join(output,mode+'-'+label+'-archive.png')});
    await page.keyboard.press('Escape');await f.waitForFunction(mode=>!(mode==='2d'?pixelInfo():gameInfo()).story.archiveOpen,mode);
    ok((await info(mode)).mode===before,label+' archive Escape closes without changing game mode');
   }
   async function position(ratio,preboss=false){
    await f.evaluate(({mode,ratio,preboss})=>{const w=(mode==='2d'?__pixelQA:__qa).world();
     if(mode==='2d'){
      const boss=w.enemies.find(e=>e.type==='boss'),x=preboss?boss.home.x-80:w.level.length*ratio,a=preboss?boss.home:w.platforms.find(a=>a.kind==='ground'&&x>=a.x&&x<=a.x+a.w)||w.platforms[0];
      Object.assign(w.player,{x,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:a.id,invuln:999});if(preboss){boss.dead=false;boss.hp=boss.maxHp;boss.stun=999}
     }else w.farthest=Math.ceil((w.platforms.length-1)*ratio);
    },{mode,ratio,preboss});
   }
   await home();await archive(mode+'-desktop');
   for(let chapter=0;chapter<4;chapter++){
    await home();await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).setGodMode(false),mode);
    if(mode==='2d')await f.click('#menu-characters [data-character="'+(chapter===1?'claude':'dragon')+'"]');
    await f.click('[data-level="'+chapter+'"]');await f.click('#start');
    await f.waitForFunction(({mode,chapter})=>{const s=mode==='2d'?pixelInfo():gameInfo();return s.mode==='playing'&&s.level===chapter&&s.story.stage==='intro'&&s.story.visible&&s.story.counts.intro===1},{mode,chapter});
    let state=await info(mode);
    ok(state.story.level===chapter&&state.story.text.length>10,mode+' chapter '+(chapter+1)+' begins its intro through the start button');
    if(chapter===0){
     if(mode==='3d')await f.waitForFunction(()=>gameInfo().camera.locked);
     await f.evaluate(mode=>{const qa=mode==='2d'?__pixelQA:__qa,w=qa.world();window.__storyInputAudit={jumpSeen:false,lockMaintained:true,modeMaintained:true,done:false};
      addEventListener('keydown',e=>{if(e.code!=='Space')return;const a=w.platforms[0];if(mode==='2d'){Object.assign(w.player,{x:75,y:a.y-w.player.h,vx:0,vy:0,grounded:true,on:0,coyote:.1,jumps:2});w.previous.jump=false}else{Object.assign(w.player,{x:0,y:a.y,z:1.3,vx:0,vy:0,vz:0,grounded:true,on:0,coyote:.14,buffer:0});w.jumpHeld=false}},{capture:true,once:true});
      const watch=()=>{const s=mode==='2d'?pixelInfo():gameInfo();__storyInputAudit.jumpSeen||=mode==='2d'?s.player.vy<0:s.player.vy>0;__storyInputAudit.modeMaintained&&=s.mode==='playing';if(mode==='3d')__storyInputAudit.lockMaintained&&=s.camera.locked;if(!__storyInputAudit.done)requestAnimationFrame(watch)};requestAnimationFrame(watch);
     },mode);
     await page.keyboard.down('Space');await f.waitForFunction(()=>__storyInputAudit.jumpSeen);await page.keyboard.up('Space');
     ok((await info(mode)).mode==='playing',mode+' intro caption allows a native Space jump');
     await f.waitForFunction(mode=>{const s=(mode==='2d'?pixelInfo():gameInfo()).story;return s.stage==='intro'&&s.line>0},mode,{timeout:15000});
     const audit=await f.evaluate(()=>{__storyInputAudit.done=true;return __storyInputAudit});report.story.push({mode,chapter,input:audit});
     ok(audit.modeMaintained&&(mode!=='3d'||audit.lockMaintained),mode+' caption advances naturally while play'+(mode==='3d'?' and pointer lock remain intact':' continues'));
    }
    if(mode==='2d'&&chapter===1){await f.click('[data-story-next]');ok((await info(mode)).story.speaker==='Claude','Claude receives its own in-game dialogue voice');}
    await position(.55);await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).story.counts.midpoint===1,mode);
    ok(true,mode+' chapter '+(chapter+1)+' crosses its midpoint story gate');
    if(mode==='2d'){await position(.95,true);await f.waitForFunction(()=>pixelInfo().story.counts.preboss===1);ok(true,'2d chapter '+(chapter+1)+' enters its preboss dialogue')}
    const counts=(await info(mode)).story.counts;await ticks(12);assert.deepEqual((await info(mode)).story.counts,counts);
    ok(true,mode+' chapter '+(chapter+1)+' repeated progress frames do not replay gates');
    if(mode==='3d')ok(!(await info(mode)).story.gates.includes('preboss'),'3D story has no boss or combat gate');
    if(chapter===0){
     await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).pause(),mode);await f.click('#cloud-save');
     const saved=await f.evaluate(({mode,prefix})=>JSON.parse(localStorage.getItem(prefix+'mosslight-run-'+mode)),{mode,prefix});
     ok(saved?.story?.gates.includes('midpoint')&&(mode!=='2d'||saved.story.gates.includes('preboss')),mode+' save stores the story gates with the live run');
     await home();await f.click('#cloud-load');await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
     state=await info(mode);ok(!state.story.visible&&state.story.gates.includes('midpoint')&&(mode!=='2d'||state.story.gates.includes('preboss')),mode+' load suppresses earlier intro and consumed progress scenes');
     await open(mode);if((await info(mode)).mode!=='paused')await f.click('#cloud-load');await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='paused',mode);
     ok(!(await info(mode)).story.visible,mode+' full document reload retains story suppression');
     await f.click(mode==='2d'?'#resume':'#modal-primary');await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='playing',mode);
     await ticks(12);state=await info(mode);
     ok(!state.story.visible&&!state.story.counts.intro&&!state.story.counts.midpoint&&!state.story.counts.preboss,mode+' resumed progress does not restart earlier dialogue');
    }
    await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).world().emit('complete'),mode);
    await f.waitForFunction(mode=>{const s=mode==='2d'?pixelInfo():gameInfo();return s.mode==='complete'&&s.story.stage==='end'&&s.story.counts.end===1},mode);
    state=await info(mode);const resultCopy=await f.locator(mode==='2d'?'#modal-copy':'#modal-text').textContent();
    ok(state.story.gates.includes('end')&&!state.story.visible&&resultCopy.includes(state.story.text),mode+' chapter '+(chapter+1)+' completion event puts its ending in the result panel');
    report.story.push({mode,chapter,ending:state.story});
   }
   await home();await page.setViewportSize({width:390,height:844});await ticks(3);
   ok(await f.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mode+' mobile menu fits 390×844');
   await f.locator('#story-open').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,mode+'-mobile-menu.png')});
   await archive(mode+'-mobile');
   await f.click('#story-open');
   const layout=await f.evaluate(()=>{const panel=document.querySelector('.story-archive'),r=panel.getBoundingClientRect(),buttons=[...panel.querySelectorAll('[data-story-chapter],[data-story-close]')];return {viewport:{width:innerWidth,height:innerHeight},panel:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},overflow:document.documentElement.scrollWidth>innerWidth,usable:buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=20&&r.height>=20&&r.left>=0&&r.right<=innerWidth})}});
   report.layouts.push({mode,...layout});
   ok(!layout.overflow&&layout.panel.left>=0&&layout.panel.right<=layout.viewport.width&&layout.panel.top>=0&&layout.panel.bottom<=layout.viewport.height&&layout.usable,mode+' mobile archive fits and keeps its chapter and close controls usable');
   await f.click('[data-story-close]');await f.click('#start');await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).story.visible,mode);
   const captionLayout=await f.evaluate(mode=>{const c=document.querySelector('#story-caption'),a=c.getBoundingClientRect(),j=document.querySelector(mode==='2d'?'[data-key="jump"]':'#jump').getBoundingClientRect();return {inside:a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<=innerHeight,blocksJump:j.width>0&&j.height>0&&a.left<j.right&&a.right>j.left&&a.top<j.bottom&&a.bottom>j.top,pointerEvents:getComputedStyle(c).pointerEvents}},mode);
   ok(captionLayout.inside&&!captionLayout.blocksJump&&captionLayout.pointerEvents==='none',mode+' mobile caption stays clear of jump controls and passes through game input');
   await home();await page.setViewportSize({width:1440,height:900});
  }
 }catch(error){
  report.error=String(error.stack);report.snapshot=f?await f.evaluate(()=>({pixel:window.pixelInfo?.(),game:window.gameInfo?.()})).catch(()=>null):null;
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(report,null,2));throw error;
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
