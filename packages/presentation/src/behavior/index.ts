import { initAccessibility } from './accessibility';
import { initOpening } from './opening';
import { initNavigation } from './navigation';
import { applyPreferences, readPreferences } from './preferences';

type Stop = () => void;
/** Module controllers load only on pages that contain their module, keeping the shared runtime small. */
const features: [string, () => Promise<(element: HTMLElement) => Stop>][] = [
  [
    '[data-news]',
    () =>
      import('./news').then(({ NewsController }) => (element) => {
        const news = new NewsController(element);
        return () => news.destroy();
      }),
  ],
  ['[data-rewards]', () => import('./rewards').then((module) => module.initRewards)],
  ['[data-medium]', () => import('./medium').then((module) => module.initMedium)],
  ['[data-gallery]', () => import('./gallery').then((module) => module.initGallery)],
];

export function initializeSite() {
  applyPreferences(readPreferences());
  const cleanup = initAccessibility();
  const stopNavigation = initNavigation();
  const cue = document.querySelector<HTMLElement>('.explore-cue');
  const stopOpening = cue ? initOpening(cue) : undefined;
  const stops: Stop[] = [];
  let active = true;
  for (const [selector, load] of features) {
    const elements = [...document.querySelectorAll<HTMLElement>(selector)];
    if (elements.length)
      void load().then((init) => {
        // The page may have been hidden while the controller was loading.
        if (active) stops.push(...elements.map(init));
      });
  }
  const abort = new AbortController();
  document.querySelector('[data-back]')?.addEventListener(
    'click',
    (event) => {
      if (document.referrer && new URL(document.referrer).origin === location.origin) {
        event.preventDefault();
        history.back();
      }
    },
    { signal: abort.signal },
  );
  if (document.documentElement.dataset.preview === 'true') {
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement;
        const block = target.closest<HTMLElement>('[data-block-id]');
        if (target.closest('a')) event.preventDefault();
        if (block)
          parent.postMessage({ type: 'site:block-select', blockId: block.dataset.blockId }, location.origin);
      },
      { signal: abort.signal },
    );
  }
  const destroy = () => {
    active = false;
    stopOpening?.();
    stopNavigation();
    cleanup();
    stops.splice(0).forEach((stop) => stop());
    abort.abort();
  };
  window.addEventListener('pagehide', destroy, { once: true });
  // A restored BFCache page needs fresh controllers after pagehide cleanup.
  const restore = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    window.removeEventListener('pageshow', restore);
    initializeSite();
  };
  // The initial pageshow is not a restoration; it must not consume this listener.
  window.addEventListener('pageshow', restore);
  return destroy;
}
if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', initializeSite, { once: true });
else initializeSite();
