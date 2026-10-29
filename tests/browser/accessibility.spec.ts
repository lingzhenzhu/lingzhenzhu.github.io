import { test, expect, type Page } from '@playwright/test';
import axe from 'axe-core';
import content from '../../content/site.json' with { type: 'json' };
declare global {
  interface Window {
    axe: typeof axe;
  }
}

async function audit(page: Page, label: string) {
  await page.locator('body').evaluate(async (body) => {
    await Promise.all(body.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        // The embedded third-party player is tested separately; this gate covers our document.
        iframes: false,
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      })
    ).violations.map(({ id, nodes }) => ({
      id,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    })),
  );
  expect(violations, label).toEqual([]);
}
test.use({ bypassCSP: true }); // Only injects the testing engine; runtime/CSP tests use normal browser contexts.
test('published pages pass automated accessibility checks', async ({ page }) => {
  test.setTimeout(300_000);
  await page.route('**/api/medium', (route) => route.fulfill({ status: 503, json: {} }));
  for (const item of content.pages.filter((page) => page.status === 'published')) {
    await page.goto(item.path, { waitUntil: 'domcontentloaded' });
    await audit(page, item.path);
    for (const theme of ['dark-theme', 'a11y-high-contrast', 'dark-theme a11y-high-contrast']) {
      await page.locator('body').evaluate((body, classes) => {
        body.setAttribute('class', classes);
      }, theme);
      await audit(page, item.path + ' · ' + theme);
    }
  }
});
test('accessibility controls pass in all themes and mobile navigation shows every destination', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#a11y-btn').click();
  await audit(page, 'light menu');
  await page.locator('#toggle-dark').click();
  await audit(page, 'dark menu');
  await page.locator('#toggle-contrast').click();
  await audit(page, 'dark high contrast');
  await page.locator('#reset-a11y').click();
  await page.locator('#toggle-contrast').click();
  await audit(page, 'light high contrast');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/research/');
  await page.locator('.menu-toggle').click();
  for (const link of await page.locator('#mobile-menu a').all()) {
    const box = await link.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  }
  await audit(page, 'mobile menu');
});
test('main editorial workflows pass automated accessibility checks', async ({ page }) => {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Home', exact: true }).waitFor();
  await audit(page, 'overview');
  for (const name of ['Home', 'Research', 'Articles', 'Review & publish']) {
    await page.getByRole('button', { name, exact: true }).click();
    if (name === 'Home' || name === 'Research')
      await expect(page.getByRole('navigation', { name: 'Page sections' })).toBeVisible();
    await audit(page, name);
  }
});

test('page navigation keeps its heading while the editor loads', async ({ page }) => {
  let releaseEditor!: () => void;
  const pendingEditor = new Promise<void>((resolve) => {
    releaseEditor = resolve;
  });
  await page.route(/\/admin\/assets\/PageEditor-[^/?]+\.js(?:\?.*)?$/, async (route) => {
    await pendingEditor;
    await route.continue();
  });
  try {
    await page.goto('/admin/');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Opening page editor' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home Public');
    await audit(page, 'Home while loading');
    releaseEditor();
    await expect(page.getByRole('navigation', { name: 'Page sections' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await audit(page, 'Home after loading');
  } finally {
    releaseEditor();
  }
});
test('Chinese page and speech use the declared content language', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        lang = '';
        text: string;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          document.documentElement.dataset.spokenLanguage = utterance.lang;
        },
      },
    });
  });
  await page.goto('/woaidumuyibeizi/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await page.locator('#a11y-btn').click();
  await page.locator('#toggle-read-aloud').click();
  await expect(page.locator('html')).toHaveAttribute('data-spoken-language', 'zh-Hans');
});

test('a browser without an utterance API disables speech without throwing', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined }),
  );
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#a11y-btn').click();
  await expect(page.locator('#toggle-read-aloud')).toBeDisabled();
  expect(errors).toEqual([]);
});
