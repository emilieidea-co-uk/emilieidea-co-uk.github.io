// Place posts in source order, choosing the leftmost shortest column on ties.
export function masonryPositions(heights, columns, columnWidth, columnGap, rowGap) {
  const bottoms = Array(columns).fill(0);
  const positions = heights.map(height => {
    const column = bottoms.indexOf(Math.min(...bottoms));
    const position = { left: column * (columnWidth + columnGap), top: bottoms[column] };
    bottoms[column] += height + rowGap;
    return position;
  });
  return { positions, height: heights.length ? Math.max(...bottoms) - rowGap : 0 };
}

export function initGalleryMasonry(grid, view = window) {
  const items = Array.from(grid.querySelectorAll('.gallery-item'));
  if (!items.length) return;
  let frame = null;
  const set = (style, name, value) => { if (style[name] !== value) style[name] = value; };
  const layout = () => {
    const style = view.getComputedStyle(grid);
    const columns = Number.parseInt(style.getPropertyValue('--gallery-columns'), 10) || 1;
    if (columns === 1) {
      grid.classList.remove('is-masonry');
      set(grid.style, 'height', '');
      for (const item of items) {
        for (const name of ['width', 'left', 'top']) set(item.style, name, '');
      }
      return;
    }
    const width = grid.clientWidth;
    if (!width) return;
    const columnGap = Number.parseFloat(style.columnGap) || 0;
    const rowGap = Number.parseFloat(style.rowGap) || 0;
    const columnWidth = (width - columnGap * (columns - 1)) / columns;
    grid.classList.add('is-masonry');
    // Set all widths before measuring wrapped captions and natural image heights.
    for (const item of items) set(item.style, 'width', `${columnWidth}px`);
    const { positions, height } = masonryPositions(
      items.map(item => item.getBoundingClientRect().height), columns, columnWidth, columnGap, rowGap,
    );
    items.forEach((item, index) => {
      set(item.style, 'left', `${positions[index].left}px`);
      set(item.style, 'top', `${positions[index].top}px`);
    });
    // Absolute children need an explicit container height for the footer below.
    set(grid.style, 'height', `${height}px`);
  };
  const schedule = () => {
    if (frame !== null) return;
    frame = view.requestAnimationFrame(() => { frame = null; layout(); });
  };
  grid.addEventListener('load', schedule, true);
  grid.addEventListener('error', schedule, true);
  view.addEventListener('resize', schedule);
  const fonts = grid.ownerDocument.fonts;
  fonts?.ready.then(schedule);
  fonts?.addEventListener('loadingdone', schedule);
  if (view.ResizeObserver) {
    const observer = new view.ResizeObserver(schedule);
    observer.observe(grid);
    for (const item of items) observer.observe(item);
  }
  layout();
}

if (typeof document !== 'undefined') {
  for (const grid of document.querySelectorAll('.captioned-gallery')) initGalleryMasonry(grid);
}
