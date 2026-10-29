import { newBlock, type Content, type Page } from '@lzzhu/content';
export function largeWorkspace(source: Content, count = 1000): Content {
  const pages: Page[] = Array.from({ length: count }, (_, i) => ({
    id: 'stress-' + i,
    path: '/stress-' + i + '/',
    title: 'Scale article ' + String(i).padStart(4, '0'),
    language: 'en',
    showTitle: true,
    indexable: false,
    navLabel: '',
    navOrder: 0,
    inNavigation: false,
    status: 'draft',
    template: 'article',
    description: '',
    revision: 0,
    date: '2026-10-28',
    blocks: [
      {
        ...newBlock('richText'),
        id: 'stress-text-' + i,
        type: 'richText',
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: 'An editorial paragraph with thoughtful typography. '.repeat(50) },
              ],
            },
          ],
        },
      },
    ],
  }));
  if (pages.length > 1)
    pages[1].blocks = Array.from({ length: 300 }, (_, i) => ({
      ...newBlock('richText'),
      id: `scale-block-${i}`,
      type: 'richText',
      heading: `Section ${i + 1}`,
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content in an independently editable section.' }],
          },
        ],
      },
    }));
  return { ...source, pages: [...source.pages, ...pages] };
}
