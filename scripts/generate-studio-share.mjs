// Build-time sharing cards: one image per drawing, using its JSON defaults.
// Sharp and SVG processing never enter the browser bundle.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadStudioCatalog, studioRoot } from './studio-catalog.mjs';

const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function generateStudioShare(drawing) {
  const { length, gap, lineWidth, fillLineWidth, pattern, spacing, angle } = drawing.defaults;
  const [x, y, width, height] = drawing.viewBox;
  const scale = Math.min(600 / width, 440 / height);
  const transform = `translate(${(600 - width * scale) / 2} ${(440 - height * scale) / 2}) scale(${scale}) translate(${-x} ${-y})`;
  const path = (shape, attributes = '') => `<path d="${escape(shape.contours.join(' '))}" ${attributes}/>`;
  // clip-rule must be on each path (not a group) for Sharp's SVG renderer.
  const clipping = drawing.shapes.filter(shape => shape.filled)
    .map(shape => path(shape, `transform="${transform}" clip-rule="evenodd"`)).join('');
  const marks = [];
  const extent = Math.hypot(600, 440) / 2;
  if (drawing.hasFill && pattern === 'petals') {
    const radius = spacing * 1.5;
    const rowHeight = radius * Math.sqrt(3) / 2;
    const rows = Math.ceil((extent + radius) / rowHeight);
    const columns = Math.ceil((extent + radius) / radius);
    for (let row = -rows; row <= rows; row++) {
      for (let column = -columns; column <= columns; column++) {
        marks.push(`<circle cx="${300 + column * radius + Math.abs(row) % 2 * radius / 2}" cy="${220 + row * rowHeight}" r="${radius}"/>`);
      }
    }
  } else if (drawing.hasFill) {
    const rows = Math.ceil(extent / spacing);
    for (let row = -rows; row <= rows; row++) {
      marks.push(`<path d="M${300 - extent} ${220 + row * spacing}H${300 + extent}"/>`);
      if (pattern === 'crosshatch') marks.push(`<path d="M${300 + row * spacing} ${220 - extent}V${220 + extent}"/>`);
    }
  }
  const outline = drawing.hasOutline ? drawing.shapes.map(shape => path(shape)).join('') : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="#f5f1e7"/>
    <svg x="225" y="5" width="750" height="550" viewBox="0 0 600 440">
      <defs><clipPath id="drawing">${clipping}</clipPath></defs>
      <g clip-path="url(#drawing)" fill="none" stroke="#aaaaaa" stroke-width="${fillLineWidth}" stroke-dasharray="${length} ${gap}" stroke-linecap="round">
        <g transform="rotate(${angle} 300 220)">${marks.join('')}</g>
      </g>
      <g transform="${transform}" fill="none" stroke="#33332e" stroke-width="${lineWidth / scale}" stroke-dasharray="${length / scale} ${gap / scale}" stroke-linecap="round" stroke-linejoin="round">${outline}</g>
    </svg>
    <text x="600" y="575" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#33332e">EmilieIdea - Stitch</text>
    <text x="600" y="607" text-anchor="middle" font-family="Georgia, serif" font-size="21" fill="#66665e">${escape(drawing.name)}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Optional local inspection. Production PNGs are emitted by Astro's static
// /preview/[drawing]/share.png endpoint, automatically for every JSON drawing.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const output = join(studioRoot, '.astro/studio/share');
  await mkdir(output, { recursive: true });
  for (const study of loadStudioCatalog()) {
    const file = join(output, `${study.id}.png`);
    await writeFile(file, await generateStudioShare(study));
    console.log(`Generated ${file} (1200 × 630)`);
  }
}
