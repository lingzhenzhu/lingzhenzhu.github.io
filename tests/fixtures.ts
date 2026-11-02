import { test as base, expect } from '@playwright/test';

/**
 * Linux WebKit in CI has no GPU: every glass layer's backdrop blur is computed on the CPU, and a
 * single Admin frame then takes several seconds, so clicks time out waiting for a stable layout.
 * (Measured 2026-11-02: one tab switch took over 43 s with the blur and 1.3 s without it.)
 * There only, pages are tested without the blur; the product CSS is untouched, and Chromium,
 * Firefox and local WebKit keep rendering and checking the real glass.
 */
export const cpuGlass = (browserName: string) =>
  browserName === 'webkit' && !!process.env.CI && process.platform === 'linux';

export const test = base.extend({
  context: async ({ context, browserName }, provide) => {
    if (cpuGlass(browserName))
      await context.addInitScript(() => {
        const add = () => {
          const style = document.createElement('style');
          style.textContent =
            '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
          (document.head || document.documentElement).appendChild(style);
        };
        if (document.documentElement) add();
        else document.addEventListener('readystatechange', add, { once: true });
      });
    await provide(context);
  },
});
export { expect };
