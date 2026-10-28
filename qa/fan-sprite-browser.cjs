// Real atlas bytes, renderer crops and trusted controls for the GPT fan-art update.
// Each run uses a fresh browser context and an offline API fixture; it cannot write
// to an existing player's account or browser profile.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const merged=process.env.QA_MERGED==='1',privateEdition=process.env.QA_PRIVATE==='1';
const base=process.env.QA_URL||(merged?'http://127.0.0.1:4187/':'http://127.0.0.1:4186/');
const output=path.resolve(process.env.QA_OUTPUT||'.deploy/fan-sprite-update/'+(privateEdition?'private':merged?'merged':'raw'));
const prefix=privateEdition?'mosslight-immune-only-v251:':'';
const progress={version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]},legacyCompleted:[false,false,false,false]};
const oldDragon='4d7e619558f5448b13a5e0c2fff718b1a9fe7c78fbc8da24f0bb4ec9e3074ed9';
const baseline={claude:'918fc1f2bc14de5c097b5affccc149b2bad5bb5ae3b76eaae0dc5ceeef0a34d6',logo:'5771aa99832ea03f9ccda2d7ececf58464cb40217fc12a1321e7ccd170d73ae0'};
const report={url:base,merged,privateEdition,checks:[],errors:[],apiFixtureRequests:0,frames:[],screenshots:[]};
fs.mkdirSync(output,{recursive:true});
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const ok=(value,label)=>{assert.ok(value,label);report.checks.push(label);console.log('PASS '+label)};
function target(){if(privateEdition){const u=/^[a-z]+:/i.test(base)?new URL(base):pathToFileURL(path.resolve(base));u.search='?qa';u.hash='2d';return u.href}return new URL(merged?'./?qa':'2d/?qa',base).href}

