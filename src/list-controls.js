// Row behaviour shared by the shopping list (ui.js) and the categories and
// lists dialogs (manage-dialog.js): editing a name in place, the reorder handle and
// moving a row with the arrow keys. Every row is an <li data-id="…">.

// Swaps the name button for a text field. Enter or leaving the field saves,
// Escape cancels. The button is always put back first; if the rename succeeds,
// the following render replaces it with the new name anyway. This way a
// rejected name (empty, duplicate) needs no extra code to restore.
//
// nameButton.dataset.fullName holds the text to edit: for products the full
// name as typed ("mleko 2 l"), not the button's text, which is split into parts.
// options: { maxLength, label (for screen readers), onSave(newName) }
export function startEditing(nameButton, { maxLength, label, onSave }) {
  const rowId = nameButton.closest('li').dataset.id;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'item-name-input';
  input.maxLength = maxLength;
  input.value = nameButton.dataset.fullName;
  input.setAttribute('aria-label', label);

  // Removing a focused field can fire "blur" in some browsers, which would
  // finish the edit a second time. This flag makes finishing happen only once.
  let finished = false;

  function finish({ save, keepFocus }) {
    if (finished) return;
    finished = true;

    input.replaceWith(nameButton);
    if (save) {
      onSave(input.value);
    }
    if (keepFocus) {
      findRow(rowId)?.querySelector('.item-name').focus();
    }
  }

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;

    // finish() moves focus to the name button. Without preventDefault the same
    // Enter key press would then "click" that button and reopen the editor.
    // For Escape it also stops an open <dialog> from closing.
    event.preventDefault();
    finish({ save: event.key === 'Enter', keepFocus: true });
  });
  // Tapping elsewhere: save, but don't pull focus back from where the user went.
  input.addEventListener('blur', () => finish({ save: true, keepFocus: false }));

  nameButton.replaceWith(input);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length); // cursor at the end
}

// The ≡ handle used for dragging (drag.js) and for the arrow keys (below).
export function createHandle(label) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'item-handle';
  handle.textContent = '≡';
  handle.setAttribute('aria-label', label);
  // A hidden hint in index.html: "Strzałki w górę i w dół przesuwają…".
  handle.setAttribute('aria-describedby', 'move-hint');
  return handle;
}

// For a "keydown" listener: arrow keys on a handle move its row one place up or
// down (spec 9.2). onMove(rowId, toIndex) gets the position among the row's
// siblings, i.e. within its own <ul>.
export function moveWithArrowKeys(event, onMove) {
  if (!event.target.matches('.item-handle')) return;
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

  event.preventDefault(); // otherwise the arrow keys also scroll the page
  const row = event.target.closest('li');
  const index = [...row.parentElement.children].indexOf(row);
  const toIndex = event.key === 'ArrowUp' ? index - 1 : index + 1;

  onMove(row.dataset.id, toIndex);
  // Render replaced the handle with a new element; keep keyboard focus on it.
  findRow(row.dataset.id)?.querySelector('.item-handle').focus();
}

// Product ids start with "i_", category ids with "c_" and list ids with "l_",
// so one search over the whole page always finds the right row.
export function findRow(id) {
  // CSS.escape: the id goes into a selector, so special characters must be escaped.
  return document.querySelector(`li[data-id="${CSS.escape(id)}"]`);
}
