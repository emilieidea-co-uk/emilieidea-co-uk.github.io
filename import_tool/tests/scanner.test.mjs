import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { addPost } from '../extension/lib/model.mjs';
const reader = await readFile(new URL('../extension/lib/photo-reader.js', import.meta.url), 'utf8');
const source = await readFile(new URL('../extension/lib/scanner.js', import.meta.url), 'utf8');
function library(extra = {}) {
  const context = { URL, AbortController, setTimeout, clearTimeout, ...extra };
  runInNewContext(reader, context);
  runInNewContext(source, context);
  return context.__eiScanner;
}
function carousel({ count = 4, initial = 0, explicitCount = true, failStep = false, delay = 0, videoAt, changePostAt, repeatedAt } = {}) {
  let index = initial, time = 0, pending;
  const moves = [], progress = [];
  const state = () => ({
    postId: index === changePostAt ? 'Other' : 'Example', postUrl: 'https://www.instagram.com/p/Example/',
    caption: 'Caption once', date: '2026-11-08T12:00:00Z', loaded: !pending,
    key: `photo-${index === repeatedAt ? 0 : index}`, image: { url: `https://scontent.cdninstagram.com/photo-${index}.jpg` },
    prev: index > 0, next: index < count - 1, video: index === videoAt,
    position: explicitCount ? index + 1 : undefined, total: explicitCount ? count : undefined, minimumCount: explicitCount ? count : 1,
  });
  const options = {
    postId: 'Example', read: state, now: () => time,
    step: async direction => {
      moves.push(direction);
      if (!failStep) pending = { index: index + (direction === 'next' ? 1 : -1), at: time + delay };
    },
    wait: async ms => { time += ms; if (pending && time >= pending.at) { index = pending.index; pending = undefined; } },
    progress: update => progress.push(update),
  };
  return { options, moves, progress, state };
}

test('rewinds a middle slide and collects every photo in its original order', async () => {
  const { options, moves } = carousel({ initial: 2, delay: 300 });
  const result = await library().scanCarousel(options);
  assert.equal(result.complete, true);
  assert.deepEqual(Array.from(result.images, image => image.imageIndex), [1, 2, 3, 4]);
  assert.deepEqual(Array.from(result.images, image => image.url.split('/').pop()), ['photo-0.jpg', 'photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg']);
  assert.deepEqual(moves, ['prev', 'prev', 'next', 'next', 'next']);
  assert.equal(result.caption, 'Caption once');
});
test('single photos and boundary-identified carousels work without explicit count labels', async () => {
  for (const count of [1, 4]) {
    const result = await library().scanCarousel(carousel({ count, explicitCount: false }).options);
    assert.equal(result.complete, true);
    assert.equal(result.imageCount, count);
  }
});
test('failed transitions, missing boundaries, repeated slides, videos, and navigation produce incomplete drafts', async () => {
  for (const [settings, message] of [
    [{ failStep: true }, /did not load|did not advance/],
    [{ videoAt: 1 }, /photo-only/],
    [{ changePostAt: 1 }, /another post/],
    [{ repeatedAt: 2 }, /repeated a photo/],
  ]) {
    const result = await library().scanCarousel(carousel(settings).options);
    assert.equal(result.complete, false);
    assert.match(result.reason, message);
    assert.ok(result.images.length < 4);
  }
  const missing = carousel();
  const read = missing.options.read;
  missing.options.read = () => ({ ...read(), next: false });
  const result = await library().scanCarousel(missing.options);
  assert.equal(result.complete, false); assert.match(result.reason, /boundary|count/);
});
test('timeouts and cancellation cannot be treated as the last photo', async () => {
  const slow = carousel({ delay: 10000 }); slow.options.overallMs = 1000;
  const timed = await library().scanCarousel(slow.options);
  assert.equal(timed.complete, false); assert.match(timed.reason, /two minutes/);
  const controller = new AbortController(), cancelled = carousel();
  cancelled.options.signal = controller.signal;
  cancelled.options.progress = update => { if (update.images.length === 2) controller.abort(); };
  const result = await library().scanCarousel(cancelled.options);
  assert.equal(result.complete, false); assert.equal(result.cancelled, true);
  assert.equal(result.images.length, 2);
});
test('complete posts are added atomically, and replacing a queue entry requires confirmation', async () => {
  const draft = await library().scanCarousel(carousel().options);
  const post = { ...draft, category: 'embroideries', caption: 'Reviewed caption' };
  const queue = addPost([], post);
  assert.equal(queue.length, 1); assert.equal(queue[0].images.length, 4);
  assert.equal(queue[0].caption, 'Reviewed caption');
  assert.throws(() => addPost(queue, post), /Confirm replacement/);
  const replacement = addPost(queue, { ...post, caption: 'Edited once' }, { replace: true });
  assert.equal(replacement[0].caption, 'Edited once'); assert.equal(queue[0].caption, 'Reviewed caption');
  assert.throws(() => addPost(queue, { ...post, images: post.images.slice(0, 1) }, { replace: true }), /incomplete/);
});

