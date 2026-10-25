// The "Kategorie" dialog (spec 10.5): add, rename, remove and reorder categories.

import { test, expect } from '@playwright/test';
import { openApp, addItems, expectToBuy, groupTitles, dragHandle } from './helpers.js';

const DEFAULT_NAMES = [
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
];

function dialog(page) {
  return page.getByRole('dialog', { name: 'Kategorie' });
}

function categoryNames(page) {
  return dialog(page).locator('#category-list .item-name');
}

async function openDialog(page) {
  await page.getByRole('button', { name: 'Kategorie' }).click();
  await expect(dialog(page)).toBeVisible();
}

async function closeDialog(page) {
  await dialog(page).getByRole('button', { name: 'Gotowe' }).click();
  await expect(dialog(page)).toBeHidden();
}

async function addCategory(page, name) {
  const input = dialog(page).getByRole('textbox', { name: 'Nazwa nowej kategorii' });
  await input.fill(name);
  await input.press('Enter');
}

async function rename(page, oldName, newName) {
  await dialog(page).getByRole('button', { name: `Zmień nazwę: ${oldName}` }).click();
  const editor = dialog(page).getByRole('textbox', { name: 'Nazwa kategorii' });
  await editor.fill(newName);
  await editor.press('Enter');
}

function removeButton(page, name) {
  return dialog(page).getByRole('button', { name: `Usuń kategorię: ${name}` });
}

function handle(page, name) {
  return dialog(page).getByRole('button', { name: `Zmień kolejność: ${name}` });
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('opens with the categories in their order and closes with "Gotowe" or Escape', async ({ page }) => {
  await openDialog(page);
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES);
  await closeDialog(page);

  await openDialog(page);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
});

test('adds a category at the end and offers it for products', async ({ page }) => {
  await addItems(page, 'aspiryna');
  await openDialog(page);

  await addCategory(page, 'Apteka');

  await expect(categoryNames(page)).toHaveText([...DEFAULT_NAMES, 'Apteka']);
  const input = dialog(page).getByRole('textbox', { name: 'Nazwa nowej kategorii' });
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();

  await closeDialog(page);
  await page.getByRole('combobox', { name: 'Kategoria: aspiryna' }).selectOption({ label: 'Apteka' });
  await expect(groupTitles(page)).toHaveText(['Apteka']);
});

test('rejects a category that already exists', async ({ page }) => {
  await openDialog(page);
  await addCategory(page, 'napoje');

  await expect(dialog(page).getByText('Taka kategoria już jest.')).toBeVisible();
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES);
});

test.describe('on a short screen', () => {
  // Shorter than the dialog with all default categories, so the dialog scrolls.
  test.use({ viewport: { width: 360, height: 560 } });

  test('the add field is in view without scrolling', async ({ page }) => {
    await openDialog(page);
    await expect(dialog(page).getByRole('textbox', { name: 'Nazwa nowej kategorii' })).toBeInViewport();
    // …while the end of the list is not: the dialog really does scroll.
    await expect(dialog(page).locator('#category-list li').last()).not.toBeInViewport();
  });

  test('a new category is scrolled into view and not hidden under the field', async ({ page }) => {
    await openDialog(page);
    await addCategory(page, 'Apteka');

    const newRow = dialog(page).locator('#category-list li').last();
    await expect(newRow).toHaveText(/Apteka/);
    await expect(newRow).toBeInViewport({ ratio: 1 });
    const row = await newRow.boundingBox();
    const form = await dialog(page).locator('form').boundingBox();
    expect(row.y + row.height).toBeLessThanOrEqual(form.y);
  });
});

test('renames a category in place, also on the shopping list', async ({ page }) => {
  await addItems(page, 'woda');
  await openDialog(page);

  await rename(page, 'Napoje', 'Napoje i soki');

  await expect(categoryNames(page).nth(8)).toHaveText('Napoje i soki');
  await closeDialog(page);
  await expect(groupTitles(page)).toHaveText(['Napoje i soki']);
});

test('Escape cancels the rename without closing the dialog', async ({ page }) => {
  await openDialog(page);
  await dialog(page).getByRole('button', { name: 'Zmień nazwę: Napoje' }).click();
  const editor = dialog(page).getByRole('textbox', { name: 'Nazwa kategorii' });
  await editor.fill('Coś innego');
  await editor.press('Escape');

  await expect(dialog(page)).toBeVisible();
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES);
});

test('rejects a rename to another category name', async ({ page }) => {
  await openDialog(page);
  await rename(page, 'Napoje', 'NABIAŁ');

  await expect(dialog(page).getByText('Taka kategoria już jest.')).toBeVisible();
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES);
});

test('removes an unused category without asking', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('No confirmation expected for an unused category');
  });
  await openDialog(page);

  await removeButton(page, 'Mrożonki').click();

  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES.filter((name) => name !== 'Mrożonki'));
});

test('asks before removing a category that has products', async ({ page }) => {
  await addItems(page, 'mleko', 'chleb');
  await openDialog(page);

  // "Anuluj": nothing changes.
  page.once('dialog', (confirm) => confirm.dismiss());
  await removeButton(page, 'Nabiał').click();
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES);

  // "OK": the category is gone, its products are in "Bez kategorii".
  page.once('dialog', (confirm) => {
    expect(confirm.message()).toContain('Nabiał');
    confirm.accept();
  });
  await removeButton(page, 'Nabiał').click();
  await expect(categoryNames(page)).toHaveText(DEFAULT_NAMES.filter((name) => name !== 'Nabiał'));

  await closeDialog(page);
  await expect(groupTitles(page)).toHaveText(['Pieczywo', 'Bez kategorii']);
  await expectToBuy(page, ['chleb', 'mleko']);
});

test('arrow keys change the order of categories and of the groups', async ({ page }) => {
  await addItems(page, 'chleb', 'mleko');
  await openDialog(page);

  await handle(page, 'Nabiał').focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');

  await expect(categoryNames(page).first()).toHaveText('Nabiał');
  await expect(handle(page, 'Nabiał')).toBeFocused();
  await closeDialog(page);
  await expect(groupTitles(page)).toHaveText(['Nabiał', 'Pieczywo']);
});

test('dragging changes the order of categories', async ({ page, isMobile }) => {
  await openDialog(page);
  const target = dialog(page).locator('#category-list li', { hasText: 'Warzywa i owoce' });

  await dragHandle(page, isMobile, handle(page, 'Nabiał'), target);

  await expect(categoryNames(page).first()).toHaveText('Nabiał');
});

test('keeps the changes after a reload', async ({ page }) => {
  await openDialog(page);
  await addCategory(page, 'Apteka');
  await rename(page, 'Napoje', 'Picie');
  await removeButton(page, 'Mrożonki').click();

  await page.reload();
  await openDialog(page);

  const expected = DEFAULT_NAMES.filter((name) => name !== 'Mrożonki')
    .map((name) => (name === 'Napoje' ? 'Picie' : name))
    .concat('Apteka');
  await expect(categoryNames(page)).toHaveText(expected);
});
