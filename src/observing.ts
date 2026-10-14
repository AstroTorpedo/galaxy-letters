import type {Cube} from './cube';
import {TARGETS} from './targets';
import type {TargetId} from './targets';

export const REST_MHZ=1420.40575;
export const LIGHT_KMS=299792.458;
export const PRIMARY_BEAM_ARCMIN=14;
export const NIGHT_MINUTES=28;
export interface ObservingPlan {
  east:number; north:number; centerMHz:number; bandwidthMHz:number; minutes:4|8|16; flagRfi:boolean;
}
export interface Exposure {id:string;night:number;plan:ObservingPlan;reference:boolean;modelVersion?:1|2;sourceId?:TargetId}
export const defaultPlan=():ObservingPlan=>({east:7,north:-5,centerMHz:REST_MHZ+.24,bandwidthMHz:.8,minutes:8,flagRfi:false});
export const frequencyMHz=(velocity:number)=>REST_MHZ*(1-velocity/LIGHT_KMS);
export const velocityKmS=(frequency:number)=>LIGHT_KMS*(1-frequency/REST_MHZ);
export const primaryResponse=(east:number,north:number)=>Math.exp(-4*Math.LN2*(east*east+north*north)/PRIMARY_BEAM_ARCMIN**2);
export const isRfi=(velocity:number)=>Math.abs(velocity-35)<=5;
export const covered=(velocity:number,plan:ObservingPlan)=>Math.abs(frequencyMHz(velocity)-plan.centerMHz)<=plan.bandwidthMHz/2;
export const noiseFactor=(minutes:number)=>Math.sqrt(16/minutes);
export function sourcePixel(x:number,y:number,pixelScaleArcsec:number,eastArcmin=0,northArcmin=0){
  return {x:x-eastArcmin*60/pixelScaleArcsec,y:y-northArcmin*60/pixelScaleArcsec};
}
/** Zero outside the finite synthetic source stamp means the assumed empty model sky. */
export function samplePlane(data:Float32Array,nx:number,ny:number,x:number,y:number,offset=0){
  const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
  const value=(px:number,py:number)=>px<0||px>=nx||py<0||py>=ny?0:data[offset+py*nx+px];
  return value(x0,y0)*(1-fx)*(1-fy)+value(x0+1,y0)*fx*(1-fy)+value(x0,y0+1)*(1-fx)*fy+value(x0+1,y0+1)*fx*fy;
}
export function referenceDisplayScale(clean:Cube){
  const [nv,ny,nx]=clean.meta.shape,nxy=nx*ny,integrated=new Float64Array(nxy);let channel=0;
  const dv=Math.abs(clean.meta.velocities[1]-clean.meta.velocities[0]);
  for(let k=0;k<nv;k++)for(let i=0;i<nxy;i++){const v=clean.data[k*nxy+i];if(Number.isFinite(v)){channel=Math.max(channel,v);integrated[i]+=v*dv;}}
  let moment0=0;for(const value of integrated)moment0=Math.max(moment0,value);
  return {channel:Math.max(channel,1e-6),moment0:Math.max(moment0,1e-6),spectrum:Math.max(channel*1.2,.009)};
}
export function predictedImage(clean:Cube,p:ObservingPlan){
  const [nv,ny,nx]=clean.meta.shape,nxy=nx*ny,source=new Float32Array(nxy),image=new Float32Array(nxy),dv=Math.abs(clean.meta.velocities[1]-clean.meta.velocities[0]);
  for(let k=0;k<nv;k++)if(covered(clean.meta.velocities[k],p)&&!(p.flagRfi&&isRfi(clean.meta.velocities[k])))for(let i=0;i<nxy;i++)source[i]+=clean.data[k*nxy+i]*dv;
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const s=sourcePixel(x,y,clean.meta.pixelScaleArcsec,p.east,p.north);
    image[y*nx+x]=samplePlane(source,nx,ny,s.x,s.y)*primaryResponse(-(x-(nx-1)/2)*clean.meta.pixelScaleArcsec/60,((ny-1)/2-y)*clean.meta.pixelScaleArcsec/60);
  }
  return image;
}
/** Reference stellar cutoff of the current source model (3.7 kpc at 8 Mpc). */
export function outsideStellarDisk(x:number,y:number){
  const dx=x-63.5,dy=63.5-y,pa=28*Math.PI/180,inc=56*Math.PI/180;
  const major=dx*Math.cos(pa)+dy*Math.sin(pa),minor=(-dx*Math.sin(pa)+dy*Math.cos(pa))/Math.cos(inc);
  return Math.hypot(major,minor)>3.7/(4*8*1000/206265);
}
export function remainingMinutes(night:number,calibrated:boolean,reference:boolean,exposures:Exposure[]) {
  return Math.max(0,NIGHT_MINUTES-(calibrated?2:0)-(reference?2:0)-exposures.filter(e=>e.night===night).reduce((sum,e)=>sum+e.plan.minutes,0));
}
export function validatePlan(value:unknown):ObservingPlan|null {
  const p=value as ObservingPlan;if(!p)return null;
  if(![p.east,p.north,p.centerMHz,p.bandwidthMHz,p.minutes].every(Number.isFinite))return null;
  if(Math.abs(p.east)>12||Math.abs(p.north)>12||p.centerMHz<REST_MHZ-1.2||p.centerMHz>REST_MHZ+1.2||![.8,1.6,2.8].includes(p.bandwidthMHz)||![4,8,16].includes(p.minutes)||typeof p.flagRfi!=='boolean')return null;
  return {...p};
}
/** A post-imaging teaching model, not an interferometer visibility simulator. */
export function observeCube(base:Cube,clean:Cube,exposure:Exposure):Cube {
  const p=validatePlan(exposure.plan);if(!p)throw new Error('观测配置不合法');
  if(base.data.length!==clean.data.length)throw new Error('源与噪声网格不一致');
  if(exposure.sourceId&&exposure.sourceId!==base.meta.id)throw new Error('观测目标与源模型不一致');
  const [nv,ny,nx]=base.meta.shape,nxy=nx*ny,result=new Float32Array(base.data.length);result.fill(NaN);
  const movingFrame=exposure.modelVersion===2,fieldEast=movingFrame?p.east:0,fieldNorth=movingFrame?p.north:0;
  const factor=noiseFactor(p.minutes),response=new Float32Array(nxy);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
    const east=-(x-(nx-1)/2)*base.meta.pixelScaleArcsec/60,north=((ny-1)/2-y)*base.meta.pixelScaleArcsec/60;
    response[y*nx+x]=primaryResponse(east+fieldEast-p.east,north+fieldNorth-p.north);
  }
  // Translate a fixed correlated residual rather than claiming independent integrations.
  const run=Number(exposure.id.split('-').at(-1))||1,shiftX=run*17%nx,shiftY=run*23%ny,shiftV=run*19%nv;
  const validChannels:number[]=[],flaggedChannels:number[]=[];
  for(let k=0;k<nv;k++){
    const v=base.meta.velocities[k];if(!covered(v,p))continue;
    if(p.flagRfi&&exposure.reference&&isRfi(v)){flaggedChannels.push(k);continue;}validChannels.push(k);
    const interference=isRfi(v)?.007*Math.exp(-.5*((v-35)/4)**2):0;
    for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const i=k*nxy+y*nx+x,ni=((k+shiftV)%nv)*nxy+((y+shiftY)%ny)*nx+(x+shiftX)%nx;
      const s=sourcePixel(x,y,base.meta.pixelScaleArcsec,fieldEast,fieldNorth);
      const source=movingFrame?samplePlane(clean.data,nx,ny,s.x,s.y,k*nxy):clean.data[i];
      result[i]=source*response[y*nx+x]+(base.data[ni]-clean.data[ni])*factor+interference;
    }
  }
  const target=TARGETS.find(t=>t.id===base.meta.id),code=target?.code??'MODEL';
  return {data:result,meta:{...base.meta,id:exposure.id,sourceId:base.meta.id,targetCode:code,title:`${code}${target?`「${target.name}」`:''} · 第 ${exposure.night} 夜 / 批次 ${run}`,
    description:`${movingFrame?'指向中心':'历史固定视场'} E ${fieldEast.toFixed(1)}′ / N ${fieldNorth.toFixed(1)}′ · ${p.minutes} 分钟 · ${validChannels.length}/${nv} 有效通道 · 主波束未校正。`,
    rms:base.meta.rms*factor,observingMinutes:p.minutes,validChannels,flaggedChannels,
    displayScale:base.meta.displayScale??referenceDisplayScale(clean),
    observation:{eastArcmin:p.east,northArcmin:p.north,centerMHz:p.centerMHz,bandwidthMHz:p.bandwidthMHz,reference:exposure.reference,flagRfi:p.flagRfi,run,night:exposure.night,modelVersion:movingFrame?2:1,fieldEastArcmin:fieldEast,fieldNorthArcmin:fieldNorth},
    processing:[...base.meta.processing,
      `虚构阵列教学观测；指向偏置 E ${p.east.toFixed(1)}′ / N ${p.north.toFixed(1)}′`,
      movingFrame?'成像视场以当前指向为中心；模型双线性重采样，源图以外假设无源，只加入接收噪声':'历史批次保留固定目标视场，不改写原记录坐标',
      `主波束 Gaussian FWHM ${PRIMARY_BEAM_ARCMIN}′，作用于源；合成波束仍为 16″，未作主波束校正`,
      `系统静止系演示中心频率 ${p.centerMHz.toFixed(3)} MHz，总带宽 ${p.bandwidthMHz} MHz，通道分辨率保持不变`,
      `${p.minutes} 模拟分钟积分；固定相关残差平移并按 sqrt(16/t) 缩放`,
      `完成简化标量增益校准；${flaggedChannels.length} 个干扰通道被标记为 NaN；频段外同样为 NaN`,
      'RFI 为现象学窄谱污染；未模拟可见度、uv 覆盖、相位校准或 CLEAN',
    ]}};
}

