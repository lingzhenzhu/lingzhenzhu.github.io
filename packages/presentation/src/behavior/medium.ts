import type { MediumEntry } from '@lzzhu/content';
import { displayDate } from '../date';
const fallback = '/assets/medium-fallback.svg';
function card(entry: MediumEntry) {
  const link = document.createElement('a');
  link.className = 'medium-card';
  link.href = entry.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  const copy = document.createElement('div'),
    title = document.createElement('h3'),
    date = document.createElement('time'),
    more = document.createElement('span');
  title.textContent = entry.title;
  date.dateTime = entry.publishedAt;
  date.textContent = displayDate(entry.publishedAt);
  more.className = 'medium-read';
  more.textContent = 'Read on Medium ↗';
  [title, date, more].forEach((node) => copy.appendChild(node));
  const image = document.createElement('img');
  image.src = entry.coverOverride || entry.cover || fallback;
  image.alt = '';
  image.width = 180;
  image.height = 120;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.dataset.mediumCover = '';
  link.appendChild(copy);
  link.appendChild(image);
  return link;
}
export function initMedium(element: HTMLElement) {
  const abort = new AbortController();
  const useFallback = (event: Event) => {
    const image = event.target;
    if (
      image instanceof HTMLImageElement &&
      image.hasAttribute('data-medium-cover') &&
      !image.src.endsWith(fallback)
    )
      image.src = element.dataset.preview === 'true' ? '/admin' + fallback : fallback;
  };
  element.addEventListener('error', useFallback, { capture: true, signal: abort.signal });
  element.querySelectorAll<HTMLImageElement>('[data-medium-cover]').forEach((image) => {
    if (image.complete && !image.naturalWidth) image.dispatchEvent(new Event('error'));
  });
  const refresh = async () => {
    if (element.dataset.preview === 'true') return;
    try {
      const response = await fetch('/api/medium', { signal: abort.signal, credentials: 'omit' });
      if (!response.ok) return;
      const { entries } = (await response.json()) as { entries: MediumEntry[] };
      if (!Array.isArray(entries)) return;
      const list = element.querySelector('.medium-list');
      if (!list || list.contains(document.activeElement)) return;
      // The endpoint validates all URLs; DOM APIs keep feed text inert.
      const cards = entries.slice(0, Number(element.dataset.limit) || 10).map(card);
      list.replaceChildren(...cards);
      element.querySelector('[data-medium-empty]')?.toggleAttribute('hidden', cards.length > 0);
    } catch {
      /* Keep the published articles when offline or the feed is unavailable. */
    }
  };
  // Do not spend a feed check on speculative pages that the visitor never opens.
  if ((document as Document & { prerendering?: boolean }).prerendering)
    document.addEventListener('prerenderingchange', refresh, { once: true, signal: abort.signal });
  else void refresh();
  return () => abort.abort();
}
