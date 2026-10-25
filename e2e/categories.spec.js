// Categories of products (spec 10.2–10.4): the picker next to every "to buy"
// item and the memory of choices.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy, groupTitles, boughtNames } from './helpers.js';

// A <select> has the role "combobox" for screen readers, and so for Playwright too.
function picker(page, name) {
  return page.getByRole('combobox', { name: `Kategoria: ${name}` });
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('shows the current category of a product', async ({ page }) => {
  await addItems(page, 'mleko', 'baterie');

  await expect(picker(page, 'mleko')).toHaveValue('c_dairy');
  // '' stands for "Bez kategorii".
  await expect(picker(page, 'baterie')).toHaveValue('');
});

test('lists all categories in their order, "Bez kategorii" last', async ({ page }) => {
  await addItems(page, 'mleko');

  await expect(picker(page, 'mleko').locator('option')).toHaveText([
    'Warzywa i owoce',
    'Pieczywo',
    'Nabiał',
    'Mięso i ryby',
    'Wędliny',
    'Mrożonki',
    'Spiżarnia',
    'Słodycze i przekąski',
    'Napoje',
    'Chemia i kosmetyki',
    'Bez kategorii',
  ]);
});

test('moves a product to the end of the chosen group', async ({ page }) => {
  await addItems(page, 'woda', 'mleko owsiane', 'ser');

  await picker(page, 'mleko owsiane').selectOption({ label: 'Napoje' });

  await expect(groupTitles(page)).toHaveText(['Nabiał', 'Napoje']);
  await expectToBuy(page, ['ser', 'woda', 'mleko owsiane']);
  await expect(page.locator('#to-buy-section li.highlight')).toHaveText(/mleko owsiane/);
});

test('remembers the choice for the next time', async ({ page }) => {
  await addItems(page, 'baterie AA');
  await picker(page, 'baterie AA').selectOption({ label: 'Chemia i kosmetyki' });

  // Gone from the list, but the memory stays (spec 10.2)…
  await page.getByRole('button', { name: 'Usuń: baterie AA' }).click();
  // …and works for the same product with another quantity, also after a reload.
  await page.reload();
  await addItems(page, 'Baterie AA x4');

  await expect(groupTitles(page)).toHaveText(['Chemia i kosmetyki']);
  await expect(picker(page, 'Baterie AA x4')).toHaveValue('c_household');
});

test('"Bez kategorii" turns the dictionary off for that product', async ({ page }) => {
  await addItems(page, 'mleko', 'chleb');
  await picker(page, 'mleko').selectOption({ label: 'Bez kategorii' });
  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Bez kategorii']);

  await page.getByRole('button', { name: 'Usuń: mleko' }).click();
  await addItems(page, 'mleko 2 l');

  await expect(picker(page, 'mleko 2 l')).toHaveValue('');
});

test('bought products have no category picker', async ({ page }) => {
  await addItems(page, 'mleko');
  await page.getByRole('checkbox', { name: 'mleko' }).check();

  await expect(boughtNames(page)).toHaveText(['mleko']);
  await expect(picker(page, 'mleko')).toHaveCount(0);
});

test('a bought product returns to its new category', async ({ page }) => {
  await addItems(page, 'mleko', 'woda');
  await picker(page, 'mleko').selectOption({ label: 'Napoje' });

  await page.getByRole('checkbox', { name: 'mleko' }).check();
  await page.getByRole('checkbox', { name: 'mleko' }).uncheck();

  await expect(groupTitles(page)).toHaveText(['Napoje']);
  await expectToBuy(page, ['woda', 'mleko']);
});
