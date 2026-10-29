import { test, expect, type Page as BrowserPage, type APIRequestContext } from '@playwright/test';
import type { Content, RichNode } from '@lzzhu/content';
import { readFile } from 'node:fs/promises';

const origin = 'http://127.0.0.1:4173';
async function setup(request: APIRequestContext, page: BrowserPage) {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: origin, 'X-CSRF-Token': csrf };
  const put = async (content: Content) => {
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    const response = await request.put('/admin/api/content', {
      headers,
      data: { content, expectedRevision: current.revision },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as Content;
  };
  return {
    original,
    put,
    restore: async () => {
      await page.close();
      await put(original);
    },
  };
}
async function save(page: BrowserPage) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
}
async function openHome(page: BrowserPage) {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
}

test('IND-01 rich text round trip retains supported marks, links, list starts and heading IDs', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  try {
    const doc: RichNode = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 3, id: 'stable-link' },
          content: [{ type: 'text', text: 'Stable heading' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Linked bold underline',
              marks: [
                { type: 'link', attrs: { href: '/research/#section' } },
                { type: 'bold' },
                { type: 'underline' },
              ],
            },
            { type: 'hardBreak' },
            { type: 'text', text: 'Second line' },
          ],
        },
        {
          type: 'orderedList',
          attrs: { start: 7 },
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Seventh item' }] }],
            },
          ],
        },
        { type: 'codeBlock', attrs: { language: 'js' }, content: [{ type: 'text', text: 'const x = 1;' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Tail' }] },
      ],
    };
    const content = structuredClone(fixture.original);
    content.pages.find((p) => p.id === 'home')!.blocks = [
      { id: 'ind-rich', version: 1, type: 'richText', document: doc },
    ];
    await fixture.put(content);
    await openHome(page);
    await page.locator('.block-select').filter({ hasText: 'Text & headings' }).click();
    const editor = page.getByRole('textbox', { name: 'Content editor' });
    await editor.click();
    await editor.press('Control+End');
    await editor.press('End');
    await editor.pressSequentially(' appended');
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const block = saved.pages.find((p) => p.id === 'home')!.blocks[0];
    expect(block.type).toBe('richText');
    const json = JSON.stringify(block);
    for (const marker of [
      'stable-link',
      'underline',
      '/research/#section',
      '"start":7',
      'const x = 1;',
      'Tail appended',
    ])
      expect(json).toContain(marker);
  } finally {
    await fixture.restore();
  }
});

test('IND-02 cancelling a slow revision restore must not overwrite later edits', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  let release: (() => void) | undefined;
  try {
    const older = structuredClone(fixture.original);
    older.settings.footer = 'OLDER REVISION';
    const revision = await fixture.put(older);
    await fixture.put(fixture.original);
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Review & publish' }).click();
    await page.getByRole('button', { name: 'Draft revisions', exact: true }).click();
    await page.route('**/admin/api/revisions/' + revision.revision, async (route) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ json: revision });
    });
    await page
      .locator('.history-row')
      .filter({ hasText: 'Revision ' + revision.revision })
      .getByRole('button', { name: 'Restore draft', exact: true })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Restore', exact: true }).click();
    await expect.poll(() => !!release).toBe(true);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Site settings', exact: true }).click();
    const footer = page.getByLabel('Footer', { exact: true });
    await footer.fill('NEW EDIT AFTER CANCELLING RESTORE');
    release!();
    release = undefined;
    await expect(footer).toHaveValue('NEW EDIT AFTER CANCELLING RESTORE');
    await page.waitForTimeout(250);
    await expect(footer).toHaveValue('NEW EDIT AFTER CANCELLING RESTORE');
  } finally {
    release?.();
    await fixture.restore();
  }
});

