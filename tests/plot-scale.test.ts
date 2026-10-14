import test from 'node:test';
import assert from 'node:assert/strict';
import {spectrumBounds} from '../src/plot-scale.ts';

test('automatic spectrum limits fit a weak line and retain signed noise and margins',()=>{
  const profile=[NaN,-.0003,0,.00486,.0001],original=profile.slice(),bounds=spectrumBounds(profile,.0001);
  assert.ok(bounds.maximum>.00486&&bounds.maximum<.006);assert.ok(bounds.minimum<-.0003);
  assert.ok(.00486/(bounds.maximum-bounds.minimum)>.7);assert.equal(bounds.clipped,false);assert.deepEqual(profile,original);
});
test('vertical zoom and common limits are explicit, finite, and never invent missing data',()=>{
  const original=spectrumBounds([-.0003,.00486],.0001),zoomed=spectrumBounds([-.0003,.00486],.0001,undefined,2);
  assert.equal(zoomed.maximum,original.maximum/2);assert.equal(zoomed.clipped,true);
  assert.equal(spectrumBounds([.001],.0001,.009).maximum,.009);
  const empty=spectrumBounds([NaN,NaN],0);assert.equal(empty.hasData,false);assert.ok(Number.isFinite(empty.maximum)&&empty.maximum>empty.minimum);
});
