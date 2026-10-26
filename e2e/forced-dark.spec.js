// "Jasny" and "Ciemny" when Chrome darkens pages by itself (spec 12.2).
// Chrome on Android has a "dark theme for sites" setting that darkens light
// pages; "Jasny" must stay light even then. The browser here is started with
// that darkening switched on. It happens while drawing, so the CSS still says
// "light": only a pixel of a screenshot shows what the user sees.

import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

const LIGHT_BG = 'rgb(244, 246, 249)';
const DARK_BG = 'rgb(17, 19, 24)';

test.use({ launchOptions: { args: ['--blink-settings=forceDarkModeEnabled=true'] } });

async function saveTheme(page, theme) {
  await page.addInitScript((theme) => localStorage.setItem('sprawunki-theme', theme), theme);
}

async function backgroundPixel(page) {
  const png = await page.screenshot({ clip: { x: 5, y: 150, width: 1, height: 1 } });
  return page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  }, `data:image/png;base64,${png.toString('base64')}`);
}

test('"Jasny" stays light', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await saveTheme(page, 'light');
  await openApp(page);

  expect(await backgroundPixel(page)).toBe(LIGHT_BG);
});

test('"Ciemny" uses its own colors', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await saveTheme(page, 'dark');
  await openApp(page);

  expect(await backgroundPixel(page)).toBe(DARK_BG);
});