function domFixture({ count = 4, initial = 0, unknownNext = false, ambiguous = false, video = false } = {}) {
  let index = initial;
  const location = new URL('https://www.instagram.com/p/Example/');
  const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height, width, height });
  const clipping = { parentElement: null, getBoundingClientRect: () => box(20, 20, 400, 500) };
  const image = (offset = 0) => ({ tagName: video ? 'VIDEO' : 'IMG', parentElement: clipping, complete: true, naturalWidth: 1080, naturalHeight: 1350, alt: 'Artwork',
    get src() { return `https://scontent.cdninstagram.com/photo-${index + offset}.jpg`; },
    getBoundingClientRect: () => box(20 + offset * 400, 20, 400, 500),
    getAttribute(name) { return name === 'srcset' ? `${this.src} 1080w` : null; },
  });
  const button = direction => {
    const node = { parentElement: null, disabled: false, getAttribute: name => name === 'aria-label' ? direction === 'prev' ? 'Go back' : unknownNext ? 'Unrecognised' : 'Next' : null,
      querySelector: () => null, closest: () => node, getBoundingClientRect: () => box(direction === 'prev' ? 20 : 390, 250, 30, 30),
      click: () => { index += direction === 'prev' ? -1 : 1; } };
    return node;
  };
  const root = {
    querySelectorAll(selector) {
      if (selector === 'img, video') {
        const first = image();
        if (ambiguous) { const second = image(1); second.parentElement = null; second.getBoundingClientRect = () => box(430, 20, 400, 500); return [first, second]; }
        return [first, image(1)]; // Offscreen neighbouring slide must be clipped out.
      }
      if (selector === 'button, [role="button"]') return [...(index ? [button('prev')] : []), ...(index < count - 1 ? [button('next')] : [])];
      if (selector === '[aria-label], [aria-posinset], [aria-setsize]') return [{ getAttribute: name => name === 'aria-label' ? `${index + 1} of ${count}` : null }];
      return [];
    },
    querySelector: selector => selector === 'h1' ? { innerText: 'Caption from the visible post' } : selector === 'time[datetime]' ? { getAttribute: () => '2026-11-08T12:00:00Z' } : null,
  };
  const document = { querySelectorAll: () => [], querySelector: selector => selector === 'main' ? root : null };
  const getComputedStyle = element => ({ display: 'block', visibility: 'visible', opacity: '1', overflowX: element === clipping ? 'hidden' : 'visible', overflowY: 'visible' });
  return { document, location, innerWidth: 1400, innerHeight: 900, getComputedStyle };
}
test('DOM adapter scopes arrows to media, clips neighbouring slides, and reads visible caption/count', () => {
  const scanner = library(domFixture({ initial: 2 }));
  const state = scanner.readDom();
  assert.equal(state.loaded, true); assert.equal(state.position, 3); assert.equal(state.total, 4);
  assert.equal(state.prev, true); assert.equal(state.next, true);
  assert.match(state.image.url, /photo-2/);
  assert.equal(state.caption, 'Caption from the visible post');
  state.controls.prev.element.click();
  assert.equal(scanner.readDom().position, 2);
  assert.throws(() => library(domFixture({ unknownNext: true })).readDom(), /unrecognised/);
  assert.throws(() => library(domFixture({ ambiguous: true })).readDom(), /ambiguous visible/);
  assert.equal(library(domFixture({ video: true })).readDom().video, true);
});

test('injected scan cancellation is acknowledged and its listener is removed', async () => {
  let listener;
  const chrome = { runtime: { id: 'extension', onMessage: { addListener: fn => { listener = fn; }, removeListener: fn => { if (listener === fn) listener = undefined; } }, sendMessage: async () => {} } };
  const scanner = library({ ...domFixture(), chrome });
  const pending = scanner.run({ jobId: 'job', postId: 'Example' });
  let acknowledged;
  listener({ type: 'cancel-scan', jobId: 'job' }, { id: 'extension' }, result => { acknowledged = result; });
  const result = await pending;
  assert.equal(acknowledged.cancelled, true); assert.equal(result.cancelled, true); assert.equal(listener, undefined);
});

test('whole-post scan exports and imports all photos through the unchanged ZIP interface', async t => {
  const { default: sharp } = await import('sharp');
  const fs = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { exportQueue } = await import('../extension/lib/export.mjs');
  const { importArchive } = await import('../import-instagram.mjs');
  const root = await fs.mkdtemp(join(tmpdir(), 'ei-scan-roundtrip-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(join(root, 'src/data'), { recursive: true });
  for (const category of ['artworks', 'scrapingby', 'embroideries']) await fs.writeFile(join(root, 'src/data', `${category}.json`), '[]\n');
  const scanned = await library().scanCarousel(carousel({ initial: 2 }).options);
  const queue = addPost([], { ...scanned, category: 'embroideries' });
  const media = await Promise.all(['red', 'blue', 'green', 'black'].map(background => sharp({ create: { width: 24, height: 32, channels: 3, background } }).jpeg().toBuffer()));
  const bytes = await exportQueue(queue, {
    fetchImpl: async url => new Response(media[Number(url.match(/photo-(\d+)/)[1])]),
    verify: async data => { await sharp(data).metadata(); },
  });
  const path = join(root, 'export.zip'); await fs.writeFile(path, bytes);
  assert.equal((await importArchive(path, { root })).imported, 4);
  const entries = JSON.parse(await fs.readFile(join(root, 'src/data/embroideries.json'), 'utf8'));
  assert.deepEqual(entries.map(entry => entry.id), [1, 2, 3, 4].map(index => `instagram-Example-0${index}`));
  assert.ok(entries.every(entry => entry.publish === false));
  assert.equal((await importArchive(path, { root })).skipped, 4);
});
