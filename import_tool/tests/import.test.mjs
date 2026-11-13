import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { importArchive } from '../import-instagram.mjs';
import { readZip } from '../lib/read-zip.mjs';
import { createZip } from '../extension/lib/zip.mjs';
import { FORMAT, CATEGORIES, imageId } from '../extension/lib/model.mjs';

const photo = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#c98652' } }).jpeg().toBuffer();
const secondPhoto = await sharp({ create: { width: 24, height: 32, channels: 3, background: '#237858' } }).png().toBuffer();
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function makePost(postId = 'Example', category = 'embroideries', photos = [photo]) {
  return { postId, postUrl: `https://www.instagram.com/p/${postId}/`, category, caption: 'A stitched piece.\nSecond line.',
    date: '2026-11-07T12:00:00Z', imageCount: photos.length,
    images: photos.map((bytes, index) => ({ imageIndex: index + 1,
      path: `images/${imageId(postId, index + 1)}.${bytes === secondPhoto ? 'png' : 'jpg'}`, sha256: digest(bytes) })) };
}
function archive(posts, media, mutate = value => value) {
  const manifest = mutate({ format: FORMAT, version: 1, exportedAt: '2026-11-07T12:00:00Z', posts });
  return createZip([{ name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest)) }, ...media]);
}
function mediaFor(post, photos = [photo]) { return post.images.map((image, index) => ({ name: image.path, data: photos[index] })); }
async function project(t) {
  const root = await fs.mkdtemp(join(tmpdir(), 'ei-import-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(join(root, 'src/data'), { recursive: true });
  for (const category of CATEGORIES) {
    await fs.mkdir(join(root, 'src/assets', category), { recursive: true });
    await fs.writeFile(join(root, 'src/data', `${category}.json`), '[]\n');
  }
  return root;
}
async function putZip(root, bytes) { const file = join(root, 'export.zip'); await fs.writeFile(file, bytes); return file; }
async function manifest(root, category) { return JSON.parse(await fs.readFile(join(root, 'src/data', `${category}.json`), 'utf8')); }
async function snapshot(root) {
  const paths = await fs.readdir(root, { recursive: true });
  const result = {};
  for (const path of paths.sort()) {
    if ((await fs.stat(join(root, path))).isFile()) result[path] = (await fs.readFile(join(root, path))).toString('base64');
  }
  return result;
}

test('ZIP writer interoperates with Python, and reader accepts deflated ZIPs', () => {
  const zip = createZip([{ name: 'manifest.json', data: Buffer.from('{"hello":"刺绣"}') }]);
  const text = execFileSync('python3', ['-c', 'import sys,zipfile,io; z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())); print(z.read("manifest.json").decode())'], { input: zip, encoding: 'utf8' });
  assert.equal(JSON.parse(text).hello, '刺绣');
  const compressed = execFileSync('python3', ['-c', 'import sys,zipfile,io; b=io.BytesIO(); z=zipfile.ZipFile(b,"w",zipfile.ZIP_DEFLATED); z.writestr("manifest.json", "compressed"); z.close(); sys.stdout.buffer.write(b.getvalue())']);
  assert.equal(readZip(compressed).get('manifest.json').toString(), 'compressed');
});

test('single photos and full carousels import unpublished and repeat imports are byte-identical', async t => {
  const root = await project(t);
  const first = makePost(), carousel = makePost('Carousel', 'artworks', [photo, secondPhoto]);
  const zip = await putZip(root, archive([first, carousel], [...mediaFor(first), ...mediaFor(carousel, [photo, secondPhoto])]));
  const result = await importArchive(zip, { root });
  assert.equal(result.imported, 3);
  const artworks = await manifest(root, 'artworks');
  assert.deepEqual(artworks.map(entry => entry.imageIndex), [1, 2]);
  assert.ok(artworks.every(entry => !entry.publish));
  assert.ok(artworks.every(entry => Array.isArray(entry.tags) && entry.tags.length === 0));
  assert.equal(artworks[1].id, 'instagram-Carousel-02');
  const before = await snapshot(root);
  assert.equal((await importArchive(zip, { root })).skipped, 3);
  assert.deepEqual(await snapshot(root), before);
});

test('dry-run writes nothing and existing manual edits, IDs, filenames, and category survive', async t => {
  const root = await project(t), post = makePost('OldPost', 'artworks');
  const original = { id: 'saved-permanent-id', postId: 'OldPost', imageIndex: 1, file: 'renamed.jpg',
    caption: 'My edited caption', date: '2025-01-01T00:00:00Z', postUrl: post.postUrl, publish: true, tags: ['horse', 'textile-art'] };
  await fs.writeFile(join(root, 'src/data/scrapingby.json'), JSON.stringify([original]) + '\n');
  await fs.writeFile(join(root, 'src/assets/scrapingby/renamed.jpg'), photo);
  const next = makePost('NewPost');
  const zip = await putZip(root, archive([post, next], [...mediaFor(post), ...mediaFor(next)]));
  const before = await snapshot(root);
  const preview = await importArchive(zip, { root, dryRun: true });
  assert.equal(preview.imported, 1); assert.equal(preview.skipped, 1);
  assert.deepEqual(await snapshot(root), before);
  await importArchive(zip, { root });
  assert.deepEqual(await manifest(root, 'scrapingby'), [original]);
  assert.deepEqual(await manifest(root, 'artworks'), []);
});

test('validation failures, file collisions, and locks never partially change project files', async t => {
  const root = await project(t), post = makePost();
  const cases = [
    [archive([post], []), /missing files/],
    [archive([post], mediaFor(post), m => { m.posts[0].category = '../bad'; return m; }), /category/],
  ];
  // Rebuild after mutable fixture changes.
  const valid = makePost();
  cases.push([archive([valid], [{ name: valid.images[0].path, data: Buffer.from('not an image') }]), /checksum/]);
  cases.push([archive([makePost()], mediaFor(makePost()), m => { m.posts[0].imageCount = 2; return m; }), /incomplete/]);
  for (const [bytes, error] of cases) {
    const zip = await putZip(root, bytes), before = await snapshot(root);
    await assert.rejects(importArchive(zip, { root }), error);
    assert.deepEqual(await snapshot(root), before);
  }
  const corrupt = makePost();
  const fake = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0]); corrupt.images[0].sha256 = digest(fake);
  const zipBad = await putZip(root, archive([corrupt], [{ name: corrupt.images[0].path, data: fake }]));
  await assert.rejects(importArchive(zipBad, { root }));
  const zip = await putZip(root, archive([valid], mediaFor(valid)));
  await fs.writeFile(join(root, 'src/assets/embroideries', 'instagram-Example-01.jpg'), photo);
  const before = await snapshot(root);
  await assert.rejects(importArchive(zip, { root }), /overwrite/);
  assert.deepEqual(await snapshot(root), before);
  await fs.mkdir(join(root, '.import-tool.lock'));
  await assert.rejects(importArchive(zip, { root }), /Another import/);
  assert.ok((await fs.stat(join(root, '.import-tool.lock'))).isDirectory());
});

