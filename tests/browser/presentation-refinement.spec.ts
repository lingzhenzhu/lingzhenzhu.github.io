import { type Locator } from '@playwright/test';
import { test, expect } from '../fixtures';
import { newBlock, type Content } from '@lzzhu/content';

// WebKit scrolls the document to reveal focused thumbnails. Measure layout in document coordinates.
const documentBox = (locator: Locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
  });

test('opening has a large-screen height cap and a finite, optional invitation animation', async ({
  page,
}) => {
  // Capture the short real CSS animation before slow browser-driver round trips can outlast it.
  await page.addInitScript(() => {
    document.addEventListener(
      'animationstart',
      (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.matches('.explore-cue'))
          target.getAnimations().forEach((animation) => animation.pause());
      },
      true,
    );
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 3840, height: 2160 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const hero = await page.locator('.home-opening').boundingBox();
    expect(hero!.height).toBeLessThanOrEqual(640);
    expect(hero!.y + hero!.height).toBeLessThan(viewport.height - 40);
    const cue = await page.locator('.explore-cue').boundingBox();
    expect(cue!.y + cue!.height).toBeLessThan(hero!.y + hero!.height);
  }
  await expect(page.locator('.explore-cue')).toHaveAttribute('data-inviting', '');
  const animation = await page.locator('.explore-cue').evaluate((el) => {
    const css = getComputedStyle(el);
    return { duration: parseFloat(css.animationDuration), repeats: Number(css.animationIterationCount) };
  });
  expect(animation.duration * animation.repeats).toBeLessThanOrEqual(5);
  const colors = await page.locator('.explore-cue').evaluate((el) => {
    const animation = el.getAnimations()[0];
    animation.pause();
    animation.currentTime = 0;
    const bright = getComputedStyle(el).color;
    animation.currentTime = 1200;
    const dim = getComputedStyle(el).color;
    animation.currentTime = 4800;
    return { bright, dim, end: getComputedStyle(el).color };
  });
  expect(colors.bright).not.toBe(colors.dim);
  expect(colors.end).toBe(colors.bright);
  await expect(page.locator('.name-note')).toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.explore-cue')).toHaveCSS('animation-name', 'none');
  await page.getByRole('link', { name: 'Explore more' }).click();
  await expect(page).toHaveURL(/#page-content$/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1440, height: 240 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.explore-cue')).not.toHaveAttribute('data-inviting');
  await page.locator('.explore-cue').scrollIntoViewIfNeeded();
  await expect(page.locator('.explore-cue')).toHaveAttribute('data-inviting', '');
});

test('the Chinese name does not swap or animate when its font arrives late', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/assets/fonts/lanting-name-*.woff2', async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Beyond font-display:optional's short block period; exercise a genuinely slow first visit.
    await page.waitForTimeout(250);
    const name = page.locator('.name-note');
    const before = await name.boundingBox();
    await expect(name).toHaveCSS('opacity', '1');
    await expect(name).toHaveCSS('animation-name', 'none');
    release();
    await page.evaluate(() => document.fonts.ready);
    expect(await name.boundingBox()).toEqual(before);
  } finally {
    release();
  }
});

test('untitled card retains a semantic heading without a visible title border or space', async ({ page }) => {
  await page.route('**/api/firebase-card**', (route) =>
    route.fulfill({ json: { remaining: 2, revision: 0, requests: [], authenticated: false } }),
  );
  await page.goto('/woaidumuyibeizi/');
  const heading = page.locator('h1');
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveCSS('border-bottom-width', '0px');
  expect((await heading.boundingBox())!.height).toBeLessThanOrEqual(1);
  await expect(page.locator('link[href^="/assets/card-fonts.css"]')).toHaveCount(1);
  await expect(page.locator('[data-provider="firebase"]')).toHaveCSS('font-family', /Microsoft JhengHei/);
  // Verify the cross-platform fallback covers Chinese that can arrive after a static publication.
  const loaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('16px "Noto Sans TC"', '申请记录简体测试');
    return faces.length > 0 && faces.every((face) => face.status === 'loaded');
  });
  expect(loaded).toBe(true);
  await page.goto('/');
  await expect(page.locator('link[href^="/assets/card-fonts.css"]')).toHaveCount(0);
});

test('gallery reserves caption height and aligns the count on the right, including empty captions', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf };
  const content = structuredClone(original);
  content.pages.find((item) => item.id === 'media')!.blocks = [
    {
      ...newBlock('gallery'),
      type: 'gallery',
      title: 'Selected moments',
      autoplay: false,
      interval: 7000,
      photos: [
        { id: 'one', src: '/assets/avatar.jpg', alt: 'Portrait', caption: 'An afternoon in the city.' },
        { id: 'two', src: '/assets/avatar.jpg', alt: 'Portrait without a caption', caption: '' },
        {
          id: 'three',
          src: '/assets/avatar.jpg',
          alt: 'Long caption',
          caption:
            'A longer description of an afternoon in the city, with enough words to wrap naturally on a narrow phone without clipping the text.',
        },
      ],
    },
  ];
  try {
    const saved = await request.put('/admin/api/content', {
      headers,
      data: { content, expectedRevision: original.revision },
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/admin/preview/media');
      await page.evaluate(() => document.fonts.ready);
      const footer = await documentBox(page.locator('.gallery-footer'));
      const controls = await documentBox(page.locator('.gallery-tools'));
      const caption = await documentBox(page.locator('.gallery-description'));
      const count = await documentBox(page.locator('[data-gallery-count]'));
      expect(caption!.x).toBe(footer!.x);
      expect(count!.x + count!.width).toBeCloseTo(footer!.x + footer!.width, 0);
      for (const index of [1, 2, 0]) {
        await page.locator('[data-gallery-index]').nth(index).click();
        await expect(page.locator('[data-gallery-caption][aria-hidden="false"]')).toHaveCount(1);
        expect(await documentBox(page.locator('.gallery-footer'))).toEqual(footer);
        expect(await documentBox(page.locator('.gallery-tools'))).toEqual(controls);
      }
      const galleryFont = await page.locator('.photo-gallery h2').evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.fontFamily, s.fontSize, s.fontWeight, s.fontStyle];
      });
      await page.goto('/');
      const homeFont = await page.locator('.news-toggle strong').evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.fontFamily, s.fontSize, s.fontWeight, s.fontStyle];
      });
      expect(galleryFont).toEqual(homeFont);
    }
  } finally {
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    const restored = await request.put('/admin/api/content', {
      headers,
      data: { content: original, expectedRevision: current.revision },
    });
    expect(restored.ok()).toBe(true);
  }
});
