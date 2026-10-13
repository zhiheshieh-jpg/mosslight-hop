// 3D progress deliberately uses separate storage from the 2D adventure.
export const PROGRESS_KEY='mosslight-3d-progress';
export const GOD_KEY='mosslight-3d-god';
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
 if(!current)for(let i=0;i<3;i++){
  let old;try{old=storage?.getItem(`mosslight-best-${i}`)}catch{}
  const time=typeof old==='string'&&old.trim()?Number(old):NaN;
  legacyCompleted[i] ||= Number.isFinite(time)&&time>0;
 }
 // Keep the v2 cloud schema, but treat historical profiles as one player's wins.
 const completedChapters=()=>CHAPTERS.map(i=>legacyCompleted[i]||CHARACTERS.some(id=>byCharacter[id][i]));
 const firstThreeReady=()=>completedChapters().slice(0,3).every(Boolean);
 // A fourth-chapter credit still requires ordinary wins in its first three chapters.
 if(!firstThreeReady())for(const id of CHARACTERS)byCharacter[id][3]=false;
 const snapshot=()=>{
  const completed=completedChapters(),ready=firstThreeReady();
  return {version:2,completed,byCharacter:Object.fromEntries(CHARACTERS.map(id=>[id,[...byCharacter[id]]])),legacyCompleted:[...legacyCompleted],unlocked:[true,true,completed[0]&&completed[1],ready],godUnlocked:completed.every(Boolean)};
 };
 const persist=()=>{const {version,completed,byCharacter,legacyCompleted}=snapshot();write(storage,PROGRESS_KEY,{version,completed,byCharacter,legacyCompleted})};
 // Persist even an empty migration so later assisted best times never become legacy wins.
 persist();
 const canEnter=index=>Number.isInteger(index)&&index>=0&&index<4&&snapshot().unlocked[index];
 return {snapshot,canEnter,complete(index,characterId,options={}){
  if(!canEnter(index)||!CHARACTERS.includes(characterId)||!object(options))return false;
  if(options.usedGodMode!==undefined&&options.usedGodMode!==false||options.mixedCharacters!==undefined&&options.mixedCharacters!==false)return false;
  byCharacter[characterId][index]=true;persist();return true;
 }};
}
export function readGodMode(storage){const unlocked=createProgression(storage).snapshot().godUnlocked;if(!unlocked){write(storage,GOD_KEY,false);return false}return read(storage,GOD_KEY)===true}
export function saveGodMode(storage,value){const enabled=!!value&&createProgression(storage).snapshot().godUnlocked;write(storage,GOD_KEY,enabled);return enabled}
