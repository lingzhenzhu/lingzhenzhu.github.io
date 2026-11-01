import { test, type Page } from '@playwright/test';

// Temporary diagnosis for Linux WebKit in CI. In the state where clicks never become "stable",
// measure frames per second while switching individual rendering features off in this test page
// only. Nothing asserts and the product CSS is untouched.
const variants: [string, string][] = [
  ['baseline', ''],
  ['no-backdrop-filter', '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
  ['no-filter', '*,*::before,*::after{filter:none!important}.glass-optics{display:none!important}'],
  ['no-shadow', '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important}'],
  ['no-background-image', '*,*::before,*::after{background-image:none!important}'],
  ['no-pseudo', '[data-glass]::before,[data-glass]::after{display:none!important}'],
];
async function fps(page: Page) {
  return Promise.race([
    page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const tick = () => {
            frames++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(() => resolve(frames / 2), 2000);
        }),
    ),
    new Promise<string>((resolve) => setTimeout(() => resolve('no answer'), 15_000)),
  ]);
}
async function measure(page: Page, label: string) {
  const media = await page.evaluate(() => ({
    contrastMore: matchMedia('(prefers-contrast: more)').matches,
    dpr: devicePixelRatio,
    size: innerWidth + 'x' + innerHeight,
  }));
  const results: string[] = [];
  for (const [name, css] of variants) {
    await page.evaluate((css) => {
      document.getElementById('diagnosis-style')?.remove();
      if (!css) return;
      const style = document.createElement('style');
      style.id = 'diagnosis-style';
      style.textContent = css;
      document.head.appendChild(style);
    }, css);
    results.push(`${name}=${await fps(page)}`);
  }
  await page.evaluate(() => document.getElementById('diagnosis-style')?.remove());
  console.log(`DIAG ${label} ${JSON.stringify(media)} fps: ${results.join(' ')}`);
}
async function stuckState(page: Page) {
  await page.goto('/admin/#pages/research');
  await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
  const outline = page.getByRole('complementary', { name: 'Page outline' });
  await outline.getByRole('button', { name: /^Edit section:/ }).first().click();
  await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
  await outline.getByRole('button', { name: 'Open page settings' }).click();
}

for (const scale of [2, 1]) {
  test(`diagnose frame cost at ${scale}x pixel density`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await stuckState(page);
    await measure(page, `outline-settings ${scale}x`);
    await context.close();
  });
}
