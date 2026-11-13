import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimize } from 'svgo';
import { CONTROL_VALUES, PATTERNS, INITIAL_DRAWING } from '../src/studio/options.mjs';

export const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const studioDefinitions = join(studioRoot, 'src/data/studio');
export const studioAssets = join(studioRoot, 'src/assets/studio');
export const studioOutput = join(studioRoot, '.astro/studio/catalog.json');

export function validateDefinition(value, label = 'drawing') {
  const fail = message => { throw new Error(`${label}: ${message}`); };
  if (!value || typeof value !== 'object') fail('expected a JSON object');
  if (typeof value.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value.id)) fail('id must use lowercase letters, numbers and hyphens');
  if (typeof value.name !== 'string' || !value.name.trim()) fail('name is required');
  if (typeof value.hasOutline !== 'boolean' || typeof value.hasFill !== 'boolean') fail('hasOutline and hasFill must be booleans');
  if (!value.hasOutline && !value.hasFill) fail('enable hasOutline or hasFill');
  if (typeof value.source !== 'string' || !/^[\w-]+\.svg$/.test(value.source)) fail('source must be an SVG filename in src/assets/studio');
  if (!value.defaults || typeof value.defaults !== 'object') fail('defaults are required');
  for (const [key, allowed] of Object.entries(CONTROL_VALUES)) {
    if (!allowed.includes(value.defaults[key])) fail(`defaults.${key} must be one of ${allowed.join(', ')}`);
  }
  if (!PATTERNS.includes(value.defaults.pattern)) fail(`defaults.pattern must be one of ${PATTERNS.join(', ')}`);
  return value;
}

