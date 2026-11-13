import { FILL_COLOR, OUTLINE_COLOR } from './stitches';
import type { Segment } from './stitches';

// Native Canvas 2D: one moveTo for every stitch keeps separate paths and gaps
// disconnected. Batch adjacent stitches with the same colour into one stroke.
export function renderStitches(context: CanvasRenderingContext2D, segments: Segment[], lineWidth: number, width = 600, height = 440, fillLineWidth = 0.5, visibleCount = segments.length): void {
  context.fillStyle = '#f5f1e7';
  context.fillRect(0, 0, width, height);
  context.lineWidth = lineWidth;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  let color = '';
  let activeWidth = lineWidth;
  for (let i = 0; i < Math.min(segments.length, Math.floor(visibleCount)); i++) {
    const { from, to, kind } = segments[i];
    const nextColor = kind === 'fill' ? FILL_COLOR : OUTLINE_COLOR;
    const nextWidth = kind === 'fill' ? fillLineWidth : lineWidth;
    if (nextColor !== color || nextWidth !== activeWidth) {
      if (color) context.stroke();
      context.beginPath();
      context.strokeStyle = nextColor;
      context.lineWidth = nextWidth;
      color = nextColor;
      activeWidth = nextWidth;
    }
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  }
  if (color) context.stroke();
}
