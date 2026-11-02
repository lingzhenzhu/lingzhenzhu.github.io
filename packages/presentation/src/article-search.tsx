import { articleIndex, type Content, type Block } from '@lzzhu/content';
import { SectionHeading } from './section-heading';
import { ArchiveItems } from './archive-list';
import { FilterSelect } from './filter-select';
import { filterArticles } from '@lzzhu/content/article-search';
export function ArticleSearch({
  block,
  content,
  preview,
}: {
  block: Extract<Block, { type: 'articleSearch' }>;
  content: Content;
  preview?: boolean;
}) {
  const entries = filterArticles(articleIndex(content), {
    q: '',
    tag: '',
    year: block.year || '',
    month: block.month || '',
  });
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))].sort();
  const years = [...new Set(entries.map((entry) => entry.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2024, index, 1)),
    ),
  }));
  return (
    <section
      className="article-search"
      data-article-search
      data-page-size={block.pageSize}
      data-year={block.year}
      data-month={block.month}
      data-source={preview ? '/admin/api/article-index' : '/assets/article-index.json?v=' + content.revision}
      aria-labelledby={block.title ? 'search-' + block.id : undefined}
      aria-label={block.title ? undefined : 'Articles'}
    >
      {block.title && <SectionHeading id={'search-' + block.id}>{block.title}</SectionHeading>}
      <form className="article-search-form" role="search" aria-label="Search articles">
        <div className="article-query">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="10" cy="10" r="6.5" />
            <path d="m15 15 6 6" />
          </svg>
          <input
            type="search"
            name="q"
            aria-label="Search full text"
            placeholder="Search articles"
            maxLength={300}
            disabled
          />
          <button
            type="button"
            className="article-query-clear"
            data-search-clear
            aria-label="Clear search"
            hidden
            disabled
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </div>
        <div className="article-search-filters">
          <span className="article-filter-label">Filter</span>
          <FilterSelect
            id={'filter-tag-' + block.id}
            name="tag"
            label="Tag"
            options={[{ value: '', label: 'All tags' }, ...tags.map((tag) => ({ value: tag, label: tag }))]}
          />
          <FilterSelect
            id={'filter-year-' + block.id}
            name="year"
            label="Year"
            options={[
              { value: '', label: 'All years' },
              ...years.map((year) => ({ value: year, label: year })),
            ]}
          />
          <FilterSelect
            id={'filter-month-' + block.id}
            name="month"
            label="Month"
            options={[{ value: '', label: 'All months' }, ...months]}
          />
        </div>
        <div className="article-search-actions">
          <button type="reset" className="article-search-reset" data-search-reset hidden disabled>
            Reset filters
          </button>
        </div>
      </form>
      <div className="archive-list article-search-results">
        {/* Every result page is in the HTML, so the list stays complete if the index cannot load. */}
        {Array.from({ length: Math.ceil(entries.length / block.pageSize) }, (_, index) => (
          <div className="article-search-page" data-result-page key={index} hidden={index > 0}>
            <ArchiveItems entries={entries.slice(index * block.pageSize, (index + 1) * block.pageSize)} />
          </div>
        ))}
      </div>
      <footer className="article-search-footer">
        <p className="article-search-status" role="status" aria-live="polite">
          {entries.length} articles
        </p>
        <nav className="article-pagination" aria-label="Article results pages" data-search-pagination />
      </footer>
      <button type="button" className="article-search-retry" data-search-retry hidden>
        Try again
      </button>
      <noscript>
        <p>Enable JavaScript to search and filter articles.</p>
      </noscript>
    </section>
  );
}
