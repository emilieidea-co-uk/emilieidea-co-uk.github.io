// The same visible-height measurement is used by the editor and preview.
export function initViewportHeight(): void {
  const fit = () => {
    const height = window.visualViewport?.height ?? window.innerHeight;
    if (Number.isFinite(height) && height > 0) {
      document.documentElement.style.setProperty('--studio-viewport-height', `${height}px`);
    }
  };
  fit();
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
}
