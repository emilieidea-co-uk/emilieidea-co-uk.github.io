import type { Segment } from './stitches';

// Visible thread length, excluding gaps and jumps between independent stitches.
export function stitchDistances(segments: Segment[]): number[] {
  const distances = [0];
  for (const { from, to } of segments) {
    distances.push(distances[distances.length - 1] + Math.hypot(to.x - from.x, to.y - from.y));
  }
  return distances;
}

// A fractional index lets the renderer reveal part of a longer stitch smoothly.
export function segmentPosition(distances: number[], distance: number): number {
  const count = distances.length - 1;
  if (!count || distance <= 0) return 0;
  if (distance >= distances[count]) return count;
  let low = 0, high = count;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (distances[middle] <= distance) low = middle;
    else high = middle;
  }
  const length = distances[low + 1] - distances[low];
  return low + (length ? (distance - distances[low]) / length : 1);
}
