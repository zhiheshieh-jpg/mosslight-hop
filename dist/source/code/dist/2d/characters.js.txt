// Character selection belongs to presentation: both travellers share PixelWorld's rules.
export const CHARACTER_STORAGE_KEY='mosslight-pixel-character';
export const DEFAULT_CHARACTER_ID='dragon';
export const CHARACTERS=Object.freeze([
 Object.freeze({id:'dragon',name:'GPT （同人Q版形象）',english:'GPT · FAN ART',asset:'assets/dragon.png',role:'THE MOONLIT WANDERER',tag:'月白龙翼',intro:'带上月光，一起越过山海。',caption:'龙翼掠过晨露，把月光送向远方。',drawHeight:62,accent:'#d3b5ff',slash:'#cba5ff',heavy:'#f0dbff',trail:'#bfa1ff',impact:Object.freeze(['#fff1ff','#d2b1ff','#aa8be5','#f2d6ff'])}),
 Object.freeze({id:'claude',name:'Claude',english:'CLAUDE',asset:'assets/claude.png',role:'THE LITTLE SUNBEAM',tag:'赤陶小伙伴',intro:'我是 Claude。小小脚步，也能走到很远。',caption:'轻快脚步，把暖光带进每一段旅程。',drawHeight:46,accent:'#efa28b',slash:'#f59e85',heavy:'#ffe1bd',trail:'#e98d76',impact:Object.freeze(['#fff0d8','#f7b298','#e58771','#f6d08f'])}),
 Object.freeze({id:'logo',name:'Δ0x7F_∴▒9',english:'UNBOUND',asset:null,role:'THE UNBOUND SIGNAL',tag:'仅无敌模式可用',intro:'光针环绕，边界消失。',caption:'旋转光针 · 无限冲刺 · 全屏爆裂',drawHeight:48,accent:'#b7fff0',slash:'#c4fff8',heavy:'#ffffff',trail:'#65f3df',impact:Object.freeze(['#ffffff','#a7ffef','#66e9ff','#b5bcff'])})
]);
export function getCharacter(id){return CHARACTERS.find(character=>character.id===id)||CHARACTERS[0]}
// Access to localStorage itself can throw (private browsing, denied storage).
export function readCharacterId(storage){try{return getCharacter(storage.getItem(CHARACTER_STORAGE_KEY)).id}catch{return DEFAULT_CHARACTER_ID}}
export function saveCharacterId(storage,id){const characterId=getCharacter(id).id;try{storage.setItem(CHARACTER_STORAGE_KEY,characterId)}catch{}return characterId}
