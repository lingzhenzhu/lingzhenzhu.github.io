import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  outputDir: '../../.artifacts/independent-audit-2026-10-25/browser',
  reporter: [
    ['list'],
    ['json', { outputFile: '../../.artifacts/independent-audit-2026-10-25/results.json' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Edge'],
    channel: 'msedge',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
