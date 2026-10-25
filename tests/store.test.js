import { describe, it, expect } from 'vitest';
import {
  MAX_NAME_LENGTH,
  createInitialState,
  normalizeName,
  parseQuantity,
  DEFAULT_CATEGORIES,
  findCategoryId,
  getActiveList,
  addItem,
  toggleItem,
  renameItem,
  removeItem,
  clearChecked,
  moveItem,
  getSections,
  getProgress,
} from '../src/store.js';
import { PRODUCT_DICTIONARY } from '../src/product-dictionary.js';

// Builds a state with the given product names, added one second apart.
function stateWith(...names) {
  let state = createInitialState('l_1');
  names.forEach((name, index) => {
    state = addItem(state, name, { id: `i_${index + 1}`, now: 1000 * (index + 1) }).state;
  });
  return state;
}

function items(state) {
  return getActiveList(state).items;
}

function names(list) {
  return list.map((item) => item.name);
}

describe('createInitialState', () => {
  it('creates one empty active list in the version 2 format', () => {
    expect(createInitialState('l_1')).toEqual({
      version: 2,
      activeListId: 'l_1',
      categories: DEFAULT_CATEGORIES,
      categoryMemory: {},
      lists: [{ id: 'l_1', name: 'Zakupy', items: [] }],
    });
  });

  it('copies the default categories instead of sharing them', () => {
    const state = createInitialState('l_1');
    expect(state.categories).not.toBe(DEFAULT_CATEGORIES);
    expect(state.categories[0]).not.toBe(DEFAULT_CATEGORIES[0]);
  });
});

describe('normalizeName', () => {
  it('trims, collapses spaces and lowercases', () => {
    expect(normalizeName('  Mleko    2   L ')).toBe('mleko 2 l');
  });

  it('lowercases Polish letters', () => {
    expect(normalizeName('ŻÓŁTY SER')).toBe('żółty ser');
  });
});

describe('addItem', () => {
  it('adds an item at the end with all model fields', () => {
    const result = addItem(stateWith('chleb'), 'mleko 2 l', { id: 'i_9', now: 5000 });

    expect(result.status).toBe('added');
    expect(result.itemId).toBe('i_9');
    expect(items(result.state)[1]).toEqual({
      id: 'i_9',
      name: 'mleko 2 l',
      checked: false,
      createdAt: 5000,
      checkedAt: null,
      categoryId: null,
    });
  });

  it('trims the name but otherwise keeps it as typed', () => {
    const { state } = addItem(stateWith(), '  Mleko  2 L  ', { id: 'i_1', now: 1 });
    expect(items(state)[0].name).toBe('Mleko  2 L');
  });

  it('rejects an empty or whitespace-only name', () => {
    const before = stateWith();
    for (const name of ['', '   ']) {
      const result = addItem(before, name, { id: 'i_1', now: 1 });
      expect(result.status).toBe('empty');
      expect(result.state).toBe(before);
    }
  });

  it('accepts a name of exactly the maximum length', () => {
    const name = 'a'.repeat(MAX_NAME_LENGTH);
    expect(addItem(stateWith(), name, { id: 'i_1', now: 1 }).status).toBe('added');
  });

  it('rejects a name longer than the maximum length', () => {
    const before = stateWith();
    const result = addItem(before, 'a'.repeat(MAX_NAME_LENGTH + 1), { id: 'i_1', now: 1 });
    expect(result.status).toBe('too-long');
    expect(result.state).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const before = stateWith('chleb');
    const snapshot = structuredClone(before);
    addItem(before, 'mleko', { id: 'i_9', now: 5000 });
    expect(before).toEqual(snapshot);
  });
});

describe('addItem with a duplicate', () => {
  it('does not add the item again and returns the existing id', () => {
    const result = addItem(stateWith('chleb', 'mleko'), '  MLEKO ', { id: 'i_9', now: 5000 });

    expect(result.status).toBe('duplicate');
    expect(result.itemId).toBe('i_2');
    expect(names(items(result.state))).toEqual(['chleb', 'mleko']);
  });

  it('unchecks an existing bought item', () => {
    const bought = toggleItem(stateWith('mleko'), 'i_1', 9000);
    const { state } = addItem(bought, 'mleko', { id: 'i_9', now: 10000 });

    expect(items(state)[0].checked).toBe(false);
    expect(items(state)[0].checkedAt).toBeNull();
  });

  it('ignores the quantity when comparing names', () => {
    const result = addItem(stateWith('mleko 2 l'), 'Mleko', { id: 'i_9', now: 5000 });
    expect(result.status).toBe('duplicate');
    expect(result.itemId).toBe('i_1');
  });

  it('replaces the name when the new entry has a quantity', () => {
    const { state } = addItem(stateWith('mleko 2 l'), 'Mleko 3 l', { id: 'i_9', now: 5000 });
    expect(names(items(state))).toEqual(['Mleko 3 l']);
  });

  it('adds a quantity to an item that had none', () => {
    const { state } = addItem(stateWith('chleb'), 'chleb x2', { id: 'i_9', now: 5000 });
    expect(names(items(state))).toEqual(['chleb x2']);
  });

  it('keeps the old name when the new entry has no quantity', () => {
    const { state } = addItem(stateWith('mleko 2 l'), 'MLEKO', { id: 'i_9', now: 5000 });
    expect(names(items(state))).toEqual(['mleko 2 l']);
  });

  it('treats different word forms as different products', () => {
    const result = addItem(stateWith('mleko 2 l'), '2 l mleka', { id: 'i_9', now: 5000 });
    expect(result.status).toBe('added');
  });
});

