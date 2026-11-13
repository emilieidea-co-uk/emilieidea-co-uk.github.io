import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masonryPositions, initGalleryMasonry } from '../src/lib/gallery-masonry.mjs';

test('posts fill the shortest column in source order, with left-first ties and no trailing gap', () => {
  assert.deepEqual(masonryPositions([300, 100, 100, 80, 120], 2, 200, 16, 20), {
    positions: [
      { left: 0, top: 0 }, { left: 216, top: 0 }, { left: 216, top: 120 },
      { left: 216, top: 240 }, { left: 0, top: 320 },
    ], height: 440,
  });
  assert.deepEqual(masonryPositions([100, 100, 100], 2, 200, 16, 20).positions,
    [{ left: 0, top: 0 }, { left: 216, top: 0 }, { left: 0, top: 120 }]);
  assert.deepEqual(masonryPositions([], 2, 200, 16, 20), { positions: [], height: 0 });
  assert.deepEqual(masonryPositions([100, 200], 1, 300, 16, 20), {
    positions: [{ left: 0, top: 0 }, { left: 0, top: 120 }], height: 320,
  });
});

function setup() {
  const classes = new Set(), frames = [], observed = [], events = {}, gridEvents = {}, fontEvents = {};
  let columns = 2, measurements = 0;
  const items = [300, 100, 100].map(height => ({
    style: {}, height,
    getBoundingClientRect() { measurements++; return { height: this.height }; },
  }));
  const grid = {
    style: {}, clientWidth: 416,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    querySelectorAll: () => items,
    addEventListener: (name, callback) => { gridEvents[name] = callback; },
    ownerDocument: { fonts: {
      ready: { then: callback => { fontEvents.ready = callback; } },
      addEventListener: (name, callback) => { fontEvents[name] = callback; },
    } },
  };
  const view = {
    getComputedStyle: () => ({ columnGap: '16px', rowGap: '20px', getPropertyValue: () => String(columns) }),
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    addEventListener: (name, callback) => { events[name] = callback; },
    ResizeObserver: class {
      constructor(callback) { events.observer = callback; }
      observe(node) { observed.push(node); }
    },
  };
  initGalleryMasonry(grid, view);
  return { grid, items, classes, events, gridEvents, fontEvents, observed, frames,
    setColumns: value => { columns = value; }, measurements: () => measurements,
    flush: () => { while (frames.length) frames.shift()(); },
  };
}

test('layout keeps DOM order, accounts for captions, and recalculates after loading, fonts and resizing', () => {
  const s = setup(), original = [...s.items];
  assert.ok(s.classes.has('is-masonry'));
  assert.equal(s.items[0].style.width, '200px');
  assert.equal(s.items[2].style.top, '120px');
  assert.equal(s.items[2].style.left, '216px');
  assert.equal(s.grid.style.height, '300px');
  assert.deepEqual(s.observed, [s.grid, ...s.items]);
  const before = s.measurements();
  s.items[1].height = 340; // An image or wrapped caption changes this card's height.
  s.gridEvents.load(); s.gridEvents.error(); s.fontEvents.ready(); s.fontEvents.loadingdone(); s.events.observer();
  assert.equal(s.frames.length, 1, 'batch layout changes into a single frame');
  s.flush();
  assert.equal(s.measurements(), before + s.items.length);
  assert.equal(s.items[2].style.left, '0px');
  assert.equal(s.items[2].style.top, '320px');
  assert.equal(s.grid.style.height, '420px');
  s.grid.clientWidth = 616;
  s.events.resize(); s.flush();
  assert.equal(s.items[0].style.width, '300px');
  assert.equal(s.items[1].style.left, '316px');
  assert.deepEqual(s.items, original, 'never move or replace gallery cards');
});

test('mobile restores the normal single-column flow and switching back rebuilds masonry', () => {
  const s = setup();
  s.setColumns(1); s.events.resize(); s.flush();
  assert.equal(s.classes.has('is-masonry'), false);
  assert.equal(s.grid.style.height, '');
  for (const item of s.items) assert.deepEqual(item.style, { width: '', left: '', top: '' });
  s.setColumns(2); s.events.resize(); s.flush();
  assert.equal(s.classes.has('is-masonry'), true);
  assert.equal(s.items[2].style.left, '216px');
  assert.equal(s.grid.style.height, '300px');
});
