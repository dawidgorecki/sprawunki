// Switching lists (spec 11.2): the button with the active list's name in the
// header and the "Wybierz listę" dialog it opens. Like ui.js it only draws
// what it is given and reports the choice through a handler.
//
// A custom <dialog> instead of a native <select>: a <select> can't show the
// counters, and on Android it adds the form navigation arrows (spec 10.2).

import { getActiveList, getProgress } from './store.js';

// onSelect(listId) runs when the user taps a list, the active one included.
export function createListPicker(onSelect) {
  const button = document.getElementById('open-list-picker');
  const buttonName = button.querySelector('.list-picker-name');
  const dialog = document.getElementById('list-picker');
  const options = document.getElementById('list-picker-options');

  button.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());

  options.addEventListener('click', (event) => {
    const option = event.target.closest('button');
    if (!option) return;
    // Closed first: closing gives focus back to the header button, which
    // stays in place while the screen is drawn again for the new list.
    dialog.close();
    onSelect(option.dataset.id);
  });

  return {
    render(state) {
      const activeList = getActiveList(state);
      // With one list there is nothing to choose: the header looks like in 2.0.
      button.hidden = state.lists.length === 1;
      buttonName.textContent = activeList.name;
      button.setAttribute('aria-label', `Lista: ${activeList.name}`);

      options.replaceChildren(
        ...state.lists.map((list) => createOption(list, list.id === state.activeListId)),
      );
    },
  };
}

// Builds: <li> <button data-id> [✓] [name] [3/7] </button> </li>
// List names are typed by the user: textContent only.
function createOption(list, isActive) {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'list-option';
  option.dataset.id = list.id;
  if (isActive) {
    // Read by screen readers instead of the ✓, which is only for the eyes.
    option.setAttribute('aria-current', 'true');
  }

  const check = document.createElement('span');
  check.className = 'list-option-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = isActive ? '✓' : '';

  const name = document.createElement('span');
  name.className = 'list-option-name';
  name.textContent = list.name;

  option.append(check, name);

  // No counter for an empty list (spec 11.2).
  const { checked, total } = getProgress(list);
  if (total > 0) {
    const counter = document.createElement('span');
    counter.className = 'list-option-counter';
    counter.textContent = `${checked}/${total}`;
    option.append(counter);
  }

  const li = document.createElement('li');
  li.append(option);
  return li;
}
