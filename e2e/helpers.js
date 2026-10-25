// Small helpers shared by the browser tests. Elements are found the way a user
// (or a screen reader) finds them: by role and visible label, not by CSS classes,
// so the tests also check that labels are in place.

import { expect } from '@playwright/test';

export async function openApp(page) {
  // Each test gets a fresh browser context, so localStorage starts empty.
  await page.goto('./');
}

export function nameInput(page) {
  return page.getByRole('textbox', { name: 'Nazwa produktu' });
}

export async function addItems(page, ...names) {
  for (const name of names) {
    await nameInput(page).fill(name);
    await nameInput(page).press('Enter');
  }
}

// Names of the "to buy" items in the order shown on screen, group after group.
// The quantity label is part of the name button, so "mleko 2 l" reads as "mleko 2 l".
export function toBuyNames(page) {
  return page.locator('#to-buy-section .item-name');
}

export function groupTitles(page) {
  return page.locator('#to-buy-section .group-title');
}

export function boughtNames(page) {
  return page.locator('#bought-list .item-name');
}

export async function expectToBuy(page, names) {
  await expect(toBuyNames(page)).toHaveText(names);
}

// Drags a reorder handle onto a target row, a bit past its middle, because the
// dragged row takes a place only after crossing the other row's middle.
// Uses the mouse on the desktop and a real touch gesture on the phone.
export async function dragHandle(page, isMobile, handle, targetRow) {
  const from = await handle.boundingBox();
  const target = await targetRow.boundingBox();
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
