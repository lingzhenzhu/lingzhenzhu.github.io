import { request as independentRequest, type APIRequestContext } from '@playwright/test';
import { test, expect } from '../fixtures';
import { ContentSchema, PageSchema, type Content, type Page } from '@lzzhu/content';
import { selectOption } from './select-control';
import fs from 'node:fs/promises';

const searchId = 'refinement-search',
  articleId = 'refinement-article';
const makeArticle = (id = articleId) =>
  PageSchema.parse({
    id,
    path: '/test-' + id + '/',
    title: 'Orchard notebook',
    date: '2027-02-03',
    template: 'article',
    status: 'published',
    articleDetails: { tags: ['Botany'] },
    blocks: [
      {
        id: 'text-' + id,
        type: 'richText',
        document: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'A distinct full-text phrase: verdantneedle.' }],
            },
            {
              type: 'codeBlock',
              attrs: { language: 'javascript' },
              content: [{ type: 'text', text: 'const greeting = "hello"; // A comment\nconsole.log(42);' }],
            },
          ],
        },
      },
    ],
  });
async function fixture(request: APIRequestContext) {
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const cleanup = await independentRequest.newContext({ baseURL: 'http://127.0.0.1:4173' });
  const edit = async (update: (content: Content) => Content, transport = request) => {
    const current = (await (await transport.get('/admin/api/content')).json()) as Content;
    const response = await transport.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
      data: { content: ContentSchema.parse(update(current)), expectedRevision: current.revision },
    });
    expect(response.ok(), await response.text()).toBe(true);
  };
  await edit((c) => ({
    ...c,
    pages: [
      ...c.pages,
      makeArticle(),
      PageSchema.parse({
        id: searchId,
        path: '/refinement-search/',
        title: 'Past',
        status: 'published',
        blocks: [
          { id: 'refinement-search-block', type: 'articleSearch', title: 'Explore the archive', pageSize: 5 },
        ],
      }),
    ],
  }));
  return {
    edit,
    restore: async () => {
      try {
        await edit(() => original, cleanup);
      } finally {
        await cleanup.dispose();
      }
    },
  };
}
const screenshots = '.artifacts/article-refinement';
test.beforeAll(async () => {
  await fs.mkdir(screenshots, { recursive: true });
});