describe('parseQuantity', () => {
  it.each([
    ['mleko 2 l', 'mleko', '2 l'],
    ['mleko 2l', 'mleko', '2l'],
    ['ser 0,5 kg', 'ser', '0,5 kg'],
    ['woda 1.5 L', 'woda', '1.5 L'],
    ['jajka 10 szt.', 'jajka', '10 szt.'],
    ['szynka 20 dag', 'szynka', '20 dag'],
    ['chleb x2', 'chleb', 'x2'],
    ['chleb 2x', 'chleb', '2x'],
    ['chleb ×2', 'chleb', '×2'],
    ['6 jajek', 'jajek', '6'],
    ['2 l mleka', 'mleka', '2 l'],
    ['2x chleb', 'chleb', '2x'],
    ['2 lody', 'lody', '2'], // "l" is a unit only as a whole word
    ['  mleko   2 l  ', 'mleko', '2 l'],
  ])('reads "%s" as "%s" + "%s"', (input, name, quantity) => {
    expect(parseQuantity(input)).toEqual({ name, quantity });
  });

  it.each([
    'chleb',
    'mąka typ 450', // bare number at the end is part of the name
    'WD 40',
    '2 l', // nothing left for the product name
    '6',
    'x2',
    '100% sok',
    'mleko 2 litry', // only the listed units
  ])('finds no quantity in "%s"', (input) => {
    expect(parseQuantity(input)).toEqual({ name: input, quantity: null });
  });

  it('reads only one quantity, the one at the end first', () => {
    expect(parseQuantity('2 l mleko 1 l')).toEqual({ name: '2 l mleko', quantity: '1 l' });
  });
});

describe('toggleItem', () => {
  it('checks an item and records when', () => {
    const state = toggleItem(stateWith('mleko'), 'i_1', 9000);
    expect(items(state)[0]).toMatchObject({ checked: true, checkedAt: 9000 });
  });

  it('unchecks a checked item and clears the time', () => {
    const checked = toggleItem(stateWith('mleko'), 'i_1', 9000);
    const state = toggleItem(checked, 'i_1', 9500);
    expect(items(state)[0]).toMatchObject({ checked: false, checkedAt: null });
  });

  it('returns the same state for an unknown id', () => {
    const before = stateWith('mleko');
    expect(toggleItem(before, 'i_404', 9000)).toBe(before);
  });
});

describe('renameItem', () => {
  it('renames an item using the trimmed name', () => {
    const result = renameItem(stateWith('mleko'), 'i_1', '  mleko 2 l ');
    expect(result.status).toBe('renamed');
    expect(items(result.state)[0].name).toBe('mleko 2 l');
  });

  it('allows changing only the letter case of the same item', () => {
    const result = renameItem(stateWith('mleko'), 'i_1', 'Mleko');
    expect(result.status).toBe('renamed');
    expect(items(result.state)[0].name).toBe('Mleko');
  });

  it('rejects an empty name and keeps the state', () => {
    const before = stateWith('mleko');
    const result = renameItem(before, 'i_1', '   ');
    expect(result.status).toBe('empty');
    expect(result.state).toBe(before);
  });

  it('rejects a name that is too long', () => {
    const before = stateWith('mleko');
    const result = renameItem(before, 'i_1', 'a'.repeat(MAX_NAME_LENGTH + 1));
    expect(result.status).toBe('too-long');
    expect(result.state).toBe(before);
  });

  it('rejects a duplicate of another item', () => {
    const before = stateWith('chleb', 'mleko');
    const result = renameItem(before, 'i_2', 'CHLEB');
    expect(result.status).toBe('duplicate');
    expect(result.state).toBe(before);
  });

  it('rejects a name that differs from another item only by quantity', () => {
    const before = stateWith('chleb', 'mleko 2 l');
    const result = renameItem(before, 'i_1', 'mleko 1 l');
    expect(result.status).toBe('duplicate');
    expect(result.state).toBe(before);
  });

  it('allows changing only the quantity of the same item', () => {
    const result = renameItem(stateWith('mleko 2 l'), 'i_1', 'mleko 3 l');
    expect(result.status).toBe('renamed');
    expect(items(result.state)[0].name).toBe('mleko 3 l');
  });
});

