import { selectOption } from './select-control';
import { request as independentRequest, type APIRequestContext, type Page as BrowserPage } from '@playwright/test';
import { test, expect } from '../fixtures';
import { ContentSchema, newBlock, PageSchema, type Content } from '@lzzhu/content';
import fs from 'node:fs/promises';
import axe from 'axe-core';

const articleId = 'article-editor-test';
const searchId = 'article-search-test';
const source =
  'A formula $E = mc^2$ in text.\n\n$$\n\\frac{a}{b} + \\sqrt{x}\n$$\n\n```javascript\nconst total = 42;\nconsole.log("<tag>");\n```';
async function fixture(request: APIRequestContext, page: BrowserPage) {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const headers = { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf };
  const article = PageSchema.parse({
    id: articleId,
    path: '/writing/editor-test/',
    title: 'Field notes',
    template: 'article',
    status: 'published',
    date: '2026-10-31',
    articleDetails: { tags: ['Research'] },
    blocks: [
      {
        ...newBlock('richText'),
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A quiet place to write. Full text needle: quartzneedle472.' }],
            },
          ],
        },
      },
    ],
  });
  const search = PageSchema.parse({
    id: searchId,
    path: '/search-test/',
    title: 'Archive',
    status: 'published',
    blocks: [{ ...newBlock('articleSearch'), pageSize: 5 }],
  });
  const data = ContentSchema.parse({
    ...original,
    pages: [
      ...original.pages.filter((p) => !p.id.startsWith(articleId) && p.id !== searchId),
      article,
      search,
      {
        ...article,
        id: articleId + '-older',
        path: '/older-test/',
        title: 'Older notes',
        date: '2021-01-01',
        blocks: [],
        articleDetails: { tags: [] },
      },
      { ...article, id: articleId + '-draft', path: '/draft-test/', status: 'draft', title: 'Hidden needle' },
    ],
  });
  const response = await request.put('/admin/api/content', {
    headers,
    data: { content: data, expectedRevision: original.revision },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const cleanup = await independentRequest.newContext({ baseURL: 'http://127.0.0.1:4173' });
  return async () => {
    await page.close();
    const current = (await (await cleanup.get('/admin/api/content')).json()) as Content;
    const restored = await cleanup.put('/admin/api/content', {
      headers,
      data: { content: original, expectedRevision: current.revision },
    });
    expect(restored.ok()).toBe(true);
    await cleanup.dispose();
  };
}
async function save(page: BrowserPage) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
}
async function mode(page: BrowserPage, name: 'Markdown' | 'Rich text') {
  await page.getByRole('button', { name: 'Choose formatting mode' }).click();
  await page.getByRole('button', { name, exact: true }).click();
}
test('article dates, default author, preset license and tags persist and render', async ({
  page,
  request,
}) => {
  const restore = await fixture(request, page);
  try {
    await page.goto('/admin/#pages/' + articleId);
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await selectOption(page.getByRole('combobox', { name: 'Published display', exact: true }), 'hidden');
    await selectOption(page.getByRole('combobox', { name: 'Updated display', exact: true }), 'datetime');
    await page.getByLabel('Updated date').fill('2026-11-01');
    await page.getByLabel('Updated time').fill('13:45');
    await page.getByLabel('Author', { exact: true }).fill('Guest author');
    await page.getByLabel('Show license', { exact: true }).check();
    await selectOption(page.getByRole('combobox', { name: 'License', exact: true }), 'cc-by-4.0');
    await page.getByLabel('New tag').fill('Methods');
    await page.getByRole('button', { name: 'Add tag', exact: true }).click();
    await save(page);
    await page.reload();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await expect(page.getByLabel('Author', { exact: true })).toHaveValue('Guest author');
    await page.goto('/admin/preview/' + articleId);
    await expect(page.locator('.post-meta')).toContainText('Updated');
    await expect(page.locator('.post-meta')).not.toContainText('Published');
    await expect(page.locator('.post-meta')).not.toContainText('Author');
    await expect(page.locator('.post-meta time')).toHaveAttribute('datetime', '2026-11-01T13:45');
    await expect(page.locator('.post-copyright')).toContainText('Guest author');
    await expect(page.getByRole('link', { name: 'CC BY 4.0', exact: true })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by/4.0/',
    );
    await expect(page.getByText('Permalink:', { exact: false })).toHaveCount(0);
    await expect(page.locator('.article-tags')).toContainText('Methods');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  } finally {
    await restore();
  }
});
test('formula and code editing preserve Markdown, support keyboard editing and render in preview', async ({
  page,
  request,
}) => {
  const restore = await fixture(request, page);
  try {
    await page.goto('/admin/#pages/' + articleId);
    await page.locator('.block-select').first().click();
    await mode(page, 'Markdown');
    await page.getByRole('textbox', { name: 'Markdown editor' }).fill(source);
    for (let i = 0; i < 3; i++) {
      await mode(page, 'Rich text');
      await expect(page.locator('.rich-editor .tiptap-mathematics-render')).toHaveCount(2);
      await expect(page.locator('.rich-editor pre')).toContainText('const total = 42;');
      await mode(page, 'Markdown');
      const value = await page.getByRole('textbox', { name: 'Markdown editor' }).inputValue();
      expect(value).toContain('$E = mc^2$');
      expect(value).toContain('```javascript');
      expect(value).toContain('\\frac{a}{b}');
    }
    await mode(page, 'Rich text');
    const formula = page.locator('.rich-editor .tiptap-mathematics-render').first();
    await formula.focus();
    await formula.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Edit formula' })).toBeVisible();
    await page.getByRole('textbox', { name: 'LaTeX', exact: true }).fill('x^2 + y^2 = r^2');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(formula).toHaveAttribute('data-latex', 'x^2 + y^2 = r^2');
    await page.locator('.rich-editor pre').click();
    await selectOption(page.getByRole('combobox', { name: 'Code language', exact: true }), 'typescript');
    await page.getByRole('button', { name: 'More formatting' }).click();
    await page.getByRole('button', { name: 'Formula', exact: true }).click();
    await page.getByRole('textbox', { name: 'LaTeX', exact: true }).fill('\\badcommand{');
    await expect(page.getByRole('button', { name: 'Insert formula', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await save(page);
    await page.goto('/admin/preview/' + articleId);
    await expect(page.locator('.article-formula math')).toHaveCount(2);
    await expect(page.locator('.article-code')).toContainText('TypeScript');
    await expect(page.locator('.article-code')).toContainText('<tag>');
    await expect(page.locator('.article-code .hljs-keyword').first()).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  } finally {
    await restore();
  }
});
test('public full-text search combines tags and time, resets and handles network failures', async ({
  page,
  request,
}) => {
  const restore = await fixture(request, page);
  try {
    await page.goto('/admin/preview/' + searchId);
    const choose = async (label: string, name: string) => {
      await page.getByRole('combobox', { name: label, exact: true }).click();
      await page
        .getByRole('listbox', { name: label, exact: true })
        .getByRole('option', { name, exact: true })
        .click();
    };
    const query = page.getByRole('searchbox', { name: 'Search full text' });
    await expect(query).toBeEnabled();
    await query.fill('quartzneedle472');
    await expect(page.locator('.article-search-results .archive-item')).toHaveCount(1);
    await expect(page.locator('.article-search-results')).toContainText('Field notes');
    await expect(page.locator('.article-search-results')).not.toContainText('Hidden needle');
    await expect(page.locator('.article-search-results .archive-year')).toHaveText('2026');
    await expect(page.locator('.article-search-results p')).toHaveCount(0);
    await choose('Tag', 'Research');
    await choose('Year', '2026');
    await choose('Month', 'September');
    await expect(page.getByRole('status')).toContainText('No articles');
    await choose('Month', 'October');
    await expect(page.locator('.article-search-results .archive-item')).toHaveCount(1);
    await expect(page).toHaveURL(/tag=Research/);
    await page.reload();
    await expect(query).toHaveValue('quartzneedle472');
    await expect(page.locator('.article-search-results .archive-item')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveText('2026');
    await expect(page.getByRole('combobox', { name: 'Month', exact: true })).toHaveText('October');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await expect(query).toHaveValue('');
    await expect(page.locator('.archive-item')).toHaveCount(5);
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect(page.locator('.archive-item')).toHaveCount(3);
    await expect(page.locator('.archive-year').filter({ hasText: '2021' })).toHaveCount(1);
    await expect(page.locator('.archive-year').first()).toBeFocused();
    await page.getByRole('button', { name: 'Page 1', exact: true }).click();
    const year = page.getByRole('combobox', { name: 'Year', exact: true });
    await year.focus();
    await year.press('ArrowDown');
    await year.press('ArrowDown');
    await year.press('Enter');
    await expect(year).toHaveText('2026');
    await year.press('Enter');
    await year.press('End');
    await year.press('Escape');
    await expect(year).toHaveText('2026');
    await expect(year).toBeFocused();
    await year.pressSequentially('2023');
    await year.press('Enter');
    await expect(year).toHaveText('2023');
    await year.pressSequentially('2026');
    await year.press('Enter');
    await expect(year).toHaveText('2026');
    await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('combobox', { name: 'Month', exact: true }).click();
    const popup = page.getByRole('listbox', { name: 'Month', exact: true });
    const box = await popup.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.route('**/admin/assets/axe-test.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: axe.source }),
    );
    await page.addScriptTag({ url: '/admin/assets/axe-test.js' });
    const violations = await page.evaluate(
      async () =>
        (
          await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
          })
        ).violations,
    );
    expect(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    await page.keyboard.press('Escape');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await fs.mkdir('.artifacts/blog-refinement', { recursive: true });
    await page.screenshot({ path: '.artifacts/blog-refinement/search-mobile.png', fullPage: true });
    await page.route('**/admin/api/article-index', (route) => route.abort());
    await page.reload();
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
    await expect(page.locator('.article-search-results .archive-item').first()).toBeVisible();
    // Articles after the first page stay reachable through the server-rendered pages.
    const visible = page.locator('.article-search-results .archive-item:visible');
    await expect(visible).toHaveCount(5);
    const firstOffline = await visible.first().textContent();
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect(visible.first()).not.toHaveText(firstOffline!);
    await page.unroute('**/admin/api/article-index');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(query).toBeEnabled();
  } finally {
    await restore();
  }
});
