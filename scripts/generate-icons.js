// Generates the PNG icons in public/ from design/icon.svg: npm run icons
//
// Uses the Chromium that Playwright already installed for the browser tests,
// so no image library is needed. The SVG is drawn as an <img> at each target
// size (sharp, not a scaled-down bitmap) and saved as a screenshot.

import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../design/icon.svg', import.meta.url));
const svgUrl = `data:image/svg+xml;base64,${svg.toString('base64')}`;

// radius: rounded corners with transparency, for the browser tab only.
// The other icons stay square: Android and iOS cut their own shape.
const ICONS = [
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon.png', size: 64, radius: 12 },
];

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { file, size, radius = 0 } of ICONS) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`
    <style>html, body { margin: 0; background: transparent; }</style>
    <img src="${svgUrl}" width="${size}" height="${size}"
         style="display: block; border-radius: ${radius}px">
  `);
  await page.locator('img').evaluate((img) => img.decode());
  await page.screenshot({ path: file, omitBackground: true });
  console.log(`${file} (${size} × ${size})`);
}

await browser.close();
