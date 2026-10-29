import { test, expect } from '@playwright/test';
import type { Content } from '@lzzhu/content';
test('News uses list, detail, multiple selection, confirmation and undo', async ({ page, request }) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const session = await (await request.get('/admin/api/session')).json();
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'News', exact: true }).click();
    await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0);
    for (const text of ['Workflow news one', 'Workflow news two']) {
      await page.getByRole('button', { name: 'Add news', exact: true }).click();
      await page.getByLabel('Message', { exact: true }).fill(text);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    }
    await page.getByLabel('Search news').fill('Workflow news');
    await expect(page.locator('.item-row')).toHaveCount(2);
    await page.getByLabel('Select all news', { exact: true }).check();
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.item-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete updates' }).click();
    await expect(page.locator('.item-row')).toHaveCount(0);
    await page.getByRole('button', { name: 'Undo change', exact: true }).click();
    await expect(page.locator('.item-row')).toHaveCount(2);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.news.filter((n) => n.text.startsWith('Workflow news'))).toHaveLength(2);
  } finally {
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': session.csrf },
      data: { content: original, expectedRevision: current.revision },
    });
  }
});
test('Blog contains articles, publishing is separate, and mobile workspace stays usable', async ({
  page,
}) => {
  await page.goto('/admin/');
  await expect(page.locator('.sidebar-pages button')).toHaveCount(6);
  await expect(page.locator('.sidebar-pages')).not.toContainText('Shadow City');
  await page.getByRole('button', { name: 'Blog', exact: true }).click();
  await page.locator('.block-select').filter({ hasText: 'Article list' }).click();
  await page.getByRole('button', { name: 'Manage articles', exact: true }).click();
  await expect(page.locator('.item-row')).toHaveCount(6);
  await page.getByRole('button', { name: /Shadow City/ }).click();
  await expect(page.locator('.breadcrumbs')).toContainText('Articles');
  await page.getByRole('button', { name: 'Review & publish' }).click();
  await expect(page.getByRole('heading', { name: 'Publishing', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create snapshot' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Opening', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('optional homepage image moves the existing portrait into the opening without duplicating it', async ({
  page,
  request,
}) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const session = await (await request.get('/admin/api/session')).json();
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Opening', exact: true }).click();
    await expect(page.getByLabel('Opening image', { exact: true })).toHaveValue('none');
    await page.getByLabel('Opening image', { exact: true }).selectOption('profile');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    const frame = page.frameLocator('iframe[title="Page preview"]');
    await expect(frame.locator('.opening-portrait img')).toHaveCount(1);
    await expect(frame.locator('.home-profile')).toHaveCount(0);
  } finally {
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': session.csrf },
      data: { content: original, expectedRevision: current.revision },
    });
  }
});
test('Media checks on every visit, renders safe text, and falls back for missing or broken covers', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/medium', (route) => {
    calls++;
    return route.fulfill({
      json: {
        entries: [
          {
            id: 'one',
            title: 'A new story <script>window.bad=true</script>',
            url: 'https://medium.com/@lzzhu718/new-story',
            publishedAt: '2026-10-24T00:00:00.000Z',
            hidden: false,
          },
          {
            id: 'two',
            title: 'Broken cover',
            url: 'https://medium.com/@lzzhu718/second-story',
            publishedAt: '2026-10-23T00:00:00.000Z',
            hidden: false,
            cover: 'https://miro.medium.com/broken.jpg',
          },
        ],
      },
    });
  });
  await page.route('https://miro.medium.com/broken.jpg', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/media/');
  await expect(page.locator('.medium-card')).toHaveCount(2);
  expect(calls).toBe(1);
  await expect(page.locator('.medium-card').first().locator('h3')).toContainText('<script>');
  expect(await page.locator('.medium-card script').count()).toBe(0);
  await page.locator('.medium-card').last().scrollIntoViewIfNeeded();
  for (const image of await page.locator('[data-medium-cover]').all())
    await expect(image).toHaveAttribute('src', '/assets/medium-fallback.svg');
  await expect(page.locator('.wordmark-light')).toHaveAttribute('src', '/assets/medium-wordmark-black.svg');
  await page.reload();
  await expect.poll(() => calls).toBe(2);
});
test('desktop and mobile navigation share typography and the open menu sits above the hero', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const typography = () =>
    page
      .locator('.navbar .menu-item')
      .first()
      .evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.fontFamily, s.fontWeight, s.color];
      });
  const desktop = await typography();
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = await page.locator('.menu-toggle').evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.fontFamily, s.fontWeight, s.color];
  });
  expect(toggle).toEqual(desktop);
  await page.locator('.menu-toggle').click();
  const link = page.locator('#mobile-menu .menu-item').first();
  expect(
    await link.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
});