test('search title, tags and full text; filters and combined criteria; saved article CRUD refreshes results and choices', async ({
  page,
  request,
}, info) => {
  const state = await fixture(request);
  try {
    await page.goto('/admin/preview/' + searchId);
    const query = page.getByRole('searchbox', { name: 'Search full text' }),
      rows = page.locator('.archive-item');
    for (const term of ['Orchard notebook', 'Botany', 'verdantneedle']) {
      await query.fill(term);
      await expect(rows).toHaveCount(1);
      await expect(rows).toContainText('Orchard notebook');
    }
    await query.fill('');
    await selectOption(page.getByRole('combobox', { name: 'Tag', exact: true }), 'Botany');
    await expect(rows).toHaveCount(1);
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '2027');
    await selectOption(page.getByRole('combobox', { name: 'Month', exact: true }), '02');
    await query.fill('verdantneedle');
    await expect(rows).toHaveCount(1);
    await query.fill('not-in-any-article');
    await expect(rows).toHaveCount(0);
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await page.getByRole('button', { name: 'Page 2', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Next page', exact: true })).toBeDisabled();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Page 2', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByRole('button', { name: 'Page 1', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Previous page', exact: true })).toBeDisabled();
    await state.edit((c) => ({
      ...c,
      pages: [
        ...c.pages,
        {
          ...makeArticle('added-article'),
          title: 'Added fieldwork',
          date: '2028-04-01',
          articleDetails: { ...makeArticle().articleDetails!, tags: ['New subject'] },
        },
      ],
    }));
    await page.reload();
    await query.fill('Added fieldwork');
    await expect(rows).toHaveCount(1);
    await selectOption(page.getByRole('combobox', { name: 'Tag', exact: true }), 'New subject');
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '2028');
    await expect(rows).toHaveCount(1);
    await state.edit((c) => ({
      ...c,
      pages: c.pages.map((p) =>
        p.id === 'added-article'
          ? {
              ...p,
              title: 'Revised fieldwork',
              date: '2029-05-01',
              articleDetails: {
                copyright: '',
                licenseLabel: '',
                ...p.articleDetails,
                tags: ['Updated subject'],
              },
              blocks: [
                {
                  ...makeArticle().blocks[0],
                  id: 'revised-body',
                  document: {
                    type: 'doc',
                    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'newbodyneedle' }] }],
                  },
                },
              ] as Page['blocks'],
            }
          : p,
      ),
    }));
    await page.goto('/admin/preview/' + searchId);
    await query.fill('newbodyneedle');
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Revised fieldwork');
    await selectOption(page.getByRole('combobox', { name: 'Tag', exact: true }), 'Updated subject');
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '2029');
    await expect(rows).toHaveCount(1);
    expect(await page.locator('select[name=tag] option').allTextContents()).not.toContain('New subject');
    await state.edit((c) => ({ ...c, pages: c.pages.filter((p) => p.id !== 'added-article') }));
    await page.goto('/admin/preview/' + searchId);
    await query.fill('newbodyneedle');
    await expect(rows).toHaveCount(0);
    expect(await page.locator('select[name=year] option').allTextContents()).not.toContain('2029');
    await page.getByRole('button', { name: 'Reset filters' }).click();
    await page.screenshot({ path: `${screenshots}/search-${info.project.name}.png`, fullPage: true });
    // The real Admin iframe must render the same shared component, not a mock page.
    await page.goto('/admin/#pages/' + searchId);
    const preview = page.frameLocator('iframe[title="Page preview"]');
    await expect(preview.getByRole('combobox', { name: 'Year', exact: true })).toBeVisible();
    await expect(preview.locator('.article-search-footer')).toContainText('7 articles');
    await expect(preview.locator('input[name=from]')).toHaveCount(0);
    await preview.getByRole('searchbox', { name: 'Search full text' }).fill('verdantneedle');
    await expect(preview.locator('.archive-item')).toHaveCount(1);
    await page.screenshot({ path: `${screenshots}/admin-live-search-${info.project.name}.png` });
  } finally {
    await page.close();
    await state.restore();
  }
});

