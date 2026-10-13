import * as THREE from 'three';
import {SVGLoader} from './vendor/loaders/SVGLoader.js';
export const CHARACTERS={dragon:{name:'GPT （同人Q版形象）',color:0x74cbb2},claude:{name:'Claude',color:0xe8ac89},logo:{name:'Δ0x7F_∴▒9',color:0xb7fff0}};
let logoShapes=[];
export async function loadLogo(){const data=await new SVGLoader().loadAsync('./assets/logo.svg');logoShapes=data.paths.flatMap(path=>SVGLoader.createShapes(path));}
export function buildCharacter(id,{box,mesh,geo,mat,basic,normalModel}){
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
  // Reuse the original Blender white-block hero for both ordinary progress profiles.
  if(normalModel){const original=normalModel.clone(true);original.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true}});root.add(original)}else{
  const body=mat(0xfff7e8,{roughness:.65});
  box(body,0,.78,0,.68,1.55,.64,root);
  box(mat(0x39544c),-.15,1.08,.326,.07,.08,.02,root);
  box(mat(0x39544c),.15,1.08,.326,.07,.08,.02,root);
  }
 }
 return root;
}
