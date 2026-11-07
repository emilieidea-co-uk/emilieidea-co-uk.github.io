import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import sharp from 'sharp';
import { CATEGORIES, addCapture, validateManifest, validatePost, parsePostUrl, isMediaUrl, imageFormat } from '../extension/lib/model.mjs';
import { exportQueue } from '../extension/lib/export.mjs';
import { readZip } from '../lib/read-zip.mjs';
const content = await readFile(new URL('../extension/content.js', import.meta.url), 'utf8');
const post = { postId: 'TestPost', postUrl: 'https://www.instagram.com/p/TestPost/', category: 'embroideries',
  caption: 'A complete caption.\nWith a second line.', date: '2026-11-07T12:00:00Z', imageCount: 2 };
const url = index => `https://scontent-lhr.cdninstagram.com/photo-${index}.jpg`;

test('queue identifies carousel positions, keeps reviewed metadata, and rejects incomplete and duplicate captures', () => {
  const first = addCapture([], post, { imageIndex: 1, url: url(1) });
  assert.throws(() => validatePost(first[0]), /incomplete/);
  assert.throws(() => addCapture(first, post, { imageIndex: 1, url: url(2) }), /already captured/);
  assert.throws(() => addCapture(first, post, { imageIndex: 2, url: url(1) }), /already captured at another/);
  const complete = addCapture(first, { ...post, caption: 'Reviewed caption' }, { imageIndex: 2, url: url(2) });
  validatePost(complete[0]);
  assert.equal(complete.length, 1);
  assert.equal(complete[0].caption, 'Reviewed caption');
  assert.throws(() => addCapture([], { ...post, category: 'unknown' }, { imageIndex: 1, url: url(1) }), /category/);
  assert.throws(() => addCapture([], { ...post, date: 'invalid' }, { imageIndex: 1, url: url(1) }), /date/);
});

test('media URLs and post URLs are restricted to their intended hosts and formats', () => {
  assert.equal(parsePostUrl(post.postUrl + '?img_index=2').postId, 'TestPost');
  assert.equal(parsePostUrl('https://www.instagram.com/emilie_idea_embroideries/p/TestPost/').postId, 'TestPost');
  assert.throws(() => parsePostUrl('https://www.instagram.com/reel/Video/'), /photo post/);
  assert.throws(() => parsePostUrl('https://instagram.com.evil.test/p/Test/'), /photo post/);
  assert.ok(isMediaUrl(url(1)));
  for (const bad of ['http://scontent.cdninstagram.com/a.jpg', 'https://cdninstagram.com.evil.test/a.jpg', 'file:///tmp/a.jpg', 'https://user:password@cdninstagram.com/a.jpg', 'https://cdninstagram.com:123/a.jpg']) assert.equal(isMediaUrl(bad), false);
  assert.throws(() => imageFormat(Buffer.from('<html>login</html>')), /not a JPEG/);
});

test('actual export downloads photos and produces the versioned ZIP and checksums', async () => {
  const photos = await Promise.all(['red', 'blue'].map(background => sharp({ create: { width: 16, height: 16, channels: 3, background } }).jpeg().toBuffer()));
  const queue = [{ ...post, images: [{ imageIndex: 2, url: url(2) }, { imageIndex: 1, url: url(1) }] }];
  const requested = [];
  const fetchImpl = async (address, options) => { requested.push({ address, options }); return new Response(photos[address === url(1) ? 0 : 1]); };
  const verify = async bytes => { await sharp(bytes).metadata(); };
  const zip = await exportQueue(queue, { fetchImpl, verify });
  const files = readZip(zip), manifest = validateManifest(JSON.parse(files.get('manifest.json')));
  assert.deepEqual(manifest.posts[0].images.map(image => image.imageIndex), [1, 2]);
  assert.equal(manifest.posts[0].caption, post.caption);
  assert.equal(files.size, 3);
  assert.equal(requested.length, 2);
  assert.ok(requested.every(call => call.options.credentials === 'omit' && call.options.redirect === 'error'));
  const duplicateFetch = async () => new Response(photos[0]);
  await assert.rejects(exportQueue(queue, { fetchImpl: duplicateFetch, verify }), /repeats the same photo/);
  await assert.rejects(exportQueue(queue, { fetchImpl: async () => new Response('expired', { status: 403 }), verify }), /403/);
  await assert.rejects(exportQueue(queue, { fetchImpl: async () => new Response('<html>login</html>'), verify }), /not a JPEG/);
  await assert.rejects(exportQueue(queue, { fetchImpl: async () => new Response(photos[0], { headers: { 'content-length': String(26 * 1024 * 1024) } }), verify }), /25 MB/);
});

