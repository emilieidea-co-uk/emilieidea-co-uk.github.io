import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { assignIdentity, validateArtworks, artworkTitle } from '../src/lib/artwork-data.mjs';
const example = {
  file: 'example_CncgbN7todm_02.jpg', caption: '', publish: false,
  date: '2026-11-07T12:00:00Z', postUrl: 'https://www.instagram.com/p/CncgbN7todm/',
};
test('separate carousel IDs, stable across renames and caption edits', () => {
  const entry = assignIdentity(example);
  assert.equal(entry.id, 'instagram-CncgbN7todm-02');
  assert.equal(entry.imageIndex, 2);
  assert.deepEqual(assignIdentity(entry), entry);
  const renamed = assignIdentity({ ...entry, file: 'new.jpg', caption: 'New caption' });
  assert.equal(renamed.id, entry.id);
  assert.equal(renamed.imageIndex, 2);
  assert.equal(assignIdentity({ ...example, file: 'example_CncgbN7todm.jpg' }).imageIndex, 1);
  const local = assignIdentity({ ...example, postUrl: '' });
  assert.equal(assignIdentity(local).id, local.id);
  validateArtworks({ artworks: [local] }, () => true);
  assert.throws(() => validateArtworks({ artworks: [local] }, () => false), /missing image/);
});
test('validation rejects duplicates, invalid indices and missing files, including unpublished images', () => {
  const entry = assignIdentity(example);
  validateArtworks({ artworks: [entry] }, () => true);
  assert.throws(() => validateArtworks({ artworks: [entry], scrapingby: [entry] }, () => true), /duplicate ID/);
  assert.throws(() => validateArtworks({ artworks: [{ ...entry, imageIndex: 0 }] }, () => true), /imageIndex/);
  assert.throws(() => validateArtworks({ artworks: [entry] }, () => false), /missing image/);
  assert.throws(() => validateArtworks({ artworks: [{ ...entry, caption: null }] }, () => true), /caption/);
  assert.throws(() => validateArtworks({ artworks: [{ ...entry, postId: 'other' }] }, () => true), /does not match/);
});
test('empty and long captions have usable titles', () => {
  assert.equal(artworkTitle({ ...example, id: 'test' }, 'Artworks'), 'Artworks · test');
  assert.equal(artworkTitle({ caption: '\n  First line\nSecond line' }, 'Artworks'), 'First line');
  assert.equal(artworkTitle({ caption: 'A'.repeat(100) }, 'Artworks').length, 80);
});
test('migration preserves existing metadata and produces no changes on a repeated run', async t => {
  const names = ['artworks', 'scrapingby', 'embroideries'];
  const before = await Promise.all(names.map(name => readFile(`src/data/${name}.json`, 'utf8')));
  // Exercise the writing migration in isolation, preserving the editor's JSON formatting.
  const root = await mkdtemp(join(tmpdir(), 'ei-ids-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['scripts', 'src/data', 'src/lib', ...names.map(name => `src/assets/${name}`)]) {
    await mkdir(join(root, directory), { recursive: true });
  }
  for (const file of ['scripts/assign-artwork-ids.mjs', 'src/lib/artwork-data.mjs', 'src/lib/artwork-tags.mjs']) {
    await copyFile(file, join(root, file));
  }
  for (const [i, name] of names.entries()) {
    await writeFile(join(root, `src/data/${name}.json`), before[i]);
    for (const entry of JSON.parse(before[i])) await writeFile(join(root, `src/assets/${name}/${entry.file}`), 'fixture');
  }
  const migrate = () => execFileSync(process.execPath, [join(root, 'scripts/assign-artwork-ids.mjs')]);
  const read = () => Promise.all(names.map(name => readFile(join(root, `src/data/${name}.json`), 'utf8')));
  migrate();
  const after = await read();
  assert.deepEqual(after.map(JSON.parse), before.map(JSON.parse));
  migrate();
  assert.deepEqual(await read(), after);
  const records = before.flatMap(text => JSON.parse(text));
  assert.ok(records.length > 0);
  assert.equal(new Set(records.map(entry => entry.id)).size, records.length);
  validateArtworks(Object.fromEntries(names.map((name, i) => [name, JSON.parse(before[i])])), () => true);

});
