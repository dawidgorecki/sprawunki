// Reading and writing the app state in localStorage.
//
// The storage object is passed in as an argument (in the app: window.localStorage).
// Tests pass a simple fake object instead, so they run without a browser.

import { DATA_VERSION, DEFAULT_CATEGORIES, createInitialState, findCategoryId } from './store.js';

export const STORAGE_KEY = 'sprawunki';

// Brings saved data up to the current DATA_VERSION, or throws if it can't.
// Each step upgrades by one version, so data saved by any older app version
// goes through all the steps it missed. A future step: if (data.version === 2) ...
export function migrate(data) {
  let migrated = data;
  if (migrated.version === 1) {
    migrated = migrateV1toV2(migrated);
  }

  if (migrated.version === DATA_VERSION) {
    return migrated;
  }
  throw new Error(`Unknown data version: ${data.version}`);
}

// Version 2 adds categories (spec 10.6): the default ones, an empty memory, and
// a category from the dictionary for every existing item, so the list is grouped
// right after the update. Names, states and the order of items stay as they were.
// Broken version 1 data (e.g. no lists) makes this throw, and loadState treats
// it as corrupted, like any other unreadable value.
function migrateV1toV2(data) {
  const categories = DEFAULT_CATEGORIES.map((category) => ({ ...category }));
  return {
    ...data,
    version: 2,
    categories,
    categoryMemory: {},
    lists: data.lists.map((list) => ({
      ...list,
      items: list.items.map((item) => ({
        ...item,
        // An empty memory: the user has not chosen anything yet.
        categoryId: findCategoryId(item.name, categories, {}),
      })),
    })),
  };
}

// Checks the shape the rest of the app relies on, so a hand-edited or half-written
// value is treated as corrupted instead of crashing the UI later.
function isValidState(data) {
  if (!Array.isArray(data.lists)) return false;
  if (!areValidCategories(data.categories)) return false;
  if (!isValidCategoryMemory(data.categoryMemory)) return false;
  if (!data.lists.some((list) => list?.id === data.activeListId)) return false;
  // Every list, not only the active one: the list picker shows all names and
  // counters, and the user can switch to any of them (spec 11.2).
  return data.lists.every(isValidList);
}

function isValidList(list) {
  return (
    typeof list?.id === 'string' &&
    typeof list?.name === 'string' &&
    Array.isArray(list?.items) &&
    list.items.every(
      (item) =>
        typeof item?.id === 'string' &&
        typeof item?.name === 'string' &&
        typeof item?.checked === 'boolean',
    )
  );
}

function areValidCategories(categories) {
  return (
    Array.isArray(categories) &&
    categories.every(
      (category) => typeof category?.id === 'string' && typeof category?.name === 'string',
    )
  );
}

// A plain object ({}), not null or an array, whose values are category ids or null.
function isValidCategoryMemory(memory) {
  if (typeof memory !== 'object' || memory === null || Array.isArray(memory)) return false;
  return Object.values(memory).every((id) => id === null || typeof id === 'string');
}

// Returns { state, problem }.
// problem: null           – loaded fine, or nothing was saved yet (first start)
//          'corrupted'    – saved value was unreadable; a copy was kept under a backup key
//          'unavailable'  – localStorage can't be read at all (e.g. blocked by the browser)
// In both problem cases the app starts with an empty list and the UI shows a message.
export function loadState(storage, { now, listId }) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: createInitialState(listId), problem: 'unavailable' };
  }

  if (raw === null) {
    return { state: createInitialState(listId), problem: null };
  }

  try {
    const data = migrate(JSON.parse(raw));
    if (!isValidState(data)) {
      throw new Error('Invalid data structure');
    }
    return { state: data, problem: null };
  } catch {
    // The next save overwrites the main key, so keep the original value
    // under a separate key first. Nothing is lost, it can be recovered by hand.
    backUp(storage, raw, now);
    return { state: createInitialState(listId), problem: 'corrupted' };
  }
}

function backUp(storage, raw, now) {
  try {
    storage.setItem(`${STORAGE_KEY}-backup-${now}`, raw);
  } catch {
    // Storage full or blocked: there is nothing more we can do here.
  }
}

// Returns true when saved, false when the browser refused (e.g. storage full).
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
