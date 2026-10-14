import test from 'node:test';
import assert from 'node:assert/strict';
import type {Cube,CubeMeta} from '../src/cube.ts';
import {REST_MHZ,primaryResponse,noiseFactor,frequencyMHz,velocityKmS,observeCube,defaultPlan,cubeFits,validatePlan,remainingMinutes,outsideStellarDisk,predictedImage,sourcePixel,samplePlane} from '../src/observing.ts';

function fixture():[Cube,Cube] {
  const meta={id:'source',shape:[5,3,3],velocities:[-100,0,30,35,40],pixelScaleArcsec:4,rms:.01,processing:[],beamMajorArcsec:16,beamMinorArcsec:16} as CubeMeta;
  return [{meta,data:new Float32Array(45).fill(1.1)},{meta,data:new Float32Array(45).fill(1)}];
}
test('radio tuning convention and Gaussian primary beam have known physical limits',()=>{
  assert.equal(frequencyMHz(0),REST_MHZ);assert.ok(Math.abs(velocityKmS(frequencyMHz(120))-120)<1e-8);
  assert.equal(primaryResponse(0,0),1);assert.ok(Math.abs(primaryResponse(7,0)-.5)<1e-12);assert.equal(noiseFactor(4),2);
  assert.equal(outsideStellarDisk(63.5,63.5),false);assert.equal(outsideStellarDisk(36.5,47.5),true);
});
test('night budget charges calibration once and only integrations in the current night',()=>{
  const exposure={id:'night-1',night:1,plan:{...defaultPlan(),minutes:16 as const},reference:true};
  assert.equal(remainingMinutes(1,true,true,[exposure]),8);
  assert.equal(remainingMinutes(2,false,false,[exposure]),28);
});
test('pointing and exposure change voxel values; missing tuning and flagged channels stay NaN',()=>{
  const [base,clean]=fixture(),plan={...defaultPlan(),east:0,north:0,centerMHz:REST_MHZ,bandwidthMHz:2.8,minutes:16 as const,flagRfi:true};
  const full=observeCube(base,clean,{id:'night-1',night:1,plan,reference:true});
  assert.ok(Math.abs(full.data[4]-1.1)<1e-6);assert.ok(full.data.slice(18).every(Number.isNaN));
  const short=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,minutes:4},reference:true});assert.ok(Math.abs(short.data[4]-1.2)<1e-6);
  const off=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,east:7},reference:true});assert.ok(Math.abs(off.data[4]-.6)<1e-6);
  const noCoverage=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,centerMHz:1421.6,bandwidthMHz:.8},reference:true});assert.ok(noCoverage.data.every(Number.isNaN));
  const contaminated=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,flagRfi:false},reference:false});assert.ok(contaminated.data[31]>1.1);
});
test('the selected target must match the actual cube and is carried into FITS provenance',()=>{
  const [base,clean]=fixture();base.meta={...base.meta,id:'sim-disk'};clean.meta=base.meta;
  const plan={...defaultPlan(),east:0,north:0,centerMHz:REST_MHZ,bandwidthMHz:2.8,minutes:16 as const,flagRfi:true};
  const exposure={id:'night-1',night:1,plan,reference:true,sourceId:'sim-disk' as const,modelVersion:2 as const};
  const disk=observeCube(base,clean,exposure);assert.equal(disk.meta.sourceId,'sim-disk');assert.equal(disk.meta.targetCode,'GX-03');
  const h=new TextDecoder().decode(cubeFits(disk).slice(0,5760));assert.ok(h.includes('SRCID')&&h.includes('sim-disk')&&h.includes('GX-03'));
  assert.throws(()=>observeCube(base,clean,{...exposure,sourceId:'sim-disturbed'}));
});
test('invalid plans are rejected and FITS preserves signed big-endian data and north orientation',()=>{
  assert.equal(validatePlan({...defaultPlan(),minutes:-1}),null);assert.equal(validatePlan({...defaultPlan(),east:NaN}),null);
  const [cube]=fixture();cube.meta.velocities=[-10,-5,0,5,10];cube.data[6]=-2;cube.data[7]=NaN;
  const fits=cubeFits(cube),header=new TextDecoder().decode(fits.slice(0,2880));assert.ok(header.includes('VRAD'));assert.ok(header.includes('PBCOR'));
  const allHeader=new TextDecoder().decode(fits);let end=0;while(allHeader.slice(end,end+8).trim()!=='END')end+=80;const offset=Math.ceil((end+80)/2880)*2880;
  const data=new DataView(fits.buffer);assert.equal(data.getFloat32(offset,false),-2);assert.ok(Number.isNaN(data.getFloat32(offset+4,false)));assert.equal(fits.length%2880,0);
});

