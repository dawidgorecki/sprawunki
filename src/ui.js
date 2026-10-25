// Rendering and DOM event handling. This module knows nothing about storage
// or how the state changes: it draws the state it is given and reports user
// actions to the handlers passed in from main.js.

import { getActiveList, getSections, getProgress, parseQuantity } from './store.js';
import { enableDragging } from './drag.js';

const MESSAGE_DURATION_MS = 5000;

// handlers: { onAdd(name), onToggle(itemId), onRename(itemId, name),
//             onRemove(itemId), onMove(itemId, toIndex), onClearChecked(),
//             onToggleWakeLock() }
// Returns functions main.js uses to update the screen.
export function createUI(handlers) {
  const elements = {
    progress: document.getElementById('progress'),
    wakeLock: document.getElementById('wake-lock'),
    messageText: document.getElementById('message-text'),
    messageButton: document.getElementById('message-button'),
    emptyState: document.getElementById('empty-state'),
    toBuySection: document.getElementById('to-buy-section'),
    toBuyGroups: document.getElementById('to-buy-groups'),
    boughtSection: document.getElementById('bought-section'),
    boughtList: document.getElementById('bought-list'),
    clearChecked: document.getElementById('clear-checked'),
    addForm: document.getElementById('add-form'),
    nameInput: document.getElementById('new-item-name'),
  };

  elements.addForm.addEventListener('submit', (event) => {
    event.preventDefault(); // stop the browser from reloading the page
    handlers.onAdd(elements.nameInput.value);
    elements.nameInput.value = '';
    // Clicking "Dodaj" moves focus to the button; bring it back for the next product.
    elements.nameInput.focus();
  });

  // One listener on <main> instead of one per item. The list is rebuilt on
  // every render, so listeners attached to items would be thrown away anyway.
  const main = document.querySelector('main');

  main.addEventListener('change', (event) => {
    if (!event.target.matches('.item-checkbox')) return;

    const itemId = event.target.closest('li').dataset.id;
    handlers.onToggle(itemId);
    // Render replaced the checkbox with a new element; keep keyboard focus on it.
    findItemElement(itemId)?.querySelector('.item-checkbox').focus();
  });

  main.addEventListener('click', (event) => {
    const itemId = event.target.closest('li')?.dataset.id;
    // closest(), not matches(): the tap may land on the quantity label inside the name button.
    const nameButton = event.target.closest('.item-name');

    if (nameButton) {
      startEditing(nameButton, itemId, handlers.onRename);
    } else if (event.target.matches('.item-remove')) {
      handlers.onRemove(itemId);
    }
  });

  // Arrow keys on a reorder handle move the item one place up or down (spec 9.2).
  main.addEventListener('keydown', (event) => {
    if (!event.target.matches('.item-handle')) return;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    event.preventDefault(); // otherwise the arrow keys also scroll the page
    const li = event.target.closest('li');
    // Each group is its own <ul>, so the position among the siblings is the
    // position within the group, which moveItem expects.
    const index = [...li.parentElement.children].indexOf(li);
    const toIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;

    handlers.onMove(li.dataset.id, toIndex);
    // Render replaced the handle with a new element; keep keyboard focus on it.
    findItemElement(li.dataset.id)?.querySelector('.item-handle').focus();
  });

  enableDragging(elements.toBuyGroups, handlers.onMove);

  elements.wakeLock.addEventListener('click', () => handlers.onToggleWakeLock());

  // No confirm() needed: the user can undo with "Cofnij" (spec 3.7 / 3.8).
  elements.clearChecked.addEventListener('click', () => handlers.onClearChecked());

  let messageTimer = null;
  // Function run by the message button (e.g. undo), or null for a plain "OK".
  let messageAction = null;

  function hideMessage() {
    clearTimeout(messageTimer);
    messageAction = null;
    elements.messageText.textContent = '';
    elements.messageButton.hidden = true;
  }

  elements.messageButton.addEventListener('click', () => {
    const action = messageAction;
    // :focus-visible is true only when the button was reached with the keyboard.
    // Checked before hiding, because a hidden button loses focus.
    const usedKeyboard = elements.messageButton.matches(':focus-visible');

    hideMessage();
    action?.();

    // The focused button just disappeared; move focus somewhere useful. Skipped
    // after a tap, because focusing the field would pop up the phone keyboard.
    if (usedKeyboard) {
      elements.nameInput.focus();
    }
  });

  return {
    render(state) {
      render(elements, state);
    },

    // persistent: the message stays until the user closes it with "OK"; use it for
    //   problems the user must not miss. Other messages disappear on their own.
    // action: { label, onClick } shows a button that runs onClick, e.g. "Cofnij".
    showMessage(text, { persistent = false, action = null } = {}) {
      clearTimeout(messageTimer);
      messageAction = action?.onClick ?? null;
      elements.messageText.textContent = text;
      elements.messageButton.textContent = action?.label ?? 'OK';
      elements.messageButton.hidden = !persistent && !action;
      if (!persistent) {
        messageTimer = setTimeout(hideMessage, MESSAGE_DURATION_MS);
      }
    },

    // Hides the message only if it offers an action. After any other change an
    // old "Cofnij" would restore an outdated state, so it must go. Plain
    // messages (e.g. a storage error) stay.
    dismissAction() {
      if (messageAction) {
        hideMessage();
      }
    },

    // Shows the wake lock switch (hidden until then) in the given state.
    // aria-pressed makes it a toggle button: screen readers say "on" / "off".
    updateWakeLockButton(enabled) {
      elements.wakeLock.hidden = false;
      elements.wakeLock.setAttribute('aria-pressed', String(enabled));
    },

    // Used when the user tries to add a product that is already on the list.
    highlightItem(itemId) {
      const element = findItemElement(itemId);
      if (!element) return;

      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      element.classList.add('highlight');
      element.addEventListener('animationend', () => element.classList.remove('highlight'), {
        once: true,
      });
    },
  };
}

