import { expect, it } from 'vitest';
import sharp from 'sharp';
import { imageFilename } from '../../apps/studio/server/assets';
import { completeImageContainer } from '../../apps/studio/server/image-container';

it('normalizes names before truncation, preserving Unicode characters', () => {
  const name = '个人艺术照🌿'.repeat(100);
  const result = imageFilename(encodeURIComponent(name));
  expect([...result]).toHaveLength(200);
  expect(result).toBe([...name].slice(0, 200).join(''));
  expect(imageFilename(encodeURIComponent('100% 完成🌿.jpg'))).toBe('100% 完成🌿.jpg');
  expect(() => imageFilename('%E4%')).toThrow();
});
it.each(['png', 'jpeg', 'webp'] as const)('accepts a complete %s and rejects truncation', async (format) => {
  const data = await sharp({ create: { width: 16, height: 16, channels: 3, background: '#937557' } })
    .toFormat(format)
    .toBuffer();
  expect(completeImageContainer(data)).toBe(true);
  expect(completeImageContainer(data.subarray(0, data.length - 5))).toBe(false);
});
