import { test, type Page } from '@playwright/test';

// Temporary diagnosis for Linux WebKit in CI. After each UI change the next frame takes seconds.
// For each rendering feature switched off in this test page only, time one identical tab switch
// until two frames have rendered. Nothing asserts and the product is untouched.
const variants: [string, string][] = [
  ['baseline', ''],
  ['no-backdrop-filter', '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'],
  ['no-filter', '*,*::before,*::after{filter:none!important}.glass-optics{display:none!important}'],
  ['no-shadow', '*,*::before,*::after{box-shadow:none!important;text-shadow:none!important}'],
  ['no-background-image', '*,*::before,*::after{background-image:none!important}'],
  ['no-glass-pseudo', '[data-glass]::before,[data-glass]::after{display:none!important}'],
  ['no-mask-clip', '*,*::before,*::after{mask:none!important;-webkit-mask:none!important;clip-path:none!important}'],
];
const settle = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        // Wait until frames flow again: ten consecutive frames.
        let streak = 0;
        const tick = () => (++streak >= 10 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
      }),
  );
const switchCost = (page: Page, tab: string) =>
  page.evaluate(
    (tab) =>
      new Promise<number>((resolve) => {
        const button = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === tab)!;
        const start = performance.now();
        button.click();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - start))));
      }),
    tab,
  );

for (const scale of [2, 1]) {
  test(`diagnose tab switch frame cost at ${scale}x`, async ({ browser }) => {
    test.setTimeout(420_000);
    const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: scale });
    const page = await context.newPage();
    await page.goto('/admin/#pages/research');
    await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
    await page.getByRole('complementary', { name: 'Page outline' }).getByRole('button', { name: /^Edit section:/ }).first().click();
    await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
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
      await settle(page);
      const toSettings = await switchCost(page, 'Page settings');
      await settle(page);
      const toContent = await switchCost(page, 'Content');
      await settle(page);
      results.push(`${name}=${toSettings}/${toContent}ms`);
    }
    console.log(`DIAG ${scale}x tab switch (settings/content): ${results.join(' ')}`);
    await context.close();
  });
}
