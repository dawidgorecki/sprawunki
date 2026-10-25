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

// Names of the "to buy" items in the order shown on screen. The quantity label
// is part of the name button, so "mleko 2 l" reads as "mleko 2 l".
export function toBuyNames(page) {
  return page.locator('#to-buy-list .item-name');
}

export function boughtNames(page) {
  return page.locator('#bought-list .item-name');
}

export async function expectToBuy(page, names) {
  await expect(toBuyNames(page)).toHaveText(names);
}
