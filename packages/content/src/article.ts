import type { Page, Content } from './index';
import type { Block } from './module-contracts';

export type ArticleListBlock = Extract<Block, { type: 'archive' | 'articleSearch' }>;
export const isArticleList = (block: Block): block is ArticleListBlock =>
  block.type === 'archive' || block.type === 'articleSearch';
/** A list's year and month filters decide which article dates it can show. */
export function listShowsDate(block: ArticleListBlock, date = '') {
  return (!block.year || date.slice(0, 4) === block.year) && (!block.month || date.slice(5, 7) === block.month);
}
/** Published destinations for "All articles" and tag links, chosen from what each list really shows. */
export function articleListPaths(content: Content, article: Page) {
  const published = content.pages.filter((page) => page.status === 'published');
  const all = published.find((page) =>
    page.blocks.some((block) => isArticleList(block) && !block.year && !block.month),
  )?.path;
  // Only a page's first search reads ?tag=, so that search must include this article.
  const searches = published.flatMap((page) => {
    const search = page.blocks.find((block) => block.type === 'articleSearch');
    return search && listShowsDate(search, article.date) ? [{ page, broad: !search.year && !search.month }] : [];
  });
  return {
    all: all || '/',
    tags: (searches.find((search) => search.broad) || searches[0])?.page.path,
  };
}

export const articleNavigationActions = {
  all: 'All articles',
  home: 'Home',
  previous: 'Previous',
  next: 'Next',
} as const;
export function articleNavigation(settings: Content['settings']) {
  return (
    settings.articleNavigation ?? [
      { action: 'all' as const, align: 'left' as const },
      { action: 'home' as const, align: 'left' as const },
    ]
  );
}
export function articleDestinations(content: Content, page: Page) {
  const posts = publishedArticles(content);
  const index = posts.findIndex((post) => post.id === page.id);
  return {
    all: articleListPaths(content, page).all,
    home: '/',
    previous: index > 0 ? posts[index - 1]?.path : undefined,
    next: index >= 0 ? posts[index + 1]?.path : undefined,
  };
}

/** A license choice is stored by key; its name and canonical URL have one source. */
export const articleLicenses = {
  reserved: { label: 'All rights reserved', url: '' },
  'cc-by-4.0': { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'cc-by-sa-4.0': { label: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  'cc-by-nc-4.0': { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
  'cc-by-nc-sa-4.0': { label: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' },
  'cc-by-nd-4.0': { label: 'CC BY-ND 4.0', url: 'https://creativecommons.org/licenses/by-nd/4.0/' },
  'cc-by-nc-nd-4.0': { label: 'CC BY-NC-ND 4.0', url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/' },
  cc0: { label: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
} as const;
export type ArticleLicense = keyof typeof articleLicenses;

export function articleLicense(details: Page['articleDetails']) {
  if (details?.license) return articleLicenses[details.license];
  // Existing published terms remain intact until the author chooses a new license.
  if (details?.licenseLabel || details?.copyright)
    return {
      label: [details.copyright, details.licenseLabel].filter(Boolean).join(' '),
      url: details.licenseUrl || '',
    };
  return articleLicenses.reserved;
}
export function selectedLicense(details: Page['articleDetails']): ArticleLicense | 'existing' {
  if (details?.license) return details.license;
  const match = Object.entries(articleLicenses).find(
    ([, value]) => value.url && value.url === details?.licenseUrl,
  );
  return match
    ? (match[0] as ArticleLicense)
    : details?.licenseLabel || details?.copyright
      ? 'existing'
      : 'reserved';
}

export interface ArticleEntry {
  id: string;
  title: string;
  path: string;
  date: string;
  tags: string[];
  text: string;
}
/** Reading order shared by navigation and the index; it needs no article text. */
export function publishedArticles(content: Content) {
  return content.pages
    .filter((page) => page.template === 'article' && page.status === 'published')
    .sort(
      (a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title),
    );
}
// One extraction per content snapshot: every list and search on a built page shares it.
const indexes = new WeakMap<Page[], ArticleEntry[]>();
export function articleIndex(content: Content): ArticleEntry[] {
  const cached = indexes.get(content.pages);
  if (cached) return cached;
  const rich = (node: import('./rich-document').RichNode): string => {
    if (node.text) return node.text;
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'inlineMath' || node.type === 'blockMath') return String(node.attrs?.latex || '');
    return (
      node.content
        ?.map(rich)
        .join(
          ['doc', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem'].includes(node.type)
            ? '\n'
            : '',
        ) || ''
    );
  };
  const text = (value: unknown): string => {
    if (!value || typeof value !== 'object') return '';
    if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ');
    const node = value as Record<string, unknown>;
    if (node.type === 'doc') return rich(node as unknown as import('./rich-document').RichNode);
    if (node.type === 'text') return String(node.text || '');
    if (node.type === 'inlineMath' || node.type === 'blockMath')
      return String((node.attrs as Record<string, unknown>)?.latex || '');
    // Traverse editorial text, never serialized URLs, IDs or hidden metadata.
    return ['content', 'document', 'parts', 'courses', 'photos']
      .map((key) => text(node[key]))
      .concat(
        ['title', 'caption', 'institution', 'code', 'position'].map((key) =>
          typeof node[key] === 'string' ? (node[key] as string) : '',
        ),
      )
      .filter(Boolean)
      .join(' ');
  };
  const entries = publishedArticles(content).map((page) => ({
    id: page.id,
    title: page.title,
    path: page.path,
    date: page.date || '',
    tags: page.articleDetails?.tags || [],
    text: text(page.blocks),
  }));
  indexes.set(content.pages, entries);
  return entries;
}
