import { selectOption } from './select-control';
import { test, expect } from '@playwright/test';
import type { Content } from '@lzzhu/content';

test('Admin page creation, labels, order, visibility and deletion update both navigation layouts', async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(15000);
  const original = (await (await request.get('/admin/api/content')).json()) as Content;
  const { csrf } = await (await request.get('/admin/api/session')).json();
  const preview = await context.newPage();
  preview.setDefaultTimeout(15000);
  const baseline = original.pages
    .filter((p) => p.inNavigation && p.status === 'published')
    .sort((a, b) => a.navOrder - b.navOrder)
    .map((p) => p.navLabel);
  const save = async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('All changes saved', { exact: true })).toBeVisible();
  };
  const verify = async (labels: string[]) => {
    await preview.setViewportSize({ width: 1280, height: 900 });
    await preview.goto('/admin/preview/home');
    await expect(preview.locator('.navbar .menu-item')).toHaveText(labels);
    const desktop = await preview
      .locator('.navbar .menu-item')
      .evaluateAll((items) => items.map((el) => ({ text: el.textContent, href: el.getAttribute('href') })));
    await preview.setViewportSize({ width: 390, height: 844 });
    await preview.locator('.menu-toggle').click();
    await expect(preview.locator('#mobile-menu .menu-item')).toHaveText(labels);
    expect(
      await preview
        .locator('#mobile-menu .menu-item')
        .evaluateAll((items) => items.map((el) => ({ text: el.textContent, href: el.getAttribute('href') }))),
    ).toEqual(desktop);
  };
  const structure = () => page.getByRole('button', { name: 'Site structure', exact: true }).click();
  const addLink = () =>
    page
      .locator('.item-row')
      .filter({ hasText: 'Navigation study' })
      .getByRole('button', { name: 'Add to navigation', exact: true })
      .click();
  try {
    await page.goto('/admin/#structure');
    await page.getByRole('button', { name: 'Add page', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Navigation study');
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByLabel('Page address', { exact: true }).fill('/navigation-study/');
    await structure();
    await addLink();
    await save();
    await verify(baseline); // Draft pages never leak into either public navigation.
    await page.getByRole('button', { name: /^Navigation study(?: Draft)?$/ }).click();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await selectOption(page.getByRole('combobox', { name: 'Visibility', exact: true }), 'published');
    await save();
    await verify([...baseline, 'Navigation study']);
    await structure();
    await page.getByLabel('Navigation label for Navigation study', { exact: true }).fill('Field notes');
    await page.getByRole('button', { name: 'Move Navigation study up', exact: true }).click();
    await save();
    await verify([...baseline.slice(0, -1), 'Field notes', baseline.at(-1)!]);
    await page.getByRole('button', { name: 'Remove Navigation study from navigation', exact: true }).click();
    await save();
    await verify(baseline);
    await addLink();
    await save();
    await verify([...baseline, 'Field notes']);
    await page.getByRole('button', { name: 'Navigation study', exact: true }).click();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByRole('button', { name: 'Delete page', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete page', exact: true }).click();
    await save();
    await verify(baseline);
  } finally {
    await preview.close();
    await page.close();
    const current = (await (await request.get('/admin/api/content')).json()) as Content;
    const response = await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': csrf },
      data: { content: original, expectedRevision: current.revision },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});
