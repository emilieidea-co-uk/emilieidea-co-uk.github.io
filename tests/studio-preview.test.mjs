import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { readSettings, settingsQuery, previewPath } from '../src/studio/settings.ts';
import { FILL_COLOR, OUTLINE_COLOR, playbackPosition } from '../src/studio/stitches.ts';
import { lastStage } from '../src/studio/navigation.ts';
import { stitchDistances, segmentPosition } from '../src/studio/playback.ts';

const compile = source => ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replace(/^import .+;\n/gm, '').replace(/^export /gm, '');
const code = compile(await readFile(new URL('../src/studio/render-canvas.ts', import.meta.url), 'utf8')) +
  compile(await readFile(new URL('../src/studio/viewport.ts', import.meta.url), 'utf8')) +
  compile(await readFile(new URL('../src/studio/clipboard.ts', import.meta.url), 'utf8')) +
  compile(await readFile(new URL('../src/studio/preview.ts', import.meta.url), 'utf8'));

function setup(reduced = false, longFill = false, flags = { hasOutline: true, hasFill: true }, dataset = { drawing: 'horse' }) {
  const events = {}, mediaEvents = {}, viewportEvents = {}, viewportStyles = {}, frames = new Map();
  let frameId = 0, moves = [], copied = '';
  const context = { setTransform() {}, fillRect() { moves = []; }, beginPath() {}, stroke() {},
    moveTo(x, y) { moves.push([x, y]); }, lineTo() {}, arc() {}, fill() {} };
  const ids = ['canvas', 'back', 'play', 'restart', 'share', 'share-status', 'status', 'description'];
  const nodes = Object.fromEntries(ids.map(id => [id, {
    disabled: true, listeners: {},
    focus() { this.focused = true; }, select() { this.selected = true; }, setSelectionRange(start, end) { this.selection = [start, end]; },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(name, callback) { this.listeners[name] = callback; }, getContext: () => context,
  }]));
  nodes.canvas.dataset = dataset;
  const replacements = [];
  const document = {
    documentElement: { style: { setProperty(key, value) { viewportStyles[key] = value; } } },
    hidden: false, querySelector: selector => nodes[selector.replace('#preview-', '')],
    addEventListener(name, callback) { events[name] = callback; },
    body: { appendChild(field) { document.copyField = field; } },
    createElement: () => ({ style: {}, setAttribute() {}, focus() {}, select() {}, setSelectionRange() {}, remove() { document.copyField = null; } }),
    execCommand() { copied = document.copyField.value; return true; },
  };
  const media = { matches: reduced, addEventListener(name, callback) { mediaEvents[name] = callback; } };
  const generated = Array.from({ length: 100 }, (_, i) => ({
    kind: i < 80 ? 'fill' : 'outline', from: { x: i, y: 0 }, to: { x: i + (longFill && i < 80 ? 4 : 1), y: 0 },
  }));
  const query = 'drawing=horse&length=10&gap=6&lineWidth=3&fillLineWidth=0.5&pattern=rows&spacing=48&angle=90';
  const navigator = { clipboard: { writeText: async url => { copied = url; } } };
  const viewport = { height: 780, addEventListener(name, callback) { viewportEvents[name] = callback; } };
  runInNewContext(code + '\ninitStitchPreview();', {
    document, navigator, URL, window: { devicePixelRatio: 2, innerHeight: 900, visualViewport: viewport, location: { search: query, origin: 'https://emilieidea-co-uk.github.io', replace: url => replacements.push(url) }, matchMedia: () => media,
      addEventListener(name, callback) { events[name] = callback; } },
    WIDTH: 600, HEIGHT: 440, FILL_COLOR, OUTLINE_COLOR, playbackPosition, stitchDistances, segmentPosition,
    readSettings, settingsQuery, previewPath, lastStage, withBase: path => path, studies: [{ id: 'horse', name: 'Horse', ...flags }, { id: 'flower', name: 'Flower', ...flags }],
    sampleStudy: () => [], generateStitches: (_, options) => generated.filter(segment => segment.kind === 'fill' ? options.fill : options.outline),
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const tick = time => {
    const entry = frames.entries().next().value;
    if (entry) { frames.delete(entry[0]); entry[1](time); }
  };
  return { replacements, nodes, document, events, media, mediaEvents, viewport, viewportEvents, viewportStyles, frames, tick, navigator, copied: () => copied, moves: () => moves };
}

test('preview animates slowly, outline before fill, pauses and returns complete settings to edit', () => {
  const s = setup();
  assert.equal(s.nodes.play.textContent, 'Pause');
  assert.equal(s.frames.size, 1);
  s.tick(0); s.tick(100);
  assert.equal(s.moves().length, 12);
  assert.deepEqual(s.moves()[0], [80, 0], 'outline is drawn before any fill');
  assert.equal(s.nodes.status.textContent, 'Stitching · 10%');
  s.nodes.play.listeners.click();
  assert.equal(s.frames.size, 0);
  assert.equal(s.nodes.play.textContent, 'Play');
  s.nodes.play.listeners.click(); s.tick(200); s.tick(300);
  assert.equal(s.moves().length, 24);
  assert.deepEqual(s.moves()[20], [0, 0]);
  for (let time = 400; time <= 1000; time += 100) s.tick(time);
  assert.equal(s.nodes.status.textContent, 'Complete · 100%');
  assert.equal(s.frames.size, 0);
  const back = new URL(s.nodes.back.href, 'https://example.com');
  assert.equal(back.searchParams.get('step'), '3');
  assert.equal(back.searchParams.get('drawing'), 'horse');
  assert.equal(back.searchParams.get('length'), '10');
  assert.equal(back.searchParams.get('lineWidth'), '3');
  assert.equal(back.searchParams.get('fillLineWidth'), '0.5');
  s.nodes.restart.listeners.click();
  assert.equal(s.moves().length, 0);
  assert.equal(s.frames.size, 1);
  s.document.hidden = true; s.events.visibilitychange();
  assert.equal(s.frames.size, 0);
  assert.equal(s.nodes.play.textContent, 'Play');
});

test('reduced motion starts complete and paused; leaving the page cancels animation', () => {
  const s = setup(true);
  assert.equal(s.moves().length, 100);
  assert.equal(s.nodes.play.textContent, 'Play');
  assert.equal(s.frames.size, 0);
  s.nodes.restart.listeners.click();
  assert.equal(s.moves().length, 0);
  assert.equal(s.frames.size, 0);
  s.nodes.play.listeners.click();
  assert.equal(s.frames.size, 1);
  s.events.pagehide();
  assert.equal(s.frames.size, 0);
});

test('longer fill segments are revealed at the same thread speed as short outline segments', () => {
  const s = setup(false, true);
  s.tick(0); s.tick(100);
  assert.equal(s.moves().length, 12); // 12 units of the short outline segments.
  s.tick(200);
  assert.equal(s.moves().length, 21); // 20 outline units, then one 4-unit fill segment.
  s.tick(300);
  assert.equal(s.moves().length, 24); // The next 12 units reveal only three more fill segments.
});

test('preview follows the visible browser height when toolbars or orientation change', () => {
  const s = setup();
  assert.equal(s.viewportStyles['--studio-viewport-height'], '780px');
  s.viewport.height = 500; s.viewportEvents.resize();
  assert.equal(s.viewportStyles['--studio-viewport-height'], '500px');
  s.viewport.height = 420; s.events.resize();
  assert.equal(s.viewportStyles['--studio-viewport-height'], '420px');
});

test('Share copies every setting with confirmation, including through a hidden clipboard fallback', async () => {
  const s = setup();
  assert.equal(s.nodes.share.disabled, false);
  await s.nodes.share.listeners.click();
  assert.equal(s.nodes['share-status'].textContent, 'Link copied');
  const url = new URL(s.copied());
  assert.equal(url.origin, 'https://emilieidea-co-uk.github.io');
  assert.equal(url.pathname, '/studio/drawing-to-stitches/preview/horse/');
  assert.deepEqual(readSettings(url.search), {
    drawing: 'horse', length: 10, gap: 6, lineWidth: 3, fillLineWidth: .5,
    pattern: 'rows', spacing: 48, angle: 90,
  });
  s.navigator.clipboard.writeText = async () => { throw new Error('Clipboard unavailable'); };
  await s.nodes.share.listeners.click();
  assert.equal(s.nodes['share-status'].textContent, 'Link copied');
  assert.equal(s.document.copyField, null, 'temporary copy field must be removed');
  assert.equal(s.nodes.share.disabled, false);
  s.tick(0); s.tick(100);
  assert.equal(s.nodes['share-status'].textContent, 'Link copied', 'animation progress must not overwrite sharing feedback');
  s.document.execCommand = () => false;
  await s.nodes.share.listeners.click();
  assert.match(s.nodes['share-status'].textContent, /Could not copy/);
  assert.equal(s.document.copyField, null);
});


test('preview honors disabled steps and Back to edit targets the last available step', () => {
  const outline = setup(true, false, { hasOutline: true, hasFill: false });
  assert.match(outline.nodes.description.textContent, /outline build up/);
  assert.equal(outline.moves().length, 20);
  assert.equal(new URL(outline.nodes.back.href, 'https://example.com').searchParams.get('step'), '2');
  const fill = setup(true, false, { hasOutline: false, hasFill: true });
  assert.match(fill.nodes.description.textContent, /grey fill build up/);
  assert.equal(fill.moves().length, 80);
  assert.equal(new URL(fill.nodes.back.href, 'https://example.com').searchParams.get('step'), '3');
});


test('drawing routes override conflicting query drawing and Share keeps the matching path', async () => {
  const s = setup(true, false, { hasOutline: true, hasFill: true }, { drawing: 'flower' });
  assert.match(s.nodes.description.textContent, /^Flower/);
  await s.nodes.share.listeners.click();
  const url = new URL(s.copied());
  assert.equal(url.pathname, '/studio/drawing-to-stitches/preview/flower/');
  assert.equal(url.searchParams.get('drawing'), 'flower');
  assert.equal(url.searchParams.get('length'), '10');
  assert.equal(url.searchParams.get('angle'), '90');
  assert.equal(new URL(s.nodes.back.href, url).searchParams.get('drawing'), 'flower');
});

test('legacy query-only preview links forward to the drawing page with every selected setting', () => {
  const s = setup(false, false, { hasOutline: true, hasFill: true }, { legacy: 'true' });
  assert.equal(s.replacements.length, 1);
  const url = new URL(s.replacements[0], 'https://example.com');
  assert.equal(url.pathname, '/studio/drawing-to-stitches/preview/horse/');
  assert.deepEqual(readSettings(url.search), {
    drawing: 'horse', length: 10, gap: 6, lineWidth: 3, fillLineWidth: .5,
    pattern: 'rows', spacing: 48, angle: 90,
  });
  assert.equal(s.frames.size, 0, 'legacy page should forward before starting playback');
});
