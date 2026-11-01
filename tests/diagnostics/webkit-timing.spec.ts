import { test, type Browser } from '@playwright/test';

// Temporary diagnosis for Linux WebKit in CI: after each UI change the next frame takes seconds.
// A fresh page per variant, the variant CSS injected before the app loads (test page only),
// then the same user flow timed with Playwright's own clicks. Nothing asserts.
const variants: [string, string, number][] = [
  ['baseline', '', 2],
  ['baseline-1x', '', 1],
  ['no-glass-optics', '.glass-optics{display:none!important}', 2],
  ['no-backdrop-filter', '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}', 2],
  ['no-filter', '*,*::before,*::after{filter:none!important}', 2],
];
async function flow(browser: Browser, name: string, css: string, scale: number) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: scale });
  const page = await context.newPage();
  if (css)
    await page.addInitScript((css) => {
      addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      });
    }, css);
  const times: string[] = [];
  const step = async (label: string, action: () => Promise<unknown>) => {
    const start = Date.now();
    try {
      await action();
      times.push(`${label}=${Date.now() - start}`);
    } catch {
      times.push(`${label}=FAILED>${Date.now() - start}`);
      throw new Error('stop');
    }
  };
  try {
    await step('load', async () => {
      await page.goto('/admin/#pages/research');
      await page.getByRole('button', { name: 'Hide preview', exact: true }).click({ timeout: 40_000 });
    });
    await step('editor', () =>
      page
        .getByRole('complementary', { name: 'Page outline' })
        .getByRole('button', { name: /^Edit section:/ })
        .first()
        .click({ timeout: 40_000 }),
    );
    await step('settings', () => page.getByRole('button', { name: 'Page settings', exact: true }).click({ timeout: 40_000 }));
    await step('content', () => page.getByRole('button', { name: 'Content', exact: true }).click({ timeout: 40_000 }));
    await step('settings2', () => page.getByRole('button', { name: 'Page settings', exact: true }).click({ timeout: 40_000 }));
  } catch {}
  console.log(`DIAG ${name}: ${times.join(' ')} ms`);
  await context.close();
}
for (const [name, css, scale] of variants)
  test(`diagnose ${name}`, async ({ browser }) => {
    test.setTimeout(240_000);
    await flow(browser, name, css, scale);
  });
