import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import base from '../../playwright.config';
const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: 'findings.spec.ts',
  reporter: [
    ['list'],
    ['json', { outputFile: `${root}/.artifacts/comprehensive-audit/findings-results.json` }],
  ],
  outputDir: '../../.artifacts/comprehensive-audit/test-results',
  webServer: {
    command: 'node scripts/test-server.mjs',
    cwd: root,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
