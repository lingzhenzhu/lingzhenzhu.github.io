import { Button, Pagination } from './controls';
import { usePagination } from './usePagination';
import { useEffect, useState } from 'react';
import { mergeMedium, type Content } from '@lzzhu/content';
import { api, send } from './api';
import type { CollectionProps, FeedState, RunTask } from './types';
import { EmptyState, Icon } from './ui';
import { SharedSourceNotice } from './SharedSourceNotice';
export function MediumPanel({ content, change, run }: CollectionProps & { run: RunTask }) {
  const [feed, setFeed] = useState<FeedState>(),
    [active, setActive] = useState<string>(),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    run(async () => setFeed(await api('/feed')));
  }, []);
  const entries = mergeMedium(content.medium, JSON.parse(feed?.entries || '[]') as Content['medium']);
  const pagination = usePagination(entries.length);
  const selected = entries.find((e) => e.id === active);
  const update = (patch: Partial<Content['medium'][number]>) => {
    if (selected)
      change((c) => ({ ...c, medium: entries.map((e) => (e.id === selected.id ? { ...e, ...patch } : e)) }));
  };
  return (
    <section>
      <SharedSourceNotice content={content} source="medium" />
      <div className="section-heading">
        <div>
          <h2>Medium</h2>
          <p className="muted">Connected to @lzzhu718</p>
        </div>
        <span className="badge live">Automatic</span>
      </div>
      <div className="notice">
        <strong>Articles refresh automatically</strong>
        <p>
          Each visit to a page with Medium articles checks for updates. The official RSS feed is refreshed at
          most once every five minutes. Your website keeps the last available articles if Medium is
          unavailable.
        </p>
      </div>
      {selected ? (
        <>
          <Button compactIcons="keep" className="back-button" onClick={() => setActive(undefined)}>
            <Icon name="back" />
            All articles
          </Button>
          <h3>{selected.title}</h3>
          <a href={selected.url} target="_blank" rel="noopener noreferrer">
            Read on Medium ↗
          </a>
          <label>
            Cover override URL
            <input
              value={selected.coverOverride || ''}
              placeholder="Leave empty to use the article cover"
              onChange={(e) => update({ coverOverride: e.target.value || undefined })}
            />
          </label>
          <p className="field-help">Articles without a cover use the website’s illustrated default.</p>
          <label className="check">
            <input
              type="checkbox"
              checked={!selected.hidden}
              onChange={(e) => update({ hidden: !e.target.checked })}
            />
            Show this article after publishing
          </label>
          <Button compactIcons="keep" onClick={() => setActive(undefined)}>
            Done
          </Button>
        </>
      ) : (
        <>
          <div className="section-heading">
            <small className="muted">
              Last successful check:{' '}
              {feed?.succeeded_at ? new Date(feed.succeeded_at).toLocaleString('en-US') : 'Not yet checked'}
            </small>
            <Button
              compactIcons="keep"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  setBusy(true);
                  try {
                    setFeed(await send('/feed/sync', {}));
                  } finally {
                    setBusy(false);
                  }
                })
              }
            >
              {busy ? 'Checking…' : 'Check now'}
            </Button>
          </div>
          {feed?.error && (
            <p className="field-help">The last check was unsuccessful. Existing articles remain available.</p>
          )}
          <div className="item-list">
            {entries.slice(pagination.start, pagination.end).map((entry) => (
              <Button
                compactIcons="keep"
                className="row-link"
                key={entry.id}
                onClick={() => setActive(entry.id)}
              >
                <span>
                  <strong>{entry.title}</strong>
                  <small>{new Date(entry.publishedAt).toLocaleDateString('en-US')}</small>
                </span>
                <span className="badge">{entry.hidden ? 'Hidden' : 'Visible'}</span>
                <Icon name="arrow" />
              </Button>
            ))}
          </div>
          <Pagination {...pagination} />
          {!entries.length && (
            <EmptyState title="No articles yet">
              <p>New stories will appear here after the next feed check.</p>
            </EmptyState>
          )}
        </>
      )}
    </section>
  );
}
