import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { generateStudioShare } from '../scripts/generate-studio-share.mjs';

test('rasterized fill-only sharing cards contain stitches and keep compound-path holes empty', async () => {
  const png = await generateStudioShare({
    name: 'Test drawing', hasOutline: false, hasFill: true, viewBox: [0, 0, 600, 440],
    defaults: { length: 6, gap: 4, lineWidth: 1.35, fillLineWidth: 1, pattern: 'rows', spacing: 28, angle: 0 },
    shapes: [{ filled: true, contours: ['M150 70H450V370H150Z', 'M270 190H330V250H270Z'] }],
  });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1200); assert.equal(info.height, 630);
  const paper = [245, 241, 231];
  const different = (x, y) => paper.some((value, channel) => Math.abs(data[(y * info.width + x) * info.channels + channel] - value) > 5);
  let stitches = 0;
  for (let y = 0; y < 540; y++) {
    for (let x = 0; x < info.width; x++) if (different(x, y)) stitches++;
  }
  assert.ok(stitches > 500, 'clipping must not discard the pattern');
  for (let y = 250; y < 310; y++) {
    for (let x = 570; x < 630; x++) assert.equal(different(x, y), false, 'the central hole must stay unstitched');
  }
  for (let y = 0; y < 540; y++) assert.equal(different(100, y), false, 'stitches must stay inside the drawing');
});
