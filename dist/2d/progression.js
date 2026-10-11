export const PROGRESS_KEY='mosslight-pixel-progress';
export const BEST_KEY='mosslight-pixel-best';
export const GOD_KEY='mosslight-pixel-god';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function read(storage,key){try{return JSON.parse(storage?.getItem(key)||'null')}catch{return null}}
function write(storage,key,value){try{storage?.setItem(key,JSON.stringify(value));return !!storage}catch{return false}}
export function createProgression(storage){
 const saved=read(storage,PROGRESS_KEY),legacy=read(storage,BEST_KEY);
 const completed=[0,1,2].map(i=>saved?.version===1&&saved.completed?.[i]===true||object(legacy)&&Number.isFinite(legacy[i])&&legacy[i]>0);
 const snapshot=()=>({version:1,completed:[...completed],unlocked:[true,true,completed[0]&&completed[1]]});
 const persist=()=>write(storage,PROGRESS_KEY,{version:1,completed:[...completed]});
 if(completed.some(Boolean))persist();
 return {snapshot,canEnter:index=>Number.isInteger(index)&&index>=0&&index<3&&(index<2||completed[0]&&completed[1]),complete(index){if(!Number.isInteger(index)||index<0||index>2)return false;completed[index]=true;persist();return true}};
}
export function readBest(storage){const value=read(storage,BEST_KEY);return Object.fromEntries([0,1,2].filter(i=>object(value)&&Number.isFinite(value[i])&&value[i]>0).map(i=>[i,value[i]]))}
export function saveBest(storage,best){return write(storage,BEST_KEY,best)}
export function readGodMode(storage){return read(storage,GOD_KEY)===true}
export function saveGodMode(storage,value){write(storage,GOD_KEY,!!value);return !!value}
