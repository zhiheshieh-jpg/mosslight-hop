// Read each character's own 4 x 2 atlas; never borrow another character's anchors.
export function measureAtlas(pixels,width,height,{edgeInset=0}={}){
 if(!width||!height||width%4||height%2||pixels.length<width*height*4)throw new Error('角色图集必须是完整的 4 × 2 网格');
 const cellWidth=width/4,cw=cellWidth-edgeInset*2,ch=height/2,frames=[];
 if(!Number.isInteger(edgeInset)||edgeInset<0||cw<=0)throw new Error('角色图集边距无效');
 const solid=(x,y)=>pixels[(y*width+x)*4+3]>32;
 for(let i=0;i<8;i++){
  const sx=i%4*cellWidth+edgeInset,sy=Math.floor(i/4)*ch;let minX=cw,maxX=-1,minY=ch,maxY=-1;
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(solid(sx+x,sy+y)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  if(maxX<0)throw new Error(`角色图集第 ${i+1} 帧为空`);
  // The lowest opaque band marks the feet, so tails and outstretched arms do not move the body anchor.
  let left=cw,right=-1;const footBand=Math.max(1,Math.round(ch*.05));
  for(let y=Math.max(minY,maxY-footBand+1);y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(solid(sx+x,sy+y)){left=Math.min(left,x);right=Math.max(right,x)}
  frames.push({sx,sy,sw:cw,sh:ch,ax:(left+right)/2,ay:maxY+1,bounds:{minX,maxX,minY,maxY}});
 }
 return frames;
}
