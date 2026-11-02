import { test, expect, cpuGlass } from '../fixtures';

test('Admin navigation, fixed actions and modal focus work at desktop and phone sizes', async ({
  page,
  browserName,
}) => {
  // Wherever the real glass renders, the built CSS must keep its blur.
  const glass = !cpuGlass(browserName);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/admin/#pages/home');
  await expect(page.getByRole('heading', { name: 'Home Public' })).toBeVisible();
  const settings = page.getByRole('button', { name: 'Page settings', exact: true });
  const lens = page.locator('.section-tabs .segment-lens');
  const initial = await lens.boundingBox();
  await settings.click();
  await expect(settings).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await lens.boundingBox())!.x).toBeGreaterThan(initial!.x + 60);
  await expect(lens).toHaveAttribute('data-moving', 'false');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  // Exercise the built CSS: prefixed aliases must not replace the standard
  // property during minification and silently disable the material in Chromium.
  if (glass) await expect(page.getByRole('dialog')).toHaveCSS('backdrop-filter', /blur\(9px\)/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Add section', exact: true })).toBeFocused();
  await page.evaluate(() => scrollTo(0, 400));
  if (glass) await expect(page.locator('.scroll-edge > i').last()).toHaveCSS('backdrop-filter', 'blur(9px)');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Review & publish' })).toBeInViewport();
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeInViewport();
  }
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('Notebook paper follows Markdown scrolling and font baselines; preview keeps public styles', async ({
  page,
}) => {
  await page.goto('/admin/#pages/research');
  await page.locator('.block-select').filter({ hasText: 'Text & headings' }).first().click();
  await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.locator('.writing-paper').evaluate((paper) => {
        const el = paper.querySelector<HTMLElement>('.rich-editor :is(p,h2,h3)')!;
        const root = paper.querySelector<HTMLElement>('.rich-editor')!;
        const style = getComputedStyle(el),
          context = document.createElement('canvas').getContext('2d')!;
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const m = context.measureText('Hg');
        const baseline =
          el.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          (30 - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 +
          m.fontBoundingBoxAscent;
        return Math.round((30 - ((baseline - 44 + 3000) % 30)) * 10) / 10;
      }),
    )
    .toBe(4);
  const frame = page.frameLocator('iframe[title="Page preview"]');
  await expect(frame.locator('html')).toHaveAttribute('data-preview', 'true');
  expect(await frame.locator('[data-glass]').count()).toBe(0);
  await page.getByRole('button', { name: 'Choose formatting mode' }).click();
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  const paper = page.locator('.note-paper-body');
  const before = await page.getByRole('textbox', { name: 'Markdown editor' }).boundingBox();
  await paper.evaluate((el) => {
    el.style.maxHeight = '100px';
    el.style.minHeight = '100px';
    el.scrollTop = 50;
  });
  await expect
    .poll(async () => (await page.getByRole('textbox', { name: 'Markdown editor' }).boundingBox())!.y)
    .toBeLessThan(before!.y - 20);
  expect(
    await page
      .getByRole('textbox', { name: 'Markdown editor' })
      .evaluate((el) => getComputedStyle(el).fontFamily),
  ).toBe(await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily));
});

test('Reduced motion snaps selection; local accounts do not pretend to sign out', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/admin/#pages/home');
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  await expect(page.locator('.segment-lens')).toHaveAttribute('data-moving', 'false');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await expect(page.locator('.anchored-popover')).toHaveCSS('animation-name', 'none');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeDisabled();
  await expect(page.getByText('Local development', { exact: true })).toBeVisible();
  await expect(page.getByText('Sign-out is available on the live website.', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Account options' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Account', exact: true })).toBeFocused();
});

