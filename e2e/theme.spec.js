// Theme (spec 12.2, 12.5). The settings dialog comes in a later step, so these
// tests put the saved theme into localStorage before the app starts and check
// the colors the user sees: the page background and the browser UI color.

import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const LIGHT_BG = 'rgb(244, 246, 249)';
const DARK_BG = 'rgb(17, 19, 24)';

async function saveTheme(page, theme) {
  await page.addInitScript((theme) => localStorage.setItem('sprawunki-theme', theme), theme);
}

function expectBackground(page, color) {
  return expect(page.locator('body')).toHaveCSS('background-color', color);
}

// The content of the theme-color tag the browser uses for the current system theme.
function themeColor(page) {
  return page.evaluate(
    () => [...document.querySelectorAll('meta[name="theme-color"]')].find((m) => matchMedia(m.media).matches).content,
  );
}

test('without a saved theme follows the system, also when it changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
  await expectBackground(page, LIGHT_BG);
  expect(await themeColor(page)).toBe('#f4f6f9');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectBackground(page, DARK_BG);
  expect(await themeColor(page)).toBe('#111318');
});

test('a saved dark theme wins over a light system theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await saveTheme(page, 'dark');
  await openApp(page);

  await expectBackground(page, DARK_BG);
  expect(await themeColor(page)).toBe('#111318');
});

test('a saved light theme wins over a dark system theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await saveTheme(page, 'light');
  await openApp(page);

  await expectBackground(page, LIGHT_BG);
  expect(await themeColor(page)).toBe('#f4f6f9');
});

test('an unknown saved value means the system theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await saveTheme(page, 'purple');
  await openApp(page);

  await expectBackground(page, DARK_BG);
});

// The script in <head> must set the theme on its own, before main.js runs,
// or a dark theme would flash white at start. Blocking main.js proves it.
test('the theme is applied before the app script runs', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await saveTheme(page, 'dark');
  await page.route('**/src/main.js', (route) => route.abort());
  await openApp(page);

  await expectBackground(page, DARK_BG);
});
