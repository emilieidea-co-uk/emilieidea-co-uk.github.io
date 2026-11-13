import { studies, initialStudy, studySvg, WIDTH, HEIGHT } from './studies';
import { sampleStudy } from './sample-svg';
import { generateStitches } from './stitches';
import { renderStitches } from './render-canvas';
import { readSettings, settingsQuery, defaultsForStudy, DEFAULT_SETTINGS } from './settings';
import { withBase } from '../lib/urls';
import { initViewportHeight } from './viewport';
import { availableStages, lastStage, stageTitle } from './navigation';
import type { StudySettings } from './settings';
import type { SampledShape, Pattern } from './stitches';

// All geometry stays in drawing units; only the canvas backing pixels scale
// for a high-density screen. There is no renderer library or startup lifecycle.
export function initStitchStudy(): void {
  const host = document.querySelector<HTMLElement>('#study-canvas');
  if (!host) return;
  initViewportHeight();
  const screen = document.querySelector<HTMLElement>('#study-screen');
  const drawing = document.querySelector<HTMLSelectElement>('#study-drawing')!;
  const drawingControl = document.querySelector<HTMLElement>('#study-drawing-control')!;
  const length = document.querySelector<HTMLSelectElement>('#study-length')!;
  const gap = document.querySelector<HTMLSelectElement>('#study-gap')!;
  const lineWidth = document.querySelector<HTMLSelectElement>('#study-line-width')!;
  const fillLineWidth = document.querySelector<HTMLSelectElement>('#study-fill-line-width')!;
  const pattern = document.querySelector<HTMLSelectElement>('#study-pattern')!;
  const spacing = document.querySelector<HTMLSelectElement>('#study-spacing')!;
  const angle = document.querySelector<HTMLSelectElement>('#study-angle')!;
  const next = document.querySelector<HTMLButtonElement>('#study-next')!;
  const prev = document.querySelector<HTMLButtonElement>('#study-prev')!;
  const reset = document.querySelector<HTMLButtonElement>('#study-reset')!;
  const stageHeading = document.querySelector<HTMLElement>('#study-stage')!;
  const patternControls = document.querySelector<HTMLFieldSetElement>('#study-pattern-controls')!;
  const controls = document.querySelector<HTMLElement>('#study-controls')!;
  const drawingPreview = document.querySelector<HTMLElement>('#study-drawing-preview')!;
  const stitchPreview = document.querySelector<HTMLElement>('#study-stitch-preview')!;
  const stitchSettings = document.querySelectorAll<HTMLElement>('[data-stitch-setting]');
  const original = document.querySelector<HTMLElement>('#study-original')!;
  const status = document.querySelector<HTMLElement>('#study-status')!;
  const canvas = document.createElement('canvas');
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * density;
  canvas.height = HEIGHT * density;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Hand-stitch preview');
  host.replaceChildren(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  context.setTransform(density, 0, 0, density, 0, 0);
  const sampled = new Map<string, SampledShape[]>();
  let pending = 0;
  let stage = 1;

  const currentStudy = () => studies.find(study => study.id === drawing.value) ?? initialStudy;
  const regenerate = () => {
    const study = currentStudy();
    original.innerHTML = studySvg(study);
    status.hidden = true;
    status.textContent = '';
    if (stage === 1) {
      renderStitches(context, [], Number(lineWidth.value), WIDTH, HEIGHT);
      return;
    }
    try {
      if (!sampled.has(study.id)) sampled.set(study.id, sampleStudy(study));
      const shapes = sampled.get(study.id)!;
      const segments = generateStitches(shapes, {
        length: Number(length.value), gap: Number(gap.value), spacing: Number(spacing.value),
        angle: Number(angle.value), pattern: pattern.value as Pattern, outline: study.hasOutline, fill: stage === 3 && study.hasFill,
      });
      renderStitches(context, segments, Number(lineWidth.value), WIDTH, HEIGHT, Number(fillLineWidth.value));
    } catch (error) {
      renderStitches(context, [], Number(lineWidth.value), WIDTH, HEIGHT);
      console.error('Studio stitch generation failed:', error);
      status.hidden = false;
      status.textContent = error instanceof Error ? error.message : 'This drawing could not be converted. Choose another drawing or press Reset.';
    }
  };

  // Batch rapid control changes, with no continuously running animation loop.
  const schedule = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; regenerate(); });
  };
  for (const control of [length, gap, lineWidth, fillLineWidth, pattern, spacing, angle]) {
    control.disabled = false;
    control.addEventListener('change', schedule);
  }
  const showStage = (value: number) => {
    const study = currentStudy();
    stage = availableStages(study).includes(value) ? value : lastStage(study);
    stageHeading.textContent = stageTitle(study, stage);
    controls.classList.toggle('is-drawing-only', stage === 1);
    controls.hidden = stage === 3;
    drawingControl.hidden = stage !== 1;
    drawingPreview.hidden = stage !== 1;
    stitchPreview.hidden = stage === 1;
    for (const setting of stitchSettings) setting.hidden = stage !== 2;
    patternControls.hidden = stage !== 3;
    prev.disabled = stage === 1;
    next.disabled = false;
    next.textContent = stage === lastStage(study) ? 'Preview' : 'Next';
    (screen ?? stageHeading).scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    schedule();
  };
  prev.addEventListener('click', () => {
    const stages = availableStages(currentStudy());
    const index = stages.indexOf(stage);
    if (index > 0) showStage(stages[index - 1]);
  });
  next.addEventListener('click', () => {
    const stages = availableStages(currentStudy());
    const index = stages.indexOf(stage);
    if (index < stages.length - 1) { showStage(stages[index + 1]); return; }
    const settings = {
      drawing: drawing.value, length: Number(length.value), gap: Number(gap.value),
      lineWidth: Number(lineWidth.value), fillLineWidth: Number(fillLineWidth.value),
      pattern: pattern.value as Pattern, spacing: Number(spacing.value), angle: Number(angle.value),
    };
    window.location.assign(`${withBase('/studio/drawing-to-stitches/preview/')}?${settingsQuery(settings)}`);
  });
  const applySettings = (settings: StudySettings) => {
    drawing.value = settings.drawing;
    length.value = String(settings.length); gap.value = String(settings.gap);
    lineWidth.value = String(settings.lineWidth); fillLineWidth.value = String(settings.fillLineWidth);
    pattern.value = settings.pattern; spacing.value = String(settings.spacing); angle.value = String(settings.angle);
  };
  drawing.disabled = false;
  drawing.addEventListener('change', () => {
    applySettings(defaultsForStudy(currentStudy()));
    showStage(1);
  });
  reset.addEventListener('click', () => {
    applySettings(DEFAULT_SETTINGS);
    showStage(1);
  });
  next.disabled = false;
  reset.disabled = false;
  prev.disabled = true;
  host.setAttribute('aria-busy', 'false');
  // Shared settings override the selected drawing's JSON defaults.
  applySettings(readSettings(window.location.search));
  const query = new URLSearchParams(window.location.search);
  const requested = Number(query.get('step'));
  if (requested === 2 || requested === 3) showStage(requested);
  else {
    stageHeading.textContent = stageTitle(currentStudy(), 1);
    regenerate();
  }
}
