import { test } from '@playwright/test';

// Temporary diagnosis for slow Linux WebKit in CI: identical Admin interactions, timed with the
// normal rendering and with the glass layers' own reduced-transparency fallback. Nothing asserts.
for (const contrast of ['no-preference', 'more'] as const) {
  test(`Admin interaction timing, contrast ${contrast}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ contrast });
    const started = Date.now();
    await page.goto('/admin/#pages/home');
    await page.getByRole('button', { name: 'Page settings', exact: true }).waitFor();
    const ready = Date.now() - started;
    const clicks: number[] = [];
    for (let i = 0; i < 6; i++) {
      const tab = i % 2 ? 'Content' : 'Page settings';
      const before = Date.now();
      await page.getByRole('button', { name: tab, exact: true }).click();
      clicks.push(Date.now() - before);
    }
    const frames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const end = performance.now() + 1000;
          const tick = () => (performance.now() < end ? (count++, requestAnimationFrame(tick)) : resolve(count));
          requestAnimationFrame(tick);
        }),
    );
    const typing = Date.now();
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    await page.getByLabel('Description', { exact: true }).pressSequentially('timing', { delay: 0 });
    const typed = Date.now() - typing;
    console.log(
      `TIMING contrast=${contrast} ready=${ready}ms clicks=${clicks.join(',')}ms framesPerSecond=${frames} type6chars=${typed}ms`,
    );
  });
}
