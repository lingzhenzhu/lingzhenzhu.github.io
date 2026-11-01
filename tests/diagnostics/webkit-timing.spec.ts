import { test, type Page } from '@playwright/test';

// Temporary diagnosis for Linux WebKit in CI: in the state where clicks never become "stable",
// why does requestAnimationFrame stop? Nothing asserts and the product is untouched.
async function frames(page: Page, milliseconds: number) {
  return Promise.race([
    page.evaluate(
      (milliseconds) =>
        new Promise<string>((resolve) => {
          let count = 0;
          const tick = () => {
            count++;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          setTimeout(
            () =>
              resolve(
                `${count} frames/${milliseconds}ms visibility=${document.visibilityState} focus=${document.hasFocus()} active=${(document.activeElement as HTMLElement | null)?.tagName}`,
              ),
            milliseconds,
          );
        }),
      milliseconds,
    ),
    new Promise<string>((resolve) => setTimeout(() => resolve('no answer'), milliseconds + 15_000)),
  ]);
}

test('diagnose why animation frames stop', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/admin/#pages/research');
  console.log('DIAG after load:', await frames(page, 2000));
  await page.getByRole('button', { name: 'Hide preview', exact: true }).click();
  console.log('DIAG preview hidden:', await frames(page, 2000));
  const outline = page.getByRole('complementary', { name: 'Page outline' });
  await outline.getByRole('button', { name: /^Edit section:/ }).first().click();
  await page.getByRole('textbox', { name: 'Content editor' }).waitFor();
  console.log('DIAG editor open:', await frames(page, 2000));
  await outline.getByRole('button', { name: 'Open page settings' }).click();
  console.log('DIAG settings open:', await frames(page, 2000));
  console.log('DIAG settings open, 10s:', await frames(page, 10_000));
  await page.mouse.move(700, 500);
  await page.mouse.move(720, 520);
  console.log('DIAG after mouse move:', await frames(page, 2000));
  await page.keyboard.press('Shift');
  console.log('DIAG after key press:', await frames(page, 2000));
  await page.bringToFront();
  console.log('DIAG after bringToFront:', await frames(page, 2000));
  const editor = page.locator('.ProseMirror');
  console.log('DIAG editor still mounted:', await editor.count());
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  console.log('DIAG after blur:', await frames(page, 2000));
});
