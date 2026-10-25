// The "Kategorie" dialog (spec 10.5): add, rename, remove and reorder categories.
// Like ui.js it only draws what it is given and reports user actions through
// handlers; main.js decides what they do.
//
// It is a native <dialog> opened with showModal(): the browser keeps keyboard
// focus inside it, dims the page behind it and closes it on Escape.

import { MAX_CATEGORY_NAME_LENGTH } from './store.js';
import { enableDragging } from './drag.js';
import { startEditing, createHandle, moveWithArrowKeys } from './list-controls.js';

const MESSAGE_DURATION_MS = 5000;

// handlers: { onAddCategory(name), onRenameCategory(categoryId, name),
//             onRemoveCategory(categoryId), onMoveCategory(categoryId, toIndex) }
export function createCategoriesDialog(handlers) {
  const dialog = document.getElementById('categories-dialog');
  const list = document.getElementById('category-list');
  const form = document.getElementById('add-category-form');
  const nameInput = document.getElementById('new-category-name');
  const message = document.getElementById('categories-message');

  document.getElementById('open-categories').addEventListener('click', () => dialog.showModal());
  document.getElementById('close-categories').addEventListener('click', () => dialog.close());
  // Also runs after Escape: an old message must not greet the next opening.
  dialog.addEventListener('close', () => {
    message.textContent = '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handlers.onAddCategory(nameInput.value);
    nameInput.value = '';
    nameInput.focus(); // ready for the next category, as with products
    // A new category goes to the end of the list, which may be out of view
    // above the field: show it. (After a rejected name this just shows the end.)
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });

  list.addEventListener('click', (event) => {
    const categoryId = event.target.closest('li')?.dataset.id;
    const nameButton = event.target.closest('.item-name');

    if (nameButton) {
      startEditing(nameButton, {
        maxLength: MAX_CATEGORY_NAME_LENGTH,
        label: 'Nazwa kategorii',
        onSave: (name) => handlers.onRenameCategory(categoryId, name),
      });
    } else if (event.target.matches('.item-remove')) {
      handlers.onRemoveCategory(categoryId);
    }
  });

  list.addEventListener('keydown', (event) => moveWithArrowKeys(event, handlers.onMoveCategory));
  enableDragging(list, handlers.onMoveCategory);

  let messageTimer = null;

  return {
    render(categories) {
      list.replaceChildren(...categories.map(createCategoryElement));
    },

    showMessage(text) {
      clearTimeout(messageTimer);
      message.textContent = text;
      messageTimer = setTimeout(() => {
        message.textContent = '';
      }, MESSAGE_DURATION_MS);
    },
  };
}

// Builds: <li data-id> [handle] [name button] [remove button] </li>
// The same classes as product rows, so they look and behave the same.
// Category names are typed by the user: textContent and setAttribute only.
function createCategoryElement(category) {
  const li = document.createElement('li');
  li.dataset.id = category.id;

  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'item-name';
  name.dataset.fullName = category.name;
  name.textContent = category.name;
  name.setAttribute('aria-label', `Zmień nazwę: ${category.name}`);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'item-remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `Usuń kategorię: ${category.name}`);

  li.append(createHandle(`Zmień kolejność: ${category.name}`), name, remove);
  return li;
}
