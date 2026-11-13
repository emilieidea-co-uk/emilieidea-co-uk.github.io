import { installImageSwipe } from './image-swipe.mjs';
import { updateTagLinks } from './artwork-tags.mjs';
export function initArtworkCarousel(root) {
  const tile = root.querySelector('.photo-tile');
  const slides = JSON.parse(tile.dataset.photoGroup);
  const image = tile.querySelector('.photo__img');
  const caption = root.querySelector('.post-figure__caption');
  const position = root.querySelector('.artwork-carousel__position');
  const tags = root.querySelector('.artwork-tags');
  let index = Number(tile.dataset.photoIndex) || 0;
  const show = next => {
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    tile.dataset.photoIndex = String(index);
    tile.dataset.full = slide.full;
    tile.dataset.artworkUrl = slide.href;
    tile.dataset.alt = slide.alt;
    tile.dataset.caption = slide.caption;
    tile.setAttribute('aria-label', `${slide.alt} — view larger`);
    image.srcset = slide.srcset;
    image.width = slide.width;
    image.height = slide.height;
    image.src = slide.src;
    image.alt = slide.alt;
    caption.textContent = slide.caption;
    caption.hidden = !slide.caption;
    updateTagLinks(tags, slide.tags);
    position.textContent = `${index + 1} / ${slides.length}`;
  };
  root.querySelector('.artwork-carousel__prev').addEventListener('click', () => show(index - 1));
  root.querySelector('.artwork-carousel__next').addEventListener('click', () => show(index + 1));
  root.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    show(index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  installImageSwipe(tile, delta => show(index + delta), () => slides.length > 1);
}
if (typeof document !== 'undefined') {
  for (const root of document.querySelectorAll('.artwork-carousel')) initArtworkCarousel(root);
}
