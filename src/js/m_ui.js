export function updateClock() {
  const clockElement = document.getElementById('live-clock');
  if (!clockElement) {
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timezoneOffsetMinutes = now.getTimezoneOffset();
  const timezoneOffsetHours = -timezoneOffsetMinutes / 60;
  const timezoneOffsetMinutesRemainder = Math.abs(timezoneOffsetMinutes) % 60;
  const timezoneSign = timezoneOffsetHours >= 0 ? '+' : '';
  const timezoneString = `${timezoneSign}${String(timezoneOffsetHours).padStart(2, '0')}:${String(timezoneOffsetMinutesRemainder).padStart(2, '0')}`;

  clockElement.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function initializeSearch(DOMElements) {
  if (!DOMElements.searchInput || !DOMElements.outputPanel) return;

  const debounce = (func, delay) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), delay);
    };
  };

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase().trim();
    const words = DOMElements.outputPanel.querySelectorAll('.word');

    words.forEach(word => {
      if (!term) {
        word.classList.remove('search-highlight', 'search-dim');
        return;
      }

      const text = word.textContent.toLowerCase();
      const original = (word.dataset.original || '').toLowerCase();
      const matched = text.includes(term) || original.includes(term);

      word.classList.toggle('search-highlight', matched);
      word.classList.toggle('search-dim', !matched);
    });
  };

  DOMElements.searchInput.addEventListener('input', debounce(handleSearch, 250));

  // Mobile search toggle logic
  if (DOMElements.mobileSearchToggle && DOMElements.searchContainer) {
    DOMElements.mobileSearchToggle.addEventListener('click', () => {
      const isHidden = DOMElements.searchContainer.classList.toggle('hidden');
      DOMElements.searchContainer.classList.toggle('flex', !isHidden);
      if (!isHidden) {
        DOMElements.searchInput.focus();
      }
    });
  }
}

export function initializeHelp(DOMElements) {
  if (!DOMElements.openHelpBtn || !DOMElements.helpModal) return;

  const openHelp = () => {
    DOMElements.helpModal.classList.remove('hidden');
    DOMElements.helpModal.setAttribute('aria-hidden', 'false');
    // Set focus to the primary control
    if (DOMElements.helpOkBtn) {
      DOMElements.helpOkBtn.focus();
    }
  };

  const closeHelp = () => {
    DOMElements.helpModal.classList.add('hidden');
    DOMElements.helpModal.setAttribute('aria-hidden', 'true');
    // Return focus to the trigger button
    DOMElements.openHelpBtn.focus();
  };

  DOMElements.openHelpBtn.addEventListener('click', openHelp);

  if (DOMElements.closeHelpModalBtn) {
    DOMElements.closeHelpModalBtn.addEventListener('click', closeHelp);
  }

  if (DOMElements.helpOkBtn) {
    DOMElements.helpOkBtn.addEventListener('click', closeHelp);
  }

  DOMElements.helpModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.helpModal) closeHelp();
  });
}