/** Minimal standards-based FITS: linear angular offsets, radio velocity, signed Float32. */
export function cubeFits(cube:Cube):Uint8Array {
  const [nv,ny,nx]=cube.meta.shape;
  const card=(key:string,value:string|number|boolean)=>{
    const v=typeof value==='string'?`'${value.replace(/'/g,"''")}'`:typeof value==='boolean'?(value?'T':'F'):String(value);
    return `${key.padEnd(8)}= ${v.padStart(20)}`.padEnd(80).slice(0,80);
  };
  const entries:[string,string|number|boolean][]=[['SIMPLE',true],['BITPIX',-32],['NAXIS',3],['NAXIS1',nx],['NAXIS2',ny],['NAXIS3',nv],
    ['EXTEND',true],['OBJECT',`${cube.meta.targetCode??'GX-07'} SIMULATION`],['SRCID',cube.meta.sourceId??'sim-disturbed'],['SIMULATE',true],['BUNIT','Jy/beam'],
    ['CTYPE1','LINEAR'],['CNAME1','East offset'],['CUNIT1','arcsec'],['CRPIX1',(nx+1)/2],['CRVAL1',(cube.meta.observation?.fieldEastArcmin??0)*60],['CDELT1',-cube.meta.pixelScaleArcsec],
    ['CTYPE2','LINEAR'],['CNAME2','North offset'],['CUNIT2','arcsec'],['CRPIX2',(ny+1)/2],['CRVAL2',(cube.meta.observation?.fieldNorthArcmin??0)*60],['CDELT2',cube.meta.pixelScaleArcsec],
    ['CTYPE3','VRAD'],['CUNIT3','m/s'],['CRPIX3',1],['CRVAL3',cube.meta.velocities[0]*1000],['CDELT3',(cube.meta.velocities[1]-cube.meta.velocities[0])*1000],
    ['RESTFRQ',REST_MHZ*1e6],['BMAJ',(cube.meta.beamMajorArcsec??16)/3600],['BMIN',(cube.meta.beamMinorArcsec??16)/3600],
    ['EXPTIME',(cube.meta.observingMinutes??16)*60],['PBFWHM',PRIMARY_BEAM_ARCMIN],['PBUNIT','arcmin'],['PBCOR',false],['SPECSYS','SOURCE']];
  const o=cube.meta.observation;if(o)entries.push(['POINTE',o.eastArcmin],['POINTN',o.northArcmin],['OBSFREQ',o.centerMHz*1e6],['TOTBAND',o.bandwidthMHz*1e6],['RFIREF',o.reference],['RFIFLAG',o.flagRfi],['OBSRUN',o.run],['OBSNGHT',o.night],['OBSVER',o.modelVersion??1]);
  const cards=entries.map(([key,value])=>card(key,value));cards.push('HISTORY Teaching simulation; missing and flagged channels remain NaN.'.padEnd(80));cards.push('END'.padEnd(80));
  const header=cards.join(''),headerBytes=Math.ceil(header.length/2880)*2880,dataBytes=cube.data.length*4;
  const out=new Uint8Array(headerBytes+Math.ceil(dataBytes/2880)*2880);out.fill(32,0,headerBytes);out.set(new TextEncoder().encode(header));
  const view=new DataView(out.buffer);let n=0;
  for(let k=0;k<nv;k++)for(let y=ny-1;y>=0;y--)for(let x=0;x<nx;x++)view.setFloat32(headerBytes+(n++)*4,cube.data[(k*ny+y)*nx+x],false);
  return out;
}
