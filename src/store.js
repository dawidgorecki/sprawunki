// Shopping list logic. Pure functions only: each takes the current state
// and returns a new one, never mutating the input. No DOM, no localStorage.
//
// IDs and timestamps are passed in as arguments instead of being created here
// (crypto.randomUUID(), Date.now()), so every function gives the same result
// for the same input and is easy to test.

import { PRODUCT_DICTIONARY } from './product-dictionary.js';

// Version 2 added categories (spec 10.6). Older data is upgraded by migrate() in storage.js.
export const DATA_VERSION = 2;
export const MAX_NAME_LENGTH = 100;
export const MAX_CATEGORY_NAME_LENGTH = 40;
export const MAX_LIST_NAME_LENGTH = 40;

export function createInitialState(listId) {
  return {
    version: DATA_VERSION,
    activeListId: listId,
    // Copies, so a later change to the state can never touch the constant itself.
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    // Normalized product name without quantity → category id, or null for "Bez kategorii".
    categoryMemory: {},
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

// Store departments a new user starts with (spec 10.1), in the order of a walk
// through a typical shop. The ids are fixed, not random, because the product
// dictionary refers to them.
export const DEFAULT_CATEGORIES = [
  { id: 'c_produce', name: 'Warzywa i owoce' },
  { id: 'c_bakery', name: 'Pieczywo' },
  { id: 'c_dairy', name: 'Nabiał' },
  { id: 'c_meat', name: 'Mięso i ryby' },
  { id: 'c_deli', name: 'Wędliny' },
  { id: 'c_frozen', name: 'Mrożonki' },
  { id: 'c_pantry', name: 'Spiżarnia' },
  { id: 'c_snacks', name: 'Słodycze i przekąski' },
  { id: 'c_drinks', name: 'Napoje' },
  { id: 'c_household', name: 'Chemia i kosmetyki' },
];

// The dictionary is grouped by category for easy editing; for lookups it is
// turned once into a Map: product name → category id.
const DICTIONARY_INDEX = new Map(
  Object.entries(PRODUCT_DICTIONARY).flatMap(([categoryId, names]) =>
    names.map((name) => [name, categoryId]),
  ),
);

// Picks the category for a product name (spec 10.2). Returns a category id,
// or null for "Bez kategorii". Checked in this order:
//   1. memory – what the user chose before for this name, null included
//      (choosing "Bez kategorii" turns the dictionary off for that name),
//   2. the dictionary, whole name: "mleko 2 l" → "mleko",
//   3. the dictionary, first word only: "mleko owsiane" → "mleko",
//   4. null.
// Ids of categories the user has deleted are skipped at every step.
export function findCategoryId(fullName, categories, memory) {
  const key = duplicateKey(fullName);
  const exists = (id) => categories.some((category) => category.id === id);

  // Object.hasOwn, not memory[key]: a remembered null must count as an answer,
  // and names like "constructor" must not find built-in object properties.
  if (Object.hasOwn(memory, key)) {
    const remembered = memory[key];
    if (remembered === null || exists(remembered)) return remembered;
  }

  const firstWord = key.split(' ')[0];
  for (const candidate of [key, firstWord]) {
    const id = DICTIONARY_INDEX.get(candidate);
    if (id && exists(id)) return id;
  }
  return null;
}

// Returns null for a valid name, otherwise the reason it is invalid.
function validateName(name, maxLength = MAX_NAME_LENGTH) {
  if (name === '') return 'empty';
  if (name.length > maxLength) return 'too-long';
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
    categoryId: findCategoryId(name, state.categories, state.categoryMemory),
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

// Puts an item into another category (categoryId, or null for "Bez kategorii")
// and remembers the choice for its name without quantity, so next time the
// same product lands there by itself (spec 10.2, 10.4).
// Returns the same state for an unknown item or category, or the same category.
export function setItemCategory(state, itemId, categoryId) {
  const items = getActiveList(state).items;
  const item = items.find((i) => i.id === itemId);
  const categoryExists = state.categories.some((category) => category.id === categoryId);
  if (!item || (categoryId !== null && !categoryExists)) return state;
  if (item.categoryId === categoryId) return state;

  // The item goes to the end of the array, which shows it at the bottom of its
  // new group. Left in place, it could appear anywhere in that group.
  const moved = { ...item, categoryId };
  const newState = updateActiveItems(state, () => [
    ...items.filter((i) => i.id !== itemId),
    moved,
  ]);
  return {
    ...newState,
    categoryMemory: { ...state.categoryMemory, [duplicateKey(item.name)]: categoryId },
  };
}

export function removeItem(state, itemId) {
  return updateActiveItems(state, (items) => items.filter((item) => item.id !== itemId));
}

export function clearChecked(state) {
  return updateActiveItems(state, (items) => items.filter((item) => !item.checked));
}

// The category an item is shown under: its categoryId, or null ("Bez kategorii")
// when it has none or its category was deleted (spec 10.6).
function shownCategoryId(item, categories) {
  return categories.some((category) => category.id === item.categoryId) ? item.categoryId : null;
}

// Moves an item to position toIndex within its group of "to buy" items (0 = top
// of the group), so it never leaves its category (spec 10.3). All other items –
// other groups and bought ones – keep their places in the array, so an item
// unchecked later returns where it was.
// Returns the same state when nothing moves (bought or unknown item, same position).
export function moveItem(state, itemId, toIndex) {
  const items = getActiveList(state).items;
  const item = items.find((i) => i.id === itemId);
  if (!item || item.checked) return state;

  const groupId = shownCategoryId(item, state.categories);
  const inGroup = (i) => !i.checked && shownCategoryId(i, state.categories) === groupId;
  const group = items.filter(inGroup);
  const fromIndex = group.indexOf(item);

  // An index past either end means "to the top" or "to the bottom".
  const targetIndex = Math.max(0, Math.min(toIndex, group.length - 1));
  if (targetIndex === fromIndex) return state;

  const reordered = [...group];
  reordered.splice(fromIndex, 1);
  reordered.splice(targetIndex, 0, item);

  // Put the reordered group back into the array slots the group used before,
  // leaving every other item exactly where it was.
  let next = 0;
  return updateActiveItems(state, () => items.map((i) => (inGroup(i) ? reordered[next++] : i)));
}

// Splits items into what is shown on screen:
// groups – "to buy" items split by category (spec 10.3), as
//          [{ category: { id, name } or null for "Bez kategorii", items }],
//          in the order of categories, "Bez kategorii" last, no empty groups.
//          Inside a group: the order of the items array, that is the order
//          they were added (newest last), unless the user moved them (spec 9.2);
// bought – the most recently checked first, not grouped.
export function getSections(list, categories) {
  const toBuy = list.items.filter((item) => !item.checked);
  const bought = list.items
    .filter((item) => item.checked)
    .sort((a, b) => b.checkedAt - a.checkedAt);
  return { groups: groupByCategory(toBuy, categories), bought };
}

function groupByCategory(items, categories) {
  const groups = categories.map((category) => ({
    category,
    items: items.filter((item) => item.categoryId === category.id),
  }));
  // Also catches ids of deleted categories, which count as no category (spec 10.6).
  groups.push({
    category: null,
    items: items.filter((item) => shownCategoryId(item, categories) === null),
  });
  return groups.filter((group) => group.items.length > 0);
}

export function getProgress(list) {
  const checked = list.items.filter((item) => item.checked).length;
  return { checked, total: list.items.length };
}

// ---------- Managing categories (spec 10.5) ----------
// Categories are shared by the whole app, not by one list, so these functions
// change state.categories and, where needed, items in every list.

// Category and list names are compared like product names, but without reading
// a quantity: "Napoje 2" is a different category from "Napoje".
// entries: categories or lists, anything with an id and a name.
function findByName(entries, name, ignoredId = null) {
  const normalized = normalizeName(name);
  return entries.find(
    (entry) => entry.id !== ignoredId && normalizeName(entry.name) === normalized,
  );
}

// Returns a copy of array with the entry of the given id moved to position
// toIndex (0 = first); an index past either end means first or last.
// Returns the same array when nothing moves (unknown id, same position),
// so callers can return their unchanged state.
function moveById(array, id, toIndex) {
  const fromIndex = array.findIndex((entry) => entry.id === id);
  if (fromIndex === -1) return array;

  const targetIndex = Math.max(0, Math.min(toIndex, array.length - 1));
  if (targetIndex === fromIndex) return array;

  const moved = [...array];
  const [entry] = moved.splice(fromIndex, 1);
  moved.splice(targetIndex, 0, entry);
  return moved;
}

// Returns { state, status, categoryId }. A new category goes to the end.
// status: 'added' | 'empty' | 'too-long' | 'duplicate'
export function addCategory(state, rawName, id) {
  const name = rawName.trim();
  const error = validateName(name, MAX_CATEGORY_NAME_LENGTH);
  if (error) return { state, status: error, categoryId: null };
  if (findByName(state.categories, name)) {
    return { state, status: 'duplicate', categoryId: null };
  }

  const newState = { ...state, categories: [...state.categories, { id, name }] };
  return { state: newState, status: 'added', categoryId: id };
}

// Returns { state, status }. On any error the state is unchanged, so the UI
// can simply restore the previous name, as with products.
// status: 'renamed' | 'empty' | 'too-long' | 'duplicate' | 'not-found'
export function renameCategory(state, categoryId, rawName) {
  if (!state.categories.some((category) => category.id === categoryId)) {
    return { state, status: 'not-found' };
  }
  const name = rawName.trim();
  const error = validateName(name, MAX_CATEGORY_NAME_LENGTH);
  if (error) return { state, status: error };
  // The category itself is ignored, so "napoje" → "Napoje" is allowed.
  if (findByName(state.categories, name, categoryId)) {
    return { state, status: 'duplicate' };
  }

  const categories = state.categories.map((category) =>
    category.id === categoryId ? { ...category, name } : category,
  );
  return { state: { ...state, categories }, status: 'renamed' };
}

// True when any item, on any list, bought or not, belongs to the category.
// The UI asks for confirmation before removing such a category (spec 10.5).
export function isCategoryUsed(state, categoryId) {
  return state.lists.some((list) => list.items.some((item) => item.categoryId === categoryId));
}

// Removes a category. Its items on every list go to "Bez kategorii" (null), and
// memory entries pointing to it are forgotten (spec 10.4), so those products
// fall back to the dictionary next time. Returns the same state for an unknown id.
export function removeCategory(state, categoryId) {
  if (!state.categories.some((category) => category.id === categoryId)) return state;

  const categoryMemory = Object.fromEntries(
    Object.entries(state.categoryMemory).filter(([, id]) => id !== categoryId),
  );
  return {
    ...state,
    categories: state.categories.filter((category) => category.id !== categoryId),
    categoryMemory,
    lists: state.lists.map((list) => ({
      ...list,
      items: list.items.map((item) =>
        item.categoryId === categoryId ? { ...item, categoryId: null } : item,
      ),
    })),
  };
}

// Moves a category to position toIndex (0 = first), like moveItem for products.
// Returns the same state when nothing moves (unknown id, same position).
export function moveCategory(state, categoryId, toIndex) {
  const categories = moveById(state.categories, categoryId, toIndex);
  return categories === state.categories ? state : { ...state, categories };
}

// ---------- Managing lists (spec 11) ----------
// Every product action above works on the active list only; these functions
// add, rename, remove and reorder whole lists and switch the active one.
// Progress of any list (the "3/7" counter in the list picker) is getProgress(list).

function hasList(state, listId) {
  return state.lists.some((list) => list.id === listId);
}

// Returns { state, status, listId }. A new list goes to the end and does not
// become active, so the user can add several lists in a row (spec 11.3).
// status: 'added' | 'empty' | 'too-long' | 'duplicate'
export function addList(state, rawName, id) {
  const name = rawName.trim();
  const error = validateName(name, MAX_LIST_NAME_LENGTH);
  if (error) return { state, status: error, listId: null };
  if (findByName(state.lists, name)) {
    return { state, status: 'duplicate', listId: null };
  }

  const newState = { ...state, lists: [...state.lists, { id, name, items: [] }] };
  return { state: newState, status: 'added', listId: id };
}

// Returns { state, status }, like renameCategory.
// status: 'renamed' | 'empty' | 'too-long' | 'duplicate' | 'not-found'
export function renameList(state, listId, rawName) {
  if (!hasList(state, listId)) return { state, status: 'not-found' };
  const name = rawName.trim();
  const error = validateName(name, MAX_LIST_NAME_LENGTH);
  if (error) return { state, status: error };
  if (findByName(state.lists, name, listId)) {
    return { state, status: 'duplicate' };
  }

  const lists = state.lists.map((list) => (list.id === listId ? { ...list, name } : list));
  return { state: { ...state, lists }, status: 'renamed' };
}

// Removes a list together with its items. The last list is never removed,
// because there is always at least one (spec 11.1). When the active list goes,
// the first remaining list becomes active.
// Returns the same state for an unknown id or the last list.
// Asking for confirmation when the list has items is up to the UI.
export function removeList(state, listId) {
  if (!hasList(state, listId) || state.lists.length === 1) return state;

  const lists = state.lists.filter((list) => list.id !== listId);
  const activeListId = state.activeListId === listId ? lists[0].id : state.activeListId;
  return { ...state, activeListId, lists };
}

// Moves a list to position toIndex (0 = first), like moveCategory.
export function moveList(state, listId, toIndex) {
  const lists = moveById(state.lists, listId, toIndex);
  return lists === state.lists ? state : { ...state, lists };
}

// Makes another list active. Returns the same state for an unknown id or the
// list that is already active, so the UI can skip saving and rendering.
export function setActiveList(state, listId) {
  if (!hasList(state, listId) || state.activeListId === listId) return state;
  return { ...state, activeListId: listId };
}
