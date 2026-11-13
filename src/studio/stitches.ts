export type Point = { x: number; y: number };
export type Segment = { from: Point; to: Point; kind?: 'fill' | 'outline' };
export const FILL_COLOR = '#aaaaaa';
export const OUTLINE_COLOR = '#33332e';
export type Pattern = 'rows' | 'crosshatch' | 'petals';
export interface SampledShape { contours: Point[][]; filled: boolean }
export interface StitchOptions {
  length: number; gap: number; spacing: number; angle: number; pattern: Pattern; outline: boolean;
}
export const MAX_STITCHES = 12000;
const EPSILON = 1e-7;
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const at = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

// Alternate a visible length and an invisible gap along a continuous polyline.
// Each returned line is independent: no thread is drawn over a gap or path jump.
export function runningStitches(points: Point[], length: number, gap: number): Segment[] {
  if (!(length > 0 && gap > 0)) throw new Error('Stitch length and gap must be positive.');
  const result: Segment[] = [];
  const period = length + gap;
  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], size = distance(a, b);
    if (size < EPSILON) continue;
    let offset = 0;
    while (offset < size - EPSILON) {
      const phase = (travelled + offset) % period;
      const visible = phase < length - EPSILON;
      const step = Math.min(size - offset, Math.max(EPSILON, (visible ? length : period) - phase));
      if (visible && step > EPSILON) result.push({ from: at(a, b, offset / size), to: at(a, b, (offset + step) / size) });
      offset += step;
    }
    travelled += size;
  }
  return result;
}

// Even-odd containment handles both an outer contour and its holes.
export function inside(point: Point, contours: Point[][]): boolean {
  let result = false;
  for (const polygon of contours) {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y) &&
          point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
    }
  }
  return result;
}

// Split a stitch at every boundary crossing, then retain only inside intervals.
// Checking endpoints alone would incorrectly bridge a hole or concave notch.
export function clipSegment(segment: Segment, contours: Point[][]): Segment[] {
  const { from: a, to: b } = segment;
  const vector = { x: b.x - a.x, y: b.y - a.y };
  const cuts = [0, 1];
  for (const polygon of contours) {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const c = polygon[j], d = polygon[i];
      const edge = { x: d.x - c.x, y: d.y - c.y };
      const denominator = cross(vector, edge);
      if (Math.abs(denominator) < EPSILON) continue;
      const relative = { x: c.x - a.x, y: c.y - a.y };
      const t = cross(relative, edge) / denominator;
      const u = cross(relative, vector) / denominator;
      if (t > 0 && t < 1 && u >= -EPSILON && u <= 1 + EPSILON) cuts.push(t);
    }
  }
  cuts.sort((x, y) => x - y);
  const result: Segment[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const start = cuts[i - 1], end = cuts[i];
    if (end - start < EPSILON || !inside(at(a, b, (start + end) / 2), contours)) continue;
    const from = at(a, b, start), to = at(a, b, end);
    if (distance(from, to) > .15) result.push({ from, to });
  }
  return result;
}

function patternPaths(width: number, height: number, options: StitchOptions): Point[][] {
  const angle = options.angle * Math.PI / 180;
  const rotate = (x: number, y: number): Point => ({
    x: width / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: height / 2 + x * Math.sin(angle) + y * Math.cos(angle),
  });
  const extent = Math.hypot(width, height) / 2;
  const paths: Point[][] = [];
  if (options.pattern === 'petals') {
    const radius = options.spacing * 1.5;
    const rowHeight = radius * Math.sqrt(3) / 2;
    const rows = Math.ceil((extent + radius) / rowHeight);
    const columns = Math.ceil((extent + radius) / radius);
    for (let row = -rows; row <= rows; row++) {
      for (let column = -columns; column <= columns; column++) {
        const cx = column * radius + (Math.abs(row) % 2) * radius / 2;
        const cy = row * rowHeight;
        const steps = Math.max(24, Math.ceil(2 * Math.PI * radius / 3));
        paths.push(Array.from({ length: steps + 1 }, (_, index) => {
          const theta = index / steps * Math.PI * 2;
          return rotate(cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius);
        }));
      }
    }
  } else {
    const rows = Math.ceil(extent / options.spacing);
    for (let row = -rows; row <= rows; row++) {
      const y = row * options.spacing;
      paths.push([rotate(-extent, y), rotate(extent, y)]);
      if (options.pattern === 'crosshatch') paths.push([rotate(y, -extent), rotate(y, extent)]);
    }
  }
  return paths;
}

export function generateStitches(shapes: SampledShape[], options: StitchOptions, width = 600, height = 440): Segment[] {
  if (![options.length, options.gap, options.spacing, options.angle, width, height].every(Number.isFinite) ||
      options.length < 2 || options.gap < 1 || options.spacing < 8 || width <= 0 || height <= 0 ||
      !['rows', 'crosshatch', 'petals'].includes(options.pattern)) throw new Error('Invalid stitch settings.');
  const result: Segment[] = [];
  const add = (segments: Segment[], kind: 'fill' | 'outline') => {
    if (result.length + segments.length > MAX_STITCHES) throw new Error('Too many stitches. Increase pattern spacing or stitch length.');
    result.push(...segments.map(segment => ({ ...segment, kind })));
  };
  const paths = shapes.some(shape => shape.filled) ? patternPaths(width, height, options) : [];
  for (const shape of shapes) {
    if (shape.filled) {
      for (const path of paths) {
        for (const stitch of runningStitches(path, options.length, options.gap)) add(clipSegment(stitch, shape.contours), 'fill');
      }
    }
    if (!shape.filled || options.outline) {
      for (const contour of shape.contours) add(runningStitches(contour, options.length, options.gap), 'outline');
    }
  }
  return result;
}

export function stitchesSvg(segments: Segment[], width = 600, height = 440): string {
  const number = (value: number) => value.toFixed(3);
  const lines = segments.map(({ from, to, kind }) => `<path d="M${number(from.x)} ${number(from.y)}L${number(to.x)} ${number(to.y)}"${kind === 'fill' ? ` stroke="${FILL_COLOR}"` : ''}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>EmilieIdea hand-stitch study</title><rect width="100%" height="100%" fill="#f5f1e7"/><g fill="none" stroke="#33332e" stroke-width="1.35" stroke-linecap="round">${lines}</g></svg>`;
}

export function playbackPosition(position: number, elapsedMs: number, total: number): number {
  return Math.min(total, position + Math.max(0, elapsedMs) * .24);
}
