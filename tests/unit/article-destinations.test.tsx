import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContentSchema, articleListPaths, newBlock, type Block, type Content, type Page } from '@lzzhu/content';
import { filterArticles } from '@lzzhu/content/article-search';
import { ArticleReturn } from '../../packages/presentation/src/article-details';
import { ArticleSearch } from '../../packages/presentation/src/article-search';
import { createPage, isArchiveView, sitePages } from '../../apps/studio/editor/page-model';
import seed from '../../content/site.json';

const base = ContentSchema.parse(seed);
const list = (type: 'archive' | 'articleSearch', filters: { year?: string; month?: string } = {}) =>
  ({ ...newBlock(type), ...filters }) as Block;
const page = (id: string, path: string, blocks: Block[], extra: Partial<Page> = {}): Page => ({
  ...base.pages.find((item) => item.template === 'page')!,
  id,
  path,
  blocks,
  inNavigation: false,
  status: 'published',
  ...extra,
});
const article = (id: string, date: string, tags = ['Field notes']): Page => ({
  ...base.pages.find((item) => item.template === 'article')!,
  id,
  path: '/writing/' + id + '/',
  title: 'Article ' + id,
  date,
  status: 'published',
  articleDetails: { copyright: '', licenseLabel: '', tags },
});
const withPages = (...pages: Page[]): Content => ({
  ...base,
  pages: [base.pages.find((item) => item.template === 'home')!, ...pages],
});

describe('page identity', () => {
  it('a dated article list on Home never changes what Home is', () => {
    const content = structuredClone(base);
    const home = content.pages.find((item) => item.template === 'home')!;
    home.blocks.push(list('archive', { year: '2022' }));
    expect(sitePages(content).map((item) => item.id)).toContain(home.id);
  });
  it('archive identity is stored, so editing modules never moves a page', () => {
    const regular = page('notes', '/notes/', [list('archive', { year: '2023' })]);
    expect(isArchiveView(regular)).toBe(false);
    expect(sitePages(withPages(regular)).map((item) => item.id)).toContain('notes');
    const archive = { ...regular, template: 'archive' as const, blocks: [newBlock('richText')] };
    expect(isArchiveView(archive)).toBe(true);
    expect(sitePages(withPages(archive)).map((item) => item.id)).not.toContain('notes');
  });
  it('new archive pages start as a dated list under /archives/', () => {
    const archive = createPage(base, 'archive');
    expect(archive.template).toBe('archive');
    expect(archive.path).toMatch(/^\/archives\/[0-9a-f]{8}\/$/);
    expect(archive.blocks).toMatchObject([{ type: 'archive', year: expect.stringMatching(/^\d{4}$/) }]);
    expect(ContentSchema.parse(withPages(archive)).pages.at(-1)!.template).toBe('archive');
  });
  it('the seed stores its legacy year and month pages as archives', () => {
    const archives = base.pages.filter(isArchiveView).map((item) => item.path);
    expect(archives).toHaveLength(11);
    expect(archives.every((path) => path.startsWith('/archives/'))).toBe(true);
  });
});

describe('article destinations', () => {
  const post = article('p2026', '2026-03-04');
  it('tags open a search that can show the article, preferring an unfiltered one', () => {
    const old = page('s2022', '/search-2022/', [list('articleSearch', { year: '2022' })]);
    const current = page('s2026', '/search-2026/', [list('articleSearch', { year: '2026' })]);
    const all = page('sall', '/search/', [list('articleSearch')]);
    expect(articleListPaths(withPages(old, post), post).tags).toBeUndefined();
    expect(articleListPaths(withPages(old, current, post), post).tags).toBe('/search-2026/');
    expect(articleListPaths(withPages(old, current, all, post), post).tags).toBe('/search/');
    const html = renderToStaticMarkup(<ArticleReturn content={withPages(old, post)} page={post} />);
    expect(html).not.toContain('/search-2022/');
    expect(html).toContain('<span>Field notes</span>');
  });
  it('a page whose first search is filtered elsewhere is not a tag destination', () => {
    const mixed = page('mixed', '/mixed/', [list('articleSearch', { year: '2022' }), list('articleSearch')]);
    expect(articleListPaths(withPages(mixed, post), post).tags).toBeUndefined();
  });
  it('"All articles" uses an unfiltered list and falls back to Home', () => {
    const dated = page('a2026', '/archives/2026/', [list('archive', { year: '2026' })]);
    expect(articleListPaths(withPages(dated, post), post).all).toBe('/');
    const all = page('all', '/writing/', [list('archive')]);
    expect(articleListPaths(withPages(dated, all, post), post).all).toBe('/writing/');
  });
});

describe('article search without its index', () => {
  it('server-renders every result page so all articles stay reachable', () => {
    const posts = Array.from({ length: 7 }, (_, index) => article('n' + index, '2026-01-0' + (index + 1)));
    const block = { ...list('articleSearch'), pageSize: 5 } as Extract<Block, { type: 'articleSearch' }>;
    const html = renderToStaticMarkup(<ArticleSearch block={block} content={withPages(...posts)} />);
    for (const post of posts) expect(html).toContain('href="' + post.path + '"');
    expect(html.match(/data-result-page="true"/g)).toHaveLength(2);
    expect(html.match(/data-result-page="true" hidden=""/g)).toHaveLength(1);
  });
  it('repeated query terms do not change results', () => {
    const entries = [
      { id: '1', title: 'Orchard', path: '/a/', date: '2026-01-01', tags: [], text: 'field notes' },
      { id: '2', title: 'Market', path: '/b/', date: '2026-01-02', tags: [], text: 'prices' },
    ];
    const query = { tag: '', year: '', month: '' };
    expect(filterArticles(entries, { ...query, q: 'FIELD field Field' })).toEqual(
      filterArticles(entries, { ...query, q: 'field' }),
    );
    expect(filterArticles(entries, { ...query, q: 'field prices' })).toEqual([]);
  });
});
