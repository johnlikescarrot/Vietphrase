import DOMElements from './m_dom.js';
import { getHanViet, translateWord, segmentText, getAllMeanings } from './m_dictionary.js';
import { nameDictionary, temporaryNameDictionary, saveNameDictionaryToStorage, renderNameList, rebuildMasterData, updateMasterDataForDeletion } from './m_nameList.js';
import { synthesizeCompoundTranslation, performTranslation } from './m_translation.js';
import { customConfirm } from './m_dialog.js';

// XỬ LÝ VIỆC THÊM NAME
function addPermanentName(cn, vn, state) {
  if (!cn) return;

  // 1. Cập nhật từ điển và lưu trữ
  nameDictionary.set(cn, vn);
  saveNameDictionaryToStorage();
  renderNameList();

  // 2. Cập nhật "bộ não" Trie một cách nhanh chóng
  state.masterKeySet.add(cn);
  state.dictionaryTrie.insert(cn, { translation: vn, type: 'name' }, true);

  // 3. Dịch lại toàn bộ văn bản để áp dụng thay đổi
  performTranslation(state, { forceText: state.lastTranslatedText });
}

// XỬ LÝ VIỆC XÓA NAME
async function deletePermanentName(cn, state) {
  if (!cn || !nameDictionary.has(cn)) return;

  if (await customConfirm(`Bạn có chắc muốn xóa "${cn}" khỏi Bảng Thuật Ngữ?`)) {
    // 1. Cập nhật từ điển và lưu trữ
    nameDictionary.delete(cn);
    saveNameDictionaryToStorage();
    renderNameList();

    // 2. Cập nhật lại "bộ não" dịch (theo cách tối ưu)
    updateMasterDataForDeletion(cn, state);

    // 3. Dịch lại toàn bộ văn bản để áp dụng thay đổi
    performTranslation(state, { forceText: state.lastTranslatedText });
  }
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

let selectionState = {
  spans: [],
  startIndex: -1,
  endIndex: -1,
  originalText: '',
};
let isPanelVisible = false;
let isPanelLocked = localStorage.getItem('isPanelLocked') === 'true';
let isEditModalLocked = localStorage.getItem('isEditModalLocked') === 'true';

function applyCase(caseType) {
  const input = DOMElements.customMeaningInput;
  let text = input.value;
  if (!text) return;
  switch (caseType) {
    case 'cap': text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(); break;
    case 'upper': text = text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); break;
    case 'cap2':
      const words2 = text.split(' ');
      text = words2.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') + (words2.length > 2 ? ' ' + words2.slice(2).join(' ') : '');
      break;
    case 'lowerLast':
      const words = text.split(' ');
      if (words.length > 1) {
        const firstPart = words.slice(0, -1)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        const lastPart = words[words.length - 1].toLowerCase();
        text = `${firstPart} ${lastPart}`;
      } else {
        text = text.toLowerCase();
      }
      break;
    case 'hanviet-upper':
      text = text.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      break;
    case 'hanviet-lower':
      text = text.toLowerCase();
      break;
  }
  input.value = text;
}

function groupSimilarMeanings(meanings, state) {
  if (meanings.length <= 1) return meanings.join(' / ');
  const segments = segmentText(meanings.join(''), state.masterKeySet);
  const vpParts = segments.map(segment => {
    if (!/[\u4e00-\u9fa5]/.test(segment)) {
      return segment;
    }
    const translation = translateWord(segment, state.dictionaries, nameDictionary, temporaryNameDictionary);
    const meanings = translation.all;
    if (meanings.length > 1) {
      return `(${meanings.join('/')})`;
    }
    else if (meanings.length === 1) {
      return meanings[0];
    } else {
      return segment;
    }
  });
  return vpParts.join(' ');
}

function closeOldModal() {
  DOMElements.editModal.style.display = 'none';
  DOMElements.vietphraseOptionsContainer.classList.add('hidden');
}

