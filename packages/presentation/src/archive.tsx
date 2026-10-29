import { Fragment } from 'react';
import { type Content, type Block } from '@lzzhu/content';
import { displayDate } from './date';
export function Archive({
  block,
  content,
}: {
  block: Extract<Block, { type: 'archive' }>;
  content: Content;
}) {
  const posts = content.pages
    .filter(
      (p) =>
        p.template === 'article' &&
        p.status === 'published' &&
        (!block.year || p.date?.startsWith(block.year)) &&
        (!block.month || p.date?.slice(5, 7) === block.month),
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let year = '';
  return (
    <div className="archive-list">
      {posts.map((post) => {
        const nextYear = post.date?.slice(0, 4) || 'Undated';
        const heading = year !== nextYear;
        year = nextYear;
        return (
          <Fragment key={post.id}>
            {heading && (
              <h2 className="archive-year" data-heading-level="3">
                {year}
              </h2>
            )}
            <article className="archive-item">
              <a className="archive-item-link" href={post.path}>
                {post.title}
              </a>
              {post.date && (
                <time className="archive-item-date" dateTime={post.date}>
                  {displayDate(post.date)}
                </time>
              )}
            </article>
          </Fragment>
        );
      })}
    </div>
  );
}