(async()=>{
 const browser=await chromium.launch({channel:process.env.QA_BROWSER||'msedge',headless:true});let page,f;
 try{
  async function context(options={}){
   const c=await browser.newContext({viewport:{width:1440,height:900},...options});
   await c.route('**/api/**',route=>{report.apiFixtureRequests++;return route.fulfill({status:503,contentType:'application/json',body:'{}'})});
   await c.addInitScript(({prefix,progress})=>{
    try{localStorage.setItem(prefix+'mosslight-pixel-progress',JSON.stringify(progress));localStorage.setItem(prefix+'mosslight-pixel-character','dragon');localStorage.setItem(prefix+'mosslight-pixel-god','false')}catch{}
    // Observe native Image instances at prepareCharacter(), including embedded
    // data URLs in the private standalone iframe. No image or draw is mocked.
    const original=CanvasRenderingContext2D.prototype.drawImage;
    window.__fanSpriteAudit={atlases:[],images:[],portraitCalls:[],capture:false,calls:[],seen:[],events:[]};
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
     const result=original.call(this,image,...args),audit=window.__fanSpriteAudit;
     if(image instanceof HTMLImageElement){
      if(!audit.images.includes(image))audit.images.push(image);
      if(this.canvas.dataset.characterPortrait==='logo')audit.logoImage=image;
      if(this.canvas.dataset.characterPortrait&&args.length===8)audit.portraitCalls.push({name:this.canvas.dataset.characterPortrait,image,args});
      if(args.length===2&&args[0]===0&&args[1]===0&&this.canvas.width===image.naturalWidth&&this.canvas.height===image.naturalHeight&&image.naturalWidth%4===0&&image.naturalHeight%2===0&&!audit.atlases.includes(image))audit.atlases.push(image);
      if(audit.capture&&this.canvas.id==='game'&&image===audit.atlases[0]&&args.length===8){
       const s=window.pixelInfo?.(),m=this.getTransform(),frame=Math.round(args[1]/(image.naturalHeight/2))*4+Math.floor(args[0]/(image.naturalWidth/4));
       if(!audit.seen.includes(frame))audit.seen.push(frame);
       audit.calls.push({frame,args,m:{a:m.a,d:m.d,e:m.e,f:m.f},state:s&&{mode:s.mode,player:s.player,camera:s.camera,view:s.view,screenOffset:s.hitFeedback.screenOffset}});
       if(audit.calls.length>600)audit.calls.shift();
      }
     }
     return result;
    };
   },{prefix,progress});
   return c;
  }
  async function open(c){
   page=await c.newPage();page.setDefaultTimeout(privateEdition?90000:30000);page.on('pageerror',e=>report.errors.push(e.message));
   await page.goto(target());
   if(privateEdition){await page.locator('iframe').waitFor();f=await(await page.locator('iframe').elementHandle()).contentFrame();assert.ok(f,'Private iframe exists')}else f=page;
   await f.waitForFunction(()=>window.pixelInfo?.().loaded&&window.__fanSpriteAudit?.atlases.length===2);
   const account=f.locator('#account-dialog');if(await account.count()&&await account.evaluate(e=>e.open))await f.click('.account-done');
   await f.evaluate(async privateEdition=>{const {measureAtlas}=await import(privateEdition?'mosslight/2d/sprite-atlas.js':'./sprite-atlas.js');window.__fanMeasured={};for(const [index,id] of ['dragon','claude'].entries()){const img=__fanSpriteAudit.atlases[index],cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;const c=cv.getContext('2d');c.drawImage(img,0,0);__fanMeasured[id]=measureAtlas(c.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height,{edgeInset:Math.round(cv.width/128)})}},privateEdition);
  }
  const ticks=n=>f.evaluate(n=>new Promise(resolve=>{const tick=()=>--n<=0?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick)}),n);
  const info=()=>f.evaluate(()=>pixelInfo());
  async function shot(name){const filename=name+'.png';await page.screenshot({path:path.join(output,filename)});report.screenshots.push(filename)}
  async function assetBytes(which){return Buffer.from(await f.evaluate(async which=>{
   const audit=__fanSpriteAudit,img=which==='dragon'?audit.atlases[0]:which==='claude'?audit.atlases[1]:audit.logoImage;
   if(!img)throw new Error('Real '+which+' image was not observed');return Array.from(new Uint8Array(await(await fetch(img.currentSrc||img.src)).arrayBuffer()));
  },which))}
  async function portraits(id){return f.evaluate(id=>{
   const a=__fanSpriteAudit,img=a.atlases[id==='dragon'?0:1],frames=window.__fanMeasured[id],b=frames[0].bounds;
   return [...document.querySelectorAll('[data-character-portrait]')].filter(cv=>cv.dataset.characterPortrait===id||cv.dataset.characterPortrait==='selected'&&pixelInfo().characterId===id).map(cv=>{
    const w=b.maxX-b.minX+1,h=b.maxY-b.minY+1,scale=Math.min((cv.width-10)/w,(cv.height-8)/h),frame=frames[0];
    const actual=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
    let n=0,minX=cv.width,minY=cv.height,maxX=-1,maxY=-1;
    for(let i=3;i<actual.length;i+=4)if(actual[i]>32){const x=(i-3)/4%cv.width,y=Math.floor((i-3)/4/cv.width);n++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
    const observed=a.portraitCalls.filter(p=>p.name===cv.dataset.characterPortrait&&p.image===img).at(-1);
    const expected=[frame.sx+b.minX,frame.sy+b.minY,w,h,Math.round((cv.width-w*scale)/2),Math.round(cv.height-h*scale-4),Math.round(w*scale),Math.round(h*scale)];
    return {name:cv.dataset.characterPortrait,cropMatches:JSON.stringify(observed?.args)===JSON.stringify(expected),n,minX,minY,maxX,maxY,width:cv.width,height:cv.height,observed:observed?.args,expected};
   });
  },id)}
  async function begin(id='dragon'){
   await f.evaluate(()=>{__pixelQA.home();__pixelQA.setGodMode(false)});await f.click('#menu-characters [data-character="'+id+'"]');await f.click('#start');
   await f.waitForFunction(()=>pixelInfo().mode==='playing');
   await f.evaluate(()=>{const w=__pixelQA.world();w.enemies.forEach(e=>e.dead=true);const emit=w.emit.bind(w);w.emit=(type,data={})=>{__fanSpriteAudit.events.push({type,...data});return emit(type,data)};__fanSpriteAudit.capture=true});
  }
  await open(await context());
  const initial=await info();
  ok(initial.characterId==='dragon'&&initial.characterFrames.dragon===8&&initial.characterFrames.claude===8&&initial.characterFrames.logo===0,'Stable dragon save ID loads eight fan-art frames alongside unchanged character IDs');
  const hashes={};for(const id of ['dragon','claude','logo'])hashes[id]=sha(await assetBytes(id));report.hashes=hashes;
  ok(hashes.dragon!==oldDragon&&hashes.dragon===sha(fs.readFileSync(path.join(__dirname,'../dist/2d/assets/dragon.png'))),'Browser decodes the replacement dragon PNG bytes from this release');
  ok(hashes.claude===baseline.claude&&hashes.logo===baseline.logo,'Claude PNG and official logo SVG remain byte-for-byte unchanged');
  const modules=await f.evaluate(async privateEdition=>{const root=privateEdition?'mosslight/2d/':'./';const {CHARACTERS}=await import(root+'characters.js'),{COMBAT_PROFILES}=await import(root+'combat.js');return {characters:CHARACTERS,combat:COMBAT_PROFILES}},privateEdition);
  assert.deepEqual(modules.characters.find(c=>c.id==='claude'),{id:'claude',name:'Claude',english:'CLAUDE',asset:'assets/claude.png',role:'THE LITTLE SUNBEAM',tag:'赤焰重击 · 力量型',intro:'我是 Claude。小小脚步，也能走到很远。',caption:'轻快脚步，把暖光带进每一段旅程。',drawHeight:46,accent:'#efa28b',slash:'#f59e85',heavy:'#ffe1bd',trail:'#e98d76',impact:['#fff0d8','#f7b298','#e58771','#f6d08f']});
  assert.deepEqual(modules.characters.find(c=>c.id==='logo'),{id:'logo',name:'GPT（官方Logo）',english:'UNBOUND',asset:null,role:'THE UNBOUND SIGNAL',tag:'仅无敌模式可用',intro:'光针环绕，边界消失。',caption:'旋转光针 · 无限冲刺 · 全屏爆裂',drawHeight:48,accent:'#b7fff0',slash:'#c4fff8',heavy:'#ffffff',trail:'#65f3df',impact:['#ffffff','#a7ffef','#66e9ff','#b5bcff']});
  for(const [id,damage,cooldown,skill] of [['dragon',[2,2,4],.62,'moonwave'],['claude',[3,3,6],.7,'shockwave']]){const c=modules.combat[id];assert.deepEqual(c.damage,damage);assert.equal(c.dashCooldown,cooldown);assert.equal(c.skill,skill);assert.equal(c.speed,250);assert.equal(c.jump,535);assert.equal(c.airJump,465);assert.equal(c.dashSpeed,750)}
  ok(true,'Claude and logo metadata plus both ordinary combat profiles preserve their existing behavior');
  const metrics=await f.evaluate(async privateEdition=>{
   const {measureAtlas}=await import(privateEdition?'mosslight/2d/sprite-atlas.js':'./sprite-atlas.js');window.__fanMeasured={};const results={};
   for(const [index,id] of ['dragon','claude'].entries()){
    const image=__fanSpriteAudit.atlases[index],cv=document.createElement('canvas');cv.width=image.naturalWidth;cv.height=image.naturalHeight;const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(image,0,0);
    const pixels=c.getImageData(0,0,cv.width,cv.height).data,edgeInset=Math.round(cv.width/128),frames=measureAtlas(pixels,cv.width,cv.height,{edgeInset});__fanMeasured[id]=frames;
    results[id]={width:cv.width,height:cv.height,edgeInset,frames:frames.map((frame,i)=>{
     const cellWidth=cv.width/4,cellHeight=cv.height/2,sx=i%4*cellWidth,sy=Math.floor(i/4)*cellHeight;let any=0,solid=0,discarded=0,outer=0,discardedSolid=0,outerSolid=0,discardedAlphaMax=0,outerAlphaMax=0,hash=2166136261;
     for(let y=0;y<cellHeight;y++)for(let x=0;x<cellWidth;x++){const n=((sy+y)*cv.width+sx+x)*4,a=pixels[n+3];for(let k=0;k<4;k++)hash=Math.imul(hash^pixels[n+k],16777619)>>>0;if(a){any++;if(x<edgeInset||x>=cellWidth-edgeInset){discarded++;discardedAlphaMax=Math.max(discardedAlphaMax,a);if(a>32)discardedSolid++}if(x===0||y===0||x===cellWidth-1||y===cellHeight-1){outer++;outerAlphaMax=Math.max(outerAlphaMax,a);if(a>32)outerSolid++}}if(a>32)solid++}
     // Torso centre relative to the measured feet provides a separate body
     // alignment metric; it is reported for visual review, not pose-shape equality.
     let sum=0,count=0;const b=frame.bounds,low=Math.round(b.minY+(b.maxY-b.minY)*.35),high=Math.round(b.minY+(b.maxY-b.minY)*.7);
     for(let y=low;y<=high;y++)for(let x=Math.round(frame.ax-cellWidth*.17);x<=Math.round(frame.ax+cellWidth*.17);x++)if(x>=0&&x<frame.sw&&pixels[((frame.sy+y)*cv.width+frame.sx+x)*4+3]>32){sum+=x;count++}
     return {...frame,any,solid,discarded,outer,discardedSolid,outerSolid,discardedAlphaMax,outerAlphaMax,hash:hash.toString(16),coverage:any/(cellWidth*cellHeight),bodyOffset:count?sum/count-frame.ax:null};
    })};
   }
   return results;
  },privateEdition);report.atlas=metrics;report.frames=metrics.dragon.frames;
  const atlas=metrics.dragon,cellW=atlas.width/4,cellH=atlas.height/2,frames=atlas.frames;
  ok(atlas.width%4===0&&atlas.height%2===0&&frames.length===8&&frames.every(f=>f.solid>cellW*cellH*.01),'Real PNG contains a populated four-by-two atlas in all eight cells');
  ok(frames.every(f=>f.coverage>.015&&f.coverage<.8),'Every frame has a meaningful transparent background and visible character pixels');
  ok(frames.every(f=>f.discardedSolid===0&&f.outerSolid===0&&f.discardedAlphaMax<=1&&f.outerAlphaMax<=1&&f.bounds.minX>=1&&f.bounds.maxX<f.sw-1&&f.bounds.minY>=1&&f.bounds.maxY<f.sh-1),'Visible alpha pixels clear runtime inset strips and cell edges; any cropped residue is at most 1/255 alpha');
  ok(new Set(frames.map(f=>f.hash)).size===8,'Eight pose cells are distinct rather than duplicated filler');
  const span=key=>Math.max(...frames.map(f=>f[key]))-Math.min(...frames.map(f=>f[key]));
  report.anchor={horizontalSpan:span('ax'),baselineSpan:span('ay'),bodyOffsets:frames.map(f=>f.bodyOffset)};
  // Each source pose may sit at a different raw Y; drawHero compensates with
  // that pose's measured ay. The renderer audit below checks effective feet.
  ok(span('ax')<=cellW*.12&&frames.every(f=>Number.isFinite(f.ay)&&Math.abs(f.ax-f.sw/2)<=cellW*.12),'Measured feet keep a central horizontal body anchor across every pose');
  await f.evaluate(()=>{
   const img=__fanSpriteAudit.atlases[0],frames=__fanMeasured.dragon,cv=document.createElement('canvas');cv.id='fan-atlas-review';cv.width=1120;cv.height=680;cv.style.cssText='position:fixed;inset:0;z-index:99999;width:1120px;height:680px';document.body.append(cv);const c=cv.getContext('2d');c.fillStyle='#101b27';c.fillRect(0,0,cv.width,cv.height);c.imageSmoothingEnabled=false;
   const labels=['0 · IDLE','1 · RUN A','2 · RUN B','3 · AIR','4 · SLASH A / FINISH','5 · SLASH B','6 · DASH','7 · HURT'];
   frames.forEach((f,i)=>{const x=i%4*280,y=Math.floor(i/4)*340,scale=Math.min(240/f.sw,260/f.sh);for(let py=40;py<308;py+=12)for(let px=16;px<264;px+=12){c.fillStyle=(px+py)%24?'#223044':'#2a3b50';c.fillRect(x+px,y+py,12,12)}c.strokeStyle='#77eac1';c.beginPath();c.moveTo(x+140,y+55);c.lineTo(x+140,y+308);c.moveTo(x+16,y+300);c.lineTo(x+264,y+300);c.stroke();c.drawImage(img,f.sx,f.sy,f.sw,f.sh,Math.round(x+140-f.ax*scale),Math.round(y+300-f.ay*scale),Math.ceil(f.sw*scale),Math.ceil(f.sh*scale));c.fillStyle='#f3f2df';c.font='14px sans-serif';c.fillText(labels[i],x+16,y+25);c.font='11px monospace';c.fillText('foot '+f.ax.toFixed(1)+', '+f.ay.toFixed(1),x+16,y+328)});
  });
  await f.locator('#fan-atlas-review').screenshot({path:path.join(output,'atlas-contact-sheet.png')});report.screenshots.push('atlas-contact-sheet.png');await f.evaluate(()=>document.querySelector('#fan-atlas-review').remove());
  const dragonPortraits=await portraits('dragon');report.portraits=dragonPortraits;
  ok(dragonPortraits.length===3&&dragonPortraits.every(p=>p.cropMatches&&p.n>100&&p.minX>=3&&p.minY>=2&&p.maxX<p.width-2&&p.maxY<p.height-2),'Menu, pause and HUD portraits use the exact new idle-frame source crop and have clear padding');
  ok((await f.locator('#character-name').textContent())==='GPT（同人形象）'&&await f.locator('#menu-characters [data-character="dragon"]').getAttribute('aria-pressed')==='true','Menu keeps the requested GPT fan-art label and selected state');await shot('desktop-menu');
  await begin();await ticks(3);
  ok((await f.locator('#hero-name').textContent())==='GPT（同人形象）'&&(await portraits('dragon')).every(p=>p.cropMatches),'Gameplay HUD switches to the same new portrait and fan-art name');
  const startX=(await info()).player.x;await page.keyboard.down('d');await f.waitForFunction(startX=>pixelInfo().player.x>startX+15&&__fanSpriteAudit.seen.includes(1)&&__fanSpriteAudit.seen.includes(2),startX);await page.keyboard.up('d');await ticks(4);
  const rightX=(await info()).player.x;await page.keyboard.down('a');await f.waitForFunction(rightX=>pixelInfo().player.x<rightX-5&&__fanSpriteAudit.calls.some(c=>c.m.a===-1),rightX);await page.keyboard.up('a');
  const leftX=(await info()).player.x;await page.keyboard.press('d',{delay:65});await ticks(3);
  report.movement={startX,rightX,leftX};
  ok(rightX>startX+10&&leftX<rightX,'Native movement displays both running frames, moves the existing body and mirrors it when facing left');
  await f.waitForFunction(()=>pixelInfo().player.attackCooldown<=0);
  for(let stage=0;stage<3;stage++){
   if(privateEdition)await f.evaluate(stage=>document.querySelector('#game').addEventListener('mousedown',()=>{const p=__pixelQA.world().player;Object.assign(p,{attack:0,attackCooldown:0,chainWindow:stage===0?0:.6,attackStage:stage===0?0:stage-1})},{once:true,capture:true}),stage);
   await f.locator('#game').click({position:{x:650,y:340}});await f.waitForFunction(stage=>__fanSpriteAudit.events.filter(e=>e.type==='swing').length===stage+1,stage);
   report.attacks=await f.evaluate(()=>__fanSpriteAudit.events.filter(e=>e.type==='swing'));await ticks(2);if(stage<2)await f.waitForFunction(()=>pixelInfo().player.attackCooldown<=0);
  }
  const attacks=report.attacks;
  ok(JSON.stringify(attacks.map(e=>e.stage))==='[0,1,2]'&&await f.evaluate(()=>__fanSpriteAudit.events.some(e=>e.type==='skill'&&e.kind==='moonwave')&&__fanSpriteAudit.seen.includes(4)&&__fanSpriteAudit.seen.includes(5)),privateEdition?'Private visual stage fixtures route trusted left clicks through both slash poses and the moonwave finisher':'Three native left clicks keep the full combo, two slash poses and moonwave finisher');await shot('desktop-combo');
  await f.waitForFunction(()=>pixelInfo().player.attack<=0);await f.locator('#game').click({position:{x:650,y:340},button:'right'});await f.waitForFunction(()=>__fanSpriteAudit.seen.includes(6)&&__fanSpriteAudit.events.some(e=>e.type==='dash'));
  ok((await info()).player.dashCooldown>0&&(await info()).combat.dashCooldown===.62,'Native right click displays dash frame 6 and preserves its ordinary cooldown');await shot('desktop-dash');
  await f.waitForFunction(()=>pixelInfo().player.dash<=0);await page.keyboard.press('Space',{delay:35});await f.waitForFunction(()=>__fanSpriteAudit.seen.includes(3)&&__fanSpriteAudit.events.some(e=>e.type==='jump'));await ticks(2);
  await page.keyboard.press('Space',{delay:35});await ticks(2);const jumps=await f.evaluate(()=>__fanSpriteAudit.events.filter(e=>e.type==='jump'));await page.keyboard.press('Space',{delay:35});await ticks(2);
  ok(jumps.length===2&&jumps[0].air===false&&jumps[1].air===true&&await f.evaluate(()=>__fanSpriteAudit.events.filter(e=>e.type==='jump').length===2),'Native Space uses airborne frame 3 and retains two jumps with no third jump');await shot('desktop-jump');
  const hurtResult=await f.evaluate(privateEdition=>{const w=__pixelQA.world();w.player.invuln=0;const damaged=w.hurt(1,w.player.x+100);if(privateEdition)w.player.hurt=.15;return damaged},privateEdition);await f.waitForFunction(()=>__fanSpriteAudit.seen.includes(7));
  ok(privateEdition?!hurtResult&&(await info()).player.hp===6:hurtResult&&(await info()).player.hp===5,privateEdition?'Private damage immunity keeps health at six; a visual fixture previews dormant hurt frame 7':'The ordinary damage path displays hurt frame 7 and subtracts one health');
  await f.evaluate(()=>__pixelQA.pause());await ticks(2);const drawn=await f.evaluate(()=>({seen:__fanSpriteAudit.seen,calls:__fanSpriteAudit.calls}));report.draws=drawn;
  const drawHeight=modules.characters.find(c=>c.id==='dragon').drawHeight,scale=drawHeight/(frames[0].bounds.maxY-frames[0].bounds.minY+1);
  for(const call of drawn.calls){const frame=frames[call.frame];assert.ok(frame,'Recognized native atlas frame');assert.deepEqual(call.args.slice(0,4),[frame.sx,frame.sy,frame.sw,frame.sh]);assert.deepEqual(call.args.slice(4),[Math.round(-frame.ax*scale),Math.round(-frame.ay*scale),Math.ceil(frame.sw*scale),Math.ceil(frame.sh*scale)]);if(call.state&&['playing','paused'].includes(call.state.mode)){const s=call.state;assert.equal(call.m.a,s.player.face);assert.equal(call.m.d,1);assert.ok(Math.abs(call.m.e-(Math.round(s.player.x+s.player.w/2-s.camera)+s.screenOffset.x))<=1);assert.ok(Math.abs(call.m.f-(Math.round(s.player.y+s.player.h+1)+s.screenOffset.y-s.view.y))<=1)}}
  ok(new Set(drawn.seen).size===8,'All eight actual renderer crops use the measured source cells and remain attached to the physical body anchor');await shot('desktop-pause');
  await f.evaluate(()=>__pixelQA.home());await f.click('#menu-characters [data-character="claude"]');
  ok((await info()).characterId==='claude'&&(await portraits('claude')).every(p=>p.cropMatches)&&await f.locator('#character-stats').textContent().then(t=>t.includes('3 / 3 / 6')),'Claude keeps its own original atlas, correct portrait crop and strength profile');await shot('claude-menu');
  await f.locator('#menu-characters [data-character="logo"]').click({force:true});assert.equal((await info()).characterId,'claude');await f.click('#god-menu');await f.click('#menu-characters [data-character="logo"]');
  ok((await info()).characterId==='logo'&&(await info()).godMode&&await f.locator('#character-name').textContent()==='GPT（官方Logo）','Official logo selection remains gated by god mode and retains its label');await shot('logo-menu');
  await f.click('#start');await f.locator('#game').click({position:{x:650,y:340},button:'right'});await f.waitForFunction(()=>pixelInfo().player.dash>0);
  const logoDash=await info();await f.locator('#game').click({position:{x:650,y:340}});await f.waitForFunction(()=>pixelInfo().explosions>0);
  ok(logoDash.logoActive&&logoDash.player.dashCooldown===0&&(await info()).usedLogo,'Official logo still uses unlimited right-click dash and native left-click explosion');
  await open(await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true}));await shot('mobile-menu-top');
  const mobileMeta=await f.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(mobileMeta.scroll<=mobileMeta.width);
  for(const selector of ['#menu-characters [data-character="dragon"]','#menu-characters [data-character="claude"]','#menu-characters [data-character="logo"]','#start']){await f.locator(selector).scrollIntoViewIfNeeded();const b=await f.locator(selector).boundingBox();assert.ok(b.x>=-1&&b.x+b.width<=391&&b.y>=-1&&b.y+b.height<=845,selector+' fits '+JSON.stringify(b))}
  ok((await portraits('dragon')).every(p=>p.cropMatches),'390-pixel mobile menu, character cards and new portraits fit without horizontal overflow');await shot('mobile-menu-start');
  await f.locator('#start').tap();await f.waitForFunction(()=>pixelInfo().mode==='playing');
  const touch=await page.context().newCDPSession(page),jumpBox=await f.locator('#touch [data-key="jump"]').boundingBox();
  await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jumpBox.x+jumpBox.width/2,y:jumpBox.y+jumpBox.height/2}]});
  await f.waitForFunction(()=>pixelInfo().player.jumps===1);await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await f.locator('#touch [data-key="attack"]').tap();await f.waitForFunction(()=>pixelInfo().player.attack>0);
  const mobileBounds=await f.locator('#touch button:not(.hidden),#hud').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  ok((await info()).characterId==='dragon'&&(await f.locator('#hero-name').textContent())==='GPT（同人形象）'&&mobileBounds.every(b=>b.x>=-1&&b.right<=391&&b.y>=-1&&b.bottom<=845),'390-pixel gameplay retains its fan-art HUD and usable native touch jump/attack controls');await shot('mobile-gameplay');
  assert.deepEqual(report.errors,[]);ok(privateEdition||report.apiFixtureRequests>0,'Browser finishes without runtime errors; all account API traffic stays inside the isolated fixture');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,output}));
 }catch(error){report.error=String(error.stack);report.snapshot=f?await f.evaluate(()=>window.pixelInfo?.()).catch(()=>null):null;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(report,null,2));throw error}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