function showQuickEditPanel(selection, state) {
  const range = selection.getRangeAt(0);
  const allSpans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
  const selectedSpans = allSpans.filter(span => selection.containsNode(span, true) && span.textContent.trim() !== '');
  if (selectedSpans.length === 0) {
    if (isPanelVisible && !isPanelLocked) hideQuickEditPanel();
    return;
  }

  selectionState.startIndex = allSpans.indexOf(selectedSpans[0]);
  selectionState.endIndex = allSpans.indexOf(selectedSpans[selectedSpans.length - 1]);
  selectionState.spans = allSpans;
  selectionState.originalText = selectedSpans.map(s => s.dataset.original).join('');
  populateQuickEditPanel(selectionState.originalText, state);

  // ===== CĂN LỀ BẢNG DỊCH NHANH =====
  const panel = DOMElements.quickEditPanel;
  const rect = range.getBoundingClientRect();

  panel.style.visibility = 'hidden';
  panel.classList.remove('hidden');

  const panelWidth = panel.offsetWidth;
  const panelHeight = panel.offsetHeight;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const margin = 5; // Khoảng cách lề

  // --- Tính toán vị trí chiều ngang (Trái/Phải) ---
  let leftPosition = rect.left; // Bắt đầu bằng cách căn lề trái của panel với lề trái của chữ

  // Nếu tràn lề phải, thử căn lề phải của panel với lề phải của chữ
  if (leftPosition + panelWidth + margin > viewportWidth) {
    leftPosition = rect.right - panelWidth;
  }

  // Sau khi điều chỉnh, nếu vẫn tràn lề trái, đặt nó ở sát lề trái màn hình
  if (leftPosition < margin) {
    leftPosition = margin;
  }

  // --- Tính toán vị trí chiều dọc (Trên/Dưới) ---
  let topPosition;

  // Kiểm tra xem có bị tràn lề dưới VÀ có đủ không gian ở trên không
  if (rect.bottom + panelHeight + margin > viewportHeight && rect.top > panelHeight + margin) {
    // Nếu có, hiển thị panel BÊN TRÊN chữ
    topPosition = rect.top - panelHeight - margin;
  } else {
    // Nếu không, hiển thị panel BÊN DƯỚI như bình thường
    topPosition = rect.bottom + margin;
  }

  // Áp dụng vị trí cuối cùng (cộng với vị trí cuộn trang)
  panel.style.left = `${window.scrollX + leftPosition}px`;
  panel.style.top = `${window.scrollY + topPosition}px`;

  panel.style.visibility = 'visible';
  isPanelVisible = true;
}

