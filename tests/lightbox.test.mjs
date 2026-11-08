import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Run the actual browser script. This adapter supplies DOM focus, visibility,
// ancestry, and events; keyboard and copy behaviour come entirely from the script.
class Element {
  constructor(document, { tabIndex = -1, parent = null } = {}) {
    this.ownerDocument = document; this.parentElement = parent; this.tabIndex = tabIndex;
    this.listeners = {}; this.dataset = {}; this.hidden = false; this.disabled = false;
    this.rendered = true; this.visibility = 'visible'; this.value = ''; this.isConnected = true;
    this.attributes = {}; this.srcset = ''; this.currentSrc = '/preview.webp';
    const classes = new Set();
    this.classList = {
      add: value => classes.add(value), remove: value => classes.delete(value),
      contains: value => classes.has(value),
      toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value),
    };
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  async emit(type, data = {}) {
    const event = { target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...data };
    await this.listeners[type]?.(event);
    return event;
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  closest() {
    for (let node = this; node; node = node.parentElement) if (node.hidden) return node;
    return null;
  }
  matches() { return this.disabled; }
  getClientRects() { return this.rendered && !this.closest() ? [{}] : []; }
  contains(target) {
    for (let node = target; node; node = node.parentElement) if (node === this) return true;
    return false;
  }
  focus() {
    if (this.disabled || this.closest() || !this.rendered) return;
    this.ownerDocument.activeElement = this;
    this.ownerDocument.listeners.focusin?.({ target: this });
  }
  select() { this.selected = true; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
}
const script = await readFile(new URL('../src/lib/lightbox.mjs', import.meta.url), 'utf8');
function setup({ overflow = '' } = {}) {
  const document = { listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } };
  document.emit = Element.prototype.emit;
  document.body = new Element(document); document.body.style = { overflow };
  document.activeElement = document.body;
  const lightbox = new Element(document, { parent: document.body });
  const nodes = Object.fromEntries(['img', 'caption', 'figure', 'close', 'prev', 'next', 'sharing', 'copy', 'status', 'url'].map(name =>
    [`.lightbox__${name}`, new Element(document, { parent: lightbox, tabIndex: ['figure', 'close', 'prev', 'next', 'copy', 'url'].includes(name) ? 0 : -1 })]));
  nodes['.lightbox__copy'].parentElement = nodes['.lightbox__sharing'];
  nodes['.lightbox__url'].parentElement = nodes['.lightbox__sharing'];
  const order = ['close', 'prev', 'figure', 'copy', 'url', 'next'];
  lightbox.querySelector = selector => nodes[selector];
  lightbox.querySelectorAll = () => order.map(name => nodes[`.lightbox__${name}`]);
  const tiles = ['/artwork/first/', '/artwork/second/', undefined].map((url, index) => {
    const tile = new Element(document, { parent: document.body, tabIndex: 0 });
    tile.dataset = { artworkUrl: url, full: '/full.webp', caption: `Caption ${index}`, alt: `Art ${index}` };
    tile.querySelector = () => new Element(document);
    return tile;
  });
  document.getElementById = () => lightbox;
  document.querySelectorAll = () => tiles;
  let copied;
  const navigator = { clipboard: { writeText: async text => { copied = text; } } };
  runInNewContext(script, { document, navigator, window: { location: { origin: 'https://example.com' } }, URL,
    getComputedStyle: element => ({ visibility: element.visibility }) });
  return { lightbox, nodes, tiles, document, navigator, copied: () => copied,
    key: (key, options = {}) => document.emit('keydown', { key, target: document.activeElement, ...options }) };
}

test('copy, navigation, full captions, and clipboard fallback still work', async () => {
  const { lightbox, nodes, tiles, document, navigator, copied, key } = setup();
  await tiles[0].emit('click');
  assert.ok(lightbox.classList.contains('is-open'));
  assert.equal(document.activeElement, nodes['.lightbox__close']);
  assert.equal(nodes['.lightbox__caption'].textContent, 'Caption 0');
  assert.equal(lightbox.classList.contains('has-caption'), true);
  nodes['.lightbox__figure'].scrollTop = 200;
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(copied(), 'https://example.com/artwork/first/');
  assert.equal(nodes['.lightbox__status'].textContent, 'Link copied');
  await nodes['.lightbox__next'].emit('click');
  assert.equal(nodes['.lightbox__figure'].scrollTop, 0);
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(copied(), 'https://example.com/artwork/second/');
  navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied'); };
  await nodes['.lightbox__copy'].emit('click');
  assert.equal(nodes['.lightbox__url'].hidden, false);
  assert.equal(nodes['.lightbox__url'].value, copied());
  assert.equal(document.activeElement, nodes['.lightbox__url']);
  assert.ok(nodes['.lightbox__url'].selected);
  assert.deepEqual(nodes['.lightbox__url'].selection, [0, copied().length]);
  // Buttons still navigate while the URL field owns focus.
  await nodes['.lightbox__next'].emit('click');
  assert.equal(nodes['.lightbox__sharing'].hidden, true);
  assert.equal(lightbox.classList.contains('has-share-link'), false);
  assert.equal(document.activeElement, nodes['.lightbox__close']);
  await key('ArrowLeft');
  assert.equal(nodes['.lightbox__sharing'].hidden, false);
  await key('Escape');
  assert.equal(lightbox.attributes['aria-hidden'], 'true');
  assert.equal(document.body.style.overflow, '');
  assert.equal(document.activeElement, tiles[0]);
});

test('Tab and Shift+Tab cycle through visible controls and skip hidden or disabled ones', async () => {
  const { nodes, tiles, document, key } = setup();
  await tiles[0].emit('click');
  const tab = await key('Tab');
  assert.equal(tab.defaultPrevented, true);
  assert.equal(document.activeElement, nodes['.lightbox__prev']);
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__figure']);
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__copy']);
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__next']); // URL hidden
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__close']);
  await key('Tab', { shiftKey: true }); assert.equal(document.activeElement, nodes['.lightbox__next']);
  nodes['.lightbox__prev'].disabled = true;
  nodes['.lightbox__figure'].visibility = 'hidden';
  nodes['.lightbox__close'].focus();
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__copy']);
  nodes['.lightbox__figure'].visibility = 'visible';
  await nodes['.lightbox__next'].emit('click');
  await nodes['.lightbox__next'].emit('click'); // Third tile has no sharing link.
  nodes['.lightbox__figure'].focus();
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__next']);
  nodes['.lightbox__next'].rendered = false;
  nodes['.lightbox__figure'].focus();
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__close']);
});

test('fallback URL participates in Tab order, retains text arrow keys, and closes with Escape', async () => {
  const { nodes, tiles, document, navigator, key } = setup();
  await tiles[0].emit('click');
  navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  await nodes['.lightbox__copy'].emit('click');
  assert.equal((await key('ArrowLeft')).defaultPrevented, false);
  assert.equal((await key('ArrowRight')).defaultPrevented, false);
  assert.equal(nodes['.lightbox__caption'].textContent, 'Caption 0');
  await key('Tab', { shiftKey: true }); assert.equal(document.activeElement, nodes['.lightbox__copy']);
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__url']);
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__next']);
  nodes['.lightbox__url'].focus();
  assert.equal((await key('Escape')).defaultPrevented, true);
  assert.equal(document.activeElement, tiles[0]);
});

test('focus cannot escape while open, and closing restores the original thumbnail and scroll setting', async () => {
  const { nodes, tiles, document, key } = setup({ overflow: 'clip' });
  await tiles[0].emit('click');
  tiles[2].focus();
  assert.equal(document.activeElement, nodes['.lightbox__close']);
  await key('ArrowRight');
  assert.equal(nodes['.lightbox__caption'].textContent, 'Caption 1');
  await nodes['.lightbox__close'].emit('click');
  assert.equal(document.activeElement, tiles[0]);
  assert.equal(document.body.style.overflow, 'clip');
  tiles[2].focus(); assert.equal(document.activeElement, tiles[2]);
  assert.equal((await key('Tab')).defaultPrevented, false);
  assert.equal((await key('ArrowRight')).defaultPrevented, false);
  await tiles[1].emit('click');
  await key('ArrowRight');
  await key('Escape');
  assert.equal(document.activeElement, tiles[1]);
  assert.equal(document.body.style.overflow, 'clip');
});

test('late clipboard rejection cannot focus a closed or reopened lightbox', async () => {
  const { lightbox, nodes, tiles, document, navigator, key } = setup();
  await tiles[0].emit('click');
  let reject;
  navigator.clipboard.writeText = () => new Promise((resolve, fail) => { reject = fail; });
  const copy = nodes['.lightbox__copy'].emit('click');
  await key('Escape');
  reject(new Error('Late denial')); await copy;
  assert.equal(lightbox.classList.contains('is-open'), false);
  assert.equal(document.activeElement, tiles[0]);
  assert.equal(nodes['.lightbox__url'].hidden, true);
  await tiles[0].emit('click');
  const secondCopy = nodes['.lightbox__copy'].emit('click');
  await key('Escape');
  await tiles[0].emit('click');
  reject(new Error('Late denial after reopening')); await secondCopy;
  assert.equal(nodes['.lightbox__url'].hidden, true);
  assert.equal(nodes['.lightbox__status'].textContent, '');
  assert.equal(document.activeElement, nodes['.lightbox__close']);
});
