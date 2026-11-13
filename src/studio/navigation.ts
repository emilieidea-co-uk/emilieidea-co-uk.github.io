import type { Study } from './studies';

export function availableStages(study: Pick<Study, 'hasOutline' | 'hasFill'>): number[] {
  return [1, ...(study.hasOutline ? [2] : []), ...(study.hasFill ? [3] : [])];
}
export function lastStage(study: Pick<Study, 'hasOutline' | 'hasFill'>): number {
  return study.hasFill ? 3 : 2;
}
export function stageTitle(study: Pick<Study, 'hasOutline' | 'hasFill'>, stage: number): string {
  const stages = availableStages(study);
  const name = ['', 'Choose a drawing', 'Stitch the outline', 'Add a pattern fill'][stage];
  return `Step ${stages.indexOf(stage) + 1} of ${stages.length} · ${name}`;
}
