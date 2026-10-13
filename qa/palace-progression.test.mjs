import test from 'node:test';
import assert from 'node:assert/strict';
import {createProgression,PROGRESS_KEY,GOD_KEY,readGodMode,saveGodMode} from '../dist/progression.js';
const storage=(values={})=>({values:{...values},getItem(k){return this.values[k]??null},setItem(k,v){this.values[k]=v}});
test('3D palace requires both previous completions in either order and persists',()=>{
 for(const order of [[0,1],[1,0]]){
  const store=storage(),p=createProgression(store);assert.equal(p.canEnter(2),false);assert.equal(p.complete(2,'dragon'),false);
  p.complete(order[0],'dragon');assert.equal(p.canEnter(2),false);p.complete(order[1],'claude');assert.equal(p.canEnter(2),true);
  assert.equal(p.complete(2,'claude'),true);assert.deepEqual(createProgression(store).snapshot().completed,[true,true,true,false]);
 }
});
test('3D legacy completion times migrate only into historical first-three-chapter wins',()=>{
 for(const bad of ['0','-1','Infinity','NaN','null','',' ','true','{}','[]'])assert.equal(createProgression(storage({'mosslight-best-0':bad,'mosslight-best-1':'42'})).canEnter(2),false);
 const p=createProgression(storage({'mosslight-best-0':'12.5','mosslight-best-1':'32','mosslight-best-2':'180','mosslight-best-3':'360'}));
 assert.equal(p.canEnter(2),true);assert.equal(p.canEnter(3),true);assert.equal(p.snapshot().godUnlocked,false);
 assert.deepEqual(p.snapshot().legacyCompleted,[true,true,true,false]);
 assert.deepEqual(p.snapshot().byCharacter,{dragon:[false,false,false,false],claude:[false,false,false,false]});
 assert.equal(createProgression(storage({'mosslight-pixel-progress':'{"version":1,"completed":[true,true,true]}'})).canEnter(2),false);
});
test('3D new best times cannot convert an assisted finish into a migrated win on reload',()=>{
 const store=storage(),p=createProgression(store);assert.equal(p.complete(0,'dragon',{usedGodMode:true}),false);
 for(let i=0;i<4;i++)store.setItem(`mosslight-best-${i}`,'12.5');
 const reloaded=createProgression(store);assert.deepEqual(reloaded.snapshot().completed,[false,false,false,false]);
 assert.equal(reloaded.canEnter(2),false);assert.equal(reloaded.snapshot().godUnlocked,false);
});
test('3D corrupt, unavailable and unusual storage remain safe',()=>{
 for(const value of ['{','null','[]','true','{"version":1,"completed":[1,"true",true]}'])assert.equal(createProgression(storage({[PROGRESS_KEY]:value})).canEnter(2),false);
 const store={getItem(){throw Error('denied')},setItem(){throw Error('denied')}},p=createProgression(store);
 p.complete(0,'dragon');p.complete(1,'dragon');assert.equal(p.canEnter(2),true);
 for(const level of [-1,3,4,2.1,NaN,'2',null])assert.equal(p.canEnter(level),false);
});
test('3D god preference is revoked for an old save and cannot grant new progress',()=>{
 const store=storage({[GOD_KEY]:'true',[PROGRESS_KEY]:JSON.stringify({version:1,completed:[true,true,true]})});
 assert.equal(readGodMode(store),false);assert.equal(store.getItem(GOD_KEY),'false');
 assert.equal(saveGodMode(store,true),false);assert.equal(readGodMode(store),false);
 assert.deepEqual(createProgression(store).snapshot().completed,[true,true,true,false]);
});
