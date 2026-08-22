import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30000,
  use: { baseURL: 'http://localhost:3311', headless: true, launchOptions: { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] } },
  reporter: [['list']]
});
