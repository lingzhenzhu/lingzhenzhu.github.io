import { test, expect, request as independentRequest, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { selectOption } from './select-control';

async function preserveDraft(request: APIRequestContext) {
  const original = await (await request.get('/admin/api/content')).json();
  const cleanup = await independentRequest.newContext({ baseURL: 'http://127.0.0.1:4173' });
  return async () => {
    try {
      const { csrf } = await (await cleanup.get('/admin/api/session')).json();
      const current = await (await cleanup.get('/admin/api/content')).json();
      const result = await cleanup.put('/admin/api/content', {
        headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
        data: { content: original, expectedRevision: current.revision },
      });
      expect(result.ok()).toBe(true);
    } finally {
      await cleanup.dispose();
    }
  };
}
const screenshots = '.artifacts/admin-round3';
test.beforeAll(() => fs.mkdir(screenshots, { recursive: true }));

test('image upload uses shared buttons, aligns with the library and supports retrying the same file', async ({
  page,
  request,
}, info) => {
  const restore = await preserveDraft(request);
  let attempts = 0;
  await page.route('**/admin/api/assets', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    attempts++;
    await route.fulfill(
      attempts === 1
        ? { status: 503, json: { error: 'Upload unavailable. Try again.' } }
        : { json: { src: '/assets/avatar.jpg' } },
    );
  });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/#settings');
    const actions = page.locator('.image-field-actions');
    const upload = actions.getByRole('button', { name: 'Upload image', exact: true });
    await expect(upload).toHaveAttribute('data-glass', 'clear');
    await expect(actions.locator('input[type=file]')).toBeHidden();
    const library = await actions.getByRole('button', { name: 'Choose from image library' }).boundingBox();
    const target = await upload.boundingBox();
    expect(Math.abs(library!.y - target!.y)).toBeLessThan(1);
    expect(Math.abs(library!.height - target!.height)).toBeLessThan(1);
    for (let i = 0; i < 2; i++) {
      const chooser = page.waitForEvent('filechooser');
      await upload.click();
      await (await chooser).setFiles(path.resolve('assets/source/avatar.jpg'));
      if (i === 0) await expect(actions.getByRole('alert')).toContainText('Try again');
      else await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue('/assets/avatar.jpg');
    }
    expect(attempts).toBe(2);
    await expect(actions.getByRole('alert')).toHaveCount(0);
    await page.locator('.image-field').screenshot({ path: `${screenshots}/upload-${info.project.name}.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(upload).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page
      .locator('.image-field')
      .screenshot({ path: `${screenshots}/upload-phone-${info.project.name}.png` });
  } finally {
    await page.close();
    await restore();
  }
});

test('website link lives in the account menu with sign out and restores focus', async ({ page }, info) => {
  await page.goto('/admin/#settings');
  await expect(page.getByRole('link', { name: 'View website', exact: true })).toHaveCount(0);
  const account = page.getByRole('button', { name: 'Account', exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 390) await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await account.click();
    const menu = page.getByRole('dialog', { name: 'Account options' });
    await expect(menu.getByRole('link', { name: 'View website' })).toHaveAttribute('href', '/');
    await expect(menu.getByRole('link', { name: 'View website' })).toHaveAttribute('target', '_blank');
    await expect(menu.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(menu).toBeInViewport();
    await menu.screenshot({ path: `${screenshots}/account-${width}-${info.project.name}.png` });
    await page.keyboard.press('Escape');
    await expect(account).toBeFocused();
  }
});

test('search and filters are a mode of one article list; clearing and disabling restore the same list', async ({
  page,
  request,
}, info) => {
  const restore = await preserveDraft(request);
  try {
    await page.goto('/admin/#pages/blog');
    await page.locator('.block-select').filter({ hasText: 'Article list' }).click();
    const frame = page.frameLocator('iframe[title="Page preview"]');
    await expect(frame.locator('.archive-list')).toHaveCount(1);
    await expect(frame.locator('.archive-item')).toHaveCount(6);
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '2023');
    await page.getByRole('switch', { name: 'Search and filters' }).check();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(frame.locator('[data-article-search]')).toHaveCount(1);
    await expect(frame.locator('.archive-list')).toHaveCount(1);
    await expect(frame.locator('.archive-item')).toHaveCount(2);
    await frame.getByRole('searchbox', { name: 'Search full text' }).fill('Bong');
    await expect(frame.locator('.archive-item')).toHaveCount(1);
    await frame.getByRole('button', { name: 'Reset filters' }).click();
    await expect(frame.locator('.archive-item')).toHaveCount(2);
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(frame.locator('.archive-item')).toHaveCount(6);
    await selectOption(frame.getByRole('combobox', { name: 'Year', exact: true }), '2022');
    await expect(frame.locator('.archive-item')).toHaveCount(1);
    await frame.getByRole('searchbox', { name: 'Search full text' }).fill('Bong');
    await expect(frame.locator('.archive-item')).toHaveCount(0);
    await frame.getByRole('button', { name: 'Reset filters' }).click();
    await expect(frame.locator('.archive-item')).toHaveCount(6);
    await page.screenshot({ path: `${screenshots}/article-list-${info.project.name}.png` });
    await page.getByRole('switch', { name: 'Search and filters' }).uncheck();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    // Firefox's driver can lose this same-origin preview frame after it navigates, although the
    // new document has loaded (its network log and live DOM show it). Read the preview from the parent.
    const live = (selector: string) =>
      page.evaluate(
        (selector) =>
          document
            .querySelector<HTMLIFrameElement>('iframe[title="Page preview"]')!
            .contentDocument!.querySelectorAll(selector).length,
        selector,
      );
    await expect.poll(() => live('[data-article-search]')).toBe(0);
    await expect.poll(() => live('.archive-list')).toBe(1);
    await expect.poll(() => live('.archive-item')).toBe(6);
    await page.getByRole('button', { name: 'Add section', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add a section' });
    await expect(dialog.getByRole('button', { name: /Article list/ })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /Article search/ })).toHaveCount(0);
  } finally {
    await page.close();
    await restore();
  }
});
