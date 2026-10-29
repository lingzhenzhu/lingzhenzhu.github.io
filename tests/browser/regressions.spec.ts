import { test, expect, type Page as BrowserPage, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Content } from '@lzzhu/content';

async function preserveDraft(request: APIRequestContext, page: BrowserPage) {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  return async () => {
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    const response = await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
      data: { content: original, expectedRevision: current.revision },
    });
    expect(response.ok()).toBe(true);
  };
}

test('image library selection updates the portrait without copying a URL', async ({ page, request }) => {
  const restore = await preserveDraft(request, page);
  try {
    const { csrf } = await (await request.get('/admin/api/session')).json();
    const response = await request.post('/admin/api/assets', {
      headers: {
        Origin: 'http://127.0.0.1:4173',
        'X-CSRF-Token': csrf,
        'X-Filename': 'Library-portrait.jpg',
      },
      data: Buffer.concat([await readFile('assets/source/card.jpg'), Buffer.from('library-selection-test')]),
    });
    expect(response.ok()).toBe(true);
    const uploaded = await response.json();
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Portrait' }).click();
    await page.getByRole('button', { name: 'Choose from image library' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Library-portrait.jpg' }).click();
    await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(uploaded.src);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  } finally {
    await restore();
  }
});

test('mobile sidebar confines keyboard navigation and restores focus when dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/');
  const toggle = page.getByRole('button', { name: 'Toggle sidebar' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Site structure', exact: true })).toBeFocused();
  expect(await page.locator('.editor-main').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: /View website/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  expect(await page.locator('.editor-main').evaluate((element) => (element as HTMLElement).inert)).toBe(
    false,
  );
});

test('page restoration restarts accessibility and navigation once on every return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.evaluate(() => {
    const list = document.querySelector('.news-list')!;
    for (let i = 0; i < 5; i++) list.appendChild(list.firstElementChild!.cloneNode(true));
  });
  await expect(page.locator('.news-toggle')).toBeEnabled();
  await page.locator('.news-toggle').click();
  for (let cycle = 0; cycle < 2; cycle++) {
    // Reproduce the lifecycle after the initial (non-persisted) pageshow event.
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.locator('.menu-toggle').click();
    await expect(page.locator('.news-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-menu')).not.toBeVisible();
    await page.locator('#a11y-btn').click();
    await expect(page.locator('#a11y-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#toggle-font-size').click();
    await expect(page.locator('body')).toHaveClass(/a11y-large-text/);
    await page.locator('#reset-a11y').click();
    await page.keyboard.press('Escape');
  }
});

test('opening upload preserves later text edits and respects a later image choice', async ({
  page,
  request,
}) => {
  const restore = await preserveDraft(request, page);
  let release: () => void = () => {};
  let received = false;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const uploaded = await request.post('/admin/api/assets', {
    headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
    data: await readFile('assets/source/card.jpg'),
  });
  expect(uploaded.ok()).toBe(true);
  const uploadResult = await uploaded.json();
  await page.route('**/admin/api/assets', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    // Delay a real uploaded asset's response. WebKit cannot replay File bodies via route.fetch().
    await new Promise<void>((resolve) => {
      release = resolve;
      received = true;
    });
    await route.fulfill({ json: uploadResult });
  });
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Opening', exact: true }).click();
    await page.getByLabel('Opening image', { exact: true }).selectOption('custom');
    await page.getByLabel('Upload opening portrait').setInputFiles(path.resolve('assets/source/card.jpg'));
    await expect.poll(() => received).toBe(true);
    await page.getByLabel('Chinese name', { exact: true }).fill('Supporting name edited during upload');
    await page
      .getByLabel('Alternative text', { exact: true })
      .fill('Portrait description edited during upload');
    release();
    await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(/^\/assets\/uploads\//);
    await expect(page.getByLabel('Chinese name', { exact: true })).toHaveValue(
      'Supporting name edited during upload',
    );
    await expect(page.getByLabel('Alternative text', { exact: true })).toHaveValue(
      'Portrait description edited during upload',
    );
    received = false;
    await page.getByLabel('Upload opening portrait').setInputFiles(path.resolve('assets/source/avatar.jpg'));
    await expect.poll(() => received).toBe(true);
    await page.getByLabel('Opening image', { exact: true }).selectOption('none');
    const refreshedAssets = page.waitForResponse(
      (response) => response.url().endsWith('/admin/api/assets') && response.request().method() === 'GET',
    );
    release();
    await refreshedAssets;
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Opening image', { exact: true })).toHaveValue('none');
  } finally {
    release();
    await restore();
  }
});

test('an expired session keeps the draft and confirmed reload prevents edits while waiting', async ({
  page,
  request,
}) => {
  const restore = await preserveDraft(request, page);
  let release: () => void = () => {};
  let holdReload = false,
    received = false;
  await page.route('**/admin/api/content', async (route) => {
    if (route.request().method() === 'PATCH')
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Sign in</h1>' });
    if (!holdReload) return route.continue();
    const response = await route.fetch();
    await new Promise<void>((resolve) => {
      release = resolve;
      received = true;
    });
    await route.fulfill({ response });
  });
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Opening', exact: true }).click();
    const originalName = await page.getByLabel('English name').inputValue();
    await page.getByLabel('English name').fill('Unsaved before session expiry');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Sign in at /admin/');
    await expect(page.getByLabel('English name')).toHaveValue('Unsaved before session expiry');
    holdReload = true;
    await page.getByRole('button', { name: 'Reload saved draft' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reload draft', exact: true }).click();
    await expect.poll(() => received).toBe(true);
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Reload draft', exact: true }),
    ).toBeDisabled();
    release();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('English name')).toHaveValue(originalName);
  } finally {
    release();
    await restore();
  }
});

test('preview device choices use the actual device viewport width', async ({ page }) => {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Research', exact: true }).click();
  const frame = page.frameLocator('iframe[title="Page preview"]');
  for (const [label, expected, height] of [
    ['Desktop', 1440, 900],
    ['Tablet', 768, 1024],
    ['Phone', 390, 844],
  ] as const) {
    await page.getByLabel('Preview size').selectOption({ label });
    await expect.poll(() => frame.locator('html').evaluate(() => window.innerWidth)).toBe(expected);
    await expect.poll(() => frame.locator('html').evaluate(() => window.innerHeight)).toBe(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('reloading after a concurrent edit updates both the form and preview', async ({ page, request }) => {
  const restore = await preserveDraft(request, page);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.getByRole('button', { name: 'Opening', exact: true }).click();
    const frame = page.frameLocator('iframe[title="Page preview"]');
    await expect(frame.locator('h1')).toHaveText('Lingzhen Zhu');
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    const { csrf } = await (await request.get('/admin/api/session')).json();
    current.pages.find((p) => p.id === 'home')!.title = 'Saved in another session';
    expect(
      (
        await request.put('/admin/api/content', {
          headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
          data: { content: current, expectedRevision: current.revision },
        })
      ).ok(),
    ).toBe(true);
    await page.getByLabel('English name').fill('Local conflicting edit');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('another session');
    await page.getByRole('button', { name: 'Reload saved draft' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Reload draft', exact: true }).click();
    await expect(page.getByLabel('English name')).toHaveValue('Saved in another session');
    await expect(frame.locator('h1')).toHaveText('Saved in another session');
  } finally {
    await restore();
  }
});
