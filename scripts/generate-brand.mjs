// Convert the supplied Emilie Idea logo into the two theme source PNGs.
// Keep the light artwork intact. Dark mode removes white and maps RGB to 225-x.
// Run npm run gen:icons afterward to refresh displayed logos and app icons.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(SCRIPTS, '..', 'src', 'assets');
const source = join(ASSETS, 'ei_logo.jpg');

const original = await sharp(source).rotate().png().toBuffer();
const template = await readFile(join(SCRIPTS, 'category-seal.svg'), 'utf8');
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

for (const [category, suffix] of [['Embroideries', ''], ['ScrapingBy', '-scrapingby'], ['Artworks', '-artworks']]) {
  // The original embroidery logo remains byte-for-byte faithful to the input.
  const light = category === 'Embroideries' ? original : await sharp(Buffer.from(
    template.replace('{{SOURCE_IMAGE}}', sourceImage).replace('{{CATEGORY_LETTERS}}', await curvedLetters(category))
  )).png().toBuffer();
  await sharp(light).toFile(join(ASSETS, `logo-seal${suffix}-light.png`));
  await sharp(await darkVariant(light)).toFile(join(ASSETS, `logo-seal${suffix}-dark.png`));
  console.log(`generated ${category} light and dark source logos`);
}
console.log('Done. Now run: npm run gen:icons');
