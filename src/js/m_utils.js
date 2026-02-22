/**
 * Debounces a function call.
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

const animationTimeouts = new WeakMap();

/**
 * Shows a modal or panel with a CSS animation.
 */
export function showModalWithAnimation(element) {
  if (!element) return;

  // Clear any pending hide animation
  if (animationTimeouts.has(element)) {
    clearTimeout(animationTimeouts.get(element));
    animationTimeouts.delete(element);
  }

  element.classList.remove('hidden');
  // Trigger reflow/delay to ensure transition plays
  setTimeout(() => {
    const content = element.classList.contains('modal-content') ? element : element.querySelector('.modal-content');
    if (content) {
      content.classList.add('show');
    } else {
      element.classList.add('show');
    }
  }, 10);
}

/**
 * Hides a modal or panel with a CSS animation.
 */
export function hideModalWithAnimation(element, onComplete = null) {
  if (!element) return;

  const content = element.classList.contains('modal-content') ? element : element.querySelector('.modal-content');
  if (content) {
    content.classList.remove('show');
  } else {
    element.classList.remove('show');
  }

  const timeoutId = setTimeout(() => {
    element.classList.add('hidden');
    if (onComplete) onComplete();
    animationTimeouts.delete(element);
  }, 200);

  animationTimeouts.set(element, timeoutId);
}
