import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createCaptionController } from '../src/lib/lightbox-caption.mjs';

// Run the actual browser script. This adapter supplies DOM focus, visibility,
// ancestry, and events; keyboard and copy behaviour come entirely from the script.
class Element {
  constructor(document, { tabIndex = -1, parent = null } = {}) {
    this.ownerDocument = document; this.parentElement = parent; this.tabIndex = tabIndex;
    this.listeners = {}; this.dataset = {}; this.hidden = false; this.disabled = false;
    this.rendered = true; this.visibility = 'visible'; this.value = ''; this.isConnected = true;
    this.style = {}; this.scrollTop = 0;
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
  getBoundingClientRect() { return this.rect?.() ?? { top: 0, bottom: 0, height: 0 }; }
  scrollTo(options) { this.lastScroll = options; this.scrollTop = options.top; }
  select() { this.selected = true; }
  setSelectionRange(start, end) { this.selection = [start, end]; }
}
const script = await readFile(new URL('../src/lib/lightbox.mjs', import.meta.url), 'utf8');
function setup({ overflow = '', capacity = 500, imageHeight = 120, textHeight = 24, reducedMotion = false } = {}) {
  const document = { listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } };
  document.emit = Element.prototype.emit;
  document.body = new Element(document); document.body.style = { overflow };
  document.activeElement = document.body;
  const lightbox = new Element(document, { parent: document.body });
  const nodes = Object.fromEntries(['img', 'caption', 'caption-text', 'more', 'figure', 'close', 'prev', 'next', 'sharing', 'copy', 'status', 'url'].map(name =>
    [`.lightbox__${name}`, new Element(document, { parent: lightbox, tabIndex: ['figure', 'close', 'prev', 'next', 'copy', 'url', 'more'].includes(name) ? 0 : -1 })]));
  nodes['.lightbox__copy'].parentElement = nodes['.lightbox__sharing'];
  nodes['.lightbox__url'].parentElement = nodes['.lightbox__sharing'];
  nodes['.lightbox__caption-text'].parentElement = nodes['.lightbox__caption'];
  nodes['.lightbox__more'].parentElement = nodes['.lightbox__caption'];
  const figure = nodes['.lightbox__figure'], text = nodes['.lightbox__caption-text'];
  figure.clientHeight = capacity;
  const renderedImageHeight = () => Math.min(imageHeight, Number.parseFloat(nodes['.lightbox__img'].style.maxHeight) || imageHeight);
  const renderedTextHeight = () => !text.textContent ? 0 : text.classList.contains('is-clamped') ? Math.min(textHeight, Number(text.style.webkitLineClamp) * 24) : textHeight;
  const buttonHeight = () => nodes['.lightbox__more'].hidden ? 0 : 28;
  figure.rect = () => ({ top: 0, bottom: figure.clientHeight, height: figure.clientHeight });
  nodes['.lightbox__img'].rect = () => ({ height: renderedImageHeight() });
  text.rect = () => ({ height: renderedTextHeight() });
  nodes['.lightbox__more'].rect = () => ({ height: buttonHeight() });
  nodes['.lightbox__caption'].rect = () => {
    const top = renderedImageHeight() + 14 - figure.scrollTop;
    const height = renderedTextHeight() + (buttonHeight() ? buttonHeight() + 4 : 0);
    return { top, bottom: top + height, height };
  };
  Object.defineProperty(figure, 'scrollHeight', { get: () => renderedImageHeight() + 14 + renderedTextHeight() + (buttonHeight() ? buttonHeight() + 4 : 0) });
  const order = ['close', 'prev', 'figure', 'more', 'copy', 'url', 'next'];
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
  const frames = [], events = {}, observers = [], fontEvents = {};
  document.fonts = { ready: { then: callback => { fontEvents.ready = callback; } }, addEventListener: (type, callback) => { fontEvents[type] = callback; } };
  const window = {
    location: { origin: 'https://example.com' },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    addEventListener: (type, callback) => { events[type] = callback; },
    getComputedStyle: element => ({ visibility: element.visibility, lineHeight: '24px', fontSize: '16px', marginTop: element === nodes['.lightbox__caption'] ? '14px' : '4px' }),
    matchMedia: () => ({ matches: reducedMotion }),
    ResizeObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
  };
  const flush = () => {
    let remaining = 20;
    while (frames.length && remaining--) frames.shift()();
    assert.ok(remaining >= 0, 'layout should settle');
  };
  runInNewContext(script.replace(/^import .*lightbox-caption.*\n/m, ''), { document, navigator, window, URL,
    createCaptionController, getComputedStyle: window.getComputedStyle });
  return { lightbox, nodes, tiles, document, navigator, flush, events, observers, fontEvents, copied: () => copied,
    key: (key, options = {}) => document.emit('keydown', { key, target: document.activeElement, ...options }) };
}

