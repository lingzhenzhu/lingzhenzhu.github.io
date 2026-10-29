import { test, expect } from '@playwright/test';

test('article search, date filters, ordering and navigation share one list; labelled action icons adapt consistently', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/admin/');
  const content = page.getByRole('navigation', { name: 'Content', exact: true });
  await content.getByRole('button', { name: 'Articles', exact: true }).click();
  await expect(content.getByRole('button', { name: 'Image library' })).toBeVisible();
  await expect(
    page.locator('.sidebar-pages').getByRole('button', { name: 'Articles', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Archive views', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Articles', exact: true })).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Year', exact: true }).selectOption('2023');
  await expect(page.locator('.item-row')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Sort', exact: true }).selectOption('oldest');
  await expect(page.locator('.row-link').first()).toContainText('Shadow City');
  await page.getByRole('checkbox', { name: 'Select all articles' }).check();
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search articles' }).fill('Shadow');
  await expect(page.locator('.item-row')).toHaveCount(1);
  await expect(page.getByText('2 selected', { exact: true })).toHaveCount(0);
  await page.locator('.row-link').click();
  await expect(page).toHaveURL(/#articles\//);
  await expect(page.locator('.breadcrumbs')).not.toContainText('Pages');
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Year', exact: true })).toHaveValue('2023');
  await expect(page.getByRole('searchbox', { name: 'Search articles' })).toHaveValue('Shadow');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('.item-row')).toHaveCount(6);
  for (const width of [1440, 700, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ['Save', 'Review & publish', 'Add article']) {
      const icon = page.getByRole('button', { name, exact: true }).locator('.ui-icon');
      if (width <= 700) await expect(icon).toBeHidden();
      else await expect(icon).toBeVisible();
    }
    if (width <= 700)
      await expect(page.getByRole('button', { name: 'Toggle sidebar' }).locator('.ui-icon')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440 || width === 390)
      await page.screenshot({ path: testInfo.outputPath(`admin-${width}.png`) });
  }
});
