import type { Study } from './studies';
import type { Point, SampledShape } from './stitches';

// The browser samples the curated SVG curves. No uploaded SVG is injected or run.
export function sampleStudy(study: Study): SampledShape[] {
  return study.shapes.map(shape => ({
    filled: shape.filled,
    contours: shape.contours.map(d => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      const length = path.getTotalLength();
      const steps = Math.max(1, Math.ceil(length / 2));
      return Array.from({ length: steps + 1 }, (_, index): Point => {
        const point = path.getPointAtLength(length * index / steps);
        return { x: point.x, y: point.y };
      });
    }),
  }));
}
