import * as THREE from 'three';
import {mergeGeometries} from './vendor/utils/BufferGeometryUtils.js';

// Intact palace architecture repeated along the whole ascent, merged by material.
export function buildPalace(world,{stage,scene,hemi,sun,fill}){
 scene.fog=new THREE.Fog(0xf6d9dc,95,235);scene.background=new THREE.Color(0xf3dbed);
 hemi.color.set(0xfff1f5);hemi.groundColor.set(0xb387c5);hemi.intensity=2.15;
 sun.color.set(0xffe7bb);sun.intensity=3.4;fill.color.set(0xd4b8f5);fill.intensity=1.2;
 const palette={ivory:0xfff0df,white:0xfffaf0,gold:0xd9a851,rose:0xd178a7,pink:0xffb8d3,dark:0xb86a96,leaf:0x9fc9ac,water:0xafe2dd,cloud:0xffedf2};
 const materials=Object.fromEntries(Object.entries(palette).map(([k,c])=>[k,new THREE.MeshStandardMaterial({color:c,roughness:k==='gold'?.3:k==='water'?.2:.7,metalness:k==='gold'?.65:.08,emissive:k==='pink'?0xf895bd:0x000000,emissiveIntensity:.15})]));
 const geometries={box:new THREE.BoxGeometry(1,1,1),ball:new THREE.IcosahedronGeometry(1,2),cylinder:new THREE.CylinderGeometry(1,1,1,12),cone:new THREE.ConeGeometry(1,1,8),crystal:new THREE.OctahedronGeometry(1),ring:new THREE.TorusGeometry(1,.075,8,40)};
 const buckets=new Map(),dummy=new THREE.Object3D();
 const add=(type,color,x,y,z,sx=1,sy=sx,sz=sx,rx=0,ry=0,rz=0)=>{dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,ry,rz);dummy.updateMatrix();const g=geometries[type].index?geometries[type].toNonIndexed():geometries[type].clone();g.applyMatrix4(dummy.matrix);g.deleteAttribute('uv');if(!buckets.has(color))buckets.set(color,[]);buckets.get(color).push(g)};
 const block=(color,x,y,z,w,h,d)=>add('box',color,x,y,z,w,h,d);
 const column=(x,y,z,h=5)=>{add('cylinder','ivory',x,y+h/2,z,.28,h,.28);for(const a of [0,h]){add('cylinder','gold',x,y+a,z,.43,.14,.43);block('white',x,y+a+(a===0?.12:-.12),z,.68,.15,.68)}};
 const arch=(x,y,z,w=5,h=6,rotation=0)=>{const c=Math.cos(rotation),s=Math.sin(rotation),point=(u,v)=>[x+u*c,y+v,z-u*s];for(const side of [-1,1]){const [px,py,pz]=point(side*w/2,0);column(px,py,pz,h*.64)}for(let i=0;i<17;i++){const a=i/16*Math.PI,u=Math.cos(a)*w/2,v=h*.64+Math.sin(a)*w/2;const [px,py,pz]=point(u,v);add('box',i%4===0?'gold':'ivory',px,py,pz,w*.135,w*.19,.55,0,rotation,a-Math.PI/2)}};
 const crystal=(x,y,z,h=4)=>{add('crystal','rose',x,y+h*.5,z,h*.25,h*.5,h*.25,0,.38);add('crystal','pink',x+h*.23,y+h*.23,z+.15,h*.13,h*.3,h*.13,0,-.3,.15);block('gold',x,y-.05,z,h*.5,.15,h*.5)};
 const garden=(x,y,z,w=8,d=6)=>{block('white',x,y-.25,z,w,.5,d);block('gold',x,y-.05,z,w+.12,.1,d+.12);block('leaf',x,y+.03,z,w-.6,.14,d-.6);for(let i=0;i<5;i++){const xx=x-w*.37+i*w*.18;add('ball','rose',xx,y+.32,z-d*.3,.48,.3,.4);add('ball','pink',xx,y+.39,z+d*.3,.43,.28,.45)}for(const side of [-1,1]){column(x+side*w*.35,y,z,2.8);add('ball','pink',x+side*w*.35,y+3.1,z,1.5,.9,1.2);add('ball','rose',x+side*w*.35+.6,y+3.4,z,1,.65,1)}};
 const pavilion=(x,y,z,w=10,h=9)=>{block('ivory',x,y-.7,z,w+2,1.4,w*.85+2);block('gold',x,y-.12,z,w+2.3,.18,w*.85+2.3);block('white',x,y+.05,z,w+1.5,.2,w*.85+1.5);for(const side of [-1,1])for(const depth of [-1,1])column(x+side*w*.39,y,z+depth*w*.31,h*.65);arch(x,y,z+w*.34,w*.56,h*.6);block('ivory',x,y+h*.7,z,w+1,.5,w*.85+1);block('gold',x,y+h*.75,z,w+1.25,.16,w*.85+1.25);add('cone','rose',x,y+h*.95,z,w*.78,h*.44,w*.65,0,Math.PI/4);add('cone','gold',x,y+h*1.23,z,.23,1.9,.23);crystal(x,y+h*1.3,z,1.5)};
 const span=-world.platforms.at(-1).z;
 for(let i=0;i<=Math.ceil(span/32);i++){
  const z=10-i*32,near=world.platforms.reduce((a,p)=>Math.abs(p.z-z)<Math.abs(a.z-z)?p:a,world.platforms[0]),y=near.y-3;
  const side=i%2?-1:1,x=side*(17+(i%3)*3);
  pavilion(x,y,z,10+(i%3)*2,9+(i%3)*2);garden(-x,y-2,z-6,9,7);arch(-x,y-1.8,z-6,5,6);
  crystal(side*10,y-1,z-14,4+(i%3));crystal(-side*14,y,z+8,3.5);
  // Gold-trimmed hanging terraces support every pavilion without resembling ruins.
  add('cone','ivory',x,y-5,z,7,8,6,0,0,Math.PI);add('crystal','pink',x,y-9.4,z,1.4,3,1.4);
  for(const s of [-1,1]){const cx=s*(26+(i%4)*7);add('ball','cloud',cx,y-9,z+8,18,3.2,12);add('ball','cloud',cx+8,y-10,z-5,15,3.7,15);}
  // Far towers form a continuous city on both sides of the playable route.
  for(const side2 of [-1,1]){const tx=side2*(48+(i%3)*9),ty=y-8,tw=6+(i%3)*2,th=16+(i%4)*5;block('ivory',tx,ty+th/2,z-12,tw,th,tw);for(let k=1;k<5;k++)block('gold',tx,ty+th*k/5,z-12,tw+.3,.16,tw+.3);add('cone','rose',tx,ty+th+4,z-12,tw*.82,8,tw*.82,0,Math.PI/4);add('cone','gold',tx,ty+th+9,z-12,.3,3,.3)}
 }
 // Ceremonial arrival terrace and the large, luminous final sanctuary.
 pavilion(-19,-2,6,15,16);pavilion(21,-2,-7,14,15);garden(13,-2,9,9,7);
 const end=world.platforms.at(-1);for(const side of [-1,1])pavilion(side*15,end.y-1,end.z-12,13,19);
 arch(0,end.y,end.z-8,12,15);crystal(0,end.y+13,end.z-10,6);add('ring','gold',0,end.y+16,end.z-11,6,6,6);
 for(let i=0;i<18;i++){const z=12-i*span/17;add('ball','cloud',0,-13+(-z/span)*10,z,23,2.5,15)}
 const architecture=new THREE.Group();architecture.name='Pristine rose crystal palace';
 for(const [color,parts] of buckets){const geometry=mergeGeometries(parts,false),o=new THREE.Mesh(geometry,materials[color]);o.castShadow=color!=='cloud';o.receiveShadow=color!=='cloud';architecture.add(o);for(const p of parts)p.dispose()}stage.add(architecture);for(const g of Object.values(geometries))g.dispose();
 const sky=new THREE.Mesh(new THREE.SphereGeometry(240,24,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(0x9691d3)},bottom:{value:new THREE.Color(0xffe8d8)}},vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 vP;uniform vec3 top;uniform vec3 bottom;void main(){float h=clamp(normalize(vP).y*.8+.2,0.,1.);gl_FragColor=vec4(mix(bottom,top,h),1.);}'}));stage.add(sky);
 const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(8,24,16),new THREE.MeshBasicMaterial({color:0xffedcb}));sunDisc.position.set(-60,56,-100);stage.add(sunDisc);
 const points=[];for(let i=0;i<360;i++)points.push(Math.sin(i*16.34)*42,5+(i%19)*1.8,10-(i/360)*(span+30));const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(points,3));stage.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0xffedb5,size:.12,transparent:true,opacity:.8,depthWrite:false})));
 return sky;
}

