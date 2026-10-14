export interface CubeMeta {
  id: string; title: string; kind: 'simulation' | 'observation'; description: string;
  shape: [number, number, number]; velocities: number[]; unit: string; rms: number;
  vsys: number; pixelScaleArcsec: number; beamMajorArcsec: number | null;
  beamMinorArcsec: number | null; fieldArcmin: number; velocityConvention: string;
  cubeFile: string; opticalFile: string; fitsFile: string;
  noiselessFile?: string; sourceId?: string;
  targetCode?:string;
  observingMinutes?: number;
  validChannels?:number[]; flaggedChannels?:number[];
  displayScale?:{channel:number;moment0:number;spectrum:number};
  observation?:{eastArcmin:number;northArcmin:number;centerMHz:number;bandwidthMHz:number;reference:boolean;flagRfi:boolean;run:number;night:number;modelVersion?:1|2;fieldEastArcmin?:number;fieldNorthArcmin?:number};
  sources: { title: string; url: string; credit: string }[];
  processing: string[]; knownParameters?: Record<string, number | boolean>;
}
export interface Cube { meta: CubeMeta; data: Float32Array }
export type ImageMode = 'optical' | 'moment0' | 'moment1' | 'channel';
export interface Aperture { x: number; y: number; radius: number }
export interface Measurement {
  profile: number[]; rms: number; peak: number; snr: number;
  centroid: number | null; run: number; pixels: number;
}
export const at = (c: Cube, v: number, x: number, y: number) => c.data[(v*c.meta.shape[1]+y)*c.meta.shape[2]+x];
export function channelValueRange(c:Cube,channel:number){
  const nxy=c.meta.shape[1]*c.meta.shape[2];let min=Infinity,max=-Infinity,count=0;
  for(let i=channel*nxy;i<(channel+1)*nxy;i++){const value=c.data[i];if(Number.isFinite(value)){min=Math.min(min,value);max=Math.max(max,value);count++;}}
  return count?{min,max,count}:null;
}
export function median(values: number[]) {
  const a=values.filter(Number.isFinite).sort((a,b)=>a-b);
  if(!a.length)return 0; const n=Math.floor(a.length/2);return a.length%2?a[n]:(a[n-1]+a[n])/2;
}
export function mad(values: number[]) { const center=median(values);return 1.4826*median(values.map(x=>Math.abs(x-center))); }
export async function loadCube(id: string, noiseless=false): Promise<Cube> {
  if(!/^[a-z0-9-]+$/.test(id))throw new Error('Invalid dataset ID');
  const base=`./cubes/${id}/`;
  const metaResponse=await fetch(base+'metadata.json');if(!metaResponse.ok)throw new Error('无法读取数据说明');
  const meta=await metaResponse.json() as CubeMeta;
  if(meta.shape.length!==3 || meta.shape.some(n=>!Number.isInteger(n)||n<=0) || meta.shape.reduce((a,b)=>a*b,1)>64000000 || meta.velocities.length!==meta.shape[0])throw new Error('Cube 尺寸或谱轴不合法');
  const filename=noiseless?meta.noiselessFile:meta.cubeFile;if(!filename)throw new Error('无噪声模型未就绪');
  const response=await fetch(base+filename);if(!response.ok||!response.body)throw new Error('无法读取 cube');
  let buffer=await response.arrayBuffer();
  // Some static hosts advertise Content-Encoding:gzip and fetch already decodes it.
  // Others serve the file as opaque binary. Decode exactly once in either case.
  const magic=new Uint8Array(buffer,0,Math.min(2,buffer.byteLength));
  if(magic[0]===0x1f&&magic[1]===0x8b){
    if(typeof DecompressionStream==='undefined')throw new Error('此浏览器缺少 gzip 解码，请使用近期版本的 Safari、Chrome 或 Edge');
    buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  }
  if(buffer.byteLength!==meta.shape.reduce((a,b)=>a*b,1)*4)throw new Error('Cube 文件长度不匹配');
  return {meta,data:new Float32Array(buffer)};
}
export function apertureSpectrum(c:Cube, a:Aperture):Measurement {
  const [nv,ny,nx]=c.meta.shape;const indices:number[]=[];
  for(let y=Math.max(0,Math.floor(a.y-a.radius));y<=Math.min(ny-1,Math.ceil(a.y+a.radius));y++)
    for(let x=Math.max(0,Math.floor(a.x-a.radius));x<=Math.min(nx-1,Math.ceil(a.x+a.radius));x++)
      if(Math.hypot(x-a.x,y-a.y)<=a.radius)indices.push(y*nx+x);
  const profile=Array.from({length:nv},(_,k)=>{
    let sum=0,count=0;for(const index of indices){const value=c.data[k*ny*nx+index];if(Number.isFinite(value)){sum+=value;count++;}}
    return count?sum/count:NaN;
  });
  const edge=Math.max(4,Math.floor(nv*.12));
  const edges=[...profile.slice(0,edge),...profile.slice(-edge)].filter(Number.isFinite);
  // A narrow tuning can omit line-free edge channels. Do not invent a tiny RMS.
  const rms=edges.length>=8?Math.max(c.meta.rms*.2,mad(edges)):c.meta.rms;
  const peak=Math.max(0,...profile.filter(Number.isFinite));let weight=0,weighted=0,run=0,maxRun=0;
  profile.forEach((value,k)=>{if(value>3*rms){run++;maxRun=Math.max(maxRun,run);weight+=value;weighted+=value*c.meta.velocities[k];}else run=0;});
  return {profile,rms,peak,snr:peak/rms,centroid:weight?weighted/weight:null,run:maxRun,pixels:indices.length};
}
export function moments(c:Cube, threshold:number, lo=0, hi=c.meta.shape[0]-1) {
  const [nv,ny,nx]=c.meta.shape;const count=ny*nx,m0=new Float32Array(count),m1=new Float32Array(count);m1.fill(NaN);
  const dv=c.meta.velocities.map((v,k)=>k===0?c.meta.velocities[1]-v:k===nv-1?v-c.meta.velocities[k-1]:(c.meta.velocities[k+1]-c.meta.velocities[k-1])/2);
  for(let p=0;p<count;p++){
    let sum=0,weighted=0,run=0,maxRun=0;
    for(let k=lo;k<=hi;k++){
      const value=c.data[k*count+p];
      if(Number.isFinite(value)&&value>threshold*c.meta.rms){sum+=value*dv[k];weighted+=value*dv[k]*c.meta.velocities[k];run++;maxRun=Math.max(maxRun,run);}else run=0;
    }
    if(maxRun>=3&&sum>0){m0[p]=sum;m1[p]=weighted/sum;}
  }
  return {moment0:m0,moment1:m1};
}
/** Mean across a narrow slit, never a third spatial dimension. */
export function pvSlice(c:Cube,a:Aperture,angleDeg:number,steps=128) {
  const [nv,ny,nx]=c.meta.shape,output=new Float32Array(nv*steps);output.fill(NaN);
  const angle=angleDeg*Math.PI/180,cos=Math.cos(angle),sin=-Math.sin(angle),span=Math.hypot(nx,ny);
  for(let s=0;s<steps;s++){
    const offset=(s/(steps-1)-.5)*span;
    for(let k=0;k<nv;k++){
      let sum=0,count=0;
      for(let width=-1;width<=1;width++){
        const x=Math.round(a.x+offset*cos-width*sin),y=Math.round(a.y+offset*sin+width*cos);
        if(x<0||x>=nx||y<0||y>=ny)continue;
        const value=at(c,k,x,y);if(Number.isFinite(value)){sum+=value;count++;}
      }
      if(count)output[k*steps+s]=sum/count;
    }
  }
  return {data:output,steps,spanArcmin:span*c.meta.pixelScaleArcsec/60};
}
