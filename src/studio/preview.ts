import { studies, WIDTH, HEIGHT } from './studies';
import { sampleStudy } from './sample-svg';
import { generateStitches, playbackPosition } from './stitches';
import { renderStitches } from './render-canvas';
import { readSettings, settingsQuery } from './settings';
import { withBase } from '../lib/urls';
import { copyText } from './clipboard';

export function initStitchPreview(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#preview-canvas');
  if (!canvas) return;
  // VisualViewport also follows mobile browser bars and older Safari versions.
  const fitViewport = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    if (Number.isFinite(height) && height > 0) {
      document.documentElement.style.setProperty('--preview-viewport-height', `${height}px`);
    }
  };
  fitViewport();
  window.addEventListener('resize', fitViewport);
  window.visualViewport?.addEventListener('resize', fitViewport);
  const back = document.querySelector<HTMLAnchorElement>('#preview-back')!;
  const play = document.querySelector<HTMLButtonElement>('#preview-play')!;
  const restart = document.querySelector<HTMLButtonElement>('#preview-restart')!;
  const share = document.querySelector<HTMLButtonElement>('#preview-share')!;
  const shareStatus = document.querySelector<HTMLElement>('#preview-share-status')!;
  const status = document.querySelector<HTMLElement>('#preview-status')!;
  const description = document.querySelector<HTMLElement>('#preview-description')!;
  const settings = readSettings(window.location.search);
  back.href = `${withBase('/studio/drawing-to-stitches/')}?${settingsQuery(settings)}&step=3`;
  const shareUrl = new URL(`${withBase('/studio/drawing-to-stitches/preview/')}?${settingsQuery(settings)}`, window.location.origin).href;
  const study = studies.find(study => study.id === settings.drawing)!;
  description.textContent = `${study.title} · ${settings.pattern} pattern. Watch the outline first, then the grey fill. The dot shows the current stitch.`;
  const generated = generateStitches(sampleStudy(study), {
    length: settings.length, gap: settings.gap, spacing: settings.spacing,
    angle: settings.angle, pattern: settings.pattern, outline: true,
  });
  const segments = [...generated.filter(segment => segment.kind !== 'fill'), ...generated.filter(segment => segment.kind === 'fill')];
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
  const density = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WIDTH * density; canvas.height = HEIGHT * density;
  context.setTransform(density, 0, 0, density, 0, 0);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let position = reducedMotion.matches ? segments.length : 0;
  let playing = !reducedMotion.matches && segments.length > 0;
  let frame: number | null = null;
  let lastTime: number | null = null;
  let lastAnnouncement = '';

  const draw = () => {
    renderStitches(context, segments, settings.lineWidth, WIDTH, HEIGHT, settings.fillLineWidth, position);
    const index = Math.floor(position) - 1;
    if (index >= 0 && position < segments.length) {
      const point = segments[index].to;
      context.beginPath(); context.fillStyle = '#a83a32';
      context.arc(point.x, point.y, 3, 0, Math.PI * 2); context.fill();
    }
    const percent = segments.length ? Math.floor(position / segments.length * 100) : 100;
    play.textContent = playing ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(playing));
    const message = position >= segments.length ? 'Complete · 100%' : `${playing ? 'Stitching' : 'Paused'} · ${Math.floor(percent / 10) * 10}%`;
    if (message !== lastAnnouncement) { status.textContent = message; lastAnnouncement = message; }
  };
  const tick = (time: number) => {
    frame = null;
    if (!playing) return;
    const elapsed = lastTime === null ? 0 : Math.min(100, Math.max(0, time - lastTime));
    lastTime = time;
    // Fixed slow playback: half the base rate, or 120 stitch segments/second.
    position = playbackPosition(position, elapsed * .5, segments.length);
    if (position >= segments.length) { playing = false; lastTime = null; }
    draw();
    if (playing) frame = requestAnimationFrame(tick);
  };
  const pause = () => {
    playing = false; lastTime = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };
  const start = () => {
    if (!segments.length) return;
    playing = true; lastTime = null;
    if (frame === null) frame = requestAnimationFrame(tick);
    draw();
  };
  play.addEventListener('click', () => {
    if (playing) { pause(); draw(); }
    else { if (position >= segments.length) position = 0; start(); }
  });
  restart.addEventListener('click', () => {
    pause(); position = 0;
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
  play.disabled = restart.disabled = segments.length === 0;
  share.disabled = false;
  draw();
  if (playing) frame = requestAnimationFrame(tick);
}
