import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Content } from '@lzzhu/content';

// These tests state the intended behavior. Failures are audit findings, not expected-failure passes.
test('AUD-01 long Unicode image names do not crash the image library', async ({ page, request }) => {
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const image = Buffer.concat([await readFile('assets/source/card.jpg'), Buffer.from('audit-unicode-name')]);
  const name = '个人艺术肖像高清照片'.repeat(5) + '.jpg';
  const response = await request.post('/admin/api/assets', {
    headers: {
      Origin: 'http://127.0.0.1:4173',
      'X-CSRF-Token': csrf,
      'X-Filename': encodeURIComponent(name),
    },
    data: image,
  });
  expect(response.ok()).toBe(true);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin/');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Image library', exact: true }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'Image library' })).toBeVisible();
});

test('AUD-02 upload rejects a truncated image before a release can include it', async ({ request }) => {
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const response = await request.post('/admin/api/assets', {
    headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf, 'X-Filename': 'broken.jpg' },
    data: Buffer.from([255, 216, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  });
  expect(response.status()).toBe(400);
});

test('AUD-03 deleting Blog keeps existing articles reachable in the editor', async ({ page, request }) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Blog', exact: true }).click();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete page', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete page', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Pages', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page.getByRole('button', { name: /Shadow City/ }).first()).toBeVisible();
  } finally {
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(
      (
        await request.put('/admin/api/content', {
          headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
          data: { content: original, expectedRevision: current.revision },
        })
      ).ok(),
    ).toBe(true);
  }
});

test('AUD-04 editing text retains existing heading anchors', async ({ page, request }) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf };
  const content = structuredClone(original);
  const research = content.pages.find((p) => p.id === 'research')!;
  research.blocks = [
    {
      id: 'audit-text',
      version: 1,
      type: 'richText',
      document: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, id: 'stable-section' },
            content: [{ type: 'text', text: 'Stable section' }],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Edit this paragraph.' }] },
        ],
      },
    },
  ];
  expect(
    (
      await request.put('/admin/api/content', {
        headers,
        data: { content, expectedRevision: original.revision },
      })
    ).ok(),
  ).toBe(true);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Text & headings' }).click();
    const editor = page.getByRole('textbox', { name: 'Content editor' });
    await editor.click();
    await editor.press('ControlOrMeta+End');
    await editor.pressSequentially(' Updated.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const block = saved.pages.find((p) => p.id === 'research')!.blocks[0];
    expect(block.type === 'richText' && block.document.content?.[0].attrs?.id).toBe('stable-section');
  } finally {
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(
      (
        await request.put('/admin/api/content', {
          headers,
          data: { content: original, expectedRevision: current.revision },
        })
      ).ok(),
    ).toBe(true);
  }
});
