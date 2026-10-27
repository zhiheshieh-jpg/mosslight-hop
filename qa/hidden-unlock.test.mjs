import test from 'node:test';
import assert from 'node:assert/strict';
import {UnlockChord,SECRET_KEY,grantHiddenUnlock,hasHiddenUnlock} from '../dist/hidden-unlock.js';
import * as pixel from '../dist/2d/progression.js';
import * as three from '../dist/progression.js';
const memory=()=>{const m=new Map;return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,String(v))}};
const event=(code,extra={})=>({code,repeat:false,...extra});
test('only overlapping MAN keys open, in every order, with one activation until all keys release',()=>{
 for(const order of [['KeyM','KeyA','KeyN'],['KeyM','KeyN','KeyA'],['KeyA','KeyM','KeyN'],['KeyA','KeyN','KeyM'],['KeyN','KeyA','KeyM'],['KeyN','KeyM','KeyA']]){
  let opened=0,muted=0;const c=new UnlockChord({open:()=>opened++,singleM:()=>muted++});
  for(const code of order)c.keydown(event(code));assert.equal(opened,1);
  for(const code of order)c.keydown(event(code,{repeat:true}));c.keyup(event(order[2]));c.keydown(event(order[2]));assert.equal(opened,1);
  for(const code of order)c.keyup(event(code));assert.equal(muted,0);
  for(const code of order){c.keydown(event(code));c.keyup(event(code))}assert.equal(opened,1);
 }
});
test('single M releases retain the sound shortcut and editable/modifier/blur paths cannot unlock',()=>{
 let opened=0,muted=0;const c=new UnlockChord({open:()=>opened++,singleM:()=>muted++});
 c.keydown(event('KeyM'));assert.equal(muted,0);c.keyup(event('KeyM'));assert.equal(muted,1);
 for(const code of ['KeyM','KeyA','KeyN'])c.keydown(event(code),{blocked:true});assert.equal(opened,0);
 for(const modifier of ['ctrlKey','altKey','metaKey']){for(const code of ['KeyM','KeyA','KeyN'])c.keydown(event(code,{[modifier]:true}));assert.equal(opened,0)}
 c.keydown(event('KeyM'));c.keydown(event('KeyA'));c.clear();c.keydown(event('KeyN'));assert.equal(opened,0);
 c.clear();c.keydown(event('KeyM'));c.keyup(event('KeyM'),{blocked:true});assert.equal(muted,1);
});
test('a shared persistent entitlement unlocks both modes without fabricating completions or opening chapters',()=>{
 const storage=memory(),p=pixel.createProgression(storage),t=three.createProgression(storage);
 assert.equal(p.snapshot().godUnlocked,false);assert.equal(t.snapshot().godUnlocked,false);
 assert.equal(grantHiddenUnlock(storage),true);
 for(const [api,progress] of [[pixel,p],[three,t]]){
  assert.equal(progress.snapshot().godUnlocked,true);assert.deepEqual(progress.snapshot().completed,[false,false,false,false]);assert.deepEqual(progress.snapshot().unlocked,[true,true,false,false]);
  assert.equal(api.readGodMode(storage),false);assert.equal(api.saveGodMode(storage,true),true);assert.equal(api.saveGodMode(storage,false),false);assert.equal(progress.snapshot().godUnlocked,true);
  assert.equal(api.createProgression(storage).snapshot().godUnlocked,true);assert.equal(progress.complete(0,'dragon',{usedGodMode:true}),false);
 }
 assert.equal(pixel.readGodMode(memory()),false);assert.equal(three.readGodMode(memory()),false);
});
test('invalid flags and unavailable storage cannot create an entitlement',()=>{
 const storage=memory();for(const value of ['false','1','"true"','{}','null','bad']){storage.setItem(SECRET_KEY,value);assert.equal(hasHiddenUnlock(storage),false)}
 assert.equal(hasHiddenUnlock({getItem(){throw Error('denied')}}),false);assert.equal(grantHiddenUnlock({setItem(){throw Error('full')}}),false);assert.equal(grantHiddenUnlock(null),false);
});
