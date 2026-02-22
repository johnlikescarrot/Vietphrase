import DOMElements from './m_dom.js';
import { getHanViet, getAllMeanings } from './m_dictionary.js';
import { debounce } from './m_utils.js';
import { nameDictionary, temporaryNameDictionary, saveNameDictionaryToStorage, renderNameList, rebuildMasterData, updateMasterDataForDeletion } from './m_nameList.js';
import { performTranslation } from './m_translation.js';
import { customConfirm } from './m_dialog.js';

let isEditModalLocked = localStorage.getItem('isEditModalLocked') === 'true';
let isPanelLocked = localStorage.getItem('isQuickEditLocked') === 'true';
let isPanelVisible = false;

const selectionState = {
  text: '',
  originalText: '',
  spans: null,
  startIndex: -1,
  endIndex: -1
};

export function updateLockIcon(button, isLocked, tooltips) {
  if (!button) return;
  const svgLocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
  const svgUnlocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

  button.innerHTML = isLocked ? svgLocked : svgUnlocked;
  button.title = isLocked ? (tooltips.unlock || "Bỏ ghim bảng") : (tooltips.lock || "Ghim bảng này");
}

export function initializeModal(state) {
  const debouncedPopulateQuickEdit = debounce((selection, state) => {
    // Regression fix: use selection.originalText (Chinese) instead of selection.text (Vietnamese)
    populateQuickEditPanel(selection.originalText, state);
  }, 100);

  const debouncedUpdateOldModal = debounce((text, state) => {
    updateOldModalFields(text, state);
  }, 100);

  DOMElements.outputPanel.addEventListener('pointerup', (e) => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (selectedText) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === 3 ? container.parentElement : container;

      if (DOMElements.outputPanel.contains(parentElement)) {
        selectionState.text = selectedText;
        selectionState.spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));

        const selectedNodes = [];
        let curr = range.startContainer.nodeType === 3 ? range.startContainer.parentNode : range.startContainer;
        while (curr) {
          if (curr.nodeType === 1 && curr.classList.contains('word')) selectedNodes.push(curr);
          if (curr === range.endContainer || (curr.contains && curr.contains(range.endContainer))) break;

          if (curr.firstChild) {
              curr = curr.firstChild;
          } else if (curr.nextSibling) {
              curr = curr.nextSibling;
          } else {
              let p = curr.parentNode;
              while(p && !p.nextSibling) p = p.parentNode;
              curr = p ? p.nextSibling : null;
          }
        }

        const words = selectedNodes.filter(n => n.classList.contains('word'));
        if (words.length > 0) {
          selectionState.originalText = words.map(s => s.dataset.original || s.textContent).join('');
          selectionState.startIndex = selectionState.spans.indexOf(words[0]);
          selectionState.endIndex = selectionState.spans.indexOf(words[words.length - 1]);

          showQuickEditPanel(selection);
          debouncedPopulateQuickEdit(selectionState, state);
        }
      }
    } else {
      if (!isPanelLocked && !DOMElements.quickEditPanel.contains(e.target)) {
        hideQuickEditPanel();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (DOMElements.editModal.style.display !== 'none') closeOldModal();
      hideQuickEditPanel();
    }
  });

  DOMElements.qCloseBtn.addEventListener('click', () => {
    isPanelLocked = false;
    localStorage.setItem('isQuickEditLocked', 'false');
    hideQuickEditPanel();
  });

  DOMElements.qLockBtn.addEventListener('click', () => {
    isPanelLocked = !isPanelLocked;
    localStorage.setItem('isQuickEditLocked', isPanelLocked);
    updateLockIcon(DOMElements.qLockBtn, isPanelLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
  });

  DOMElements.qExpandLeftBtn.addEventListener('click', () => expandSelection('left', state));
  DOMElements.qExpandRightBtn.addEventListener('click', () => expandSelection('right', state));

  DOMElements.qAddNameBtn.addEventListener('click', async () => {
    const cn = DOMElements.qInputZw.value.trim();
    const vn = DOMElements.qInputTc.value.trim();
    if (cn && vn) {
      try {
        await addPermanentName(cn, vn, state);
        hideQuickEditPanel();
      } catch (e) {
        console.error("Lỗi khi lưu Name:", e);
      }
    }
  });

  DOMElements.qSearchBtn.addEventListener('click', () => {
    openOldModal(state);
  });

  DOMElements.qDeleteBtn.addEventListener('click', async () => {
    const text = DOMElements.qInputZw.value.trim();
    if (text && await customConfirm(`Xóa "${text}" khỏi Name List?`)) {
      try {
        await deletePermanentName(text, state);
        hideQuickEditPanel();
      } catch (e) {
        console.error("Lỗi khi xóa Name:", e);
      }
    }
  });

  DOMElements.editModalLockBtn.addEventListener('click', () => {
    isEditModalLocked = !isEditModalLocked;
    localStorage.setItem('isEditModalLocked', isEditModalLocked);
    updateLockIcon(DOMElements.editModalLockBtn, isEditModalLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
  });

  DOMElements.originalWordInput.addEventListener('input', (e) => {
    debouncedUpdateOldModal(e.target.value.trim(), state);
  });

  DOMElements.vietphraseToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const container = DOMElements.vietphraseOptionsContainer;
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      const inputRect = DOMElements.customMeaningInput.getBoundingClientRect();
      container.style.position = 'fixed';
      container.style.top = `${inputRect.bottom + 2}px`;
      container.style.left = `${inputRect.left}px`;
      container.style.width = `${inputRect.width}px`;
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  });

  document.querySelectorAll('.q-temp-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetInputId = btn.dataset.target;
      if (!targetInputId) return;
      const input = document.getElementById(targetInputId);
      if (!input) return;
      const vnText = input.value;
      const cnText = selectionState.originalText;

      if (vnText && cnText) {
        temporaryNameDictionary.set(cnText, vnText);
        updateTranslationInPlace(vnText);
        hideQuickEditPanel();
      }
    });
  });

  document.querySelectorAll('.q-perm-add-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const zwText = DOMElements.qInputZw.value.trim();
      const targetInputId = btn.dataset.target;
      if (!targetInputId) return;
      const input = document.getElementById(targetInputId);
      if (!input) return;
      const vnText = input.value.trim();
      if (zwText && vnText) {
        try {
          await addPermanentName(zwText, vnText, state);
          hideQuickEditPanel();
        } catch (err) {
          console.error("Lỗi khi lưu Name:", err);
        }
      }
    });
  });

  DOMElements.editModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.editModal && !isEditModalLocked) closeOldModal();
  });

  DOMElements.closeEditModalBtn.addEventListener('click', closeOldModal);

  DOMElements.expandLeftBtn.addEventListener('click', () => expandOldModalSelection('left', state));
  DOMElements.expandRightBtn.addEventListener('click', () => expandOldModalSelection('right', state));

  DOMElements.addToNameListBtn.addEventListener('click', async () => {
    const cn = DOMElements.originalWordInput.value.trim();
    const vn = DOMElements.customMeaningInput.value.trim();
    if (cn && vn) {
      try {
        await addPermanentName(cn, vn, state);
        closeOldModal();
      } catch (e) {
        console.error("Lỗi khi lưu Name:", e);
      }
    }
  });

  DOMElements.addTempBtn.addEventListener('click', () => {
    const cn = DOMElements.originalWordInput.value.trim();
    const vn = DOMElements.customMeaningInput.value.trim();
    if (cn && vn) {
      temporaryNameDictionary.set(cn, vn);
      performTranslation(state, { forceText: state.lastTranslatedText, preserveTempDict: true });
      closeOldModal();
    }
  });

  document.querySelectorAll('.case-btn').forEach(btn => {
    btn.addEventListener('click', (e) => applyCase(btn.dataset.case));
  });

  document.addEventListener('click', () => {
    const container = DOMElements.vietphraseOptionsContainer;
    if (!container.classList.contains('hidden')) {
      container.classList.add('hidden');
    }
  });

  updateLockIcon(DOMElements.qLockBtn, isPanelLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
  updateLockIcon(DOMElements.editModalLockBtn, isEditModalLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
}

function showQuickEditPanel(selection) {
  const panel = DOMElements.quickEditPanel;
  panel.style.visibility = 'hidden';
  panel.classList.remove('hidden');

  setTimeout(() => { panel.classList.add('show'); }, 10);

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  let top = rect.top + window.scrollY - panel.offsetHeight - 10;
  let left = rect.left + window.scrollX + (rect.width / 2) - (panel.offsetWidth / 2);

  if (top < 0) top = rect.bottom + window.scrollY + 10;
  if (left < 0) left = 10;
  if (left + panel.offsetWidth > window.innerWidth) left = window.innerWidth - panel.offsetWidth - 10;

  panel.style.top = `${top}px`;
  panel.style.left = `${left}px`;
  panel.style.visibility = 'visible';
  isPanelVisible = true;
}

function hideQuickEditPanel() {
  if (isPanelVisible) {
    if (isPanelLocked) return;
    const panel = DOMElements.quickEditPanel;
    panel.classList.remove('show');
    setTimeout(() => {
        panel.classList.add('hidden');
        panel.style.visibility = ''; // Clear stale inline style
        isPanelVisible = false;
        if (window.getSelection) window.getSelection().removeAllRanges();
    }, 200);
  }
}

function populateQuickEditPanel(text, state) {
  if (!text) return;
  DOMElements.qInputZw.value = text;
  DOMElements.qInputHv.value = getHanViet(text, state.dictionaries) || '';

  const allMeanings = getAllMeanings(text, state.dictionaries, nameDictionary);
  DOMElements.qInputTc.value = allMeanings.name || (allMeanings.vietphrase.length > 0 ? allMeanings.vietphrase[0] : '');

  DOMElements.qInputHV.value = DOMElements.qInputHv.value.toUpperCase();
  DOMElements.qInputVp.value = allMeanings.vietphrase.length > 0 ? allMeanings.vietphrase[0] : '';

  DOMElements.qDeleteBtn.disabled = !nameDictionary.has(text);
}

function openOldModal(state) {
  const text = selectionState.originalText;
  DOMElements.originalWordInput.value = text;
  updateOldModalFields(text, state);
  hideQuickEditPanel();
  DOMElements.editModal.style.display = 'flex';
  setTimeout(() => {
    const mc = DOMElements.editModal.querySelector('.modal-content');
    if (mc) mc.classList.add('show');
  }, 10);
}

function closeOldModal() {
  const mc = DOMElements.editModal.querySelector('.modal-content');
  if (mc) mc.classList.remove('show');

  setTimeout(() => {
    DOMElements.editModal.style.display = 'none';
    DOMElements.vietphraseOptionsContainer.classList.add('hidden');

    // Logic from closeOldModal in earlier turn - preserve lock state sync if needed
    // but bot said: "Previous revisions reset the lock state on close; now the lock persists... correct."
    // We will keep persistence.
  }, 200);
}

function updateOldModalFields(text, state) {
  const hanvietInput = document.getElementById('hanviet-input');
  const vietphraseInput = DOMElements.vietphraseInput;
  const optionsContainer = DOMElements.vietphraseOptionsContainer;
  const customMeaningInput = DOMElements.customMeaningInput;

  if (!text) {
    hanvietInput.value = '';
    vietphraseInput.value = '';
    return;
  }

  hanvietInput.value = (getHanViet(text, state.dictionaries) || '').toLowerCase();

  const uniqueMeanings = new Set();
  const all = getAllMeanings(text, state.dictionaries, nameDictionary);
  if (all.name) uniqueMeanings.add(all.name);
  all.names.forEach(m => uniqueMeanings.add(m));
  all.names2.forEach(m => uniqueMeanings.add(m));
  all.vietphrase.forEach(m => uniqueMeanings.add(m));

  optionsContainer.innerHTML = '';
  uniqueMeanings.forEach(meaning => {
    const div = document.createElement('div');
    div.className = 'vietphrase-option';
    div.textContent = meaning;
    div.addEventListener('click', () => {
      vietphraseInput.value = meaning;
      customMeaningInput.value = meaning;
      optionsContainer.classList.add('hidden');
    });
    optionsContainer.appendChild(div);
  });

  const best = Array.from(uniqueMeanings)[0] || '';
  vietphraseInput.value = best;
  customMeaningInput.value = best;

  DOMElements.editModalDeleteBtn.disabled = !nameDictionary.has(text);
}

function expandSelection(direction, state) {
  const { spans, startIndex, endIndex } = selectionState;
  if (!spans) return;

  if (direction === 'left' && startIndex > 0) {
    selectionState.startIndex--;
  } else if (direction === 'right' && endIndex < spans.length - 1) {
    selectionState.endIndex++;
  } else {
    return;
  }

  const selectedSpans = spans.slice(selectionState.startIndex, selectionState.endIndex + 1);
  selectionState.originalText = selectedSpans.map(s => s.dataset.original || s.textContent).join('');
  populateQuickEditPanel(selectionState.originalText, state);
}

function expandOldModalSelection(direction, state) {
    expandSelection(direction, state);
    DOMElements.originalWordInput.value = selectionState.originalText;
    updateOldModalFields(selectionState.originalText, state);
}

async function addPermanentName(cn, vn, state) {
  nameDictionary.set(cn, vn);
  saveNameDictionaryToStorage();
  renderNameList();
  rebuildMasterData(state);
  await performTranslation(state, { forceText: state.lastTranslatedText });
}

async function deletePermanentName(cn, state) {
  nameDictionary.delete(cn);
  saveNameDictionaryToStorage();
  renderNameList();
  updateMasterDataForDeletion(cn, state);
  await performTranslation(state, { forceText: state.lastTranslatedText });
}

function updateTranslationInPlace(newText) {
    const { spans, startIndex, endIndex } = selectionState;
    if (startIndex === -1 || endIndex === -1 || !spans) return;

    const spansToRemove = spans.slice(startIndex, endIndex + 1);
    const firstSpan = spansToRemove[0];

    const newSpan = document.createElement('span');
    newSpan.className = 'word from-name-dict';
    newSpan.dataset.original = selectionState.originalText;
    newSpan.textContent = newText;

    firstSpan.parentNode.insertBefore(newSpan, firstSpan);
    spansToRemove.forEach(s => s.remove());
    selectionState.spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
}

function applyCase(caseType) {
  const input = DOMElements.customMeaningInput;
  let val = input.value;
  if (!val) return;

  switch (caseType) {
    case 'cap':
      val = val.charAt(0).toUpperCase() + val.slice(1);
      break;
    case 'cap2':
      val = val.split(' ').map((w, i) => i < 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
      break;
    case 'lowerLast':
      val = val.slice(0, -1) + val.slice(-1).toLowerCase();
      break;
    case 'upper':
      val = val.toUpperCase();
      break;
  }
  input.value = val;
}
