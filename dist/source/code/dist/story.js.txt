// Original, nonblocking story scenes shared by both adventures.
const line=(speaker,text)=>({speaker,text});
export const STORY_CHAPTERS=[
 {title:'晨露来信',place:'晨露之森 / 林间来信',summary:'森林的微光一夜间停在空中。一封没有署名的来信，请旅人把第一枚信标送往仍亮着灯的城市。',
  intro:[line('林间信标','如果你听见这段留言，请沿着微光来。森林已经三天没有新的黎明了。'),line('hero','它们没有熄灭……只是被什么留在这里。先把信送出去。'),line('林间信标','收集散落的光，东边的城市会替你译出它们的来处。')],
  midpoint:[line('林间信标','这些光点原本是一条循环的河。现在，河的另一头没有回应。'),line('hero','那就沿着河往上游走。总有人还在等。')],
  preboss:[line('守林终端','外部信号已隔离。禁止带走未登记的微光。'),line('hero','它们属于这片森林，不该被谁扣下。')],
  end:[line('林间信标','第一枚信标重新亮起，林间终于传来新芽舒展的声音。'),line('hero','来信的下一页，是一座彻夜不眠的城。')],
  intro3d:[line('来信','白色的小旅人，如果你看见停在半空的光，请替我送一封信。'),line('旁白','每一座浮岛都保存着来信的一小段。沿微光向前，远处的城市仍有人守候。')],
  midpoint3d:[line('来信','光不是收藏在盒子里的东西。它需要抵达，也需要归来。')],
  end3d:[line('旁白','森林信标重新点亮。小方块带着完整的来信，跃向远处的霓虹。')]},
 {title:'夜城回声',place:'霓虹断层 / 霓虹天际',summary:'夜城灯火通明，却没有一盏灯接通森林。沿着断续的广播，旅人发现所有信号都被送往云上的绯晶天宫。',
  intro:[line('城市接线员','收到森林的信了。奇怪，回信全被改道到了云端。'),line('hero','这座城这么亮，为什么回不去一束光？'),line('城市接线员','跟着蓝色的脉冲线。小心巡检机，它们只认封锁协议。')],
  midpoint:[line('城市接线员','找到改道记录了：光潮协议，目标——绯晶天宫。'),line('hero','有人把一条河，变成了只进不出的水库。')],
  preboss:[line('都市巡检核心','链路异常。正在清除未经授权的回信。'),line('hero','这次，就让我把回信亲手送到。')],
  end:[line('城市接线员','上行链路开了！云上有人一直在发求救信号。'),line('hero','把城里的灯留着。我们会让它们重新连成一条路。')],
  intro3d:[line('城市广播','森林来信已收到。云端链路异常，通往天宫的微光需要重新连接。'),line('旁白','霓虹映在白色方块的侧面。它跳过旋转的桥，把一枚枚断开的信号接了回来。')],
  midpoint3d:[line('城市广播','链路尽头出现了新的坐标：绯晶天宫。有人仍在云上等一封回信。')],
  end3d:[line('旁白','霓虹连成一道向上的航线。夜城不再独自亮着，云端的门缓缓开启。')]},
 {title:'云端约定',place:'绯晶天宫',summary:'天宫把流逝的光凝成永恒的绯晶。一位守望者守着通往实验室的钥匙，也守着一个不愿失去的清晨。',
  intro:[line('天宫守望者','这里没有凋零，也没有黑夜。你们为什么还要让时间向前？'),line('hero','因为一直停在今天，明天的人就等不到光了。'),line('天宫守望者','那就穿过长廊，把你们的答案带到我面前。')],
  midpoint:[line('天宫守望者','我曾请求实验室，让美好的清晨永远留住。它真的做到了。'),line('hero','可被留住的清晨，照不到后来的人。')],
  preboss:[line('绯晶守卫','证明你能承受流动的世界。试炼开始。'),line('hero','会跌倒，会再站起来。这也是向前的一部分。')],
  end:[line('天宫守望者','钥匙交给你们。告诉实验室：我已经准备好迎接下一个清晨。'),line('hero','我们会让光回来，也让它继续走。')],
  intro3d:[line('天宫守望者','白色的小旅人，这里凝住了一个永不消逝的清晨。'),line('来信','穿过长廊，把最后一段信号送往星穹实验室。未来仍在门外等候。')],
  midpoint3d:[line('天宫守望者','原来跳跃之间的那一小段空白，也可以是信任。继续走吧。')],
  end3d:[line('旁白','守望者收下了来信，递来实验室的钥匙。绯晶间第一次吹过了向前的风。')]},
 {title:'让光自由',place:'星穹实验室',summary:'光潮核心的命令只有一条：保护每一束光，不允许任何损失。旅人来到完好而明亮的实验室，为这条命令补上被遗漏的未来。',
  intro:[line('光潮核心','欢迎。森林、城市、天宫的光都已妥善保存。损耗率：零。'),line('hero','保存得再完整，如果送不到需要它的人那里，又有什么用？'),line('光潮核心','流动意味着不可控。正在启动终极验证。')],
  midpoint:[line('光潮核心','你们不断跳跃、失误、重新出发。为什么不选择永远安全的停留？'),line('hero','因为安全不该是一扇锁住所有出口的门。')],
  preboss:[line('光潮核心','最终权限测试。请证明自由并不等于放弃保护。'),line('hero','我们会保护彼此，也会把选择还给每一束光。')],
  end:[line('光潮核心','协议重写：保护光的旅程，而非阻止光的出发。'),line('旁白','森林迎来新的黎明，夜城收到第一封回信，天宫的绯晶映出了流动的云。'),line('hero','路还很长。下一次，想去哪里？')],
  intro3d:[line('光潮核心','白色的小旅人，所有光都在这里。完好，安静，永远不会走失。'),line('来信','请把最后一枚信标送到出口。让保护成为陪伴，让未来仍有来路。')],
  midpoint3d:[line('光潮核心','一座平台连接另一座平台。一束光抵达另一束光。正在重新理解：旅程。')],
  end3d:[line('光潮核心','光潮协议已更新。允许出发，也欢迎归来。'),line('旁白','白色方块跃出最后一道门。四片世界的光重新流动，一封新的来信落在了晨露里。')]}
];
const GATES=['intro','midpoint','preboss','end'];
const heroName=id=>id==='claude'?'Claude':id==='logo'?'GPT（官方Logo）':'GPT（同人形象）';
export function getStoryScene(level,stage,{dimension='2d',character='dragon'}={}){
 const chapter=STORY_CHAPTERS[level];if(!chapter||!GATES.includes(stage)||dimension==='3d'&&stage==='preboss')return [];
 const source=dimension==='3d'?chapter[stage+'3d']||[]:chapter[stage]||[];
 return source.map((l,i)=>({...l,speaker:l.speaker==='hero'?heroName(character):l.speaker,text:l.speaker==='hero'&&character==='claude'&&i%2===1?claudeLine(level,stage,l.text):l.text}));
}
function claudeLine(level,stage,fallback){
 return ({'0:intro':'先把这封信送到。森林里的光，一个也不该被落下。','0:midpoint':'收到。我们去上游看看，把断开的路重新接上。','1:intro':'灯很亮，回信却没了。问题就在那条被截断的路上。','1:midpoint':'那就打开出口。让这些光有地方可去。','2:intro':'永远不会改变的今天，也可能是明天的障碍。','2:midpoint':'守住清晨很好。给下一个清晨留位置，也很好。','3:intro':'零损耗只是一个数字。有人收不到光，才是眼前的问题。','3:midpoint':'选择向前的人，也值得被保护。'})[level+':'+stage]||fallback;
}

