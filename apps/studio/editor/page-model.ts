import {
  newBlock,
  moduleDefinitions,
  isArticleList,
  listShowsDate,
  type Block,
  type Content,
  type Page,
} from '@lzzhu/content';
export const blockNames = Object.fromEntries(
  Object.entries(moduleDefinitions).map(([type, definition]) => [type, definition.label]),
) as Record<Block['type'], string>;
/** Home and ordinary pages form the site structure; articles and archives have their own lists. */
export const isSitePage = (page: Page) => page.template === 'home' || page.template === 'page';
export const isArchiveView = (page: Page) => page.template === 'archive';
/** Articles, drafts included, that any of the page's lists can show. */
export function listedArticleCount(content: Content, page: Page) {
  const lists = page.blocks.filter(isArticleList);
  return content.pages.filter(
    (article) =>
      article.template === 'article' && lists.some((list) => listShowsDate(list, article.date)),
  ).length;
}
export function sitePages(content: Content) {
  return content.pages
    .filter(isSitePage)
    .sort((a, b) => Number(b.inNavigation) - Number(a.inNavigation) || a.navOrder - b.navOrder);
}
export function pageName(page: Page) {
  return page.template === 'home' ? 'Home' : page.title;
}
/** The sidebar and the Pages overview identify a page by the same icon. */
export function pageIcon(page: Page) {
  if (page.template === 'home') return 'home';
  if (page.template === 'archive') return 'archive';
  const has = (...types: Block['type'][]) => page.blocks.some((block) => types.includes(block.type));
  if (has('research')) return 'research';
  if (has('teaching')) return 'teaching';
  if (has('medium', 'podcast')) return 'media';
  if (has('archive', 'articleSearch')) return 'archive';
  return 'pages';
}
export type NewPageTemplate = 'page' | 'article' | 'archive';
export function createPage(content: Content, template: NewPageTemplate = 'page'): Page {
  const id = crypto.randomUUID();
  const article = template === 'article';
  return {
    id,
    path: { page: '/page-', article: '/writing/', archive: '/archives/' }[template] + id.slice(0, 8) + '/',
    title: { page: 'Untitled page', article: 'Untitled article', archive: 'Untitled archive' }[template],
    language: 'en',
    showTitle: true,
    indexable: true,
    navLabel: template === 'page' ? 'New page' : '',
    navOrder: Math.min(1000, sitePages(content).length),
    inNavigation: false,
    status: 'draft',
    template,
    description: '',
    revision: 0,
    blocks: [
      template === 'archive'
        ? ({ ...newBlock('archive'), year: new Date().toISOString().slice(0, 4) } as Block)
        : newBlock('richText'),
    ],
    ...(article ? { date: new Date().toISOString().slice(0, 10) } : {}),
  };
}
export function blockSummary(block: Block): string {
  if (block.type === 'archive' || block.type === 'articleSearch')
    return [block.type === 'articleSearch' ? 'Search and filters' : 'Article list', block.year, block.month]
      .filter(Boolean)
      .join(' · ');
  if (block.type === 'firebaseRewards') return block.hidden ? 'Hidden' : 'Visible';
  if (block.type === 'teaching') return block.institution + ' · ' + block.courses.length + ' courses';
  if (block.type === 'richText') {
    const text = (node: { text?: string; content?: unknown[] }): string =>
      node.text || node.content?.map((n) => text(n as typeof node)).join(' ') || '';
    return text(block.document) || 'Start writing';
  }
  if (block.type === 'profile') return 'Upload or replace your homepage photo';
  if ('title' in block) return block.title;
  return block.alt || 'Image';
}
