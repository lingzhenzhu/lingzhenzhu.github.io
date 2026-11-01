import { test, type Page } from '@playwright/test';

// Temporary diagnosis for Linux WebKit in CI. Reproduces the two flows whose next click never
// becomes "stable", then reports what keeps changing. Nothing asserts.
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const diag = { ro: {} as Record<string, number>, raf: 0, mutations: 0 };
    (window as unknown as { __diag: typeof diag }).__diag = diag;
    const Native = window.ResizeObserver;
    window.ResizeObserver = class extends Native {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          for (const entry of entries) {
            const name = String((entry.target as HTMLElement).className || entry.target.tagName).split(' ')[0];
            diag.ro[name] = (diag.ro[name] || 0) + 1;
          }
          callback(entries, observer);
        });
      }
    };
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => {
        diag.raf++;
        callback(time);
      });
    addEventListener('DOMContentLoaded', () =>
      new MutationObserver((list) => (diag.mutations += list.length)).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      }),
    );
  });
}
async function sample(page: Page, label: string, selector: string) {
  const read = () =>
    Promise.race([
      page.evaluate((selector) => {
        const diag = (window as unknown as { __diag: { ro: Record<string, number>; raf: number; mutations: number } }).__diag;
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return { ...diag, ro: { ...diag.ro }, rect: rect && [rect.x, rect.y, rect.width, rect.height].map((v) => +v.toFixed(2)) };
      }, selector),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10_000)),
    ]);
  const first = await read();
  const rects = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    rects.push((await read())?.rect ?? 'FROZEN');
  }
  const last = await read();
  if (!first || !last) return console.log(`DIAG ${label} main thread did not answer within 10 s`);
  const ro = Object.fromEntries(
    Object.entries(last.ro).map(([key, value]) => [key, value - (first.ro[key] || 0)]).filter(([, v]) => (v as number) > 0),
  );
  console.log(
    `DIAG ${label} over ~3s: raf=${last.raf - first.raf} mutations=${last.mutations - first.mutations} resizeObserver=${JSON.stringify(ro)} rects=${JSON.stringify(rects)}`,
  );
}

test('diagnose page outline flow', async ({ page }) => {
  test.setTimeout(180_000);
  await instrument(page);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/admin/#pages/research');
  await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
  const outline = page.getByRole('complementary', { name: 'Page outline' });
  await outline.getByRole('button', { name: /^Edit section:/ }).first().click();
  await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
  await sample(page, 'outline:editor-open', '.rich-editor-wrap');
  await outline.getByRole('button', { name: 'Open page settings' }).click();
  await sample(page, 'outline:settings-open', 'button[aria-pressed="false"]');
});

test('diagnose phone sidebar flow', async ({ page }) => {
  test.setTimeout(180_000);
  await instrument(page);
  await page.goto('/admin/#pages/research');
  await page.getByRole('button', { name: 'Page settings', exact: true }).click();
  await sample(page, 'phone:desktop-settings', 'body');
  await page.setViewportSize({ width: 390, height: 844 });
  await sample(page, 'phone:390', 'button[aria-label="Toggle sidebar"]');
});
