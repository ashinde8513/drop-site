import { defineConfig, devices } from '@playwright/test';

// Live signed-in check (tests-live/) against production; no local server.
export default defineConfig({
  testDir: './tests-live',
  retries: 1,
  reporter: [['github'], ['list']],
  use: { baseURL: 'https://app.trydropapp.com', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
});
