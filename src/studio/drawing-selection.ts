import { studies, studySvg } from './studies';

// Step 1 does not depend on the stitch renderer. Keep it interactive even while the larger
// stitch renderer is downloading, starting up, or unavailable.
export function initDrawingSelection(): void {
  const select = document.querySelector<HTMLSelectElement>('#study-drawing');
  const original = document.querySelector<HTMLElement>('#study-original');
  const description = document.querySelector<HTMLElement>('#study-description');
  if (!select || !original || !description) return;
  const update = () => {
    const study = studies.find(study => study.id === select.value) ?? studies[0];
    original.innerHTML = studySvg(study);
    description.textContent = study.description;
  };
  select.disabled = false;
  select.addEventListener('change', update);
  update();
}
