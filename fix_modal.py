import sys

file_path = "src/js/m_modal.js"
with open(file_path, "r") as f:
    lines = f.readlines()

# I will find the start and end of initializeModal and replace the whole block.
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if "export function initializeModal(state) {" in line:
        start_idx = i
    if start_idx != -1 and line.strip() == "}":
        # Check if it is the end of the function (look at next line or indentation)
        # Actually initializeModal is quite long. I will look for the next top-level function.
        if i + 1 < len(lines) and (lines[i+1].startswith("function") or lines[i+1].startswith("export function")):
            end_idx = i
            break

if start_idx == -1 or end_idx == -1:
    # Fallback: look for the last "}" before updateActiveSuggestion
    for i, line in enumerate(lines):
        if "function updateActiveSuggestion" in line:
            # The line before should be the end of initializeModal
            end_idx = i - 1
            while lines[end_idx].strip() == "":
                end_idx -= 1
            break

new_init_modal = """export function initializeModal(state) {
  const debouncedUpdateOldModal = debounce((text, state) => updateOldModalFields(text, state), 300);

  DOMElements.outputPanel.addEventListener('click', (e) => {
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;
      const parentElement = container.nodeType === 3 ? container.parentElement : container;

      if (DOMElements.outputPanel.contains(parentElement)) {
        const spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
        const startNode = selection.anchorNode.nodeType === 3 ? selection.anchorNode.parentElement : selection.anchorNode;
        const endNode = selection.focusNode.nodeType === 3 ? selection.focusNode.parentElement : selection.focusNode;

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
      if (DOMElements.editModal.style.display !== 'none') closeOldModal();
      hideQuickEditPanel();

      // Hide suggestion containers
      DOMElements.qVietphraseOptionsContainer.classList.add('hidden');
      DOMElements.vietphraseOptionsContainer.classList.add('hidden');
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
        } else if (e.key === 'Enter' || e.key === 'Tab') {
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
      activeSuggestionIndex = -1;
    } else {
      container.classList.add('hidden');
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
      activeSuggestionIndex = -1;
    } else {
      container.classList.add('hidden');
    }
  });

  DOMElements.qSplitBtn.addEventListener('click', () => splitSelectedWord(state));
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
"""

final_lines = lines[:start_idx] + [new_init_modal + "\n"] + lines[end_idx+1:]
with open(file_path, "w") as f:
    f.writelines(final_lines)
print("SUCCESS")
