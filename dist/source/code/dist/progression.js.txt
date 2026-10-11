// 3D progress deliberately uses separate storage from the 2D adventure.
export const PROGRESS_KEY='mosslight-3d-progress';
export const GOD_KEY='mosslight-3d-god';
const read=(storage,key)=>{try{return JSON.parse(storage?.getItem(key)||'null')}catch{return null}};
const write=(storage,key,value)=>{try{storage?.setItem(key,JSON.stringify(value));return !!storage}catch{return false}};
export function createProgression(storage){
 const saved=read(storage,PROGRESS_KEY);
 const completed=[0,1,2].map(i=>saved?.version===1&&Array.isArray(saved.completed)&&saved.completed[i]===true);
 for(let i=0;i<3;i++){let old;try{old=storage?.getItem(`mosslight-best-${i}`)}catch{}const n=typeof old==='string'&&old.trim()?Number(old):NaN;if(Number.isFinite(n)&&n>0)completed[i]=true}
 const snapshot=()=>({version:1,completed:[...completed],unlocked:[true,true,completed[0]&&completed[1]]});
 const persist=()=>write(storage,PROGRESS_KEY,{version:1,completed:[...completed]});
 if(completed.some(Boolean))persist();
 const canEnter=index=>Number.isInteger(index)&&index>=0&&index<3&&(index<2||completed[0]&&completed[1]);
 return {snapshot,canEnter,complete(index){if(!canEnter(index))return false;completed[index]=true;persist();return true}};
}
export const readGodMode=storage=>read(storage,GOD_KEY)===true;
export const saveGodMode=(storage,value)=>write(storage,GOD_KEY,!!value);
