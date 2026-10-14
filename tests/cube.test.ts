import test from 'node:test';
import assert from 'node:assert/strict';
import {apertureSpectrum,moments,pvSlice,channelValueRange} from '../src/cube.ts';
import type {Cube,CubeMeta} from '../src/cube.ts';

function fixture():Cube {
  const nv=11,ny=5,nx=5,data=new Float32Array(nv*ny*nx);
  for(let k=0;k<nv;k++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++)data[(k*ny+y)*nx+x]=Math.exp(-.5*((k-5)/1.2)**2)*(1+x*.1);
  return {data,meta:{shape:[nv,ny,nx],velocities:Array.from({length:nv},(_,k)=>(k-5)*4),rms:.01,pixelScaleArcsec:4} as CubeMeta};
}
test('aperture spectra are measured from arbitrary positions in the cube',()=>{
  const c=fixture(),a=apertureSpectrum(c,{x:2,y:2,radius:.5});
  assert.equal(a.pixels,1);assert.ok(Math.abs(a.peak-1.2)<1e-6);assert.ok(Math.abs(a.centroid!)<1e-6);assert.ok(a.run>=3);
  assert.ok(apertureSpectrum(c,{x:4,y:2,radius:.5}).peak>a.peak);
});
test('moment maps integrate the same voxels with their velocity intervals',()=>{
  const c=fixture(),m=moments(c,0);const measured=apertureSpectrum(c,{x:2,y:2,radius:.5});
  assert.ok(Math.abs(m.moment0[12]-measured.profile.reduce((s,v)=>s+v*4,0))<1e-5);
  assert.ok(Math.abs(m.moment1[12])<1e-6);
  assert.ok(moments(c,1000).moment0.every(x=>x===0));
});
test('missing coverage remains missing; PV keeps signed data instead of inventing emission',()=>{
  const c=fixture();for(let k=0;k<11;k++)c.data[k*25+12]=NaN;
  assert.ok(apertureSpectrum(c,{x:2,y:2,radius:.5}).profile.every(Number.isNaN));
  const pv=pvSlice(c,{x:2,y:2,radius:1},0,5);assert.equal(pv.data.length,55);assert.ok(pv.data.some(Number.isNaN));
});
test('channel display limits follow signed finite data in each plane, and missing channels have no range',()=>{
  const c=fixture();c.data.fill(NaN,0,25);c.data[25]=-.002;c.data[26]=.003;
  assert.equal(channelValueRange(c,0),null);
  const range=channelValueRange(c,1)!;assert.ok(Math.abs(range.min+.002)<1e-9);assert.equal(range.count,25);assert.ok(range.max>.003);
  c.data.fill(0,50,75);assert.deepEqual(channelValueRange(c,2),{min:0,max:0,count:25});
});
