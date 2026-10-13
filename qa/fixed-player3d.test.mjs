import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PLAYER_PROFILE,PLAYER_NAME,restorePlayerProfile,buildCharacter} from '../dist/characters-3d.js';
import {createProgression,PROGRESS_KEY} from '../dist/progression.js';

function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}}
const record=(character='dragon',extra={})=>({schema:'mosslight-3d-run',version:1,character,lastNormalCharacter:character==='logo'?'claude':character,runCharacter:character,godMode:character==='logo',usedGodMode:character==='logo',mixedCharacters:false,...extra});

test('3D old profile wins unlock chapters by their union without changing the cloud schema',()=>{
 for(const saved of [
  {version:2,byCharacter:{dragon:[true,false,true,false],claude:[false,true,false,false]}},
  {version:2,byCharacter:{dragon:[false,true,false,false],claude:[true,false,true,false]}},
  {version:2,legacyCompleted:[true,false,true,false],byCharacter:{dragon:[false,true,false,false]}},
  {version:1,completed:[true,true,true,false]},
 ]){
  const store=storage({[PROGRESS_KEY]:JSON.stringify(saved)}),p=createProgression(store);
  assert.deepEqual(p.snapshot().completed,[true,true,true,false]);
  assert.equal(p.canEnter(3),true);assert.equal(p.snapshot().godUnlocked,false);
  for(const id of ['dragon','claude'])for(let i=0;i<4;i++)if(saved.byCharacter?.[id]?.[i]===true)assert.equal(p.snapshot().byCharacter[id][i],true);
  assert.equal(p.complete(3,PLAYER_PROFILE,{usedGodMode:true}),false);
  assert.equal(p.complete(3,PLAYER_PROFILE,{mixedCharacters:true}),false);
  assert.equal(p.complete(3,PLAYER_PROFILE),true);assert.equal(p.snapshot().godUnlocked,true);
  assert.deepEqual(createProgression(store).snapshot(),p.snapshot());
  const persisted=JSON.parse(store.getItem(PROGRESS_KEY));
  assert.equal(persisted.version,2);assert.deepEqual(Object.keys(persisted.byCharacter),['dragon','claude']);
 }
});

test('3D valid fourth-chapter wins survive a legacy single-profile or split-profile save',()=>{
 for(const saved of [
  {version:2,byCharacter:{dragon:[true,true,true,true],claude:[false,false,false,false]}},
  {version:2,byCharacter:{dragon:[true,false,true,false],claude:[false,true,false,true]}},
  {version:2,legacyCompleted:[true,true,true,false],byCharacter:{claude:[false,false,false,true]}},
 ]){
  const store=storage({[PROGRESS_KEY]:JSON.stringify(saved)}),p=createProgression(store);
  assert.deepEqual(p.snapshot().completed,[true,true,true,true]);assert.equal(p.snapshot().godUnlocked,true);
  for(const id of ['dragon','claude'])for(let i=0;i<4;i++)if(saved.byCharacter?.[id]?.[i]===true)assert.equal(p.snapshot().byCharacter[id][i],true);
  assert.deepEqual(createProgression(store).snapshot(),p.snapshot());
 }
});

test('3D old clean saves become the fixed white-block profile and remain normal runs',()=>{
 for(const id of ['dragon','claude']){
  const source=record(id),profile=restorePlayerProfile(source);
  assert.deepEqual(profile,{character:PLAYER_PROFILE,lastNormalCharacter:PLAYER_PROFILE,runCharacter:PLAYER_PROFILE,mixedCharacters:false,usedGodMode:false});
  assert.equal(source.character,id);
  assert.equal(createProgression(storage()).complete(0,profile.runCharacter,profile),true);
  assert.deepEqual(restorePlayerProfile({...source,...profile}),profile);
 }
});

test('3D restored assisted and mixed runs cannot become clean completion records',()=>{
 for(const source of [
  record('logo'),
  record('claude',{usedGodMode:true,godMode:false}),
  record('dragon',{runCharacter:'claude',mixedCharacters:true}),
  record('dragon',{runCharacter:'logo',mixedCharacters:true}),
  record('logo',{mixedCharacters:true}),
 ]){
  const profile=restorePlayerProfile(source),p=createProgression(storage());
  assert.equal(profile.character,PLAYER_PROFILE);assert.equal(profile.runCharacter,PLAYER_PROFILE);
  assert.equal(profile.mixedCharacters,source.mixedCharacters);
  assert.equal(profile.usedGodMode,source.usedGodMode||source.character==='logo'||source.runCharacter==='logo');
  assert.equal(p.complete(0,profile.runCharacter,profile),false);
  assert.deepEqual(p.snapshot().completed,[false,false,false,false]);
  assert.deepEqual(restorePlayerProfile({...source,...profile}),profile);
 }
});

test('3D malformed legacy player and audit fields are rejected before conversion',()=>{
 for(const source of [null,{},record('unknown'),record('logo',{godMode:false}),record('claude',{godMode:true,usedGodMode:false}),record('claude',{runCharacter:'dragon'}),record('dragon',{usedGodMode:'false'}),record('dragon',{mixedCharacters:0}),record('dragon',{lastNormalCharacter:'logo'})])assert.equal(restorePlayerProfile(source),null);
});

test('3D visual builder always clones the supplied original model with its own disposable resources',()=>{
 const model=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(.68,1.55,.64),new THREE.MeshStandardMaterial({color:0xfff7e8}));
 body.position.y=.78;model.add(body);
 for(const id of ['dragon','claude','logo']){
  const root=buildCharacter({normalModel:model,character:id});
  assert.equal(root.name,PLAYER_NAME);assert.equal(root.children.length,1);
  const cloned=root.children[0].children[0];
  assert.deepEqual(cloned.geometry.parameters,body.geometry.parameters);assert.equal(cloned.material.color.getHex(),body.material.color.getHex());
  assert.notEqual(cloned.geometry,body.geometry);assert.notEqual(cloned.material,body.material);
  assert.equal(cloned.position.y,.78);assert.equal(cloned.castShadow,true);assert.equal(cloned.receiveShadow,true);
  assert.deepEqual(Object.keys(root.userData),[]);
  cloned.geometry.dispose();cloned.material.dispose();
 }
 body.geometry.dispose();body.material.dispose();
});
