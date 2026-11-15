// Generate final light/dark category logos directly from the original artwork.
// Keep the light artwork intact. Dark mode removes white and maps RGB to 225-x.
// Intermediate artwork stays in memory. Run gen:icons afterward for app icons.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(SCRIPTS, '..', 'src', 'assets');
const source = join(ASSETS, 'ei_logo.jpg');

const original = await sharp(source).rotate().png().toBuffer();
const template = await readFile(join(SCRIPTS, 'ei-logo-template.svg'), 'utf8');
const sourceImage = `data:image/png;base64,${original.toString('base64')}`;

// Place individual SVG glyphs on the lower arc. This also works in librsvg,
// whose textPath support differs from browser SVG rendering.
async function curvedLetters(label) {
  const letters = await Promise.all([...label].map(async (letter) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="140"><text x="40" y="100" font-family="Times New Roman, Times, serif" font-size="76">${letter}</text></svg>`;
    const { info } = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true });
    return { letter, advance: info.width + 5 };
  }));
  const total = letters.reduce((sum, glyph) => sum + glyph.advance, 0);
  let cursor = -total / 2;
  return letters.map(({ letter, advance }) => {
    const angle = Math.PI / 2 - (cursor + advance / 2) / 260;
    cursor += advance;
    const x = 316.5 + 260 * Math.cos(angle);
    const y = 312 + 260 * Math.sin(angle);
    const rotation = (angle - Math.PI / 2) * 180 / Math.PI;
    return `<text transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${rotation.toFixed(3)})">${letter}</text>`;
  }).join('');
}

async function darkVariant(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    // White paper and monogram details become transparent cutouts.
    const ink = Math.max(0, Math.min(1, (250 - Math.min(data[i], data[i + 1], data[i + 2])) / 25));
    data[i + 3] = Math.round(data[i + 3] * ink);
    for (let channel = 0; channel < 3; channel++) {
      data[i + channel] = Math.max(0, 225 - data[i + channel]);
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png().toBuffer();
}

// Match the existing final logos: trim outside margins and scale to 805px.
// Both themes share dimensions, preserving white details in the light artwork.
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
async function displayLogos(light) {
  const trimmed = await sharp(light).trim().toBuffer();
  const metadata = await sharp(trimmed).metadata();
  const scale = 805 / Math.max(metadata.width, metadata.height);
  const width = Math.round(metadata.width * scale);
  const height = Math.round(metadata.height * scale);
  const lightLogo = await sharp(trimmed).resize(width, height).png().toBuffer();
  const darkTrimmed = await sharp(await darkVariant(light)).trim().toBuffer();
  const darkLogo = await sharp(darkTrimmed)
    .resize(width, height, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();
  return { lightLogo, darkLogo };
}

for (const [category, id] of [['Embroideries', 'embroideries'], ['ScrapingBy', 'scrapingby'], ['Artworks', 'artworks']]) {
  // Retain the supplied lettering for the embroidery logo.
  const light = category === 'Embroideries' ? original : await sharp(Buffer.from(
    template.replace('{{SOURCE_IMAGE}}', sourceImage).replace('{{CATEGORY_LETTERS}}', await curvedLetters(category))
  )).png().toBuffer();
  const { lightLogo, darkLogo } = await displayLogos(light);
  await sharp(lightLogo).toFile(join(ASSETS, `ei-${id}-light.png`));
  await sharp(darkLogo).toFile(join(ASSETS, `ei-${id}-dark.png`));
  console.log(`generated ${category} light and dark display logos`);
}
console.log('Done. Now run: npm run gen:icons');
