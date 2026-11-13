import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runningStitches, clipSegment, generateStitches, inside, stitchesSvg, playbackPosition } from '../src/studio/stitches.ts';
import { studies, studySvg } from '../src/studio/studies.ts';
import { DEFAULT_SETTINGS, defaultsForStudy, previewPath, readSettings, settingsQuery } from '../src/studio/settings.ts';
import { stitchDistances, segmentPosition } from '../src/studio/playback.ts';
import type { Point, StitchOptions } from '../src/studio/stitches.ts';
const rectangle = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
];
const options: StitchOptions = { length: 6, gap: 4, spacing: 18, angle: 25, pattern: 'rows', outline: false };

test('distance playback interpolates short and long stitches without counting jumps', () => {
  const distances = stitchDistances([
    { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
    { from: { x: 100, y: 0 }, to: { x: 108, y: 0 } },
  ]);
  assert.deepEqual(distances, [0, 2, 10]);
  assert.equal(segmentPosition(distances, 1), .5);
  assert.equal(segmentPosition(distances, 6), 1.5);
  assert.equal(segmentPosition(distances, 100), 2);
  assert.equal(segmentPosition([0], 100), 0);
});

test('preview URL settings round-trip and reject unsupported or excessive values', () => {
  const selected = { ...DEFAULT_SETTINGS, drawing: 'horse', pattern: 'crosshatch' as const, lineWidth: 3, fillLineWidth: .5, spacing: 48, angle: 90 };
  assert.deepEqual(readSettings(settingsQuery(selected)), selected);
  assert.deepEqual(readSettings('drawing=unknown&pattern=bad&length=99999&gap=0&lineWidth=NaN&fillLineWidth=-5&spacing=1&angle=999'), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings(''), DEFAULT_SETTINGS);
});

test('running stitches keep their length and gaps around corners, with no joins between separate paths', () => {
  const path = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 16 }];
  const stitches = runningStitches(path, 6, 4);
  assert.deepEqual(stitches, [
    { from: { x: 0, y: 0 }, to: { x: 4, y: 0 } },
    { from: { x: 4, y: 0 }, to: { x: 4, y: 2 } },
    { from: { x: 4, y: 6 }, to: { x: 4, y: 12 } },
  ]);
  const shapes = [0, 100].map(x => ({ filled: false, contours: [[{ x, y: 0 }, { x: x + 20, y: 0 }]] }));
  const result = generateStitches(shapes, { ...options, outline: true });
  assert.equal(result.length, 4);
  assert.ok(result.every(line => Math.abs(line.to.x - line.from.x) <= 6));
  assert.throws(() => runningStitches(path, 0, 1));
});

test('clipping respects holes and concave boundaries, including stitches whose endpoints are both inside', () => {
  const contours = [rectangle(0, 0, 100, 100), rectangle(40, 40, 20, 20)];
  assert.ok(inside({ x: 20, y: 50 }, contours));
  assert.ok(!inside({ x: 50, y: 50 }, contours));
  assert.deepEqual(clipSegment({ from: { x: 10, y: 50 }, to: { x: 90, y: 50 } }, contours), [
    { from: { x: 10, y: 50 }, to: { x: 40, y: 50 } },
    { from: { x: 60, y: 50 }, to: { x: 90, y: 50 } },
  ]);
  const notch = [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    { x: 60, y: 100 }, { x: 60, y: 30 }, { x: 40, y: 30 }, { x: 40, y: 100 }, { x: 0, y: 100 }]];
  assert.equal(clipSegment({ from: { x: 10, y: 50 }, to: { x: 90, y: 50 } }, notch).length, 2);
});

test('all open fill patterns are deterministic, bounded by the shape and leave holes empty', () => {
  const contours = [rectangle(50, 50, 180, 140), rectangle(110, 95, 40, 40)];
  for (const pattern of ['rows', 'crosshatch', 'petals'] as const) {
    const settings = { ...options, pattern };
    const stitches = generateStitches([{ filled: true, contours }], settings, 300, 240);
    assert.ok(stitches.length > 10);
    assert.deepEqual(stitches, generateStitches([{ filled: true, contours }], settings, 300, 240));
    for (const { from, to } of stitches) {
      assert.ok(inside({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, contours));
      assert.ok(Math.hypot(to.x - from.x, to.y - from.y) <= options.length + 1e-6);
    }
  }
});

test('density is bounded and invalid controls cannot trigger unbounded generation', () => {
  const shape = { filled: true, contours: [rectangle(0, 0, 600, 440)] };
  assert.throws(() => generateStitches([shape], { ...options, spacing: 0 }), /Invalid/);
  assert.throws(() => generateStitches([shape], { ...options, angle: NaN }), /Invalid/);
  assert.throws(() => generateStitches([shape], { ...options, pattern: 'petals', spacing: 8, length: 2, gap: 1 }), /Too many/);
});

test('SVG downloads contain independent visible stitches, and playback clamps to the completed design', () => {
  const segments = runningStitches([{ x: 0, y: 0 }, { x: 30, y: 0 }], 6, 4);
  const svg = stitchesSvg(segments);
  assert.equal((svg.match(/<path /g) ?? []).length, segments.length);
  assert.ok(svg.includes('fill="none"'));
  assert.ok(svg.includes('width="600" height="440"'));
  assert.equal(playbackPosition(0, 1000, 1000), 240);
  assert.equal(playbackPosition(990, 1000, 1000), 1000);
  assert.equal(playbackPosition(42, -20, 1000), 42);
  for (const study of studies) {
    assert.ok(studySvg(study).includes('fill-rule="evenodd"'));
    assert.ok(study.shapes.every(shape => shape.contours.every(path => (path.match(/M/g) ?? []).length === 1)));
  }
});


test('shared URL overrides use the selected drawing defaults for every omitted setting', () => {
  const horse = studies.find(study => study.id === 'horse')!;
  const saved = horse.defaults;
  try {
    horse.defaults = { length: 10, gap: 6, lineWidth: 3, fillLineWidth: 2, pattern: 'rows', spacing: 48, angle: 90 };
    assert.deepEqual(readSettings('drawing=horse'), defaultsForStudy(horse));
    assert.deepEqual(readSettings('drawing=horse&length=8&pattern=crosshatch'), {
      ...defaultsForStudy(horse), length: 8, pattern: 'crosshatch',
    });
  } finally { horse.defaults = saved; }
});

test('outline and fill flags independently control stitch generation', () => {
  const shape = { filled: true, contours: [rectangle(50, 50, 100, 100)] };
  const outline = generateStitches([shape], { ...options, outline: true, fill: false });
  assert.ok(outline.length > 0);
  assert.ok(outline.every(segment => segment.kind === 'outline'));
  const fill = generateStitches([shape], { ...options, outline: false, fill: true });
  assert.ok(fill.length > 0);
  assert.ok(fill.every(segment => segment.kind === 'fill'));
});


test('drawing-specific previews restore defaults and prefer the route drawing over the query', () => {
  for (const study of studies) {
    assert.equal(previewPath(study.id), `/studio/drawing-to-stitches/preview/${study.id}/`);
    assert.deepEqual(readSettings('', study.id), defaultsForStudy(study));
    assert.equal(readSettings('drawing=unknown&length=10', study.id).drawing, study.id);
    assert.equal(readSettings('drawing=unknown&length=10', study.id).length, 10);
  }
});
