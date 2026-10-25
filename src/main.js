// App entry point: loads the saved state, connects user actions to store.js
// functions, and after every change saves and re-renders.

import {
  getActiveList,
  addItem,
  toggleItem,
  renameItem,
  removeItem,
  moveItem,
  setItemCategory,
  clearChecked,
  addCategory,
  renameCategory,
  isCategoryUsed,
  removeCategory,
  moveCategory,
} from './store.js';
import { loadState, saveState } from './storage.js';
import { createUI } from './ui.js';
import { isWakeLockSupported, createWakeLock } from './wake-lock.js';

const LOAD_PROBLEM_MESSAGES = {
  corrupted:
    'Nie udało się odczytać zapisanej listy. Zaczynasz od pustej, a kopia starych danych została zachowana.',
  unavailable: 'Przeglądarka blokuje zapis danych. Lista nie zostanie zapamiętana.',
};

function createId(prefix) {
  return prefix + crypto.randomUUID();
}

// Some browsers throw on the mere access to window.localStorage when storage
// is blocked. Returning null makes loadState() report it as 'unavailable'.
function getStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Created only where the browser supports it; otherwise the button stays hidden.
const wakeLock = isWakeLockSupported()
  ? createWakeLock({
      onFailure() {
        ui.updateWakeLockButton(false);
        ui.showMessage('Nie udało się wyłączyć wygaszania ekranu.');
      },
    })
  : null;

const storage = getStorage();
const loaded = loadState(storage, { now: Date.now(), listId: createId('l_') });
let state = loaded.state;

const ui = createUI({
  onAdd(name) {
    const result = addItem(state, name, { id: createId('i_'), now: Date.now() });
    if (result.status === 'empty') return;

    update(result.state);
    if (result.status === 'duplicate') {
      ui.highlightItem(result.itemId);
    }
  },

  onToggle(itemId) {
    update(toggleItem(state, itemId, Date.now()));
  },

  // On 'empty' the UI has already restored the old name, so there is nothing to do.
  onRename(itemId, name) {
    const result = renameItem(state, itemId, name);
    if (result.status === 'renamed') {
      update(result.state);
    } else if (result.status === 'duplicate') {
      ui.showMessage('Taki produkt już jest na liście.');
    }
  },

  onRemove(itemId) {
    const item = getActiveList(state).items.find((i) => i.id === itemId);
    updateWithUndo(removeItem(state, itemId), `Usunięto: ${item.name}`);
  },

  onMove(itemId, toIndex) {
    const newState = moveItem(state, itemId, toIndex);
    // Same state means nothing moved (e.g. ArrowUp on the top item): skip saving.
    if (newState !== state) {
      update(newState);
    }
  },

  onSetCategory(itemId, categoryId) {
    const newState = setItemCategory(state, itemId, categoryId);
    if (newState === state) return;

    update(newState);
    // The item may now be in a group far away on the screen: show where it went.
    ui.highlightItem(itemId);
  },

  onClearChecked() {
    updateWithUndo(clearChecked(state), 'Wyczyszczono kupione produkty.');
  },

  // ----- Categories dialog (spec 10.5) -----

  onAddCategory(name) {
    const result = addCategory(state, name, createId('c_'));
    if (result.status === 'added') {
      update(result.state);
    } else if (result.status === 'duplicate') {
      ui.showCategoryMessage('Taka kategoria już jest.');
    }
  },

  // On 'empty' the dialog has already restored the old name, as with products.
  onRenameCategory(categoryId, name) {
    const result = renameCategory(state, categoryId, name);
    if (result.status === 'renamed') {
      update(result.state);
    } else if (result.status === 'duplicate') {
      ui.showCategoryMessage('Taka kategoria już jest.');
    }
  },

  // No "Cofnij" here: the dialog covers the message bar. So a category that
  // still has products is removed only after a confirmation.
  onRemoveCategory(categoryId) {
    const category = state.categories.find((c) => c.id === categoryId);
    if (
      isCategoryUsed(state, categoryId) &&
      !confirm(`Usunąć kategorię „${category.name}”? Produkty z tej kategorii trafią do „Bez kategorii”.`)
    ) {
      return;
    }
    update(removeCategory(state, categoryId));
  },

  onMoveCategory(categoryId, toIndex) {
    const newState = moveCategory(state, categoryId, toIndex);
    if (newState !== state) {
      update(newState);
    }
  },

  // Not part of the list state: the switch is not saved (spec 9.3).
  async onToggleWakeLock() {
    await wakeLock.setEnabled(!wakeLock.isEnabled());
    ui.updateWakeLockButton(wakeLock.isEnabled());
  },
});

// Like update(), but shows a message with "Cofnij" that brings back the state
// from before this change. State objects are never mutated (see store.js),
// so keeping a reference to the old one is enough to restore it.
function updateWithUndo(newState, message) {
  const previousState = state;
  update(newState);
  ui.showMessage(message, {
    action: { label: 'Cofnij', onClick: () => update(previousState) },
  });
}

function update(newState) {
  // Any change makes an earlier "Cofnij" outdated: undoing it now would also
  // throw away this change.
  ui.dismissAction();
  state = newState;
  if (!saveState(storage, state)) {
    ui.showMessage('Nie udało się zapisać listy.', { persistent: true });
  }
  ui.render(state);
}

ui.render(state);
if (wakeLock) {
  ui.updateWakeLockButton(false);
}
if (loaded.problem) {
  ui.showMessage(LOAD_PROBLEM_MESSAGES[loaded.problem], { persistent: true });
}
