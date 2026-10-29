import { test, expect } from '@playwright/test';
import content from '../../content/site.json' with { type: 'json' };
const routes = ['/', '/research/', '/teaching/', '/media/', '/archives/'];

test('vector content images reserve their final space before loading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseImage!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  await page.route('**/assets/hsp.svg', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/research/', { waitUntil: 'domcontentloaded' });
    // WebKit's FontFaceSet.ready can wait on the deliberately blocked eager image.
    // Load the faces directly so only image decoding remains pending during measurement.
    await page.evaluate(() => Promise.all(Array.from(document.fonts, (font) => font.load())));
    const image = page.locator('.content-image img').first();
    const before = await image.boundingBox();
    expect(before!.height).toBeGreaterThan(100);
    await expect(image).toHaveAttribute('width', '1243');
    await expect(image).toHaveAttribute('height', '528');
    await expect(image).toHaveAttribute('loading', 'eager');
    await expect(image).toHaveAttribute('fetchpriority', 'high');
    releaseImage();
    await image.evaluate((node: HTMLImageElement) => node.decode());
    expect(await image.boundingBox()).toEqual(before);
  } finally {
    releaseImage();
  }
});

test('every published page renders at desktop and phone widths without broken local images', async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/medium', (route) => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/rewards', (route) => route.fulfill({ json: { remaining: 0, requests: [] } }));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const item of content.pages.filter((p) => p.status === 'published')) {
      const response = await page.goto(item.path, { waitUntil: 'domcontentloaded' });
      expect(response?.status(), item.path).toBe(200);
      await expect(page.locator('h1'), item.path).toHaveCount(1);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), item.path).toBe(
        true,
      );
      const failed = await page.locator('img').evaluateAll(async (images) => {
        const local = images.filter(
          (img): img is HTMLImageElement =>
            img instanceof HTMLImageElement && new URL(img.src).origin === location.origin,
        );
        return (
          await Promise.all(
            local.map(async (img) => {
              try {
                img.loading = 'eager';
                await img.decode();
                return '';
              } catch {
                return img.src;
              }
            }),
          )
        ).filter(Boolean);
      });
      expect(failed, item.path).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});
test('shared page shell has identical navigation and compact banner coordinates', async ({ page }) => {
  let reference: unknown;
  let titleReference: unknown;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const route of routes) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator('.navbar,.navbar .menu-item').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    reference ??= geometry;
    expect(geometry).toEqual(reference);
    if (route !== '/') {
      const banner = await page.locator('.page-banner').boundingBox();
      titleReference ??= banner;
      expect(banner).toEqual(titleReference);
    } else {
      await expect(page.getByRole('link', { name: 'Explore more' })).toBeVisible();
      await expect(page.locator('.opening-portrait')).toHaveCount(0);
      const hero = await page.locator('.home-opening').boundingBox();
      expect(Math.abs(hero!.y + hero!.height - page.viewportSize()!.height)).toBeLessThanOrEqual(1);
    }
  }
  expect(errors).toEqual([]);
});
test('accessibility controls persist across navigation and reset', async ({ page }) => {
  await page.goto('/');
  await page.locator('#a11y-btn').click();
  await page.locator('#toggle-dark').click();
  await page.locator('#toggle-font-size').click();
  await page.locator('#toggle-contrast').click();
  await expect(page.locator('body')).toHaveClass(/dark-theme/);
  await expect(page.locator('body')).toHaveClass(/a11y-large-text/);
  await page.goto('/research/');
  await expect(page.locator('body')).toHaveClass(/a11y-high-contrast/);
  await page.locator('#a11y-btn').click();
  await expect(page.locator('#toggle-dark')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset-a11y').click();
  await expect(page.locator('body')).not.toHaveClass(/a11y-/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#a11y-btn')).toBeFocused();
});
test('mobile navigation and 4K display preserve layout without overflow', async ({ page }) => {
  for (const width of [390, 768, 3840]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/research/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 390) {
      await page.locator('.menu-toggle').click();
      await expect(page.locator('#mobile-menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#mobile-menu')).not.toBeVisible();
    }
  }
  await expect(page.locator('img[src="/assets/hsp.svg"]')).toBeVisible();
});
test('News scrolls when content overflows and manual pause survives visibility events', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const list = document.querySelector<HTMLUListElement>('.news-list')!;
    for (let i = 0; i < 7; i++) list.appendChild(list.firstElementChild!.cloneNode(true));
    document.querySelector<HTMLElement>('[data-news]')!.dataset.interval = '4000';
    window.dispatchEvent(new Event('resize'));
  });
  await page.mouse.move(0, 0);
  const scroller = page.locator('.news-feed-inner');
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop), { timeout: 10000 }).toBeGreaterThan(0);
  await page.locator('.news-toggle').click();
  await page.mouse.move(0, 0);
  await page.locator('#a11y-btn').focus();
  const paused = await scroller.evaluate((el) => el.scrollTop);
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new CustomEvent('site:speech', { detail: false }));
  });
  await page.waitForTimeout(4500);
  expect(await scroller.evaluate((el) => el.scrollTop)).toBe(paused);
  await expect(page.locator('.news-toggle')).toHaveAttribute('aria-pressed', 'true');
});
test('reduced motion pauses News; a single item never fakes scrolling', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.news-toggle')).toBeDisabled();
  await page.evaluate(() => {
    const list = document.querySelector<HTMLUListElement>('.news-list')!;
    for (let i = 0; i < 5; i++) list.appendChild(list.firstElementChild!.cloneNode(true));
  });
  await page.waitForTimeout(4500);
  expect(await page.locator('.news-feed-inner').evaluate((el) => el.scrollTop)).toBe(0);
});
test('Medium is first-party markup linking to the official profile', async ({ page }) => {
  await page.route('**/api/medium', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/media/');
  await expect(page.locator('.medium-card')).toHaveCount(1);
  await expect(page.locator('.medium-card')).toHaveAttribute('href', /https:\/\/medium.com\/@lzzhu718\//);
  expect(await page.locator('script[src*="sociable"],iframe[src*="medium"]').count()).toBe(0);
});
test('accessibility button remains in the viewport bottom-right while scrolling', async ({ page }) => {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/research/');
    const before = await page.locator('#a11y-btn').boundingBox();
    expect(before).not.toBeNull();
    const inset = viewport.width < 480 ? 16 : 24;
    // Fixed positioning uses the layout viewport, excluding a non-overlay scrollbar.
    const layoutWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(layoutWidth - before!.x - before!.width).toBeCloseTo(inset, 0);
    expect(viewport.height - before!.y - before!.height).toBeCloseTo(inset, 0);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    expect(await page.locator('#a11y-btn').boundingBox()).toEqual(before);
  }
});
