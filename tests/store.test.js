import { describe, it, expect } from 'vitest';
import {
  MAX_NAME_LENGTH,
  createInitialState,
  normalizeName,
  parseQuantity,
  DEFAULT_CATEGORIES,
  findCategoryId,
  setItemCategory,
  MAX_CATEGORY_NAME_LENGTH,
  addCategory,
  renameCategory,
  isCategoryUsed,
  removeCategory,
  moveCategory,
  MAX_LIST_NAME_LENGTH,
  addList,
  renameList,
  removeList,
  moveList,
  setActiveList,
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

function sections(state) {
  return getSections(getActiveList(state), state.categories);
}

// Group headings and item names, e.g. [['Nabiał', 'mleko'], [null, 'baterie']].
function groupNames(state) {
  return sections(state).groups.map((group) => [
    group.category?.name ?? null,
    ...names(group.items),
  ]);
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
      categoryId: 'c_dairy', // from the dictionary
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

// "To buy" names in the order shown on screen: group after group.
function toBuyNames(state) {
  return sections(state).groups.flatMap((group) => names(group.items));
}

// In these tests most products are dairy (Nabiał), so they share one group.
describe('moveItem', () => {
  it('moves an item up within its group', () => {
    const state = moveItem(stateWith('mleko', 'ser', 'jogurt'), 'i_3', 0);
    expect(toBuyNames(state)).toEqual(['jogurt', 'mleko', 'ser']);
  });

  it('moves an item down within its group', () => {
    const state = moveItem(stateWith('mleko', 'ser', 'jogurt'), 'i_1', 1);
    expect(toBuyNames(state)).toEqual(['ser', 'mleko', 'jogurt']);
  });

  it('treats an index past either end as the top or the bottom of the group', () => {
    const start = stateWith('mleko', 'ser', 'jogurt');
    expect(toBuyNames(moveItem(start, 'i_2', -5))).toEqual(['ser', 'mleko', 'jogurt']);
    expect(toBuyNames(moveItem(start, 'i_2', 99))).toEqual(['mleko', 'jogurt', 'ser']);
  });

  it('counts the position within the group, skipping other groups', () => {
    // Array: mleko, chleb, ser, bułki, jogurt → groups: Pieczywo [chleb, bułki], Nabiał [mleko, ser, jogurt]
    const start = stateWith('mleko', 'chleb', 'ser', 'bułki', 'jogurt');
    const state = moveItem(start, 'i_5', 0);
    expect(groupNames(state)).toEqual([
      ['Pieczywo', 'chleb', 'bułki'],
      ['Nabiał', 'jogurt', 'mleko', 'ser'],
    ]);
  });

  it('never moves an item into another group', () => {
    const state = moveItem(stateWith('chleb', 'mleko'), 'i_2', -5);
    expect(groupNames(state)).toEqual([
      ['Pieczywo', 'chleb'],
      ['Nabiał', 'mleko'],
    ]);
  });

  it('moves items without a category within "Bez kategorii"', () => {
    const state = moveItem(stateWith('baterie', 'mleko', 'klej'), 'i_3', 0);
    expect(groupNames(state)).toEqual([
      ['Nabiał', 'mleko'],
      [null, 'klej', 'baterie'],
    ]);
  });

  it('treats items of a deleted category as "Bez kategorii"', () => {
    const start = stateWith('mleko', 'baterie');
    const withoutDairy = {
      ...start,
      categories: start.categories.filter((category) => category.id !== 'c_dairy'),
    };
    expect(groupNames(moveItem(withoutDairy, 'i_2', 0))).toEqual([[null, 'baterie', 'mleko']]);
  });

  it('returns the same state when the position does not change', () => {
    const before = stateWith('mleko', 'ser');
    expect(moveItem(before, 'i_1', 0)).toBe(before);
    // The only item of its group can't move anywhere.
    expect(moveItem(stateWith('chleb', 'mleko'), 'i_1', 1)).toEqual(stateWith('chleb', 'mleko'));
  });

  it('returns the same state for a bought or unknown item', () => {
    const before = toggleItem(stateWith('mleko', 'ser'), 'i_1', 9000);
    expect(moveItem(before, 'i_1', 1)).toBe(before);
    expect(moveItem(before, 'i_404', 0)).toBe(before);
  });

  it('skips bought items when counting positions', () => {
    let state = stateWith('mleko', 'ser', 'jogurt', 'kefir');
    state = toggleItem(state, 'i_2', 9000); // group: mleko, jogurt, kefir
    state = moveItem(state, 'i_4', 1);
    expect(toBuyNames(state)).toEqual(['mleko', 'kefir', 'jogurt']);
  });

  it('keeps bought items and other groups in their array slots', () => {
    let state = stateWith('mleko', 'chleb', 'ser', 'jogurt');
    state = toggleItem(state, 'i_3', 9000);
    state = moveItem(state, 'i_4', 0);
    expect(names(items(state))).toEqual(['jogurt', 'chleb', 'ser', 'mleko']);
  });

  it('returns an unchecked item to its place in the manual order', () => {
    let state = stateWith('mleko', 'ser', 'jogurt');
    state = moveItem(state, 'i_3', 0); // jogurt, mleko, ser
    state = toggleItem(state, 'i_2', 9000);
    state = toggleItem(state, 'i_2', 9100);
    expect(toBuyNames(state)).toEqual(['jogurt', 'mleko', 'ser']);
  });

  it('adds new items at the bottom of their group after a move', () => {
    let state = moveItem(stateWith('mleko', 'ser'), 'i_2', 0);
    state = addItem(state, 'kefir', { id: 'i_9', now: 9000 }).state;
    expect(toBuyNames(state)).toEqual(['ser', 'mleko', 'kefir']);
  });

  it('does not mutate the previous state', () => {
    const before = stateWith('mleko', 'ser');
    const snapshot = structuredClone(before);
    moveItem(before, 'i_2', 0);
    expect(before).toEqual(snapshot);
  });
});

describe('getSections', () => {
  it('orders a group by creation, oldest first', () => {
    expect(toBuyNames(stateWith('mleko', 'ser', 'jogurt'))).toEqual(['mleko', 'ser', 'jogurt']);
  });

  it('orders a group by the items array, not by creation time', () => {
    const state = moveItem(stateWith('mleko', 'ser', 'jogurt'), 'i_3', 0);
    expect(toBuyNames(state)).toEqual(['jogurt', 'mleko', 'ser']);
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
    const { groups } = getSections(list, DEFAULT_CATEGORIES);
    expect(names(groups[0].items)).toEqual(['chleb', 'mleko']);
  });

  it('orders "bought" by check time, most recent first', () => {
    let state = stateWith('chleb', 'mleko', 'masło');
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_3', 9100);

    expect(toBuyNames(state)).toEqual(['mleko']);
    expect(names(sections(state).bought)).toEqual(['masło', 'chleb']);
  });

  it('returns an unchecked item to its original position', () => {
    let state = stateWith('mleko', 'ser', 'jogurt');
    state = toggleItem(state, 'i_1', 9000);
    state = toggleItem(state, 'i_1', 9100);
    expect(toBuyNames(state)).toEqual(['mleko', 'ser', 'jogurt']);
  });

  it('does not reorder the stored items', () => {
    const state = toggleItem(stateWith('chleb', 'mleko'), 'i_2', 9000);
    sections(state);
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

describe('addItem with categories', () => {
  it('picks the category from the dictionary', () => {
    const { state } = addItem(stateWith(), 'Mleko 2 l', { id: 'i_1', now: 1 });
    expect(items(state)[0].categoryId).toBe('c_dairy');
  });

  it('leaves an unknown product without a category', () => {
    const { state } = addItem(stateWith(), 'baterie', { id: 'i_1', now: 1 });
    expect(items(state)[0].categoryId).toBeNull();
  });

  it('uses the remembered choice', () => {
    const start = { ...stateWith(), categoryMemory: { baterie: 'c_household' } };
    const { state } = addItem(start, 'Baterie AA', { id: 'i_1', now: 1 });
    // "baterie aa" is not remembered, only "baterie": the first word is not used for memory.
    expect(items(state)[0].categoryId).toBeNull();

    const exact = addItem(start, 'Baterie', { id: 'i_2', now: 2 }).state;
    expect(items(exact)[0].categoryId).toBe('c_household');
  });

  it('does not change the category of a duplicate', () => {
    let state = setItemCategory(stateWith('mleko'), 'i_1', 'c_drinks');
    state = addItem(state, 'mleko 3 l', { id: 'i_9', now: 9000 }).state;
    expect(items(state)[0].categoryId).toBe('c_drinks');
  });

  it('keeps the category when the item is renamed', () => {
    const { state } = renameItem(stateWith('mleko'), 'i_1', 'chleb');
    expect(items(state)[0].categoryId).toBe('c_dairy');
  });
});

describe('setItemCategory', () => {
  it('changes the category and moves the item to the end of its new group', () => {
    let state = stateWith('ser', 'mleko', 'woda');
    state = setItemCategory(state, 'i_1', 'c_drinks');

    expect(items(state).find((item) => item.id === 'i_1').categoryId).toBe('c_drinks');
    expect(groupNames(state)).toEqual([
      ['Nabiał', 'mleko'],
      ['Napoje', 'woda', 'ser'],
    ]);
  });

  it('remembers the choice for the name without quantity', () => {
    const state = setItemCategory(stateWith('Mleko owsiane 1 l'), 'i_1', 'c_drinks');
    expect(state.categoryMemory).toEqual({ 'mleko owsiane': 'c_drinks' });
  });

  it('remembers "Bez kategorii" as null', () => {
    const state = setItemCategory(stateWith('mleko'), 'i_1', null);
    expect(items(state)[0].categoryId).toBeNull();
    expect(state.categoryMemory).toEqual({ mleko: null });
  });

  it('applies the remembered choice to the same product added later', () => {
    let state = setItemCategory(stateWith('mleko owsiane'), 'i_1', 'c_drinks');
    state = removeItem(state, 'i_1');
    state = addItem(state, 'Mleko owsiane 2 l', { id: 'i_9', now: 9000 }).state;
    expect(items(state)[0].categoryId).toBe('c_drinks');
  });

  it('returns the same state for an unknown item or category, or the same category', () => {
    const before = stateWith('mleko');
    expect(setItemCategory(before, 'i_404', 'c_drinks')).toBe(before);
    expect(setItemCategory(before, 'i_1', 'c_404')).toBe(before);
    expect(setItemCategory(before, 'i_1', 'c_dairy')).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const before = stateWith('mleko', 'chleb');
    const snapshot = structuredClone(before);
    setItemCategory(before, 'i_1', 'c_drinks');
    expect(before).toEqual(snapshot);
  });
});

describe('getSections groups', () => {
  it('groups "to buy" items in the order of categories, "Bez kategorii" last', () => {
    const state = stateWith('baterie', 'mleko', 'chleb', 'ser', 'jabłka');
    expect(groupNames(state)).toEqual([
      ['Warzywa i owoce', 'jabłka'],
      ['Pieczywo', 'chleb'],
      ['Nabiał', 'mleko', 'ser'],
      [null, 'baterie'],
    ]);
  });

  it('follows a custom order of categories', () => {
    const state = stateWith('mleko', 'chleb');
    const reversed = { ...state, categories: [...state.categories].reverse() };
    expect(groupNames(reversed)).toEqual([
      ['Nabiał', 'mleko'],
      ['Pieczywo', 'chleb'],
    ]);
  });

  it('keeps the manual order inside a group', () => {
    const state = moveItem(stateWith('mleko', 'ser', 'jogurt'), 'i_3', 0);
    expect(groupNames(state)).toEqual([['Nabiał', 'jogurt', 'mleko', 'ser']]);
  });

  it('leaves bought items out of the groups', () => {
    const state = toggleItem(stateWith('mleko', 'ser'), 'i_1', 9000);
    expect(groupNames(state)).toEqual([['Nabiał', 'ser']]);
    expect(names(sections(state).bought)).toEqual(['mleko']);
  });

  it('puts items of a deleted category into "Bez kategorii"', () => {
    const state = stateWith('mleko', 'chleb');
    const withoutDairy = {
      ...state,
      categories: state.categories.filter((category) => category.id !== 'c_dairy'),
    };
    expect(groupNames(withoutDairy)).toEqual([
      ['Pieczywo', 'chleb'],
      [null, 'mleko'],
    ]);
  });

  it('returns no groups for an empty list', () => {
    expect(sections(stateWith()).groups).toEqual([]);
  });
});

function categoryNames(state) {
  return state.categories.map((category) => category.name);
}

describe('addCategory', () => {
  it('adds a category at the end', () => {
    const result = addCategory(stateWith(), '  Apteka ', 'c_new');

    expect(result.status).toBe('added');
    expect(result.categoryId).toBe('c_new');
    expect(result.state.categories.at(-1)).toEqual({ id: 'c_new', name: 'Apteka' });
    expect(result.state.categories).toHaveLength(DEFAULT_CATEGORIES.length + 1);
  });

  it('rejects an empty or too long name', () => {
    const before = stateWith();
    expect(addCategory(before, '   ', 'c_new')).toEqual({ state: before, status: 'empty', categoryId: null });
    const tooLong = 'a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1);
    expect(addCategory(before, tooLong, 'c_new').status).toBe('too-long');
    expect(addCategory(before, 'a'.repeat(MAX_CATEGORY_NAME_LENGTH), 'c_new').status).toBe('added');
  });

  it('rejects a duplicate, ignoring case and spaces', () => {
    const before = stateWith();
    const result = addCategory(before, '  NAPOJE ', 'c_new');
    expect(result.status).toBe('duplicate');
    expect(result.state).toBe(before);
  });

  it('does not read a quantity from a category name', () => {
    // "Napoje 2" would be "Napoje" for products, but categories compare whole names.
    expect(addCategory(stateWith(), 'Napoje 2 l', 'c_new').status).toBe('added');
  });
});

describe('renameCategory', () => {
  it('renames a category', () => {
    const { state, status } = renameCategory(stateWith(), 'c_drinks', ' Napoje i soki ');
    expect(status).toBe('renamed');
    expect(state.categories.find((c) => c.id === 'c_drinks').name).toBe('Napoje i soki');
  });

  it('allows changing only the letter case', () => {
    expect(renameCategory(stateWith(), 'c_drinks', 'NAPOJE').status).toBe('renamed');
  });

  it('rejects an empty name, a duplicate or an unknown id and keeps the state', () => {
    const before = stateWith();
    for (const [id, name, status] of [
      ['c_drinks', '  ', 'empty'],
      ['c_drinks', 'a'.repeat(MAX_CATEGORY_NAME_LENGTH + 1), 'too-long'],
      ['c_drinks', 'nabiał', 'duplicate'],
      ['c_404', 'Apteka', 'not-found'],
    ]) {
      const result = renameCategory(before, id, name);
      expect(result.status).toBe(status);
      expect(result.state).toBe(before);
    }
  });

  it('keeps the products and memory of the category', () => {
    let state = setItemCategory(stateWith('baterie'), 'i_1', 'c_household');
    state = renameCategory(state, 'c_household', 'Dom').state;
    expect(groupNames(state)).toEqual([['Dom', 'baterie']]);
    expect(state.categoryMemory).toEqual({ baterie: 'c_household' });
  });
});

describe('isCategoryUsed', () => {
  it('is true when an item belongs to the category, bought ones included', () => {
    const state = toggleItem(stateWith('mleko'), 'i_1', 9000);
    expect(isCategoryUsed(state, 'c_dairy')).toBe(true);
    expect(isCategoryUsed(state, 'c_drinks')).toBe(false);
  });

  it('looks at every list, not only the active one', () => {
    const other = { id: 'l_2', name: 'Inna', items: [{ ...items(stateWith('woda'))[0] }] };
    const state = { ...stateWith(), lists: [...stateWith().lists, other] };
    expect(isCategoryUsed(state, 'c_drinks')).toBe(true);
  });
});

describe('removeCategory', () => {
  it('removes the category and moves its items to "Bez kategorii"', () => {
    const state = removeCategory(stateWith('mleko', 'chleb'), 'c_dairy');

    expect(categoryNames(state)).not.toContain('Nabiał');
    expect(items(state).map((item) => item.categoryId)).toEqual([null, 'c_bakery']);
    expect(groupNames(state)).toEqual([
      ['Pieczywo', 'chleb'],
      [null, 'mleko'],
    ]);
  });

  it('updates bought items and items on other lists too', () => {
    const base = toggleItem(stateWith('mleko'), 'i_1', 9000);
    const other = { id: 'l_2', name: 'Inna', items: [{ ...items(stateWith('ser'))[0] }] };
    const state = removeCategory({ ...base, lists: [...base.lists, other] }, 'c_dairy');

    expect(state.lists.flatMap((list) => list.items).map((item) => item.categoryId)).toEqual([
      null,
      null,
    ]);
  });

  it('forgets memory entries pointing to the category, keeps the others', () => {
    let state = stateWith('mleko owsiane', 'chleb', 'kawa');
    state = setItemCategory(state, 'i_1', 'c_drinks');
    state = setItemCategory(state, 'i_2', null); // a remembered "Bez kategorii" stays
    state = setItemCategory(state, 'i_3', 'c_drinks');

    state = removeCategory(state, 'c_drinks');
    expect(state.categoryMemory).toEqual({ chleb: null });
  });

  it('lets the dictionary pick a category again for a forgotten product', () => {
    let state = setItemCategory(stateWith('mleko'), 'i_1', 'c_drinks');
    state = removeCategory(state, 'c_drinks');
    state = removeItem(state, 'i_1');
    state = addItem(state, 'mleko', { id: 'i_9', now: 9000 }).state;
    expect(items(state)[0].categoryId).toBe('c_dairy');
  });

  it('returns the same state for an unknown id', () => {
    const before = stateWith('mleko');
    expect(removeCategory(before, 'c_404')).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const before = setItemCategory(stateWith('mleko'), 'i_1', 'c_drinks');
    const snapshot = structuredClone(before);
    removeCategory(before, 'c_drinks');
    expect(before).toEqual(snapshot);
  });
});

describe('moveCategory', () => {
  it('moves a category and changes the order of groups', () => {
    const state = moveCategory(stateWith('chleb', 'mleko'), 'c_dairy', 0);
    expect(categoryNames(state).slice(0, 3)).toEqual(['Nabiał', 'Warzywa i owoce', 'Pieczywo']);
    expect(groupNames(state)).toEqual([
      ['Nabiał', 'mleko'],
      ['Pieczywo', 'chleb'],
    ]);
  });

  it('treats an index past either end as the first or the last place', () => {
    const start = stateWith();
    expect(moveCategory(start, 'c_dairy', -5).categories[0].id).toBe('c_dairy');
    expect(moveCategory(start, 'c_dairy', 99).categories.at(-1).id).toBe('c_dairy');
  });

  it('returns the same state for an unknown id or the same position', () => {
    const before = stateWith();
    expect(moveCategory(before, 'c_404', 0)).toBe(before);
    expect(moveCategory(before, 'c_produce', 0)).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const before = stateWith();
    const snapshot = structuredClone(before);
    moveCategory(before, 'c_household', 0);
    expect(before).toEqual(snapshot);
  });
});

// ---------- Lists (spec 11) ----------

// A state with the default list "Zakupy" (l_1) holding "mleko", plus empty
// lists with the given names (l_2, l_3, …).
function stateWithLists(...listNames) {
  let state = stateWith('mleko');
  listNames.forEach((name, index) => {
    state = addList(state, name, `l_${index + 2}`).state;
  });
  return state;
}

function listNames(state) {
  return state.lists.map((list) => list.name);
}

describe('addList', () => {
  it('adds an empty list at the end without making it active', () => {
    const result = addList(stateWith('mleko'), '  Drogeria ', 'l_2');

    expect(result.status).toBe('added');
    expect(result.listId).toBe('l_2');
    expect(result.state.lists.at(-1)).toEqual({ id: 'l_2', name: 'Drogeria', items: [] });
    expect(result.state.activeListId).toBe('l_1');
    expect(names(items(result.state))).toEqual(['mleko']);
  });

  it('rejects an empty or too long name', () => {
    const before = stateWith();
    expect(addList(before, '   ', 'l_2')).toEqual({ state: before, status: 'empty', listId: null });
    expect(addList(before, 'a'.repeat(MAX_LIST_NAME_LENGTH + 1), 'l_2').status).toBe('too-long');
    expect(addList(before, 'a'.repeat(MAX_LIST_NAME_LENGTH), 'l_2').status).toBe('added');
  });

  it('rejects a duplicate, ignoring case and spaces', () => {
    const before = stateWith();
    const result = addList(before, '  ZAKUPY ', 'l_2');
    expect(result.status).toBe('duplicate');
    expect(result.state).toBe(before);
  });

  it('does not read a quantity from a list name', () => {
    expect(addList(stateWith(), 'Zakupy 2 kg', 'l_2').status).toBe('added');
  });
});

describe('renameList', () => {
  it('renames a list and keeps its items', () => {
    const { state, status } = renameList(stateWith('mleko'), 'l_1', ' Spożywczy ');
    expect(status).toBe('renamed');
    expect(listNames(state)).toEqual(['Spożywczy']);
    expect(names(items(state))).toEqual(['mleko']);
  });

  it('allows changing only the letter case', () => {
    expect(renameList(stateWith(), 'l_1', 'ZAKUPY').status).toBe('renamed');
  });

  it('rejects an empty name, a duplicate or an unknown id and keeps the state', () => {
    const before = stateWithLists('Drogeria');
    for (const [id, name, status] of [
      ['l_2', '  ', 'empty'],
      ['l_2', 'a'.repeat(MAX_LIST_NAME_LENGTH + 1), 'too-long'],
      ['l_2', 'zakupy', 'duplicate'],
      ['l_404', 'Apteka', 'not-found'],
    ]) {
      const result = renameList(before, id, name);
      expect(result.status).toBe(status);
      expect(result.state).toBe(before);
    }
  });
});

describe('removeList', () => {
  it('removes a list that is not active and keeps the active one', () => {
    const state = removeList(stateWithLists('Drogeria', 'Apteka'), 'l_2');
    expect(listNames(state)).toEqual(['Zakupy', 'Apteka']);
    expect(state.activeListId).toBe('l_1');
  });

  it('removes the list together with its items', () => {
    let state = setActiveList(stateWithLists('Drogeria'), 'l_2');
    state = addItem(state, 'szampon', { id: 'i_9', now: 9000 }).state;
    state = removeList(state, 'l_2');
    expect(state.lists.flatMap((list) => names(list.items))).toEqual(['mleko']);
  });

  it('makes the first list active after removing the active one', () => {
    let state = setActiveList(stateWithLists('Drogeria', 'Apteka'), 'l_3');
    state = removeList(state, 'l_3');
    expect(state.activeListId).toBe('l_1');

    // Also when the active list is the first one: the next list becomes first.
    state = removeList(state, 'l_1');
    expect(state.activeListId).toBe('l_2');
    expect(listNames(state)).toEqual(['Drogeria']);
  });

  it('never removes the last list', () => {
    const before = stateWith('mleko');
    expect(removeList(before, 'l_1')).toBe(before);
  });

  it('returns the same state for an unknown id', () => {
    const before = stateWithLists('Drogeria');
    expect(removeList(before, 'l_404')).toBe(before);
  });

  it('keeps categories and their memory', () => {
    let state = setItemCategory(stateWithLists('Drogeria'), 'i_1', 'c_drinks');
    state = removeList(state, 'l_1');
    expect(state.categories).toEqual(DEFAULT_CATEGORIES);
    expect(state.categoryMemory).toEqual({ mleko: 'c_drinks' });
  });

  it('does not mutate the previous state', () => {
    const before = stateWithLists('Drogeria');
    const snapshot = structuredClone(before);
    removeList(before, 'l_1');
    expect(before).toEqual(snapshot);
  });
});

describe('moveList', () => {
  it('moves a list', () => {
    const state = moveList(stateWithLists('Drogeria', 'Apteka'), 'l_3', 0);
    expect(listNames(state)).toEqual(['Apteka', 'Zakupy', 'Drogeria']);
    expect(state.activeListId).toBe('l_1');
  });

  it('treats an index past either end as the first or the last place', () => {
    const start = stateWithLists('Drogeria', 'Apteka');
    expect(moveList(start, 'l_2', -5).lists[0].id).toBe('l_2');
    expect(moveList(start, 'l_2', 99).lists.at(-1).id).toBe('l_2');
  });

  it('returns the same state for an unknown id or the same position', () => {
    const before = stateWithLists('Drogeria');
    expect(moveList(before, 'l_404', 0)).toBe(before);
    expect(moveList(before, 'l_1', 0)).toBe(before);
  });

  it('does not mutate the previous state', () => {
    const before = stateWithLists('Drogeria');
    const snapshot = structuredClone(before);
    moveList(before, 'l_2', 0);
    expect(before).toEqual(snapshot);
  });
});

describe('setActiveList', () => {
  it('switches the active list', () => {
    const state = setActiveList(stateWithLists('Drogeria'), 'l_2');
    expect(state.activeListId).toBe('l_2');
    expect(getActiveList(state).name).toBe('Drogeria');
  });

  it('returns the same state for an unknown id or the already active list', () => {
    const before = stateWithLists('Drogeria');
    expect(setActiveList(before, 'l_404')).toBe(before);
    expect(setActiveList(before, 'l_1')).toBe(before);
  });
});

describe('product actions with several lists', () => {
  // Zakupy: mleko (bought), chleb. Drogeria (active): szampon.
  function twoLists() {
    let state = stateWith('mleko', 'chleb');
    state = toggleItem(state, 'i_1', 9000);
    state = addList(state, 'Drogeria', 'l_2').state;
    state = setActiveList(state, 'l_2');
    return addItem(state, 'szampon', { id: 'i_3', now: 9500 }).state;
  }

  function otherList(state) {
    return state.lists.find((list) => list.id === 'l_1');
  }

  it('adds to the active list only', () => {
    expect(names(items(twoLists()))).toEqual(['szampon']);
    expect(names(otherList(twoLists()).items)).toEqual(['mleko', 'chleb']);
  });

  it('allows the same product on several lists', () => {
    const result = addItem(twoLists(), 'chleb', { id: 'i_9', now: 10000 });
    expect(result.status).toBe('added');
    expect(names(items(result.state))).toEqual(['szampon', 'chleb']);
  });

  it('clears bought items on the active list only', () => {
    let state = toggleItem(twoLists(), 'i_3', 10000);
    state = clearChecked(state);
    expect(items(state)).toEqual([]);
    expect(names(otherList(state).items)).toEqual(['mleko', 'chleb']);
  });

  it('shares category memory between lists', () => {
    let state = setItemCategory(twoLists(), 'i_3', 'c_pantry');
    state = setActiveList(state, 'l_1');
    state = addItem(state, 'szampon', { id: 'i_9', now: 10000 }).state;
    expect(items(state).at(-1).categoryId).toBe('c_pantry');
  });

  it('counts progress for each list separately', () => {
    const state = twoLists();
    expect(getProgress(otherList(state))).toEqual({ checked: 1, total: 2 });
    expect(getProgress(getActiveList(state))).toEqual({ checked: 0, total: 1 });
  });
});
