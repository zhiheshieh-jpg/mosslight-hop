// Same-origin account storage, shared by the 2D and 3D applications.
const SESSION='mosslight-account-session-v1',CACHE='mosslight-account-cache-v1';
const allowed=key=>/^mosslight-(pixel-(progress|best|god|character)|3d-(progress|god|character)|collection-v2|best-[0-3]|best-normal-(dragon|claude)-[0-3]|run-(2d|3d))$/.test(key);
const raw=(()=>{try{return localStorage}catch{return null}})();
const read=(key,fallback)=>{try{return JSON.parse(raw?.getItem(key)||'null')??fallback}catch{return fallback}};
const write=(key,value)=>{try{raw?.setItem(key,JSON.stringify(value))}catch{}};
const apiBase=new URL(document.documentElement.dataset.api||'./api/',location.href);
let session=read(SESSION,null),values={},revision=0,updatedAt=null,status='正在连接云存档',online=false,dirty=new Map(),timer,flight=null,runHooks=null,currentMode=null,dialog,credentialNotice=false;
const copy=value=>JSON.parse(JSON.stringify(value));
function localValues(){const data={};try{for(let i=0;i<raw.length;i++){const key=raw.key(i);if(!allowed(key))continue;let value=raw.getItem(key);if(value.length>300000)continue;
 if(/^mosslight-best-/.test(key)){const time=Number(value);if(!Number.isFinite(time)||time<=0||time>1e12)continue;value=String(time)}
 if(key==='mosslight-pixel-best'){try{const scores=JSON.parse(value);value=JSON.stringify(Object.fromEntries([0,1,2,3].filter(n=>Number.isFinite(scores?.[n])&&scores[n]>0&&scores[n]<=1e12).map(n=>[n,scores[n]])))}catch{continue}}
 if(key.endsWith('-progress')){try{const p=JSON.parse(value),flags=a=>[0,1,2,3].map(n=>a?.[n]===true);if(p?.version===1)value=JSON.stringify({version:1,completed:flags(p.completed)});else if(p?.version===2)value=JSON.stringify({version:2,legacyCompleted:flags(p.legacyCompleted),byCharacter:{dragon:flags(p.byCharacter?.dragon),claude:flags(p.byCharacter?.claude)}});else continue}catch{continue}}
 data[key]=value}}catch{}return data}
