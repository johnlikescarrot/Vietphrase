import DOMElements from './m_dom.js';

// DOM Elements cho cài đặt
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeBtn = document.getElementById('settings-panel-close-btn');
const bgColorPresets = document.getElementById('bg-color-presets');
const textColorPresets = document.getElementById('text-color-presets');
const fontFamilySelect = document.getElementById('font-family-select');
const lineHeightSlider = document.getElementById('line-height-slider');
const lineHeightValue = document.getElementById('line-height-value');
const bgColorPicker = document.getElementById('bg-color-picker');
const lineHeightInput = document.getElementById('line-height-input');
const widthInput = document.getElementById('width-input');
const textColorPicker = document.getElementById('text-color-picker');
const mainContainer = document.getElementById('main-container');
const widthSlider = document.getElementById('width-slider');
const widthValue = document.getElementById('width-value');

// Đối tượng lưu trữ cài đặt
let settings = {
  bgColor: '#1e1e1e',
  textColor: '#f7b7b7',
  fontFamily: "Arial, 'Inter', 'Segoe UI', sans-serif",
  lineHeight: 1.6,
  width: 1400
};

// Lưu cài đặt vào localStorage
function saveSettings() {
  localStorage.setItem('displaySettings', JSON.stringify(settings));
}

// Áp dụng cài đặt lên giao diện
function applySettings() {
  DOMElements.outputPanel.style.backgroundColor = settings.bgColor;
  DOMElements.outputPanel.style.color = settings.textColor;
  DOMElements.outputPanel.style.fontFamily = settings.fontFamily;
  DOMElements.outputPanel.style.lineHeight = settings.lineHeight;

  updateActiveColorBox(bgColorPresets, settings.bgColor);
  updateActiveColorBox(textColorPresets, settings.textColor);
  fontFamilySelect.value = settings.fontFamily;

  // Cập nhật UI cho các thanh trượt và ô nhập số
  lineHeightSlider.value = settings.lineHeight;
  lineHeightInput.value = settings.lineHeight;

  if (mainContainer) {
    mainContainer.style.maxWidth = `${settings.width}px`;
    widthSlider.value = settings.width;
    widthInput.value = settings.width;
  }
}

// Tải cài đặt từ localStorage
function loadSettings() {
  const savedSettings = localStorage.getItem('displaySettings');
  if (savedSettings) {
    settings = { ...settings, ...JSON.parse(savedSettings) };
  }
  applySettings();
}

// Cập nhật trạng thái 'active' cho ô màu được chọn
function updateActiveColorBox(container, color) {
  container.querySelectorAll('.color-box').forEach(box => {
    if (box.dataset.color === color) {
      box.classList.add('active');
    } else {
      box.classList.remove('active');
    }
  });
}

export function initializeSettings() {
  if (!settingsBtn || !settingsPanel) return;

  let toggleTimeout = null;

  function hideSettingsPanel() {
    if (toggleTimeout) clearTimeout(toggleTimeout);
    settingsPanel.classList.remove('show');
    toggleTimeout = setTimeout(() => {
      settingsPanel.classList.add('hidden');
      toggleTimeout = null;
    }, 200);
  }

  // Mở/đóng bảng cài đặt
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = settingsPanel.classList.contains('hidden');
    if (isHidden) {
      if (toggleTimeout) clearTimeout(toggleTimeout);
      settingsPanel.classList.remove('hidden');
      const btnRect = settingsBtn.getBoundingClientRect();
      settingsPanel.style.top = `${btnRect.bottom + window.scrollY + 5}px`;
      settingsPanel.style.right = `${window.innerWidth - btnRect.right - window.scrollX}px`;
      toggleTimeout = setTimeout(() => {
        settingsPanel.classList.add('show');
        toggleTimeout = null;
      }, 10);
    } else {
      hideSettingsPanel();
    }
  });

  closeBtn.addEventListener('click', hideSettingsPanel);
  document.addEventListener('click', (e) => {
    if (!settingsPanel.classList.contains('hidden') && !settingsPanel.contains(e.target) && e.target !== settingsBtn) {
      hideSettingsPanel();
    }
  });

  // Xử lý chọn màu nền
  bgColorPresets.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-box')) {
      settings.bgColor = e.target.dataset.color;
      bgColorPicker.value = settings.bgColor;
      applySettings();
      saveSettings();
    }
  });

  // Xử lý chọn màu chữ
  textColorPresets.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-box')) {
      settings.textColor = e.target.dataset.color;
      textColorPicker.value = settings.textColor;
      applySettings();
      saveSettings();
    }
  });

  // Xử lý chọn font
  fontFamilySelect.addEventListener('change', (e) => {
    settings.fontFamily = e.target.value;
    applySettings();
    saveSettings();
  });

  // Xử lý giãn dòng
  lineHeightSlider.addEventListener('input', (e) => {
    settings.lineHeight = e.target.value;
    applySettings();
    saveSettings();
  });

  bgColorPicker.addEventListener('input', (e) => {
    settings.bgColor = e.target.value;
    // Bỏ chọn các màu có sẵn
    updateActiveColorBox(bgColorPresets, null);
    applySettings();
    saveSettings();
  });

  textColorPicker.addEventListener('input', (e) => {
    settings.textColor = e.target.value;
    // Bỏ chọn các màu có sẵn
    updateActiveColorBox(textColorPresets, null);
    applySettings();
    saveSettings();
  });

  widthSlider.addEventListener('input', (e) => {
    settings.width = e.target.value;
    applySettings();
    saveSettings();
  });

  // Xử lý nhập trực tiếp Giãn dòng
  lineHeightInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 1.2 && value <= 2.5) {
      settings.lineHeight = value;
      applySettings();
      saveSettings();
    }
  });

  // Xử lý nhập trực tiếp Chiều rộng
  widthInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 800 && value <= 2000) {
      settings.width = value;
      applySettings();
      saveSettings();
    }
  });

  // Tải cài đặt đã lưu khi khởi động
  loadSettings();
}