test('ordinary commit failure restores manifests and removes copied media', async t => {
  const root = await project(t), one = makePost('First', 'artworks'), two = makePost('Second', 'embroideries');
  const zip = await putZip(root, archive([one, two], [...mediaFor(one), ...mediaFor(two)]));
  const before = await snapshot(root);
  let renames = 0;
  const io = { ...fs, rename: async (...args) => { if (++renames === 2) throw new Error('Simulated disk error'); return fs.rename(...args); } };
  await assert.rejects(importArchive(zip, { root, io }), /Simulated disk error/);
  assert.deepEqual(await snapshot(root), before);
});

test('unsafe ZIP paths, duplicate paths, broken CRCs, and oversized declared entries are rejected', () => {
  assert.throws(() => createZip([{ name: '../escape.jpg', data: photo }]), /path/);
  const malicious = execFileSync('python3', ['-c', 'import sys,zipfile,io; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("../escape.jpg", "bad"); z.close(); sys.stdout.buffer.write(b.getvalue())']);
  assert.throws(() => readZip(malicious), /Unsafe/);
  const duplicate = execFileSync('python3', ['-W', 'ignore', '-c', 'import sys,zipfile,io; b=io.BytesIO(); z=zipfile.ZipFile(b,"w"); z.writestr("same.jpg", "one"); z.writestr("same.jpg", "two"); z.close(); sys.stdout.buffer.write(b.getvalue())']);
  assert.throws(() => readZip(duplicate), /duplicate/);
  const damaged = Buffer.from(createZip([{ name: 'one.jpg', data: photo }]));
  damaged[37] ^= 1;
  assert.throws(() => readZip(damaged), /checksum/);
  const oversized = Buffer.from(createZip([{ name: 'one.jpg', data: photo }]));
  const central = oversized.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  oversized.writeUInt32LE(26 * 1024 * 1024, central + 24);
  assert.throws(() => readZip(oversized), /oversized|Unsafe/);
});
