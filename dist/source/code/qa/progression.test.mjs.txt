import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgression,readBest,saveBest,readGodMode,saveGodMode,PROGRESS_KEY,BEST_KEY,GOD_KEY} from '../dist/2d/progression.js';
function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
test('2D sky gate requires both chapters, in either order, and survives reload',()=>{
 for(const order of [[0,1],[1,0]]){
  const s=storage(),p=createProgression(s);
  assert.equal(p.canEnter(2),false);assert.equal(p.complete(2,'dragon'),false);
  assert.equal(p.complete(order[0],'dragon'),true);assert.equal(p.canEnter(2),false);
  assert.equal(p.complete(order[1],'claude'),true);assert.equal(p.canEnter(2),true);
  assert.deepEqual(createProgression(s).snapshot().completed,[true,true,false,false]);
  for(const index of [-1,3,4,2.1,NaN,'2',null])assert.equal(p.canEnter(index),false);
 }
});
test('2D legacy scores preserve old wins without inventing character or fourth-chapter credits',()=>{
 const s=storage({[BEST_KEY]:JSON.stringify({0:1200,1:1800,2:2400,3:6000})}),p=createProgression(s);
 assert.equal(p.canEnter(2),true);assert.equal(p.canEnter(3),false);
 assert.deepEqual(p.snapshot().legacyCompleted,[true,true,true,false]);
 assert.deepEqual(p.snapshot().byCharacter,{dragon:[false,false,false,false],claude:[false,false,false,false]});
 assert.equal(p.snapshot().godUnlocked,false);assert.equal(JSON.parse(s.getItem(PROGRESS_KEY)).version,2);
 assert.deepEqual(createProgression(s).snapshot(),p.snapshot());
 for(const value of [null,[],{0:0,1:10},{0:'300',1:10},{0:-1,1:10}])assert.equal(createProgression(storage({[BEST_KEY]:JSON.stringify(value)})).canEnter(2),false);
});
test('2D best score storage includes chapter four but never becomes new completion evidence',()=>{
 const s=storage();createProgression(s);
 assert.equal(saveBest(s,{0:100,1:200,2:300,3:400,4:500,invalid:100}),true);
 assert.deepEqual(readBest(s),{0:100,1:200,2:300,3:400});
 const p=createProgression(s);assert.deepEqual(p.snapshot().completed,[false,false,false,false]);
 assert.equal(p.canEnter(2),false);assert.equal(p.canEnter(3),false);
 s.setItem(BEST_KEY,JSON.stringify({0:0,1:-1,2:'300',3:400}));assert.deepEqual(readBest(s),{3:400});
});
test('2D corrupt or unavailable storage remains playable and safe',()=>{
 const denied={getItem(){throw Error('denied')},setItem(){throw Error('denied')}};
 for(const s of [null,{},denied,storage({[PROGRESS_KEY]:'{broken',[BEST_KEY]:'{broken'}),storage({[PROGRESS_KEY]:'null',[BEST_KEY]:'[]'})]){
  const p=createProgression(s);assert.equal(p.canEnter(2),false);assert.deepEqual(readBest(s),{});
  p.complete(0,'dragon');p.complete(1,'dragon');assert.equal(p.canEnter(2),true);
  assert.equal(readGodMode(s),false);assert.equal(saveGodMode(s,true),false);assert.doesNotThrow(()=>saveBest(s,{0:5}));
 }
});
test('2D an old enabled god preference is cleared until legitimate completion',()=>{
 const s=storage({[GOD_KEY]:'true',[PROGRESS_KEY]:JSON.stringify({version:1,completed:[true,true,true]})});
 assert.equal(readGodMode(s),false);assert.equal(s.getItem(GOD_KEY),'false');
 assert.equal(saveGodMode(s,true),false);assert.equal(readGodMode(s),false);
 assert.deepEqual(createProgression(s).snapshot().completed,[true,true,true,false]);
});