function populateQuickEditPanel(text, state) {
  DOMElements.qInputZw.value = text;

  // Lấy tất cả các nghĩa bằng hàm đã được nâng cấp
  const allMeanings = getAllMeanings(text, state.dictionaries, nameDictionary);

  // Điền Hán Việt
  if (allMeanings.hanviet) {
    const hanvietLower = allMeanings.hanviet.toLowerCase();
    DOMElements.qInputHv.value = hanvietLower;
    DOMElements.qInputHV.value = hanvietLower.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else {
    DOMElements.qInputHv.value = '';
    DOMElements.qInputHV.value = '';
  }

  // Xử lý hiển thị cho mục Vp theo logic mới
  let vpDisplayValue = '';
  const vpMeaningsForFullPhrase = allMeanings.vietphrase;

  // Ưu tiên 1: Hiển thị nghĩa của cả cụm từ nếu có.
  if (vpMeaningsForFullPhrase.length > 0) {
    vpDisplayValue = vpMeaningsForFullPhrase.join('/');
  }
  // Ưu tiên 2: Nếu là từ ghép (>1 ký tự) và không có nghĩa chung, thì ghép nghĩa của từng ký tự.
  else if (text.length > 1) {
    const charMeaningsList = text.split('')
      .filter(char => /[\u4e00-\u9fa5]/.test(char)) // Chỉ xử lý ký tự tiếng Trung
      .map(char => {
        const meanings = getAllMeanings(char, state.dictionaries, nameDictionary).vietphrase;
        return meanings.length > 0 ? meanings.join('/') : null; // Trả về null nếu ký tự không có nghĩa
      })
      .filter(Boolean); // Lọc bỏ các kết quả null

    vpDisplayValue = charMeaningsList.join(' | ');
  }

  DOMElements.qInputVp.value = vpDisplayValue;

  // Ô tùy chỉnh vẫn ưu tiên Name List đầu tiên
  DOMElements.qInputTc.value = allMeanings.name || '';
  // Vô hiệu hóa nút xóa nếu từ không có trong Name List
  DOMElements.qDeleteBtn.disabled = !nameDictionary.has(text);
}

function hideQuickEditPanel() {
  if (isPanelVisible) {
    DOMElements.quickEditPanel.classList.add('hidden');
    isPanelVisible = false;
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
  }
}

function expandQuickSelection(direction, state) {
  const { spans, startIndex, endIndex } = selectionState;
  let newStart = startIndex, newEnd = endIndex;

  if (direction === 'left' && startIndex > 0) newStart--;
  else if (direction === 'right' && endIndex < spans.length - 1) newEnd++;
  else return;
  selectionState.startIndex = newStart;
  selectionState.endIndex = newEnd;
  selectionState.originalText = spans.slice(newStart, newEnd + 1).map(s => s.dataset.original).join('');

  const newRange = document.createRange();
  newRange.setStartBefore(spans[newStart]);
  newRange.setEndAfter(spans[newEnd]);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(newRange);

  populateQuickEditPanel(selectionState.originalText, state);
}

function populateOldModal(text, state) {
  const originalWordInput = document.getElementById('original-word-input');
  originalWordInput.value = text;
  updateOldModalFields(text, state);
}

function openOldModal(state) {
  const text = selectionState.originalText;
  populateOldModal(text, state);
  hideQuickEditPanel();
  DOMElements.editModal.style.display = 'flex';
}

function expandOldModalSelection(direction, state) {
  const { spans, startIndex, endIndex } = selectionState;
  let newStartIdx = startIndex, newEndIdx = endIndex;

  if (direction === 'left' && startIndex > 0) newStartIdx--;
  else if (direction === 'right' && endIndex < spans.length - 1) newEndIdx++;
  else return;
  selectionState.startIndex = newStartIdx;
  selectionState.endIndex = newEndIdx;
  selectionState.originalText = selectionState.spans.slice(newStartIdx, newEndIdx + 1).map(s => s.dataset.original).join('');

  populateOldModal(selectionState.originalText, state);
}

export function initializeModal(state) {

  let isDoubleClick = false;
  // === DOUBLE CLICK ===
  DOMElements.outputPanel.addEventListener('dblclick', (e) => {
    const targetSpan = e.target.closest('.word');
    if (targetSpan) {
      isDoubleClick = true; // Bật cờ lên báo hiệu vừa có double click
      e.preventDefault();

      const allSpans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
      const clickedIndex = allSpans.indexOf(targetSpan);
      if (clickedIndex === -1) return;

      selectionState.spans = allSpans;
      selectionState.startIndex = clickedIndex;
      selectionState.endIndex = clickedIndex;
      selectionState.originalText = targetSpan.dataset.original;

      openOldModal(state);
    }
  });

  // Cập nhật trạng thái icon khóa khi tải trang
  if (isPanelLocked) {
    const lockIcon = DOMElements.qLockBtn;
    lockIcon.classList.add('is-locked');
    lockIcon.title = "Bỏ ghim bảng dịch nhanh";
    lockIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
  }
  if (isEditModalLocked) {
    const lockIcon = DOMElements.editModalLockBtn;
    lockIcon.classList.add('is-locked');
    lockIcon.title = "Bỏ ghim bảng";
    lockIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
  }
  document.addEventListener('pointerup', (e) => {
    const outputPanel = DOMElements.outputPanel;
    const quickEditPanel = DOMElements.quickEditPanel;
    const optionsContainer = DOMElements.vietphraseOptionsContainer;

    if (isPanelVisible && !isPanelLocked && !quickEditPanel.contains(e.target) && !outputPanel.contains(e.target)) {
      hideQuickEditPanel();
    }

    if (!optionsContainer.classList.contains('hidden') && !optionsContainer.contains(e.target) && !DOMElements.vietphraseToggleBtn.contains(e.target) && !DOMElements.vietphraseInput.contains(e.target)) {
      optionsContainer.classList.add('hidden');
    }

    if (!outputPanel.contains(e.target) || quickEditPanel.contains(e.target)) {
      return;
    }

    setTimeout(() => {
      if (isDoubleClick) {
        isDoubleClick = false; // Reset lại cờ cho lần sau
        return; // Dừng lại, không chạy code mở bảng Dịch nhanh nữa
      }
      const selection = window.getSelection();
      const targetSpan = e.target.closest('.word');

      if (targetSpan && selection.isCollapsed) {
        const range = document.createRange();
        range.selectNode(targetSpan);
        selection.removeAllRanges();
        selection.addRange(range);
        showQuickEditPanel(selection, state);
        return;
      }

      if (selection.toString().trim() !== '') {
        showQuickEditPanel(selection, state);
      } else if (isPanelVisible && !isPanelLocked) {
        hideQuickEditPanel();
      }
    }, 50);
  });

  DOMElements.qCloseBtn.addEventListener('click', hideQuickEditPanel);

  DOMElements.qDeleteBtn.addEventListener('click', () => {
    const cn = DOMElements.qInputZw.value.trim();
    deletePermanentName(cn, state);
  });

  DOMElements.editModalDeleteBtn.addEventListener('click', () => {
    const cn = DOMElements.originalWordInput.value.trim();
    deletePermanentName(cn, state);
  });

  function updateLockIcon(button, isLocked, tooltips) {
    button.classList.toggle('is-locked', isLocked);
    button.title = isLocked ? tooltips.unlock : tooltips.lock;
    const svgLocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`; // SVG icon đã khóa
    const svgUnlocked = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`; // SVG icon đã mở
    button.innerHTML = isLocked ? svgLocked : svgUnlocked;
  }

  DOMElements.qLockBtn.addEventListener('click', () => {
    isPanelLocked = !isPanelLocked;
    localStorage.setItem('isPanelLocked', isPanelLocked);
    updateLockIcon(DOMElements.qLockBtn, isPanelLocked, {
      lock: "Ghim bảng dịch nhanh",
      unlock: "Bỏ ghim bảng dịch nhanh"
    });
  });

  DOMElements.editModalLockBtn.addEventListener('click', () => {
    isEditModalLocked = !isEditModalLocked;
    localStorage.setItem('isEditModalLocked', isEditModalLocked);
    const lockIcon = DOMElements.editModalLockBtn;
    if (isEditModalLocked) {
      lockIcon.classList.add('is-locked');
      lockIcon.title = "Bỏ ghim bảng";
      lockIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
    } else {
      lockIcon.classList.remove('is-locked');
      lockIcon.title = "Ghim bảng";
      lockIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
    }
  });

  DOMElements.qExpandLeftBtn.addEventListener('click', () => expandQuickSelection('left', state));
  DOMElements.qExpandRightBtn.addEventListener('click', () => expandQuickSelection('right', state));
  DOMElements.qAddNameBtn.addEventListener('click', () => openOldModal(state));

  const debouncedPopulateQuickEdit = debounce(() => {
    const newText = DOMElements.qInputZw.value;
    populateQuickEditPanel(newText, state);
  }, 250);
  DOMElements.qInputZw.addEventListener('input', debouncedPopulateQuickEdit);

  const debouncedUpdateOldModal = debounce(() => {
    const newText = DOMElements.originalWordInput.value;
    updateOldModalFields(newText, state);
  }, 250);
  DOMElements.originalWordInput.addEventListener('input', debouncedUpdateOldModal);

  DOMElements.qSearchBtn.addEventListener('click', () => {
    const text = DOMElements.qInputZw.value.trim();
    if (text) window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank');
  });
  DOMElements.qCopyBtn.addEventListener('click', () => {
    const text = DOMElements.qInputZw.value.trim();
    if (text) navigator.clipboard.writeText(text);
  });

  const hanvietInput = document.getElementById('hanviet-input');
  hanvietInput.addEventListener('click', () => {
    const hanvietValue = hanvietInput.value;
    if (hanvietValue && hanvietValue !== 'Không tìm thấy Hán Việt.') {
      DOMElements.customMeaningInput.value = hanvietValue;
    }
  });

  hanvietInput.addEventListener('input', () => {
    DOMElements.customMeaningInput.value = hanvietInput.value;
  });

  DOMElements.vietphraseInput.addEventListener('input', () => {
    DOMElements.customMeaningInput.value = DOMElements.vietphraseInput.value;
    DOMElements.vietphraseOptionsContainer.classList.add('hidden');
  });

  DOMElements.vietphraseInput.addEventListener('focus', () => {
    DOMElements.customMeaningInput.value = DOMElements.vietphraseInput.value;
  });

  DOMElements.vietphraseToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const container = DOMElements.vietphraseOptionsContainer;
    const input = DOMElements.vietphraseInput;

    if (container.classList.contains('hidden')) {
      const inputRect = input.getBoundingClientRect();
      const mainWidthInput = document.getElementById('width-input');

      // Lấy chiều rộng từ cài đặt, với giá trị mặc định là 1280 nếu không tìm thấy
      const resultPanelWidth = mainWidthInput ? parseInt(mainWidthInput.value, 10) : 1280;

      // 1. Chiều rộng TỐI ĐA của danh sách sẽ bằng chiều rộng của khung kết quả
      container.style.maxWidth = `${resultPanelWidth}px`;
      // 2. Chiều rộng TỐI THIỂU sẽ bằng chiều rộng của ô input để không bị quá hẹp
      container.style.minWidth = `${inputRect.width}px`;
      // 3. Xóa width cố định để nó tự co giãn giữa min và max
      container.style.width = '';

      // Định vị danh sách ngay bên dưới ô input
      container.style.top = `${inputRect.bottom + 2}px`;
      container.style.left = `${inputRect.left}px`;

      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  });

  function updateTranslationInPlace(newText) {
    const { spans, startIndex, endIndex } = selectionState;
    if (startIndex === -1 || endIndex === -1) return;

    // Lấy ra các span cũ đang được chọn
    const spansToRemove = spans.slice(startIndex, endIndex + 1);
    if (spansToRemove.length === 0) return;

    // Tạo một span mới để thay thế
    const newSpan = document.createElement('span');
    newSpan.className = 'word user-defined-temp'; // Thêm class mới để tạo kiểu
    newSpan.textContent = newText;
    newSpan.dataset.original = selectionState.originalText;

    // Chèn span mới vào trước span đầu tiên trong vùng chọn
    const firstSpan = spansToRemove[0];
    firstSpan.parentNode.insertBefore(newSpan, firstSpan);

    // Xóa tất cả các span cũ
    spansToRemove.forEach(span => span.remove());

    // Cập nhật lại danh sách các span trong state để các lần chỉnh sửa sau không bị lỗi
    const allSpansAfterUpdate = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
    selectionState.spans = allSpansAfterUpdate;
  }

  // CẬP NHẬT BẢN DỊCH TẠI CHỖ
  function updateTranslationInPlace(newText) {
    const { spans, startIndex, endIndex } = selectionState;
    if (startIndex === -1 || endIndex === -1 || !spans) return;

    const spansToRemove = spans.slice(startIndex, endIndex + 1);
    if (spansToRemove.length === 0) return;

    // Tạo một span mới để thay thế
    const newSpan = document.createElement('span');
    newSpan.className = 'word user-defined-temp'; // Thêm class mới để tạo kiểu
    newSpan.textContent = newText;
    newSpan.dataset.original = selectionState.originalText;

    // Chèn span mới vào trước span đầu tiên trong vùng chọn
    const firstSpan = spansToRemove[0];
    firstSpan.parentNode.insertBefore(newSpan, firstSpan);

    // Xóa tất cả các span cũ
    spansToRemove.forEach(span => span.remove());

    // Cập nhật lại danh sách các span trong state để các lần chỉnh sửa sau không bị lỗi
    selectionState.spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
  }

  document.querySelectorAll('.q-temp-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetInputId = e.target.dataset.target;
      const text = document.getElementById(targetInputId).value;
      if (typeof text === 'string' && selectionState.originalText) {
        updateTranslationInPlace(text);
        hideQuickEditPanel();
      }
    });
  });

  document.querySelectorAll('.q-perm-add-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const zwText = DOMElements.qInputZw.value.trim();
      const targetInputId = e.target.dataset.target;
      const vnText = document.getElementById(targetInputId).value.trim();
      addPermanentName(zwText, vnText, state);
      hideQuickEditPanel();
    });
  });
  DOMElements.editModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.editModal && !isEditModalLocked) closeOldModal();
  });

  DOMElements.closeEditModalBtn.addEventListener('click', closeOldModal);

  DOMElements.expandLeftBtn.addEventListener('click', () => expandOldModalSelection('left', state));
  DOMElements.expandRightBtn.addEventListener('click', () => expandOldModalSelection('right', state));

  DOMElements.addToNameListBtn.addEventListener('click', () => {
    const cn = document.getElementById('original-word-input').value.trim();
    const vn = DOMElements.customMeaningInput.value.trim();
    addPermanentName(cn, vn, state);
    closeOldModal();
  });

  DOMElements.addTempBtn.addEventListener('click', () => {
    const cn = document.getElementById('original-word-input').value.trim();
    const vn = DOMElements.customMeaningInput.value.trim();
    if (cn) {
      temporaryNameDictionary.set(cn, vn);
      performTranslation(state, { forceText: state.lastTranslatedText });
      closeOldModal();
    }
  });

  document.querySelectorAll('.case-btn').forEach(btn => {
    btn.addEventListener('click', (e) => applyCase(e.target.dataset.case));

    btn.addEventListener('dblclick', () => {
      applyCase(btn.dataset.case);
      const cn = document.getElementById('original-word-input').value.trim();
      const vn = DOMElements.customMeaningInput.value.trim();
      if (cn && vn) {
        addPermanentName(cn, vn, state);
        closeOldModal();

        const addButton = DOMElements.addToNameListBtn;
        const originalText = addButton.textContent;
        addButton.textContent = 'Đã lưu!';
        addButton.disabled = true;
        setTimeout(() => {
          addButton.textContent = originalText;
          addButton.disabled = false;
        }, 1500);
      }
    });
  });
  document.addEventListener('click', () => {
    const container = DOMElements.vietphraseOptionsContainer;
    if (!container.classList.contains('hidden')) {
      container.classList.add('hidden');
    }
  });

  DOMElements.vietphraseOptionsContainer.addEventListener('click', (e) => {
    e.stopPropagation(); // Ngăn nó tự đóng khi bấm vào chính nó
  });

}

