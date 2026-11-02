import { it, expect } from 'vitest';
import { ContentSchema, articleIndex, articleDestinations } from '@lzzhu/content';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleReturn } from '../../packages/presentation/src/article-details';
import { paginationItems } from '../../packages/presentation/src/behavior/search-pagination';
import seed from '../../content/site.json';

it('article navigation handles both ends, unpublished articles and a one-article site', () => {
  const content = ContentSchema.parse(seed),
    posts = articleIndex(content);
  const first = content.pages.find((p) => p.id === posts[0].id)!,
    last = content.pages.find((p) => p.id === posts.at(-1)!.id)!;
  expect(articleDestinations(content, first).previous).toBeUndefined();
  expect(articleDestinations(content, last).next).toBeUndefined();
  expect(articleDestinations(content, { ...first, id: 'draft' }).next).toBeUndefined();
  content.settings.articleNavigation = [
    { action: 'previous', align: 'left' },
    { action: 'next', align: 'right' },
  ];
  const html = renderToStaticMarkup(<ArticleReturn content={content} page={first} />);
  expect(html).not.toContain('>Previous<');
  expect(html).toContain('>Next<');
  expect(html).toContain('<svg');
  const single = { ...content, pages: [first] };
  expect(
    renderToStaticMarkup(<ArticleReturn content={single} page={first} />),
  ).not.toContain('<nav');
});
it('numbered pagination retains the first and last destination without unbounded controls', () => {
  expect(paginationItems(1, 2)).toEqual([1, 2]);
  expect(paginationItems(50, 100)).toEqual([1, 'gap', 49, 50, 51, 'gap', 100]);
});
