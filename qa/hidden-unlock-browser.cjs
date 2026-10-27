// Trusted keyboard integration checks for the undisclosed unlock input.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=process.env.QA_URL||'http://127.0.0.1:4186/';
const merged=process.env.QA_MERGED==='1',privateEdition=process.env.QA_PRIVATE==='1';
const output=process.env.QA_OUTPUT||'.deploy/hidden-unlock-update/browser';
const secret='mosslight-secret-god-unlocked',prefix=privateEdition?'mosslight-immune-only-v251:':'';
const report={url:base,merged,privateEdition,checks:[],errors:[],chords:[],fixture:{auths:0,saves:0}};
fs.mkdirSync(output,{recursive:true});
function ok(value,label){assert.ok(value,label);report.checks.push(label);console.log('PASS '+label)}
function target(mode){
 if(privateEdition){const u=/^[a-z]+:/i.test(base)?new URL(base):pathToFileURL(path.resolve(base));u.search='?qa';u.hash=mode;return u.href}
 return new URL(mode==='2d'?(merged?'./?qa':'2d/?qa'):(merged?'3d/?qa':'./?qa'),base).href;
}
const empty=[false,false,false,false],permutations=[['m','a','n'],['m','n','a'],['a','m','n'],['a','n','m'],['n','m','a'],['n','a','m']];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let page,f,mode;
 const accounts=new Map();
 try{
  async function makeContext(){
   const context=await browser.newContext({viewport:{width:1440,height:900}});
   if(!privateEdition)await context.route('**/api/**',async route=>{
    // Deliberately isolated fixture: the real account module still performs auth,
    // dirty patches, cache recovery and reloads; no live account is changed.
    const req=route.request(),name=new URL(req.url()).pathname.split('/').pop();
    const token=(req.headers().authorization||'').replace(/^Bearer /,'');let account=accounts.get(token),body={};
    if(req.postData())body=req.postDataJSON();
    const document=()=>({user:account.user,document:{storage:{...account.storage}},revision:account.revision,updatedAt:'2026-10-28T00:00:00.000Z'});
    let result,status=200;
    if(name==='auth'){
     const id=++report.fixture.auths,token='hidden-unlock-fixture-'+id;
     account={user:{id,username:'unlock-fixture-'+id},storage:{},revision:0};accounts.set(token,account);
     result={...document(),token,generatedPassword:'fixture-only'};
    }else if(!account){status=401;result={message:'Fixture session is missing'}}
    else if(name==='me')result=document();
    else if(name==='save'){
     report.fixture.saves++;
     for(const [key,value] of Object.entries(body.changes||{})){
      if(value===null)delete account.storage[key];else account.storage[key]=value;
     }
     account.revision++;result={...document(),merged:false};
    }else if(name==='logout')result={};
    else{status=404;result={message:'Unknown fixture route'}}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
   });
   return context;
  }
  async function open(nextMode,context){
   mode=nextMode;if(context){page=await context.newPage();page.setDefaultTimeout(privateEdition?90000:25000);page.on('pageerror',e=>report.errors.push(e.message))}
   await page.goto(target(mode));
   if(privateEdition){await page.locator('iframe').waitFor();f=await(await page.locator('iframe').elementHandle()).contentFrame();assert.ok(f,'Private iframe exists')}else f=page;
   await f.waitForFunction(mode=>mode==='2d'?window.pixelInfo?.().loaded:window.gameInfo&&document.querySelector('#loading').classList.contains('hidden'),mode);
   await f.locator('#unlock-input-dialog').waitFor({state:'attached'});
   const account=f.locator('#account-dialog');if(await account.count()&&await account.evaluate(e=>e.open))await f.click('.account-done');
   await f.locator('#sound').focus();
  }
  const info=()=>f.evaluate(mode=>mode==='2d'?pixelInfo():gameInfo(),mode);
  const ticks=()=>f.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const isOpen=()=>f.locator('#unlock-input-dialog').evaluate(e=>e.open);
  const input=()=>f.locator('#unlock-input-dialog input');
  const release=async()=>{for(const key of ['m','a','n'])await page.keyboard.up(key)};
  async function chord(order=permutations[0],held=false){for(const key of order)await page.keyboard.down(key);await f.waitForFunction(()=>document.querySelector('#unlock-input-dialog').open);if(!held)await release()}
  async function close(){await page.keyboard.press('Escape');await f.waitForFunction(()=>!document.querySelector('#unlock-input-dialog').open)}
  async function flag(){return f.evaluate(async({mode,privateEdition,secret})=>{const a=await import(privateEdition?(mode==='2d'?'mosslight/2d/account.js':'mosslight/account.js'):'./account.js');await a.saveNow({capture:false});return a.cloudStorage.getItem(secret)},{mode,privateEdition,secret})}
  function ordinaryProgress(state){return {completed:state.progress.completed,byCharacter:state.progress.byCharacter,legacyCompleted:state.progress.legacyCompleted,unlocked:state.progress.unlocked}}
  function freshProgress(state){assert.deepEqual(state.progress.completed,empty);assert.deepEqual(state.progress.byCharacter,{dragon:empty,claude:empty});assert.deepEqual(state.progress.legacyCompleted,empty);assert.deepEqual(state.progress.unlocked,[true,true,false,false])}
  async function noHints(){return f.evaluate(()=>{
   const d=document.querySelector('#unlock-input-dialog');
   return !/What can I say|M\s*\+\s*A\s*\+\s*N|口令|作弊|隐藏解锁/.test(document.body.innerText)
    &&[...document.querySelectorAll('button,a,[role="button"]')].filter(e=>!d.contains(e)).every(e=>!/unlock|cheat/i.test(e.id+' '+e.getAttribute('data-action')));
  })}
  async function nativeChords(){
   const sound=(await info()).sound;
   for(const order of permutations){await f.locator('#sound').focus();await chord(order);assert.equal(await f.locator('#unlock-input-dialog[open]').count(),1);assert.equal(await input().inputValue(),'');await close();report.chords.push({mode,order:order.join('+')})}
   ok(true,mode+' all six native held-key orders open one empty dialog');
   if(mode==='2d')ok((await info()).sound===sound,'2D MAN chords preserve the sound preference');
   await f.locator('#sound').focus();await chord(permutations[0],true);await close();
   await page.keyboard.down('n');await ticks();assert.equal(await isOpen(),false);
   await page.keyboard.up('n');await page.keyboard.down('n');await ticks();assert.equal(await isOpen(),false);
   await release();await chord();await close();
   ok(true,mode+' repeat and partial key release cannot reopen until all three keys are released');
   await f.locator('#sound').focus();for(const key of ['m','a','n'])await page.keyboard.press(key);await ticks();
   ok(!(await isOpen()),mode+' separate M A N taps do not open the dialog');
   if(mode==='2d'&&(await info()).sound!==sound)await page.keyboard.press('m');
   for(const modifier of ['Control','Alt','Meta']){
    await page.keyboard.down(modifier);for(const key of ['m','a','n'])await page.keyboard.down(key);await release();await page.keyboard.up(modifier);await ticks();assert.equal(await isOpen(),false,modifier+' must block unlock chord');
   }
   ok(true,mode+' Ctrl Alt and Meta modified chords do not open the dialog');
  }
  async function blockedSurfaces(){
   await f.evaluate(()=>{const x=document.createElement('div');x.id='unlock-qa-editors';x.innerHTML='<input type="text"><textarea></textarea><div contenteditable="true">editable</div>';document.body.append(x)});
   for(const selector of ['#unlock-qa-editors input','#unlock-qa-editors textarea','#unlock-qa-editors [contenteditable]']){
    await f.locator(selector).focus();for(const key of ['m','a','n'])await page.keyboard.down(key);await release();await ticks();assert.equal(await isOpen(),false,selector+' must block unlock chord');
   }
   await f.evaluate(()=>document.querySelector('#unlock-qa-editors').remove());
   ok(true,mode+' text inputs textarea and editable content block the chord');
   if(!privateEdition){
    await f.click('#account-open');await f.locator('#account-username').focus();for(const key of ['m','a','n'])await page.keyboard.down(key);await release();await ticks();
    assert.equal(await isOpen(),false);assert.equal(await f.locator('#account-dialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');
    ok(true,mode+' account dialog keeps exclusive keyboard focus');
   }
   await f.locator('#story-open').scrollIntoViewIfNeeded();await f.click('#story-open');for(const key of ['m','a','n'])await page.keyboard.down(key);await release();await ticks();
   assert.equal(await isOpen(),false);assert.equal((await info()).story.archiveOpen,true);await page.keyboard.press('Escape');
   ok(true,mode+' story archive blocks the chord and retains its Escape behavior');
  }
  async function pausedInput(){
   await f.click('#start');await f.waitForFunction(mode=>(mode==='2d'?pixelInfo():gameInfo()).mode==='playing',mode);
   await chord();assert.equal((await info()).mode,'paused');
   const audit=()=>f.evaluate(mode=>{const s=mode==='2d'?pixelInfo():gameInfo();return {mode:s.mode,time:s.time,player:s.player,godMode:s.godMode,sound:s.sound,fullscreen:!!document.fullscreenElement,level:s.level,combat:s.combatAudio?.byType}},mode);
   const before=await audit();await page.keyboard.type('wasd gjkref MAN');await page.keyboard.press('Space');await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowDown');await ticks();
   assert.deepEqual(await audit(),before);
   ok(true,mode+' opening during play pauses and typed movement attack and hotkeys cannot affect the game');
   await close();await ticks();assert.equal((await info()).mode,'paused');
   ok(true,mode+' Escape only closes the input and keeps gameplay paused');
   await f.evaluate(mode=>(mode==='2d'?__pixelQA:__qa).home(),mode);
  }
  const context=await makeContext();await open('2d',context);
  freshProgress(await info());ok(!(await info()).progress.godUnlocked&&await flag()===null,'Fresh account starts with locked god mode and no secret grant');
  ok(await noHints(),'2D exposes no secret phrase chord hint or menu entry');
  await nativeChords();await blockedSurfaces();
  const sound=(await info()).sound;await f.locator('#sound').focus();await page.keyboard.down('m');await ticks();assert.equal((await info()).sound,sound);await page.keyboard.down('m');await page.keyboard.up('m');await ticks();assert.equal((await info()).sound,!sound);await page.keyboard.press('m');
  ok((await info()).sound===sound,'2D single M toggles once on release and still supports repeated use');
  await chord();
  const presentation=await input().evaluate(e=>({type:e.type,value:e.value,placeholder:e.getAttribute('placeholder'),title:e.getAttribute('title'),focused:document.activeElement===e,native:e.closest('dialog') instanceof HTMLDialogElement,text:e.closest('dialog').textContent.replace(/[↵×\s]/g,'')}));
  assert.deepEqual(presentation,{type:'text',value:'',placeholder:null,title:null,focused:true,native:true,text:''});
  ok(true,'Unlock input is native plain text empty focused and has no hint message');
  const beforeWrong=ordinaryProgress(await info());
  for(const wrong of ['','what can I say','What Can I Say','What can I say ',' What can I say','wrong']){
   await input().fill(wrong);await page.keyboard.press('Enter');await ticks();assert.equal(await isOpen(),true,JSON.stringify(wrong));assert.equal((await info()).progress.godUnlocked,false);assert.equal(await flag(),null);assert.deepEqual(ordinaryProgress(await info()),beforeWrong);
   const message=await f.locator('#unlock-input-dialog').evaluate(e=>e.textContent.replace(/[↵×\s]/g,''));assert.equal(message,'');
  }
  ok(true,'Empty wrong case and surrounding whitespace submissions stay silently locked');
  await close();ok((await info()).mode==='menu','Escape from the menu input leaves the menu unchanged');
  await pausedInput();await chord();await input().fill('What can I say');await page.keyboard.press('Enter');await f.waitForFunction(()=>!document.querySelector('#unlock-input-dialog').open&&pixelInfo().progress.godUnlocked);
  freshProgress(await info());ok(await flag()==='true'&&!(await info()).godMode,'Exact phrase persists a grant without enabling god mode or changing normal progression');
  ok(await f.locator('[data-level="3"]').getAttribute('aria-disabled')==='true'&&!(await f.locator('#progress-detail').textContent()).includes('全部地图已通关'),'Secret unlock leaves laboratory locked and shows no false completion claim');
  await f.click('#god-menu');assert.equal((await info()).godMode,true);await f.click('#god-menu');freshProgress(await info());
  ok(!(await info()).godMode&&(await info()).progress.godUnlocked,'Existing god toggle works after unlock and disabling it preserves the grant');
  await flag();await open('2d');freshProgress(await info());ok((await info()).progress.godUnlocked&&!(await info()).godMode&&await flag()==='true','2D full document reload retains the grant and disabled preference');
  await open('3d');freshProgress(await info());ok((await info()).progress.godUnlocked&&!(await info()).godMode&&await flag()==='true','Same account 3D route sees the shared grant while keeping its ordinary progress empty');
  ok(await noHints(),'3D exposes no secret phrase chord hint or menu entry');
  await nativeChords();await blockedSurfaces();await pausedInput();
  await page.screenshot({path:path.join(output,'unlocked-3d.png')});
  // A second isolated account must independently earn the entitlement in 3D.
  const other=await makeContext();await open('3d',other);freshProgress(await info());
  ok(!(await info()).progress.godUnlocked&&await flag()===null,privateEdition?'Independent private browser storage starts locked':'A separate account does not inherit the first account grant');
  await chord();await input().fill('What can I say');await page.keyboard.press('Enter');await f.waitForFunction(()=>gameInfo().progress.godUnlocked&&!document.querySelector('#unlock-input-dialog').open);freshProgress(await info());
  ok(await flag()==='true'&&!(await info()).godMode,'3D exact phrase independently grants access without enabling it or fabricating progress');
  await open('2d');freshProgress(await info());ok((await info()).progress.godUnlocked&&await flag()==='true','3D grant persists across navigation back to 2D');
  await page.screenshot({path:path.join(output,'unlocked-2d.png')});
  assert.deepEqual(report.errors,[]);ok(true,'Both dimensions finish without browser runtime errors');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({...report,passed:true},null,2));console.log(JSON.stringify({passed:true,checks:report.checks.length,output}));
 }catch(error){
  report.error=String(error.stack);report.snapshot=f?await f.evaluate(()=>({pixel:window.pixelInfo?.(),game:window.gameInfo?.(),dialog:document.querySelector('#unlock-input-dialog')?.outerHTML})).catch(()=>null):null;
  if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
  fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify(report,null,2));throw error;
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
