import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { readSettings, settingsQuery } from '../src/studio/settings.ts';

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
  const original = {}, description = {};
  const elements = { '#study-drawing': select, '#study-original': original, '#study-description': description };
  runInNewContext(code + '\ninitDrawingSelection();', {
    document: { querySelector: selector => elements[selector] },
    studies: [{ id: 'petals', description: 'Petals drawing' }, { id: 'horse', description: 'Horse drawing' }],
    studySvg: study => `<svg>${study.id}</svg>`,
  });
  assert.equal(select.disabled, false);
  select.value = 'horse'; select.change();
  assert.equal(original.innerHTML, '<svg>horse</svg>');
  assert.equal(description.textContent, 'Horse drawing');
});

test('Prev and Next follow drawing, outline and fill steps; Reset restores all defaults', async () => {
  const defaults = { drawing: 'petals', length: '6', gap: '4', 'line-width': '1.35', 'fill-line-width': '0.5', pattern: 'petals', spacing: '28', angle: '0' };
  const names = ['canvas', ...Object.keys(defaults), 'drawing-control', 'drawing-preview', 'prev', 'next', 'reset', 'original', 'description', 'status', 'stage', 'instructions', 'pattern-controls', 'controls', 'stitch-preview'];
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
    readSettings, settingsQuery, URLSearchParams, withBase: path => path,
    document: { createElement: () => canvas, querySelector: selector => nodes[selector.replace('#study-', '')], querySelectorAll: () => settings },
    window: { devicePixelRatio: 2, location: { search: '', assign: url => navigations.push(url) }, matchMedia: () => ({ matches: true }) },
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    studies: [{ id: 'petals', title: 'Petals', description: 'Medallion' }, { id: 'horse', title: 'Horse', description: 'Horse study' }],
    studySvg: study => study.id,
    sampleStudy: () => [{ filled: true, contours: [] }, { filled: false, contours: [] }],
    generateStitches: (shapes, options) => { calls.push({ shapes, options }); return shapes.map(shape => ({ kind: shape.filled ? 'fill' : 'outline', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } })); },
  };
  runInNewContext(script + '\nglobalThis.start = initStitchStudy;', context);
  await context.start();
  assert.equal(canvas.width, 1200);
  assert.equal(canvas.height, 880);
  assert.deepEqual(drawingContext.transform, [2, 0, 0, 2, 0, 0]);
  const flush = () => { while (frames.length) frames.shift()(); };
  assert.equal(nodes.next.disabled, false);
  assert.equal(nodes.prev.disabled, true);
  assert.equal(nodes['pattern-controls'].hidden, true);
  assert.equal(calls.length, 0, 'choosing a drawing must not generate stitches yet');
  assert.equal(nodes['stitch-preview'].hidden, true);
  nodes.drawing.value = 'horse'; nodes.length.value = '10'; nodes['line-width'].value = '3';
  nodes.next.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 2 of 3 · Stitch the outline');
  assert.equal(nodes.controls.hidden, false);
  assert.equal(nodes['drawing-control'].hidden, true);
  assert.equal(nodes['drawing-preview'].hidden, true);
  assert.equal(nodes['pattern-controls'].hidden, true);
  assert.equal(nodes['stitch-preview'].hidden, false);
  assert.ok(settings.every(setting => !setting.hidden));
  assert.ok(calls.at(-1).shapes.every(shape => !shape.filled));
  assert.equal(nodes.next.disabled, false);
  nodes.next.listeners.click(); flush();
  assert.equal(nodes.stage.textContent, 'Step 3 of 3 · Add a pattern fill');
  assert.equal(nodes['drawing-preview'].hidden, true);
  assert.equal(nodes.controls.hidden, true);
  assert.ok(settings.every(setting => setting.hidden));
  assert.equal(nodes['drawing-control'].hidden, true);
  assert.equal(nodes['pattern-controls'].hidden, false);
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
  assert.equal(destination.pathname, '/studio/drawing-to-stitches/preview/');
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
  assert.ok(calls.at(-1).shapes.every(shape => !shape.filled));
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
