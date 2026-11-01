import { test, expect } from '@playwright/test';
import sharp from 'sharp';

test('the light-only podcast canvas stays transparent across site themes and sizes', async ({ page }) => {
  // Reproduce Apple's light-only document and unused iframe canvas without
  // depending on its CDN, artwork or the current episode during CI.
  await page.route('https://embed.podcasts.apple.com/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><style>
      :root{color-scheme:only light}body{margin:0;background:transparent}
      article{height:360px;background:#d5be36;border-radius:12px;padding:20px;box-sizing:border-box}
      button{margin-top:250px}
      </style></head><body><article>Podcast<button>Latest Episode</button></article></body></html>`,
    }),
  );
  await page.addInitScript(() =>
    localStorage.setItem('lzzhu.preferences.v1', JSON.stringify({ theme: 'dark' })),
  );
  await page.goto('/media/');
  const frame = page.locator('.podcast-frame').first();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light', 'dark']) {
      await page.evaluate((value) => {
        document.documentElement.classList.toggle('dark-theme', value === 'dark');
        document.documentElement.style.colorScheme = value;
      }, theme);
      await frame.scrollIntoViewIfNeeded();
      await expect(
        page.frameLocator('.podcast-frame').getByRole('button', { name: 'Latest Episode' }),
      ).toBeVisible();
      const { data, info } = await sharp(await frame.screenshot())
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const offset = ((info.height - 20) * info.width + Math.floor(info.width / 2)) * 3;
      const expected = theme === 'dark' ? [30, 30, 30] : [250, 250, 248];
      expect([...data.subarray(offset, offset + 3)]).toEqual(expected);
      // Firefox reports sub-pixel layout, such as 450.00003.
      expect((await frame.boundingBox())!.height).toBeCloseTo(450, 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});
