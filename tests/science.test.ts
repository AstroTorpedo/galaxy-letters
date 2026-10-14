import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrum, lineWidth50, projectedVelocity, hiField, regionAt, bridgeVelocity } from '../src/science.ts';
import { freshProgress, parseProgress, collect, canComplete } from '../src/state.ts';

test('face-on rotation has zero projected speed and a dispersion-only profile', () => {
  assert.equal(projectedVelocity(180, 0), 0);
  const p = spectrum(180, 0, 12);
  assert.ok(Math.abs(lineWidth50(p) - 2.35482 * 12) < 0.5);
});
test('teaching spectrum is symmetric and projection-degenerate', () => {
  const a = spectrum(180, 45);
  const b = spectrum(220, Math.asin(projectedVelocity(180, 45) / 220) * 180 / Math.PI);
  a.forEach((p, n) => {
    assert.ok(Math.abs(p.intensity - a.at(-n - 1)!.intensity) < 1e-10);
    assert.ok(Math.abs(p.intensity - b[n].intensity) < 1e-10);
  });
  assert.ok(lineWidth50(spectrum(220, 70)) > lineWidth50(spectrum(120, 30)));
});
test('invalid physical inputs fail explicitly', () => {
  assert.throws(() => spectrum(100, 120), RangeError);
  assert.throws(() => spectrum(100, 40, 0), RangeError);
});
test('interactive regions and teaching fields share normalized coordinates', () => {
  assert.equal(regionAt(0.74, 0.52), 'outer_hi');
  assert.ok(hiField(0.74, 0.52) > hiField(0.18, 0.23) * 2);
  assert.equal(regionAt(0.61, 0.4, true), 'bridge');
  assert.equal(bridgeVelocity(0), 115);
  assert.equal(bridgeVelocity(1), 90);
});
test('chapter one cannot be skipped with just the right explanation', () => {
  const p = freshProgress(), c = p.chapters[0];
  c.explanation = 'supported';
  assert.equal(canComplete(p).ok, false);
  c.viewed = ['optical', 'hi']; collect(c, 'comparison', 'outer', 'outer');
  assert.equal(c.evidence.length, 2);
  assert.equal(canComplete(p).ok, true);
  c.explanation = 'cause_known'; assert.equal(canComplete(p).ok, false);
});
test('later chapters require geometry or both types of bridge evidence', () => {
  const p = freshProgress(); p.current = 1;
  p.chapters[1].explanation = 'projection'; p.matched = true;
  assert.equal(canComplete(p).ok, false);
  p.geometry = true; collect(p.chapters[1], 'geometry');
  assert.equal(canComplete(p).ok, true);
  p.current = 2; const c = p.chapters[2]; c.explanation = 'interaction';
  c.viewed = ['optical', 'hi', 'velocity']; collect(c, 'morphology');
  assert.equal(canComplete(p).ok, false);
  collect(c, 'kinematics'); assert.equal(canComplete(p).ok, true);
});
test('corrupt, incompatible and out-of-range local saves recover safely', () => {
  assert.deepEqual(parseProgress('{oops'), freshProgress());
  assert.deepEqual(parseProgress('{"version":99}'), freshProgress());
  const p = parseProgress(JSON.stringify({ version: 1, started: true, current: 200, rotation: -1, inclination: 'x', chapters: [{ viewed: ['hi', 'hi', '<script>'], evidence: ['outer', 'outer'], completed: false }, { completed: true }] }));
  assert.equal(p.current, 0); assert.equal(p.rotation, 80); assert.equal(p.inclination, 30);
  assert.deepEqual(p.chapters[0].viewed, ['hi']); assert.equal(p.chapters[1].completed, false);
});
test('imported saves cannot request nonexistent or cross-chapter map modes', () => {
  const p = freshProgress();
  p.chapters[0].viewed = ['velocity', 'hi']; p.chapters[0].region = 'bridge';
  p.chapters[0].explanation = 'interaction'; p.chapters[0].evidence = ['kinematics', 'outer'];
  const repaired = parseProgress(JSON.stringify(p));
  assert.deepEqual(repaired.chapters[0].viewed, ['hi']);
  assert.equal(repaired.chapters[0].region, null);
  assert.equal(repaired.chapters[0].explanation, null);
  assert.deepEqual(repaired.chapters[0].evidence, ['outer']);
});
