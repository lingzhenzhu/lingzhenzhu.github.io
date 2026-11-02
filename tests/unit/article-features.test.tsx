import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ContentSchema,
  articleIndex,
  articleLicense,
  PageSchema,
  newBlock,
  validRichText,
} from '@lzzhu/content';
import { filterArticles } from '../../packages/content/src/article-search';
import { ArticleDates, ArticleCredit, ArticleReturn } from '../../packages/presentation/src/article-details';
import { RichText } from '../../packages/presentation/src/rich-text';
import { pageStylesheets, pageScripts } from '../../packages/presentation/src/page-assets';
import seed from '../../content/site.json';
const content = ContentSchema.parse(seed);
const article = content.pages.find((page) => page.template === 'article')!;
describe('article presentation settings', () => {
  it('independent date visibility, precision and editable default author', () => {
    const page = PageSchema.parse({
      ...article,
      date: '2026-10-31',
      articleDetails: {
        publishedDisplay: 'hidden',
        updatedDisplay: 'datetime',
        updatedDate: '2026-11-01',
        updatedTime: '13:30',
        author: 'Guest author',
        showLicense: false,
      },
    });
    const html = renderToStaticMarkup(<ArticleDates page={page} />);
    expect(html).not.toContain('Published');
    expect(html).toContain('2026-11-01T13:30');
    const credit = renderToStaticMarkup(<ArticleCredit page={page} author="Owner" />);
    expect(credit).toContain('Guest author');
    expect(credit).not.toContain('License');
    expect(credit).not.toContain('Permalink');
    expect(
      renderToStaticMarkup(<ArticleCredit page={{ ...page, articleDetails: undefined }} author="Owner" />),
    ).toContain('Owner');
    expect(
      renderToStaticMarkup(
        <ArticleDates
          page={{ ...page, articleDetails: { ...page.articleDetails!, updatedDisplay: 'hidden' } }}
        />,
      ),
    ).toBe('');
  });
  it('predefined licenses resolve canonical links, existing terms are preserved until chosen', () => {
    expect(articleLicense({ copyright: '', licenseLabel: '', license: 'cc-by-sa-4.0' }).url).toBe(
      'https://creativecommons.org/licenses/by-sa/4.0/',
    );
    expect(
      articleLicense({
        copyright: 'Existing terms',
        licenseLabel: 'License',
        licenseUrl: 'https://example.com/terms',
      }),
    ).toEqual({ label: 'Existing terms License', url: 'https://example.com/terms' });
    const html = renderToStaticMarkup(
      <ArticleReturn page={article} content={content} />,
    );
    expect(html).toContain('<svg');
    expect(html).not.toContain('data-back');
  });
});
describe('public article search', () => {
  it('includes gallery captions and preserves explicit line breaks', () => {
    const page = PageSchema.parse({
      ...article,
      blocks: [
        {
          ...newBlock('gallery'),
          photos: [
            { id: 'photo', src: '/assets/avatar.jpg', alt: 'Portrait', caption: 'Notes from the field' },
          ],
        },
        {
          ...newBlock('richText'),
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'First line' },
                  { type: 'hardBreak' },
                  { type: 'text', text: 'Second line' },
                ],
              },
            ],
          },
        },
      ],
    });
    const entry = articleIndex({ ...content, pages: [page] })[0];
    expect(entry.text).toContain('Notes from the field');
    expect(entry.text).toContain('First line\nSecond line');
  });
  it('indexes marked-up body text and filters tags/dates, excluding drafts', () => {
    const page = PageSchema.parse({
      ...article,
      id: 'published',
      date: '2026-10-31',
      articleDetails: { tags: ['Research'] },
      blocks: [
        {
          ...newBlock('richText'),
          document: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'pro' },
                  { type: 'text', text: 'duction', marks: [{ type: 'bold' }] },
                ],
              },
            ],
          },
        },
      ],
    });
    const entries = articleIndex({
      ...content,
      pages: [page, { ...page, id: 'secret', title: 'Secret', status: 'draft' }],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('production');
    const q = { q: 'PRODUCTION', tag: 'Research', year: '2026', month: '10' };
    expect(filterArticles(entries, q)).toHaveLength(1);
    expect(filterArticles(entries, { ...q, month: '09' })).toHaveLength(0);
    expect(filterArticles(entries, { ...q, year: '2025' })).toHaveLength(0);
    expect(filterArticles(entries, { ...q, tag: 'Other' })).toHaveLength(0);
    // Fixed URLs carry the build's content version, so a new page never runs a cached old script.
    expect(pageScripts({ ...page, blocks: [newBlock('articleSearch')] })).toEqual([
      expect.stringMatching(/^\/assets\/article-search\.js(\?v=[0-9a-f]{10})?$/),
    ]);
    expect(pageScripts(article)).toEqual([]);
  });
});
describe('technical text', () => {
  it('renders math with MathML, escapes code, and loads formula fonts only where needed', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'blockMath', attrs: { latex: '\\frac{x}{2}' } },
        {
          type: 'codeBlock',
          attrs: { language: 'javascript' },
          content: [{ type: 'text', text: 'const x = "<script>alert(1)</script>";' }],
        },
      ],
    };
    expect(validRichText(doc)).toBe(true);
    const html = renderToStaticMarkup(<RichText node={doc} />);
    expect(html).toContain('<math');
    expect(html).toContain('hljs-keyword');
    expect(html).not.toContain('<script>');
    expect(
      pageStylesheets({ ...article, blocks: [{ ...newBlock('richText'), type: 'richText', document: doc }] }),
    ).toEqual([expect.stringMatching(/^\/assets\/math\/katex\.min\.css(\?v=[0-9a-f]{10})?$/)]);
    expect(pageStylesheets({ ...article, blocks: [] })).toEqual([]);
  });
  it('rejects oversized formulas and invalid code languages; unsafe LaTeX remains inert', () => {
    expect(validRichText({ type: 'inlineMath', attrs: { latex: 'x'.repeat(4001) } })).toBe(false);
    expect(validRichText({ type: 'codeBlock', attrs: { language: '<script>' } })).toBe(false);
    const html = renderToStaticMarkup(
      <RichText node={{ type: 'inlineMath', attrs: { latex: '\\href{javascript:alert(1)}{click}' } }} />,
    );
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('<script');
  });
});
