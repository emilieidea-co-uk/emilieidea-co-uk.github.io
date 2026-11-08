// Measure the actual lightbox space, rather than imposing a fixed caption length.
export function createCaptionController({ figure, image, caption, text, toggle, isOpen, view, doc }) {
  let expanded = false;
  let frame = null;
  let generation = 0;
  const number = value => Number.parseFloat(value) || 0;
  const clearClamp = () => {
    text.classList.remove('is-clamped');
    text.style.webkitLineClamp = '';
  };
  const hideToggle = () => {
    if (doc.activeElement === toggle) figure.focus({ preventScroll: true });
    toggle.hidden = true;
    toggle.textContent = 'More';
    toggle.setAttribute('aria-expanded', 'false');
    expanded = false;
  };
  const measure = () => {
    if (!isOpen()) return;
    clearClamp();
    image.style.maxHeight = '';
    if (caption.hidden || !figure.clientHeight) { hideToggle(); return; }
    const captionStyle = view.getComputedStyle(caption);
    const textStyle = view.getComputedStyle(text);
    const margin = number(captionStyle.marginTop);
    const lineHeight = number(textStyle.lineHeight) || number(textStyle.fontSize) * 1.5 || 24;
    const fullHeight = text.getBoundingClientRect().height;
    const capacity = figure.clientHeight;
    let imageHeight = image.getBoundingClientRect().height;
    if (imageHeight + margin + fullHeight <= capacity + 1) { hideToggle(); return; }
    // A short caption should stay whole even on a short landscape viewport.
    if (fullHeight <= lineHeight * 2 + 1) {
      image.style.maxHeight = `${Math.max(1, capacity - margin - fullHeight)}px`;
      hideToggle();
      return;
    }
    toggle.hidden = false;
    toggle.textContent = expanded ? 'Less' : 'More';
    toggle.setAttribute('aria-expanded', String(expanded));
    if (expanded) return;
    const toggleHeight = toggle.getBoundingClientRect().height + number(view.getComputedStyle(toggle).marginTop);
    let available = capacity - imageHeight - margin - toggleHeight;
    if (available < lineHeight) {
      const previewHeight = Math.min(2, Math.max(1, Math.floor((capacity - margin - toggleHeight - 1) / lineHeight))) * lineHeight;
      image.style.maxHeight = `${Math.max(1, capacity - margin - toggleHeight - previewHeight)}px`;
      imageHeight = image.getBoundingClientRect().height;
      available = capacity - imageHeight - margin - toggleHeight;
    }
    text.style.webkitLineClamp = String(Math.max(1, Math.floor(available / lineHeight)));
    text.classList.add('is-clamped');
  };
  const schedule = () => {
    if (frame !== null) return;
    frame = view.requestAnimationFrame(() => { frame = null; measure(); });
  };
  const revealCaption = ticket => {
    if (!isOpen() || !expanded || ticket !== generation) return;
    const box = figure.getBoundingClientRect();
    const content = caption.getBoundingClientRect();
    const desired = content.height > figure.clientHeight
      ? figure.scrollTop + content.top - box.top
      : figure.scrollTop + Math.max(0, content.bottom - box.bottom);
    const top = Math.max(0, Math.min(desired, figure.scrollHeight - figure.clientHeight));
    if (Math.abs(top - figure.scrollTop) > 1) {
      figure.scrollTo({ top, behavior: view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };
  toggle.addEventListener('click', () => {
    if (!isOpen()) return;
    expanded = !expanded;
    const ticket = ++generation;
    measure();
    if (expanded) view.requestAnimationFrame(() => revealCaption(ticket));
    else figure.scrollTo({ top: 0, behavior: 'auto' });
  });
  view.addEventListener('resize', schedule);
  view.addEventListener('orientationchange', schedule);
  view.visualViewport?.addEventListener('resize', schedule);
  doc.fonts?.ready.then(schedule);
  doc.fonts?.addEventListener('loadingdone', schedule);
  if (view.ResizeObserver) {
    const observer = new view.ResizeObserver(schedule);
    observer.observe(figure);
    observer.observe(image);
  }
  return {
    schedule,
    setCaption(value) {
      generation++;
      clearClamp();
      image.style.maxHeight = '';
      hideToggle();
      text.textContent = value;
      caption.hidden = !value.trim();
      figure.scrollTop = 0;
      schedule();
    },
    close() { generation++; },
  };
}
