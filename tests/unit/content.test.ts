import { describe, it, expect } from 'vitest';
import {
  ContentSchema,
  PageSchema,
  publicSnapshot,
  mergeMedium,
  safeUrl,
  validRichText,
} from '@lzzhu/content';
import seed from '../../content/site.json';
describe('content boundary', () => {
  it('retains all imported public pages and rejects ambiguous routes', () => {
    const content = ContentSchema.parse(seed);
    expect(content.pages).toHaveLength(23);
    for (const path of [
      '/admin/',
      '/api/content/',
      '/assets/private/',
      '//outside',
      '/a/../admin/',
      '/a%2fadmin/',
    ])
      expect(PageSchema.safeParse({ ...content.pages[0], path }).success).toBe(false);
    expect(ContentSchema.safeParse({ ...content, pages: [...content.pages, content.pages[0]] }).success).toBe(
      false,
    );
  });
  it('never exports drafts, hidden feed items or unpublished news', () => {
    const content = ContentSchema.parse(seed);
    content.pages[1].status = 'draft';
    content.news[0].published = false;
    content.medium[0].hidden = true;
    const output = publicSnapshot(content);
    expect(output.pages.some((page) => page.id === 'research')).toBe(false);
    expect(output.news).toEqual([]);
    expect(output.medium).toEqual([]);
    expect(output.pages.every((page) => page.revision === 0)).toBe(true);
  });
  it('rejects executable URLs and rich text markup', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      '//attacker.com',
      'https://user:pass@example.com',
    ])
      expect(safeUrl(url)).toBe(false);
    expect(validRichText({ type: 'script', text: 'alert(1)' })).toBe(false);
    expect(validRichText({ type: 'image', attrs: { src: 'javascript:alert(1)' } })).toBe(false);
    expect(
      validRichText({
        type: 'text',
        text: 'hi',
        marks: [{ type: 'link', attrs: { href: 'javascript:evil()' } }],
      }),
    ).toBe(false);
  });
  it('refreshes feed metadata while respecting editorial choices', () => {
    const item = ContentSchema.parse(seed).medium[0];
    const merged = mergeMedium(
      [{ ...item, hidden: true, coverOverride: '/assets/card.jpg' }],
      [{ ...item, title: 'New title' }],
    );
    expect(merged[0]).toMatchObject({ title: 'New title', hidden: true, coverOverride: '/assets/card.jpg' });
  });
  it('rejects malformed input without throwing and prevents encoded route collisions', () => {
    for (const content of [false, '', 0, null]) expect(validRichText({ type: 'doc', content })).toBe(false);
    expect(validRichText({ type: 'text', text: 'x', marks: [null] })).toBe(false);
    const content = ContentSchema.parse(seed);
    for (const path of ['/%zz/', '/%61dmin/', '/404.html/'])
      expect(PageSchema.safeParse({ ...content.pages[0], path }).success).toBe(false);
    content.pages.push({ ...content.pages[1], id: 'duplicate-path', path: '/%72esearch/' });
    expect(ContentSchema.safeParse(content).success).toBe(false);
  });
});
