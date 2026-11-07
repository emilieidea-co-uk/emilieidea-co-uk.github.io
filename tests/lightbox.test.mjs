import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Exercise the actual browser script with a small DOM adapter. No selectors,
// copying, or navigation logic is reimplemented by this test.
class Element {
  constructor() {
    this.listeners = {}; this.dataset = {}; this.hidden = false; this.value = '';
    this.attributes = {}; this.srcset = ''; this.currentSrc = '/preview.webp';
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  async emit(type, data = {}) { await this.listeners[type]?.({ target: this, ...data }); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
}

test('lightbox copies the selected artwork, updates with navigation, and offers a clipboard fallback', async () => {
  const script = await readFile(new URL('../src/lib/lightbox.mjs', import.meta.url), 'utf8');
  const lightbox = new Element();
  const nodes = Object.fromEntries(['img', 'caption', 'figure', 'close', 'prev', 'next', 'sharing', 'copy', 'status', 'url'].map(name => [`.lightbox__${name}`, new Element()]));
  lightbox.querySelector = selector => nodes[selector];
  const tiles = ['/artwork/first/', '/artwork/second/', undefined].map((url, index) => {
    const tile = new Element();
    tile.dataset = { artworkUrl: url, full: '/full.webp', caption: `Caption ${index}`, alt: `Art ${index}` };
    tile.querySelector = () => new Element();
    return tile;
  });
  const document = new Element();
  document.getElementById = () => lightbox;
  document.querySelectorAll = () => tiles;
  document.body = { style: {} };
  let copied;
  const navigator = { clipboard: { writeText: async text => { copied = text; } } };
  runInNewContext(script, { document, navigator, window: { location: { origin: 'https://example.com' } }, URL });
  await tiles[0].emit('click');
  assert.ok(lightbox.classList.contains('is-open'));
  assert.equal(nodes['.lightbox__caption'].textContent, 'Caption 0');
  assert.equal(lightbox.classList.contains('has-caption'), true);
  nodes['.lightbox__figure'].scrollTop = 200;
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(copied, 'https://example.com/artwork/first/');
  assert.equal(nodes['.lightbox__status'].textContent, 'Link copied');
  await nodes['.lightbox__next'].emit('click');
  assert.equal(nodes['.lightbox__figure'].scrollTop, 0);
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(copied, 'https://example.com/artwork/second/');
  navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(nodes['.lightbox__url'].hidden, false);
  assert.equal(nodes['.lightbox__url'].value, copied);
  assert.ok(nodes['.lightbox__url'].selected);
  assert.deepEqual(nodes['.lightbox__url'].selection, [0, copied.length]);
  await document.emit('keydown', { key: 'ArrowRight' });
  assert.equal(nodes['.lightbox__sharing'].hidden, true);
  assert.equal(lightbox.classList.contains('has-share-link'), false);
  await document.emit('keydown', { key: 'ArrowLeft' });
  assert.equal(nodes['.lightbox__sharing'].hidden, false);
  await document.emit('keydown', { key: 'Escape' });
  assert.equal(lightbox.attributes['aria-hidden'], 'true');
  assert.equal(document.body.style.overflow, '');
  assert.ok(tiles[1].focused);
});