// Swaps the name button for a text field. Enter or leaving the field saves,
// Escape cancels. The button is always put back first; if the rename succeeds,
// the following render replaces it with the new name anyway. This way a
// rejected name (empty, duplicate) needs no extra code to restore.
function startEditing(nameButton, itemId, onRename) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-name-input';
  input.maxLength = 100;
  // The full name as typed ("mleko 2 l"), not the button's text, which is split into parts.
  input.value = nameButton.dataset.fullName;
  input.setAttribute('aria-label', 'Nazwa produktu');

  // Removing a focused field can fire "blur" in some browsers, which would
  // finish the edit a second time. This flag makes finishing happen only once.
  let finished = false;

  function finish({ save, keepFocus }) {
    if (finished) return;
    finished = true;

    input.replaceWith(nameButton);
    if (save) {
      onRename(itemId, input.value);
    }
    if (keepFocus) {
      findItemElement(itemId)?.querySelector('.item-name').focus();
    }
  }

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;

    // finish() moves focus to the name button. Without preventDefault the same
    // Enter key press would then "click" that button and reopen the editor.
    event.preventDefault();
    finish({ save: event.key === 'Enter', keepFocus: true });
  });
  // Tapping elsewhere: save, but don't pull focus back from where the user went.
  input.addEventListener('blur', () => finish({ save: true, keepFocus: false }));

  nameButton.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length); // cursor at the end
}

function render(elements, state) {
  const list = getActiveList(state);
  const { groups, bought } = getSections(list, state.categories);
  const { checked, total } = getProgress(list);

  elements.emptyState.hidden = total > 0;
  elements.progress.hidden = total === 0;
  elements.progress.textContent = `${checked} z ${total} kupione`;

  elements.toBuySection.hidden = groups.length === 0;
  elements.toBuyGroups.replaceChildren(...createGroupElements(groups));

  // "Wyczyść kupione" is inside this section, so it is visible only when there are bought items.
  elements.boughtSection.hidden = bought.length === 0;
  elements.boughtList.replaceChildren(...bought.map(createItemElement));
}

// Builds a heading and a list for every group:
//   <h3>Nabiał</h3> <ul> items… </ul>
// When everything is in "Bez kategorii", the heading is left out and the list
// looks like before categories existed (spec 10.3).
function createGroupElements(groups) {
  const onlyUncategorized = groups.length === 1 && groups[0].category === null;

  return groups.flatMap((group) => {
    const list = document.createElement('ul');
    list.append(...group.items.map(createItemElement));
    if (onlyUncategorized) return [list];

    const heading = document.createElement('h3');
    heading.className = 'group-title';
    // A category name is typed by the user (spec 10.5), so textContent too.
    heading.textContent = group.category?.name ?? 'Bez kategorii';
    return [heading, list];
  });
}

// Builds: <li data-id> [handle] [checkbox] [name button: name + quantity label] [remove button] </li>
// The reorder handle is only on "to buy" items (spec 9.2).
// All text goes through textContent or setAttribute, never innerHTML: the name is user input.
function createItemElement(item) {
  const li = document.createElement('li');
  li.dataset.id = item.id;
  li.classList.toggle('checked', item.checked);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'item-checkbox';
  checkbox.checked = item.checked;
  // Not wrapped in a <label>: tapping the name starts editing, so it must not
  // toggle the checkbox. aria-label gives screen readers the name instead.
  checkbox.setAttribute('aria-label', item.name);

  // A real <button>, so the name can be reached with Tab and edited with Enter.
  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'item-name';
  name.dataset.fullName = item.name;
  name.append(...createNameParts(item.name));
  name.setAttribute('aria-label', `Edytuj: ${item.name}`);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'item-remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Usuń: ${item.name}`);

  if (!item.checked) {
    li.append(createHandle(item));
  }
  li.append(checkbox, name, remove);
  return li;
}

function createHandle(item) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'item-handle';
  handle.textContent = '≡';
  handle.setAttribute('aria-label', `Zmień kolejność: ${item.name}`);
  handle.setAttribute('aria-describedby', 'move-hint');
  return handle;
}

// "mleko 2 l" → <span>mleko</span> <span class="item-quantity">2 l</span>
function createNameParts(fullName) {
  const { name, quantity } = parseQuantity(fullName);
  const text = document.createElement('span');
  text.textContent = name;
  if (quantity === null) return [text];

  const label = document.createElement('span');
  label.className = 'item-quantity';
  label.textContent = quantity;
  // The space keeps the parts apart for screen readers and when copying text.
  return [text, ' ', label];
}

function findItemElement(itemId) {
  // CSS.escape: the id goes into a selector, so special characters must be escaped.
  return document.querySelector(`li[data-id="${CSS.escape(itemId)}"]`);
}
