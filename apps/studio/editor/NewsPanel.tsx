import { ConfirmDialog, Button, Pagination } from './controls';
import { usePagination } from './usePagination';
import { useRef, useState } from 'react';
import type { NewsEntry } from '@lzzhu/content';
import type { CollectionProps } from './types';
import { EmptyState, Icon } from './ui';
import { SharedSourceNotice } from './SharedSourceNotice';

export function NewsPanel({ content, change }: CollectionProps) {
  const [active, setActive] = useState<string>();
  const [selection, setSelection] = useState<string[]>([]);
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState<string[]>([]);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const entry = content.news.find((n) => n.id === active);
  const rows = content.news
    .filter(
      (n) =>
        n.text.toLowerCase().includes(query.toLowerCase()) &&
        (filter === 'all' || n.published === (filter === 'published')),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const pagination = usePagination(rows.length, query + '|' + filter);
  const update = (patch: Partial<NewsEntry>) =>
    change((c) => ({ ...c, news: c.news.map((n) => (n.id === active ? { ...n, ...patch } : n)) }));
  const select = (id: string) =>
    setSelection((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const remove = () => {
    change((c) => ({ ...c, news: c.news.filter((n) => !deleting.includes(n.id)) }));
    setSelection((s) => s.filter((id) => !deleting.includes(id)));
    if (active && deleting.includes(active)) setActive(undefined);
    setDeleting([]);
  };
  return (
    <section className="news-manager">
      <SharedSourceNotice content={content} source="news" />
      {entry ? (
        <>
          <div className="section-heading">
            <Button compactIcons="keep" className="back-button" onClick={() => setActive(undefined)}>
              <Icon name="back" />
              All news
            </Button>
            <span className={'badge ' + (entry.published ? 'live' : '')}>
              {entry.published ? 'Visible on publish' : 'Draft'}
            </span>
          </div>
          <h2 className="detail-title">Edit news</h2>
          <label>
            Message
            <textarea
              aria-label="Message"
              autoFocus
              rows={7}
              value={entry.text}
              onChange={(e) => update({ text: e.target.value })}
            />
          </label>
          <div className="field-row">
            <label>
              Date
              <input type="date" value={entry.date} onChange={(e) => update({ date: e.target.value })} />
            </label>
            <label>
              Date label
              <input value={entry.label} onChange={(e) => update({ label: e.target.value })} />
            </label>
          </div>
          <p className="field-help">The date controls the order. The label is displayed on the website.</p>
          <label className="check">
            <input
              type="checkbox"
              checked={entry.published}
              onChange={(e) => update({ published: e.target.checked })}
            />
            Include in next publication
          </label>
          <div className="form-footer">
            <Button
              compactIcons="keep"
              className="danger"
              onClick={(event) => {
                deleteTrigger.current = event.currentTarget;
                setDeleting([entry.id]);
              }}
            >
              Delete news
            </Button>
            <Button compactIcons="keep" onClick={() => setActive(undefined)}>
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="section-heading">
            <div>
              <h2>News</h2>
              <p className="muted">
                {content.news.length} {content.news.length === 1 ? 'update' : 'updates'} · newest first
              </p>
            </div>
            <Button
              compactIcons="keep"
              className="primary"
              onClick={() => {
                const id = crypto.randomUUID();
                change((c) => ({
                  ...c,
                  news: [
                    {
                      id,
                      text: 'New update',
                      date: new Date().toISOString().slice(0, 10),
                      label: 'New',
                      published: false,
                    },
                    ...c.news,
                  ],
                }));
                setActive(id);
              }}
            >
              Add news
            </Button>
          </div>
          <div className="list-tools">
            <input
              type="search"
              aria-label="Search news"
              placeholder="Search news"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select aria-label="Filter news" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All updates</option>
              <option value="published">Visible</option>
              <option value="draft">Drafts</option>
            </select>
          </div>
          {rows.length > 0 && (
            <div className="selection-bar">
              <label className="check">
                <input
                  type="checkbox"
                  aria-label="Select all news"
                  checked={rows.every((n) => selection.includes(n.id))}
                  onChange={(e) => setSelection(e.target.checked ? rows.map((n) => n.id) : [])}
                />
                {selection.length ? selection.length + ' selected' : 'Select all'}
              </label>
              {selection.length > 0 && (
                <div className="button-group">
                  <Button
                    compactIcons="keep"
                    onClick={() => {
                      change((c) => ({
                        ...c,
                        news: c.news.map((n) => (selection.includes(n.id) ? { ...n, published: true } : n)),
                      }));
                      setSelection([]);
                    }}
                  >
                    Make visible
                  </Button>
                  <Button
                    compactIcons="keep"
                    className="danger"
                    onClick={(event) => {
                      deleteTrigger.current = event.currentTarget;
                      setDeleting(selection);
                    }}
                  >
                    Delete selected
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="item-list">
            {rows.slice(pagination.start, pagination.end).map((n) => (
              <div className="item-row" key={n.id}>
                <input
                  type="checkbox"
                  aria-label={'Select news: ' + n.text}
                  checked={selection.includes(n.id)}
                  onChange={() => select(n.id)}
                />
                <Button compactIcons="keep" className="row-link" onClick={() => setActive(n.id)}>
                  <span>
                    <strong>{n.text}</strong>
                    <small>
                      {n.date} · {n.label}
                    </small>
                  </span>
                  <span className={'badge ' + (n.published ? 'live' : '')}>
                    {n.published ? 'Visible' : 'Draft'}
                  </span>
                  <Icon name="arrow" />
                </Button>
              </div>
            ))}
          </div>
          <Pagination {...pagination} />
          {!rows.length && (
            <EmptyState title={content.news.length ? 'No matching news' : 'No news yet'}>
              <p>Add a news item to your homepage.</p>
            </EmptyState>
          )}
        </>
      )}
      {deleting.length > 0 && (
        <ConfirmDialog
          title={'Delete ' + (deleting.length === 1 ? 'this update' : deleting.length + ' updates') + '?'}
          onClose={() => setDeleting([])}
          returnFocusTo={deleteTrigger.current}
          destructive
          confirmLabel={'Delete ' + (deleting.length === 1 ? 'update' : 'updates')}
          onConfirm={remove}
        >
          <p>
            This changes your draft. The live website changes when you publish. You can undo this deletion.
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
