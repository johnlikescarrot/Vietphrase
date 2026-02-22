import { showModalWithAnimation, hideModalWithAnimation } from './m_utils.js';

const modal = document.getElementById('custom-dialog-modal');
const messageEl = document.getElementById('custom-dialog-message');
const okBtn = document.getElementById('custom-dialog-ok-btn');
const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

let resolveCallback = null;
let isClosing = false;

function handleKeyDown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    okBtn.click();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    cancelBtn.click();
  }
}

function showModal(message, showCancelButton = false) {
  isClosing = false;
  messageEl.textContent = message;

  if (showCancelButton) {
    cancelBtn.classList.remove('hidden');
  } else {
    cancelBtn.classList.add('hidden');
  }

  showModalWithAnimation(modal);
  okBtn.focus();

  document.addEventListener('keydown', handleKeyDown);

  return new Promise(resolve => {
    resolveCallback = resolve;
  });
}

function closeModal(result) {
  if (isClosing) return;
  isClosing = true;

  document.removeEventListener('keydown', handleKeyDown);

  const callback = resolveCallback;
  resolveCallback = null;

  hideModalWithAnimation(modal, () => {
    if (callback) callback(result);
  });
}

okBtn.addEventListener('click', () => {
  closeModal(true);
});

cancelBtn.addEventListener('click', () => {
  closeModal(false);
});

export function customAlert(message) {
  return showModal(message, false);
}

export function customConfirm(message) {
  return showModal(message, true);
}
