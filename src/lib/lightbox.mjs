// Shared gallery and artwork viewer; imported by Lightbox.astro.
const lightbox = document.getElementById('lightbox');
const tiles = Array.from(document.querySelectorAll('.photo-tile'));

if (lightbox && tiles.length) {
  const image = lightbox.querySelector('.lightbox__img');
  const caption = lightbox.querySelector('.lightbox__caption');
  const figure = lightbox.querySelector('.lightbox__figure');
  const btnClose = lightbox.querySelector('.lightbox__close');
  const btnPrev = lightbox.querySelector('.lightbox__prev');
  const btnNext = lightbox.querySelector('.lightbox__next');
  const sharing = lightbox.querySelector('.lightbox__sharing');
  const copy = lightbox.querySelector('.lightbox__copy');
  const status = lightbox.querySelector('.lightbox__status');
  const urlField = lightbox.querySelector('.lightbox__url');
  let shareUrl = '';
  let index = -1;
  let shown = -1; // which photo the <img> currently holds
  let seq = 0; // invalidates an in-flight upgrade when the photo changes

  const render = (i) => {
    index = (i + tiles.length) % tiles.length;
    const tile = tiles[index];
    shareUrl = tile.dataset.artworkUrl ? new URL(tile.dataset.artworkUrl, window.location.origin).href : '';
    sharing.hidden = !shareUrl;
    lightbox.classList.toggle('has-share-link', Boolean(shareUrl));
    status.textContent = '';
    urlField.hidden = true;
    urlField.value = shareUrl;
    image.alt = tile.dataset.alt ?? '';
    const cap = tile.dataset.caption ?? '';
    caption.textContent = cap;
    caption.hidden = cap === '';
    lightbox.classList.toggle('has-caption', Boolean(cap));
    figure.scrollTop = 0;
    if (shown === index) return; // already displaying this photo
    shown = index;
    const ticket = ++seq;

    // Show the rendition the grid already downloaded — it's in cache, so the
    // photo appears immediately instead of waiting for the big lightbox
    // file. The browser keeps painting the previous photo until a new file
    // arrives, so the <img> also stays hidden (is-loading) until this
    // preview's load event — otherwise opening photo B after photo A would
    // flash A first.
    const thumb = tile.querySelector('.photo__img');
    const preview = thumb?.currentSrc || '';
    const full = tile.dataset.full ?? '';
    image.classList.add('is-loading');
    image.removeAttribute('sizes');
    image.srcset = '';
    image.src = preview || full;

    // Then upgrade in place to a viewport-matched rendition: with srcset +
    // sizes the browser fetches only as many pixels as the screen needs
    // (data-full, the largest rendition, remains the fallback). Decoded
    // off-screen first so the swap never blanks the visible photo.
    const srcset = thumb?.srcset ?? '';
    if (!srcset || preview === full) return;
    const hi = new Image();
    hi.sizes = '100vw';
    hi.srcset = srcset;
    hi.src = full;
    const apply = () => {
      if (ticket !== seq) return; // user has moved to another photo
      image.sizes = '100vw';
      image.srcset = srcset;
      image.src = full;
    };
    if (hi.decode) hi.decode().then(apply).catch(() => {});
    else hi.onload = apply;
  };

  const reveal = () => image.classList.remove('is-loading');
  image.addEventListener('load', reveal);
  image.addEventListener('error', reveal);

  const open = (i) => {
    render(i);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    btnClose.focus();
  };

  const close = () => {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (index > -1) tiles[index].focus();
  };

  copy.addEventListener('click', async () => {
    const target = shareUrl;
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      if (target === shareUrl) status.textContent = 'Link copied';
    } catch {
      if (target !== shareUrl) return;
      status.textContent = 'Select and copy this link';
      urlField.hidden = false;
      urlField.focus();
      urlField.select();
      urlField.setSelectionRange(0, urlField.value.length);
    }
  });
  urlField.addEventListener('keydown', (event) => event.stopPropagation());
  tiles.forEach((tile, i) => tile.addEventListener('click', () => open(i)));
  btnClose.addEventListener('click', close);
  btnPrev.addEventListener('click', () => render(index - 1));
  btnNext.addEventListener('click', () => render(index + 1));
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') render(index - 1);
    else if (e.key === 'ArrowRight') render(index + 1);
  });
}
