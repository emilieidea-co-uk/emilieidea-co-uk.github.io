// Generate app icons from the final Artworks light/dark display logos.
// Artworks supplies the favicons and Apple touch icon.
// Run npm run gen:brand first to refresh the display logos.
// The social share image is refreshed separately with --og-only.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(__dirname, '..', 'src', 'assets');
const PUBLIC = join(__dirname, '..', 'public');

const CREAM = '#fcfcfb'; // site light background (for the opaque iOS icon)
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Center an image on a transparent square canvas of `size`, with `pad` px margin.
async function squarePadded(input, size, pad) {
  const inner = size - pad * 2;
  const fitted = await sharp(input).resize(inner, inner, { fit: 'contain', background: TRANSPARENT }).toBuffer();
  return sharp(fitted)
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: TRANSPARENT })
    .png()
    .toBuffer();
}

async function main() {
  // Artworks is the main site brand. Category logos are produced by gen:brand.
  const lightLogo = await readFile(join(ASSETS, 'ei-artworks-light.png'));
  const darkLogo = await readFile(join(ASSETS, 'ei-artworks-dark.png'));

  // 2) Theme-aware favicons (transparent, a little breathing room).
  await sharp(await squarePadded(lightLogo, 256, 14)).toFile(join(PUBLIC, 'favicon.png'));
  await sharp(await squarePadded(darkLogo, 256, 14)).toFile(join(PUBLIC, 'favicon-dark.png'));

  // 3) Apple touch icon — iOS ignores transparency, so flatten onto the cream bg.
  await sharp(await squarePadded(lightLogo, 180, 16))
    .flatten({ background: CREAM })
    .png()
    .toFile(join(PUBLIC, 'apple-touch-icon.png'));

  for (const f of [
    'src/assets/ei-embroideries-light.png',
    'src/assets/ei-embroideries-dark.png',
    'src/assets/ei-scrapingby-light.png',
    'src/assets/ei-scrapingby-dark.png',
    'src/assets/ei-artworks-light.png',
    'src/assets/ei-artworks-dark.png',
    'public/favicon.png',
    'public/favicon-dark.png',
    'public/apple-touch-icon.png',
  ]) {
    const m = await sharp(join(__dirname, '..', f)).metadata();
    console.log('  ' + f.padEnd(32), m.width + 'x' + m.height, m.hasAlpha ? 'alpha' : 'opaque');
  }
  console.log('Done.');
}

await main();
