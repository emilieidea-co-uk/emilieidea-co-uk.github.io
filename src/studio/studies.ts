import catalog from '../../.astro/studio/catalog.json' with { type: 'json' };
import type { Pattern } from './stitches';

export interface StudyDefaults {
  length: number; gap: number; lineWidth: number; fillLineWidth: number;
  pattern: Pattern; spacing: number; angle: number;
}
export interface StudyShape { contours: string[]; filled: boolean }
export interface Study {
  id: string; name: string; hasOutline: boolean; hasFill: boolean; source: string;
  defaults: StudyDefaults; viewBox: number[]; shapes: StudyShape[];
}
export const WIDTH = 600;
export const HEIGHT = 440;
// Generated from JSON/SVG before dev, build and tests. The generator and XML
// parser are never imported into the browser bundle.
export const studies = catalog as Study[];
export const initialStudy = studies[0];

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
export function studySvg(study: Study): string {
  const paths = study.shapes.map(shape => `<path d="${escape(shape.contours.join(' '))}" fill="${shape.filled ? '#d0d0d0' : 'none'}" fill-rule="evenodd" stroke="#33332e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${study.viewBox.join(' ')}" role="img" aria-label="${escape(study.name)} study drawing">${paths}</svg>`;
}
