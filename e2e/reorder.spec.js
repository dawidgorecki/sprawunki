// Manual order of "to buy" items (spec 9.2): keyboard, mouse and finger.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy, boughtNames } from './helpers.js';

function handle(page, name) {
  return page.getByRole('button', { name: `Zmień kolejność: ${name}` });
}

// Drags the handle of `name` onto the row of `targetName`, a bit past its middle,
// because the dragged item takes a place only after crossing the other item's middle.
// Uses the mouse on the desktop and a real touch gesture on the phone.
async function drag(page, isMobile, name, targetName) {
  const from = await handle(page, name).boundingBox();
  const target = await page.locator('#to-buy-list li', { hasText: targetName }).boundingBox();
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
  await addItems(page, 'chleb', 'mleko', 'masło');
});

test('arrow keys on the handle move a product and keep focus', async ({ page }) => {
  await handle(page, 'masło').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');

  await expectToBuy(page, ['masło', 'chleb', 'mleko']);
  await expect(handle(page, 'masło')).toBeFocused();

  // Already at the top: nothing happens.
  await page.keyboard.press('ArrowUp');
  await expectToBuy(page, ['masło', 'chleb', 'mleko']);
});

test('dragging the handle moves a product down', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'chleb', 'masło');
  await expectToBuy(page, ['mleko', 'masło', 'chleb']);
});

test('dragging the handle moves a product up', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'masło', 'chleb');
  await expectToBuy(page, ['masło', 'chleb', 'mleko']);
});

test('the new order survives a reload', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'masło', 'chleb');
  await page.reload();
  await expectToBuy(page, ['masło', 'chleb', 'mleko']);
});

test('an unchecked product returns to its place in the manual order', async ({ page, isMobile }) => {
  await drag(page, isMobile, 'masło', 'chleb');

  await page.getByRole('checkbox', { name: 'chleb' }).check();
  await expect(boughtNames(page)).toHaveText(['chleb']);
  await page.getByRole('checkbox', { name: 'chleb' }).uncheck();

  await expectToBuy(page, ['masło', 'chleb', 'mleko']);
});

test('bought products have no handle', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'mleko' }).check();
  await expect(handle(page, 'mleko')).toHaveCount(0);
});
