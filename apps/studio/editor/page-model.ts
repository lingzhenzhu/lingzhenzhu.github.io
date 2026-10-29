import { newBlock, moduleDefinitions, type Block, type Content, type Page } from '@lzzhu/content';
export const blockNames = Object.fromEntries(
  Object.entries(moduleDefinitions).map(([type, definition]) => [type, definition.label]),
) as Record<Block['type'], string>;
export function isArchiveView(page: Page) {
  return page.blocks.some((b) => b.type === 'archive' && (b.year || b.month));
}
export function sitePages(content: Content) {
  return content.pages
    .filter((p) => p.template !== 'article' && !isArchiveView(p))
    .sort((a, b) => Number(b.inNavigation) - Number(a.inNavigation) || a.navOrder - b.navOrder);
}
export function pageName(page: Page) {
  return page.template === 'home' ? 'Home' : page.title;
}
export function createPage(content: Content, article = false): Page {
  const id = crypto.randomUUID();
  return {
    id,
    path: (article ? '/writing/' : '/page-') + id.slice(0, 8) + '/',
    title: article ? 'Untitled article' : 'Untitled page',
    language: 'en',
    showTitle: true,
    indexable: true,
    navLabel: article ? '' : 'New page',
    navOrder: Math.min(1000, sitePages(content).length),
    inNavigation: false,
    status: 'draft',
    template: article ? 'article' : 'page',
    description: '',
    revision: 0,
    blocks: [newBlock('richText')],
    ...(article ? { date: new Date().toISOString().slice(0, 10) } : {}),
  };
}
export function blockSummary(block: Block): string {
  if (block.type === 'firebaseRewards') return block.hidden ? 'Hidden' : 'Visible';
  if (block.type === 'teaching') return block.institution + ' · ' + block.courses.length + ' courses';
  if (block.type === 'richText') {
    const text = (node: { text?: string; content?: unknown[] }): string =>
      node.text || node.content?.map((n) => text(n as typeof node)).join(' ') || '';
    return text(block.document) || 'Start writing';
  }
  if (block.type === 'profile') return 'Upload or replace your homepage photo';
  if ('title' in block) return block.title;
  return block.type === 'image' ? block.alt || 'Image' : blockNames[block.type];
}
