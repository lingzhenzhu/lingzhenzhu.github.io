import { test, expect } from '@playwright/test';
import axe from 'axe-core';

test.use({ bypassCSP: true });
test('notebook controls and formatting popover pass accessibility at desktop and phone widths', async ({
  page,
}) => {
  await page.goto('/admin/');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.locator('.block-select').filter({ hasText: 'Text & headings' }).click();
  await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
  await page.addScriptTag({ content: axe.source });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Choose formatting mode' }).click();
    const violations = await page.evaluate(async () =>
      (
        await window.axe.run(document, {
          iframes: false,
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] },
        })
      ).violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
    );
    expect(violations).toEqual([]);
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Markdown editor' })).toBeVisible();
    await page.getByRole('button', { name: 'Choose formatting mode' }).click();
    await page.getByRole('button', { name: 'Rich text', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
