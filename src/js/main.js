import DOMElements from './m_dom.js';
import { initializeDictionaries, clearAllDictionaries, loadDictionariesFromFile, loadDictionariesFromServer, loadSingleDictionaryFromFile } from './m_dictionary.js';
import { customAlert, customConfirm } from './m_dialog.js';
import { initializeNameList, rebuildMasterData, renderNameList } from './m_nameList.js';
import { initializeModal } from './m_modal.js';
import { performTranslation } from './m_translation.js';
import { updateClock } from './m_ui.js';
import { initializeSettings } from './m_settings.js';

function appendLog(message, type) {
  const li = document.createElement('li');
  let icon = '';

  if (type === 'loading') {
    icon = '<div class="w-4 h-4 border-2 border-dashed rounded-full animate-spin border-accent-color spinner-icon"></div>';
  } else if (type === 'success') {
    icon = '<span>✅</span>';
  } else if (type === 'error') {
    icon = '<span>❌</span>';
  } else {
    icon = '<span>ℹ️</span>';
  }

  li.innerHTML = `${icon}<span>${message}</span>`;
  li.classList.add(`log-${type}`);
  DOMElements.logList.appendChild(li);

  DOMElements.logList.scrollTop = DOMElements.logList.scrollHeight;
  return li;
}

