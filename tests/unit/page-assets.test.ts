import { expect, it } from 'vitest';
import { ContentSchema, newBlock } from '@lzzhu/content';
import { pageStylesheets } from '../../packages/presentation/src/page-assets';
import seed from '../../content/site.json';

const page = ContentSchema.parse(seed).pages.find((page) => page.id === 'request-card')!;
const firebase = page.blocks.find((block) => block.type === 'firebaseRewards')!;

it.each([false, true])('loads versioned card styles only for visible cards (preview=%s)', (preview) => {
  const base = preview ? '/admin/assets/' : '/assets/';
  const cardStyles = (blocks: typeof page.blocks) =>
    pageStylesheets({ ...page, blocks }, preview).filter((url) => url.includes('request-card.css'));
  for (const block of [firebase, newBlock('rewards')]) {
    const styles = cardStyles([block, block]);
    expect(styles).toHaveLength(1);
    expect(styles[0]).toMatch(/^\/(admin\/)?assets\/request-card\.css\?v=[0-9a-f]{10}$/);
    expect(styles[0].startsWith(base)).toBe(true);
  }
  expect(cardStyles([{ ...firebase, hidden: true }])).toEqual([]);
  expect(cardStyles([newBlock('richText')])).toEqual([]);
});
