import { Button } from './controls';
import { useState } from 'react';
import type { CollectionProps } from './types';
import { isArchiveView, pageName, sitePages } from './page-model';
import { EmptyState, Icon } from './ui';
export function SiteStructure({
  content,
  change,
  openPage,
  addPage,
}: { openPage: (id: string) => void; addPage: () => void } & CollectionProps) {
  const pages = sitePages(content),
    nav = pages.filter((p) => p.inNavigation),
    other = pages.filter((p) => !p.inNavigation);
  const move = (id: string, delta: number) =>
    change((c) => {
      const ordered = sitePages(c).filter((p) => p.inNavigation);
      const index = ordered.findIndex((p) => p.id === id);
      [ordered[index], ordered[index + delta]] = [ordered[index + delta], ordered[index]];
      const positions = new Map(ordered.map((p, i) => [p.id, i]));
      return {
        ...c,
        pages: c.pages.map((p) =>
          positions.has(p.id) && positions.get(p.id) !== p.navOrder
            ? { ...p, navOrder: positions.get(p.id)! }
            : p,
        ),
      };
    });
  return (
    <div className="collection wide">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Website</p>
          <h1>Site structure</h1>
          <p>Arrange the pages and labels in your website navigation.</p>
        </div>
        <Button compactIcons="keep" onClick={addPage}>
          Add page
        </Button>
      </div>
      <section className="surface">
        <div className="section-heading">
          <h2>Main navigation</h2>
          <span className="muted">Desktop & mobile</span>
        </div>
        <div className="structure-list">
          {nav.map((p, i) => (
            <div className="structure-row" key={p.id}>
              <span className="row-index">{String(i + 1).padStart(2, '0')}</span>
              <div className="structure-name">
                <strong>{pageName(p)}</strong>
                <small>{p.path}</small>
              </div>
              <label className="compact-field">
                <span className="sr-only">Navigation label for {pageName(p)}</span>
                <input
                  aria-label={'Navigation label for ' + pageName(p)}
                  value={p.navLabel}
                  onChange={(e) =>
                    change((c) => ({
                      ...c,
                      pages: c.pages.map((x) => (x.id === p.id ? { ...x, navLabel: e.target.value } : x)),
                    }))
                  }
                />
              </label>
              <div className="button-group">
                <Button
                  compactIcons="keep"
                  aria-label={'Move ' + pageName(p) + ' up'}
                  disabled={i === 0}
                  onClick={() => move(p.id, -1)}
                >
                  ↑
                </Button>
                <Button
                  compactIcons="keep"
                  aria-label={'Move ' + pageName(p) + ' down'}
                  disabled={i === nav.length - 1}
                  onClick={() => move(p.id, 1)}
                >
                  ↓
                </Button>
                <Button compactIcons="keep" onClick={() => openPage(p.id)}>
                  Edit
                </Button>
                <Button
                  compactIcons="keep"
                  aria-label={'Remove ' + pageName(p) + ' from navigation'}
                  onClick={() =>
                    change((c) => ({
                      ...c,
                      pages: c.pages.map((x) => (x.id === p.id ? { ...x, inNavigation: false } : x)),
                    }))
                  }
                >
                  −
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!nav.length && <EmptyState title="No navigation links" />}
      </section>
      <section className="surface">
        <h2>Other pages</h2>
        <p className="muted">These pages have their own address and are not in the main navigation.</p>
        {other.map((p) => (
          <div className="item-row" key={p.id}>
            <Button compactIcons="keep" className="row-link" onClick={() => openPage(p.id)}>
              <span>
                <strong>{pageName(p)}</strong>
                <small>{p.path}</small>
              </span>
              <Icon name="arrow" />
            </Button>
            <Button
              compactIcons="keep"
              onClick={() =>
                change((c) => ({
                  ...c,
                  pages: c.pages.map((x) =>
                    x.id === p.id ? { ...x, inNavigation: true, navOrder: nav.length } : x,
                  ),
                }))
              }
            >
              Add to navigation
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
export function PagesOverview({
  content,
  openPage,
  addPage,
}: {
  content: CollectionProps['content'];
  openPage: (id: string) => void;
  addPage: () => void;
}) {
  const [query, setQuery] = useState(''),
    [kind, setKind] = useState('pages');
  const pages = (kind === 'archives' ? content.pages.filter(isArchiveView) : sitePages(content)).filter((p) =>
    (pageName(p) + ' ' + p.path).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="collection wide">
      <div className="workspace-heading">
        <div>
          <p className="eyebrow">Website</p>
          <h1>Pages</h1>
          <p>Edit page content and settings.</p>
        </div>
        <Button compactIcons="keep" className="primary" onClick={addPage}>
          Add page
        </Button>
      </div>
      <div className="pages-filter">
        <input
          className="page-search"
          type="search"
          aria-label="Search pages"
          placeholder="Find a page…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Page type" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="pages">Website pages</option>
          <option value="archives">Archive pages</option>
        </select>
      </div>
      <div className="page-grid">
        {pages.map((p) => (
          <Button compactIcons="keep" className="page-card" key={p.id} onClick={() => openPage(p.id)}>
            <Icon name={p.template === 'home' ? 'home' : 'pages'} />
            <span className={'badge ' + (p.status === 'published' ? 'live' : '')}>
              {p.status === 'published' ? 'Public' : 'Draft'}
            </span>
            <h2>{pageName(p)}</h2>
            <p>{p.path}</p>
            <small>
              {p.blocks.some((b) => b.type === 'archive')
                ? content.pages.filter((x) => x.template === 'article').length + ' articles'
                : p.blocks.length + ' content sections'}{' '}
              <span>↗</span>
            </small>
          </Button>
        ))}
      </div>
      {!pages.length && <EmptyState title="No matching pages" />}
    </div>
  );
}