export function decoratePalacePlatform(g,p,{box,mesh,geo,mat,basic}){
 const ivory=mat(0xffefd8,{roughness:.6}),gold=mat(0xd8ab5a,{metalness:.65,roughness:.32}),rose=mat(0xeb97bf,{metalness:.12,roughness:.27,emissive:0xd66ea3,emissiveIntensity:.1});
 box(ivory,0,-.57,0,p.w*.94,.25,p.d*.94,g);box(gold,0,-.29,0,p.w+.08,.1,p.d+.08,g);box(ivory,0,-.2,0,p.w,.11,p.d,g);
 for(const x of [-p.w/2+.09,p.w/2-.09])box(gold,x,.015,0,.09,.04,p.d-.14,g);
 for(const z of [-p.d/2+.09,p.d/2-.09])box(gold,0,.015,z,p.w-.14,.04,.09,g);
 const pendant=mesh(new THREE.OctahedronGeometry(1),rose,0,-1.3,0,p.w*.23,1.5,p.d*.23,g);pendant.rotation.y=Math.PI/4;
 const ring=mesh(new THREE.TorusGeometry(.66,.035,6,28),gold,0,.025,0,1,1,1,g);ring.rotation.x=-Math.PI/2;
 // Repeated inlays make each safe top plane unmistakable above the cloud sea.
 for(const z of [-p.d*.26,p.d*.26])box(mat(0xe3c8d8),0,.026,z,p.w*.55,.012,.035,g);
 if(p.kind==='rotating'){const arrow=mesh(geo.cone,gold,.9,.13,0,.16,.4,.16,g);arrow.rotation.x=(p.direction||1)*Math.PI/2;g.rotation.y=p.angle}
 if(p.kind==='laser'){for(const x of [-p.w/2,p.w/2]){box(ivory,x,.65,0,.25,1.3,.3,g);box(gold,x,1.25,0,.4,.12,.45,g)}g.userData.laser=[box(basic(0xff3a7e),0,.65,0,p.w,.085,.1,g),box(basic(0xff397a,{transparent:true,opacity:.18,depthWrite:false}),0,.65,0,p.w,.5,.2,g)]}
 if(p.kind==='crumble'){for(const side of [-1,1])box(basic(0xf6ad65),side*p.w*.34,.035,0,.06,.035,p.d*.7,g)}
 if(p.kind==='moving'){for(const z of [-p.d*.35,p.d*.35]){const mark=mesh(geo.cone,gold,0,.05,z,.16,.45,.16,g);mark.rotation.z=Math.PI/2}}
}
