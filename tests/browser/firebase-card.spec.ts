import { expect, test } from '@playwright/test';
import type { Content } from '@lzzhu/content';

test('Firebase card preserves public submission and password-only administration at desktop and mobile widths', async ({
  page,
}) => {
  let state = { remaining: 2, revision: 0, requests: [{ text: 'Original request' }] };
  let authenticated = false;
  await page.route('**/api/firebase-card**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    if (path.endsWith('/session')) {
      if (request.method() === 'POST') {
        if (body.password !== 'test-password')
          return route.fulfill({ status: 401, json: { error: '密码不正确或账号暂不可用' } });
        authenticated = true;
      }
      if (request.method() === 'DELETE') authenticated = false;
      return route.fulfill({ json: { authenticated } });
    }
    if (path.endsWith('/admin/balance')) {
      expect(authenticated).toBe(true);
      expect(body.expectedRevision).toBe(state.revision);
      state = { ...state, remaining: body.remaining, revision: state.revision + 1 };
    } else if (path.endsWith('/admin/requests')) {
      expect(authenticated).toBe(true);
      state = { ...state, requests: [], revision: state.revision + 1 };
    } else if (request.method() === 'POST') {
      state = {
        remaining: state.remaining - 1,
        revision: state.revision + 1,
        requests: [...state.requests, { text: body.request }],
      };
    }
    return route.fulfill({ json: state });
  });
  await page.goto('/woaidumuyibeizi/');
  await expect(page.locator('[data-rewards-balance]')).toHaveText('2');
  await page.locator('[name="request"]').fill('A public request');
  await page.locator('[data-rewards-form] button').click();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('1');
  await expect(page.locator('[data-rewards-history]')).toContainText('A public request');
  await expect(page.locator('[data-card-password]')).toBeVisible();
  await expect(page.locator('[data-card-password-dialog]')).toHaveCount(0);
  await expect(page.locator('[data-card-login]')).toHaveCSS('background-color', 'rgb(255, 152, 0)');
  await expect(page.locator('[data-card-login]')).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(page.locator('[data-rewards-form] button')).toHaveCSS('background-color', 'rgb(27, 94, 32)');
  await expect(page.locator('[data-rewards-form] button')).toHaveCSS('line-height', '18.4px');
  await page.locator('[name="password"]').fill('wrong');
  await page.locator('[data-card-password] button[type="submit"]').click();
  await expect(page.locator('[data-card-login-status]')).toContainText('密码不正确');
  await expect(page.locator('[name="password"]')).toHaveValue('');
  await page.locator('[name="password"]').fill('test-password');
  await page.locator('[data-card-password] button[type="submit"]').click();
  await expect(page.locator('[data-card-admin]')).toBeVisible();
  await expect(page.locator('[data-card-password]')).toBeHidden();
  await expect(page.locator('[data-card-action="increase"]')).toBeFocused();
  await page.locator('[data-card-action="increase"]').click();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('2');
  await page.locator('[data-card-action="decrease"]').click();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('1');
  await page.locator('[data-card-action="reset"]').click();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('2');
  for (const [selector, color] of [
    ['[data-card-action="increase"]', 'rgb(56, 142, 60)'],
    ['[data-card-action="decrease"]', 'rgb(211, 47, 47)'],
    ['[data-card-action="reset"]', 'rgb(25, 118, 210)'],
    ['[data-card-clear]', 'rgb(97, 97, 97)'],
  ])
    await expect(page.locator(selector)).toHaveCSS('background-color', color);
  await page.locator('[data-card-clear]').click();
  await page.locator('[data-card-clear-dialog] [data-card-cancel]').click();
  await expect(page.locator('[data-rewards-history] li')).toHaveCount(2);
  await page.locator('[data-card-clear]').click();
  await page.locator('[data-card-confirm-clear]').click();
  await expect(page.locator('[data-rewards-history] li')).toHaveCount(0);
  await expect(page.locator('[data-card-clear]')).toBeFocused();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('2');
  await page.locator('[data-card-logout]').click();
  await expect(page.locator('[data-card-admin]')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[name="password"]')).toBeFocused();
  await page.locator('[name="password"]').fill('test-password');
  await page.locator('[data-card-login]').click();
  await page.locator('[data-card-clear]').click();
  const box = await page.locator('[data-card-clear-dialog]').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-card-clear]')).toBeFocused();
  await page.locator('[data-card-logout]').click();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.locator('[data-card-password]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test('Admin can hide and restore the single Firebase card but cannot add, copy or remove it', async ({
  page,
  request,
}) => {
  await page.goto('/admin/#pages/request-card');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.locator('.block-select').filter({ hasText: 'Request card · Firebase' }).click();
  const editor = page.locator('.block-fields[data-module="firebaseRewards"]');
  const show = editor.getByLabel('Show this card');
  await expect(show).toBeChecked();
  await show.uncheck();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await expect(page.frameLocator('iframe[title="Page preview"]').locator('[data-rewards]')).toHaveCount(0);
  await page.reload();
  await page.locator('.block-select').filter({ hasText: 'Request card · Firebase' }).click();
  await expect(show).not.toBeChecked();
  await expect(editor.locator('..').getByRole('button', { name: 'Remove section', exact: true })).toHaveCount(
    0,
  );
  await show.check();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Page preview"]').locator('[data-provider="firebase"]'),
  ).toBeVisible();
  const previewLogin = page.frameLocator('iframe[title="Page preview"]').locator('[data-card-login]');
  await expect(previewLogin).toBeDisabled();
  await expect(previewLogin).toHaveCSS('opacity', '1');
  await expect(previewLogin).toHaveCSS('background-color', 'rgb(255, 152, 0)');
  await editor.locator('..').getByRole('button', { name: 'Move to page…' }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Copy to pages' })).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button').filter({ hasText: 'Request card · Firebase' }),
  ).toHaveCount(0);
  const content = (await (await request.get('/admin/api/content')).json()) as Content;
  const cards = content.pages.flatMap((p) => p.blocks).filter((b) => b.type === 'firebaseRewards');
  expect(cards).toHaveLength(1);
  expect(cards[0].hidden).toBe(false);
});
