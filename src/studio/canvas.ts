import { studies, studySvg, WIDTH, HEIGHT } from './studies';
import { sampleStudy } from './sample-svg';
import { generateStitches } from './stitches';
import { renderStitches } from './render-canvas';
import { readSettings, settingsQuery } from './settings';
import { withBase } from '../lib/urls';
import type { SampledShape, Pattern } from './stitches';

// All geometry stays in drawing units; only the canvas backing pixels scale
// for a high-density screen. There is no renderer library or startup lifecycle.
export function initStitchStudy(): void {
  const host = document.querySelector<HTMLElement>('#study-canvas');
  if (!host) return;
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
  const instructions = document.querySelector<HTMLElement>('#study-instructions')!;
  const patternControls = document.querySelector<HTMLFieldSetElement>('#study-pattern-controls')!;
  const controls = document.querySelector<HTMLElement>('#study-controls')!;
  const drawingPreview = document.querySelector<HTMLElement>('#study-drawing-preview')!;
  const stitchPreview = document.querySelector<HTMLElement>('#study-stitch-preview')!;
  const stitchSettings = document.querySelectorAll<HTMLElement>('[data-stitch-setting]');
  const original = document.querySelector<HTMLElement>('#study-original')!;
  const description = document.querySelector<HTMLElement>('#study-description')!;
  const status = document.querySelector<HTMLElement>('#study-status')!;
  const canvas = document.createElement('canvas');
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * density;
  canvas.height = HEIGHT * density;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Hand-stitch preview. The drawing and settings are described below.');
  host.replaceChildren(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  context.setTransform(density, 0, 0, density, 0, 0);
  const sampled = new Map<string, SampledShape[]>();
  let pending = 0;
  let stage = 1;

  const regenerate = () => {
    const study = studies.find(study => study.id === drawing.value) ?? studies[0];
    original.innerHTML = studySvg(study);
    description.textContent = study.description;
    if (stage === 1) {
      renderStitches(context, [], Number(lineWidth.value), WIDTH, HEIGHT);
      status.textContent = `${study.title} selected. Choose Next to stitch its outline.`;
      return;
    }
    try {
      if (!sampled.has(study.id)) sampled.set(study.id, sampleStudy(study));
      // Step 2 follows every outline; Step 3 patterns only filled shapes.
      const shapes = sampled.get(study.id)!.map(shape => ({ ...shape, filled: stage === 3 && shape.filled }));
      const segments = generateStitches(shapes, {
        length: Number(length.value), gap: Number(gap.value), spacing: Number(spacing.value),
        angle: Number(angle.value), pattern: pattern.value as Pattern, outline: true,
      });
      renderStitches(context, segments, Number(lineWidth.value), WIDTH, HEIGHT, Number(fillLineWidth.value));
      const treatment = stage === 2 ? 'running-stitch outlines' : `${pattern.selectedOptions[0].text} pattern, spacing ${spacing.value}, direction ${angle.value}°, fill line width ${fillLineWidth.value}`;
      status.textContent = `${study.title} · ${treatment}. Stitch length ${length.value}, gap ${gap.value}, line width ${lineWidth.value} (relative drawing units).`;
    } catch (error) {
      renderStitches(context, [], Number(lineWidth.value), WIDTH, HEIGHT);
      console.error('Studio stitch generation failed:', error);
      status.textContent = error instanceof Error ? error.message : 'This drawing could not be converted. Choose another drawing or press Reset.';
    }
  };

  // Batch rapid control changes, with no continuously running animation loop.
  const schedule = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => { pending = 0; regenerate(); });
  };
  for (const control of [drawing, length, gap, lineWidth, fillLineWidth, pattern, spacing, angle]) {
    control.disabled = false;
    control.addEventListener('change', schedule);
  }
  const showStage = (value: number) => {
    stage = value;
    stageHeading.textContent = [
      '', 'Step 1 of 3 · Choose a drawing', 'Step 2 of 3 · Stitch the outline', 'Step 3 of 3 · Add a pattern fill',
    ][stage];
    instructions.textContent = [
      '', 'Choose a study drawing. Next will turn its outlines into running stitches.',
      'Change the stitch length, gap and line width. Choose Next to add an open pattern inside the shape.',
      'Try Petals, Rows or Crosshatch inside the filled shapes. Change spacing and direction; the outline from Step 2 stays in place. Reset starts the study again.',
    ][stage];
    controls.classList.toggle('is-drawing-only', stage === 1);
    controls.hidden = stage === 3;
    drawingControl.hidden = stage !== 1;
    drawingPreview.hidden = stage !== 1;
    stitchPreview.hidden = stage === 1;
    for (const setting of stitchSettings) setting.hidden = stage !== 2;
    patternControls.hidden = stage !== 3;
    prev.disabled = stage === 1;
    next.disabled = false;
    next.textContent = stage === 3 ? 'Preview' : 'Next';
    stageHeading.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    schedule();
  };
  prev.addEventListener('click', () => { if (stage > 1) showStage(stage - 1); });
  next.addEventListener('click', () => {
    if (stage < 3) { showStage(stage + 1); return; }
    const settings = {
      drawing: drawing.value, length: Number(length.value), gap: Number(gap.value),
      lineWidth: Number(lineWidth.value), fillLineWidth: Number(fillLineWidth.value),
      pattern: pattern.value as Pattern, spacing: Number(spacing.value), angle: Number(angle.value),
    };
    window.location.assign(`${withBase('/studio/drawing-to-stitches/preview/')}?${settingsQuery(settings)}`);
  });
  reset.addEventListener('click', () => {
    drawing.value = studies[0].id;
    length.value = '6'; gap.value = '4'; lineWidth.value = '1.35';
    pattern.value = 'petals'; spacing.value = '28'; angle.value = '0'; fillLineWidth.value = '0.5';
    showStage(1);
  });
  next.disabled = false;
  reset.disabled = false;
  prev.disabled = true;
  host.setAttribute('aria-busy', 'false');
  // Back to edit restores the selected design at Step 3, including on refresh.
  const query = new URLSearchParams(window.location.search);
  if (query.get('step') === '3') {
    const settings = readSettings(window.location.search);
    drawing.value = settings.drawing;
    length.value = String(settings.length); gap.value = String(settings.gap);
    lineWidth.value = String(settings.lineWidth); fillLineWidth.value = String(settings.fillLineWidth);
    pattern.value = settings.pattern; spacing.value = String(settings.spacing); angle.value = String(settings.angle);
    showStage(3);
  } else regenerate();
}
