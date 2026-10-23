// Reading and writing the app state in localStorage.
//
// The storage object is passed in as an argument (in the app: window.localStorage).
// Tests pass a simple fake object instead, so they run without a browser.

import { DATA_VERSION, createInitialState } from './store.js';

export const STORAGE_KEY = 'sprawunki';

// Brings saved data up to the current DATA_VERSION, or throws if it can't.
// Future versions add steps here, e.g.: if (data.version === 1) data = migrateV1toV2(data);
export function migrate(data) {
  if (data.version === DATA_VERSION) {
    return data;
  }
  throw new Error(`Unknown data version: ${data.version}`);
}

// Checks the shape the rest of the app relies on, so a hand-edited or half-written
// value is treated as corrupted instead of crashing the UI later.
function isValidState(data) {
  if (!Array.isArray(data.lists)) return false;

  const activeList = data.lists.find((list) => list.id === data.activeListId);
  if (!activeList || !Array.isArray(activeList.items)) return false;

  return activeList.items.every(
    (item) =>
      typeof item.id === 'string' &&
      typeof item.name === 'string' &&
      typeof item.checked === 'boolean',
  );
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
