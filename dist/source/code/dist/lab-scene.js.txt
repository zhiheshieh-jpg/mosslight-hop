import * as THREE from 'three';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Material-batched architecture makes the complete laboratory inexpensive to
// render. Its walls, gantries, clean-room glazing and ceiling remain intact.
export function buildLab(world,{stage,scene,hemi,sun,fill}){
 scene.background=new THREE.Color(0x081b29);scene.fog=new THREE.Fog(0x123545,52,155);
 hemi.color.set(0xcafaff);hemi.groundColor.set(0x304861);hemi.intensity=2.3;
 sun.color.set(0xe2faff);sun.intensity=2.7;fill.color.set(0x55b9ff);fill.intensity=1.7;
 const colors={shell:0x809daf,white:0xc6dce1,dark:0x102a39,steel:0x3e647a,cyan:0x65eee6,blue:0x5592e8,amber:0xffbe64};
 const mats=Object.fromEntries(Object.entries(colors).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,metalness:['steel','shell'].includes(k)?.65:.25,roughness:.36,emissive:['cyan','blue','amber'].includes(k)?c:0,emissiveIntensity:['cyan','blue','amber'].includes(k)?.7:0})]));
 const base={box:new THREE.BoxGeometry(1,1,1),cylinder:new THREE.CylinderGeometry(1,1,1,16),ring:new THREE.TorusGeometry(1,.065,8,48),core:new THREE.IcosahedronGeometry(1,1)},buckets=new Map(),dummy=new THREE.Object3D();
 const add=(shape,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();const g=base[shape].index?base[shape].toNonIndexed():base[shape].clone();g.applyMatrix4(dummy.matrix);g.deleteAttribute('uv');if(!buckets.has(color))buckets.set(color,[]);buckets.get(color).push(g)};
 const box=(color,x,y,z,w,h,d)=>add('box',color,x,y,z,w,h,d);
 const span=-world.platforms.at(-1).z;
 for(let i=0;i<=Math.ceil(span/28);i++){
  const z=8-i*28,near=world.platforms.reduce((a,p)=>Math.abs(p.z-z)<Math.abs(a.z-z)?p:a),y=near.y;
  // Continuous clean-room walls and service floor; no rubble or broken pieces.
  box('dark',0,y-9,z,46,.6,28.2);box('dark',0,y+17,z,46,.6,28.2);
  for(const side of [-1,1]){
   const x=side*22;
   box('shell',x,y+4,z,.55,26,28.2);box('steel',x-side*.5,y+4,z-13,.8,26,.65);
   box('cyan',x-side*.92,y+15.7,z,.12,.14,27.5);box('cyan',x-side*.9,y-5.8,z,.12,.12,27.5);
   // Side galleries, server racks and observation windows flank the test route.
   box('shell',side*15,y-3.4,z,12,.55,26);box('steel',side*9.1,y-2.3,z,.12,1.8,26);
   box('cyan',side*9.1,y-1.35,z,.15,.06,26);
   for(const off of [-8,0,8]){
    box('steel',side*18,y,z+off,3.8,6.2,4.8);box('dark',side*15.99,y+.3,z+off,.08,4.8,4.25);
    for(let k=0;k<5;k++){box('blue',side*15.9,y-1.55+k*.85,z+off,.05,.06,3.3);box('cyan',side*15.87,y-1.55+k*.85,z+off+1.8,.06,.2,.12)}
   }
   // Upright containment chambers sit on complete circular research plinths.
   add('cylinder','white',side*11.6,y-2.8,z+7,1.7,.7,1.7);
   add('cylinder','blue',side*11.6,y-.8,z+7,1.06,3.1,1.06);
   for(const dy of [-2.4,.8])add('ring','cyan',side*11.6,y+dy,z+7,1.3,1.3,1.3,Math.PI/2);
   add('core','cyan',side*11.6,y-.65,z+7,.65,1.2,.65,0,i*.4);
  }
  // Overhead service gantries emphasize the sealed, functioning laboratory.
  box('white',0,y+13.8,z-11,44,.5,.8);box('cyan',0,y+13.48,z-10.98,40,.08,.85);
  for(const side of [-1,1]){box('steel',side*7,y+15.3,z,1.1,1,28.1);box('blue',side*7,y+14.74,z,.42,.07,27.8)}
  if(i%2===0){add('ring','steel',0,y+5,z-5,10,10,10);add('ring','cyan',0,y+5,z-5,9.65,9.65,9.65)}
 }
 const end=world.platforms.at(-1);
 box('white',0,end.y+3,end.z-11,44,26,.7);box('dark',0,end.y+5,end.z-10.5,15,14,.5);
 add('ring','steel',0,end.y+6,end.z-9.9,6,6,6);add('ring','cyan',0,end.y+6,end.z-9.7,5.5,5.5,5.5);
 add('core','blue',0,end.y+6,end.z-8,2.8,2.8,2.8,0,.5);add('core','cyan',0,end.y+6,end.z-7.7,1.75,1.75,1.75,0,-.4);
 const root=new THREE.Group();root.name='Intact Singularity Research Laboratory';
 for(const [color,parts] of buckets){const g=mergeGeometries(parts,false),m=new THREE.Mesh(g,mats[color]);m.castShadow=false;m.receiveShadow=true;root.add(m);for(const p of parts)p.dispose()}stage.add(root);for(const g of Object.values(base))g.dispose();
 return root;
}

export function decorateLabPlatform(g,p,{box,mesh,geo,mat,basic}){
 const cyan=basic(p.kind==='crumble'?0xffc080:0x73fff1),steel=mat(0x35586b,{metalness:.75,roughness:.32});
 box(steel,0,-.74,0,p.w*.9,.22,p.d*.9,g);
 for(const x of [-p.w/2+.06,p.w/2-.06])box(cyan,x,.024,0,.09,.045,p.d-.12,g);
 for(const z of [-p.d/2+.06,p.d/2-.06])box(cyan,0,.024,z,p.w-.12,.045,.09,g);
 const ring=mesh(new THREE.RingGeometry(.62,.68,32),cyan,0,.029,0,1,1,1,g);ring.rotation.x=-Math.PI/2;
 for(const x of [-p.w*.33,p.w*.33])box(steel,x,.026,0,.035,.04,p.d*.67,g);
 // Merge the stationary inlays within this deck; moving decks still carry the
 // complete local group and animated trap meshes remain independent below.
 const batches=new Map();
 for(const child of [...g.children]){
  if(!child.isMesh||child===g.userData.slab)continue;
  child.updateMatrix();const piece=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();piece.applyMatrix4(child.matrix);piece.deleteAttribute('uv');
  if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(piece);g.remove(child);
 }
 ring.geometry.dispose();
 for(const [material,pieces] of batches){const geometry=mergeGeometries(pieces,false),item=new THREE.Mesh(geometry,material);item.receiveShadow=true;g.add(item);for(const piece of pieces)piece.dispose()}
 if(p.kind==='laser'){
  for(const x of [-p.w/2,p.w/2])box(steel,x,.65,0,.22,1.3,.26,g);
  g.userData.laser=[box(basic(0xff386c),0,.65,0,p.w,.085,.1,g),box(basic(0xff396f,{transparent:true,opacity:.18,depthWrite:false}),0,.65,0,p.w,.5,.2,g)];
 }
 if(p.kind==='rotating'){const arrow=mesh(geo.cone,cyan,.9,.13,0,.16,.4,.16,g);arrow.rotation.x=(p.direction||1)*Math.PI/2}
}
