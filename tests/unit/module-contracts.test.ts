import { describe, expect, it } from 'vitest';
import { ContentSchema } from '@lzzhu/content';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { RenderBlock, blockRenderers } from '../../packages/presentation/src/blocks';
import {
  BlockSchema,
  newBlock,
  moduleDefinitions,
  type BlockType,
} from '../../packages/content/src/module-contracts';
import seed from '../../content/site.json';

describe('module contract extraction', () => {
  it('every catalog module has valid independent defaults and a public renderer', () => {
    const content = ContentSchema.parse(seed);
    expect(Object.keys(blockRenderers).sort()).toEqual(Object.keys(moduleDefinitions).sort());
    for (const type of Object.keys(moduleDefinitions) as BlockType[]) {
      const before = newBlock(type),
        after = newBlock(type);
      expect(before.id).not.toBe(after.id);
      expect(BlockSchema.parse(after)).toEqual(after);
      expect(() =>
        renderToStaticMarkup(createElement(RenderBlock, { block: after, content, preview: true })),
      ).not.toThrow();
      for (const invalid of [
        { ...after, id: '../escape' },
        { ...after, version: 2 },
      ]) {
        expect(BlockSchema.safeParse(invalid).success).toBe(false);
      }
    }
  });
  it('retains security and collection boundaries', () => {
    for (const src of [
      'javascript:alert(1)',
      'https://user:password@example.com/image.png',
      '//example.com/image.png',
    ]) {
      expect(BlockSchema.safeParse({ ...newBlock('image'), src }).success).toBe(false);
    }
    expect(BlockSchema.safeParse({ ...newBlock('gallery'), interval: 10 }).success).toBe(false);
    expect(BlockSchema.safeParse({ ...newBlock('podcast'), url: 'https://example.com/' }).success).toBe(
      false,
    );
    expect(
      BlockSchema.safeParse({
        ...newBlock('research'),
        parts: [{ id: 'p', type: 'text', document: { type: 'script' } }],
      }).success,
    ).toBe(false);
  });
});
