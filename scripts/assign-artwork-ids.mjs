import { readFile, writeFile, access } from 'node:fs/promises';
import { assignIdentity, validateArtworks } from '../src/lib/artwork-data.mjs';
const root = new URL('../', import.meta.url);
const manifests = {};
const available = new Set();
for (const collection of ['artworks', 'scrapingby', 'embroideries']) {
  const entries = JSON.parse(await readFile(new URL(`src/data/${collection}.json`, root), 'utf8'));
  manifests[collection] = entries.map(assignIdentity);
  for (const entry of entries) {
    await access(new URL(`src/assets/${collection}/${entry.file}`, root));
    available.add(`${collection}/${entry.file}`);
  }
}
validateArtworks(manifests, (collection, file) => available.has(`${collection}/${file}`));
for (const [collection, entries] of Object.entries(manifests)) {
  const path = new URL(`src/data/${collection}.json`, root);
  const result = JSON.stringify(entries, null, 2) + '\n';
  if (await readFile(path, 'utf8') !== result) await writeFile(path, result);
  console.log(`${collection}: ${entries.length} permanent image IDs validated`);
}
