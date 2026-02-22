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

  // Clear any pending animation (show or hide)
  if (animationTimeouts.has(element)) {
    clearTimeout(animationTimeouts.get(element));
    animationTimeouts.delete(element);
  }

  element.classList.remove('hidden');
  // Trigger reflow/delay to ensure transition plays
  const timeoutId = setTimeout(() => {
    const content = element.classList.contains('modal-content') ? element : element.querySelector('.modal-content');
    if (content) {
      content.classList.add('show');
    } else {
      element.classList.add('show');
    }
    animationTimeouts.delete(element);
  }, 10);

  animationTimeouts.set(element, timeoutId);
}

/**
 * Hides a modal or panel with a CSS animation.
 */
export function hideModalWithAnimation(element, onComplete = null) {
  if (!element) return;

  // Clear any pending show animation
  if (animationTimeouts.has(element)) {
    clearTimeout(animationTimeouts.get(element));
    animationTimeouts.delete(element);
  }

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

/**
 * Toggles a loading state on a specific element.
 */
export function setLoading(element, isLoading) {
  if (!element) return;
  if (isLoading) {
    element.classList.add('is-loading');
  } else {
    element.classList.remove('is-loading');
  }
} else {
    element.classList.remove('is-loading');
    element.style.opacity = '1';
    element.style.pointerEvents = 'auto';
  }
}
