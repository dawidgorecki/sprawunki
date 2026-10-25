// A dialog for managing a list of named entries: the "Kategorie" dialog
// (spec 10.5) and the "Listy" dialog (spec 11.3) work the same way, so they
// share this code. Each row can be renamed in place, removed and reordered;
// a field at the bottom adds new entries.
// Like ui.js it only draws what it is given and reports user actions through
// handlers; main.js decides what they do.
//
// It is a native <dialog> opened with showModal(): the browser keeps keyboard
// focus inside it, dims the page behind it and closes it on Escape.

import { enableDragging } from './drag.js';
import { startEditing, createHandle, moveWithArrowKeys } from './list-controls.js';

const MESSAGE_DURATION_MS = 5000;

// dialog: the <dialog> element, built like #categories-dialog in index.html.
// options: {
//   openButton  – the button that opens the dialog,
//   maxLength   – of a name,
//   editLabel   – label of the rename field, e.g. "Nazwa kategorii",
//   removeLabel – (name) => label of the × button, e.g. "Usuń kategorię: Napoje",
//   onAdd(name), onRename(id, name), onRemove(id), onMove(id, toIndex)
// }
export function createManageDialog(dialog, options) {
  const list = dialog.querySelector('.manage-list');
  const form = dialog.querySelector('.manage-form');
  const nameInput = form.querySelector('input');
  const message = dialog.querySelector('.dialog-message');

  options.openButton.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  // Also runs after Escape: an old message must not greet the next opening.
  dialog.addEventListener('close', () => {
    message.textContent = '';
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    options.onAdd(nameInput.value);
    nameInput.value = '';
    nameInput.focus(); // ready for the next entry, as with products
    // A new entry goes to the end of the list, which may be out of view
    // above the field: show it. (After a rejected name this just shows the end.)
    list.lastElementChild?.scrollIntoView({ block: 'nearest' });
  });

  list.addEventListener('click', (event) => {
    const id = event.target.closest('li')?.dataset.id;
    const nameButton = event.target.closest('.item-name');

    if (nameButton) {
      startEditing(nameButton, {
        maxLength: options.maxLength,
        label: options.editLabel,
        onSave: (name) => options.onRename(id, name),
      });
    } else if (event.target.matches('.item-remove')) {
      options.onRemove(id);
    }
  });

  list.addEventListener('keydown', (event) => moveWithArrowKeys(event, options.onMove));
  enableDragging(list, options.onMove);

  let messageTimer = null;

  return {
    // entries: [{ id, name }] in their order.
    // canRemove: false disables every × button (the last list, spec 11.3).
    render(entries, { canRemove = true } = {}) {
      list.replaceChildren(
        ...entries.map((entry) => createRow(entry, options.removeLabel(entry.name), canRemove)),
      );
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
// Names are typed by the user: textContent and setAttribute only.
function createRow(entry, removeLabel, canRemove) {
  const li = document.createElement('li');
  li.dataset.id = entry.id;

  const name = document.createElement('button');
  name.type = 'button';
  name.className = 'item-name';
  name.dataset.fullName = entry.name;
  name.textContent = entry.name;
  name.setAttribute('aria-label', `Zmień nazwę: ${entry.name}`);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'item-remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', removeLabel);
  remove.disabled = !canRemove;

  li.append(createHandle(`Zmień kolejność: ${entry.name}`), name, remove);
  return li;
}
