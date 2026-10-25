// Browser tests of the user interface (Playwright). They click through the real
// app in Chromium, like a user would. Logic tests stay in tests/ (Vitest).
//
// npm run test:e2e      – run all browser tests
// npm run test:e2e:ui   – the same with a window showing every step

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  // A failed test leaves a trace (DOM snapshots, clicks, console) for `npx playwright show-trace`.
  use: {
    baseURL: 'http://localhost:5173/sprawunki/',
    trace: 'retain-on-failure',
  },
  // Every test runs twice: on a desktop and on an emulated Android phone with a touch screen.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  // Starts the dev server for the tests, or uses the one already running (`npm run dev`).
  webServer: {
    command: 'npm run dev -- --strictPort',
    url: 'http://localhost:5173/sprawunki/',
    reuseExistingServer: true,
  },
});
