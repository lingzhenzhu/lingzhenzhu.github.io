import { test, expect, type APIRequestContext } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import type { Content } from '@lzzhu/content';
const origin = 'http://127.0.0.1:4173';
async function credentials(request: APIRequestContext) {
  const session = await (await request.get('/admin/api/session')).json();
  return { Origin: origin, 'X-CSRF-Token': session.csrf };
}
test('visual editor creates, previews and removes a real persisted page', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/admin/');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const previewLogo = page.frameLocator('iframe[title="Page preview"]').locator('.navbar .site-logo');
  await expect(previewLogo).toHaveAttribute('src', '/admin/assets/logo.svg');
  await expect
    .poll(() => previewLogo.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const privateFont = await request.get('/admin/fonts/lanting.woff2');
  expect(privateFont.ok()).toBe(true);
  expect(privateFont.headers()['cache-control']).toContain('no-store');
  expect(privateFont.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
  await page.getByRole('button', { name: 'Pages', exact: true }).first().click();
  await page.getByRole('button', { name: 'Add page', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Editable draft');
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  await page.getByLabel('Page address', { exact: true }).fill('/editor-test/');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.locator('.block-select').filter({ hasText: 'Text & headings' }).click();
  await page.getByRole('textbox', { name: 'Content editor' }).fill('Visible content from the editor.');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const content = (await (await request.get('/admin/api/content')).json()) as Content;
  const saved = content.pages.find((p) => p.path === '/editor-test/')!;
  expect(saved.title).toBe('Editable draft');
  await expect(
    page.frameLocator('iframe[title="Page preview"]').getByText('Visible content from the editor.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  await page.getByRole('button', { name: 'Delete page', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete page', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('editor API rejects cross-origin writes and detects concurrent edits', async ({ request }) => {
  const headers = await credentials(request);
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const payload = { content: original, expectedRevision: original.revision };
  expect(
    (
      await request.put('/admin/api/content', {
        headers: { ...headers, Origin: 'https://attacker.example' },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  expect(
    (await request.put('/admin/api/content', { headers: { Origin: origin }, data: payload })).status(),
  ).toBe(403);
  expect((await request.put('/admin/api/content', { headers, data: payload })).status()).toBe(200);
  expect((await request.put('/admin/api/content', { headers, data: payload })).status()).toBe(409);
});
test('homepage portrait can be uploaded, saved and previewed through Admin', async ({ page, request }) => {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const headers = await credentials(request);
  await page.goto('/admin/');
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.locator('.block-select').filter({ hasText: 'Portrait' }).click();
  await page
    .getByLabel('Upload image', { exact: true })
    .setInputFiles(path.resolve('assets/source/card.jpg'));
  await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(
    /^\/assets\/uploads\/[a-f0-9]{64}\.jpg$/,
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  const current = (await (await request.get('/admin/api/content')).json()) as Content;
  const portrait = current.pages.find((p) => p.id === 'home')!.blocks.find((b) => b.type === 'profile')!;
  expect(portrait.type === 'profile' && portrait.src.startsWith('/assets/uploads/')).toBe(true);
  const image = page.frameLocator('iframe[title="Page preview"]').locator('.avatar img');
  await expect(image).toHaveAttribute('src', /^\/admin\/api\/assets\//);
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await request.put('/admin/api/content', {
    headers,
    data: { content: original, expectedRevision: current.revision },
  });
});
test('publication freezes content, prevents races and stores a verified artifact', async ({ request }) => {
  const headers = await credentials(request);
  const content = (await (await request.get('/admin/api/content')).json()) as Content;
  const created = await request.post('/admin/api/releases', {
    headers,
    data: { expectedRevision: content.revision },
  });
  expect(created.status()).toBe(201);
  const { id } = await created.json();
  try {
    const frozen = await (await request.get('/admin/api/releases/' + id + '/snapshot')).json();
    expect(createHash('sha256').update(frozen.snapshot).digest('hex')).toBe(frozen.manifest.snapshotHash);
    expect(JSON.parse(frozen.snapshot).pages.every((p: { status: string }) => p.status === 'published')).toBe(
      true,
    );
    expect(
      (
        await request.post('/admin/api/releases', { headers, data: { expectedRevision: content.revision } })
      ).status(),
    ).toBe(409);
    expect(
      (
        await request.post('/admin/api/releases/' + id + '/claim', { headers, data: { runId: '123456' } })
      ).status(),
    ).toBe(200);
    const artifact = Buffer.from('test-only artifact integrity boundary');
    expect(
      (
        await request.put('/admin/api/releases/' + id + '/artifact', {
          headers: { ...headers, 'X-Run-Id': '123456', 'X-Artifact-SHA256': 'wrong' },
          data: artifact,
        })
      ).status(),
    ).toBe(400);
    const sha = createHash('sha256').update(artifact).digest('hex');
    expect(
      (
        await request.put('/admin/api/releases/' + id + '/artifact', {
          headers: { ...headers, 'X-Run-Id': '123456', 'X-Artifact-SHA256': sha },
          data: artifact,
        })
      ).status(),
    ).toBe(200);
    const retrieved = await request.get('/admin/api/releases/' + id + '/artifact');
    expect(
      createHash('sha256')
        .update(await retrieved.body())
        .digest('hex'),
    ).toBe(sha);
    expect(
      (await request.post('/admin/api/releases/' + id + '/rollback', { headers, data: {} })).status(),
    ).toBe(400);
  } finally {
    await request.post('/admin/api/releases/' + id + '/report', {
      headers,
      data: { runId: '123456', stage: 'failed', error: 'End of isolated local test' },
    });
  }
});

test('backend diagnostics remain private and report the configured local bindings', async ({ request }) => {
  const response = await request.get('/admin/api/health');
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('private, no-store');
  expect(await response.json()).toMatchObject({
    environment: 'local',
    database: true,
    privateStorage: true,
    imageDecoder: true,
  });
});
test('request balance cannot be overspent and duplicate retries do not charge twice', async ({ request }) => {
  const headers = await credentials(request);
  const initial = await (await request.get('/admin/api/rewards')).json();
  await request.put('/admin/api/rewards', {
    headers,
    data: { remaining: 1, expectedRevision: initial.revision },
  });
  const first = { id: randomUUID(), request: 'First request' };
  const second = { id: randomUUID(), request: 'Second request' };
  const responses = await Promise.all(
    [first, second].map((data) => request.post('/api/rewards', { headers: { Origin: origin }, data })),
  );
  expect(responses.map((r) => r.status()).sort()).toEqual([201, 409]);
  const accepted = responses[0].status() === 201 ? first : second;
  expect((await request.post('/api/rewards', { headers: { Origin: origin }, data: accepted })).status()).toBe(
    200,
  );
  expect((await (await request.get('/api/rewards')).json()).remaining).toBe(0);
  await request.delete('/admin/api/rewards/requests', { headers });
});
