// Shopping list logic. Pure functions only: each takes the current state
// and returns a new one, never mutating the input. No DOM, no localStorage.
//
// IDs and timestamps are passed in as arguments instead of being created here
// (crypto.randomUUID(), Date.now()), so every function gives the same result
// for the same input and is easy to test.

export const DATA_VERSION = 1;
export const MAX_NAME_LENGTH = 100;

export function createInitialState(listId) {
  return {
    version: DATA_VERSION,
    activeListId: listId,
    lists: [{ id: listId, name: 'Zakupy', items: [] }],
  };
}

// Used to detect duplicates: "  Mleko   2 L " and "mleko 2 l" are the same product.
export function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pl');
}

// Quantity patterns (spec 9.1), built from small parts so each one stays readable.
const NUMBER = String.raw`\d+(?:[.,]\d+)?`; // 2, 0,5, 1.5
const UNIT = String.raw`(?:g|dag|dkg|kg|ml|l|szt|op|opak)\.?`; // optional dot: "szt."
const MULTIPLIER = String.raw`(?:[x×]\d+|\d+[x×])`; // x2, 2x
// A bare number is not accepted at the end: "mąka typ 450" is a name, not 450 of "mąka typ".
const QUANTITY_AT_END = new RegExp(String.raw`^(.+?)\s+(${NUMBER}\s*${UNIT}|${MULTIPLIER})$`, 'i');
// At the start a bare number is fine: "6 jajek".
const QUANTITY_AT_START = new RegExp(String.raw`^(${NUMBER}(?:\s*${UNIT})?|${MULTIPLIER})\s+(.+)$`, 'i');
const ONLY_QUANTITY = new RegExp(String.raw`^(?:${NUMBER}(?:\s*${UNIT})?|${MULTIPLIER})$`, 'i');

// Splits a stored name into the product and its quantity, both as typed:
// "mleko 2 l" → { name: 'mleko', quantity: '2 l' },
// "6 jajek"   → { name: 'jajek', quantity: '6' },
// "chleb"     → { name: 'chleb', quantity: null }.
// The quantity is never stored separately; it is read from the name when needed.
export function parseQuantity(fullName) {
  const text = fullName.trim();
  const noQuantity = { name: text, quantity: null };

  // "2 l" alone has no product name left, so the whole text is the name.
  // Without this check the start pattern would read it as 2 of "l".
  if (ONLY_QUANTITY.test(text)) return noQuantity;

  // Only one quantity is read, and the end goes first: "2 l mleko 1 l" → "2 l mleko" + "1 l".
  const atEnd = text.match(QUANTITY_AT_END);
  if (atEnd) return { name: atEnd[1], quantity: atEnd[2] };

  const atStart = text.match(QUANTITY_AT_START);
  if (atStart) return { name: atStart[2], quantity: atStart[1] };

  return noQuantity;
}

export function getActiveList(state) {
  return state.lists.find((list) => list.id === state.activeListId);
}

// Duplicates are compared without the quantity: "mleko" and "Mleko 2 l" are the same product.
function duplicateKey(name) {
  return normalizeName(parseQuantity(name).name);
}

function findDuplicate(items, name, ignoredItemId = null) {
  const key = duplicateKey(name);
  return items.find((item) => item.id !== ignoredItemId && duplicateKey(item.name) === key);
}

// Returns null for a valid name, otherwise the reason it is invalid.
function validateName(name) {
  if (name === '') return 'empty';
  if (name.length > MAX_NAME_LENGTH) return 'too-long';
  return null;
}

// Returns a new state where the active list's items are replaced by
// updateItems(oldItems). All other lists stay untouched.
function updateActiveItems(state, updateItems) {
  return {
    ...state,
    lists: state.lists.map((list) =>
      list.id === state.activeListId
        ? { ...list, items: updateItems(list.items) }
        : list,
    ),
  };
}

function updateItem(state, itemId, changes) {
  return updateActiveItems(state, (items) =>
    items.map((item) => (item.id === itemId ? { ...item, ...changes } : item)),
  );
}

// Returns { state, status, itemId }. The UI needs more than the new state:
// on a duplicate it highlights the existing item, on 'empty' it does nothing.
// status: 'added' | 'duplicate' | 'empty' | 'too-long'
export function addItem(state, rawName, { id, now }) {
  const name = rawName.trim();
  const error = validateName(name);
  if (error) {
    return { state, status: error, itemId: null };
  }

  const duplicate = findDuplicate(getActiveList(state).items, name);
  if (duplicate) {
    // A duplicate of a bought item means "I need it again", so move it back to "to buy".
    const changes = { checked: false, checkedAt: null };
    // A new quantity ("mleko 3 l" for "mleko 2 l") replaces the old one. Without
    // a quantity ("mleko") the user only reminded us of the product, so keep its name.
    if (parseQuantity(name).quantity !== null) {
      changes.name = name;
    }
    const newState = updateItem(state, duplicate.id, changes);
    return { state: newState, status: 'duplicate', itemId: duplicate.id };
  }

  const item = {
    id,
    name,
    checked: false,
    createdAt: now,
    checkedAt: null,
    categoryId: null,
  };
  const newState = updateActiveItems(state, (items) => [...items, item]);
  return { state: newState, status: 'added', itemId: id };
}

export function toggleItem(state, itemId, now) {
  const item = getActiveList(state).items.find((i) => i.id === itemId);
  if (!item) return state;

  return item.checked
    ? updateItem(state, itemId, { checked: false, checkedAt: null })
    : updateItem(state, itemId, { checked: true, checkedAt: now });
}

// Returns { state, status }. On any error the state is unchanged, so the UI
// can simply restore the previous name.
// status: 'renamed' | 'empty' | 'too-long' | 'duplicate'
export function renameItem(state, itemId, rawName) {
  const name = rawName.trim();
  const error = validateName(name);
  if (error) {
    return { state, status: error };
  }

  // The item itself is ignored, so changing only letter case ("mleko" → "Mleko") is allowed.
  if (findDuplicate(getActiveList(state).items, name, itemId)) {
    return { state, status: 'duplicate' };
  }

  return { state: updateItem(state, itemId, { name }), status: 'renamed' };
}

export function removeItem(state, itemId) {
  return updateActiveItems(state, (items) => items.filter((item) => item.id !== itemId));
}

export function clearChecked(state) {
  return updateActiveItems(state, (items) => items.filter((item) => !item.checked));
}

// Splits items into the two sections shown on screen:
// "to buy" in the order they were added (newest last),
// "bought" with the most recently checked first.
export function getSections(list) {
  const toBuy = list.items
    .filter((item) => !item.checked)
    .sort((a, b) => a.createdAt - b.createdAt);
  const bought = list.items
    .filter((item) => item.checked)
    .sort((a, b) => b.checkedAt - a.checkedAt);
  return { toBuy, bought };
}

export function getProgress(list) {
  const checked = list.items.filter((item) => item.checked).length;
  return { checked, total: list.items.length };
}
