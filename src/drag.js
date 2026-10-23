// Reordering "to buy" items by dragging their handle (spec 9.2), with a finger
// or a mouse. Built on Pointer Events, which deliver touch, mouse and pen input
// as one set of events.
//
// While dragging, nothing changes in the state: the dragged item and the items
// it passes are only shifted on screen with CSS transforms. On release the final
// position goes to onMove(itemId, toIndex), and the following render draws the
// list from the new state, which also removes all the temporary transforms.

const EDGE_SIZE = 64; // px from the top of the screen or the bottom bar where auto-scroll starts
const MAX_SCROLL_SPEED = 12; // px per animation frame, reached right at the edge

export function enableDragging(list, onMove) {
  list.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.item-handle');
    // Only the main button (left click, finger, pen): a right click must not start a drag.
    if (!handle || event.button !== 0) return;
    startDrag(list, handle, event, onMove);
  });

  // A long press could open the browser's context menu in the middle of a drag.
  list.addEventListener('contextmenu', (event) => {
    if (event.target.closest('.item-handle')) event.preventDefault();
  });
}

function startDrag(list, handle, startEvent, onMove) {
  const draggedItem = handle.closest('li');
  const items = [...list.children];
  const fromIndex = items.indexOf(draggedItem);

  // Measured once, in page coordinates (screen position + scroll), so the values
  // stay right while the page scrolls under the finger.
  const boxes = items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { top: rect.top + window.scrollY, height: rect.height };
  });
  const dragged = boxes[fromIndex];
  const lastBox = boxes[boxes.length - 1];
  // Limits that keep the dragged item inside the list.
  const minShift = boxes[0].top - dragged.top;
  const maxShift = lastBox.top + lastBox.height - (dragged.top + dragged.height);

  const startY = startEvent.clientY + window.scrollY;
  let pointerY = startEvent.clientY; // on screen; updated on every move
  let toIndex = fromIndex;
  let finished = false;

  // Pointer capture sends all further events of this pointer to the handle,
  // even when the finger moves off it. AbortController removes all listeners at once.
  handle.setPointerCapture(startEvent.pointerId);
  const listeners = new AbortController();
  const options = { signal: listeners.signal };

  handle.addEventListener('pointermove', (event) => {
    pointerY = event.clientY;
    updatePositions();
  }, options);
  handle.addEventListener('pointerup', () => finish(true), options);
  // The browser took the gesture over (e.g. an incoming call): put everything back.
  handle.addEventListener('pointercancel', () => finish(false), options);
  // Also fires right after pointerup; then finish() has already run and does nothing.
  handle.addEventListener('lostpointercapture', () => finish(false), options);

  draggedItem.classList.add('dragging');
  document.body.classList.add('is-dragging');
  let frame = requestAnimationFrame(autoScroll);

  function updatePositions() {
    const shift = clamp(pointerY + window.scrollY - startY, minShift, maxShift);
    draggedItem.style.transform = `translateY(${shift}px)`;

    toIndex = findTargetIndex(boxes, fromIndex, dragged.top + dragged.height / 2 + shift);

    // Items between the old and the new position step aside by one item's height.
    items.forEach((item, index) => {
      if (index === fromIndex) return;
      let offset = 0;
      if (fromIndex < index && index <= toIndex) offset = -dragged.height;
      if (toIndex <= index && index < fromIndex) offset = dragged.height;
      item.style.transform = offset ? `translateY(${offset}px)` : '';
    });
  }

  // Runs on every animation frame while dragging. Near an edge it scrolls the
  // page, faster the closer the finger is to the edge.
  function autoScroll() {
    const bottomEdge = document.querySelector('.bottom-bar').getBoundingClientRect().top;
    let speed = 0;
    if (pointerY < EDGE_SIZE) {
      speed = -MAX_SCROLL_SPEED * Math.min(1, (EDGE_SIZE - pointerY) / EDGE_SIZE);
    } else if (pointerY > bottomEdge - EDGE_SIZE) {
      speed = MAX_SCROLL_SPEED * Math.min(1, (pointerY - (bottomEdge - EDGE_SIZE)) / EDGE_SIZE);
    }

    if (speed !== 0) {
      window.scrollBy(0, speed);
      // The page moved under a finger that stood still, so the item has to follow.
      updatePositions();
    }
    frame = requestAnimationFrame(autoScroll);
  }

  function finish(save) {
    if (finished) return;
    finished = true;

    cancelAnimationFrame(frame);
    listeners.abort();
    items.forEach((item) => (item.style.transform = ''));
    draggedItem.classList.remove('dragging');
    document.body.classList.remove('is-dragging');

    if (save && toIndex !== fromIndex) {
      onMove(draggedItem.dataset.id, toIndex);
    }
  }
}

// The dragged item takes the place of the farthest item whose middle it has passed.
function findTargetIndex(boxes, fromIndex, draggedCenter) {
  let target = fromIndex;
  boxes.forEach((box, index) => {
    const center = box.top + box.height / 2;
    if (index < fromIndex && draggedCenter < center) target = Math.min(target, index);
    if (index > fromIndex && draggedCenter > center) target = Math.max(target, index);
  });
  return target;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