function updateOldModalFields(text, state) {
  const hanvietInput = document.getElementById('hanviet-input');
  const vietphraseInput = DOMElements.vietphraseInput;
  const optionsContainer = DOMElements.vietphraseOptionsContainer;
  const customMeaningInput = DOMElements.customMeaningInput;

  if (!text) {
    hanvietInput.value = '';
    vietphraseInput.value = '';
    optionsContainer.innerHTML = '<div class="vietphrase-option text-gray-400">Nhập Tiếng Trung để xem gợi ý</div>';
    customMeaningInput.value = '';
    return;
  }

  // Giới hạn ký tự
  const CHAR_LIMIT = 30;
  if (text.length > CHAR_LIMIT) {
    hanvietInput.value = getHanViet(text, state.dictionaries)?.toLowerCase() || '...';
    vietphraseInput.value = '';
    customMeaningInput.value = text;
    optionsContainer.innerHTML = '<div class="vietphrase-option text-red-400">[Câu quá dài, vượt giới hạn ký tự]</div>';
    return;
  }

  hanvietInput.value = getHanViet(text, state.dictionaries) ? getHanViet(text, state.dictionaries).toLowerCase() : 'Không tìm thấy Hán Việt.';

  const uniqueMeanings = new Set();
  const allMeanings = getAllMeanings(text, state.dictionaries, nameDictionary);

  if (allMeanings.name) uniqueMeanings.add(allMeanings.name);
  if (allMeanings.names2.length > 0) allMeanings.names2.forEach(m => uniqueMeanings.add(m));
  if (allMeanings.names.length > 0) allMeanings.names.forEach(m => uniqueMeanings.add(m));
  if (allMeanings.vietphrase.length > 0) allMeanings.vietphrase.forEach(m => uniqueMeanings.add(m));

  const segments = segmentText(text, state.masterKeySet);
  let synthesisError = null;

  if (segments.length > 1) {
    const sentenceSuggestions = synthesizeCompoundTranslation(text, state);
    sentenceSuggestions.forEach(suggestion => {
      if (suggestion.includes(' - Quá dài') || suggestion.includes(' - Số lượng tổ hợp')) {
        synthesisError = suggestion.substring(suggestion.indexOf(' - ') + 3);
      } else {
        uniqueMeanings.add(suggestion);
      }
    });
  }

  const combinedMeanings = Array.from(uniqueMeanings);
  optionsContainer.innerHTML = '';

  if (combinedMeanings.length > 0) {
    combinedMeanings.forEach(meaning => {
      const optionEl = document.createElement('div');
      optionEl.className = 'vietphrase-option';
      optionEl.textContent = meaning;
      optionEl.title = meaning;
      optionEl.addEventListener('click', () => {
        vietphraseInput.value = meaning;
        customMeaningInput.value = meaning;
        optionsContainer.classList.add('hidden');
      });
      optionsContainer.appendChild(optionEl);
    });

    const bestMeaning = combinedMeanings[0] || '';
    vietphraseInput.value = bestMeaning;
    customMeaningInput.value = bestMeaning;

  } else {
    if (synthesisError) {
      optionsContainer.innerHTML = `<div class="vietphrase-option text-red-400">[${synthesisError}]</div>`;
    } else {
      optionsContainer.innerHTML = '<div class="vietphrase-option text-gray-400">Không tìm thấy Vietphrase/Name</div>';
    }
    vietphraseInput.value = '';
    customMeaningInput.value = text;
  }
  // Vô hiệu hóa nút xóa nếu từ không có trong Name List
  DOMElements.editModalDeleteBtn.disabled = !nameDictionary.has(text);
}