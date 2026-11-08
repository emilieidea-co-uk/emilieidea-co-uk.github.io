import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupArtworks } from '../src/lib/artwork-groups.mjs';
import { installImageSwipe } from '../src/lib/image-swipe.mjs';
import { initArtworkCarousel } from '../src/lib/artwork-carousel.mjs';

class Element {
  constructor() { this.listeners = {}; this.dataset = {}; this.attributes = {}; }
  addEventListener(type, handler, capture = false) {
    (this.listeners[type] ??= []).push({ handler, capture });
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  emit(type, data = {}) {
    const event = { ...data, defaultPrevented: false, stopped: false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
      stopImmediatePropagation() { this.stopped = true; },
    };
    for (const { handler } of [...(this.listeners[type] || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      handler(event); if (event.stopped) break;
    }
    return event;
  }
}

test('groups preserve first appearance, sort slide positions, and exclude unpublished images without mutating data', () => {
  const record = (id, postId, imageIndex, collection = 'embroideries', publish = true) => ({ id, postId, imageIndex, collection, publish });
  const entries = [record('a3', 'a', 3), record('single', null, 1), record('a1', 'a', 1),
    record('a2', 'a', 2, 'embroideries', false), record('other-category', 'a', 1, 'artworks'), record('b2', 'b', 2)];
  const before = JSON.stringify(entries);
  const groups = groupArtworks(entries);
  assert.deepEqual(groups.map(group => group.images.map(image => image.id)), [['a1', 'a3'], ['single'], ['other-category'], ['b2']]);
  assert.equal(JSON.stringify(entries), before);
  assert.equal(groups[3].images[0].imageIndex, 2); // Hidden or absent position 1 is not fabricated.
});

test('swiping recognises horizontal touches and ignores vertical scrolling, cancellation, mouse, and pinch gestures', () => {
  const image = new Element(), moves = [];
  let enabled = true;
  installImageSwipe(image, delta => moves.push(delta), () => enabled);
  const down = data => image.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100, ...data });
  const up = data => image.emit('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 20, clientY: 105, ...data });
  down(); up(); assert.deepEqual(moves, [1]);
  down(); up({ clientX: 200 }); assert.deepEqual(moves, [1, -1]);
  down(); up({ clientX: 90, clientY: 240 });
  down(); image.emit('pointercancel'); up();
  down({ pointerType: 'mouse' }); up();
  down(); down({ pointerId: 2, isPrimary: false }); up();
  enabled = false; down(); up();
  assert.deepEqual(moves, [1, -1]);
});

test('inline carousel keeps selected-image metadata, captions, and counters in sync with arrows, keyboard, and swipe', () => {
  const root = new Element(), tile = new Element(), image = new Element(), caption = new Element(), position = new Element();
  const prev = new Element(), next = new Element();
  const slides = [1, 2, 3, 4].map(index => ({ id: `id-${index}`, href: `/artwork/id-${index}/`, full: `/full-${index}.webp`,
    src: `/image-${index}.webp`, srcset: `/small-${index}.webp 640w`, caption: index === 4 ? '' : `Caption ${index}`, alt: `Image ${index}` }));
  tile.dataset = { photoGroup: JSON.stringify(slides), photoIndex: '2' };
  tile.querySelector = () => image;
  const nodes = { '.photo-tile': tile, '.post-figure__caption': caption, '.artwork-carousel__position': position,
    '.artwork-carousel__prev': prev, '.artwork-carousel__next': next };
  root.querySelector = selector => nodes[selector];
  initArtworkCarousel(root);
  next.emit('click');
  assert.equal(tile.dataset.photoIndex, '3');
  assert.equal(tile.dataset.artworkUrl, '/artwork/id-4/');
  assert.equal(position.textContent, '4 / 4');
  assert.equal(caption.hidden, true);
  assert.equal(image.alt, 'Image 4');
  next.emit('click'); assert.equal(tile.dataset.photoIndex, '0');
  prev.emit('click'); assert.equal(tile.dataset.photoIndex, '3');
  const keyboard = root.emit('keydown', { key: 'ArrowLeft' });
  assert.ok(keyboard.defaultPrevented && keyboard.propagationStopped);
  assert.equal(tile.dataset.photoIndex, '2');
  assert.equal(caption.textContent, 'Caption 3');
  assert.equal(caption.hidden, false);
  root.emit('keydown', { key: 'ArrowLeft', altKey: true });
  assert.equal(tile.dataset.photoIndex, '2');
  let opened = 0;
  tile.addEventListener('click', () => { opened++; });
  tile.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 180, clientY: 80 });
  tile.emit('pointerup', { pointerType: 'touch', pointerId: 1, clientX: 80, clientY: 82 });
  tile.emit('click');
  assert.equal(tile.dataset.photoIndex, '3');
  assert.equal(opened, 0, 'swipe must not also open the lightbox');
  tile.emit('click');
  assert.equal(opened, 1, 'ordinary clicks still open the lightbox');
});