// Parse only SVG/path elements, then normalize path commands to absolute form.
// Separate M subpaths remain separate contours, including compound-path holes.
export function parseStudioSvg(source, label = 'SVG') {
  const fail = message => { throw new Error(`${label}: ${message}`); };
  let viewBox;
  const shapes = [];
  optimize(source, {
    path: label,
    plugins: [
      { name: 'validate-path-only', fn: () => ({ element: { enter(node, parent) {
        if (node.name === 'svg') {
          if (parent.type !== 'root' || viewBox) fail('use a single root SVG');
          const values = (node.attributes.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
          if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) fail('a finite viewBox with positive width and height is required');
          viewBox = values;
        } else if (node.name !== 'path' || parent.name !== 'svg') {
          fail(`only direct <path> elements inside <svg> are supported; found <${node.name}>`);
        }
        for (const attribute of Object.keys(node.attributes)) {
          if (/^on/i.test(attribute) || ['transform', 'style', 'class', 'href', 'xlink:href', 'clip-path', 'mask', 'filter'].includes(attribute)) {
            fail(`flatten or remove ${attribute}; only prepared paths are supported`);
          }
        }
        if (Object.values(node.attributes).some(value => /url\(/i.test(value))) fail('external or referenced paints are not supported');
        if (node.name === 'path' && !node.attributes.d?.trim()) fail('every path needs a non-empty d attribute');
      } } }) },
      { name: 'convertPathData', params: {
        forceAbsolutePath: true, floatPrecision: 8, applyTransforms: false,
        straightCurves: false, convertToQ: false, lineShorthands: false,
        convertToZ: false, curveSmoothShorthands: false, removeUseless: false,
        collapseRepeated: false, smartArcRounding: false,
      } },
      { name: 'collect-paths', fn: () => ({ element: { enter(node, parent) {
        if (node.name !== 'path') return;
        const attrs = node.attributes;
        const filled = (attrs.fill ?? parent.attributes.fill ?? 'black') !== 'none';
        const contours = (attrs.d.match(/M[^M]+/g) ?? []).map(d => d.trim());
        if (!contours.length || contours.some(d => !/[LlHhVvCcSsQqTtAaZz]/.test(d) && (d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []).length < 4)) fail('path contains no drawable segments');
        if (filled && contours.length > 1 && (attrs['fill-rule'] ?? parent.attributes['fill-rule']) !== 'evenodd') {
          fail('compound filled paths must use fill-rule="evenodd"');
        }
        // SVG implicitly closes filled paths; make that closure explicit for stitching.
        shapes.push({ filled, contours: contours.map(d => filled && !/[zZ]$/.test(d) ? `${d} Z` : d) });
      } } }) },
    ],
  });
  if (!viewBox || !shapes.length) fail('at least one drawable path is required');
  return { viewBox, shapes };
}

export function loadStudioCatalog(definitions = studioDefinitions, assets = studioAssets) {
  const ids = new Set();
  const catalog = readdirSync(definitions).filter(file => file.endsWith('.json')).sort().map(file => {
    const label = join(definitions, file);
    const definition = validateDefinition(JSON.parse(readFileSync(label, 'utf8')), label);
    if (ids.has(definition.id)) throw new Error(`${label}: duplicate drawing id ${definition.id}`);
    ids.add(definition.id);
    const source = join(assets, definition.source);
    if (!existsSync(source)) throw new Error(`${label}: missing SVG ${definition.source}`);
    const parsed = parseStudioSvg(readFileSync(source, 'utf8'), source);
    if (definition.hasFill && !parsed.shapes.some(shape => shape.filled)) throw new Error(`${label}: hasFill requires a filled SVG path`);
    return { ...definition, ...parsed };
  });
  if (!catalog.length) throw new Error('Studio requires at least one drawing definition');
  // Keep the original medallion as the initial drawing, followed by names alphabetically.
  return catalog.sort((a, b) => a.id === INITIAL_DRAWING ? -1 : b.id === INITIAL_DRAWING ? 1 : a.name.localeCompare(b.name, 'en'));
}

export function generateStudioCatalog(definitions = studioDefinitions, assets = studioAssets, output = studioOutput) {
  const catalog = loadStudioCatalog(definitions, assets);
  const json = JSON.stringify(catalog, null, 2) + '\n';
  mkdirSync(dirname(output), { recursive: true });
  if (!existsSync(output) || readFileSync(output, 'utf8') !== json) writeFileSync(output, json);
  return catalog;
}

export function studioCatalogPlugin({ definitions = studioDefinitions, assets = studioAssets, output = studioOutput } = {}) {
  const folders = [definitions, assets];
  const relevant = file => folders.some(folder => file.startsWith(folder + '/'));
  const signature = () => folders.flatMap(folder => readdirSync(folder).sort().map(file => {
    const path = join(folder, file);
    const stat = statSync(path);
    return `${path}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.size}`;
  })).join('|');
  return {
    name: 'studio-json-svg-catalog',
    buildStart() {
      for (const folder of folders) {
        for (const file of readdirSync(folder)) this.addWatchFile(join(folder, file));
      }
    },
    configureServer(server) {
      let previous = '';
      let pending;
      // .astro is ignored by Vite's filesystem watcher. Refresh every module
      // environment explicitly so both SSR and the browser receive the new data.
      const refresh = () => {
        if (pending) return pending;
        const current = signature();
        if (current === previous) return Promise.resolve();
        generateStudioCatalog(definitions, assets, output);
        pending = (async () => {
          for (const environment of Object.values(server.environments)) {
            const modules = environment.moduleGraph.getModulesByFile(output);
            for (const module of modules ?? []) await environment.reloadModule(module);
          }
          previous = current;
          server.ws.send({ type: 'full-reload' });
        })().finally(() => { pending = undefined; });
        return pending;
      };
      server.watcher.add(folders);
      const regenerate = file => {
        if (!relevant(file)) return;
        const report = error => {
          server.config.logger.error(error.message);
          server.ws.send({ type: 'error', err: { message: error.message, stack: error.stack } });
        };
        try { refresh().catch(report); }
        catch (error) { report(error); }
      };
      server.watcher.on('add', regenerate).on('change', regenerate).on('unlink', regenerate);
      // Also check on navigation: edits from shared workspaces can miss watch
      // notifications, but refreshing the page must always use the current JSON.
      server.middlewares.use((request, response, next) => {
        if (!request.url?.includes('/studio/')) { next(); return; }
        try { refresh().then(() => next(), next); }
        catch (error) { next(error); }
      });
    },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Studio: ${generateStudioCatalog().length} JSON/SVG drawings validated`);
}
