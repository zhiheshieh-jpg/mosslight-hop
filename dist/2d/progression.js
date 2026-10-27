import {hasHiddenUnlock} from '../hidden-unlock.js';
export const PROGRESS_KEY='mosslight-pixel-progress';
export const BEST_KEY='mosslight-pixel-best';
export const GOD_KEY='mosslight-pixel-god';
const CHAPTERS=[0,1,2,3],CHARACTERS=['dragon','claude'];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const flags=value=>CHAPTERS.map(i=>Array.isArray(value)&&value[i]===true);
function read(storage,key){try{return JSON.parse(storage?.getItem(key)||'null')}catch{return null}}
function write(storage,key,value){try{storage?.setItem(key,JSON.stringify(value));return !!storage}catch{return false}}

export function createProgression(storage){
 const saved=read(storage,PROGRESS_KEY),current=object(saved)&&saved.version===2;
 const byCharacter=Object.fromEntries(CHARACTERS.map(id=>[id,flags(current&&object(saved.byCharacter)?saved.byCharacter[id]:null)]));
 const legacyCompleted=flags(current?saved.legacyCompleted:object(saved)&&saved.version===1?saved.completed:null);
 // Historical saves predate chapter four and cannot identify which character won.
 legacyCompleted[3]=false;
 if(!current){const best=read(storage,BEST_KEY);for(let i=0;i<3;i++)legacyCompleted[i] ||= object(best)&&Number.isFinite(best[i])&&best[i]>0}
 const bothCharactersReady=()=>CHARACTERS.every(id=>byCharacter[id].slice(0,3).every(Boolean));
 // A fourth-chapter credit cannot exist before its two-character prerequisite.
 if(!bothCharactersReady())for(const id of CHARACTERS)byCharacter[id][3]=false;
 const snapshot=()=>{
  const completed=CHAPTERS.map(i=>legacyCompleted[i]||CHARACTERS.some(id=>byCharacter[id][i]));
  const ready=bothCharactersReady();
  return {version:2,completed,byCharacter:Object.fromEntries(CHARACTERS.map(id=>[id,[...byCharacter[id]]])),legacyCompleted:[...legacyCompleted],unlocked:[true,true,completed[0]&&completed[1],ready],godUnlocked:hasHiddenUnlock(storage)||(ready&&CHAPTERS.every(i=>CHARACTERS.some(id=>byCharacter[id][i])))};
 };
 const persist=()=>{const {version,completed,byCharacter,legacyCompleted}=snapshot();write(storage,PROGRESS_KEY,{version,completed,byCharacter,legacyCompleted})};
 // Persist even an empty migration so later assisted best scores never become legacy wins.
 persist();
 const canEnter=index=>Number.isInteger(index)&&index>=0&&index<4&&snapshot().unlocked[index];
 return {snapshot,canEnter,complete(index,characterId,options={}){
  if(!canEnter(index)||!CHARACTERS.includes(characterId)||!object(options))return false;
  if(options.usedGodMode!==undefined&&options.usedGodMode!==false||options.mixedCharacters!==undefined&&options.mixedCharacters!==false)return false;
  byCharacter[characterId][index]=true;persist();return true;
 }};
}
export function readBest(storage){const value=read(storage,BEST_KEY);return Object.fromEntries(CHAPTERS.filter(i=>object(value)&&Number.isFinite(value[i])&&value[i]>0).map(i=>[i,value[i]]))}
export function saveBest(storage,best){return write(storage,BEST_KEY,best)}
export function readGodMode(storage){const unlocked=createProgression(storage).snapshot().godUnlocked;if(!unlocked){write(storage,GOD_KEY,false);return false}return read(storage,GOD_KEY)===true}
export function saveGodMode(storage,value){const enabled=!!value&&createProgression(storage).snapshot().godUnlocked;write(storage,GOD_KEY,enabled);return enabled}
