// App entry point: loads the saved state, connects user actions to store.js
// functions, and after every change saves and re-renders.

import { addItem, toggleItem } from './store.js';
import { loadState, saveState } from './storage.js';
import { createUI } from './ui.js';

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
});

function update(newState) {
  state = newState;
  if (!saveState(storage, state)) {
    ui.showMessage('Nie udało się zapisać listy.', { persistent: true });
  }
  ui.render(state);
}

ui.render(state);
if (loaded.problem) {
  ui.showMessage(LOAD_PROBLEM_MESSAGES[loaded.problem], { persistent: true });
}
