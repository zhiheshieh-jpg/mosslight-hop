import {PixelWorld} from '../dist/2d/world.js';import {pixelDriver} from './pixel-driver.mjs';
const out=[];
for(const level of [0,1]){const w=new PixelWorld(level),drive=pixelDriver();let furthest=0,checkpoints=[];
 for(let i=0;i<120*1200&&!w.complete;i++){w.step(1/120,drive(w));furthest=Math.max(furthest,w.player.x);for(const e of w.drain())if(e.type==='checkpoint')checkpoints.push(e.id)}
 const s=w.snapshot();out.push({level,complete:s.complete,length:s.length,time:+s.time.toFixed(2),deaths:s.deaths,kills:s.kills,enemies:s.enemies,checkpoint:s.checkpoint,checkpoints,furthest:Math.round(furthest),bossHp:s.boss.hp,player:s.player});
}
console.log(JSON.stringify(out,null,2));if(out.some(r=>!r.complete))process.exitCode=1;
