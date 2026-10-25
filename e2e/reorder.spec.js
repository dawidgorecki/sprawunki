// Manual order of "to buy" items (spec 9.2) within a category group (10.3):
// keyboard, mouse and finger. Most tests use dairy products, so they share a group.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy, boughtNames, groupTitles } from './helpers.js';

function handle(page, name) {
  return page.getByRole('button', { name: `Zmień kolejność: ${name}` });
}

// Drags the handle of `name` onto the row of `targetName`, a bit past its middle,
// because the dragged item takes a place only after crossing the other item's middle.
// Uses the mouse on the desktop and a real touch gesture on the phone.
async function drag(page, isMobile, name, targetName) {
  const from = await handle(page, name).boundingBox();
  const target = await page.locator('#to-buy-section li', { hasText: targetName }).boundingBox();
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  const goingDown = target.y > from.y;
  const endY = target.y + target.height / 2 + (goingDown ? 10 : -10);

  if (isMobile) {
    await touchDrag(page, startX, startY, endY);
  } else {
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 10 });
    await page.mouse.up();
  }
}

// Playwright's page.touchscreen can only tap, so the gesture goes straight to
// Chromium's DevTools protocol. Chromium turns these touches into pointer events,
// exactly as on a phone, so this also checks `touch-action: none` on the handle.
async function touchDrag(page, x, startY, endY) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });

  await touch('touchStart', startY);
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', startY + ((endY - startY) * i) / steps);
  }
  await touch('touchEnd');
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await addItems(page, 'mleko', 'ser', 'jogurt');
});

test('arrow keys on the handle move a product and keep focus', async ({ page }) => {
  await handle(page, 'jogurt').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');

  await expectToBuy(page, ['jogurt', 'mleko', 'ser']);
  await expect(handle(page, 'jogurt')).toBeFocused();

  // Already at the top: nothing happens.
  await page.keyboard.press('ArrowUp');
  await expectToBuy(page, ['jogurt', 'mleko', 'ser']);
});

test('dragging the handle moves a product down', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'mleko', 'jogurt');
  await expectToBuy(page, ['ser', 'jogurt', 'mleko']);
});

test('dragging the handle moves a product up', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'jogurt', 'mleko');
  await expectToBuy(page, ['jogurt', 'mleko', 'ser']);
});

test('the new order survives a reload', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'jogurt', 'mleko');
  await page.reload();
  await expectToBuy(page, ['jogurt', 'mleko', 'ser']);
});

test('an unchecked product returns to its place in the manual order', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'jogurt', 'mleko');

  await page.getByRole('checkbox', { name: 'mleko' }).check();
  await expect(boughtNames(page)).toHaveText(['mleko']);
  await page.getByRole('checkbox', { name: 'mleko' }).uncheck();

  await expectToBuy(page, ['jogurt', 'mleko', 'ser']);
});

test('bought products have no handle', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'mleko' }).check();
  await expect(handle(page, 'mleko')).toHaveCount(0);
});

test('a product cannot be dragged out of its group', async ({ page, isMobile }) => {
  await addItems(page, 'chleb'); // Pieczywo, shown above Nabiał
  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Nabiał']);

  await drag(page, isMobile, 'jogurt', 'chleb');

  // Stopped at the top of its own group.
  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Nabiał']);
  await expectToBuy(page, ['chleb', 'jogurt', 'mleko', 'ser']);
});

test('arrow keys stop at the edge of the group', async ({ page }) => {
  await addItems(page, 'chleb');

  await handle(page, 'mleko').focus();
  await page.keyboard.press('ArrowUp');

  await expectToBuy(page, ['chleb', 'mleko', 'ser', 'jogurt']);
});