function pointSource():[Cube,Cube] {
  const nx=9,ny=9,nv=11,data=new Float32Array(nx*ny*nv),base=new Float32Array(data.length);
  for(let k=0;k<nv;k++)data[k*81+40]=2*Math.exp(-.5*((k-5)/1.2)**2);
  for(let i=0;i<data.length;i++)base[i]=data[i]+.1;
  const meta={id:'point',shape:[nv,ny,nx],velocities:Array.from({length:nv},(_,k)=>(k-5)*5),pixelScaleArcsec:60,rms:.1,processing:[],beamMajorArcsec:16,beamMinorArcsec:16} as CubeMeta;
  return [{meta,data:base},{meta,data}];
}
test('new pointing moves a known sky source in both axes and applies the beam at its new location',()=>{
  const [base,clean]=pointSource(),plan={...defaultPlan(),east:2,north:-1,centerMHz:REST_MHZ,bandwidthMHz:2.8,minutes:16 as const,flagRfi:true};
  const c=observeCube(base,clean,{id:'night-1',night:1,plan,reference:true,modelVersion:2});
  const expected=2*primaryResponse(-2,1)+.1;
  assert.ok(Math.abs(c.data[5*81+3*9+6]-expected)<1e-6);
  assert.ok(Math.abs(c.data[5*81+40]-.1)<1e-6);
  assert.deepEqual(sourcePixel(6,3,60,2,-1),{x:4,y:4});
  const half=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,east:.5,north:0},reference:true,modelVersion:2});
  assert.ok(Math.abs(half.data[5*81+4*9+4]-1.1)<1e-6);
  assert.ok(Math.abs(half.data[5*81+4*9+5]-(primaryResponse(-1,0)+.1))<1e-6);
  const preview=predictedImage(clean,plan);const flux=Array.from({length:11},(_,k)=>clean.data[k*81+40]*5).reduce((a,b)=>a+b,0);
  assert.ok(Math.abs(preview[3*9+6]-flux*primaryResponse(-2,1))<1e-5);
});
test('empty off-target fields contain receiver noise without wrapping the source into the image',()=>{
  const [base,clean]=pointSource(),plan={...defaultPlan(),east:12,north:12,centerMHz:REST_MHZ,bandwidthMHz:2.8,minutes:16 as const,flagRfi:true};
  const c=observeCube(base,clean,{id:'night-1',night:1,plan,reference:true,modelVersion:2});
  assert.ok(c.data.every(v=>Math.abs(v-.1)<1e-6));
  assert.ok(predictedImage(clean,plan).every(v=>v===0));
  assert.equal(samplePlane(new Float32Array([2,0,0,0]),2,2,.5,0),1);
  assert.equal(samplePlane(new Float32Array([2,0,0,0]),2,2,-2,0),0);
});
test('common intensity scales and FITS sky coordinates follow the source and pointing, while legacy data keep their frame',()=>{
  const [base,clean]=pointSource(),plan={...defaultPlan(),east:2,north:-1,centerMHz:REST_MHZ,bandwidthMHz:2.8,minutes:16 as const,flagRfi:true};
  const moved=observeCube(base,clean,{id:'night-1',night:1,plan,reference:true,modelVersion:2});
  const centered=observeCube(base,clean,{id:'night-1',night:1,plan:{...plan,east:0,north:0},reference:true,modelVersion:2});
  assert.deepEqual(moved.meta.displayScale,centered.meta.displayScale);
  const h=new TextDecoder().decode(cubeFits(moved).slice(0,5760));
  const read=(key:string)=>Number(h.match(new RegExp(key.padEnd(8)+'=\\s*([^ ]+)'))![1]);
  assert.equal(read('CRVAL1'),120);assert.equal(read('CRVAL2'),-60);assert.equal(read('OBSVER'),2);
  const old=observeCube(base,clean,{id:'night-1',night:1,plan,reference:true});
  assert.equal(old.meta.observation!.fieldEastArcmin,0);assert.equal(old.meta.observation!.modelVersion,1);
  assert.ok(Math.abs(old.data[5*81+40]-(2*primaryResponse(-2,1)+.1))<1e-6);
});
