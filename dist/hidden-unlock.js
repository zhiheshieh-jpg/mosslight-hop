export const SECRET_KEY='mosslight-secret-god-unlocked';
const CHORD=['KeyM','KeyA','KeyN'];
export function hasHiddenUnlock(storage){try{return JSON.parse(storage?.getItem(SECRET_KEY)||'null')===true}catch{return false}}
export function grantHiddenUnlock(storage){try{if(!storage)return false;storage.setItem(SECRET_KEY,'true');return hasHiddenUnlock(storage)}catch{return false}}
const editing=target=>!!target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog[open],[role="dialog"][aria-modal="true"]');

// Tracks held physical keys; a typed sequence is deliberately insufficient.
export class UnlockChord{
 constructor({open=()=>{},singleM=()=>{}}={}){this.open=open;this.singleM=singleM;this.down=new Set;this.latched=false;this.mPending=false;this.consumed=false}
 keydown(e,{blocked=false}={}){
  if(e.ctrlKey||e.altKey||e.metaKey){this.clear();return false}
  if(blocked||!CHORD.includes(e.code))return false;
  if(e.repeat)return false;
  this.down.add(e.code);if(e.code==='KeyM')this.mPending=true;
  if(!this.latched&&CHORD.every(key=>this.down.has(key))){this.latched=true;this.consumed=true;this.mPending=false;this.open();return true}
  return false;
 }
 keyup(e,{blocked=false}={}){
  const mute=e.code==='KeyM'&&this.mPending&&!this.consumed&&!blocked&&!e.ctrlKey&&!e.altKey&&!e.metaKey;
  this.down.delete(e.code);if(e.code==='KeyM')this.mPending=false;
  if(!this.down.size){this.latched=false;this.consumed=false}
  if(mute)this.singleM();
 }
 clear(){this.down.clear();this.latched=false;this.mPending=false;this.consumed=false}
}

export class HiddenUnlockInput{
 constructor({onOpen=()=>{},onUnlock=()=>true,onSingleM=()=>{},document:doc=globalThis.document}={}){
  this.doc=doc;this.onOpen=onOpen;this.onUnlock=onUnlock;this.dialog=null;
  this.chord=new UnlockChord({open:()=>this.show(),singleM:onSingleM});if(!doc)return;
  const style=doc.createElement('style');style.textContent='#unlock-input-dialog{padding:18px;border:1px solid #9dbfaf77;border-radius:12px;background:#142f37;color:#f2f5e5;width:min(360px,calc(100vw - 40px));box-sizing:border-box;box-shadow:0 14px 70px #0006}#unlock-input-dialog::backdrop{background:#071c2bcc}#unlock-input-dialog form{display:flex;align-items:center;gap:9px;margin:0}#unlock-input-dialog input{box-sizing:border-box;min-width:0;width:100%;background:#071f29;border:1px solid #b0cbb55c;border-radius:6px;color:#f2f5e5;padding:11px;font:16px system-ui;outline-offset:2px}#unlock-input-dialog button{flex:none;border:0;background:transparent;color:#d5e4c7;cursor:pointer;padding:5px;font:20px system-ui}#unlock-input-dialog :focus-visible{outline:2px solid #c8dcae}';doc.head.append(style);this.style=style;
  const dialog=doc.createElement('dialog');dialog.id='unlock-input-dialog';dialog.setAttribute('aria-label','输入');dialog.innerHTML='<form><input type="text" aria-label="输入" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128"><button type="submit" aria-label="确认">↵</button><button type="button" aria-label="关闭">×</button></form>';doc.body.append(dialog);this.dialog=dialog;this.input=dialog.querySelector('input');
  dialog.querySelector('form').onsubmit=e=>{e.preventDefault();if(this.input.value!=='What can I say')return;try{if(this.onUnlock()!==false)this.close()}catch{}};
  dialog.querySelector('[type="button"]').onclick=()=>this.close();dialog.oncancel=e=>{e.preventDefault();this.close()};
  this.keydown=e=>{
   if(dialog.open){e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();this.close()}return}
   if(this.chord.keydown(e,{blocked:editing(e.target)})){e.preventDefault();e.stopImmediatePropagation()}
  };
  this.keyup=e=>{const open=dialog.open;this.chord.keyup(e,{blocked:open||editing(e.target)});if(open)e.stopImmediatePropagation()};
  this.blur=()=>this.chord.clear();this.visibility=()=>{if(doc.hidden)this.chord.clear()};
  doc.defaultView.addEventListener('keydown',this.keydown,true);doc.defaultView.addEventListener('keyup',this.keyup,true);doc.defaultView.addEventListener('blur',this.blur);doc.addEventListener('visibilitychange',this.visibility);
 }
 show(){if(!this.dialog||this.dialog.open)return;this.previousFocus=this.doc.activeElement;this.onOpen();this.input.value='';this.dialog.showModal();this.input.focus()}
 close(){if(!this.dialog?.open)return;this.dialog.close();this.input.value='';if(this.previousFocus?.isConnected)this.previousFocus.focus()}
 destroy(){this.chord.clear();this.doc?.defaultView?.removeEventListener('keydown',this.keydown,true);this.doc?.defaultView?.removeEventListener('keyup',this.keyup,true);this.doc?.defaultView?.removeEventListener('blur',this.blur);this.doc?.removeEventListener('visibilitychange',this.visibility);this.dialog?.remove();this.style?.remove()}
}
