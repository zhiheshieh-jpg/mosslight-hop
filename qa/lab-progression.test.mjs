import test from 'node:test';
import assert from 'node:assert/strict';
import * as pixel from '../dist/2d/progression.js';
import * as palace from '../dist/progression.js';
function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const empty=[false,false,false,false];
const clearFirstThree=p=>{for(const id of ['dragon','claude'])for(const level of [0,1,2])assert.equal(p.complete(level,id),true)};

for(const [name,api] of [['2D',pixel],['3D',palace]]){
 test(`${name} both normal characters must clear the first three chapters before the laboratory opens`,()=>{
  const store=storage();let p=api.createProgression(store);
  assert.deepEqual(p.snapshot().unlocked,[true,true,false,false]);
  for(const level of [0,1,2])assert.equal(p.complete(level,'dragon'),true);
  assert.deepEqual(p.snapshot().completed,[true,true,true,false]);assert.equal(p.canEnter(3),false);
  assert.equal(p.complete(3,'dragon'),false);assert.equal(p.snapshot().godUnlocked,false);
  p=api.createProgression(store);assert.deepEqual(p.snapshot().byCharacter.dragon,[true,true,true,false]);
  assert.deepEqual(p.snapshot().byCharacter.claude,empty);
  for(const level of [2,0]){assert.equal(p.complete(level,'claude'),true);assert.equal(p.canEnter(3),false)}
  assert.equal(p.complete(1,'claude'),true);assert.equal(p.canEnter(3),true);assert.equal(p.snapshot().godUnlocked,false);
  assert.deepEqual(api.createProgression(store).snapshot().unlocked,[true,true,true,true]);
 });

 test(`${name} either normal character can earn god mode with a clean laboratory finish`,()=>{
  for(const finisher of ['dragon','claude']){
   const store=storage(),p=api.createProgression(store);clearFirstThree(p);
   assert.equal(api.saveGodMode(store,true),false);
   assert.equal(p.complete(3,finisher,{usedGodMode:true}),false);assert.equal(p.complete(3,finisher,{mixedCharacters:true}),false);
   assert.equal(p.snapshot().godUnlocked,false);
   assert.equal(p.complete(3,finisher,{usedGodMode:false,mixedCharacters:false}),true);
   assert.equal(p.snapshot().godUnlocked,true);assert.deepEqual(p.snapshot().completed,[true,true,true,true]);
   assert.equal(api.readGodMode(store),false);assert.equal(api.saveGodMode(store,true),true);assert.equal(api.readGodMode(store),true);
   assert.equal(api.createProgression(store).snapshot().godUnlocked,true);
   assert.equal(api.saveGodMode(store,false),false);assert.equal(api.readGodMode(store),false);
   store.setItem(api.GOD_KEY,'"true"');assert.equal(api.readGodMode(store),false);
  }
 });

 test(`${name} assisted, mixed, unknown-character and malformed finish reports never earn credit`,()=>{
  const p=api.createProgression(storage());
  for(const id of [undefined,null,'logo','gpt','GPT','__proto__',{},0])assert.equal(p.complete(0,id),false);
  for(const options of [{usedGodMode:true},{mixedCharacters:true},{usedGodMode:'false'},{mixedCharacters:1},null,[]])assert.equal(p.complete(0,'dragon',options),false);
  for(const index of [-1,2,3,4,1.5,NaN,Infinity,'0',null])assert.equal(p.complete(index,'dragon'),false);
  assert.deepEqual(p.snapshot().completed,empty);assert.deepEqual(p.snapshot().byCharacter,{dragon:empty,claude:empty});
  assert.equal(p.complete(0,'dragon'),true);assert.equal(p.complete(0,'dragon'),true);
  assert.equal(p.complete(0,'claude',{usedGodMode:true}),false);
  assert.deepEqual(p.snapshot().byCharacter.dragon,[true,false,false,false]);assert.deepEqual(p.snapshot().byCharacter.claude,empty);
 });

 test(`${name} old three-chapter wins retain access but do not stand in for either character`,()=>{
  const store=storage({[api.PROGRESS_KEY]:JSON.stringify({version:1,completed:[true,true,true,true]})}),p=api.createProgression(store);
  assert.deepEqual(p.snapshot().completed,[true,true,true,false]);assert.equal(p.canEnter(2),true);assert.equal(p.canEnter(3),false);
  for(const level of [0,1,2])p.complete(level,'dragon');assert.equal(p.canEnter(3),false);
  assert.deepEqual(p.snapshot().byCharacter.claude,empty);
  for(const level of [0,1,2])p.complete(level,'claude');assert.equal(p.canEnter(3),true);
  assert.equal(p.snapshot().godUnlocked,false);p.complete(3,'claude');assert.equal(p.snapshot().godUnlocked,true);
  assert.deepEqual(api.createProgression(store).snapshot(),p.snapshot());
 });

 test(`${name} repeated reads preserve character credit and snapshots cannot mutate saved state`,()=>{
  const store=storage(),p=api.createProgression(store);p.complete(0,'dragon');p.complete(1,'claude');
  const expected=p.snapshot(),exposed=p.snapshot();exposed.completed.fill(true);exposed.byCharacter.dragon.fill(true);exposed.byCharacter.claude.fill(true);exposed.legacyCompleted.fill(true);exposed.unlocked.fill(true);
  assert.deepEqual(p.snapshot(),expected);
  for(let i=0;i<3;i++){assert.equal(api.readGodMode(store),false);assert.deepEqual(api.createProgression(store).snapshot(),expected)}
  assert.equal(p.complete(2,'dragon'),true);assert.deepEqual(api.createProgression(store).snapshot(),p.snapshot());
 });

 test(`${name} corrupted schema and derived flags cannot fabricate laboratory or god access`,()=>{
  const malicious={completed:[true,true,true,true],unlocked:[true,true,true,true],godUnlocked:true,byCharacter:{dragon:[true,true,true,true],claude:[true,true,true,true]}};
  for(const version of [undefined,null,true,'2',0,3,{},[]]){
   const p=api.createProgression(storage({[api.PROGRESS_KEY]:JSON.stringify({...malicious,version})}));
   assert.deepEqual(p.snapshot().completed,empty);assert.equal(p.canEnter(3),false);assert.equal(p.snapshot().godUnlocked,false);
  }
  const cases=[
   {version:2,completed:[true,true,true,true],godUnlocked:true},
   {version:2,byCharacter:{dragon:{0:true,1:true,2:true,3:true},claude:[1,'true',true,true]}},
   {version:2,byCharacter:{logo:[true,true,true,true]}},
   {version:2,byCharacter:{dragon:[true,true,true,true],claude:[true,true,false,true]}},
   {version:2,legacyCompleted:[true,true,true,true]},
   {version:1,completed:{0:true,1:true,2:true}},
  ];
  for(const saved of cases){const p=api.createProgression(storage({[api.PROGRESS_KEY]:JSON.stringify(saved)}));assert.equal(p.canEnter(3),false);assert.equal(p.snapshot().godUnlocked,false);assert.equal(p.snapshot().completed[3],false)}
 });
}

test('2D and 3D character wins and god preferences stay separate in the same browser',()=>{
 const store=storage(),two=pixel.createProgression(store);clearFirstThree(two);two.complete(3,'claude');assert.equal(pixel.saveGodMode(store,true),true);
 const three=palace.createProgression(store);assert.deepEqual(three.snapshot().completed,empty);assert.equal(palace.readGodMode(store),false);assert.equal(palace.saveGodMode(store,true),false);
 assert.equal(pixel.readGodMode(store),true);clearFirstThree(three);three.complete(3,'dragon');assert.equal(palace.saveGodMode(store,true),true);
 pixel.saveGodMode(store,false);assert.equal(palace.readGodMode(store),true);assert.equal(pixel.readGodMode(store),false);
});
