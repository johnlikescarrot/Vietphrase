import DOMElements from './m_dom.js';
import { getHanViet, getAllMeanings, translateWord } from './m_dictionary.js';
import { debounce } from './m_utils.js';
import { nameDictionary, temporaryNameDictionary, saveNameDictionaryToStorage, renderNameList, rebuildMasterData, updateMasterDataForDeletion } from './m_nameList.js';
import { performTranslation } from './m_translation.js';
import { customConfirm } from './m_dialog.js';

let isEditModalLocked = localStorage.getItem('isEditModalLocked') === 'true';
let isPanelLocked = localStorage.getItem('isQuickEditLocked') === 'true';
let isPanelVisible = false;
let activeSuggestionIndex = -1;

const selectionState = {
  text: '',
  originalText: '',
  spans: null,
  startIndex: -1,
  endIndex: -1
};

export
/**
 * Renders translation suggestions into a container and attaches click handlers.
 */
function renderMeaningOptions(container, allMeanings, onSelect) {
  const uniqueMeanings = new Set();
  if (allMeanings.name) uniqueMeanings.add(allMeanings.name);
  allMeanings.names.forEach(m => uniqueMeanings.add(m));
  allMeanings.names2.forEach(m => uniqueMeanings.add(m));
  allMeanings.vietphrase.forEach(m => uniqueMeanings.add(m));

  container.innerHTML = '';
  uniqueMeanings.forEach(meaning => {
    const div = document.createElement('div');
    div.className = 'vietphrase-option';
    div.textContent = meaning;
    div.addEventListener('click', () => {
      onSelect(meaning);
      container.classList.add('hidden');
      // Reset aria attributes
      const toggle = container.id === 'q-vietphrase-options-container' ? DOMElements.qVietphraseToggleBtn : DOMElements.vietphraseToggleBtn;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    });
    container.appendChild(div);
  });
  return uniqueMeanings;
}

function updateLockIcon(button, isLocked, tooltips) {
  if (!button) return;
  const svgLocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
  const svgUnlocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;

  button.innerHTML = isLocked ? svgLocked : svgUnlocked;
  button.title = isLocked ? (tooltips.unlock || "Bỏ ghim bảng") : (tooltips.lock || "Ghim bảng này");
}

export function initializeModal(state) {
  const debouncedUpdateOldModal = debounce((text, state) => updateOldModalFields(text, state), 100);

  DOMElements.outputPanel.addEventListener('click', (e) => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === 3 ? container.parentElement : container;

      if (DOMElements.outputPanel.contains(parentElement)) {
        const spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
        const startNode = (selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode).closest('.word');
        const endNode = (selection.focusNode.nodeType === 3 ? selection.focusNode.parentElement : selection.focusNode).closest('.word');

        let startIndex = spans.indexOf(startNode);
        let endIndex = spans.indexOf(endNode);
        if (startIndex > endIndex) [startIndex, endIndex] = [endIndex, startIndex];

        if (startIndex !== -1 && endIndex !== -1) {
          selectionState.spans = spans;
          selectionState.startIndex = startIndex;
          selectionState.endIndex = endIndex;
          selectionState.originalText = spans.slice(startIndex, endIndex + 1).map(s => s.dataset.original || s.textContent).join('');

          populateQuickEditPanel(selectionState.originalText, state);
          showQuickEditPanel(selection);
        }
      }
    } else {
      if (!isPanelLocked && !DOMElements.quickEditPanel.contains(e.target)) {
        hideQuickEditPanel();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    // 1. Modal/Panel closing
    if (e.key === 'Escape') {
      if (getComputedStyle(DOMElements.editModal).display !== 'none') closeOldModal();
      hideQuickEditPanel();

      // Hide suggestion containers
      DOMElements.qVietphraseOptionsContainer.classList.add('hidden');
      DOMElements.vietphraseOptionsContainer.classList.add('hidden');
      DOMElements.qVietphraseToggleBtn.setAttribute('aria-expanded', 'false');
      DOMElements.vietphraseToggleBtn.setAttribute('aria-expanded', 'false');
      activeSuggestionIndex = -1;
    }

    // 2. Translation triggering
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      DOMElements.translateBtn.click();
    }

    // 3. Search focus
    if (e.ctrlKey && e.key === 'f' && DOMElements.searchInput) {
      e.preventDefault();
      DOMElements.searchInput.focus();
      DOMElements.searchInput.select();
    }

    // 4. Suggestion navigation
    const qContainer = DOMElements.qVietphraseOptionsContainer;
    const editContainer = DOMElements.vietphraseOptionsContainer;
    const activeContainer = !qContainer.classList.contains('hidden') ? qContainer : (!editContainer.classList.contains('hidden') ? editContainer : null);

    if (activeContainer) {
      const options = Array.from(activeContainer.querySelectorAll('.vietphrase-option'));
      if (options.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex + 1) % options.length;
          updateActiveSuggestion(options);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeSuggestionIndex = (activeSuggestionIndex - 1 + options.length) % options.length;
          updateActiveSuggestion(options);
        } else if (e.key === 'Enter') {
          if (activeSuggestionIndex >= 0 && activeSuggestionIndex < options.length) {
            e.preventDefault();
            options[activeSuggestionIndex].click();
            activeSuggestionIndex = -1;
          }
        }
      }
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

  DOMElements.qVietphraseToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const container = DOMElements.qVietphraseOptionsContainer;
    if (container.classList.contains('hidden')) {
      container.classList.remove('hidden');
      DOMElements.qVietphraseToggleBtn.setAttribute('aria-expanded', 'true');
      activeSuggestionIndex = -1;
    } else {
      container.classList.add('hidden');
      DOMElements.qVietphraseToggleBtn.setAttribute('aria-expanded', 'false');
      activeSuggestionIndex = -1;
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
    if (container.classList.contains('hidden')) {
      const inputRect = DOMElements.customMeaningInput.getBoundingClientRect();
      container.style.position = 'fixed';
      container.style.top = `${inputRect.bottom + 2}px`;
      container.style.left = `${inputRect.left}px`;
      container.style.width = `${inputRect.width}px`;
      container.classList.remove('hidden');

      DOMElements.vietphraseToggleBtn.setAttribute('aria-expanded', 'true');
      activeSuggestionIndex = -1;
    } else {
      container.classList.add('hidden');
      DOMElements.vietphraseToggleBtn.setAttribute('aria-expanded', 'false');
      activeSuggestionIndex = -1;
    }
  });

  DOMElements.qSplitBtn.addEventListener('click', () => splitSelectedWord(state));

  DOMElements.qDeleteBtn.addEventListener('click', async () => {
    const text = DOMElements.qInputZw.value.trim();
    if (text && await customConfirm("Xóa '" + text + "' khỏi Name List?")) {

      try {
        await deletePermanentName(text, state);
        hideQuickEditPanel();
      } catch (e) {
        console.error('Lỗi khi xóa Name:', e);
        customAlert('Không thể xóa Name. Vui lòng thử lại.', 'error');
      }
    }
  });

  DOMElements.qSearchBtn.addEventListener('click', () => {
    openOldModal(state);
  });
  DOMElements.qExpandLeftBtn.addEventListener('click', () => expandSelection('left', state));
  DOMElements.qExpandRightBtn.addEventListener('click', () => expandSelection('right', state));

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
    DOMElements.vietphraseOptionsContainer.classList.add('hidden');
    DOMElements.qVietphraseOptionsContainer.classList.add('hidden');
  });

  updateLockIcon(DOMElements.qLockBtn, isPanelLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
  updateLockIcon(DOMElements.editModalLockBtn, isEditModalLocked, { lock: "Ghim bảng này", unlock: "Bỏ ghim bảng" });
}



