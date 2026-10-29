import { initAccessibility } from './accessibility';
import { NewsController } from './news';
import { initRewards } from './rewards';
import { initMedium } from './medium';
import { initGallery } from './gallery';
import { applyPreferences, readPreferences } from './preferences';

export function initializeSite() {
  applyPreferences(readPreferences());
  const cleanup = initAccessibility();
  const news = [...document.querySelectorAll<HTMLElement>('[data-news]')].map(
    (element) => new NewsController(element),
  );
  const rewards = [...document.querySelectorAll<HTMLElement>('[data-rewards]')].map(initRewards);
  const medium = [...document.querySelectorAll<HTMLElement>('[data-medium]')].map(initMedium);
  const galleries = [...document.querySelectorAll<HTMLElement>('[data-gallery]')].map(initGallery);
  const abort = new AbortController();
  const toggle = document.querySelector<HTMLButtonElement>('.menu-toggle');
  const menu = document.querySelector('#mobile-menu');
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
  toggle?.addEventListener(
    'click',
    () => {
      const open = !menu?.classList.contains('active');
      menu?.classList.toggle('active', open);
      toggle.setAttribute('aria-expanded', String(open));
    },
    { signal: abort.signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && menu?.classList.contains('active')) {
        menu.classList.remove('active');
        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.focus();
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
    cleanup();
    news.forEach((item) => item.destroy());
    rewards.forEach((stop) => stop());
    medium.forEach((stop) => stop());
    galleries.forEach((stop) => stop());
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
