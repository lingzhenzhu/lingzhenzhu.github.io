import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BlockSchema, ContentSchema, newBlock, navigation, type RichNode } from '@lzzhu/content';
import { copySection, moveSection, reorder } from '../../packages/content/src/operations';
import { markdownDocument } from '../../apps/studio/editor/markdown-document';
import { previewImageOrigins } from '../../apps/studio/server/image-policy';
import { migrateEditorial } from '../../scripts/migrations/editorial';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RenderBlock } from '../../packages/presentation/src/blocks';
const fixture = () => ContentSchema.parse(JSON.parse(readFileSync('content/site.json', 'utf8')));
describe('Modular editorial operations', () => {
  it('keeps repeated news instances unique and internal links inside copied sections intact', () => {
    const content = fixture();
    const news = [newBlock('news'), newBlock('news')];
    const html = news
      .map((block) => renderToStaticMarkup(createElement(RenderBlock, { block, content })))
      .join('');
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const block = newBlock('richText');
    if (block.type !== 'richText') throw new Error('Invalid fixture');
    block.document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, id: 'project-summary' },
          content: [{ type: 'text', text: 'Summary' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Return to summary',
              marks: [{ type: 'link', attrs: { href: '#project-summary' } }],
            },
          ],
        },
      ],
    };
    content.pages.find((page) => page.id === 'home')!.blocks.push(block);
    const copy = copySection(content, 'home', block.id, ['media']).pages.find((page) => page.id === 'media')!
      .blocks[0];
    if (copy.type !== 'richText') throw new Error('Invalid copy');
    const heading = copy.document.content![0].attrs!.id;
    expect(heading).not.toBe('project-summary');
    expect(copy.document.content![1].content![0].marks![0].attrs!.href).toBe('#' + heading);
  });
  it('moves a whole module without dropping its nested data or changing other pages', () => {
    const content = fixture(),
      source = content.pages.find((page) => page.id === 'media')!;
    const block = newBlock('research');
    source.blocks.push(block);
    const moved = moveSection(content, source.id, block.id, 'blog');
    expect(moved.pages.find((page) => page.id === 'blog')!.blocks[0]).toEqual(block);
    expect(moved.pages.find((page) => page.id === source.id)!.blocks).not.toContainEqual(block);
    expect(moved.pages.find((page) => page.id === 'home')).toEqual(
      content.pages.find((page) => page.id === 'home'),
    );
  });
  it('reorders by identity, handles stale ids, and restores exactly after add/move/delete', () => {
    const original = fixture().pages.find((page) => page.id === 'teaching')!.blocks;
    const block = newBlock('teaching');
    const result = reorder([...original, block], block.id, 0);
    expect(result[0]).toEqual(block);
    expect(result.filter((item) => item.id !== block.id)).toEqual(original);
    expect(reorder(original, 'gone', 0)).toBe(original);
  });
  it('makes independent instances and does not copy protected modules to public pages', () => {
    const content = fixture();
    const home = content.pages.find((page) => page.id === 'home')!;
    const block = home.blocks.find((item) => item.type === 'richText')!;
    const result = copySection(content, home.id, block.id, ['home', 'media']);
    const a = result.pages.find((page) => page.id === 'home')!.blocks[0],
      b = result.pages.find((page) => page.id === 'media')!.blocks[0];
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(block.id);
    const card = content.pages.find((page) => page.id === 'request-card')!;
    const reward = newBlock('rewards');
    card.blocks = [reward];
    expect(() => moveSection(content, card.id, reward.id, 'home')).toThrow('protected');
    expect(() => copySection(content, card.id, reward.id, ['home'])).toThrow('protected');
    expect(() => moveSection(content, home.id, block.id, 'missing')).toThrow();
  });
  it('validates nested links, duplicate IDs and gallery motion bounds', () => {
    const block = newBlock('teaching');
    expect(
      BlockSchema.safeParse({
        ...block,
        courses: [
          {
            id: 'x',
            year: 2026,
            term: 'Fall',
            code: '',
            title: '',
            position: '',
            resourceUrl: 'javascript:alert(1)',
          },
        ],
      }).success,
    ).toBe(false);
    const gallery = newBlock('gallery');
    const photo = { id: 'x', src: '/assets/avatar.jpg', alt: 'Portrait', caption: '' };
    expect(BlockSchema.safeParse({ ...gallery, photos: [photo, photo] }).success).toBe(false);
    expect(BlockSchema.safeParse({ ...gallery, interval: 200 }).success).toBe(false);
  });
  it('includes nested image origins in preview CSP but never resource link origins', () => {
    const content = fixture();
    content.pages[0].blocks.push({
      ...newBlock('teaching'),
      type: 'teaching',
      institution: 'University',
      logo: 'https://logos.example/u.png',
      showName: true,
      courses: [],
    });
    content.pages[0].blocks.push({
      ...newBlock('gallery'),
      type: 'gallery',
      title: '',
      autoplay: false,
      interval: 7000,
      photos: [{ id: 'a', src: 'https://photos.example/a.jpg', alt: '', caption: '' }],
    });
    expect(previewImageOrigins(content)).toEqual(
      expect.arrayContaining(['https://logos.example', 'https://photos.example']),
    );
  });
  it('preserves heading anchors when Markdown changes body text; rejects unsafe parsed content', () => {
    const old: RichNode = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2, id: 'permanent' }, content: [{ type: 'text', text: 'Title' }] },
      ],
    };
    const next = structuredClone(old);
    delete next.content![0].attrs!.id;
    expect(markdownDocument(next, old).content![0].attrs!.id).toBe('permanent');
    expect(() =>
      markdownDocument(
        { type: 'doc', content: [{ type: 'image', attrs: { src: 'javascript:alert(1)' } }] },
        old,
      ),
    ).toThrow('unsafe');
  });
  it('one-time migration is idempotent and hidden published pages remain reachable', () => {
    const migrated = migrateEditorial(fixture());
    expect(migrateEditorial(migrated)).toEqual(migrated);
    const page = migrated.pages.find((page) => page.id === 'blog')!;
    page.inNavigation = false;
    expect(navigation(migrated)).not.toContainEqual(page);
    expect(migrated.pages).toContainEqual(page);
  });
});
