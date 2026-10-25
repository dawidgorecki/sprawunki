// The "Listy" dialog (spec 11.3): add, rename, remove and reorder lists.
// It shares its code with the categories dialog (manage-dialog.js), so these
// tests focus on what is different for lists.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy, dragHandle } from './helpers.js';

function dialog(page) {
  return page.getByRole('dialog', { name: 'Listy' });
}

function listNames(page) {
  return dialog(page).locator('.manage-list .item-name');
}

async function openDialog(page) {
  await page.getByRole('button', { name: 'Listy' }).click();
  await expect(dialog(page)).toBeVisible();
}

async function closeDialog(page) {
  await dialog(page).getByRole('button', { name: 'Gotowe' }).click();
  await expect(dialog(page)).toBeHidden();
}

async function addList(page, name) {
  const input = dialog(page).getByRole('textbox', { name: 'Nazwa nowej listy' });
  await input.fill(name);
  await input.press('Enter');
}

async function rename(page, oldName, newName) {
  await dialog(page).getByRole('button', { name: `Zmień nazwę: ${oldName}` }).click();
  const editor = dialog(page).getByRole('textbox', { name: 'Nazwa listy' });
  await editor.fill(newName);
  await editor.press('Enter');
}

function removeButton(page, name) {
  return dialog(page).getByRole('button', { name: `Usuń listę: ${name}` });
}

function handle(page, name) {
  return dialog(page).getByRole('button', { name: `Zmień kolejność: ${name}` });
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('opens with the one default list and closes with "Gotowe" or Escape', async ({ page }) => {
  await openDialog(page);
  await expect(listNames(page)).toHaveText(['Zakupy']);
  await closeDialog(page);

  await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('adds lists at the end without switching to them', async ({ page }) => {
  await addItems(page, 'mleko');
  await openDialog(page);

  await addList(page, 'Drogeria');
  await addList(page, 'Apteka');

  await expect(listNames(page)).toHaveText(['Zakupy', 'Drogeria', 'Apteka']);
  const input = dialog(page).getByRole('textbox', { name: 'Nazwa nowej listy' });
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();

  await closeDialog(page);
  await expectToBuy(page, ['mleko']);
});

test('rejects a list that already exists', async ({ page }) => {
  await openDialog(page);
  await addList(page, ' zakupy ');

  await expect(dialog(page).getByText('Taka lista już jest.')).toBeVisible();
  await expect(listNames(page)).toHaveText(['Zakupy']);
});

test('renames a list in place and rejects a duplicate name', async ({ page }) => {
  await openDialog(page);
  await addList(page, 'Drogeria');

  await rename(page, 'Zakupy', 'Spożywczy');
  await expect(listNames(page)).toHaveText(['Spożywczy', 'Drogeria']);

  await rename(page, 'Drogeria', 'SPOŻYWCZY');
  await expect(dialog(page).getByText('Taka lista już jest.')).toBeVisible();
  await expect(listNames(page)).toHaveText(['Spożywczy', 'Drogeria']);
});

test('the last list cannot be removed', async ({ page }) => {
  await openDialog(page);
  await expect(removeButton(page, 'Zakupy')).toBeDisabled();

  await addList(page, 'Drogeria');
  await expect(removeButton(page, 'Zakupy')).toBeEnabled();
  await expect(removeButton(page, 'Drogeria')).toBeEnabled();
});

test('removes an empty list without asking', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('No confirmation expected for an empty list');
  });
  await openDialog(page);
  await addList(page, 'Drogeria');

  await removeButton(page, 'Drogeria').click();

  await expect(listNames(page)).toHaveText(['Zakupy']);
});

test('asks before removing a list with products; the first list becomes active', async ({ page }) => {
  await addItems(page, 'mleko');
  await openDialog(page);
  await addList(page, 'Drogeria');
  // The active list "Zakupy" goes to the end, so "Drogeria" becomes first.
  await handle(page, 'Zakupy').focus();
  await page.keyboard.press('ArrowDown');

  // "Anuluj": nothing changes.
  page.once('dialog', (confirm) => confirm.dismiss());
  await removeButton(page, 'Zakupy').click();
  await expect(listNames(page)).toHaveText(['Drogeria', 'Zakupy']);

  // "OK": the list and its products are gone.
  page.once('dialog', (confirm) => {
    expect(confirm.message()).toBe('Usunąć listę „Zakupy” razem z produktami?');
    confirm.accept();
  });
  await removeButton(page, 'Zakupy').click();
  await expect(listNames(page)).toHaveText(['Drogeria']);

  await closeDialog(page);
  await expect(page.getByText('Lista jest pusta.')).toBeVisible();
});

test('arrow keys and dragging change the order of lists', async ({ page, isMobile }) => {
  await openDialog(page);
  await addList(page, 'Drogeria');
  await addList(page, 'Apteka');

  await handle(page, 'Apteka').focus();
  await page.keyboard.press('ArrowUp');
  await expect(listNames(page)).toHaveText(['Zakupy', 'Apteka', 'Drogeria']);
  await expect(handle(page, 'Apteka')).toBeFocused();

  const target = dialog(page).locator('.manage-list li', { hasText: 'Zakupy' });
  await dragHandle(page, isMobile, handle(page, 'Drogeria'), target);
  await expect(listNames(page)).toHaveText(['Drogeria', 'Zakupy', 'Apteka']);
});

test('keeps the changes after a reload', async ({ page }) => {
  await openDialog(page);
  await addList(page, 'Drogeria');
  await addList(page, 'Apteka');
  await rename(page, 'Zakupy', 'Spożywczy');
  await removeButton(page, 'Drogeria').click();

  await page.reload();
  await openDialog(page);

  await expect(listNames(page)).toHaveText(['Spożywczy', 'Apteka']);
});
