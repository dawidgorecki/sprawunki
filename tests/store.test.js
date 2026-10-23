import { describe, it, expect } from 'vitest';
import {
  MAX_NAME_LENGTH,
  createInitialState,
  normalizeName,
  getActiveList,
  addItem,
  toggleItem,
  renameItem,
  removeItem,
  clearChecked,
  getSections,
  getProgress,
} from '../src/store.js';

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
  it('creates one empty active list in the version 1 format', () => {
    expect(createInitialState('l_1')).toEqual({
      version: 1,
      activeListId: 'l_1',
      lists: [{ id: 'l_1', name: 'Zakupy', items: [] }],
    });
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

  it('treats a name with an extra quantity as a different product', () => {
    const result = addItem(stateWith('mleko'), 'mleko 2 l', { id: 'i_9', now: 5000 });
    expect(result.status).toBe('added');
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

describe('getSections', () => {
  it('orders "to buy" by creation, oldest first', () => {
    const { toBuy } = getSections(getActiveList(stateWith('chleb', 'mleko', 'masło')));
    expect(names(toBuy)).toEqual(['chleb', 'mleko', 'masło']);
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