describe('removeItem', () => {
  it('removes only the given item', () => {
    const state = removeItem(stateWith('chleb', 'mleko', 'masło'), 'i_2');
    expect(names(items(state))).toEqual(['chleb', 'masło']);
  });
});

describe('clearChecked', () => {
  it('removes all checked items and keeps the rest', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_3', 9100);

    expect(names(items(clearChecked(state)))).toEqual(['mleko']);
  });
});

describe('moveItem', () => {
  // Returns the "to buy" names in the order shown on screen.
  function toBuyNames(state) {
    return names(getSections(getActiveList(state)).toBuy);
  }

  it('moves an item up', () => {
    const state = moveItem(stateWith('chleb', 'mleko', 'masło'), 'i_3', 0);
    expect(toBuyNames(state)).toEqual(['masło', 'chleb', 'mleko']);
  });

  it('moves an item down', () => {
    const state = moveItem(stateWith('chleb', 'mleko', 'masło'), 'i_1', 1);
    expect(toBuyNames(state)).toEqual(['mleko', 'chleb', 'masło']);
  });

  it('treats an index past either end as the top or the bottom', () => {
    const start = stateWith('chleb', 'mleko', 'masło');
    expect(toBuyNames(moveItem(start, 'i_2', -5))).toEqual(['mleko', 'chleb', 'masło']);
    expect(toBuyNames(moveItem(start, 'i_2', 99))).toEqual(['chleb', 'masło', 'mleko']);
  });

  it('returns the same state when the position does not change', () => {
    const before = stateWith('chleb', 'mleko');
    expect(moveItem(before, 'i_1', 0)).toBe(before);
  });

  it('returns the same state for a bought or unknown item', () => {
    const before = toggleItem(stateWith('chleb', 'mleko'), 'i_1', 9000);
    expect(moveItem(before, 'i_1', 1)).toBe(before);
    expect(moveItem(before, 'i_404', 0)).toBe(before);
  });

  it('counts the position among "to buy" items only, skipping bought ones', () => {
    let state = stateWith('chleb', 'mleko', 'masło', 'ser');
    state = toggleItem(state, 'i_2', 9000); // "to buy": chleb, masło, ser
    state = moveItem(state, 'i_4', 1);
    expect(toBuyNames(state)).toEqual(['chleb', 'ser', 'masło']);
  });

  it('keeps bought items in their array slots', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = toggleItem(state, 'i_2', 9000);
    state = moveItem(state, 'i_3', 0);
    expect(names(items(state))).toEqual(['masło', 'mleko', 'chleb']);
  });

  it('returns an unchecked item to its place in the manual order', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = moveItem(state, 'i_3', 0); // masło, chleb, mleko
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_1', 9100);
    expect(toBuyNames(state)).toEqual(['masło', 'chleb', 'mleko']);
  });

  it('adds new items at the bottom after a move', () => {
    let state = moveItem(stateWith('chleb', 'mleko'), 'i_2', 0);
    state = addItem(state, 'ser', { id: 'i_9', now: 9000 }).state;
    expect(toBuyNames(state)).toEqual(['mleko', 'chleb', 'ser']);
  });

  it('does not mutate the previous state', () => {
    const before = stateWith('chleb', 'mleko');
    const snapshot = structuredClone(before);
    moveItem(before, 'i_2', 0);
    expect(before).toEqual(snapshot);
  });
});

describe('getSections', () => {
  it('orders "to buy" by creation, oldest first', () => {
    const { toBuy } = getSections(getActiveList(stateWith('chleb', 'mleko', 'masło')));
    expect(names(toBuy)).toEqual(['chleb', 'mleko', 'masło']);
  });

  it('orders "to buy" by the items array, not by creation time', () => {
    const state = moveItem(stateWith('chleb', 'mleko', 'masło'), 'i_3', 0);
    const { toBuy } = getSections(getActiveList(state));
    expect(names(toBuy)).toEqual(['masło', 'chleb', 'mleko']);
  });

  it('keeps version 1 data in the order it was added', () => {
    // Version 1 always appended new items, so the array is already sorted by createdAt.
    const list = {
      id: 'l_1',
      name: 'Zakupy',
      items: [
        { id: 'i_1', name: 'chleb', checked: false, createdAt: 1000, checkedAt: null, categoryId: null },
        { id: 'i_2', name: 'mleko', checked: false, createdAt: 2000, checkedAt: null, categoryId: null },
      ],
    };
    expect(names(getSections(list).toBuy)).toEqual(['chleb', 'mleko']);
  });

  it('orders "bought" by check time, most recent first', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_3', 9100);

    const { toBuy, bought } = getSections(getActiveList(state));
    expect(names(toBuy)).toEqual(['mleko']);
    expect(names(bought)).toEqual(['masło', 'chleb']);
  });

  it('returns an unchecked item to its original position', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_1', 9100);

    const { toBuy } = getSections(getActiveList(state));
    expect(names(toBuy)).toEqual(['chleb', 'mleko', 'masło']);
  });

  it('does not reorder the stored items', () => {
    const state = toggleItem(stateWith('chleb', 'mleko'), 'i_2', 9000);
    getSections(getActiveList(state));
    expect(names(items(state))).toEqual(['chleb', 'mleko']);
  });
});