test('global article links update the live preview and hide unavailable destinations', async ({
  page,
  request,
}, info) => {
  const state = await fixture(request);
  try {
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto('/admin/#pages/' + articleId);
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Page preview"]');
    await expect(preview.locator('.article-return-left')).toContainText('All articlesHome');
    await selectOption(page.getByRole('combobox', { name: 'Link 1', exact: true }), 'previous');
    await selectOption(page.getByRole('combobox', { name: 'Link 2', exact: true }), 'next');
    await selectOption(page.getByRole('combobox', { name: 'Link 2 position', exact: true }), 'right');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(preview.getByRole('link', { name: 'Next', exact: true })).toBeVisible();
    await expect(preview.getByRole('link', { name: 'Previous', exact: true })).toHaveCount(0);
    await expect(preview.locator('.post-nav')).toHaveCount(0);
    await expect(preview.locator('.article-return-right svg')).toHaveCount(1);
    await page.screenshot({ path: `${screenshots}/admin-navigation-${info.project.name}.png` });
    const c = (await (await request.get('/admin/api/content')).json()) as Content;
    const oldest = c.pages
      .filter((p) => p.template === 'article' && p.status === 'published')
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
    await page.goto('/admin/preview/' + oldest.id);
    await expect(page.getByRole('link', { name: 'Next', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Previous', exact: true })).toBeVisible();
  } finally {
    await page.close();
    await state.restore();
  }
});

test('theme is applied before runtime and persists through navigation; high-contrast code retains readable syntax colors', async ({
  page,
  request,
}, info) => {
  const state = await fixture(request);
  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Accessibility options', exact: true }).click();
    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Dark Mode', exact: true }).click();
      const dark = i % 2 === 0;
      await expect(page.locator('html')).toHaveClass(dark ? /dark-theme/ : /^(?!.*dark-theme)/);
      const colors = await page.evaluate(() => [
        getComputedStyle(document.documentElement).backgroundColor,
        getComputedStyle(document.body).backgroundColor,
      ]);
      expect(colors).toEqual(
        dark ? ['rgb(30, 30, 30)', 'rgb(30, 30, 30)'] : ['rgb(250, 250, 248)', 'rgb(250, 250, 248)'],
      );
    }
    await page.keyboard.press('Escape');
    // Runtime is delayed: the head bootstrap alone must give the first body its theme.
    await page.route('**/*.js', async (route) => {
      if (!route.request().url().includes('preferences.js')) await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    for (const path of ['/', '/research/', '/teaching/', '/']) {
      await page.goto(path, { waitUntil: 'commit' });
      await page.locator('.post-content').waitFor();
      await expect(page.locator('html')).toHaveClass(/dark-theme/);
      const colors = await page.evaluate(() => [
        getComputedStyle(document.documentElement).backgroundColor,
        getComputedStyle(document.body).backgroundColor,
      ]);
      expect(colors).toEqual(['rgb(30, 30, 30)', 'rgb(30, 30, 30)']);
      await page.waitForLoadState('load');
    }
    await page.unroute('**/*.js');
    await page.goto('/admin/preview/' + articleId);
    for (const dark of [false, true]) {
      await page.evaluate((dark) => {
        document.documentElement.className = 'a11y-high-contrast' + (dark ? ' dark-theme' : '');
      }, dark);
      const tokens = await page
        .locator('.article-code [class*=hljs-]')
        .evaluateAll((elements) =>
          elements.map((el) => ({
            color: getComputedStyle(el).color,
            bg: getComputedStyle(el.closest('.article-code')!).backgroundColor,
          })),
        );
      expect(new Set(tokens.map((t) => t.color)).size).toBeGreaterThanOrEqual(3);
      const luminance = (rgb: string) =>
        rgb
          .match(/\d+/g)!
          .slice(0, 3)
          .map(Number)
          .map((n) => n / 255)
          .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
          .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
      for (const token of tokens) {
        const a = luminance(token.color),
          b = luminance(token.bg);
        expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(7);
      }
      await page.screenshot({
        path: `${screenshots}/code-${dark ? 'dark' : 'light'}-${info.project.name}.png`,
        fullPage: true,
      });
    }
  } finally {
    await page.close();
    await state.restore();
  }
});

test('archive year and month are constrained pickers and update the real embedded preview', async ({
  page,
  request,
}, info) => {
  const state = await fixture(request);
  try {
    const c = (await (await request.get('/admin/api/content')).json()) as Content;
    const archive = c.pages.find((p) => p.blocks.some((b) => b.type === 'archive' && !b.year && !b.month))!;
    await page.goto('/admin/#pages/' + archive.id);
    await page.locator('.block-select').first().click();
    await selectOption(page.getByRole('combobox', { name: 'Year', exact: true }), '2023');
    await selectOption(page.getByRole('combobox', { name: 'Month', exact: true }), '11');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const preview = page.frameLocator('iframe[title="Page preview"]');
    await expect(preview.locator('.archive-item')).toHaveCount(1);
    await expect(preview.locator('.archive-item')).toContainText("Bong Joon Ho's Memories");
    await expect(page.locator('select:visible')).toHaveCount(0);
    await page.screenshot({ path: `${screenshots}/admin-archive-dates-${info.project.name}.png` });
  } finally {
    await page.close();
    await state.restore();
  }
});

test('code language picker remains open for pointer selection', async ({ page, request }) => {
  const state = await fixture(request);
  try {
    await page.goto('/admin/#pages/' + articleId);
    await page.locator('.block-select').first().click();
    await page.locator('.rich-editor pre').click();
    page.setDefaultTimeout(5000);
    await selectOption(page.getByRole('combobox', { name: 'Code language', exact: true }), 'typescript');
    await expect(page.getByRole('combobox', { name: 'Code language', exact: true })).toHaveText('TypeScript');
  } finally {
    await page.close();
    await state.restore();
  }
});
