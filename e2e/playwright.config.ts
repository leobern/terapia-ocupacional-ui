import { defineConfig, devices } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

import commonPlaywrightConfig from '../playwright.base.config';

export default defineConfig({
  ...commonPlaywrightConfig,
  reporter: process.env['PW_CI']
    ? [
        ['github'],
        ['html', { open: 'never', outputFolder: '../dist/reports/e2e/report' }],
        ['list', { open: 'never', printSteps: true }],
        cucumberReporter('json', { outputFile: '../dist/reports/e2e/results.json' }),
      ]
    : [
        ['html', { open: 'never', outputFolder: '../dist/reports/e2e/report' }],
        ['dot', { open: 'never' }],
      ],
  projects: [
    {
      name: 'terapia-nutricional-ui',
      outputDir: '../dist/e2e/results',
      testDir: defineBddConfig({
        outputDir: '../dist/e2e/bdd',
        features: ['src/features/*.feature'],
        steps: ['src/step-definitions/*.steps.ts', 'src/fixtures/*.fixture.ts'],
      }),
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://127.0.0.1:4200/',
        headless: true,
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          chromiumSandbox: false,
          args: ['--disable-gpu', '--disable-extensions', '--disable-dev-shm-usage'],
          slowMo: process.env['PW_SLOW_MO'] ? 100 : undefined,
        },
      },
    },
  ],
  webServer: [
    {
      command: 'npm run serve:api',
      timeout: 60 * 1000,
      reuseExistingServer: !process.env['PW_CI'],
      ignoreHTTPSErrors: true,
      port: 3000,
    },
    {
      command: 'npm run serve:production',
      timeout: 60 * 1000,
      reuseExistingServer: !process.env['PW_CI'],
      ignoreHTTPSErrors: true,
      port: 4200,
    },
  ],
});
