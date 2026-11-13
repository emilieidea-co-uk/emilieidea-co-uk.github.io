import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadStudioCatalog, parseStudioSvg, validateDefinition, studioCatalogPlugin } from '../scripts/studio-catalog.mjs';

const definition = {
  id: 'test', name: 'Test drawing', hasOutline: true, hasFill: true, source: 'test.svg',
  defaults: { length: 6, gap: 4, lineWidth: 1.35, fillLineWidth: .5, pattern: 'petals', spacing: 28, angle: 0 },
};
const svg = content => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 20 100 80">${content}</svg>`;

test('definitions require stable IDs, usable steps, local SVGs and supported defaults', () => {
  assert.equal(validateDefinition(definition), definition);
  for (const change of [
    { id: 'Bad ID' }, { name: '' }, { hasOutline: 'true' }, { hasFill: false, hasOutline: false },
    { source: '../outside.svg' }, { defaults: { ...definition.defaults, length: 100 } },
    { defaults: { ...definition.defaults, pattern: 'unknown' } },
  ]) assert.throws(() => validateDefinition({ ...definition, ...change }));
});

test('relative compound paths become independent absolute contours without losing holes', () => {
  const parsed = parseStudioSvg(svg('<path fill-rule="evenodd" d="m0 20h80v60h-80z m20 20h20v20h-20z"/>'));
  assert.deepEqual(parsed.viewBox, [-10, 20, 100, 80]);
  assert.equal(parsed.shapes.length, 1);
  assert.equal(parsed.shapes[0].filled, true);
  const contours = parsed.shapes[0].contours;
  assert.equal(contours.length, 2);
  assert.match(contours[0], /^M0 20/);
  assert.match(contours[1], /^M20 40/);
  assert.ok(contours.every(d => !/[mlhv]/.test(d)));
  assert.ok(contours.every(d => (d.match(/M/g) ?? []).length === 1 && /[zZ]$/.test(d)));
  const open = parseStudioSvg(svg('<path fill="none" d="m0 20 10 10 m20 0 10 10"/>'));
  assert.equal(open.shapes[0].contours.length, 2);
  assert.equal(open.shapes[0].filled, false);
  assert.ok(open.shapes[0].contours.every(d => !/[zZ]$/.test(d)));
});

test('only direct paths are accepted, with prepared transforms and even-odd compound fills', () => {
  for (const content of [
    '<rect width="10" height="10"/>', '<circle r="5"/>', '<g><path d="M0 0L10 10"/></g>',
    '<path transform="translate(2)" d="M0 0L10 10"/>', '<path style="fill:red" d="M0 0L10 10"/>',
    '<path fill="url(#paint)" d="M0 0L10 10"/>', '<path d="M0 0"/>',
    '<path d="M0 0L10 0L10 10Z M2 2L4 2L4 4Z"/>',
  ]) assert.throws(() => parseStudioSvg(svg(content)));
  assert.throws(() => parseStudioSvg('<svg><path d="M0 0L1 1"/></svg>'), /viewBox/);
  assert.throws(() => parseStudioSvg(svg('')), /at least one/);
  const closed = parseStudioSvg(svg('<path d="M0 0L10 0L10 10"/>'));
  assert.match(closed.shapes[0].contours[0], /Z$/);
});

test('catalog discovers pairs and rejects missing files, duplicate IDs and fills without areas', () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-catalog-'));
  const definitions = join(root, 'data'), assets = join(root, 'assets');
  mkdirSync(definitions); mkdirSync(assets);
  const save = (file, value) => writeFileSync(join(definitions, file), JSON.stringify(value));
  try {
    save('test.json', definition);
    assert.throws(() => loadStudioCatalog(definitions, assets), /missing SVG/);
    writeFileSync(join(assets, 'test.svg'), svg('<path d="M0 0L20 0L20 20Z"/>'));
    assert.equal(loadStudioCatalog(definitions, assets)[0].id, 'test');
    save('copy.json', definition);
    assert.throws(() => loadStudioCatalog(definitions, assets), /duplicate drawing id/);
    rmSync(join(definitions, 'copy.json'));
    writeFileSync(join(assets, 'test.svg'), svg('<path fill="none" d="M0 0L20 20"/>'));
    assert.throws(() => loadStudioCatalog(definitions, assets), /hasFill requires/);
    save('test.json', { ...definition, hasFill: false });
    assert.equal(loadStudioCatalog(definitions, assets)[0].hasFill, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('dev navigation refreshes changed JSON and invalidates server/client data even without a watch event', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-reload-'));
  const definitions = join(root, 'data'), assets = join(root, 'assets'), output = join(root, '.astro/catalog.json');
  mkdirSync(definitions); mkdirSync(assets);
  const file = join(definitions, 'test.json');
  writeFileSync(file, JSON.stringify(definition));
  writeFileSync(join(assets, 'test.svg'), svg('<path d="M0 0L20 0L20 20Z"/>'));
  let middleware;
  const events = {}, reloads = [], messages = [];
  const environment = name => ({
    moduleGraph: { getModulesByFile(path) { assert.equal(path, output); return new Set([{ name }]); } },
    async reloadModule(module) { reloads.push(module.name); },
  });
  const watcher = { add() {}, on(event, callback) { events[event] = callback; return this; } };
  studioCatalogPlugin({ definitions, assets, output }).configureServer({
    environments: { client: environment('client'), ssr: environment('ssr') }, watcher,
    ws: { send: message => messages.push(message) }, config: { logger: { error() {} } },
    middlewares: { use(callback) { middleware = callback; } },
  });
  const request = () => new Promise((resolve, reject) => middleware({ url: '/studio/drawing-to-stitches/' }, {}, error => error ? reject(error) : resolve()));
  try {
    await request();
    assert.equal(JSON.parse(readFileSync(output))[0].hasOutline, true);
    writeFileSync(file, JSON.stringify({ ...definition, hasOutline: false }));
    // Intentionally do not emit a watch event: navigation must still see the edit.
    await request();
    assert.equal(JSON.parse(readFileSync(output))[0].hasOutline, false);
    assert.deepEqual(reloads, ['client', 'ssr', 'client', 'ssr']);
    assert.equal(messages.filter(message => message.type === 'full-reload').length, 2);
    await request();
    assert.equal(reloads.length, 4, 'unchanged requests must not rebuild or reload');
    writeFileSync(file, '{');
    await assert.rejects(request());
    assert.doesNotThrow(() => events.change(file), 'invalid edits should report an overlay rather than crash the watcher');
    assert.equal(messages.at(-1).type, 'error');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
