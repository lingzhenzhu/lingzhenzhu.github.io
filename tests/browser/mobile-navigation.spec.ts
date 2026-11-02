import { test, expect } from '../fixtures';

test('mobile navigation fills the screen and restores reading position, focus and desktop navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 350));
  const readingPosition = await page.evaluate(() => window.scrollY);
  const layout = () =>
    page.evaluate(() =>
      ['body', '.home-opening', '.post-wrap'].map((selector) => {
        const { x, width } = document.querySelector(selector)!.getBoundingClientRect();
        return { x, width };
      }),
    );
  const originalLayout = await layout();
  const toggle = page.locator('.menu-toggle');
  await expect(toggle.locator('.menu-toggle-bars')).toBeVisible();
  const closedButton = await toggle.boundingBox();
  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Close menu');
  await expect(toggle.locator('.menu-toggle-close')).toBeVisible();
  const openButton = await toggle.boundingBox();
  expect(openButton).toEqual(closedButton);
  expect(await layout()).toEqual(originalLayout);
  const navigation = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect.poll(() => navigation.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(page.locator('#mobile-menu')).toBeVisible();
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await expect(page.locator('#a11y-btn')).not.toBeVisible();
  await navigation.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})),
    );
  });
  const links = page.locator('#mobile-menu a');
  const boxes = await links.evaluateAll((items) =>
    items.map((el) => {
      const { x, y, bottom } = el.getBoundingClientRect();
      return { x, y, bottom, align: getComputedStyle(el).textAlign };
    }),
  );
  expect(boxes.length).toBeGreaterThan(2);
  for (let i = 1; i < boxes.length; i++) {
    expect(boxes[i].x).toBe(boxes[0].x);
    expect(boxes[i].y).toBeGreaterThanOrEqual(boxes[i - 1].bottom);
    expect(boxes[i].align).toBe('left');
  }
  await page.mouse.wheel(0, 500);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await toggle.focus();
  await page.keyboard.press('Tab');
  await expect(links.first()).toBeFocused();
  await links.last().focus();
  await page.keyboard.press('Tab');
  await expect(navigation.locator('.navbar-header a')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAccessibleName('Menu');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(readingPosition);
  expect(await layout()).toEqual(originalLayout);
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await expect(page.locator('#a11y-btn')).toBeVisible();

  await toggle.click();
  await links.first().focus();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await toggle.click();
  await links.filter({ hasText: /^Research$/ }).click();
  await expect(page).toHaveURL(/\/research\/$/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('long mobile navigation scrolls independently with large text and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/research/');
  const linkSize = await page
    .locator('#mobile-menu a')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  await page.locator('#a11y-btn').click();
  await page.locator('#toggle-font-size').click();
  await page.locator('#toggle-dark').click();
  await page.locator('#toggle-contrast').click();
  await page.evaluate(() => {
    const menu = document.querySelector('#mobile-menu')!;
    for (let i = 0; i < 15; i++) {
      const link = document.createElement('a');
      link.className = 'menu-item';
      link.href = '/research/';
      link.textContent = `A longer page name ${i + 1}`;
      menu.appendChild(link);
    }
  });
  await page.locator('.menu-toggle').click();
  const menu = page.locator('#mobile-menu');
  const linkStyle = await menu
    .locator('a')
    .first()
    .evaluate((el) => ({
      size: parseFloat(getComputedStyle(el).fontSize),
      color: getComputedStyle(el).color,
    }));
  expect(linkStyle.size).toBeGreaterThan(linkSize);
  expect(linkStyle.color).toBe('rgb(255, 255, 255)');
  await expect(page.locator('#a11y-btn')).not.toBeVisible();
  await expect(page.locator('#a11y-menu')).not.toBeVisible();
  expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  expect(
    await page.locator('.navbar-mobile').evaluate((el) => el.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await menu.locator('a').last().focus();
  await expect(menu.locator('a').last()).toBeInViewport();
  expect(await menu.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Close menu' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).not.toBeVisible();
  await expect(page.locator('.menu-toggle')).toBeFocused();
  await expect(page.locator('#a11y-btn')).toBeVisible();
});

test('mobile navigation animates both ways and rapid reversals never leave the page locked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const nav = page.locator('.navbar-mobile');
  const toggle = page.locator('.menu-toggle');
  const closed = await nav.evaluate((el) => getComputedStyle(el).clipPath);
  const opening = await nav.evaluate((el) => {
    (el.querySelector('.menu-toggle') as HTMLButtonElement).click();
    const transitions = el.getAnimations();
    const curtain = transitions[0];
    if (!curtain) throw new Error('The menu opened without a transition');
    curtain.pause();
    curtain.currentTime = Number(curtain.effect!.getTiming().duration) / 2;
    const clip = getComputedStyle(el).clipPath;
    const links = [...el.querySelectorAll('#mobile-menu a')];
    const delays = links.map((link) => link.getAnimations()[0]?.effect?.getTiming().delay);
    const duration = curtain.effect!.getTiming().duration;
    for (const animation of el.getAnimations({ subtree: true })) animation.finish();
    return { clip, delays, duration };
  });
  expect(opening.clip).not.toBe(closed);
  expect(opening.clip).not.toBe(await nav.evaluate((el) => getComputedStyle(el).clipPath));
  expect(opening.duration).toBeLessThanOrEqual(500);
  expect(opening.delays[1]).toBeGreaterThan(opening.delays[0]!);
  expect(opening.delays[1]! - opening.delays[0]!).toBeGreaterThanOrEqual(50);
  const closing = await nav.evaluate((el) => {
    (el.querySelector('.menu-toggle') as HTMLButtonElement).click();
    return el.getAnimations().length;
  });
  expect(closing).toBeGreaterThan(0);
  // Reopen during the outgoing transition, then let the interrupted close settle.
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await nav.evaluate(async (el) => {
    await Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
  });
  expect(await page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(true);
  await toggle.click();
  await expect(page.locator('#mobile-menu')).toBeHidden();
  await expect.poll(() => page.locator('main').evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  await expect(page.locator('#a11y-btn')).toBeVisible();
  await expect(toggle.locator('.menu-toggle-label')).toHaveCSS('opacity', '1');
});
