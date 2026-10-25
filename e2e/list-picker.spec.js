// Switching lists (spec 11.2): the button with the active list's name and
// the "Wybierz listę" dialog.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy } from './helpers.js';

function pickerButton(page) {
  // The name is "Lista: <name>", so this does not match the "Listy" button.
  return page.getByRole('button', { name: /^Lista: / });
}

function picker(page) {
  return page.getByRole('dialog', { name: 'Wybierz listę' });
}

function option(page, name) {
  return picker(page).getByRole('button', { name: new RegExp(`^${name}\\b`) });
}

// Adds lists through the "Listy" dialog (spec 11.3).
async function addLists(page, ...names) {
  await page.getByRole('button', { name: 'Listy' }).click();
  const listsDialog = page.getByRole('dialog', { name: 'Listy' });
  const input = listsDialog.getByRole('textbox', { name: 'Nazwa nowej listy' });
  for (const name of names) {
    await input.fill(name);
    await input.press('Enter');
  }
  await listsDialog.getByRole('button', { name: 'Gotowe' }).click();
}

async function switchTo(page, name) {
  await pickerButton(page).click();
  await option(page, name).click();
  await expect(picker(page)).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('the button appears only when there is more than one list', async ({ page }) => {
  await expect(pickerButton(page)).toBeHidden();

  await addLists(page, 'Drogeria');
  await expect(pickerButton(page)).toBeVisible();
  await expect(pickerButton(page)).toHaveAccessibleName('Lista: Zakupy');
  await expect(pickerButton(page)).toHaveText(/Zakupy/);
  await expect(pickerButton(page)).toHaveAttribute('aria-haspopup', 'dialog');

  // Back to one list: the button goes away again.
  await page.getByRole('button', { name: 'Listy' }).click();
  await page.getByRole('button', { name: 'Usuń listę: Drogeria' }).click();
  await page.getByRole('button', { name: 'Gotowe' }).click();
  await expect(pickerButton(page)).toBeHidden();
});

test('shows all lists in order with counters, the active one marked', async ({ page }) => {
  await addItems(page, 'mleko', 'chleb', 'masło');
  await page.getByRole('checkbox', { name: 'mleko' }).check();
  await addLists(page, 'Drogeria', 'Apteka');

  await pickerButton(page).click();

  const options = picker(page).getByRole('button', { name: /^(?!Zamknij)/ });
  await expect(options).toHaveText(['✓Zakupy1/3', 'Drogeria', 'Apteka']);
  await expect(option(page, 'Zakupy')).toHaveAttribute('aria-current', 'true');
  await expect(option(page, 'Drogeria')).not.toHaveAttribute('aria-current');
});

test('closes with "Zamknij" or Escape without switching', async ({ page }) => {
  await addLists(page, 'Drogeria');

  await pickerButton(page).click();
  await picker(page).getByRole('button', { name: 'Zamknij' }).click();
  await expect(picker(page)).toBeHidden();

  await pickerButton(page).click();
  await page.keyboard.press('Escape');
  await expect(picker(page)).toBeHidden();
  await expect(pickerButton(page)).toHaveAccessibleName('Lista: Zakupy');
});

test('switching shows the other list; products go to the active list', async ({ page }) => {
  await addItems(page, 'mleko');
  await addLists(page, 'Drogeria');

  await switchTo(page, 'Drogeria');
  await expect(pickerButton(page)).toHaveAccessibleName('Lista: Drogeria');
  await expect(page.getByText('Lista jest pusta.')).toBeVisible();

  // The same product may be on several lists.
  await addItems(page, 'szampon', 'mleko');
  await expectToBuy(page, ['mleko', 'szampon']);

  await switchTo(page, 'Zakupy');
  await expectToBuy(page, ['mleko']);
  await expect(page.locator('#progress')).toHaveText('0 z 1 kupione');
});

test('opens the last used list after a reload', async ({ page }) => {
  await addLists(page, 'Drogeria');
  await switchTo(page, 'Drogeria');
  await addItems(page, 'szampon');

  await page.reload();

  await expect(pickerButton(page)).toHaveAccessibleName('Lista: Drogeria');
  await expectToBuy(page, ['szampon']);
});

test('switching hides "Cofnij"', async ({ page }) => {
  await addItems(page, 'mleko');
  await addLists(page, 'Drogeria');
  await page.getByRole('button', { name: 'Usuń: mleko' }).click();
  await expect(page.getByRole('button', { name: 'Cofnij' })).toBeVisible();

  await switchTo(page, 'Drogeria');

  await expect(page.getByRole('button', { name: 'Cofnij' })).toBeHidden();
});

test('the button follows a rename of the active list', async ({ page }) => {
  await addLists(page, 'Drogeria');
  await page.getByRole('button', { name: 'Listy' }).click();
  await page.getByRole('button', { name: 'Zmień nazwę: Zakupy' }).click();
  const editor = page.getByRole('textbox', { name: 'Nazwa listy' });
  await editor.fill('Spożywczy');
  await editor.press('Enter');
  await page.getByRole('button', { name: 'Gotowe' }).click();

  await expect(pickerButton(page)).toHaveAccessibleName('Lista: Spożywczy');
});