function cache(){if(session?.user)write(CACHE,{userId:session.user.id,storage:values,revision,updatedAt})}
function announce(message){status=message;paint();dispatchEvent(new CustomEvent('mosslight-cloud-status',{detail:{message,online}}))}
async function request(route,{method='GET',body,token=session?.token}={}){
 const response=await fetch(new URL(route,apiBase),{method,cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
 const result=await response.json().catch(()=>({message:'账号服务暂不可用'}));
 if(!response.ok){const error=new Error(result.message||'账号服务暂不可用');error.status=response.status;throw error}return result;
}
function adopt(result,{keepDirty=false}={}){const pending=keepDirty?new Map(dirty):new Map();values=copy(result.document?.storage||{});for(const [key,value] of pending){if(value===null)delete values[key];else values[key]=value}revision=result.revision||0;updatedAt=result.updatedAt||null;online=true;cache();paint()}
async function flush(){
 clearTimeout(timer);if(flight){await flight;if(dirty.size)return flush();return true}
 if(!session?.token){announce('仅保存在本机 · 登录后同步');return false}
 if(!dirty.size){announce(online?'云存档已保存':'离线 · 本机副本已保留');return online}
 const batch=new Map(dirty);
 flight=(async()=>{try{const result=await request('save',{method:'PUT',body:{changes:Object.fromEntries(batch),baseRevision:revision}});for(const [key,value] of batch)if(dirty.get(key)===value)dirty.delete(key);adopt(result,{keepDirty:true});announce('云存档已保存');return true}catch(error){online=false;if(error.status===401){session.expired=true;write(SESSION,session)}cache();announce(error.status===401?'登录已过期 · 请重新登录':'连接中断 · 本机副本已保留');return false}finally{flight=null}})();
 return flight;
}
function schedule(){cache();clearTimeout(timer);timer=setTimeout(()=>flush(),900);announce('正在保存…')}
export const cloudStorage={getItem:key=>allowed(key)?values[key]??null:null,setItem(key,value){if(!allowed(key))return;value=String(value);if(values[key]===value)return;values[key]=value;dirty.set(key,value);schedule()},removeItem(key){if(!allowed(key))return;delete values[key];if(!session?.user)try{raw?.removeItem(key)}catch{}dirty.set(key,null);schedule()}};
function checkpointCopy(){if(!runHooks)return;const record=runHooks.capture();if(record)cloudStorage.setItem('mosslight-run-'+currentMode,JSON.stringify({...record,savedAt:new Date().toISOString()}))}
export async function saveNow({capture=true}={}){if(capture)checkpointCopy();cache();return flush()}
export function loadRun(mode=currentMode){try{return JSON.parse(cloudStorage.getItem('mosslight-run-'+mode)||'null')}catch{return null}}
export function clearRun(mode=currentMode){cloudStorage.removeItem('mosslight-run-'+mode)}
export function registerRunHooks(mode,hooks){currentMode=mode;runHooks=hooks;installControls();paint();if(credentialNotice){credentialNotice=false;showAccount()}}
function stamp(){if(!updatedAt)return '尚无云端存档';const date=new Date(updatedAt);return Number.isNaN(date.getTime())?'云存档已保存':`保存于 ${date.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}`}
function paint(){
 const user=session?.user?.username||'本机旅人';
 document.querySelectorAll('[data-account-name]').forEach(el=>el.textContent=user);
 document.querySelectorAll('[data-cloud-status]').forEach(el=>el.textContent=status);
 const load=document.getElementById('cloud-load'),run=loadRun();if(load){load.disabled=!run;load.textContent=run?`继续存档 · 第 ${Number(run.level??run.world?.level??0)+1} 章`:'暂无关卡存档'}
 if(dialog){dialog.querySelector('#account-current').textContent=session?.user?`当前账号：${user}`:'尚未连接账号';dialog.querySelector('#account-saved').textContent=stamp();dialog.querySelector('#account-credentials').textContent=session?.password?`账号：${user}\n密码：${session.password}`:`账号：${user}\n密码只在创建或输入时保存在本机，请自行记住。`;dialog.querySelector('#account-copy').disabled=!session?.user;dialog.querySelector('#account-logout').disabled=!session?.token;}
}
function ensureDialog(){if(dialog)return;const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=new URL('./account.css',import.meta.url);document.head.appendChild(sheet);
 dialog=document.createElement('dialog');dialog.id='account-dialog';dialog.innerHTML=`<form method="dialog" class="account-card"><div class="account-heading"><span>旅人账号 · 云存档</span><button class="account-close" value="close" aria-label="关闭账号窗口">×</button></div><h2 id="account-current"></h2><p data-cloud-status></p><small id="account-saved"></small><pre id="account-credentials"></pre><div class="account-actions"><button type="button" id="account-copy">复制账号与密码</button><button type="button" id="account-sync">立即保存</button></div><p class="account-note">首次进入会自动注册并登录。记下账号和密码，在其他设备登录即可找回存档。</p><hr><label>账号<input id="account-username" autocomplete="username" maxlength="24" placeholder="留空自动生成新账号"></label><label>密码<input id="account-password" type="password" autocomplete="current-password" maxlength="64" placeholder="新账号留空自动生成 6 位密码"></label><button type="button" id="account-login">登录 / 自动注册</button><p id="account-message" role="status"></p><button type="button" id="account-logout">退出当前账号</button><button value="close" class="account-done">记住了，继续冒险</button></form>`;document.body.appendChild(dialog);
 dialog.querySelector('#account-copy').onclick=async()=>{const text=`苔光账号：${session.user.username}\n密码：${session.password||'（使用你原先的密码）'}`;try{await navigator.clipboard.writeText(text);dialog.querySelector('#account-message').textContent='账号与密码已复制。'}catch{dialog.querySelector('#account-message').textContent='请选中上方账号和密码后复制。'}};
 dialog.querySelector('#account-sync').onclick=async()=>{const saved=await saveNow();dialog.querySelector('#account-message').textContent=saved?'存档已保存到服务器。':'云端暂不可用，本机副本已保留。'};
 dialog.querySelector('#account-login').onclick=async()=>{const b=dialog.querySelector('#account-login');b.disabled=true;try{if(session?.token&&!session.expired&&!await saveNow())throw Error('当前账号尚未同步，请连接服务器后再切换。');const pending=new Map(dirty),oldUser=session?.user?.id;const username=dialog.querySelector('#account-username').value.trim(),password=dialog.querySelector('#account-password').value;const result=await request('auth',{method:'POST',body:{username,password},token:null});session={token:result.token,user:result.user,password:result.generatedPassword||password};write(SESSION,session);dirty.clear();adopt(result);if(result.user.id===oldUser){for(const [key,value] of pending){if(value===null)delete values[key];else values[key]=value;dirty.set(key,value)}if(dirty.size)await flush()}location.reload()}catch(e){dialog.querySelector('#account-message').textContent=e.message}finally{b.disabled=false}};
 dialog.querySelector('#account-logout').onclick=async()=>{if(!await saveNow()){dialog.querySelector('#account-message').textContent='存档尚未同步，连接恢复后可退出。';return}try{await request('logout',{method:'POST',body:{}});session={user:session.user,signedOut:true};write(SESSION,session);location.reload()}catch(e){dialog.querySelector('#account-message').textContent=e.message}};
 addEventListener('keydown',e=>{if(dialog.open){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();dialog.close()}}},true);paint();
}
export function showAccount(){ensureDialog();runHooks?.pause?.();paint();if(!dialog.open)dialog.showModal()}
function installControls(){ensureDialog();
 if(!document.getElementById('account-strip')){const box=document.createElement('div');box.id='account-strip';box.innerHTML='<button type="button" id="account-open"><span>◈</span> <b data-account-name></b><small data-cloud-status></small></button><button type="button" id="cloud-load">继续存档</button>';document.getElementById('start')?.before(box);box.querySelector('#account-open').onclick=showAccount;box.querySelector('#cloud-load').onclick=()=>{const record=loadRun();if(!record||!runHooks.restore(record)){announce('存档版本不匹配或章节尚未解锁');return}announce('已载入存档 · 点击继续冒险')};}
 const anchor=document.getElementById('resume')||document.getElementById('modal-primary');if(anchor&&!document.getElementById('cloud-save')){const row=document.createElement('div');row.className='cloud-pause-actions';row.innerHTML='<button type="button" id="cloud-save">保存存档</button><button type="button" id="account-pause-open">账号与云存档</button><small data-cloud-status></small>';anchor.before(row);row.querySelector('#cloud-save').onclick=async()=>{const b=row.querySelector('#cloud-save');b.disabled=true;const ok=await saveNow();b.textContent=ok?'已保存到云端':'本机已保存 · 等待同步';b.disabled=false;setTimeout(()=>b.textContent='保存存档',2400)};row.querySelector('#account-pause-open').onclick=showAccount;}
}
async function init(){
 try{
  if(session?.token){const pending=read(CACHE,null);const result=await request('me');session.user=result.user;delete session.expired;write(SESSION,session);adopt(result);if(pending?.userId===session.user.id&&pending.dirty){for(const [key,value] of Object.entries(pending.dirty))if(allowed(key)){if(value===null)delete values[key];else values[key]=value;dirty.set(key,value)}if(dirty.size)await flush()}announce('云存档已载入');return}
  if(session?.signedOut){values={};announce('请登录账号后载入云存档');return}
  const legacy=localValues(),result=await request('auth',{method:'POST',body:{},token:null});session={token:result.token,user:result.user,password:result.generatedPassword};write(SESSION,session);adopt(result);for(const [key,value] of Object.entries(legacy)){values[key]=value;dirty.set(key,value)}if(dirty.size)await flush();announce('账号已自动创建 · 云存档就绪');credentialNotice=true;
 }catch(e){online=false;if(e.status===401&&session?.token){session.expired=true;write(SESSION,session)}const cached=read(CACHE,null);values=session?.user&&cached?.userId===session.user.id?cached.storage||{}:session?.signedOut?{}:localValues();revision=cached?.revision||0;announce(session?.token?'暂时离线 · 使用本机存档副本':'账号服务暂不可用 · 进度先保存在本机')}
}
// Keep unacknowledged edits in the account-scoped cache across abrupt restarts.
const originalCache=cache;cache=()=>{originalCache();if(session?.user)write(CACHE,{userId:session.user.id,storage:values,dirty:Object.fromEntries(dirty),revision,updatedAt});else for(const [key,value] of Object.entries(values))try{raw?.setItem(key,value)}catch{}};
export const accountReady=init();
setInterval(()=>{if(runHooks){checkpointCopy();flush()}},15000);
addEventListener('online',()=>flush());addEventListener('pagehide',()=>{checkpointCopy();cache();if(session?.token&&dirty.size)fetch(new URL('save',apiBase),{method:'PUT',keepalive:true,headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({changes:Object.fromEntries(dirty),baseRevision:revision})}).catch(()=>{})});
addEventListener('mosslight-checkpoint',()=>saveNow());
accountReady.then(()=>{if(credentialNotice){ensureDialog();dialog.querySelector('#account-message').textContent='已自动为你创建账号。请记下上面的账号和密码。'}});
