import { test, expect, type Page as BrowserPage, type APIRequestContext } from '@playwright/test';
import type { Content } from '@lzzhu/content';
import path from 'node:path';
import { newBlock } from '@lzzhu/content';

async function fixture(page: BrowserPage, request: APIRequestContext) {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  return {
    original,
    restore: async () => {
      await page.close();
      const current = (await (await request.get('/admin/api/content')).json()) as Content;
      const result = await request.put('/admin/api/content', {
        headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
        data: { content: original, expectedRevision: current.revision },
      });
      expect(result.ok(), await result.text()).toBe(true);
    },
  };
}
async function save(page: BrowserPage) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
}
async function add(page: BrowserPage, name: string) {
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp('^' + name) })
    .click();
}
async function remove(page: BrowserPage) {
  await page.getByRole('button', { name: 'Remove section', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove section', exact: true }).click();
}
test('MOD-01 institution upload, course fields, keyboard drag and deletion restore the original page', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Teaching', exact: true }).click();
    await add(page, 'Teaching institution');
    await page.getByLabel('Institution name', { exact: true }).fill('Sichuan University · test');
    await page
      .getByLabel('Upload image', { exact: true })
      .setInputFiles(path.resolve('assets/source/uva.jpg'));
    await expect(page.getByLabel('Image URL', { exact: true })).toHaveValue(/\/assets\/uploads\//);
    await page.getByRole('button', { name: 'Add course', exact: true }).click();
    await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2026');
    await page.getByRole('combobox', { name: 'Term', exact: true }).selectOption('Spring');
    await page.getByLabel('Course code', { exact: true }).fill('IE 5088');
    await page.getByLabel('Course name', { exact: true }).fill('Production Analysis');
    await page.getByLabel('Position', { exact: true }).fill('Lecturer');
    await page.getByLabel('Official resource link', { exact: true }).fill('https://github.com');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    // Collapse the inspector: handle-based keyboard sorting must work without editing text.
    await page.locator('.block-select').filter({ hasText: 'Sichuan University' }).click();
    const handle = page.getByRole('button', { name: /^Reorder Sichuan University/ });
    await handle.focus();
    await handle.press('Space');
    await handle.press('ArrowUp');
    await handle.press('Space');
    await expect(page.locator('.block-select').first()).toContainText('Sichuan University');
    await save(page);
    const frame = page.frameLocator('iframe[title="Page preview"]');
    await expect(frame.getByRole('link', { name: 'Course resources' })).toHaveAttribute(
      'href',
      'https://github.com',
    );
    const logo = frame.locator('.institution-logo img').first();
    expect(
      await logo.evaluate((img) => {
        const css = getComputedStyle(img);
        return [css.width, css.height, css.borderRadius];
      }),
    ).toEqual(['50px', '50px', '10px']);
    await page.locator('.block-select').first().click();
    await remove(page);
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(saved.pages.find((p) => p.id === 'teaching')!.blocks).toEqual(
      state.original.pages.find((p) => p.id === 'teaching')!.blocks,
    );
  } finally {
    await state.restore();
  }
});

test('MOD-02 complete research projects preserve alternating images and Markdown text through sorting and deletion', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await add(page, 'Research project');
    await page.getByLabel('Heading', { exact: true }).fill('Fictional modular research');
    for (let i = 1; i <= 2; i++) {
      await page.getByRole('button', { name: 'Add image', exact: true }).click();
      await page.getByLabel('Alternative text', { exact: true }).fill('Research figure ' + i);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.getByRole('button', { name: 'Add text', exact: true }).click();
      await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
      await page.getByRole('button', { name: 'Markdown', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Markdown editor' })
        .fill(`Description ${i} with **bold evidence** and [source](https://example.com).`);
      await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
      await page.getByRole('button', { name: 'Rich text', exact: true }).click();
      await expect(page.getByRole('textbox', { name: 'Content editor' }).locator('strong')).toHaveText(
        'bold evidence',
      );
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    }
    await page.getByLabel('Paper link', { exact: true }).fill('https://example.com/paper');
    const count = state.original.pages.find((p) => p.id === 'research')!.blocks.length;
    for (let i = 0; i < count; i++)
      await page.getByRole('button', { name: 'Move section up', exact: true }).click();
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const project = saved.pages.find((p) => p.id === 'research')!.blocks[0];
    expect(project.type).toBe('research');
    if (project.type === 'research') {
      expect(project.parts.map((part) => part.type)).toEqual(['image', 'text', 'image', 'text']);
      expect(project.paperUrl).toBe('https://example.com/paper');
    }
    await remove(page);
    await save(page);
    const restored = (await (await request.get('/admin/api/content')).json()) as Content;
    expect(restored.pages.find((p) => p.id === 'research')!.blocks).toEqual(
      state.original.pages.find((p) => p.id === 'research')!.blocks,
    );
  } finally {
    await state.restore();
  }
});

test('MOD-03 gallery, cross-page feed, hidden Past page and keyboard slideshow use the same Admin operations', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await add(page, 'Photo gallery');
    for (const name of ['Portrait', 'Research illustration']) {
      await page.getByRole('button', { name: 'Add photo', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
      await page.getByLabel('Alternative text', { exact: true }).fill(name);
      await page.getByRole('button', { name: 'Done', exact: true }).click();
    }
    await page.getByRole('checkbox', { name: 'Automatic slideshow', exact: true }).check();
    await page.getByRole('button', { name: 'Move section up', exact: true }).click();
    await page.getByRole('button', { name: 'Move section up', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Medium feed' }).click();
    await page.getByRole('button', { name: 'Move to page…', exact: true }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const dialog = page.getByRole('dialog');
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(
        await dialog.locator('.destination-list').evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
      expect((await dialog.getByRole('radio').first().boundingBox())!.width).toBeLessThanOrEqual(20);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('dialog').getByRole('radio', { name: 'Blog /archives/', exact: true }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Move section', exact: true }).click();
    await page.getByRole('button', { name: 'Pages', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Past');
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByLabel('Page address', { exact: true }).fill('/past/');
    await page.getByRole('combobox', { name: 'Visibility', exact: true }).selectOption('published');
    await page.getByRole('button', { name: 'Blog', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Article list' }).click();
    await page.getByRole('button', { name: 'Move to page…', exact: true }).click();
    await page.getByRole('dialog').getByRole('radio', { name: /Past/ }).check();
    await page.getByRole('dialog').getByRole('button', { name: 'Move section', exact: true }).click();
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const past = saved.pages.find((p) => p.path === '/past/')!;
    expect(past.status).toBe('published');
    expect(past.inNavigation).toBe(false);
    expect(past.blocks[0].type).toBe('archive');
    expect(saved.pages.find((p) => p.id === 'blog')!.blocks.map((b) => b.type)).toEqual(['medium']);
    expect(saved.pages.find((p) => p.id === 'media')!.blocks.map((b) => b.type)).toEqual([
      'gallery',
      'podcast',
    ]);
    await page.getByRole('button', { name: 'Past', exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="Page preview"]').getByRole('link', { name: 'PAST', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Media', exact: true }).click();
    await save(page);
    const frame = page.frameLocator('iframe[title="Page preview"]');
    await frame.getByRole('button', { name: 'Next photo', exact: true }).click();
    await expect(frame.locator('[data-gallery-slide]').nth(1)).toBeVisible();
    await expect(frame.locator('[data-gallery-slide]').first()).toBeHidden();
    expect(
      await frame
        .locator('[data-gallery-index] img')
        .first()
        .evaluate((img) => [getComputedStyle(img).height, getComputedStyle(img).objectFit]),
    ).toEqual(['40px', 'cover']);
    expect((await frame.locator('[data-gallery-index]').first().boundingBox())!.height).toBeLessThan(50);
    await frame.getByRole('button', { name: 'Pause slideshow', exact: true }).click();
    await expect(
      frame.getByRole('button', { name: 'Resume slideshow', exact: true }).locator('svg'),
    ).toHaveCount(1);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(
      frame.getByRole('button', { name: 'Slideshow paused for reduced motion', exact: true }),
    ).toBeDisabled();
  } finally {
    await state.restore();
  }
});

test('MOD-06 adjustable columns, one image entry, notebook scroll and canonical navigation', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    const divider = page.getByRole('separator', { name: 'Editor and preview width' });
    const before = (await page.locator('.inspector').boundingBox())!.width;
    await divider.focus();
    await divider.press('ArrowRight');
    expect((await page.locator('.inspector').boundingBox())!.width).toBeGreaterThan(before);
    const box = (await divider.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x - 60, box.y + 100, { steps: 5 });
    await page.mouse.up();
    const ratio = await divider.getAttribute('aria-valuenow');
    await page.getByRole('button', { name: 'Research', exact: true }).click();
    await expect(divider).toHaveAttribute('aria-valuenow', ratio!);
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await add(page, 'Text & headings');
    await expect(
      page.locator('.writing-paper').getByRole('button', { name: 'Image', exact: true }),
    ).toHaveCount(1);
    await expect(page.locator('.writing-paper input[type=file]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Choose formatting mode' }).click();
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    const source = page.getByRole('textbox', { name: 'Markdown editor' });
    await source.fill(Array.from({ length: 70 }, (_, i) => 'A carefully typeset line ' + i).join('\n\n'));
    expect(await source.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    const paper = page.locator('.note-paper-body');
    await paper.evaluate((el) => {
      el.scrollTop = 205;
    });
    expect(await paper.evaluate((el) => el.scrollTop)).toBeGreaterThan(200);
    expect(await source.evaluate((el) => getComputedStyle(el).fontFamily)).not.toMatch(/monospace|Consolas/);
    await page.getByRole('button', { name: 'Image', exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Upload a new image')).toBeVisible();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Cancel', exact: true })
      .count()
      .then(async (count) => {
        if (count)
          await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
        else await page.getByRole('dialog').getByRole('button', { name: 'Close dialog' }).click();
      });
    await save(page);
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page).toHaveURL(/#articles$/);
    await page.locator('.item-list .row-link').first().click();
    const articleUrl = page.url();
    await expect(page.locator('.breadcrumbs')).toContainText('Articles');
    await page.reload();
    await expect(page.locator('.breadcrumbs')).toContainText('Articles');
    await page.goBack();
    await expect(page).toHaveURL(/#articles$/);
    await expect(page.getByRole('heading', { name: 'Articles', exact: true }).first()).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(articleUrl);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(divider).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await state.restore();
  }
});

test('MOD-04 custom contact choices and shared logo are editable; compact Admin stays within the screen', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Site settings', exact: true }).click();
    for (const icon of ['twitter', 'instagram', 'wechat']) {
      await page.getByRole('button', { name: 'Add contact', exact: true }).click();
      await page.getByRole('combobox', { name: 'Icon', exact: true }).last().selectOption(icon);
    }
    await page.getByLabel('Image URL', { exact: true }).fill('/assets/avatar.jpg');
    await save(page);
    await expect(page.locator('.studio-brand')).toHaveAttribute('src', '/admin/assets/avatar.jpg');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(
      page.frameLocator('iframe[title="Page preview"]').locator('.navbar .site-logo'),
    ).toHaveAttribute('src', '/admin/assets/avatar.jpg');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByText('Website admin', { exact: true })).toBeVisible();
  } finally {
    await state.restore();
  }
});

test('MOD-05 notebook mode changes retain alignment, checklist state, underline, image and stable anchors', async ({
  page,
  request,
}) => {
  const state = await fixture(page, request);
  try {
    const content = structuredClone(state.original),
      block = newBlock('richText');
    if (block.type !== 'richText') throw new Error('Invalid fixture');
    block.document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2, id: 'stable-notebook-title' },
          content: [{ type: 'text', text: 'Notebook round trip' }],
        },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', text: 'Centered underline', marks: [{ type: 'underline' }, { type: 'bold' }] },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: true },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Completed task' }] }],
            },
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
        { type: 'image', attrs: { src: '/assets/avatar.jpg', alt: 'Portrait', title: 'Image title' } },
      ],
    };
    content.pages.find((p) => p.id === 'home')!.blocks.push(block);
    const { csrf } = await (await request.get('/admin/api/session')).json();
    const response = await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
      data: { content, expectedRevision: state.original.revision },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.locator('.block-select').filter({ hasText: 'Notebook round trip' }).click();
    await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    const source = page.getByRole('textbox', { name: 'Markdown editor', exact: true });
    const value = await source.inputValue();
    expect(value).toContain('text-align:center');
    expect(value).toContain('<u>');
    expect(value).toContain('[x]');
    await source.fill(value + '\n\nA final paragraph.');
    await page.getByRole('button', { name: 'Choose formatting mode', exact: true }).click();
    await page.getByRole('button', { name: 'Rich text', exact: true }).click();
    const editor = page.getByRole('textbox', { name: 'Content editor' });
    await expect(editor.locator('u')).toHaveText('Centered underline');
    await expect(editor.locator('input[type=checkbox]')).toBeChecked();
    await save(page);
    const saved = (await (await request.get('/admin/api/content')).json()) as Content;
    const json = JSON.stringify(
      saved.pages.find((p) => p.id === 'home')!.blocks.find((b) => b.id === block.id),
    );
    for (const marker of [
      'stable-notebook-title',
      'textAlign',
      'center',
      'underline',
      '"checked":true',
      '"start":7',
      '/assets/avatar.jpg',
      'Image title',
      'A final paragraph.',
    ])
      expect(json).toContain(marker);
  } finally {
    await state.restore();
  }
});