function updateLog(li, message, type) {
  let icon = '';
  if (type === 'success') {
    icon = '<span>✅</span>';
  } else if (type === 'error') {
    icon = '<span>❌</span>';
  } else {
    icon = '<span>ℹ️</span>';
  }

  li.innerHTML = `${icon}<span>${message}</span>`;
  li.classList.remove('log-loading');
  li.classList.add(`log-${type}`);
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = {
    dictionaries: null,
    masterKeySet: new Set(),
    lastTranslatedText: '',
  };

  let isImporting = false;
  let importHasFinished = false;
  let singleImportType = null;

  initializeSettings();
  initializeNameList(state);
  initializeModal(state);

  const updateState = (newDicts) => {
    state.dictionaries = newDicts;
    if (newDicts) {
      DOMElements.loader.style.display = 'flex';
      DOMElements.loaderText.textContent = 'Đang hoàn tất và áp dụng từ điển...';

      // Dùng setTimeout để đảm bảo trình duyệt kịp hiển thị text mới trước khi bắt đầu tác vụ nặng cuối cùng
      setTimeout(() => {
        rebuildMasterData(state);
        renderNameList(); // Cập nhật lại giao diện Name List

        // Kích hoạt các nút bấm và ẩn màn hình chờ SAU KHI xử lý xong
        DOMElements.translateBtn.disabled = false;
        DOMElements.modeToggle.disabled = false;
        DOMElements.loader.style.display = 'none';
      }, 100); // Cho trình duyệt 100ms để "thở" và cập nhật UI
    }
  };

  const db = await initializeDictionaries();
  if (db) {
    // Nếu có từ điển trong CSDL, hiển thị thông báo và bắt đầu xử lý
    DOMElements.loaderText.textContent = 'Đang nạp và xử lý từ điển...';
    // Dùng setTimeout để đảm bảo trình duyệt kịp hiển thị text mới trước khi bắt đầu tác vụ nặng
    setTimeout(() => {
      updateState(db);
    }, 50);
  } else {
    // Nếu không có từ điển, không cần xử lý gì, ẩn màn hình chờ ngay
    DOMElements.loader.style.display = 'none';
  }

  const importOptionsModal = document.getElementById('import-options-modal');
  const closeImportOptionsModalBtn = document.getElementById('close-import-options-modal-btn');
  const singleFileImporter = document.getElementById('single-file-importer');

  DOMElements.importLocalBtn.addEventListener('click', () => {
    if (isImporting) return;
    importOptionsModal.classList.remove('hidden');
  });

  const hideImportOptionsModal = () => importOptionsModal.classList.add('hidden');
  closeImportOptionsModalBtn.addEventListener('click', hideImportOptionsModal);
  importOptionsModal.addEventListener('click', (e) => {
    if (e.target === importOptionsModal) {
      hideImportOptionsModal();
    }
  });

  document.getElementById('import-multi-file-btn').addEventListener('click', () => {
    hideImportOptionsModal();
    if (isImporting) return;
    importHasFinished = false;
    DOMElements.logModal.classList.remove('hidden');
    DOMElements.logList.innerHTML = '';
    DOMElements.fileImporter.click();
  });

  const singleImportButtons = [
    { btnId: 'import-vietphrase-btn', type: 'Vietphrase' },
    { btnId: 'import-phienam-btn', type: 'PhienAm' },
    { btnId: 'import-names-btn', type: 'Names' },
    { btnId: 'import-luatnhan-btn', type: 'LuatNhan' },
  ];

  singleImportButtons.forEach(({ btnId, type }) => {
    document.getElementById(btnId).addEventListener('click', () => {
      singleImportType = type;
      hideImportOptionsModal();
      singleFileImporter.click();
    });
  });

  // HÀM DUY NHẤT ĐỂ XỬ LÝ TẤT CẢ CÁC TRƯỜNG HỢP NHẬP FILE
  const handleFileImport = async (files, importConfig) => {
    if (isImporting || !files || files.length === 0) return;

    isImporting = true;
    DOMElements.importLocalBtn.disabled = true;
    DOMElements.importServerBtn.disabled = true;
    DOMElements.logModal.classList.remove('hidden');
    DOMElements.logList.innerHTML = '';

    const logHandler = { append: appendLog, update: updateLog };
    const currentDicts = state.dictionaries || new Map();

    try {
      let newDicts;
      if (importConfig.isSingleFile) {
        newDicts = await loadSingleDictionaryFromFile(files[0], importConfig.type, currentDicts, logHandler);
      } else {
        newDicts = await loadDictionariesFromFile(files, currentDicts, logHandler);
      }

      if (newDicts) {
        updateState(newDicts);
      }
    } catch (error) {
      console.error("Đã xảy ra lỗi trong quá trình nhập file:", error);
      logHandler.append(`Lỗi nghiêm trọng: ${error.message || 'Không thể hoàn tất tác vụ.'}`, 'error');
    } finally {
      isImporting = false;
      DOMElements.importLocalBtn.disabled = false;
      DOMElements.importServerBtn.disabled = false;
    }
  };

  // Gán sự kiện cho các nút, gọi đến hàm xử lý duy nhất
  singleFileImporter.addEventListener('change', (e) => {
    handleFileImport(e.target.files, { isSingleFile: true, type: singleImportType });
    e.target.value = null; // Reset input
    singleImportType = null;
  });

  DOMElements.fileImporter.addEventListener('change', (e) => {
    handleFileImport(e.target.files, { isSingleFile: false });
    e.target.value = null; // Reset input
  });

  DOMElements.importServerBtn.addEventListener('click', async () => {
    if (isImporting) return;

    isImporting = true;
    DOMElements.importLocalBtn.disabled = true;
    DOMElements.importServerBtn.disabled = true;
    DOMElements.logModal.classList.remove('hidden');
    DOMElements.logList.innerHTML = '';

    const logHandler = { append: appendLog, update: updateLog };

    try {
      const newDicts = await loadDictionariesFromServer(logHandler);
      if (newDicts) {
        updateState(newDicts);
      }
    } catch (error) {
      console.error("Đã xảy ra lỗi khi tải từ server:", error);
      logHandler.append(`Lỗi nghiêm trọng: ${error.message || 'Không thể hoàn tất tác vụ.'}`, 'error');
    } finally {
      isImporting = false;
      DOMElements.importLocalBtn.disabled = false;
      DOMElements.importServerBtn.disabled = false;
    }
  });

  DOMElements.clearDbBtn.addEventListener('click', async () => {
    if (await customConfirm('Bạn có chắc muốn xóa toàn bộ từ điển đã lưu? Hành động này không thể hoàn tác.')) {
      await clearAllDictionaries();
      await customAlert('Đã xóa dữ liệu từ điển. Vui lòng nhập lại từ điển.');
      location.reload();
    }
  });

  function closeLogModal() {
    DOMElements.logModal.classList.add('hidden');
    DOMElements.logList.innerHTML = '';
  }

  DOMElements.closeLogModalBtn.addEventListener('click', closeLogModal);
  DOMElements.logModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.logModal) {
      closeLogModal();
    }
  });

  DOMElements.translateBtn.addEventListener('click', () => {
    if (!state.dictionaries || state.dictionaries.size === 0) {
      customAlert('Vui lòng tải Từ Điển trước khi dịch.');
    } else {
      performTranslation(state);
    }
  });
  DOMElements.clearBtn.addEventListener('click', () => {
    DOMElements.inputText.value = '';
  });

  DOMElements.copyBtn.addEventListener('click', async () => {
    const outputPanel = DOMElements.outputPanel;
    if (outputPanel.textContent.trim().length === 0 || outputPanel.textContent.trim() === 'Kết quả sẽ hiện ở đây...') {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(outputPanel);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const textToCopy = selection.toString();

    try {
      await navigator.clipboard.writeText(textToCopy);

      const originalText = DOMElements.copyBtn.textContent;
      DOMElements.copyBtn.textContent = 'Copied!';
      DOMElements.copyBtn.disabled = true;

      setTimeout(() => {
        DOMElements.copyBtn.textContent = originalText;
        DOMElements.copyBtn.disabled = false;
      }, 200);

    } catch (err) {
      console.error('Không thể sao chép tự động:', err);
    }
  });

  // Xử lý nút Xuất file txt
  DOMElements.exportBtn.addEventListener('click', () => {
    const outputPanel = DOMElements.outputPanel;
    const textToExport = outputPanel.innerText; // Dùng innerText để có định dạng xuống dòng

    // Kiểm tra xem có nội dung để xuất không
    if (textToExport.trim().length === 0 || textToExport.trim() === 'Kết quả sẽ hiện ở đây...') {
      return; // Không làm gì nếu không có nội dung
    }

    // Tạo tên file theo định dạng YYYY-MM-DD_HH-mm-ss
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const fileName = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}.txt`;

    // Tạo một đối tượng Blob (dữ liệu file)
    const blob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });

    // Tạo một đường link ẩn để kích hoạt tải file
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;

    // Thêm link vào trang, nhấn vào nó, rồi xóa đi
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Giải phóng bộ nhớ
    URL.revokeObjectURL(link.href);
  });

  DOMElements.modeToggle.addEventListener('change', () => performTranslation(state));

  const storedSaveState = localStorage.getItem('shouldSaveTextInput');
  const shouldSaveText = storedSaveState === null ? true : storedSaveState === 'true';
  DOMElements.saveTextToggle.checked = shouldSaveText;

  if (shouldSaveText) {
    const savedInputText = localStorage.getItem('savedInputText');
    if (savedInputText) {
      DOMElements.inputText.value = savedInputText;
    }
  }

  DOMElements.saveTextToggle.addEventListener('change', () => {
    const isChecked = DOMElements.saveTextToggle.checked;
    localStorage.setItem('shouldSaveTextInput', isChecked);

    if (!isChecked) {
      localStorage.removeItem('savedInputText');
    } else {
      localStorage.setItem('savedInputText', DOMElements.inputText.value);
    }
  });

  DOMElements.inputText.addEventListener('input', () => {
    if (DOMElements.saveTextToggle.checked) {
      localStorage.setItem('savedInputText', DOMElements.inputText.value);
    }
  });

  DOMElements.clearBtn.addEventListener('click', () => {
    DOMElements.inputText.value = '';
    localStorage.removeItem('savedInputText');
  });

  let currentFontSize = parseInt(localStorage.getItem('translatorFontSize') || '18');
  const baseFontSize = 18;

  const updateFontSize = () => {
    DOMElements.outputPanel.style.fontSize = `${currentFontSize}px`;
    const percent = Math.round((currentFontSize / baseFontSize) * 100);
    DOMElements.fontSizeLabel.textContent = `${percent}%`;
    localStorage.setItem('translatorFontSize', currentFontSize);
  };

  DOMElements.increaseFontBtn.addEventListener('click', () => {
    currentFontSize += 1;
    updateFontSize();
  });

  DOMElements.decreaseFontBtn.addEventListener('click', () => {
    if (currentFontSize > 8) {
      currentFontSize -= 1;
      updateFontSize();
    }
  });

  updateFontSize();

  updateClock();
  setInterval(updateClock, 1000);
});