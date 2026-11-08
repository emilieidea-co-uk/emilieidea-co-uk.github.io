import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { captureManualPhoto, removeManualPhoto } from '../extension/lib/model.mjs';
import { redactDiagnostics, importLog } from '../extension/lib/diagnostics.mjs';
const source = await readFile(new URL('../extension/lib/photo-reader.js', import.meta.url), 'utf8');
const scanner = await readFile(new URL('../extension/lib/scanner.js', import.meta.url), 'utf8');
function fixture({ paint = true, markers = false } = {}) {
  let active = 0, time = 0;
  const logs = [], hidden = new Set();
  const url = index => `https://scontent.cdninstagram.com/photo-${index + 1}.jpg?signature=signed123`;
  const bounds = { left: 20, top: 20, right: 420, bottom: 520, width: 400, height: 500 };
  const parents = [0, 1, 2].map(index => ({ parentElement: null, getBoundingClientRect: () => bounds,
    getAttribute: name => name === 'aria-hidden' && hidden.has(index) ? 'true' : name === 'aria-current' && markers && index === active ? 'true' : null,
    hasAttribute: () => false }));
  const images = parents.map((parentElement, index) => ({ tagName: 'IMG', parentElement, currentSrc: url(index), src: url(index), complete: true, naturalWidth: 800, naturalHeight: 1000, alt: 'Artwork',
    getBoundingClientRect: () => bounds, getAttribute(name) { return name === 'srcset' ? (this.srcset ?? `${url(index)} 1080w`) : null; } }));
  const root = { querySelectorAll(selector) {
    if (selector === 'img, video') return images;
    if (selector === '[aria-label], [aria-posinset], [aria-setsize]') return [{ getAttribute: name => name === 'aria-label' ? `${active + 1} of 3` : null }];
    return [];
  }, querySelector: selector => selector === 'h1' ? { innerText: 'Visible caption' } : selector === 'time[datetime]' ? { getAttribute: () => '2026-11-08T12:00:00Z' } : null };
  const document = { querySelectorAll: () => [], querySelector: selector => selector === 'main' ? root : null };
  if (paint) document.elementsFromPoint = () => [images[active], ...images.filter((image, index) => index !== active)];
  const context = {
    document, location: new URL('https://www.instagram.com/p/Example/'), URL, innerWidth: 1400, innerHeight: 900,
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', overflowX: 'visible', overflowY: 'visible' }),
    Date: class extends Date { static now() { return time; } },
    setTimeout: (fn, ms) => { time += ms; Promise.resolve().then(fn); return 1; }, clearTimeout() {},
    chrome: { runtime: { getManifest: () => ({ version: '0.3.0' }) } },
    console: Object.fromEntries(['info', 'warn', 'error', 'table'].map(level => [level, (...args) => logs.push({ level, args })])),
  };
  runInNewContext(source, context);
  return { reader: context.__eiPhotoReader, context, logs, images, hidden, setActive: index => { active = index; } };
}