test('Sidebar fills the viewport, form headings sit inside their panels, and account menus stay separate', async ({
  page,
  browserName,
}) => {
  await page.goto('/admin/#pages/research');
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 2560, height: 1440 },
  ]) {
    await page.setViewportSize(viewport);
    const sidebar = page.locator('.sidebar');
    await expect
      .poll(async () => Math.round((await sidebar.boundingBox())!.height))
      .toBe(viewport.height - 32);
    const side = (await sidebar.boundingBox())!;
    const main = (await page.locator('.editor-main').boundingBox())!;
    expect(main.x - side.x - side.width).toBeGreaterThanOrEqual(28);
    const footer = (await page.locator('.sidebar-foot').boundingBox())!;
    expect(viewport.height - footer.y - footer.height).toBeLessThan(40);
    const group = page.getByRole('group', { name: 'Address & visibility' });
    const heading = (await group.getByRole('heading').boundingBox())!;
    const surface = (await group.boundingBox())!;
    const field = (await group.getByRole('combobox', { name: 'Content language' }).boundingBox())!;
    expect(heading.y - surface.y).toBeGreaterThanOrEqual(18);
    expect(Math.abs(heading.x - field.x)).toBeLessThan(2);
    await page.evaluate(() => scrollTo(0, 400));
    const edge = (await page.locator('.scroll-edge').boundingBox())!;
    expect(edge.x).toBe(0);
    expect(edge.width).toBe(viewport.width);
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Account options' });
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((el) => el.matches(':popover-open'))).toBe(true);
    await menu.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
    const menuBounds = (await menu.boundingBox())!;
    const triggerBounds = (await page.getByRole('button', { name: 'Account', exact: true }).boundingBox())!;
    expect(menuBounds.y + menuBounds.height).toBeLessThan(triggerBounds.y);
    expect(
      Math.abs(menuBounds.x + menuBounds.width / 2 - triggerBounds.x - triggerBounds.width / 2),
    ).toBeLessThan(2);
    expect(await menu.evaluate((el) => el.parentElement === document.body)).toBe(true);
    if (!cpuGlass(browserName)) await expect(menu).toHaveCSS('backdrop-filter', /blur\(20px\)/);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Toggle sidebar' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  const menu = page.getByRole('dialog', { name: 'Account options' });
  await expect(menu).toBeInViewport();
  await page.setViewportSize({ width: 320, height: 600 });
  await expect(menu).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeFocused();
  await expect(page.getByText('Preview of your saved draft', { exact: true })).toHaveCount(0);
});

test('Page outline selects the real editor and returns to live preview', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/admin/#pages/research');
  await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
  const outline = page.getByRole('complementary', { name: 'Page outline' });
  await expect(outline).toBeVisible();
  await outline
    .getByRole('button', { name: /^Edit section:/ })
    .first()
    .click();
  await expect(page.getByRole('textbox', { name: 'Content editor' })).toBeVisible();
  await expect(outline.locator('[aria-current="location"]')).toHaveCount(1);
  await outline.getByRole('button', { name: 'Open page settings' }).click();
  await expect(page.getByRole('button', { name: 'Page settings', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Show preview', exact: true }).click();
  await expect(page.frameLocator('iframe[title="Page preview"]').locator('html')).toHaveAttribute(
    'data-preview',
    'true',
  );
  await expect(outline).toHaveCount(0);
});

test('Sign-out waits for a successful save and keeps the draft when saving fails', async ({ page }) => {
  await page.route('**/admin/api/session', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({
      response,
      json: { ...data, identity: { id: 'admin@example.test', local: false, role: 'editor' } },
    });
  });
  let saves = 0;
  await page.route('**/admin/api/content', async (route) => {
    if (route.request().method() !== 'PATCH') return route.continue();
    saves++;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Test connection interrupted' }),
    });
  });
  await page.goto('/admin/#pages/research');
  await page.getByLabel('Title', { exact: true }).fill('Unsaved sign-out test');
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'Save & sign out', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Test connection interrupted');
  await expect(page).toHaveURL(/\/admin\/#pages\/research$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Unsaved sign-out test');
  expect(saves).toBeGreaterThan(0);
});

test('Sign-out saves the draft before leaving for Cloudflare Access', async ({ page, request }) => {
  const original = await (await request.get('/admin/api/content')).json();
  const session = await (await request.get('/admin/api/session')).json();
  await page.route('**/admin/api/session', (route) =>
    route.fulfill({
      json: { ...session, identity: { id: 'admin@example.test', local: false, role: 'editor' } },
    }),
  );
  let savedBeforeLogout = false;
  await page.route('**/cdn-cgi/access/logout', async (route) => {
    const saved = await (await request.get('/admin/api/content')).json();
    savedBeforeLogout =
      saved.pages.find((entry: { id: string }) => entry.id === 'research')?.title === 'Saved before sign-out';
    await route.fulfill({ contentType: 'text/html', body: '<h1>Signed out</h1>' });
  });
  try {
    await page.goto('/admin/#pages/research');
    await page.getByLabel('Title', { exact: true }).fill('Saved before sign-out');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    // The menu opens on its first action; Sign out follows View website.
    await expect(page.getByRole('link', { name: 'View website', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('button', { name: 'Save & sign out', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Signed out' })).toBeVisible();
    expect(savedBeforeLogout).toBe(true);
  } finally {
    await page.close();
    const current = await (await request.get('/admin/api/content')).json();
    const restored = await request.put('/admin/api/content', {
      headers: { Origin: 'http://127.0.0.1:4173', 'X-CSRF-Token': session.csrf },
      data: { content: original, expectedRevision: current.revision },
    });
    expect(restored.ok(), await restored.text()).toBe(true);
  }
});
