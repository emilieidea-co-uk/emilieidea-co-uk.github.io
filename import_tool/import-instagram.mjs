import * as fs from 'node:fs/promises';
import { resolve, join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readZip, MAX_ARCHIVE } from './lib/read-zip.mjs';
import { CATEGORIES, validateManifest, imageFormat, imageId } from './extension/lib/model.mjs';
import { validateArtworks } from '../src/lib/artwork-data.mjs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
async function exists(path, io) {
  try { await io.access(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
export async function importArchive(archive, { root = ROOT, dryRun = false, io = fs } = {}) {
  const info = await io.stat(archive);
  if (!info.isFile() || info.size > MAX_ARCHIVE) throw new Error('Choose a ZIP file no larger than 200 MB.');
  const files = readZip(await io.readFile(archive));
  const json = files.get('manifest.json');
  if (!json || json.length > 1024 * 1024) throw new Error('ZIP needs a manifest.json smaller than 1 MB.');
  const manifest = validateManifest(JSON.parse(json.toString('utf8')));
  const expected = new Set(['manifest.json', ...manifest.posts.flatMap(post => post.images.map(image => image.path))]);
  if (files.size !== expected.size || [...files.keys()].some(name => !expected.has(name))) throw new Error('ZIP has unexpected or missing files.');
  for (const post of manifest.posts) {
    const hashes = new Set();
    for (const image of post.images) {
      const bytes = files.get(image.path);
      if (!bytes) throw new Error(`Missing media: ${image.path}`);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (digest !== image.sha256) throw new Error(`Media checksum mismatch: ${image.path}`);
      if (hashes.has(digest)) throw new Error(`Duplicate photo at different carousel positions: ${post.postId}`);
      hashes.add(digest);
      if (!image.path.endsWith(`.${imageFormat(bytes)}`)) throw new Error(`Image extension does not match its bytes: ${image.path}`);
      const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!metadata.width || !metadata.height || !['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1) throw new Error(`Unsupported photo: ${image.path}`);
      await decoder.resize(1, 1).toBuffer(); // Decode, rather than trusting a MIME type or signature alone.
    }
  }
  const lock = join(root, '.import-tool.lock');
  let locked = false, stage;
  const linked = [], changed = [];
  const originals = new Map();
  try {
    if (!dryRun) {
      try { await io.mkdir(lock); locked = true; }
      catch (error) { if (error.code === 'EEXIST') throw new Error('Another import is running (.import-tool.lock). See the recovery instructions if a previous process was interrupted.'); throw error; }
    }
    const manifests = {}, available = new Set(), identities = new Map(), ids = new Set();
    for (const category of CATEGORIES) {
      const path = join(root, 'src/data', `${category}.json`);
      const original = await io.readFile(path, 'utf8'); originals.set(category, original);
      manifests[category] = JSON.parse(original);
      for (const entry of manifests[category]) {
        if (await exists(join(root, 'src/assets', category, entry.file), io)) available.add(`${category}/${entry.file}`);
        if (entry.postId) {
          const key = `${entry.postId}:${entry.imageIndex}`;
          if (identities.has(key)) throw new Error(`Existing collections have duplicate Instagram identity ${key}. Resolve this before importing.`);
          identities.set(key, { category, entry });
        }
        ids.add(entry.id);
      }
    }
    validateArtworks(manifests, (category, file) => available.has(`${category}/${file}`));
    const additions = Object.fromEntries(CATEGORIES.map(category => [category, []]));
    const copies = [], skipped = [];
    for (const post of manifest.posts) {
      for (const image of post.images) {
        const key = `${post.postId}:${image.imageIndex}`;
        const old = identities.get(key);
        if (old) { skipped.push({ postId: post.postId, imageIndex: image.imageIndex, id: old.entry.id, category: old.category }); continue; }
        const id = imageId(post.postId, image.imageIndex);
        if (ids.has(id)) throw new Error(`ID ${id} already belongs to another image.`);
        ids.add(id);
        const file = basename(image.path), category = post.category;
        const target = join(root, 'src/assets', category, file);
        if (await exists(target, io)) throw new Error(`Refusing to overwrite an existing file: ${target}`);
        additions[category].push({ id, postId: post.postId, imageIndex: image.imageIndex, file,
          publish: false, caption: post.caption, date: new Date(post.date).toISOString(), postUrl: post.postUrl, tags: [] });
        available.add(`${category}/${file}`);
        copies.push({ category, file, target, data: files.get(image.path) });
      }
    }
    const updates = [];
    for (const category of CATEGORIES) {
      if (!additions[category].length) continue;
      additions[category].sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || a.postId.localeCompare(b.postId) || a.imageIndex - b.imageIndex);
      manifests[category] = [...additions[category], ...manifests[category]];
      updates.push(category);
    }
    validateArtworks(manifests, (category, file) => available.has(`${category}/${file}`));
    const report = { dryRun, posts: manifest.posts.length, imported: copies.length, skipped: skipped.length,
      preserved: skipped, collections: updates, errors: 0 };
    if (dryRun || !copies.length) return report;
    stage = await io.mkdtemp(join(root, '.import-tool-'));
    for (const category of updates) {
      await io.mkdir(join(stage, category));
      await io.mkdir(join(root, 'src/assets', category), { recursive: true });
      await io.writeFile(join(stage, `${category}.original.json`), originals.get(category));
      await io.writeFile(join(stage, `${category}.json`), JSON.stringify(manifests[category], null, 2) + '\n');
    }
    for (const copy of copies) {
      const source = join(stage, copy.category, copy.file);
      await io.writeFile(source, copy.data);
      await io.link(source, copy.target); // Atomic no-overwrite creation.
      linked.push(copy.target);
    }
    for (const category of updates) {
      await io.rename(join(stage, `${category}.json`), join(root, 'src/data', `${category}.json`));
      changed.push(category);
    }
    return report;
  } catch (error) {
    const recoveryErrors = [];
    for (const category of changed) {
      try { await io.writeFile(join(root, 'src/data', `${category}.json`), originals.get(category)); }
      catch (rollbackError) { recoveryErrors.push(rollbackError.message); }
    }
    if (!recoveryErrors.length) {
      for (const path of linked) { try { await io.unlink(path); } catch (rollbackError) { recoveryErrors.push(rollbackError.message); } }
    }
    if (recoveryErrors.length) {
      // Keep originals and the lock for explicit recovery rather than hiding a partial rollback.
      stage = undefined; locked = false;
      throw new Error(`${error.message}\nRollback needs attention: ${recoveryErrors.join('; ')}. Keep .import-tool-* backups and follow README.md recovery instructions.`);
    }
    throw error;
  } finally {
    if (stage) await io.rm(stage, { recursive: true, force: true });
    if (locked) await io.rmdir(lock);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), dryRun = args.includes('--dry-run');
  const paths = args.filter(arg => arg !== '--dry-run');
  if (paths.length !== 1 || paths[0].startsWith('--')) {
    console.error('Usage: npm run import:instagram -- <export.zip> [--dry-run]'); process.exitCode = 1;
  } else {
    try {
      const report = await importArchive(resolve(paths[0]), { dryRun });
      console.log(`${dryRun ? 'Dry run — no files changed' : 'Instagram import complete'}\nPosts: ${report.posts}\n${dryRun ? 'Would import' : 'Imported'} photos: ${report.imported}\nSkipped existing photos: ${report.skipped}\nErrors: 0`);
      if (report.imported) console.log('New images are unpublished. Review captions and set publish: true before pushing.');
    } catch (error) { console.error(`Import failed: ${error.message}`); process.exitCode = 1; }
  }
}
