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
  setTimeout(() => {
    const mc = modal.querySelector('.modal-content');
    if (mc) mc.classList.add('show');
  }, 10);
  okBtn.focus();

  document.addEventListener('keydown', handleKeyDown);

  return new Promise(resolve => {
    resolveCallback = resolve;
  });
}

function closeModal(result) {
  const mc = modal.querySelector('.modal-content');
  if (mc) mc.classList.remove('show');

  setTimeout(() => {
    modal.classList.add('hidden');
    document.removeEventListener('keydown', handleKeyDown);
    if (resolveCallback) resolveCallback(result);
  }, 200);
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
