import { studies, WIDTH, HEIGHT } from './studies';
import { sampleStudy } from './sample-svg';
import { generateStitches, playbackPosition } from './stitches';
import { renderStitches } from './render-canvas';
import { readSettings, settingsQuery, previewPath } from './settings';
import { withBase } from '../lib/urls';
import { copyText } from './clipboard';
import { stitchDistances, segmentPosition } from './playback';
import { lastStage } from './navigation';
import { initViewportHeight } from './viewport';

export function initStitchPreview(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#preview-canvas');
  if (!canvas) return;
  initViewportHeight();
  const back = document.querySelector<HTMLAnchorElement>('#preview-back')!;
  const play = document.querySelector<HTMLButtonElement>('#preview-play')!;
  const restart = document.querySelector<HTMLButtonElement>('#preview-restart')!;
  const share = document.querySelector<HTMLButtonElement>('#preview-share')!;
  const shareStatus = document.querySelector<HTMLElement>('#preview-share-status')!;
  const status = document.querySelector<HTMLElement>('#preview-status')!;
  const description = document.querySelector<HTMLElement>('#preview-description')!;
  const settings = readSettings(window.location.search, canvas.dataset?.drawing);
  const previewUrl = `${withBase(previewPath(settings.drawing))}?${settingsQuery(settings)}`;
  if (canvas.dataset?.legacy === 'true') {
    window.location.replace(previewUrl);
    return;
  }
  const study = studies.find(study => study.id === settings.drawing)!;
  back.href = `${withBase('/studio/drawing-to-stitches/')}?${settingsQuery(settings)}&step=${lastStage(study)}`;
  const shareUrl = new URL(previewUrl, window.location.origin).href;
  description.textContent = `${study.name}${study.hasFill ? ` · ${settings.pattern} pattern` : ''}. ${study.hasOutline && study.hasFill ? 'Watch the outline first, then the grey fill.' : study.hasOutline ? 'Watch the outline build up.' : 'Watch the grey fill build up.'} The dot shows the current stitch.`;
  const generated = generateStitches(sampleStudy(study), {
    length: settings.length, gap: settings.gap, spacing: settings.spacing,
    angle: settings.angle, pattern: settings.pattern, outline: study.hasOutline, fill: study.hasFill,
  });
  const segments = [...generated.filter(segment => segment.kind !== 'fill'), ...generated.filter(segment => segment.kind === 'fill')];
  const distances = stitchDistances(segments);
  const totalDistance = distances[distances.length - 1];
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * density; canvas.height = HEIGHT * density;
  context.setTransform(density, 0, 0, density, 0, 0);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let distance = reducedMotion.matches ? totalDistance : 0;
  let playing = !reducedMotion.matches && totalDistance > 0;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let lastAnnouncement = '';

  const draw = () => {
    const position = segmentPosition(distances, distance);
    renderStitches(context, segments, settings.lineWidth, WIDTH, HEIGHT, settings.fillLineWidth, position);
    const index = Math.floor(position);
    if (position > 0 && index < segments.length) {
      const { from, to } = segments[index];
      const fraction = position - index;
      const point = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
      context.beginPath(); context.fillStyle = '#a83a32';
      context.arc(point.x, point.y, 3, 0, Math.PI * 2); context.fill();
    }
    const percent = totalDistance ? Math.floor(distance / totalDistance * 100) : 100;
    play.textContent = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(playing));
    const message = distance >= totalDistance ? 'Complete · 100%' : `${playing ? 'Stitching' : 'Paused'} · ${Math.floor(percent / 10) * 10}%`;
    if (message !== lastAnnouncement) { status.textContent = message; lastAnnouncement = message; }
  };
  const tick = (time: number) => {
    frame = null;
    if (!playing) return;
    const elapsed = lastTime === null ? 0 : Math.min(100, Math.max(0, time - lastTime));
    lastTime = time;
    // Fixed slow thread speed: 120 drawing units/second for outline AND fill,
    // independent of the different lengths of their generated segments.
    distance = playbackPosition(distance, elapsed * .5, totalDistance);
    if (distance >= totalDistance) { playing = false; lastTime = null; }
    draw();
    if (playing) frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    playing = false; lastTime = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const start = () => {
    if (!totalDistance) return;
    playing = true; lastTime = null;
    if (frame === null) frame = requestAnimationFrame(tick);
    draw();
  };
  play.addEventListener('click', () => {
    if (playing) { pause(); draw(); }
    else { if (distance >= totalDistance) distance = 0; start(); }
  });
  restart.addEventListener('click', () => {
    pause(); distance = 0;
    if (reducedMotion.matches) draw(); else start();
  });
  share.addEventListener('click', async () => {
    share.disabled = true;
    shareStatus.textContent = '';
    try {
      const copied = await copyText(shareUrl);
      shareStatus.textContent = copied ? 'Link copied' : 'Could not copy. Copy the link from your browser’s address bar.';
    } finally { share.disabled = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); draw(); } });
  window.addEventListener('pagehide', () => { pause(); draw(); });
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { pause(); draw(); } });
  play.disabled = restart.disabled = totalDistance === 0;
  share.disabled = false;
  draw();
  if (playing) frame = requestAnimationFrame(tick);
}
