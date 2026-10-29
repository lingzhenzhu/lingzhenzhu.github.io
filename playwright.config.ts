import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests',
  testMatch: ['browser/**/*.spec.ts', 'audit/findings.spec.ts', 'independent/**/*.spec.ts'],
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/test-server.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects:
    process.env.CI || process.env.CROSS_BROWSER
      ? [
          {
            name: process.env.CI ? 'chromium' : 'edge',
            use: process.env.CI
              ? { ...devices['Desktop Chrome'] }
              : { ...devices['Desktop Edge'], channel: 'msedge' },
          },
          { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
          { name: 'webkit', use: { ...devices['Desktop Safari'] } },
        ]
      : [{ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } }],
});
