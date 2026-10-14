// Jump height and gravity stay compatible with the four ordinary routes.
const profile=value=>Object.freeze({...value,damage:Object.freeze(value.damage),reach:Object.freeze(value.reach),duration:Object.freeze(value.duration),cooldown:Object.freeze(value.cooldown)});
export const COMBAT_PROFILES=Object.freeze({
 dragon:profile({speed:250,jump:535,airJump:465,gravity:1480,dashSpeed:750,dashTime:.16,dashCooldown:.62,damage:[2,2,4],reach:[76,82,104],duration:[.26,.26,.34],cooldown:[.27,.27,.4],knockback:1,skill:'moonwave',skillName:'月翼连斩 · 月牙刃',summary:'灵巧月刃 · 终结技贯穿两名敌人',stats:'移速 250 · 连斩 2 / 2 / 4 · 冲刺冷却 0.62 秒'}),
 claude:profile({speed:250,jump:535,airJump:465,gravity:1480,dashSpeed:750,dashTime:.16,dashCooldown:.7,damage:[3,3,6],reach:[76,82,110],duration:[.3,.3,.38],cooldown:[.33,.33,.48],knockback:1.3,skill:'shockwave',skillName:'赤焰重击 · 地面震波',summary:'沉稳重击 · 终结技双侧冲击与强击退',stats:'移速 250 · 连斩 3 / 3 / 6 · 冲刺冷却 0.70 秒'})
});
export const combatProfile=id=>COMBAT_PROFILES[id]||COMBAT_PROFILES.dragon;
