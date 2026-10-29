import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { ContentSchema, type Content } from '@lzzhu/content';
import type { WorkspaceSnapshot, ChangeRequest } from '@lzzhu/content/resources';
import { largeWorkspace } from '../helpers/large-workspace';
async function fixture(request: APIRequestContext, page: Page) {
  const original = (await (await request.get('/admin/api/content')).json()) as WorkspaceSnapshot;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf };
  const replace = async (content: Content) => {
    const current = await (await request.get('/admin/api/content')).json();
    const response = await request.put('/admin/api/content', {
      headers,
      data: { content, expectedRevision: current.revision },
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  return {
    original,
    headers,
    replace,
    restore: async () => {
      await page.close();
      await replace(original);
    },
  };
}
test('large lists paginate; a lost save acknowledgement preserves in-flight typing and retries only once', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  const state = await fixture(request, page);
  let release = () => {},
    received = false;
  const requests: ChangeRequest[] = [];
  try {
    await state.replace(ContentSchema.parse(largeWorkspace(state.original)));
    await page.route('**/admin/api/content', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      requests.push(route.request().postDataJSON());
      if (requests.length === 1) {
        await route.fetch();
        received = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return route.abort('failed');
      }
      return route.continue();
    });
    const opened = Date.now();
    await page.goto('/admin/#articles');
    await expect(page.locator('.item-list .item-row')).toHaveCount(30);
    const listReadyMs = Date.now() - opened;
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.locator('.list-pagination')).toContainText('2 of');
    await page.getByRole('button', { name: 'Previous', exact: true }).click();
    await page.locator('.row-link').filter({ hasText: 'Scale article 0001' }).click();
    await expect(page.locator('.block-select')).toHaveCount(300);
    await page.goto('/admin/#articles');
    await page.locator('.row-link').filter({ hasText: 'Scale article 0000' }).click();
    await page.getByLabel('Title', { exact: true }).fill('First buffered edit');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => received).toBe(true);
    await page.getByLabel('Title', { exact: true }).fill('Typing during the slow save');
    release();
    await expect(page.getByText('Saving paused', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Typing during the slow save');
    await page.getByRole('button', { name: 'Try saving again', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible({ timeout: 20000 });
    expect(requests).toHaveLength(3);
    expect(requests[0].mutationId).toBe(requests[1].mutationId);
    expect(requests[2].mutationId).not.toBe(requests[1].mutationId);
    for (const value of requests) {
      expect(value.changes).toHaveLength(1);
      expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThan(5000);
    }
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.pages.find((p) => p.id === 'stress-0')?.title).toBe('Typing during the slow save');
    expect(saved.pages.find((p) => p.id === 'stress-1')?.title).toBe('Scale article 0001');
    expect(saved.revision).toBe(requests[0].baseRevision + 2);
    await info.attach('scale-metrics', {
      body: JSON.stringify({
        articles: 1000,
        listReadyMs,
        requestBytes: requests.map((r) => Buffer.byteLength(JSON.stringify(r))),
      }),
      contentType: 'application/json',
    });
    console.info(
      'BROWSER_SCALE',
      JSON.stringify({
        articles: 1000,
        sectionsOnOnePage: 300,
        listReadyMs,
        requestBytes: requests.map((r) => Buffer.byteLength(JSON.stringify(r))),
      }),
    );
  } finally {
    release();
    await state.restore();
  }
});
test('independent pages merge while same-page conflicts retain local text and use an accessible confirmation', async ({
  page,
  request,
}) => {
  const state = await fixture(request, page);
  try {
    await page.goto('/admin/#pages/research');
    await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
    const remote = async (id: string, title: string) => {
      const current = (await (await request.get('/admin/api/content')).json()) as WorkspaceSnapshot;
      const key = 'page:' + id;
      const response = await request.patch('/admin/api/content', {
        headers: state.headers,
        data: {
          mutationId: crypto.randomUUID(),
          baseRevision: current.revision,
          changes: [
            {
              key,
              expectedRevision: current.resourceVersions[key],
              value: { ...current.pages.find((p) => p.id === id)!, title },
            },
          ],
        },
      });
      expect(response.ok(), await response.text()).toBe(true);
    };
    await remote('teaching', 'Changed in another window');
    await page.getByLabel('Title', { exact: true }).fill('Independent research edit');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.pages.find((p) => p.id === 'teaching')?.title).toBe('Changed in another window');
    await remote('research', 'Remote research edit');
    await page.getByLabel('Title', { exact: true }).fill('Local research kept');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('changed in another session');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Local research kept');
    await page.getByRole('button', { name: 'Reload saved draft', exact: true }).click();
    const cancel = page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true });
    await expect(cancel).toBeFocused();
    await cancel.click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Local research kept');
  } finally {
    await state.restore();
  }
});
test('shared content lists its affected pages and common actions use the same compact rule', async ({
  page,
}) => {
  await page.goto('/admin/#pages/home');
  await page.getByRole('button', { name: 'News', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Shared content' })).toContainText('Home');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['Save', 'Review & publish']) {
    const button = page.getByRole('button', { name, exact: true });
    await expect(button.locator('svg')).toBeHidden();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(
    page.getByRole('button', { name: 'Toggle sidebar', exact: true }).locator('svg'),
  ).toBeVisible();
});
test('concurrent page additions during a slow save keep local work intact and require reload before another save', async ({
  page,
  request,
}) => {
  const state = await fixture(request, page);
  let release = () => {},
    waiting = false,
    saves = 0;
  try {
    await page.goto('/admin/#pages/research');
    await expect(page.getByLabel('Title', { exact: true })).toBeVisible();
    await page.route('**/admin/api/content', async (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      saves++;
      if (saves === 1) {
        waiting = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.continue();
    });
    await page.getByLabel('Title', { exact: true }).fill('Research saved during concurrent additions');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => waiting).toBe(true);
    const remote = {
      ...state.original.pages[0],
      id: 'remote-added',
      path: '/remote-added/',
      template: 'page',
      title: 'Remote page',
      inNavigation: false,
    };
    const response = await request.patch('/admin/api/content', {
      headers: state.headers,
      data: {
        mutationId: crypto.randomUUID(),
        baseRevision: state.original.revision,
        changes: [
          {
            key: 'page:remote-added',
            expectedRevision: state.original.resourceVersions['page:remote-added'] ?? null,
            value: remote,
          },
          {
            key: 'pageOrder',
            expectedRevision: state.original.resourceVersions.pageOrder,
            value: [...state.original.pages.map((item) => item.id), remote.id],
          },
        ],
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await page.getByRole('button', { name: 'Pages', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('My pending page');
    release();
    await expect(page.getByRole('alert')).toContainText('changed in another session');
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('My pending page');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Saving paused', { exact: true })).toBeVisible();
    expect(saves).toBe(1);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.pages.some((item) => item.id === 'remote-added')).toBe(true);
    expect(saved.pages.some((item) => item.title === 'My pending page')).toBe(false);
    expect(saved.pages.find((item) => item.id === 'research')?.title).toBe(
      'Research saved during concurrent additions',
    );
  } finally {
    release();
    await state.restore();
  }
});
test('Markdown adapter preserves supported semantics through repeated round trips and a long document', async ({
  page,
  request,
}, info) => {
  const state = await fixture(request, page);
  try {
    await page.goto('/admin/#pages/home');
    await page.locator('.block-select').filter({ hasText: 'Text & headings' }).first().click();
    await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    const source = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
    const text =
      '## A stable heading\n\n**Bold** and *italic*, ~~strike~~, <u>underline</u>, 中文 Ω.\n\n[Reference](https://example.com)\n\n> Quotation\n\n- First\n- Second\n\n1. Ordered\n2. List\n\n- [x] Done\n- [ ] Pending\n\n' +
      '\x60\x60\x60ts\nconst value = 1;\n\x60\x60\x60\n\n' +
      'A long paragraph with measured spacing. '.repeat(2000);
    const started = Date.now();
    await source.fill(text);
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
      await page.getByRole('button', { name: 'Rich text', exact: true }).click();
      const editor = page.getByRole('textbox', { name: 'Content editor', exact: true });
      await expect(editor.locator('h2')).toContainText('A stable heading');
      await expect(editor.locator('strong')).toContainText('Bold');
      await expect(editor.locator('u')).toContainText('underline');
      await expect(editor.locator('a[href="https://example.com"]')).toContainText('Reference');
      await expect(editor.getByRole('checkbox')).toHaveCount(2);
      await expect(
        editor.getByRole('checkbox', { name: 'Task item checkbox for Done', exact: true }),
      ).toBeChecked();
      await expect(
        editor.getByRole('checkbox', { name: 'Task item checkbox for Pending', exact: true }),
      ).not.toBeChecked();
      await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
      await page.getByRole('button', { name: 'Markdown', exact: true }).click();
      const canonical = await source.inputValue();
      await source.fill(canonical + '\n');
    }
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    await info.attach('long-document-metrics', {
      body: JSON.stringify({ characters: text.length, threeRoundTripsMs: Date.now() - started }),
      contentType: 'application/json',
    });
    console.info(
      'MARKDOWN_ROUNDTRIP',
      JSON.stringify({ characters: text.length, threeRoundTripsMs: Date.now() - started }),
    );
  } finally {
    await state.restore();
  }
});
