import {
  filterArticles,
  prepareArticleSearch,
  type ArticleEntry,
  type ArticleQuery,
} from '@lzzhu/content/article-search';
import { displayDate } from '../date';
import { archiveRows } from '../archive-rows';
import { initFilterSelect } from './filter-select';
import { renderPagination } from './search-pagination';
const sources = new Map<string, Promise<ArticleEntry[]>>();
const fields = ['q', 'tag', 'year', 'month'] as const;
function initialize(root: HTMLElement) {
  const form = root.querySelector<HTMLFormElement>('form')!;
  const status = root.querySelector<HTMLElement>('[role="status"]')!;
  const list = root.querySelector<HTMLElement>('.article-search-results')!;
  const pagination = root.querySelector<HTMLElement>('[data-search-pagination]')!;
  const retry = root.querySelector<HTMLButtonElement>('[data-search-retry]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-search-clear]')!;
  const reset = root.querySelector<HTMLButtonElement>('[data-search-reset]')!;
  const pickers = [...root.querySelectorAll<HTMLElement>('[data-filter-select]')].map(initFilterSelect);
  const source = root.dataset.source!;
  const abort = new AbortController();
  const size = Number(root.dataset.pageSize) || 12;
  const controls = fields.map((key) => form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement);
  let entries: ArticleEntry[] = [],
    currentPage = 1,
    timer: ReturnType<typeof setTimeout>;
  const primary = document.querySelector('[data-article-search]') === root;
  const readUrl = () => {
    const params = new URLSearchParams(location.search);
    controls.forEach((field, i) => (field.value = params.get(fields[i]) || ''));
    currentPage = Math.max(1, Number.parseInt(params.get('page') || '1') || 1);
  };
  const render = (updateUrl = true) => {
    const query = Object.fromEntries(
      fields.map((key, i) => [key, controls[i].value]),
    ) as unknown as ArticleQuery;
    const found = filterArticles(entries, query);
    const totalPages = Math.max(1, Math.ceil(found.length / size));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * size;
    list.replaceChildren();
    for (const { entry, heading } of archiveRows(found.slice(start, start + size))) {
      if (heading) {
        const year = document.createElement('h2');
        year.className = 'archive-year';
        year.dataset.headingLevel = '3';
        year.textContent = heading;
        list.appendChild(year);
      }
      const row = document.createElement('article'),
        link = document.createElement('a');
      row.className = 'archive-item';
      link.className = 'archive-item-link';
      link.href = entry.path;
      link.textContent = entry.title;
      row.appendChild(link);
      if (entry.date) {
        const date = document.createElement('time');
        date.className = 'archive-item-date';
        date.dateTime = entry.date;
        date.textContent = displayDate(entry.date);
        row.appendChild(date);
      }
      list.appendChild(row);
    }
    status.textContent = found.length
      ? `${found.length} ${found.length === 1 ? 'article' : 'articles'}${totalPages > 1 ? ` · ${start + 1}–${Math.min(start + size, found.length)}` : ''}`
      : 'No articles found.';
    clear.hidden = !query.q;
    reset.hidden = !Object.values(query).some(Boolean);
    pickers.forEach((picker) => picker.sync());
    renderPagination(pagination, currentPage, totalPages, (page) => {
      currentPage = page;
      render();
      const heading = list.querySelector<HTMLElement>('.archive-year');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      list.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
    if (primary && updateUrl) {
      const url = new URL(location.href);
      for (const key of fields) {
        if (query[key]) url.searchParams.set(key, query[key]);
        else url.searchParams.delete(key);
      }
      if (currentPage > 1) url.searchParams.set('page', String(currentPage));
      else url.searchParams.delete('page');
      history.replaceState(history.state, '', url);
    }
  };
  // Without the index, the server-rendered pages of the unfiltered list remain browsable.
  const showStatic = (page: number) => {
    const pages = [...list.querySelectorAll<HTMLElement>('[data-result-page]')];
    if (!pages.length) return;
    currentPage = Math.min(page, pages.length);
    pages.forEach((element, index) => (element.hidden = index !== currentPage - 1));
    renderPagination(pagination, currentPage, pages.length, (next) => {
      showStatic(next);
      list.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  const load = async () => {
    retry.hidden = true;
    status.textContent = 'Loading articles…';
    try {
      if (!sources.has(source))
        sources.set(
          source,
          fetch(source, { cache: 'no-cache' })
            .then(async (response) => {
              if (!response.ok) throw new Error('Unavailable');
              return (await response.json()) as ArticleEntry[];
            })
            .catch((error) => {
              sources.delete(source);
              throw error;
            }),
        );
      entries = filterArticles(await sources.get(source)!, {
        q: '',
        tag: '',
        year: root.dataset.year || '',
        month: root.dataset.month || '',
      });
      if (abort.signal.aborted) return;
      form
        .querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,select,button')
        .forEach((control) => (control.disabled = false));
      readUrl();
      render(false);
      (window.requestIdleCallback ?? setTimeout)(() => prepareArticleSearch(entries));
    } catch {
      if (!abort.signal.aborted) {
        showStatic(currentPage);
        status.textContent = 'Search is unavailable. You can still open the articles below.';
        retry.hidden = false;
      }
    }
  };
  const refresh = () => {
    clearTimeout(timer);
    currentPage = 1;
    timer = setTimeout(() => render(), 120);
  };
  form.addEventListener('input', refresh, { signal: abort.signal });
  form.addEventListener(
    'change',
    () => {
      clearTimeout(timer);
      currentPage = 1;
      render();
    },
    { signal: abort.signal },
  );
  form.addEventListener(
    'submit',
    (event) => {
      event.preventDefault();
      clearTimeout(timer);
      currentPage = 1;
      render();
    },
    { signal: abort.signal },
  );
  form.addEventListener(
    'reset',
    (event) => {
      event.preventDefault();
      controls.forEach((control) => (control.value = ''));
      clearTimeout(timer);
      currentPage = 1;
      render();
    },
    { signal: abort.signal },
  );
  retry.addEventListener('click', load, { signal: abort.signal });
  clear.addEventListener(
    'click',
    () => {
      controls[0].value = '';
      clearTimeout(timer);
      currentPage = 1;
      render();
      controls[0].focus();
    },
    { signal: abort.signal },
  );
  window.addEventListener(
    'popstate',
    () => {
      readUrl();
      render(false);
    },
    { signal: abort.signal },
  );
  void load();
  return () => {
    abort.abort();
    clearTimeout(timer);
    pickers.forEach((picker) => picker.destroy());
  };
}
function start() {
  const stops = [...document.querySelectorAll<HTMLElement>('[data-article-search]')].map(initialize);
  window.addEventListener('pagehide', () => stops.forEach((stop) => stop()), { once: true });
}
start();
window.addEventListener('pageshow', (event) => {
  if (event.persisted) start();
});
