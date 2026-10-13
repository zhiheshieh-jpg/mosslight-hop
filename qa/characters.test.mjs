import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,CHARACTER_STORAGE_KEY,getCharacter,readCharacterId,saveCharacterId} from '../dist/2d/characters.js';
import {measureAtlas} from '../dist/2d/sprite-atlas.js';

test('only supported travellers and the gated logo can survive saved selection',()=>{
 assert.deepEqual(CHARACTERS.map(c=>c.id),['dragon','claude','logo']);
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 assert.equal(readCharacterId(storage),'dragon');
 for(const id of ['claude','dragon','logo']){saveCharacterId(storage,id);assert.equal(values.get(CHARACTER_STORAGE_KEY),id);assert.equal(readCharacterId(storage),id)}
 for(const invalid of ['retired-character','__proto__','constructor','',null,{},3]){
  values.set(CHARACTER_STORAGE_KEY,invalid);assert.equal(readCharacterId(storage),'dragon');
  assert.equal(saveCharacterId(storage,invalid),'dragon');assert.equal(values.get(CHARACTER_STORAGE_KEY),'dragon');
 }
 assert.equal(getCharacter('claude').name,'Claude');
 assert.equal(getCharacter('dragon').name,'GPT （同人Q版形象）');
 assert.equal(getCharacter('logo').asset,null);
});

test('denied reads and quota failures do not block session selection',()=>{
 const blocked={getItem(){throw new Error('Denied')},setItem(){throw new Error('Quota exceeded')}};
 assert.equal(readCharacterId(blocked),'dragon');
 assert.equal(saveCharacterId(blocked,'claude'),'claude');
 assert.equal(readCharacterId(null),'dragon');
 assert.equal(saveCharacterId(null,'claude'),'claude');
});

function atlas(body){
 const width=128,height=64,pixels=new Uint8ClampedArray(width*height*4);
 for(let frame=0;frame<8;frame++){
  const sx=frame%4*32,sy=Math.floor(frame/4)*32;
  for(let y=body.y;y<body.y+body.h;y++)for(let x=body.x;x<body.x+body.w;x++)pixels[((sy+y)*width+sx+x)*4+3]=255;
  // A slash from the previous cell can touch the boundary, below the real feet.
  pixels[((sy+31)*width+sx)*4+3]=255;
 }
 return {width,height,pixels};
}

test('atlases keep independent body bounds and ignore neighbouring edge slashes',()=>{
 const tall=atlas({x:9,y:7,w:14,h:17}),wide=atlas({x:6,y:15,w:20,h:13});
 const a=measureAtlas(tall.pixels,tall.width,tall.height,{edgeInset:1});
 const b=measureAtlas(wide.pixels,wide.width,wide.height,{edgeInset:1});
 assert.equal(a.length,8);assert.equal(b.length,8);
 for(let i=0;i<8;i++){
  assert.equal(a[i].sx,i%4*32+1);assert.equal(a[i].sy,Math.floor(i/4)*32);assert.equal(a[i].sw,30);
  assert.deepEqual(a[i].bounds,{minX:8,maxX:21,minY:7,maxY:23});
  assert.deepEqual(b[i].bounds,{minX:5,maxX:24,minY:15,maxY:27});
  assert.equal(a[i].ax,14.5);assert.equal(a[i].ay,24);assert.equal(b[i].ay,28);
 }
});

test('incomplete or empty atlases fail before starting the game',()=>{
 assert.throws(()=>measureAtlas(new Uint8ClampedArray(128*64*4),128,64),/第 1 帧为空/);
 assert.throws(()=>measureAtlas(new Uint8ClampedArray(12),127,64),/4 × 2/);
 const source=atlas({x:9,y:7,w:14,h:17});
 assert.throws(()=>measureAtlas(source.pixels,128,64,{edgeInset:16}),/边距无效/);
});