function updateActiveSuggestion(options) {
  options.forEach((opt, idx) => {
    if (idx === activeSuggestionIndex) {
      opt.classList.add('selected');
      opt.scrollIntoView({ block: 'nearest' });
    } else {
      opt.classList.remove('selected');
    }
  });
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

  if (top < window.scrollY) top = rect.bottom + window.scrollY + 10;
  // Ensure it doesn't go off bottom
  if (top + panel.offsetHeight > window.innerHeight + window.scrollY) {
      top = Math.max(window.scrollY, window.innerHeight + window.scrollY - panel.offsetHeight - 10);
  }
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


  renderMeaningOptions(DOMElements.qVietphraseOptionsContainer, allMeanings, (val) => {
    DOMElements.qInputTc.value = val;
  });

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

    // Lock state intentionally persists across modal close/open cycles
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

  const all = getAllMeanings(text, state.dictionaries, nameDictionary);
  const uniqueMeanings = renderMeaningOptions(optionsContainer, all, (val) => {
    vietphraseInput.value = val;
    customMeaningInput.value = val;
  });

  const best = Array.from(uniqueMeanings)[0] || '';
  vietphraseInput.value = best;
  customMeaningInput.value = best;

  DOMElements.editModalDeleteBtn.disabled = !nameDictionary.has(text);
}

function splitSelectedWord(state) {
  const { spans, startIndex, endIndex } = selectionState;
  if (startIndex === -1 || endIndex === -1 || !spans || startIndex !== endIndex) return;

  const targetSpan = spans[startIndex];
  const originalText = targetSpan.dataset.original || targetSpan.textContent;
  if (originalText.length <= 1) return;

  const parent = targetSpan.parentNode;
  const nextSibling = targetSpan.nextSibling;

  for (let i = 0; i < originalText.length; i++) {
    const char = originalText[i];
    const translation = translateWord(char, state.dictionaries, nameDictionary, temporaryNameDictionary);
    const span = document.createElement('span');
    span.className = translation.found ? 'word' : 'word untranslatable';
    span.dataset.original = char;
    span.textContent = translation.found ? translation.best : char;

    if (i > 0) {
      parent.insertBefore(document.createTextNode(' '), nextSibling);
    }
    parent.insertBefore(span, nextSibling);
  }

  targetSpan.remove();
  selectionState.spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
  hideQuickEditPanel();
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
