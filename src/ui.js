// Rendering and DOM event handling. This module knows nothing about storage
// or how the state changes: it draws the state it is given and reports user
// actions to the handlers passed in from main.js.

import {
  getActiveList,
  getSections,
  getProgress,
  parseQuantity,
  MAX_NAME_LENGTH,
  MAX_CATEGORY_NAME_LENGTH,
  MAX_LIST_NAME_LENGTH,
} from './store.js';
import { enableDragging } from './drag.js';
import { startEditing, createHandle, moveWithArrowKeys, findRow } from './list-controls.js';
import { createManageDialog } from './manage-dialog.js';

const MESSAGE_DURATION_MS = 5000;

// handlers: { onAdd(name), onToggle(itemId), onRename(itemId, name),
//             onRemove(itemId), onMove(itemId, toIndex),
//             onSetCategory(itemId, categoryId), onClearChecked(), onToggleWakeLock(),
//             onAddCategory(name), onRenameCategory(categoryId, name),
//             onRemoveCategory(categoryId), onMoveCategory(categoryId, toIndex),
//             onAddList(name), onRenameList(listId, name),
//             onRemoveList(listId), onMoveList(listId, toIndex) }
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
    const itemId = event.target.closest('li')?.dataset.id;

    if (event.target.matches('.item-checkbox')) {
      handlers.onToggle(itemId);
      // Render replaced the checkbox with a new element; keep keyboard focus on it.
      findRow(itemId)?.querySelector('.item-checkbox').focus();
    } else if (event.target.matches('.item-category select')) {
      // An <option> value is always a string, so "Bez kategorii" uses '' for null.
      handlers.onSetCategory(itemId, event.target.value || null);
      findRow(itemId)?.querySelector('.item-category select').focus();
    }
  });

  main.addEventListener('click', (event) => {
    const itemId = event.target.closest('li')?.dataset.id;
    // closest(), not matches(): the tap may land on the quantity label inside the name button.
    const nameButton = event.target.closest('.item-name');

    if (nameButton) {
      startEditing(nameButton, {
        maxLength: MAX_NAME_LENGTH,
        label: 'Nazwa produktu',
        onSave: (name) => handlers.onRename(itemId, name),
      });
    } else if (event.target.matches('.item-remove')) {
      handlers.onRemove(itemId);
    }
  });

  // Each group is its own <ul>, so the position within the <ul> is the
  // position within the group, which moveItem expects.
  main.addEventListener('keydown', (event) => moveWithArrowKeys(event, handlers.onMove));
  enableDragging(elements.toBuyGroups, handlers.onMove);

  // Two dialogs built from the same code (manage-dialog.js), spec 10.5 and 11.3.
  const categoriesDialog = createManageDialog(document.getElementById('categories-dialog'), {
    openButton: document.getElementById('open-categories'),
    maxLength: MAX_CATEGORY_NAME_LENGTH,
    editLabel: 'Nazwa kategorii',
    removeLabel: (name) => `Usuń kategorię: ${name}`,
    onAdd: handlers.onAddCategory,
    onRename: handlers.onRenameCategory,
    onRemove: handlers.onRemoveCategory,
    onMove: handlers.onMoveCategory,
  });
  const listsDialog = createManageDialog(document.getElementById('lists-dialog'), {
    openButton: document.getElementById('open-lists'),
    maxLength: MAX_LIST_NAME_LENGTH,
    editLabel: 'Nazwa listy',
    removeLabel: (name) => `Usuń listę: ${name}`,
    onAdd: handlers.onAddList,
    onRename: handlers.onRenameList,
    onRemove: handlers.onRemoveList,
    onMove: handlers.onMoveList,
  });

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
      categoriesDialog.render(state.categories);
      // There is always at least one list, so the last one can't be removed.
      listsDialog.render(state.lists, { canRemove: state.lists.length > 1 });
    },

    // For messages about categories or lists while their dialog is open: the
    // dialog covers the message bar at the bottom of the screen.
    showCategoryMessage(text) {
      categoriesDialog.showMessage(text);
    },

    showListMessage(text) {
      listsDialog.showMessage(text);
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
      const element = findRow(itemId);
      if (!element) return;

      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      element.classList.add('highlight');
      element.addEventListener('animationend', () => element.classList.remove('highlight'), {
        once: true,
      });
    },
  };
}

function render(elements, state) {
  const list = getActiveList(state);
  const { groups, bought } = getSections(list, state.categories);
  const { checked, total } = getProgress(list);

  elements.emptyState.hidden = total > 0;
  elements.progress.hidden = total === 0;
  elements.progress.textContent = `${checked} z ${total} kupione`;

  elements.toBuySection.hidden = groups.length === 0;
  elements.toBuyGroups.replaceChildren(...createGroupElements(groups, state.categories));

  // "Wyczyść kupione" is inside this section, so it is visible only when there are bought items.
  elements.boughtSection.hidden = bought.length === 0;
  // Bought items get no category picker (spec 10.2).
  elements.boughtList.replaceChildren(...bought.map((item) => createItemElement(item)));
}

// Builds a heading and a list for every group:
//   <h3>Nabiał</h3> <ul> items… </ul>
// When everything is in "Bez kategorii", the heading is left out and the list
// looks like before categories existed (spec 10.3).
function createGroupElements(groups, categories) {
  const onlyUncategorized = groups.length === 1 && groups[0].category === null;

  return groups.flatMap((group) => {
    // The group's category, not item.categoryId: that may point to a deleted category.
    const selectedId = group.category?.id ?? null;
    const list = document.createElement('ul');
    list.append(
      ...group.items.map((item) =>
        createItemElement(item, createCategoryPicker(item, categories, selectedId)),
      ),
    );
    if (onlyUncategorized) return [list];

    const heading = document.createElement('h3');
    heading.className = 'group-title';
    // A category name is typed by the user (spec 10.5), so textContent too.
    heading.textContent = group.category?.name ?? 'Bez kategorii';
    return [heading, list];
  });
}

// Builds: <li data-id> [handle] [checkbox] [name button: name + quantity label]
//                       [category picker] [remove button] </li>
// The reorder handle is only on "to buy" items (spec 9.2); the category picker
// is passed in only for them too.
// All text goes through textContent or setAttribute, never innerHTML: the name is user input.
function createItemElement(item, categoryPicker = null) {
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
    li.append(createHandle(`Zmień kolejność: ${item.name}`));
  }
  li.append(checkbox, name);
  if (categoryPicker) {
    li.append(categoryPicker);
  }
  li.append(remove);
  return li;
}

// A native <select> made invisible and laid over a tag icon (spec 10.2). The
// phone opens its own list to pick from, keyboard and screen readers work out
// of the box, and the row only needs room for the icon, not for the name.
function createCategoryPicker(item, categories, selectedId) {
  const wrapper = document.createElement('span');
  wrapper.className = 'item-category';
  // The icon lives in a <template> in index.html, so the SVG is not built in JS.
  wrapper.append(document.getElementById('category-icon').content.cloneNode(true));

  const select = document.createElement('select');
  select.setAttribute('aria-label', `Kategoria: ${item.name}`);
  const choices = [
    ...categories.map((category) => ({ value: category.id, label: category.name })),
    { value: '', label: 'Bez kategorii' },
  ];
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.value;
    option.textContent = choice.label; // category names are typed by the user
    option.selected = choice.value === (selectedId ?? '');
    select.append(option);
  }

  wrapper.append(select);
  return wrapper;
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
