import { defineConfig, devices } from '@playwright/test';

const frontendPort = 3311;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command:
      `cd /Users/kscold/Desktop/kscold-control/apps/frontend && VITE_PROXY_API_TARGET=http://127.0.0.1:4410 pnpm dev --host 127.0.0.1 --port ${frontendPort}`,
    url: `http://127.0.0.1:${frontendPort}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
