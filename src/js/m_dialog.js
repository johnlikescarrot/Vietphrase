const modal = document.getElementById('custom-dialog-modal');
const messageEl = document.getElementById('custom-dialog-message');
const okBtn = document.getElementById('custom-dialog-ok-btn');
const cancelBtn = document.getElementById('custom-dialog-cancel-btn');

let resolveCallback;

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
  messageEl.textContent = message;

  if (showCancelButton) {
    cancelBtn.classList.remove('hidden');
  } else {
    cancelBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  okBtn.focus();

  document.addEventListener('keydown', handleKeyDown);

  return new Promise(resolve => {
    resolveCallback = resolve;
  });
}

okBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
  document.removeEventListener('keydown', handleKeyDown);
  if (resolveCallback) resolveCallback(true);
});

cancelBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
  document.removeEventListener('keydown', handleKeyDown);
  if (resolveCallback) resolveCallback(false);
});

export function customAlert(message) {
  return showModal(message, false);
}

export function customConfirm(message) {
  return showModal(message, true);
}