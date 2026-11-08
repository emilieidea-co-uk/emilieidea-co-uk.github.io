import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { redactDiagnostics } from '../extension/lib/diagnostics.mjs';
import { addPost, validatePost, isMediaUrl, parsePostUrl, captureManualPhoto, removeManualPhoto } from '../extension/lib/model.mjs';
const source = await readFile(new URL('../extension/popup.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../extension/popup.html', import.meta.url), 'utf8');
const photo = index => ({ imageIndex: index, url: `https://scontent.cdninstagram.com/photo-${index}.jpg` });
const complete = { complete: true, postId: 'Example', postUrl: 'https://www.instagram.com/p/Example/', caption: 'Scanned caption', date: '2026-11-08T12:00:00Z', imageCount: 3, images: [1, 2, 3].map(photo) };
class Element {
  constructor(tagName) { this.tagName = tagName; this.listeners = {}; this.children = []; this.attributes = {}; this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; }
  append(...children) { this.children.push(...children); if (this.tagName === 'select' && !this.value && children[0]) this.value = children[0].value; }
  replaceChildren(...children) { this.children = []; if (this.tagName === 'select') this.value = ''; this.append(...children); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  async emit(type) { if (type === 'click' && this.disabled) return; return this.listeners[type]?.({}); }
}
async function workspace({ results = [complete], savedQueue = [], defer = false, profile = null, manualReads = [] } = {}) {
  const nodes = {}, created = [];
  for (const [, tag, id] of html.matchAll(/<(\w+)[^>]*\bid="([^"]+)"/g)) { nodes[id] = new Element(tag); created.push(nodes[id]); }
  nodes.category.value = 'artworks';
  const document = { getElementById: id => nodes[id], createElement: tag => { const node = new Element(tag); created.push(node); return node; }, querySelectorAll: () => created.filter(node => node.tagName === 'button') };
  const saved = { queue: savedQueue }, calls = [], messages = [], logs = [];
  let listener, resolveScan, confirmation = true, currentPost = 'Example', clipboard = '', clipboardFailure = false;
  const chrome = {
    runtime: { id: 'extension', onMessage: { addListener: handler => { listener = handler; } } },
    storage: { local: { get: async () => saved, set: async data => Object.assign(saved, data) } },
    tabs: {
      get: async () => ({ id: 3, url: profile ? 'https://www.instagram.com/emilie_idea_embroideries/' : `https://www.instagram.com/p/${currentPost}/` }),
      query: async query => query.url ? [{ id: 3, title: 'Instagram post' }] : [{ id: 3 }],
      getCurrent: async () => ({ id: 9, windowId: 1 }), update: async (...args) => { calls.push(['tab', ...args]); }, create: async () => ({ id: 3 }),
      sendMessage: async (tabId, message) => { messages.push(message); resolveScan?.({ complete: false, postId: 'Example', postUrl: complete.postUrl, images: [], reason: 'Collection cancelled.', cancelled: true }); return { cancelled: true }; },
    },
    scripting: { executeScript: async options => {
      calls.push(['script', options]);
      if (options.files?.[0] === 'content.js') return [{ result: profile }];
      if (options.files) return [];
      if (typeof options.args?.[0]?.diagnosticsOnly === 'boolean') return [{ result: manualReads.shift() }];
      if (defer) return [{ result: await new Promise(resolve => { resolveScan = resolve; }) }];
      return [{ result: results.shift() }];
    } },
    downloads: { onChanged: { addListener() {}, removeListener() {} }, download: async () => 1 },
  };
  const script = source.replace(/^import .+;\n/gm, '');
  await runInNewContext(`(async () => {${script}\n})()`, { document, chrome, crypto: webcrypto, URL, Blob, setTimeout,
    navigator: { clipboard: { writeText: async text => { if (clipboardFailure) throw new Error('Denied'); clipboard = text; } } },
    confirm: () => confirmation, addPost, validatePost, isMediaUrl, parsePostUrl, captureManualPhoto, removeManualPhoto, redactDiagnostics,
    importLog: (operation, data, level) => { logs.push({ operation, data: redactDiagnostics(data), level }); return redactDiagnostics(data); }, captureManualPhoto, removeManualPhoto, exportQueue: async () => new Uint8Array() });
  return { nodes, saved, calls, messages, logs, setConfirmation: value => { confirmation = value; },
    setPost: value => { currentPost = value; }, clipboard: () => clipboard, failClipboard: () => { clipboardFailure = true; },
    async untilScan() {
      for (let i = 0; i < 30 && !resolveScan; i++) await new Promise(resolve => setTimeout(resolve, 0));
      assert.ok(resolveScan, 'scan should start');
    },
    progress(images) {
      const options = calls.filter(call => call[0] === 'script' && call[1].args).at(-1)[1];
      listener({ type: 'scan-progress', jobId: options.args[0].jobId, postId: 'Example', phase: 'collecting', images, expectedCount: 3 }, { id: 'extension', tab: { id: 3 } });
    },
  };
}

test('workspace shows all scanned thumbnails, previews a photo, and adds a complete reviewed post once', async () => {
  const { nodes, saved } = await workspace();
  await nodes.auto.emit('click');
  assert.equal(nodes.photos.children.length, 3);
  assert.match(nodes['collection-summary'].textContent, /3 photos.*Complete/);
  assert.equal(nodes.capture.disabled, true);
  await nodes.photos.children[1].emit('click');
  assert.equal(nodes.preview.src, photo(2).url);
  assert.equal(nodes['preview-position'].textContent, 'Photo 2 / 3');
  nodes.reviewed.checked = true; await nodes.reviewed.emit('input');
  assert.equal(nodes.capture.disabled, false);
  await nodes.capture.emit('click');
  assert.equal(saved.queue.length, 1); assert.equal(saved.queue[0].images.length, 3);
  assert.equal(nodes.queue.children[0].children[1].children.length, 3);
  assert.equal(nodes.reviewed.checked, false);
});
test('partial scans cannot be added; retry preserves caption edits and allows confirmed replacement', async () => {
  const old = { ...complete, category: 'artworks', caption: 'Old edited caption' };
  const { nodes, saved, setConfirmation } = await workspace({ savedQueue: [old], results: [
    { complete: false, postId: 'Example', postUrl: complete.postUrl, images: [photo(1)], reason: 'Slide did not load' }, complete,
  ] });
  await nodes.auto.emit('click');
  assert.equal(nodes.photos.children.length, 1); assert.equal(nodes.retry.hidden, false);
  assert.match(nodes['collection-summary'].textContent, /Incomplete/);
  nodes.reviewed.checked = true; await nodes.reviewed.emit('input'); assert.equal(nodes.capture.disabled, true);
  nodes.caption.value = 'My new reviewed caption'; await nodes.caption.emit('input');
  await nodes.retry.emit('click');
  assert.equal(nodes.caption.value, 'My new reviewed caption');
  assert.equal(nodes.reviewed.checked, false);
  nodes.reviewed.checked = true; await nodes.reviewed.emit('input');
  setConfirmation(false); await nodes.capture.emit('click');
  assert.equal(saved.queue[0].caption, 'Old edited caption');
  setConfirmation(true); await nodes.capture.emit('click');
  assert.equal(saved.queue.length, 1); assert.equal(saved.queue[0].caption, 'My new reviewed caption');
});
test('Cancel remains enabled during collection and progress thumbnails do not make the draft exportable', async () => {
  const app = await workspace({ defer: true });
  const pending = app.nodes.auto.emit('click');
  await app.untilScan();
  assert.equal(app.nodes.cancel.hidden, false); assert.equal(app.nodes.cancel.disabled, false);
  assert.equal(app.nodes.read.disabled, true);
  app.progress([photo(1), photo(2)]);
  assert.equal(app.nodes.photos.children.length, 2); assert.equal(app.nodes.capture.disabled, true);
  await app.nodes.cancel.emit('click'); await pending;
  assert.equal(app.messages[0].type, 'cancel-scan');
  assert.equal(app.nodes.cancel.hidden, true);
  assert.equal(app.nodes.retry.hidden, false);
  assert.equal(app.nodes.capture.disabled, true);
  assert.equal(app.saved.queue.length, 0);
});
test('saved complete and incomplete legacy selections remain visible without silent rewriting', async () => {
  const completeOld = { ...complete, category: 'artworks' };
  const partialOld = { ...completeOld, postId: 'Partial', postUrl: 'https://www.instagram.com/p/Partial/', images: [photo(1)] };
  const app = await workspace({ savedQueue: [completeOld, partialOld] });
  assert.equal(app.nodes.queue.children.length, 2);
  assert.match(app.nodes.queue.children[1].children[0].textContent, /incomplete.*rescan/);
  assert.equal(app.saved.queue[1].images.length, 1);
});


test('profile discovery is unchanged and does not start a scanner until a photo post is opened', async () => {
  const profile = { kind: 'profile', username: 'emilie_idea_embroideries', posts: [{ postId: 'Example', postUrl: complete.postUrl, thumbnail: photo(1).url }] };
  const app = await workspace({ profile });
  await app.nodes.read.emit('click');
  assert.equal(app.nodes['profile-posts'].children.length, 1);
  assert.equal(app.nodes.category.value, 'embroideries');
  assert.equal(app.nodes.editor.hidden, true);
  assert.ok(!app.calls.some(call => call[0] === 'script' && call[1].args));
});


function manualPhoto(index, options = {}) {
  const postId = options.postId || 'Example';
  return { ok: true, postId, postUrl: `https://www.instagram.com/p/${postId}/`, caption: 'Post caption', date: complete.date,
    position: index, total: 3, selectedId: `candidate-${index}`, reason: 'topmost painted media',
    candidates: [{ candidateId: `candidate-${index}`, url: photo(index).url }],
    diagnostics: { readerVersion: '0.3.0-reader-1', postId, selected: `candidate-${index}`, candidates: [{ currentSrc: photo(index).url + '?signature=secret' }] }, ...options };
}
test('default manual reads capture photos 1, 2, and 3 without advancing Instagram or discarding edits', async () => {
  const app = await workspace({ manualReads: [manualPhoto(1), manualPhoto(2), manualPhoto(3)] });
  const { nodes } = app;
  await nodes.read.emit('click');
  assert.equal(nodes.preview.src, photo(1).url);
  assert.equal(nodes['image-index'].value, 1);
  await nodes['capture-photo'].emit('click');
  nodes.caption.value = 'My edited caption'; await nodes.caption.emit('input');
  await nodes.read.emit('click');
  assert.equal(nodes.preview.src, photo(2).url);
  assert.equal(nodes.photos.children.length, 1);
  assert.equal(nodes.caption.value, 'My edited caption');
  await nodes['capture-photo'].emit('click');
  await nodes.read.emit('click'); await nodes['capture-photo'].emit('click');
  assert.equal(nodes.photos.children.length, 3);
  assert.match(nodes['collection-summary'].textContent, /Complete/);
  nodes.reviewed.checked = true; await nodes.reviewed.emit('input'); await nodes.capture.emit('click');
  assert.deepEqual(Array.from(app.saved.queue[0].images, image => image.imageIndex), [1, 2, 3]);
  assert.equal(app.saved.queue[0].caption, 'My edited caption');
  assert.ok(!app.calls.some(call => call[0] === 'tab'), 'manual reads do not change tab focus or carousel position');
  assert.ok(!app.calls.some(call => call[0] === 'script' && call[1].args?.[0]?.jobId));
  assert.ok(app.logs.some(log => log.operation === 'current-photo-report'));
});
test('ambiguous previews require choosing a candidate and explicit unknown position/count values', async () => {
  const ambiguous = manualPhoto(1, { selectedId: null, position: undefined, total: undefined, reason: 'ambiguous', candidates: [
    { candidateId: 'one', url: photo(1).url }, { candidateId: 'two', url: photo(2).url },
  ] });
  const app = await workspace({ manualReads: [ambiguous] }); const { nodes } = app;
  await nodes.read.emit('click');
  assert.equal(nodes['capture-photo'].disabled, true);
  assert.equal(nodes['image-index'].value, ''); assert.equal(nodes['image-count'].value, '');
  await nodes.candidates.children[1].emit('click'); assert.equal(nodes.preview.src, photo(2).url);
  nodes['image-index'].value = '2'; nodes['image-count'].value = '3';
  await nodes['capture-photo'].emit('click');
  assert.equal(nodes.photos.children.length, 1);
  nodes.reviewed.checked = true; await nodes.reviewed.emit('input');
  assert.equal(nodes.capture.disabled, true, 'a gap cannot be exported');
});
test('duplicate capture logs an error; removal and a changed-post confirmation protect the draft', async () => {
  const app = await workspace({ manualReads: [manualPhoto(1), manualPhoto(2, { postId: 'Other' })] });
  await app.nodes.read.emit('click'); await app.nodes['capture-photo'].emit('click');
  app.nodes['image-index'].value = '2'; await app.nodes['capture-photo'].emit('click');
  assert.equal(app.nodes.photos.children.length, 1);
  assert.ok(app.logs.some(log => log.level === 'error' && /same photo/.test(log.data.message)));
  app.setPost('Other'); app.setConfirmation(false); await app.nodes.read.emit('click');
  assert.equal(app.nodes['post-url'].textContent, complete.postUrl);
  assert.equal(app.nodes.photos.children.length, 1);
  await app.nodes.photos.children[0].children[1].emit('click');
  assert.equal(app.nodes.photos.children.length, 0);
  assert.equal(app.nodes.capture.disabled, true);
});
test('failed reads clear the old candidate, retain captured images, and expose copyable diagnostics', async () => {
  const failure = { ...manualPhoto(2), ok: false, candidates: [], reason: 'No current photo', diagnostics: { error: { message: 'No current photo', stack: 'Error: no current photo' } } };
  const app = await workspace({ manualReads: [manualPhoto(1), failure] });
  await app.nodes.read.emit('click'); await app.nodes['capture-photo'].emit('click');
  await app.nodes.read.emit('click');
  assert.equal(app.nodes['capture-photo'].disabled, true);
  assert.equal(app.nodes.candidates.children.length, 0);
  assert.equal(app.nodes.photos.children.length, 1);
  await app.nodes['copy-diagnostics'].emit('click');
  assert.match(app.clipboard(), /No current photo/);
  assert.ok(app.logs.some(log => log.level === 'error' && log.operation === 'current-photo-report'));
});
test('diagnostics inspect without capturing and redact URLs in clipboard output, with a selectable fallback', async () => {
  const app = await workspace({ manualReads: [manualPhoto(1)] });
  await app.nodes.diagnose.emit('click');
  assert.equal(app.saved.queue.length, 0);
  await app.nodes['copy-diagnostics'].emit('click');
  assert.ok(!app.clipboard().includes('signature=secret'));
  app.failClipboard(); await app.nodes['copy-diagnostics'].emit('click');
  assert.equal(app.nodes['diagnostics-fallback'].hidden, false);
  assert.equal(app.nodes['diagnostics-output'].selected, true);
});


test('reading a queued partial post resumes its images without editing the saved queue before confirmation', async () => {
  const queued = { ...complete, complete: false, category: 'embroideries', images: [photo(1)] };
  const app = await workspace({ savedQueue: [queued], manualReads: [manualPhoto(2), manualPhoto(3)] });
  await app.nodes.read.emit('click');
  assert.equal(app.nodes.photos.children.length, 1);
  await app.nodes['capture-photo'].emit('click');
  assert.equal(app.nodes.photos.children.length, 2);
  assert.equal(app.saved.queue[0].images.length, 1);
  await app.nodes.read.emit('click'); await app.nodes['capture-photo'].emit('click');
  app.nodes.reviewed.checked = true; await app.nodes.reviewed.emit('input');
  await app.nodes.capture.emit('click');
  assert.equal(app.saved.queue[0].images.length, 3);
});
