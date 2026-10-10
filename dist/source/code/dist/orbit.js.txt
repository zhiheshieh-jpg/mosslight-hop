export const DEFAULT_VIEW={yaw:0,pitch:.5,distance:19};
export const PITCH_MIN=-1.15, PITCH_MAX=1.42;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function orbitDrag(view,dx,dy){view.yaw-=dx*.005;view.pitch=clamp(view.pitch+dy*.004,PITCH_MIN,PITCH_MAX)}
export function mouseLook(view,dx,dy){view.yaw-=dx*.0032;view.pitch=clamp(view.pitch+dy*.003,PITCH_MIN,PITCH_MAX)}
export function orbitZoom(view,delta){view.distance=clamp(view.distance*Math.exp(clamp(delta,-160,160)*.0015),9,27)}
export function cameraRelative(x,z,yaw){return {x:x*Math.cos(yaw)+z*Math.sin(yaw),z:z*Math.cos(yaw)-x*Math.sin(yaw)}}