test('IND-03 an accepted external HTTPS image renders in the live preview', async ({ page, request }) => {
  const fixture = await setup(request, page);
  try {
    const content = structuredClone(fixture.original);
    content.pages.find((p) => p.id === 'home')!.blocks = [
      {
        id: 'ind-image',
        version: 1,
        type: 'image',
        src: 'https://images.example.org/audit.png',
        alt: 'Audit external image',
        width: 400,
        align: 'center',
        rounded: false,
      },
    ];
    await fixture.put(content);
    await page.route('https://images.example.org/audit.png', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/5kAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    await openHome(page);
    const image = page.frameLocator('iframe[title="Page preview"]').getByAltText('Audit external image');
    await expect(image).toBeAttached();
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.locator('.block-select').filter({ hasText: 'Image' }).click();
    const thumbnail = page.frameLocator('iframe.portrait-preview').getByAltText('Audit external image');
    await expect
      .poll(() => thumbnail.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  } finally {
    await fixture.restore();
  }
});

test('IND-05 unpublished rich text upload displays in editor without corrupting its saved public URL', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  try {
    const { csrf } = await (await request.get('/admin/api/session')).json();
    const response = await request.post('/admin/api/assets', {
      headers: {
        Origin: origin,
        'X-CSRF-Token': csrf,
        'X-Filename': 'independent-rich-image.jpg',
        'Content-Type': 'image/jpeg',
      },
      data: await readFile('assets/source/card.jpg'),
    });
    expect(response.ok(), await response.text()).toBe(true);
    const upload = await response.json();
    const content = structuredClone(fixture.original);
    content.pages.find((p) => p.id === 'home')!.blocks = [
      {
        id: 'ind-private-rich',
        version: 1,
        type: 'richText',
        document: {
          type: 'doc',
          content: [
            { type: 'image', attrs: { src: upload.src, alt: 'Private rich image' } },
            { type: 'paragraph', content: [{ type: 'text', text: 'Image caption' }] },
          ],
        },
      },
    ];
    await fixture.put(content);
    await openHome(page);
    await page.locator('.block-select').filter({ hasText: 'Text & headings' }).click();
    const image = page.getByRole('textbox', { name: 'Content editor' }).getByAltText('Private rich image');
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const editor = page.getByRole('textbox', { name: 'Content editor' });
    // A center click can select the image; Control+End does not move that
    // NodeSelection in WebKit. Explicitly edit the caption beside the image.
    await editor.getByText('Image caption', { exact: true }).click();
    await editor.press('End');
    await editor.pressSequentially(' changed');
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const block = saved.pages.find((p) => p.id === 'home')!.blocks[0];
    expect(JSON.stringify(block)).toContain(upload.src);
    expect(JSON.stringify(block)).not.toContain('/admin/api/assets/');
    expect(JSON.stringify(block)).toContain('Image caption changed');
  } finally {
    await fixture.restore();
  }
});

test('IND-04 published article with a cleared date remains discoverable in Blog', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  try {
    const content = structuredClone(fixture.original);
    const article = content.pages.find((p) => p.template === 'article')!;
    article.date = undefined;
    await fixture.put(content);
    const blog = content.pages.find((p) =>
      p.blocks.some((b) => b.type === 'archive' && !b.year && !b.month),
    )!;
    await page.goto('/admin/preview/' + blog.id);
    await expect(page.locator('.archive-item-link').filter({ hasText: article.title })).toBeVisible();
  } finally {
    await fixture.restore();
  }
});

test('IND-06 transient save failure retains the draft and manual retry commits it', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  let attempts = 0;
  try {
    await page.route('**/admin/api/content', (route) => {
      if (route.request().method() === 'PATCH') {
        attempts++;
        if (attempts === 1)
          return route.fulfill({ status: 503, json: { error: 'Independent temporary outage' } });
      }
      return route.continue();
    });
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Site settings', exact: true }).click();
    await page.getByLabel('Footer', { exact: true }).fill('RECOVERABLE OFFLINE EDIT');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Independent temporary outage');
    await expect(page.getByLabel('Footer', { exact: true })).toHaveValue('RECOVERABLE OFFLINE EDIT');
    // Let the pre-existing 1.2s debounce expire: a failed manual save must
    // pause that queued autosave as well, preserving an explicit retry.
    await page.waitForTimeout(1600);
    expect(attempts).toBe(1);
    await expect(page.getByText('Saving paused', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Try saving again', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.settings.footer).toBe('RECOVERABLE OFFLINE EDIT');
    expect(attempts).toBe(2);
  } finally {
    await fixture.restore();
  }
});

test('IND-07 link dialog is keyboard reachable in a reduced mobile viewport', async ({
  page,
  request,
  browserName,
}) => {
  const fixture = await setup(request, page);
  try {
    await page.setViewportSize({ width: 390, height: 420 });
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Text & headings' }).first().click();
    await page.getByRole('button', { name: 'More formatting', exact: true }).click();
    const link = page.getByRole('button', { name: 'Link', exact: true });
    // Pointer activation must also return focus to the explicit trigger in
    // WebKit, where a clicked button is not necessarily document.activeElement.
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Edit link' });
    await expect(dialog).toBeVisible();
    await test.info().attach('initial-dialog-focus', {
      body: await page.evaluate(() => document.activeElement?.outerHTML || ''),
      contentType: 'text/plain',
    });
    await page.screenshot({
      path: `.artifacts/independent-audit-2026-10-25/mobile-dialog-${browserName}.png`,
    });
    await expect(dialog.getByLabel('Link address', { exact: true })).toBeFocused();
    await dialog.getByLabel('Link address', { exact: true }).fill('/research/');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Apply link', exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
    await link.press('Enter');
    await expect(dialog.getByLabel('Link address', { exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(link).toBeFocused();
  } finally {
    await fixture.restore();
  }
});

test('IND-08 deleting a dialog trigger keeps keyboard focus in the surviving workspace', async ({
  page,
  request,
}) => {
  const fixture = await setup(request, page);
  try {
    await openHome(page);
    await page.getByRole('button', { name: 'News', exact: true }).click();
    await page.getByRole('button', { name: 'Add news', exact: true }).click();
    await page.getByRole('button', { name: 'Delete news', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete update', exact: true }).click();
    await expect(page.getByRole('main', { name: 'Home', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Content', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Portrait' }).click();
    await page.getByRole('button', { name: 'Remove section', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove section', exact: true }).click();
    await expect(page.getByRole('main', { name: 'Home', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await page.locator('.item-list').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Delete selected', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete items', exact: true }).click();
    await expect(page.getByRole('main', { name: 'Articles', exact: true })).toBeFocused();

    await page.getByRole('button', { name: 'Pages', exact: true }).click();
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete page', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete page', exact: true }).click();
    await expect(page.getByRole('main', { name: 'Pages', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('main'))).toBe(true);
    await save(page);
  } finally {
    await fixture.restore();
  }
});
