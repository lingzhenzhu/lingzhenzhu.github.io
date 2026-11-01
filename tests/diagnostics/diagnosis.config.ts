import base from '../../playwright.config';
import { defineConfig, devices } from '@playwright/test';
// Temporary: Linux WebKit only, the tests that failed there, plus timing; full traces.
export default defineConfig({
  ...base,
  testDir: '..',
  testMatch: [
    'diagnostics/webkit-timing.spec.ts',
    'audit/findings.spec.ts',
    'browser/admin-glass.spec.ts',
    'browser/accessibility.spec.ts',
  ],
  maxFailures: 0,
  reporter: 'line',
  use: { ...base.use, trace: 'on' },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }],
});
