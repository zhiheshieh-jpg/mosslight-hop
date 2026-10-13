import * as THREE from 'three';
import {SVGLoader} from './vendor/loaders/SVGLoader.js';
export const CHARACTERS={dragon:{name:'GPT （同人Q版形象）',color:0x74cbb2},claude:{name:'Claude',color:0xe8ac89},logo:{name:'Δ0x7F_∴▒9',color:0xb7fff0}};
let logoShapes=[];
export async function loadLogo(){const data=await new SVGLoader().loadAsync('./assets/logo.svg');logoShapes=data.paths.flatMap(path=>SVGLoader.createShapes(path));}
export function buildCharacter(id,{box,mesh,geo,mat,basic}){
 const root=new THREE.Group();root.name=CHARACTERS[id].name;
 if(id==='logo'){
  const emblem=new THREE.Group();emblem.position.y=.85;root.add(emblem);
  const surface=mat(0x143f37,{emissive:0x3dccaa,emissiveIntensity:.12,metalness:.35,roughness:.38});
  for(const shape of logoShapes){const g=new THREE.ExtrudeGeometry(shape,{depth:1.7,bevelEnabled:true,bevelSize:.08,bevelThickness:.09,bevelSegments:2,steps:1,curveSegments:20});g.translate(-12,-12,-.85);g.scale(.078,-.078,.078);const o=new THREE.Mesh(g,surface);o.castShadow=true;emblem.add(o)}
  // The emblem is extruded from the sixfold knot, with open holes and no disc.
  const halo=new THREE.Group();halo.position.y=2.06;root.add(halo);
  const ring=mesh(new THREE.TorusGeometry(.66,.028,8,80),basic(0x9affe7),0,0,0,1,1,1,halo);ring.rotation.x=Math.PI/2;
  for(let i=0;i<24;i++){const angle=i*Math.PI/12,h=i%3===0?.23:.12;const needle=mesh(new THREE.ConeGeometry(.018,h,4),basic(i%3===0?0xffffff:0x74ead6),Math.cos(angle)*(.69+h/2),0,Math.sin(angle)*(.69+h/2),1,1,1,halo);needle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)))}
  const aura=mesh(new THREE.TorusGeometry(.98,.014,6,64),basic(0x71e8dd,{transparent:true,opacity:.45}),0,.86,0,1,1,1,root);
  root.userData.logo=emblem;root.userData.needleHalo=halo;root.userData.aura=aura;
 }else{
  const tint=CHARACTERS[id].color,cream=mat(0xfff1d3),body=mat(tint,{roughness:.55});
  // Both ordinary heroes preserve the original vertical-block silhouette.
  box(body,0,.78,0,.68,1.55,.64,root);box(cream,0,.53,.327,.45,.79,.025,root);
  box(mat(0x254740),-.15,1.08,.334,.07,.085,.03,root);box(mat(0x254740),.15,1.08,.334,.07,.085,.03,root);
  box(mat(0xd98e79),0,.92,.34,.13,.025,.025,root);
  if(id==='dragon'){
   for(const x of [-.25,.25]){const ear=mesh(geo.cone,mat(0xccefd4),x,1.7,0,.1,.27,.1,root);ear.rotation.z=-Math.sign(x)*.28}
   for(const y of [.3,.6,.9,1.2])mesh(geo.cone,mat(0x518e83),0,y,-.37,.11,.18,.15,root).rotation.x=-Math.PI/2;
  }else{
   for(const x of [-.25,.25])mesh(geo.ball,body,x,1.57,0,.14,.17,.13,root);
   for(let i=0;i<8;i++){const mark=box(mat(0xbb714f),0,.62,.35,.035,.27,.022,root);mark.rotation.z=i*Math.PI/4}
  }
 }
 return root;
}
