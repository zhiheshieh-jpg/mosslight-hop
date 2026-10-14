import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_CHAPTERS,StoryDirector,getStoryScene} from '../dist/story.js';
const director=dimension=>new StoryDirector({dimension,document:null});
const advance=(s,seconds)=>{for(let t=0;t<seconds;t+=.1)s.update(.1)};
test('the four chapters form an original story with distinct traveller dialogue and noncombat 3D scenes',()=>{
 assert.equal(STORY_CHAPTERS.length,4);
 for(let level=0;level<4;level++){
  for(const dimension of ['2d','3d'])for(const stage of ['intro','midpoint','end']){
   const lines=getStoryScene(level,stage,{dimension});assert.ok(lines.length>0);assert.ok(lines.every(l=>l.speaker&&l.text.length>12));
  }
  assert.ok(getStoryScene(level,'preboss').length>0);assert.deepEqual(getStoryScene(level,'preboss',{dimension:'3d'}),[]);
  const g=getStoryScene(level,'intro'),c=getStoryScene(level,'intro',{character:'claude'});
  assert.ok(c.some(l=>l.speaker==='Claude'));assert.notEqual(g[1].text,c[1].text);
 }
 assert.match(getStoryScene(3,'end').map(l=>l.text).join(''),/协议重写/);
 const copy=getStoryScene(0,'intro');copy[0].text='changed';assert.notEqual(getStoryScene(0,'intro')[0].text,'changed');
});
test('midpoint and boss dialogue trigger once per run even after walking backwards or dying',()=>{
 const s=director('2d');s.startChapter(0);s.progress({ratio:.43});assert.equal(s.snapshot().stage,'midpoint');
 for(const ratio of [.1,.6,.2,.8])s.progress({ratio});s.progress({ratio:.89,bossNear:true});
 for(let n=0;n<8;n++)s.progress({ratio:.6,bossNear:true});assert.deepEqual(s.snapshot().counts,{intro:1,midpoint:1,preboss:1});
 s.startChapter(0);assert.deepEqual(s.snapshot().gates,['intro']);assert.deepEqual(s.snapshot().counts,{intro:1});
});
test('pause freezes line timing and nonblocking dialogue advances on a real delta clock',()=>{
 const s=director('2d');s.startChapter(0);advance(s,2);const a=s.snapshot();s.setPaused(true);advance(s,20);assert.equal(s.snapshot().elapsed,a.elapsed);assert.equal(s.snapshot().line,0);
 s.setPaused(false);advance(s,7);assert.equal(s.snapshot().line,1);s.next();assert.equal(s.snapshot().line,2);s.next();assert.equal(s.snapshot().visible,false);
});
test('exact seen gates survive a save behind earlier milestones and old saves fall back to position',()=>{
 const s=director('2d');s.startChapter(1);s.progress({ratio:.8,bossNear:true});const record=JSON.parse(JSON.stringify(s.snapshot()));
 const restored=director('2d');restored.startChapter(1,{restored:true,ratio:.1,seenGates:[...record.gates,'invalid']});restored.progress({ratio:.8,bossNear:true});
 assert.equal(restored.snapshot().visible,false);assert.equal(restored.snapshot().stage,null);assert.deepEqual(restored.snapshot().counts,{});assert.ok(!restored.snapshot().gates.includes('invalid'));
 const legacy=director('2d');legacy.startChapter(1,{restored:true,ratio:.94});legacy.progress({ratio:.95,bossNear:true});assert.deepEqual(legacy.snapshot().counts,{});
 const deferred=director('2d');deferred.startChapter(1,{restored:true});deferred.progress({ratio:.6});assert.ok(deferred.snapshot().gates.includes('midpoint'));assert.equal(deferred.snapshot().visible,false);
});
test('3D progression never adds combat scenes; completed scenes feed the result copy',()=>{
 const s=director('3d');s.startChapter(3);s.progress({ratio:.95,bossNear:true});assert.ok(!s.snapshot().gates.includes('preboss'));
 s.completeChapter();assert.equal(s.snapshot().stage,'end');assert.equal(s.snapshot().visible,false);assert.equal(s.snapshot().active,false);assert.match(s.endingText(),/光潮协议已更新/);
 assert.ok(s.snapshot().gates.includes('end'));
});
test('story archives are allowed in menus and pauses without stealing a running game',()=>{
 const s=director('2d');assert.equal(s.openArchive(),true);assert.equal(s.snapshot().archiveOpen,true);s.closeArchive();
 s.startChapter(2);assert.equal(s.openArchive(),false);s.setPaused(true);assert.equal(s.openArchive(),true);const line=s.snapshot().line;advance(s,20);assert.equal(s.snapshot().line,line);
 s.home();assert.equal(s.snapshot().archiveOpen,false);assert.equal(s.snapshot().visible,false);assert.deepEqual(s.snapshot().gates,[]);assert.equal(s.startChapter(9),false);
});
