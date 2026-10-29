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
  await page.locator('[data-card-login]').click();
  await expect(page.locator('[name="password"]')).toBeFocused();
  await page.locator('[name="password"]').fill('wrong');
  await page.locator('[data-card-password] button[type="submit"]').click();
  await expect(page.locator('[data-card-login-status]')).toContainText('密码不正确');
  await expect(page.locator('[name="password"]')).toHaveValue('');
  await page.locator('[name="password"]').fill('test-password');
  await page.locator('[data-card-password] button[type="submit"]').click();
  await expect(page.locator('[data-card-admin]')).toBeVisible();
  await page.locator('[name="remaining"]').fill('5');
  await page.locator('[data-card-balance] button').click();
  await expect(page.locator('[data-rewards-balance]')).toHaveText('5');
  await page.locator('[data-card-clear]').click();
  await page.locator('[data-card-clear-dialog] [data-card-cancel]').click();
  await expect(page.locator('[data-rewards-history] li')).toHaveCount(2);
  await page.locator('[data-card-clear]').click();
  await page.locator('[data-card-confirm-clear]').click();
  await expect(page.locator('[data-rewards-history] li')).toHaveCount(0);
  await expect(page.locator('[data-rewards-balance]')).toHaveText('5');
  await page.locator('[data-card-logout]').click();
  await expect(page.locator('[data-card-admin]')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-card-login]').click();
  const box = await page.locator('[data-card-password-dialog]').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-card-login]')).toBeFocused();
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
