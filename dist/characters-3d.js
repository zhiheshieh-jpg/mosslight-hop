import * as THREE from './vendor/three.module.js';

// The storage profile stays compatible with existing v2 account progress.
export const PLAYER_PROFILE='dragon';
export const PLAYER_NAME='白色方块';

export function restorePlayerProfile(record){
 const supported=id=>['dragon','claude','logo'].includes(id);
 if(!record||!supported(record.character)||!supported(record.runCharacter)||!['dragon','claude'].includes(record.lastNormalCharacter))return null;
 if(['godMode','usedGodMode','mixedCharacters'].some(key=>typeof record[key]!=='boolean'))return null;
 if(record.character==='logo'&&!record.godMode||record.godMode&&!record.usedGodMode||record.character!==record.runCharacter&&!record.usedGodMode&&!record.mixedCharacters)return null;
 return {character:PLAYER_PROFILE,lastNormalCharacter:PLAYER_PROFILE,runCharacter:PLAYER_PROFILE,mixedCharacters:record.mixedCharacters,usedGodMode:record.usedGodMode||record.character==='logo'||record.runCharacter==='logo'};
}

export function buildCharacter({box,mat,normalModel}){
 const root=new THREE.Group();root.name=PLAYER_NAME;
 if(normalModel){
  const original=normalModel.clone(true);
  original.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true}});
  root.add(original);
 }else{
  box(mat(0xfff7e8,{roughness:.65}),0,.78,0,.68,1.55,.64,root);
  box(mat(0x39544c),-.15,1.08,.326,.07,.08,.02,root);
  box(mat(0x39544c),.15,1.08,.326,.07,.08,.02,root);
 }
 return root;
}
