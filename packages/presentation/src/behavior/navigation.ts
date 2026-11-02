/** Full-screen mobile navigation, including scroll/focus restoration and BFCache cleanup. */
export function initNavigation(): () => void {
  const nav = document.querySelector<HTMLElement>('.navbar-mobile');
  const toggle = nav?.querySelector<HTMLButtonElement>('.menu-toggle');
  const menu = nav?.querySelector<HTMLElement>('#mobile-menu');
  if (!nav || !toggle || !menu) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const mobile = matchMedia('(max-width: 479px)');
  const root = document.documentElement;
  const background = [...document.querySelectorAll<HTMLElement>('.main, .footer, .skip-link, #a11y-panel')];
  const previousInert = new Map<HTMLElement, boolean>();
  let open = false;
  let locked = false;
  let transition = 0;
  let scrollY = 0;

  function releaseBackground() {
    if (!locked) return;
    locked = false;
    root.classList.remove('mobile-navigation-open');
    for (const [element, inert] of previousInert) element.inert = inert;
    previousInert.clear();
    root.style.removeProperty('--mobile-navigation-scroll-top');
    window.scrollTo({ top: scrollY, behavior: 'instant' });
  }

  function setOpen(next: boolean, restoreFocus = true, immediate = false) {
    if (next === open && !immediate) return;
    open = next;
    const version = ++transition;
    if (open && !locked) {
      locked = true;
      scrollY = window.scrollY;
      root.style.setProperty('--mobile-navigation-scroll-top', `-${scrollY}px`);
      for (const element of background) {
        previousInert.set(element, element.inert);
        element.inert = true;
      }
      root.classList.add('mobile-navigation-open');
    }
    nav!.classList.toggle('is-open', open);
    menu!.inert = !open;
    toggle!.setAttribute('aria-expanded', String(open));
    toggle!.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    if (open) {
      menu!.scrollTop = 0;
    } else {
      if (restoreFocus) toggle!.focus({ preventScroll: true });
      if (immediate) releaseBackground();
      else {
        // Keep the underlying page still until the curtain has closed. Waiting on the
        // actual CSS transition also handles reduced motion and interrupted gestures.
        void Promise.all(nav!.getAnimations().map((animation) => animation.finished.catch(() => {}))).then(
          () => {
            if (!open && version === transition) releaseBackground();
          },
        );
      }
    }
  }

  toggle.addEventListener('click', () => setOpen(!open && mobile.matches), { signal });
  nav.addEventListener(
    'click',
    (event) => {
      if ((event.target as Element).closest('a[href]')) setOpen(false);
    },
    { signal },
  );

  // The overlay inherits accessibility preferences; only its own controls remain interactive.
  document.addEventListener(
    'keydown',
    (event) => {
      if (!locked) return;
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== 'Tab') return;
      const controls = [
        ...document.querySelectorAll<HTMLElement>('.navbar-mobile a[href], .navbar-mobile button'),
      ].filter((element) => !element.closest('[inert]') && element.getClientRects().length > 0);
      if (!controls.length) return;
      const current = controls.indexOf(document.activeElement as HTMLElement);
      const next =
        current < 0
          ? event.shiftKey
            ? controls.length - 1
            : 0
          : (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
      // Explicit traversal includes links even when Safari's Tab preference skips them.
      event.preventDefault();
      controls[next].focus();
    },
    { signal, capture: true },
  );

  mobile.addEventListener(
    'change',
    () => {
      if (mobile.matches || !locked) return;
      const focusInMenu = nav.contains(document.activeElement);
      setOpen(false, false, true);
      if (focusInMenu)
        document
          .querySelector<HTMLElement>('.navbar a[aria-current="page"], .navbar-header.header-logo a')
          ?.focus({ preventScroll: true });
    },
    { signal },
  );

  return () => {
    setOpen(false, false, true);
    controller.abort();
  };
}