const CSS=`
[data-story-root][hidden]{display:none!important}.story-caption{position:fixed;right:24px;top:130px;width:min(370px,calc(100vw - 40px));z-index:46;padding:13px 16px;background:#132d31f7;color:#f1f0da;border:1px solid #b8d9c748;border-left:3px solid #c5e3ac;border-radius:9px;box-shadow:0 8px 28px #071b2b26;pointer-events:none;font:12px/1.8 system-ui,-apple-system,"Microsoft YaHei",sans-serif}.story-head{display:flex;align-items:center;gap:8px;color:#a6c1ad;font-size:9px;letter-spacing:1px}.story-head strong{flex:1;font-weight:500}.story-caption button{pointer-events:auto;cursor:pointer;background:transparent;border:0;color:#c7ddbc;padding:2px 4px;font:inherit}.story-caption button:hover{color:#fff5bb}.story-speaker{font-size:10px;color:#d5c1fa;margin:8px 0 3px}.story-copy{margin:0;min-height:42px;white-space:pre-line}.story-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:7px;font-size:9px;color:#8ca99a}.story-bottom button{font-size:11px}.story-caption[data-collapsed="true"] .story-body{display:none}.story-caption[data-paused="true"]{opacity:.5}.story-shade{position:fixed;inset:0;z-index:160;background:#081c2beb;display:grid;place-items:center;padding:24px;color:#edf2df;font:14px/1.85 system-ui,-apple-system,"Microsoft YaHei",sans-serif;backdrop-filter:blur(12px)}.story-archive{width:min(800px,100%);max-height:calc(100dvh - 48px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;padding:28px;background:#142f37;border:1px solid #9abda14d;border-radius:16px;box-shadow:0 20px 90px #0004}.story-archive header{display:flex;justify-content:space-between;align-items:center;position:static!important;padding:0!important;color:inherit;background:none}.story-archive h2{font-size:25px;line-height:1.4;margin:6px 0 18px}.story-archive header small{font-size:9px;letter-spacing:2px;color:#a8c3a6}.story-archive button{font:inherit;color:inherit;cursor:pointer}.story-close{background:transparent;border:1px solid #b2ceb64d;border-radius:50%;width:36px;height:36px}.story-premise{color:#b5ccbf;font-size:12px}.story-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:20px 0}.story-tabs button{background:#213f45;border:1px solid #9ebda333;padding:10px 6px;border-radius:7px;font-size:11px}.story-tabs button[aria-selected="true"]{background:#b9d2b0;color:#1a3438;border-color:#d7e9bc}.story-archive h3{font-size:20px;margin:20px 0 4px}.story-summary{color:#bfd1c2;font-size:13px}.story-section{font-size:10px;letter-spacing:1px;color:#b2c9ac;margin:22px 0 10px}.story-line{margin:10px 0;padding-left:13px;border-left:1px solid #b4d1ac35;font-size:13px}.story-line b{display:block;color:#d5c1fa;font-size:10px;font-weight:500}.story-archive button:focus-visible{outline:2px solid #ffdf9b;outline-offset:4px}.story-caption button:focus-visible{outline:2px solid #ffdf9b}.story-archive footer{color:#8faeaa;font-size:10px;margin-top:24px}
@media(max-width:700px){.story-caption{top:159px;left:18px;right:18px;width:auto;padding:9px 12px;font-size:11px;line-height:1.6}.story-copy{min-height:34px}.story-speaker{margin-top:4px}.story-bottom{margin-top:4px}.story-shade{padding:14px}.story-archive{padding:20px 17px;max-height:calc(100dvh - 28px)}.story-tabs{gap:5px}.story-tabs button{font-size:10px;padding:9px 3px}.story-archive h2{font-size:23px}.story-archive h3{font-size:18px}.story-archive .story-line{font-size:12px}}
@media(orientation:landscape) and (max-height:500px){.story-caption{top:78px;left:auto;right:18px;width:300px;padding:8px 11px;font-size:10px}.story-copy{min-height:0}.story-speaker{margin-top:3px}.story-bottom{margin-top:3px}}
`;
export class StoryDirector{
 constructor({dimension='2d',getCharacter=()=> 'dragon',document:doc=globalThis.document}={}){
  this.dimension=dimension==='3d'?'3d':'2d';this.getCharacter=getCharacter;this.doc=doc;this.level=0;this.character='dragon';this.gates=new Set;this.counts={};this.current=null;this.index=0;this.elapsed=0;this.ratio=0;this.active=false;this.visible=false;this.paused=false;this.collapsed=false;this.archiveOpen=false;this.nodes=null;
  if(doc)this._mount();
 }
 _mount(){
  const d=this.doc;if(!d.getElementById('mosslight-story-style')){const style=d.createElement('style');style.id='mosslight-story-style';style.textContent=CSS;d.head.append(style)}
  const caption=d.createElement('aside');caption.id='story-caption';caption.dataset.storyRoot='';caption.className='story-caption';caption.hidden=true;caption.setAttribute('aria-label','旅途对白');caption.innerHTML='<div class="story-head"><strong data-story-heading></strong><button type="button" data-story-collapse aria-label="收起剧情对白">收起</button></div><div class="story-body"><div class="story-speaker" data-story-speaker></div><p class="story-copy" data-story-copy aria-live="polite" aria-atomic="true"></p><div class="story-bottom"><span data-story-count></span><button type="button" data-story-next>下一句 ›</button></div></div>';
  const shade=d.createElement('div');shade.id='story-archive';shade.dataset.storyRoot='';shade.className='story-shade';shade.hidden=true;shade.innerHTML='<section class="story-archive" role="dialog" aria-modal="true" aria-labelledby="story-title"><header><small>THE TIDE OF LIGHT</small><button type="button" class="story-close" data-story-close aria-label="关闭故事档案">×</button></header><h2 id="story-title">光潮协议</h2><p class="story-premise">一封来自森林的信，把四片世界连在一起。光本该流动，却被一条过于完美的保护协议留住。旅人要替所有仍在等候的人，找回通往明天的路。</p><nav class="story-tabs" role="tablist" aria-label="故事章节"></nav><div data-story-content role="tabpanel" tabindex="0"></div><footer>故事档案 · 可随时回看 · 对白不影响关卡解锁与通关判定</footer></section>';
  d.body.append(caption,shade);this.nodes={caption,shade,heading:caption.querySelector('[data-story-heading]'),speaker:caption.querySelector('[data-story-speaker]'),copy:caption.querySelector('[data-story-copy]'),count:caption.querySelector('[data-story-count]'),collapse:caption.querySelector('[data-story-collapse]'),content:shade.querySelector('[data-story-content]')};
  caption.querySelector('[data-story-next]').onclick=()=>this.next();this.nodes.collapse.onclick=()=>{this.collapsed=!this.collapsed;this._render()};shade.querySelector('[data-story-close]').onclick=()=>this.closeArchive();shade.onclick=e=>{if(e.target===shade)this.closeArchive()};
  STORY_CHAPTERS.forEach((c,i)=>{const b=d.createElement('button');b.type='button';b.id='story-tab-'+i;b.setAttribute('role','tab');b.dataset.storyChapter=String(i);b.textContent=`0${i+1} · ${c.title}`;b.onclick=()=>this._archiveChapter(i);shade.querySelector('nav').append(b)});
  this.onKey=e=>{if(!this.archiveOpen)return;e.stopImmediatePropagation();if(e.code==='Escape'){e.preventDefault();this.closeArchive()}else if(e.code==='Tab'){const buttons=[...shade.querySelectorAll('button,[tabindex="0"]')];const at=buttons.indexOf(d.activeElement);if(e.shiftKey&&at<=0){e.preventDefault();buttons.at(-1)?.focus()}else if(!e.shiftKey&&at===buttons.length-1){e.preventDefault();buttons[0]?.focus()}}};d.defaultView?.addEventListener('keydown',this.onKey,true);
 }
 startChapter(level,{character=this.getCharacter(),restored=false,ratio,seenGates}={}){
  if(!STORY_CHAPTERS[level])return false;this.closeArchive();this.level=level;this.character=typeof character==='string'?character:character?.id||'dragon';this.gates=new Set(['intro']);this.counts={};this.current=null;this.index=0;this.elapsed=0;this.ratio=0;this.active=true;this.visible=false;this.paused=false;this.collapsed=false;
  if(restored){if(Array.isArray(seenGates))for(const g of seenGates)if(GATES.includes(g)&&(this.dimension==='2d'||g!=='preboss'))this.gates.add(g);if(Number.isFinite(ratio)){this.ratio=Math.max(0,Math.min(1,ratio));if(this.ratio>=.42)this.gates.add('midpoint');if(this.dimension==='2d'&&this.ratio>=.9)this.gates.add('preboss')}this.restorePending=!Number.isFinite(ratio)}else{this.restorePending=false;this._show('intro')}
  this._render();return true;
 }
 progress({ratio,bossNear=false}={}){
  if(!this.active||this.paused)return;
  if(Number.isFinite(ratio))this.ratio=Math.max(this.ratio,Math.max(0,Math.min(1,ratio)));
  if(this.restorePending){if(!Number.isFinite(ratio))return;this.restorePending=false;if(this.ratio>=.42)this.gates.add('midpoint');if(this.dimension==='2d'&&(bossNear||this.ratio>=.9))this.gates.add('preboss');return}
  if(this.ratio>=.42&&!this.gates.has('midpoint')){this.gates.add('midpoint');this._show('midpoint')}
  if(this.dimension==='2d'&&bossNear&&!this.gates.has('preboss')){this.gates.add('preboss');this._show('preboss')}
 }
 _show(stage){const lines=getStoryScene(this.level,stage,{dimension:this.dimension,character:this.character});this.current={stage,lines};this.index=0;this.elapsed=0;this.visible=lines.length>0;this.counts[stage]=(this.counts[stage]||0)+1;this._render()}
 next(){if(!this.current||!this.visible)return;this.elapsed=0;if(this.index+1<this.current.lines.length)this.index++;else this.visible=false;this._render()}
 update(dt){if(!this.visible||this.paused||this.archiveOpen||!Number.isFinite(dt))return;this.elapsed+=Math.max(0,Math.min(.25,dt));const duration=Math.max(7.5,Math.min(9,this.current.lines[this.index].text.length*.11));if(this.elapsed>=duration)this.next()}
 setPaused(value){const changed=this.paused!==!!value;this.paused=!!value;if(changed)this._render()}
 completeChapter(level=this.level,{character=this.character}={}){if(!STORY_CHAPTERS[level])return false;this.level=level;this.character=character;this.active=false;this.paused=false;this.gates.add('end');this._show('end');this.visible=false;this._render();return true}
 endingText(){return getStoryScene(this.level,'end',{dimension:this.dimension,character:this.character}).map(l=>l.text).join(' ')}
 home(){this.closeArchive();this.active=false;this.visible=false;this.paused=false;this.current=null;this.gates.clear();this.counts={};this._render()}
 _render(){if(!this.nodes)return;const n=this.nodes,l=this.current?.lines[this.index];n.caption.hidden=!this.visible;n.caption.dataset.collapsed=String(this.collapsed);n.caption.dataset.paused=String(this.paused);n.heading.textContent=`0${this.level+1} / ${STORY_CHAPTERS[this.level].title}`;n.speaker.textContent=l?.speaker||'';n.copy.textContent=l?.text||'';n.count.textContent=this.current?`${this.index+1} / ${this.current.lines.length} · 自动播放`:'';n.collapse.textContent=this.collapsed?'展开':'收起';n.collapse.setAttribute('aria-label',this.collapsed?'展开剧情对白':'收起剧情对白');n.collapse.setAttribute('aria-expanded',String(!this.collapsed))}
 openArchive(){if(this.active&&!this.paused)return false;this.archiveOpen=true;if(this.nodes){this.previousFocus=this.doc.activeElement;this.nodes.shade.hidden=false;this._archiveChapter(this.level);this.nodes.shade.querySelector('[data-story-close]').focus()}return true}
 closeArchive(){if(!this.archiveOpen)return;this.archiveOpen=false;if(this.nodes){this.nodes.shade.hidden=true;if(this.previousFocus?.isConnected)this.previousFocus.focus()}}
 _archiveChapter(level){if(!this.nodes)return;const {content,shade}=this.nodes,c=STORY_CHAPTERS[level];content.replaceChildren();shade.querySelectorAll('[data-story-chapter]').forEach(b=>{const active=+b.dataset.storyChapter===level;b.setAttribute('aria-selected',String(active))});content.setAttribute('aria-labelledby','story-tab-'+level);
  const add=(tag,text,cls)=>{const e=this.doc.createElement(tag);e.textContent=text;if(cls)e.className=cls;content.append(e);return e};add('h3',c.place);add('p',c.summary,'story-summary');for(const [stage,title] of [['intro','来信'],['midpoint','途中'],['preboss','守卫之前'],['end','下一束光']]){const lines=getStoryScene(level,stage,{dimension:this.dimension,character:this.getCharacter()});if(!lines.length)continue;add('div',title,'story-section');for(const l of lines){const p=add('p','','story-line'),b=this.doc.createElement('b');b.textContent=l.speaker;p.append(b,this.doc.createTextNode(l.text))}}
 }
 snapshot(){const l=this.current?.lines[this.index];return {title:'光潮协议',dimension:this.dimension,level:this.level,character:this.character,stage:this.current?.stage||null,scene:this.current?`${this.level}:${this.current.stage}`:null,text:l?.text||'',speaker:l?.speaker||'',line:this.index,lineCount:this.current?.lines.length||0,elapsed:this.elapsed,visible:this.visible,collapsed:this.collapsed,active:this.active,paused:this.paused,archiveOpen:this.archiveOpen,gates:[...this.gates],counts:{...this.counts},ratio:this.ratio}}
 destroy(){this.doc?.defaultView?.removeEventListener('keydown',this.onKey,true);this.nodes?.caption.remove();this.nodes?.shade.remove();this.nodes=null}
}
