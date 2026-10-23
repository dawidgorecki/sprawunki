import { describe, it, expect } from 'vitest';
import { STORAGE_KEY, migrate, loadState, saveState } from '../src/storage.js';
import { createInitialState, addItem } from '../src/store.js';

// Minimal stand-in for localStorage: only the two methods storage.js uses.
function createFakeStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

// Simulates a browser that blocks storage or has run out of space.
function createBrokenStorage() {
  return {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

const options = { now: 5000, listId: 'l_new' };
const emptyState = createInitialState('l_new');

function sampleState() {
  return addItem(createInitialState('l_1'), 'mleko', { id: 'i_1', now: 1000 }).state;
}

describe('migrate', () => {
  it('returns version 1 data unchanged', () => {
    const data = sampleState();
    expect(migrate(data)).toBe(data);
  });

  it('throws for an unknown version', () => {
    expect(() => migrate({ ...sampleState(), version: 99 })).toThrow();
  });

  it('throws when the version is missing', () => {
    const { version, ...withoutVersion } = sampleState();
    expect(() => migrate(withoutVersion)).toThrow();
  });
});

describe('loadState', () => {
  it('creates an empty default list when nothing is saved', () => {
    const result = loadState(createFakeStorage(), options);
    expect(result).toEqual({ state: emptyState, problem: null });
  });

  it('loads previously saved state', () => {
    const saved = sampleState();
    const storage = createFakeStorage({ [STORAGE_KEY]: JSON.stringify(saved) });

    expect(loadState(storage, options)).toEqual({ state: saved, problem: null });
  });

  it('returns what saveState wrote', () => {
    const storage = createFakeStorage();
    saveState(storage, sampleState());
    expect(loadState(storage, options).state).toEqual(sampleState());
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['JSON null', 'null'],
    ['a plain string', '"mleko"'],
    ['an unknown version', JSON.stringify({ ...createInitialState('l_1'), version: 99 })],
    ['missing lists', JSON.stringify({ version: 1, activeListId: 'l_1' })],
    ['a missing active list', JSON.stringify({ ...createInitialState('l_1'), activeListId: 'l_x' })],
    [
      'an item without a name',
      JSON.stringify({
        version: 1,
        activeListId: 'l_1',
        lists: [{ id: 'l_1', name: 'Zakupy', items: [{ id: 'i_1', checked: false }] }],
      }),
    ],
  ])('treats %s as corrupted', (_label, raw) => {
    const storage = createFakeStorage({ [STORAGE_KEY]: raw });
    const result = loadState(storage, options);

    expect(result).toEqual({ state: emptyState, problem: 'corrupted' });
    expect(storage.data[`${STORAGE_KEY}-backup-5000`]).toBe(raw);
  });

  it('does not overwrite the corrupted value while loading', () => {
    const storage = createFakeStorage({ [STORAGE_KEY]: '{not json' });
    loadState(storage, options);
    expect(storage.data[STORAGE_KEY]).toBe('{not json');
  });

  it('reports unavailable storage instead of crashing', () => {
    const result = loadState(createBrokenStorage(), options);
    expect(result).toEqual({ state: emptyState, problem: 'unavailable' });
  });
});

describe('saveState', () => {
  it('writes the state as JSON under the app key', () => {
    const storage = createFakeStorage();

    expect(saveState(storage, sampleState())).toBe(true);
    expect(JSON.parse(storage.data[STORAGE_KEY])).toEqual(sampleState());
  });

  it('returns false instead of crashing when the browser refuses to save', () => {
    expect(saveState(createBrokenStorage(), sampleState())).toBe(false);
  });
});