function profileDocument(paths) {
  return { querySelectorAll: () => paths.map(path => ({ getAttribute: () => path })) };
}
test('profile extraction lists loaded photo posts, deduplicates links, and excludes reels', () => {
  const result = runInNewContext(content, { location: new URL('https://www.instagram.com/emilie_idea_embroideries/'), URL,
    document: profileDocument(['/p/First/', '/p/First/?img_index=2', '/reel/Video/', '/emilie_idea_embroideries/p/Second/', 'https://example.com/p/Bad/']) });
  assert.equal(result.kind, 'profile');
  assert.equal(result.username, 'emilie_idea_embroideries');
  assert.deepEqual(Array.from(result.posts, post => post.postId), ['First', 'Second']);
  assert.throws(() => runInNewContext(content, { location: new URL('https://www.instagram.com/emilie_idea_embroideries/'), URL, document: profileDocument([]) }), /No photo posts/);
});
function postDocument({ caption = 'Full caption', date = '2026-11-07T12:00:00Z', video = false, images = true } = {}) {
  const image = { naturalWidth: 800, naturalHeight: 1000, alt: 'An embroidered patch', currentSrc: url(1), src: url(1),
    getBoundingClientRect: () => ({ width: 400, height: 500, top: 20, left: 20, bottom: 520, right: 420 }),
    getAttribute: () => `${url('small')} 320w, ${url('large')} 1080w` };
  const root = {
    querySelectorAll: selector => selector === 'img' ? (images ? [image] : []) : [],
    querySelector: selector => selector === 'video' ? video : selector === 'h1' ? { innerText: caption } : selector === 'time[datetime]' && date ? { getAttribute: () => date } : null,
  };
  return { querySelector: selector => selector === 'main' ? root : null, querySelectorAll: () => [] };
}
function extractPost(options) {
  return runInNewContext(content, { location: new URL(post.postUrl), document: postDocument(options), URL,
    innerWidth: 1440, innerHeight: 900, getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) });
}
test('post extraction reads visible DOM, selects highest srcset resolution, and flags missing metadata', () => {
  const result = extractPost();
  assert.equal(result.kind, 'post');
  assert.equal(result.caption, 'Full caption');
  assert.equal(result.candidates[0].url, url('large'));
  assert.equal(result.date, '2026-11-07T12:00:00Z');
  const missing = extractPost({ caption: '', date: '' });
  assert.equal(missing.warnings.length, 2);
  assert.throws(() => extractPost({ video: true }), /photo-only/);
  assert.throws(() => extractPost({ images: false }), /No loaded photo/);
});

test('extension package references existing local files and has no remote scripts or broad hosts', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['storage', 'scripting', 'downloads']);
  assert.ok(!manifest.host_permissions.includes('<all_urls>'));
  const html = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8');
  for (const [, id] of script.matchAll(/\$\('([^']+)'\)/g)) assert.ok(html.includes(`id="${id}"`), id);
  assert.ok(!/<script[^>]+src="https?:/.test(html));
  for (const file of [manifest.background.service_worker, ...Array.from(html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g), match => match[1])]) {
    assert.ok((await readFile(new URL(`../extension/${file}`, import.meta.url))).length);
  }
  assert.deepEqual(CATEGORIES, ['artworks', 'scrapingby', 'embroideries']);
});


test('toolbar reuses an existing workspace after a worker restart without broad tabs permission', async () => {
  const script = await readFile(new URL('../extension/background.js', import.meta.url), 'utf8');
  let click, contexts = [], created = 0, focused;
  const chrome = {
    action: { onClicked: { addListener: handler => { click = handler; } } },
    runtime: { getURL: file => `chrome-extension://example/${file}`, getContexts: async () => contexts },
    tabs: { create: async () => { created++; }, update: async id => { focused = id; } },
    windows: { update: async () => {} },
  };
  runInNewContext(script, { chrome });
  await click(); assert.equal(created, 1);
  contexts = [{ tabId: 7, windowId: 3 }];
  await click(); assert.equal(created, 1); assert.equal(focused, 7);
});
