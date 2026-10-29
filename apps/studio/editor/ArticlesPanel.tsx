import { ConfirmDialog, Button, Pagination } from './controls';
import { usePagination } from './usePagination';
import { useEffect, useRef, useState } from 'react';
import type { CollectionProps } from './types';
import { EmptyState, Icon } from './ui';
function readFilters() {
  try {
    const value = JSON.parse(sessionStorage.getItem('website-admin-article-filters') || '{}');
    return {
      query: typeof value.query === 'string' ? value.query : '',
      year: /^\d{4}$/.test(value.year) || value.year === 'undated' ? value.year : '',
      status: ['published', 'draft'].includes(value.status) ? value.status : '',
      sort: ['oldest', 'title'].includes(value.sort) ? value.sort : 'newest',
    };
  } catch {
    return { query: '', year: '', status: '', sort: 'newest' };
  }
}
export function ArticlesPanel({
  content,
  change,
  openPage,
  addArticle,
  standalone = false,
}: CollectionProps & { openPage: (id: string) => void; addArticle: () => void; standalone?: boolean }) {
  const [initial] = useState(readFilters);
  const [query, setQuery] = useState(initial.query),
    [year, setYear] = useState(initial.year),
    [status, setStatus] = useState(initial.status),
    [sort, setSort] = useState(initial.sort),
    [selection, setSelection] = useState<string[]>([]),
    [confirm, setConfirm] = useState(false);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      sessionStorage.setItem('website-admin-article-filters', JSON.stringify({ query, year, status, sort }));
    } catch {}
  }, [query, year, status, sort]);
  const articles = content.pages.filter((p) => p.template === 'article');
  const years = [...new Set(articles.flatMap((p) => (p.date ? [p.date.slice(0, 4)] : [])))].sort().reverse();
  const rows = articles
    .filter(
      (p) =>
        (!year || (year === 'undated' ? !p.date : p.date?.startsWith(year))) &&
        (!status || p.status === status) &&
        (p.title + ' ' + p.path).toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'en');
      if (!a.date || !b.date)
        return Number(!a.date) - Number(!b.date) || a.title.localeCompare(b.title, 'en');
      return (
        (sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) ||
        a.title.localeCompare(b.title, 'en')
      );
    });
  const pagination = usePagination(rows.length, [query, year, status, sort].join('|'));
  return (
    <section>
      <div className="section-heading">
        <div>
          {standalone ? <h1>Articles</h1> : <h2>Articles</h2>}
          <p className="muted">
            {rows.length} {rows.length === 1 ? 'article' : 'articles'}
          </p>
        </div>
        <Button className="primary" onClick={addArticle}>
          <Icon name="add" /> Add article
        </Button>
      </div>
      <div className="article-filters">
        <label className="article-search">
          <span>Search</span>
          <input
            type="search"
            aria-label="Search articles"
            placeholder="Title or address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelection([]);
            }}
          />
        </label>
        <label>
          Year
          <select
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setSelection([]);
            }}
          >
            <option value="">All dates</option>
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
            <option value="undated">No date</option>
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setSelection([]);
            }}
          >
            <option value="">All statuses</option>
            <option value="published">Public</option>
            <option value="draft">Draft</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
      <div className="article-selection">
        <label className="check">
          <input
            type="checkbox"
            aria-label="Select all articles"
            disabled={!rows.length}
            checked={rows.length > 0 && rows.every((p) => selection.includes(p.id))}
            onChange={(e) => setSelection(e.target.checked ? rows.map((p) => p.id) : [])}
          />
          Select all
        </label>
        {(query || year || status) && (
          <Button
            compactIcons="keep"
            onClick={() => {
              setQuery('');
              setYear('');
              setStatus('');
              setSelection([]);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>
      {selection.length > 0 && (
        <div className="selection-bar">
          <span>{selection.length} selected</span>
          <Button ref={deleteTrigger} className="danger" onClick={() => setConfirm(true)}>
            <Icon name="trash" /> Delete selected
          </Button>
        </div>
      )}
      <div className="item-list">
        {rows.slice(pagination.start, pagination.end).map((p) => (
          <div className="item-row" key={p.id}>
            <input
              type="checkbox"
              aria-label={'Select ' + p.title + ' ' + p.path}
              checked={selection.includes(p.id)}
              onChange={(e) =>
                setSelection((s) => (e.target.checked ? [...s, p.id] : s.filter((id) => id !== p.id)))
              }
            />
            <Button compactIcons="keep" className="row-link" onClick={() => openPage(p.id)}>
              <span>
                <strong>{p.title}</strong>
                <small>
                  {p.date ? (
                    <time dateTime={p.date}>
                      {new Intl.DateTimeFormat('en', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(p.date))}
                    </time>
                  ) : (
                    'No date'
                  )}
                </small>
              </span>
              <span className={'badge ' + (p.status === 'published' ? 'live' : '')}>
                {p.status === 'published' ? 'Public' : 'Draft'}
              </span>
              <Icon name="arrow" />
            </Button>
          </div>
        ))}
      </div>
      {!rows.length && <EmptyState title="No items to display" />}
      <Pagination {...pagination} />
      {confirm && (
        <ConfirmDialog
          title={'Delete ' + selection.length + ' items?'}
          onClose={() => setConfirm(false)}
          returnFocusTo={deleteTrigger.current}
          destructive
          confirmLabel="Delete items"
          onConfirm={() => {
            change((c) => ({ ...c, pages: c.pages.filter((p) => !selection.includes(p.id)) }));
            setSelection([]);
          }}
        >
          <p>The selected items will be removed from your draft. You can undo this change.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
