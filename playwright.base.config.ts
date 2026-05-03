import { PlaywrightTestConfig } from '@playwright/test';

const commonPlaywrightConfig: PlaywrightTestConfig = {
  fullyParallel: true,
  forbidOnly: !!process.env['PW_CI'],
  retries: parseInt(process.env['PW_RETRIES'] ?? '0', 10),
  workers: 5,
  use: {
    trace: process.env['PW_CI'] ? 'off' : 'on-first-retry',
    screenshot: 'only-on-failure',
    testIdAttribute: 'data-pw-selector',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  timeout: 50 * 1000,
};

export default commonPlaywrightConfig;
