import {
  articleLicense,
  articleNavigation,
  articleNavigationActions,
  articleDestinations,
  articleListPaths,
  type Content,
  type Page,
} from '@lzzhu/content';
import { displayDate } from './date';

export function ArticleDates({ page }: { page: Page }) {
  const details = page.articleDetails;
  const dates = [
    {
      label: 'Published',
      date: page.date,
      time: details?.time,
      display: details?.publishedDisplay ?? (details?.time ? 'datetime' : 'date'),
    },
    {
      label: 'Updated',
      date: details?.updatedDate,
      time: details?.updatedTime,
      display: details?.updatedDisplay ?? 'hidden',
    },
  ].filter((item) => item.date && item.display !== 'hidden');
  if (!dates.length) return null;
  return (
    <div className="post-meta article-dates">
      {dates.map((item) => (
        <span key={item.label}>
          {item.label}{' '}
          <time dateTime={item.date + (item.display === 'datetime' && item.time ? 'T' + item.time : '')}>
            {displayDate(item.date!)}
            {item.display === 'datetime' && item.time ? ' · ' + item.time : ''}
          </time>
        </span>
      ))}
    </div>
  );
}
export function ArticleCredit({ page, author }: { page: Page; author: string }) {
  const details = page.articleDetails;
  const license = articleLicense(details);
  const showLicense =
    details?.showLicense ?? Boolean(details?.licenseLabel || details?.copyright || details?.license);
  return (
    <section className="post-copyright">
      <p>Author: {details?.author?.trim() || author}</p>
      {showLicense && (
        <p>
          License:{' '}
          {license.url ? (
            <a href={license.url} rel="license">
              {license.label}
            </a>
          ) : (
            license.label
          )}
        </p>
      )}
    </section>
  );
}
export function ArticleReturn({ content, page }: { content: Content; page: Page }) {
  const tagSearch = articleListPaths(content, page).tags;
  const destinations = articleDestinations(content, page);
  const links = articleNavigation(content.settings).filter((item) => destinations[item.action]);
  const paths = {
    all: 'm10 5-7 7 7 7M3 12h18',
    previous: 'm10 5-7 7 7 7M3 12h18',
    next: 'm14 5 7 7-7 7M21 12H3',
    home: 'm3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9',
  };
  return (
    <div className="article-end">
      {!!page.articleDetails?.tags?.length && (
        <div className="article-tag-group">
          <span className="article-tag-label">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3h8l10 10-8 8L3 11Z" />
              <circle cx="7.5" cy="7.5" r="1" />
            </svg>
            Tags
          </span>
          <ul className="article-tags" aria-label="Tags">
            {page.articleDetails.tags.map((tag) => (
              <li key={tag}>
                {tagSearch ? (
                  <a href={tagSearch + '?tag=' + encodeURIComponent(tag)}>{tag}</a>
                ) : (
                  <span>{tag}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!!links.length && (
        <nav className="article-return" aria-label="Article navigation">
          {(['left', 'right'] as const).map((align) => (
            <div className={'article-return-' + align} key={align}>
              {links
                .filter((item) => item.align === align)
                .map(({ action }) => (
                  <a
                    key={action}
                    href={destinations[action]}
                    rel={action === 'previous' ? 'prev' : action === 'next' ? 'next' : undefined}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    >
                      <path d={paths[action]} />
                    </svg>
                    <span>{articleNavigationActions[action]}</span>
                  </a>
                ))}
            </div>
          ))}
        </nav>
      )}
    </div>
  );
}
