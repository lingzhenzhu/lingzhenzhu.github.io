/** Small progressive enhancement: no framework runtime and no timer survives navigation. */
export function initGallery(root: HTMLElement) {
  const slides = [...root.querySelectorAll<HTMLElement>('[data-gallery-slide]')];
  const thumbs = [...root.querySelectorAll<HTMLButtonElement>('[data-gallery-index]')];
  const abort = new AbortController(),
    options = { signal: abort.signal };
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pause = root.querySelector<HTMLButtonElement>('[data-gallery-pause]');
  let current = 0,
    paused = false,
    hovered = false,
    focused = false,
    timer: ReturnType<typeof setInterval> | undefined;
  const reduced = () => motion.matches;
  const show = (index: number, manual = false) => {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
    });
    thumbs.forEach((button, i) => button.setAttribute('aria-pressed', String(i === current)));
    const count = root.querySelector('[data-gallery-count]');
    if (count)
      count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    const caption = root.querySelector('[data-gallery-caption]');
    if (caption) caption.textContent = slides[current].dataset.caption || '';
    if (manual)
      root.querySelector('[data-gallery-status]')!.textContent = `Photo ${current + 1} of ${slides.length}`;
  };
  const sync = () => {
    clearInterval(timer);
    const stopped = paused || reduced();
    if (pause) {
      pause.setAttribute('aria-pressed', String(stopped));
      const label = reduced()
        ? 'Slideshow paused for reduced motion'
        : stopped
          ? 'Resume slideshow'
          : 'Pause slideshow';
      pause.setAttribute('aria-label', label);
      pause.title = label;
      pause.disabled = reduced();
    }
    if (
      slides.length > 1 &&
      root.dataset.autoplay === 'true' &&
      !stopped &&
      !hovered &&
      !focused &&
      !document.hidden
    )
      timer = setInterval(() => show(current + 1), Math.max(4000, Number(root.dataset.interval) || 7000));
  };
  if (slides.length > 1) {
    root.querySelector<HTMLElement>('.gallery-controls')!.hidden = false;
    root.querySelector<HTMLElement>('.gallery-thumbnails')!.hidden = false;
  }
  root.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!target) return;
      if (target.hasAttribute('data-gallery-pause')) paused = !paused;
      else if (target.hasAttribute('data-gallery-prev')) show(current - 1, true);
      else if (target.hasAttribute('data-gallery-next')) show(current + 1, true);
      else if (target.dataset.galleryIndex !== undefined) show(Number(target.dataset.galleryIndex), true);
      sync();
    },
    options,
  );
  root.addEventListener(
    'pointerenter',
    (event) => {
      if (event.pointerType !== 'touch') {
        hovered = true;
        sync();
      }
    },
    options,
  );
  root.addEventListener(
    'pointerleave',
    () => {
      hovered = false;
      sync();
    },
    options,
  );
  root.addEventListener(
    'focusin',
    () => {
      focused = true;
      sync();
    },
    options,
  );
  root.addEventListener(
    'focusout',
    (event) => {
      focused = root.contains(event.relatedTarget as Node | null);
      sync();
    },
    options,
  );
  document.addEventListener('visibilitychange', sync, options);
  motion.addEventListener('change', sync, options);
  show(0);
  sync();
  return () => {
    clearInterval(timer);
    abort.abort();
  };
}