test('manual reads follow the painted photo even while the first image remains at identical coordinates', async () => {
  const app = fixture();
  const first = await app.reader.snapshot({ postId: 'Example' });
  assert.equal(first.selectedId, 'candidate-1');
  app.setActive(1);
  const second = await app.reader.snapshot({ postId: 'Example' });
  assert.equal(second.selectedId, 'candidate-2');
  assert.match(second.candidates[0].url, /photo-2/);
  assert.equal(second.position, 2);
  assert.equal(second.diagnostics.candidates.length, 3, 'all retained DOM nodes are represented in diagnostics');
  assert.equal(second.candidates.length, 1, 'occluded first photo must not be offered as current');
});
test('unrelated stale srcset cannot replace the actual currentSrc', async () => {
  const app = fixture(); app.setActive(1);
  app.images[1].srcset = 'https://scontent.cdninstagram.com/photo-1.jpg?large=yes 2048w';
  const result = await app.reader.snapshot({ postId: 'Example' });
  assert.match(result.candidates[0].url, /photo-2/);
  assert.match(result.diagnostics.candidates[1].srcset[0], /photo-1/);
  app.images[1].currentSrc = 'https://scontent.cdninstagram.com/stale-image.jpg';
  const stale = await app.reader.snapshot({ postId: 'Example' });
  assert.equal(stale.ok, false); assert.equal(stale.diagnostics.candidates[1].stale, true);
});
test('active markers reject inactive ancestors; ambiguous reads require an explicit candidate choice', async () => {
  const marked = fixture({ paint: false, markers: true }); marked.setActive(2); marked.hidden.add(0);
  assert.equal(marked.reader.inspect().selected.id, 'candidate-3');
  assert.equal(marked.reader.inspect().report.candidates[0].rejection, 'inactive ancestor');
  const ambiguous = fixture({ paint: false });
  const result = await ambiguous.reader.snapshot({ postId: 'Example' });
  assert.equal(result.ok, true); assert.equal(result.selectedId, null);
  assert.equal(result.candidates.length, 3);
  assert.match(result.reason, /ambiguous/);
});
test('logs include versions, selection evidence, and full errors without signed CDN queries', async () => {
  const app = fixture();
  const result = await app.reader.snapshot({ postId: 'Example' });
  assert.equal(result.diagnostics.extensionVersion, '0.3.0');
  assert.ok(app.logs.some(log => log.level === 'info' && log.args[1] === 'read-current-photo'));
  assert.ok(app.logs.some(log => log.level === 'table'));
  assert.ok(!JSON.stringify(result.diagnostics).includes('signed123'));
  const failed = await app.reader.snapshot({ postId: 'Different' });
  assert.equal(failed.ok, false);
  assert.ok(failed.diagnostics.error.stack);
  assert.ok(app.logs.some(log => log.level === 'error'));
});
test('manual capture rejects duplicate assets and preserves original positions when removing and recapturing', () => {
  const photo = index => ({ url: `https://scontent.cdninstagram.com/photo-${index}.jpg` });
  let draft = { postId: 'Example', images: [] };
  draft = captureManualPhoto(draft, photo(1), 1, 3);
  assert.throws(() => captureManualPhoto(draft, { url: photo(1).url + '?different=query' }, 2, 3), /same photo/);
  draft = captureManualPhoto(draft, photo(3), 3, 3);
  assert.equal(draft.complete, false);
  draft = captureManualPhoto(draft, photo(2), 2, 3);
  assert.equal(draft.complete, true);
  draft = removeManualPhoto(draft, 2);
  assert.deepEqual(draft.images.map(image => image.imageIndex), [1, 3]);
  assert.equal(draft.complete, false);
  draft = captureManualPhoto(draft, photo(2), 2, 3);
  assert.equal(draft.complete, true);
});
test('diagnostic redaction covers nested URLs and workspace logging uses visible severity levels', t => {
  const calls = [];
  t.mock.method(console, 'error', (...args) => calls.push(args));
  const result = importLog('failure', { stack: 'Error at https://user:pass@example.com/a?token=secret#hash', token: 'never-log', child: { cookie: 'secret', asset: 'https://cdninstagram.com/photo.jpg?sig=secret' } }, 'error');
  assert.equal(calls[0][0], '[EmilieIdea Import]');
  assert.equal(result.stack, 'Error at https://example.com/a');
  assert.deepEqual(redactDiagnostics(result), result);
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('reinjection refreshes stale readers and refuses to silently reuse an older automatic scanner', () => {
  const app = fixture();
  app.context.__eiPhotoReader = { version: 'old' };
  runInNewContext(source, app.context);
  assert.equal(app.context.__eiPhotoReader.version, '0.3.0-reader-1');
  app.context.__eiScanner = { version: 1 };
  assert.throws(() => runInNewContext(scanner, app.context), /older scanner.*Reload/);
});
