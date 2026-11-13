import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { readSettings, settingsQuery, previewPath, defaultsForStudy, DEFAULT_SETTINGS } from '../src/studio/settings.ts';

import { studies as catalogStudies, initialStudy as catalogInitialStudy } from '../src/studio/studies.ts';
import { availableStages, lastStage, stageTitle } from '../src/studio/navigation.ts';

// Navigation fixtures stay independent of the artist's current JSON flags.
const initialStudy = { ...catalogInitialStudy, hasOutline: true, hasFill: true };
const studies = catalogStudies.map(study => study.id === initialStudy.id ? initialStudy : study);

// Exercise the actual TypeScript controls and Canvas 2D renderer with a DOM adapter.
const source = await readFile(new URL('../src/studio/canvas.ts', import.meta.url), 'utf8');
const renderSource = await readFile(new URL('../src/studio/render-canvas.ts', import.meta.url), 'utf8');
const renderScript = ts.transpileModule(renderSource, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replace(/^import .+;\n/gm, '').replace(/^export /gm, '');
const script = renderScript + ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
} }).outputText.replace(/^import .+;\n/gm, '').replace(/^export /gm, '');

test('Step 1 drawing selection works independently of the stitch renderer', async () => {
  const selection = await readFile(new URL('../src/studio/drawing-selection.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(selection, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace(/^import .+;\n/gm, '').replace(/^export /gm, '');
  const select = { value: 'petals', disabled: true, addEventListener(type, callback) { this.change = callback; } };
  const original = {};
  const elements = { '#study-drawing': select, '#study-original': original };
  runInNewContext(code + '\ninitDrawingSelection();', {
    document: { querySelector: selector => elements[selector] },
    studies: [{ id: 'petals', description: 'Petals drawing' }, { id: 'horse', description: 'Horse drawing' }],
    studySvg: study => `<svg>${study.id}</svg>`,
  });
  assert.equal(select.disabled, false);
  select.value = 'horse'; select.change();
  assert.equal(original.innerHTML, '<svg>horse</svg>');
});

function setup(fixtures = studies) {
  const defaults = { drawing: 'petals', length: '6', gap: '4', 'line-width': '1.35', 'fill-line-width': '0.5', pattern: 'petals', spacing: '28', angle: '0' };
  const names = ['canvas', ...Object.keys(defaults), 'drawing-control', 'drawing-preview', 'prev', 'next', 'reset', 'original', 'status', 'stage', 'pattern-controls', 'controls', 'stitch-preview'];
  const nodes = Object.fromEntries(names.map(name => [name, {
    value: defaults[name] ?? '', disabled: true, hidden: ['pattern-controls', 'stitch-preview'].includes(name), listeners: {}, classList: { toggle() {} },
    replaceChildren(child) { this.child = child; }, setAttribute() {}, focus() { this.focused = true; }, scrollIntoView(options) { this.scroll = options; },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    get selectedOptions() { return [{ text: this.value }]; },
  }]));
  const frames = [], calls = [], widths = [], colors = [], navigations = [];
  const settings = [{ hidden: true }, { hidden: true }, { hidden: true }];
  const drawingContext = {
    setTransform(...values) { this.transform = values; },
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() { widths.push(this.lineWidth); colors.push(this.strokeStyle); },
  };
  const canvas = { setAttribute() {}, getContext: type => type === '2d' ? drawingContext : null };
  const context = {
    WIDTH: 600, HEIGHT: 440, FILL_COLOR: '#808080', OUTLINE_COLOR: '#33332e', console,
    readSettings, settingsQuery, previewPath, defaultsForStudy, DEFAULT_SETTINGS, availableStages, lastStage, stageTitle, initialStudy, URLSearchParams, withBase: path => path, initViewportHeight() {},
    document: { createElement: () => canvas, querySelector: selector => nodes[selector.replace('#study-', '')], querySelectorAll: () => settings },
    window: { devicePixelRatio: 2, location: { search: '', assign: url => navigations.push(url) }, matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    studies: fixtures,
    studySvg: study => study.id,
    sampleStudy: () => [{ filled: true, contours: [] }, { filled: false, contours: [] }],
    generateStitches: (shapes, options) => { calls.push({ shapes, options }); return shapes.flatMap(shape => [
      ...(options.fill && shape.filled ? [{ kind: 'fill' }] : []),
      ...(options.outline ? [{ kind: 'outline' }] : []),
    ]).map(segment => ({ ...segment, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })); },
  };
  runInNewContext(script + '\nglobalThis.start = initStitchStudy;', context);
  context.start();
  const flush = () => { while (frames.length) frames.shift()(); };
  return { defaults, nodes, settings, canvas, drawingContext, flush, calls, widths, colors, navigations, context };
}

test('Prev and Next follow drawing, outline and fill steps; Reset restores all defaults', () => {
  const { defaults, nodes, settings, canvas, drawingContext, flush, calls, widths, colors, navigations, context } = setup();
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 880);
  assert.deepEqual(drawingContext.transform, [2, 0, 0, 2, 0, 0]);
  assert.equal(nodes.next.disabled, false);
  assert.equal(nodes.prev.disabled, true);
  assert.equal(nodes['pattern-controls'].hidden, true);
  assert.equal(calls.length, 0, 'choosing a drawing must not generate stitches yet');
  assert.equal(nodes.status.hidden, true);
  assert.equal(nodes.status.textContent, '');
  assert.equal(nodes['stitch-preview'].hidden, true);
  nodes.drawing.value = 'horse'; nodes.drawing.listeners.change(); flush(); nodes.length.value = '10'; nodes['line-width'].value = '3';
  nodes.next.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 2 of 3 · Stitch the outline');
  assert.equal(nodes.controls.hidden, false);
  assert.equal(nodes['drawing-control'].hidden, true);
  assert.equal(nodes['drawing-preview'].hidden, true);
  assert.equal(nodes['pattern-controls'].hidden, true);
  assert.equal(nodes['stitch-preview'].hidden, false);
  assert.ok(settings.every(setting => !setting.hidden));
  assert.equal(calls.at(-1).options.fill, false);
  assert.equal(nodes.next.disabled, false);
  nodes.next.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 3 of 3 · Add a pattern fill');
  assert.equal(nodes['drawing-preview'].hidden, true);
  assert.equal(nodes.controls.hidden, true);
  assert.ok(settings.every(setting => setting.hidden));
  assert.equal(nodes['drawing-control'].hidden, true);
  assert.equal(nodes['pattern-controls'].hidden, false);
  assert.equal(nodes.status.hidden, true);
  assert.equal(nodes.next.hidden, false);
  assert.equal(nodes.next.disabled, false);
  assert.equal(nodes.next.textContent, 'Preview');
  assert.equal(nodes.prev.disabled, false);
  assert.equal(nodes.drawing.value, 'horse');
  assert.equal(calls.at(-1).options.length, 10);
  assert.equal(calls.at(-1).shapes[0].filled, true);
  assert.equal(calls.at(-1).shapes[1].filled, false);
  assert.equal(widths.at(-1), 3);
  assert.equal(widths[colors.lastIndexOf('#808080')], 0.5);
  nodes['fill-line-width'].value = '2';
  nodes['fill-line-width'].listeners.change(); flush();
  assert.equal(widths[colors.lastIndexOf('#808080')], 2);
  assert.equal(widths[colors.lastIndexOf('#33332e')], 3, 'outline width must not change with fill width');
  assert.equal(nodes.stage.focused, undefined, 'changing steps must not force focus onto the title');
  assert.equal(nodes.stage.scroll.behavior, 'auto');
  nodes.pattern.value = 'crosshatch'; nodes.spacing.value = '36'; nodes.angle.value = '45';
  nodes.pattern.listeners.change(); flush();
  assert.equal(calls.at(-1).options.pattern, 'crosshatch');
  assert.equal(calls.at(-1).options.spacing, 36);
  assert.equal(calls.at(-1).options.angle, 45);
  assert.equal(calls.at(-1).options.outline, true);
  nodes.prev.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 2 of 3 · Stitch the outline');
  assert.equal(nodes.controls.hidden, false);
  assert.ok(settings.every(setting => !setting.hidden));
  assert.equal(nodes.drawing.value, 'horse');
  assert.equal(nodes.length.value, '10');
  assert.equal(nodes.pattern.value, 'crosshatch');
  assert.equal(nodes.prev.disabled, false);
  assert.equal(nodes.next.disabled, false);
  nodes.next.listeners.click(); flush();
  assert.equal(nodes.pattern.value, 'crosshatch');
  assert.equal(calls.at(-1).options.outline, true);
  assert.ok(colors.includes('#808080'), 'pattern fill should use grey thread');
  assert.ok(colors.includes('#33332e'), 'outlines should remain dark');
  nodes.next.listeners.click();
  assert.equal(navigations.length, 1);
  const destination = new URL(navigations[0], 'https://example.com');
  assert.equal(destination.pathname, '/studio/drawing-to-stitches/preview/horse/');
  assert.equal(destination.searchParams.get('drawing'), 'horse');
  assert.equal(destination.searchParams.get('fillLineWidth'), '2');
  assert.equal(destination.searchParams.get('lineWidth'), '3');
  const count = calls.length;
  nodes.reset.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 1 of 3 · Choose a drawing');
  assert.equal(nodes['drawing-control'].hidden, false);
  assert.equal(nodes['drawing-preview'].hidden, false);
  assert.equal(nodes['pattern-controls'].hidden, true);
  assert.equal(nodes.next.hidden, false);
  assert.equal(nodes.next.disabled, false);
  assert.equal(nodes.prev.disabled, true);
  for (const [name, value] of Object.entries(defaults)) assert.equal(nodes[name].value, value);
  assert.equal(calls.length, count, 'Reset returns to drawing only');
  assert.equal(nodes['stitch-preview'].hidden, true);
  assert.ok(settings.every(setting => setting.hidden));
  nodes.next.listeners.click(); flush();
  assert.equal(calls.at(-1).options.fill, false);
  assert.equal(calls.at(-1).options.outline, true);
  assert.equal(widths.at(-1), 1.35);
  context.window.location.search = `${destination.search}&step=3`;
  context.start(); flush();
  assert.equal(nodes.stage.textContent, 'Step 3 of 3 · Add a pattern fill');
  assert.equal(nodes.next.textContent, 'Preview');
  assert.equal(nodes.drawing.value, 'horse');
  assert.equal(nodes['fill-line-width'].value, '2');
  assert.equal(nodes['line-width'].value, '3');
  assert.equal(nodes['pattern-controls'].hidden, false);
});


test('drawing selection applies its own defaults and flag-driven navigation skips unavailable steps', () => {
  for (const hasFill of [false, true]) {
    const horse = { ...studies.find(study => study.id === 'horse'), hasFill, hasOutline: !hasFill,
      defaults: { length: 10, gap: 6, lineWidth: 3, fillLineWidth: 2, pattern: 'rows', spacing: 48, angle: 90 } };
    const { nodes, calls, flush, navigations } = setup([initialStudy, horse]);
    nodes.drawing.value = 'horse'; nodes.drawing.listeners.change(); flush();
    assert.equal(nodes.stage.textContent, 'Step 1 of 2 · Choose a drawing');
    assert.equal(nodes.length.value, '10');
    assert.equal(nodes.pattern.value, 'rows');
    assert.equal(nodes['fill-line-width'].value, '2');
    nodes.next.listeners.click(); flush();
    assert.equal(nodes.stage.textContent, hasFill ? 'Step 2 of 2 · Add a pattern fill' : 'Step 2 of 2 · Stitch the outline');
    assert.equal(nodes.next.textContent, 'Preview');
    assert.equal(nodes['pattern-controls'].hidden, !hasFill);
    assert.equal(calls.at(-1).options.outline, !hasFill);
    assert.equal(calls.at(-1).options.fill, hasFill);
    nodes.prev.listeners.click(); flush();
    assert.equal(nodes.stage.textContent, 'Step 1 of 2 · Choose a drawing');
    nodes.next.listeners.click(); flush();
    nodes.next.listeners.click();
    assert.equal(new URL(navigations[0], 'https://example.com').searchParams.get('drawing'), 'horse');
    nodes.reset.listeners.click(); flush();
    assert.equal(nodes.drawing.value, initialStudy.id);
    assert.equal(nodes.stage.textContent, 'Step 1 of 3 · Choose a drawing');
    assert.equal(nodes.length.value, String(initialStudy.defaults.length));
  }
});


test('sampling centers a non-zero SVG viewBox without joining distinct contours', async () => {
  const sampling = await readFile(new URL('../src/studio/sample-svg.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(sampling, { compilerOptions: {
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
  } }).outputText.replace(/^import .+;\n/gm, '').replace(/^export /gm, '');
  const study = { viewBox: [-10, 20, 100, 100], shapes: [{ filled: false, contours: ['first', 'second'] }] };
  const context = { WIDTH: 600, HEIGHT: 440,
    document: { createElementNS: () => ({
      setAttribute(_, value) { this.path = value; },
      getTotalLength: () => 100,
      getPointAtLength(distance) { return { x: -10 + distance, y: this.path === 'first' ? 20 : 120 }; },
    }) },
  };
  runInNewContext(code + '\nglobalThis.sample = sampleStudy;', context);
  const sampled = context.sample(study);
  assert.equal(sampled[0].filled, false);
  assert.equal(sampled[0].contours.length, 2);
  const [top, bottom] = sampled[0].contours;
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
  close(top[0].x, 80); close(top[0].y, 0);
  close(top.at(-1).x, 520); close(top.at(-1).y, 0);
  close(bottom[0].x, 80); close(bottom[0].y, 440);
  close(bottom.at(-1).x, 520); close(bottom.at(-1).y, 440);
});
