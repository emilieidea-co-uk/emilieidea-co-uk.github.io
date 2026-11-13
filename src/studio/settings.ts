import { studies } from './studies.ts';
import type { Pattern } from './stitches';

export interface StudySettings {
  drawing: string; length: number; gap: number; lineWidth: number;
  fillLineWidth: number; pattern: Pattern; spacing: number; angle: number;
}
export const DEFAULT_SETTINGS: StudySettings = {
  drawing: 'petals', length: 6, gap: 4, lineWidth: 1.35,
  fillLineWidth: .5, pattern: 'petals', spacing: 28, angle: 0,
};

// Only settings offered by the editor are accepted, including on shared URLs.
export function readSettings(search: string): StudySettings {
  const query = new URLSearchParams(search);
  const number = (key: keyof StudySettings, choices: number[]) => {
    const value = Number(query.get(key));
    return query.has(key) && choices.includes(value) ? value : DEFAULT_SETTINGS[key] as number;
  };
  const drawing = query.get('drawing') ?? '';
  const pattern = query.get('pattern') ?? '';
  return {
    drawing: studies.some(study => study.id === drawing) ? drawing : DEFAULT_SETTINGS.drawing,
    length: number('length', Array.from({ length: 13 }, (_, i) => i + 2)),
    gap: number('gap', Array.from({ length: 12 }, (_, i) => i + 1)),
    lineWidth: number('lineWidth', [.5, 1, 1.35, 2, 3, 4]),
    fillLineWidth: number('fillLineWidth', [.5, 1, 1.35, 2, 3, 4]),
    spacing: number('spacing', [12, 18, 24, 28, 36, 48]),
    angle: number('angle', [0, 15, 30, 45, 60, 90]),
    pattern: ['rows', 'crosshatch', 'petals'].includes(pattern) ? pattern as Pattern : DEFAULT_SETTINGS.pattern,
  };
}

export function settingsQuery(settings: StudySettings): string {
  return new URLSearchParams(Object.entries(settings).map(([key, value]) => [key, String(value)])).toString();
}