describe('getProgress', () => {
  it('counts checked and total items', () => {
    const state = toggleItem(stateWith('chleb', 'mleko', 'masło'), 'i_2', 9000);
    expect(getProgress(getActiveList(state))).toEqual({ checked: 1, total: 3 });
  });

  it('works for an empty list', () => {
    expect(getProgress(getActiveList(stateWith()))).toEqual({ checked: 0, total: 0 });
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('has unique ids and names', () => {
    const ids = DEFAULT_CATEGORIES.map((category) => category.id);
    const names = DEFAULT_CATEGORIES.map((category) => normalizeName(category.name));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });
});

// The dictionary is data written by hand, so these tests guard its rules
// (see the comment at the top of src/product-dictionary.js).
describe('PRODUCT_DICTIONARY', () => {
  const entries = Object.entries(PRODUCT_DICTIONARY).flatMap(([categoryId, names]) =>
    names.map((name) => ({ categoryId, name })),
  );

  it('refers only to default categories', () => {
    const ids = DEFAULT_CATEGORIES.map((category) => category.id);
    expect(ids).toEqual(expect.arrayContaining(Object.keys(PRODUCT_DICTIONARY)));
  });

  it('lists every name only once', () => {
    const seen = new Map();
    const repeated = entries.filter(({ name }) => {
      const isRepeated = seen.has(name);
      seen.set(name, true);
      return isRepeated;
    });
    expect(repeated).toEqual([]);
  });

  it('writes names the way they are compared', () => {
    // Normalized and without a quantity, otherwise the entry could never match.
    const wrong = entries.filter(
      ({ name }) => normalizeName(name) !== name || parseQuantity(name).quantity !== null,
    );
    expect(wrong).toEqual([]);
  });
});

describe('findCategoryId', () => {
  const categories = DEFAULT_CATEGORIES;

  it('finds a product in the dictionary, ignoring case and quantity', () => {
    expect(findCategoryId('Mleko 2 l', categories, {})).toBe('c_dairy');
    expect(findCategoryId('6 jajek', categories, {})).toBe('c_dairy');
    expect(findCategoryId('chleb x2', categories, {})).toBe('c_bakery');
  });

  it('falls back to the first word', () => {
    expect(findCategoryId('mleko owsiane', categories, {})).toBe('c_dairy');
    expect(findCategoryId('papier toaletowy 8 szt', categories, {})).toBe('c_household');
  });

  it('returns null for an unknown product', () => {
    expect(findCategoryId('baterie AA', categories, {})).toBeNull();
  });

  it('prefers what the user chose before over the dictionary', () => {
    const memory = { 'mleko owsiane': 'c_drinks' };
    expect(findCategoryId('Mleko owsiane 1 l', categories, memory)).toBe('c_drinks');
    // Only that exact name: plain milk still comes from the dictionary.
    expect(findCategoryId('mleko', categories, memory)).toBe('c_dairy');
  });

  it('respects a remembered "Bez kategorii"', () => {
    expect(findCategoryId('mleko', categories, { mleko: null })).toBeNull();
  });

  it('remembers products missing from the dictionary', () => {
    expect(findCategoryId('Baterie', categories, { baterie: 'c_household' })).toBe('c_household');
  });

  it('skips categories the user deleted', () => {
    const withoutDairy = categories.filter((category) => category.id !== 'c_dairy');
    expect(findCategoryId('mleko', withoutDairy, {})).toBeNull();
    // A remembered deleted category falls back to the dictionary.
    expect(findCategoryId('ser', categories, { ser: 'c_404' })).toBe('c_dairy');
  });

  it('works for names that are also built-in object properties', () => {
    expect(findCategoryId('constructor', categories, {})).toBeNull();
    expect(findCategoryId('toString', categories, {})).toBeNull();
  });
});
