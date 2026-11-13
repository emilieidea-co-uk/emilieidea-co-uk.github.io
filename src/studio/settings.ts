import { studies, initialStudy } from './studies.ts';
import type { Study, StudyDefaults } from './studies';
import { CONTROL_VALUES, PATTERNS } from './options.mjs';

export interface StudySettings extends StudyDefaults { drawing: string }
export const defaultsForStudy = (study: Study): StudySettings => ({ drawing: study.id, ...study.defaults });
export const DEFAULT_SETTINGS = defaultsForStudy(initialStudy);

// Only settings offered by the editor are accepted, including on shared URLs.
export function readSettings(search: string): StudySettings {
  const query = new URLSearchParams(search);
  const study = studies.find(study => study.id === query.get('drawing')) ?? initialStudy;
  const defaults = defaultsForStudy(study);
  const number = (key: keyof typeof CONTROL_VALUES) => {
    const value = Number(query.get(key));
    return query.has(key) && CONTROL_VALUES[key].includes(value) ? value : defaults[key];
  };
  const pattern = query.get('pattern') ?? '';
  return {
    drawing: study.id,
    length: number('length'), gap: number('gap'), lineWidth: number('lineWidth'),
    fillLineWidth: number('fillLineWidth'), spacing: number('spacing'), angle: number('angle'),
    pattern: PATTERNS.includes(pattern) ? pattern as StudyDefaults['pattern'] : defaults.pattern,
  };
}

export function settingsQuery(settings: StudySettings): string {
  return new URLSearchParams(Object.entries(settings).map(([key, value]) => [key, String(value)])).toString();
}
