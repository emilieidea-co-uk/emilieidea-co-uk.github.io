// Listen only on the image area, leaving caption scrolling and pinch zoom alone.
export function installImageSwipe(element, navigate, enabled = () => true) {
  let start, suppressUntil = 0;
  element.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.isPrimary === false || !enabled()) { start = undefined; return; }
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  element.addEventListener('pointercancel', () => { start = undefined; });
  element.addEventListener('pointerup', event => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    start = undefined;
    if (!enabled() || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    suppressUntil = Date.now() + 400;
    event.preventDefault();
    navigate(dx < 0 ? 1 : -1);
  });
  element.addEventListener('click', event => {
    if (Date.now() >= suppressUntil) return;
    suppressUntil = 0;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
}
