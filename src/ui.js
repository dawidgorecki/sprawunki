// Rendering and DOM event handling. This module knows nothing about storage
// or how the state changes: it draws the state it is given and reports user
// actions to the handlers passed in from main.js.

import { getActiveList, getSections, getProgress } from './store.js';

const MESSAGE_DURATION_MS = 5000;

// handlers: { onAdd(name), onToggle(itemId) }
// Returns functions main.js uses to update the screen.
export function createUI(handlers) {
  const elements = {
    progress: document.getElementById('progress'),
    messageText: document.getElementById('message-text'),
    messageClose: document.getElementById('message-close'),
    emptyState: document.getElementById('empty-state'),
    toBuySection: document.getElementById('to-buy-section'),
    toBuyList: document.getElementById('to-buy-list'),
    boughtSection: document.getElementById('bought-section'),
    boughtList: document.getElementById('bought-list'),
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

  // One listener on <main> instead of one per checkbox. The list is rebuilt on
  // every render, so listeners attached to items would be thrown away anyway.
  document.querySelector('main').addEventListener('change', (event) => {
    if (!event.target.matches('input[type="checkbox"]')) return;

    const itemId = event.target.closest('li').dataset.id;
    handlers.onToggle(itemId);
    // Render replaced the checkbox with a new element; keep keyboard focus on it.
    findItemElement(itemId)?.querySelector('input[type="checkbox"]').focus();
  });

  let messageTimer = null;

  function hideMessage() {
    clearTimeout(messageTimer);
    elements.messageText.textContent = '';
    elements.messageClose.hidden = true;
  }

  elements.messageClose.addEventListener('click', () => {
    hideMessage();
    // The focused button just disappeared; move focus somewhere useful.
    elements.nameInput.focus();
  });

  return {
    render(state) {
      render(elements, state);
    },

    // A persistent message stays until the user closes it with "OK"; use it for
    // problems the user must not miss. Others disappear on their own.
    showMessage(text, { persistent = false } = {}) {
      clearTimeout(messageTimer);
      elements.messageText.textContent = text;
      elements.messageClose.hidden = !persistent;
      if (!persistent) {
        messageTimer = setTimeout(hideMessage, MESSAGE_DURATION_MS);
      }
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

function render(elements, state) {
  const list = getActiveList(state);
  const { toBuy, bought } = getSections(list);
  const { checked, total } = getProgress(list);

  elements.emptyState.hidden = total > 0;
  elements.progress.hidden = total === 0;
  elements.progress.textContent = `${checked} z ${total} kupione`;

  elements.toBuySection.hidden = toBuy.length === 0;
  elements.toBuyList.replaceChildren(...toBuy.map(createItemElement));

  elements.boughtSection.hidden = bought.length === 0;
  elements.boughtList.replaceChildren(...bought.map(createItemElement));
}

function createItemElement(item) {
  const li = document.createElement('li');
  li.dataset.id = item.id;
  li.classList.toggle('checked', item.checked);

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.checked;
  // Not wrapped in a <label>: in step 5 tapping the name will start editing,
  // so it must not toggle the checkbox. aria-label gives screen readers the name.
  checkbox.setAttribute('aria-label', item.name);

  const name = document.createElement('span');
  name.className = 'item-name';
  name.textContent = item.name; // never innerHTML: the name is user input

  li.append(checkbox, name);
  return li;
}

function findItemElement(itemId) {
  // CSS.escape: the id goes into a selector, so special characters must be escaped.
  return document.querySelector(`li[data-id="${CSS.escape(itemId)}"]`);
}