test('copy, navigation, full captions, and clipboard fallback still work', async () => {
  const { lightbox, nodes, tiles, document, navigator, copied, key } = setup();
  await tiles[0].emit('click');
  assert.ok(lightbox.classList.contains('is-open'));
  assert.equal(document.activeElement, nodes['.lightbox__close']);
  assert.equal(nodes['.lightbox__caption-text'].textContent, 'Caption 0');
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
  assert.equal(nodes['.lightbox__caption-text'].textContent, 'Caption 0');
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
  assert.equal(nodes['.lightbox__caption-text'].textContent, 'Caption 1');
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


test('only overflowing captions get More, and expanding scrolls the minimum distance to reveal the text', async () => {
  const { nodes, tiles, flush } = setup({ capacity: 400, imageHeight: 250, textHeight: 240 });
  const embroideries = JSON.parse(await readFile(new URL('../src/data/embroideries.json', import.meta.url), 'utf8'));
  const example = embroideries.find(entry => entry.id === 'instagram-CxgPlirsC4b-01');
  tiles[0].dataset.caption = example.caption;
  await tiles[0].emit('click'); flush();
  assert.equal(nodes['.lightbox__caption-text'].textContent, example.caption);
  const text = nodes['.lightbox__caption-text'], more = nodes['.lightbox__more'], figure = nodes['.lightbox__figure'];
  assert.equal(more.hidden, false);
  assert.equal(more.attributes['aria-expanded'], 'false');
  assert.equal(text.style.webkitLineClamp, '4');
  assert.ok(text.classList.contains('is-clamped'));
  assert.equal(figure.scrollTop, 0);
  await more.emit('click'); flush();
  assert.equal(more.textContent, 'Less');
  assert.equal(more.attributes['aria-expanded'], 'true');
  assert.equal(text.classList.contains('is-clamped'), false);
  assert.equal(figure.scrollTop, 136); // Image 250 + margin 14 + caption 240 + control 32 - viewport 400.
  assert.equal(figure.lastScroll.behavior, 'smooth');
  await more.emit('click'); flush();
  assert.equal(more.textContent, 'More');
  assert.ok(text.classList.contains('is-clamped'));
  assert.equal(figure.scrollTop, 0);
});

test('short and empty captions stay whole, including on short viewports', async () => {
  const { nodes, tiles, flush } = setup({ capacity: 100, imageHeight: 90, textHeight: 24 });
  await tiles[0].emit('click'); flush();
  assert.equal(nodes['.lightbox__more'].hidden, true);
  assert.equal(nodes['.lightbox__caption-text'].classList.contains('is-clamped'), false);
  assert.equal(nodes['.lightbox__img'].style.maxHeight, '62px');
  tiles[1].dataset.caption = '';
  await nodes['.lightbox__next'].emit('click'); flush();
  assert.equal(nodes['.lightbox__caption'].hidden, true);
  assert.equal(nodes['.lightbox__more'].hidden, true);
  assert.equal(nodes['.lightbox__img'].style.maxHeight, '');
});

test('a caption taller than the viewport scrolls to its beginning and respects reduced motion', async () => {
  const { nodes, tiles, flush } = setup({ capacity: 300, imageHeight: 200, textHeight: 900, reducedMotion: true });
  await tiles[0].emit('click'); flush();
  await nodes['.lightbox__more'].emit('click'); flush();
  assert.equal(nodes['.lightbox__figure'].scrollTop, 214);
  assert.equal(nodes['.lightbox__figure'].lastScroll.behavior, 'auto');
  assert.equal(nodes['.lightbox__caption-text'].classList.contains('is-clamped'), false);
});

test('resize, font loading, and image loading recalculate overflow and preserve keyboard focus', async () => {
  const { nodes, tiles, document, flush, events, fontEvents, observers, key } = setup({ capacity: 300, imageHeight: 200, textHeight: 240 });
  await tiles[0].emit('click'); flush();
  nodes['.lightbox__figure'].focus();
  await key('Tab'); assert.equal(document.activeElement, nodes['.lightbox__more']);
  nodes['.lightbox__figure'].clientHeight = 800;
  events.resize(); flush();
  assert.equal(nodes['.lightbox__more'].hidden, true);
  assert.equal(document.activeElement, nodes['.lightbox__figure']);
  nodes['.lightbox__figure'].clientHeight = 300;
  events.orientationchange(); flush();
  assert.equal(nodes['.lightbox__more'].hidden, false);
  nodes['.lightbox__figure'].clientHeight = 800;
  fontEvents.loadingdone(); flush();
  assert.equal(nodes['.lightbox__more'].hidden, true);
  nodes['.lightbox__figure'].clientHeight = 300;
  await nodes['.lightbox__img'].emit('load'); flush();
  assert.equal(nodes['.lightbox__more'].hidden, false);
  nodes['.lightbox__figure'].clientHeight = 800;
  observers[0](); flush();
  assert.equal(nodes['.lightbox__more'].hidden, true);
});

test('expansion resets on navigation and reopening, and stale expansion scrolls are ignored', async () => {
  const { nodes, tiles, flush, key } = setup({ capacity: 300, imageHeight: 200, textHeight: 600 });
  await tiles[0].emit('click'); flush();
  await nodes['.lightbox__more'].emit('click');
  await nodes['.lightbox__next'].emit('click'); flush();
  assert.equal(nodes['.lightbox__more'].attributes['aria-expanded'], 'false');
  assert.equal(nodes['.lightbox__figure'].scrollTop, 0);
  await nodes['.lightbox__more'].emit('click');
  await key('Escape'); flush();
  assert.equal(nodes['.lightbox__figure'].scrollTop, 0);
  await tiles[1].emit('click'); flush();
  assert.equal(nodes['.lightbox__more'].attributes['aria-expanded'], 'false');
  assert.equal(nodes['.lightbox__figure'].scrollTop, 0);
});
