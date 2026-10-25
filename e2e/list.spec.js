// Basic list features from version 1 (spec 3.1–3.8) and the quantity label (9.1).

import { test, expect } from '@playwright/test';
import {
  openApp,
  nameInput,
  addItems,
  toBuyNames,
  boughtNames,
  expectToBuy,
  groupTitles,
} from './helpers.js';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('shows the empty state on first start', async ({ page }) => {
  await expect(page.getByText('Lista jest pusta.')).toBeVisible();
  await expect(page.locator('#progress')).toBeHidden();
});

test('adds a product, clears the field and keeps focus in it', async ({ page }) => {
  await addItems(page, 'mleko');

  await expectToBuy(page, ['mleko']);
  await expect(nameInput(page)).toHaveValue('');
  await expect(nameInput(page)).toBeFocused();
  await expect(page.getByText('0 z 1 kupione')).toBeVisible();
  await expect(page.getByText('Lista jest pusta.')).toBeHidden();
});

test('adds with the "Dodaj" button too', async ({ page }) => {
  await nameInput(page).fill('chleb');
  await page.getByRole('button', { name: 'Dodaj', exact: true }).click();
  await expectToBuy(page, ['chleb']);
});

test('ignores an empty name', async ({ page }) => {
  await addItems(page, '   ');
  await expect(toBuyNames(page)).toHaveCount(0);
});

test('checking moves a product to "Kupione" and back', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');

  await page.getByRole('checkbox', { name: 'chleb' }).check();
  await expectToBuy(page, ['mleko']);
  await expect(boughtNames(page)).toHaveText(['chleb']);
  await expect(page.getByText('1 z 2 kupione')).toBeVisible();

  await page.getByRole('checkbox', { name: 'chleb' }).uncheck();
  await expectToBuy(page, ['chleb', 'mleko']);
});

test('a duplicate is not added and the existing product is highlighted', async ({ page }) => {
  await addItems(page, 'mleko 2 l', 'chleb');
  await page.getByRole('checkbox', { name: 'mleko 2 l' }).check();

  await addItems(page, 'Mleko 3 l');

  // Back in "to buy" with the new quantity, still only one milk
  // (Nabiał comes after Pieczywo, so it is listed second).
  await expectToBuy(page, ['chleb', 'Mleko 3 l']);
  await expect(boughtNames(page)).toHaveCount(0);
  await expect(page.locator('#to-buy-section li.highlight')).toHaveCount(1);
});

test('shows the quantity as a separate label', async ({ page }) => {
  await addItems(page, 'mleko 2 l', 'mąka typ 450');

  await expect(page.locator('.item-quantity')).toHaveText(['2 l']);
});

test('edits a name in place with Enter, cancels with Escape', async ({ page }) => {
  await addItems(page, 'mleko 2 l');

  await page.getByRole('button', { name: 'Edytuj: mleko 2 l' }).click();
  const editor = page.locator('.item-name-input');
  // The editor shows the full name, quantity included.
  await expect(editor).toHaveValue('mleko 2 l');
  await editor.fill('mleko 3 l');
  await editor.press('Enter');
  await expectToBuy(page, ['mleko 3 l']);

  await page.getByRole('button', { name: 'Edytuj: mleko 3 l' }).click();
  await editor.fill('coś innego');
  await editor.press('Escape');
  await expectToBuy(page, ['mleko 3 l']);
});

test('rejects a rename to an existing product', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko 2 l');

  await page.getByRole('button', { name: 'Edytuj: chleb' }).click();
  await page.locator('.item-name-input').fill('mleko 1 l');
  await page.locator('.item-name-input').press('Enter');

  await expect(page.getByText('Taki produkt już jest na liście.')).toBeVisible();
  await expectToBuy(page, ['chleb', 'mleko 2 l']);
});

test('removes a product and brings it back with "Cofnij"', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');

  await page.getByRole('button', { name: 'Usuń: chleb' }).click();
  await expectToBuy(page, ['mleko']);
  await expect(page.getByText('Usunięto: chleb')).toBeVisible();

  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expectToBuy(page, ['chleb', 'mleko']);
});

test('clears bought products, with undo', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');
  await page.getByRole('checkbox', { name: 'chleb' }).check();

  await page.getByRole('button', { name: 'Wyczyść kupione' }).click();
  await expect(boughtNames(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Wyczyść kupione' })).toBeHidden();

  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(boughtNames(page)).toHaveText(['chleb']);
});

test('keeps the list after reloading the page', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');
  await page.getByRole('checkbox', { name: 'mleko' }).check();

  await page.reload();

  await expectToBuy(page, ['chleb']);
  await expect(boughtNames(page)).toHaveText(['mleko']);
});

test('loads a list saved by version 1.1 after the update', async ({ page }) => {
  const item = (id, name, checked) => ({
    id, name, checked, createdAt: 1000, checkedAt: checked ? 2000 : null, categoryId: null,
  });
  const v1 = {
    version: 1,
    activeListId: 'l_1',
    lists: [{
      id: 'l_1',
      name: 'Zakupy',
      items: [item('i_1', 'masło', false), item('i_2', 'chleb', false), item('i_3', 'mleko', true)],
    }],
  };
  await page.evaluate((data) => localStorage.setItem('sprawunki', JSON.stringify(data)), v1);
  await page.reload();

  // The migration gave the old items categories from the dictionary.
  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Nabiał']);
  await expectToBuy(page, ['chleb', 'masło']);
  await expect(boughtNames(page)).toHaveText(['mleko']);
  await expect(page.getByRole('status')).toBeEmpty();
});

test('starts with an empty list and a message when saved data is corrupted', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('sprawunki', '{not json'));
  await page.reload();

  await expect(page.getByText('Nie udało się odczytać zapisanej listy.', { exact: false })).toBeVisible();
  await expect(page.getByText('Lista jest pusta.')).toBeVisible();
});

test('groups "to buy" by category, in the order of categories', async ({ page }) => {
  await addItems(page, 'baterie', 'mleko', 'chleb', 'ser');

  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Nabiał', 'Bez kategorii']);
  await expectToBuy(page, ['chleb', 'mleko', 'ser', 'baterie']);
});

test('shows no headings when nothing has a category', async ({ page }) => {
  await addItems(page, 'baterie', 'klej');

  await expect(groupTitles(page)).toHaveCount(0);
  await expectToBuy(page, ['baterie', 'klej']);
});

test('bought products are not grouped', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');
  await page.getByRole('checkbox', { name: 'chleb' }).check();
  await page.getByRole('checkbox', { name: 'mleko' }).check();

  await expect(groupTitles(page)).toHaveCount(0);
  await expect(boughtNames(page)).toHaveText(['mleko', 'chleb']);
});
