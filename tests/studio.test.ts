import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runningStitches, clipSegment, generateStitches, inside, stitchesSvg, playbackPosition } from '../src/studio/stitches.ts';
import { studies, initialStudy, studySvg } from '../src/studio/studies.ts';
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
  const selected = { ...DEFAULT_SETTINGS, drawing: 'lotus', pattern: 'crosshatch' as const, lineWidth: 3, fillLineWidth: .5, spacing: 48, angle: 90 };
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
  const lotus = studies.find(study => study.id === 'lotus')!;
  const saved = lotus.defaults;
  try {
    lotus.defaults = { length: 10, gap: 6, lineWidth: 3, fillLineWidth: 2, pattern: 'rows', spacing: 48, angle: 90 };
    assert.deepEqual(readSettings('drawing=lotus'), defaultsForStudy(lotus));
    assert.deepEqual(readSettings('drawing=lotus&length=8&pattern=crosshatch'), {
      ...defaultsForStudy(lotus), length: 8, pattern: 'crosshatch',
    });
  } finally { lotus.defaults = saved; }
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


test('Fu is the initial drawing and fallback, with two filled regions and a separate outline', () => {
  assert.equal(initialStudy.id, 'fu');
  assert.equal(DEFAULT_SETTINGS.drawing, 'fu');
  assert.equal(readSettings('').drawing, 'fu');
  assert.equal(readSettings('drawing=missing').drawing, 'fu');
  assert.equal(readSettings('drawing=horse').drawing, 'horse');
  for (const id of ['petals', 'lotus']) assert.equal(readSettings(`drawing=${id}`).drawing, id);
  assert.deepEqual(initialStudy.shapes.map(shape => shape.filled), [true, true, false]);
  assert.deepEqual(initialStudy.shapes.map(shape => shape.contours.length), [1, 5, 1]);
  assert.equal(initialStudy.hasOutline, true);
  assert.equal(initialStudy.hasFill, true);
  assert.ok(initialStudy.viewBox[2] < 140 && initialStudy.viewBox[3] < 150, 'Fu should be framed around its paths rather than the A4 page');
});


test('the supplied Horse has one filled silhouette and six separate unfilled details', () => {
  const horse = studies.find(study => study.id === 'horse')!;
  assert.equal(horse.order, 4);
  assert.equal(horse.hasOutline, true);
  assert.equal(horse.hasFill, true);
  assert.deepEqual(horse.shapes.map(shape => shape.filled), [true, false, false, false, false, false, false]);
  assert.ok(horse.shapes.every(shape => shape.contours.length === 1));
  assert.match(horse.shapes[0].contours[0], /[Zz]$/);
  assert.ok(horse.shapes.slice(1).every(shape => !/[Zz]$/.test(shape.contours[0])), 'detail paths must stay open');
  assert.ok(horse.viewBox[3] < 90, 'the inherited Fu viewBox must be fitted to the horse');
  assert.equal(initialStudy.id, 'fu');
});


test('Lotus preserves 23 unfilled paths, including five closed contours, and retires Flower', () => {
  const lotus = studies.find(study => study.id === 'lotus')!;
  assert.equal(lotus.order, 2);
  assert.equal(lotus.hasOutline, true);
  assert.equal(lotus.hasFill, false);
  assert.equal(lotus.shapes.length, 23);
  assert.ok(lotus.shapes.every(shape => !shape.filled && shape.contours.length === 1));
  assert.equal(lotus.shapes.filter(shape => /[Zz]$/.test(shape.contours[0])).length, 5);
  assert.equal(lotus.originalPost, '/artwork/instagram-Bj-q5OPhjqt-01/');
  assert.ok(lotus.viewBox[3] < 110, 'the viewBox should fit Lotus rather than retain Fu framing');
  assert.equal(studies.some(study => study.id === 'flower'), false);
  assert.equal(readSettings('drawing=flower').drawing, 'fu');
});
