// The "Ustawienia" dialog (spec 12.1), the theme switch in it (spec 12.2)
// and the "O aplikacji" section (spec 12.3).
// How each theme looks at start is checked in theme.spec.js.

import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { openApp, addItems } from './helpers.js';

const LIGHT_BG = 'rgb(244, 246, 249)';
const DARK_BG = 'rgb(17, 19, 24)';

function dialog(page) {
  return page.getByRole('dialog', { name: 'Ustawienia' });
}

function themeGroup(page) {
  return dialog(page).getByRole('group', { name: 'Motyw' });
}

async function openDialog(page) {
  await page.getByRole('button', { name: 'Ustawienia' }).click();
  await expect(dialog(page)).toBeVisible();
}

function expectBackground(page, color) {
  return expect(page.locator('body')).toHaveCSS('background-color', color);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openApp(page);
});

test('opens and closes with "Gotowe" and Escape', async ({ page }) => {
  await openDialog(page);
  await dialog(page).getByRole('button', { name: 'Gotowe' }).click();
  await expect(dialog(page)).toBeHidden();

  await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('"Automatyczny" is chosen when nothing was saved', async ({ page }) => {
  await openDialog(page);

  await expect(themeGroup(page).getByRole('radio', { name: 'Automatyczny' })).toBeChecked();
});

test('a theme works at once, with the dialog still open', async ({ page }) => {
  await openDialog(page);

  await themeGroup(page).getByText('Ciemny').click();
  await expectBackground(page, DARK_BG);
  await expect(dialog(page)).toBeVisible();

  await themeGroup(page).getByText('Jasny').click();
  await expectBackground(page, LIGHT_BG);
});

test('the chosen theme survives a reload', async ({ page }) => {
  await openDialog(page);
  await themeGroup(page).getByText('Ciemny').click();

  await page.reload();

  await expectBackground(page, DARK_BG);
  await openDialog(page);
  await expect(themeGroup(page).getByRole('radio', { name: 'Ciemny' })).toBeChecked();
});

test('"Automatyczny" follows the system again', async ({ page }) => {
  await openDialog(page);
  await themeGroup(page).getByText('Ciemny').click();
  await themeGroup(page).getByText('Automatyczny').click();
  await expectBackground(page, LIGHT_BG);

  await page.emulateMedia({ colorScheme: 'dark' });
  await expectBackground(page, DARK_BG);

  await page.reload();
  await openDialog(page);
  await expect(themeGroup(page).getByRole('radio', { name: 'Automatyczny' })).toBeChecked();
});

test('the arrow keys move between the options', async ({ page }) => {
  await openDialog(page);
  const auto = themeGroup(page).getByRole('radio', { name: 'Automatyczny' });
  await auto.focus();

  // Arrow right from the last option wraps to the first, as in any radio group.
  await page.keyboard.press('ArrowRight');
  await expect(themeGroup(page).getByRole('radio', { name: 'Jasny' })).toBeChecked();
  await page.keyboard.press('ArrowRight');
  await expect(themeGroup(page).getByRole('radio', { name: 'Ciemny' })).toBeChecked();
  await expectBackground(page, DARK_BG);
});

test('the theme does not touch the list data', async ({ page }) => {
  await addItems(page, 'mleko');
  const before = await page.evaluate(() => localStorage.getItem('sprawunki'));

  await openDialog(page);
  await themeGroup(page).getByText('Ciemny').click();

  expect(await page.evaluate(() => localStorage.getItem('sprawunki'))).toBe(before);
});

test('"O aplikacji" shows the name, the version from package.json and the author', async ({ page }) => {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  await openDialog(page);

  const about = dialog(page).getByRole('region', { name: 'O aplikacji' });
  await expect(about).toContainText('Sprawunki');
  await expect(about).toContainText(`Wersja ${version}`);
  await expect(about).toContainText('Autor: Dawid Górecki');
});

// Spec 12.1: on a narrow phone the header with four buttons stays on one line.
test('the header fits a 360 px wide screen with a long list name', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.getByRole('button', { name: 'Listy' }).click();
  const listsDialog = page.getByRole('dialog', { name: 'Listy' });
  const newListName = listsDialog.getByRole('textbox', { name: 'Nazwa nowej listy' });
  await newListName.fill('Bardzo długa nazwa listy zakupów');
  await newListName.press('Enter');
  await listsDialog.getByRole('button', { name: 'Gotowe' }).click();
  await page.getByRole('button', { name: /^Lista:/ }).click();
  await page.getByRole('button', { name: /^Bardzo długa/ }).click();
  // Shows the wake lock switch too, as on a phone that supports it.
  await page.evaluate(() => (document.getElementById('wake-lock').hidden = false));

  const header = await page.locator('header').boundingBox();
  const firstButton = await page.getByRole('button', { name: 'Listy', exact: true }).boundingBox();
  const lastButton = await page.getByRole('button', { name: 'Ustawienia' }).boundingBox();
  // Where the text itself ends, not its box, which always takes the free space.
  const textRight = (selector) =>
    page.locator(selector).evaluate((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect().right;
    });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  expect(lastButton.x + lastButton.width).toBeLessThanOrEqual(header.x + header.width);
  expect(lastButton.y).toBe(firstButton.y);
  expect(await textRight('h1')).toBeLessThanOrEqual(firstButton.x);
  // The list name is cut with "…" before the buttons.
  const listName = await page.locator('.list-picker-name').boundingBox();
  expect(listName.x + listName.width).toBeLessThanOrEqual(firstButton.x);
  await page.locator('header').screenshot({ path: 'test-results/header-360.png' });
});
