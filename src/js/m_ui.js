/*
export function updateCurrentYear() {
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    const currentYear = new Date().getFullYear();
    yearSpan.textContent = currentYear;
  }
}
*/

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
  if (!DOMElements.searchInput) return;

  DOMElements.searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const words = DOMElements.outputPanel.querySelectorAll('.word');

    words.forEach(word => {
      if (!term) {
        word.classList.remove('search-highlight');
        word.style.opacity = '1';
        return;
      }

      const text = word.textContent.toLowerCase();
      const original = (word.dataset.original || '').toLowerCase();

      if (text.includes(term) || original.includes(term)) {
        word.classList.add('search-highlight');
        word.style.opacity = '1';
      } else {
        word.classList.remove('search-highlight');
        word.style.opacity = '0.3';
      }
    });
  });
}

export function initializeHelp(DOMElements) {
  if (!DOMElements.openHelpBtn || !DOMElements.helpModal) return;

  const openHelp = () => {
    DOMElements.helpModal.classList.remove('hidden');
    DOMElements.helpModal.setAttribute('aria-hidden', 'false');
  };

  const closeHelp = () => {
    DOMElements.helpModal.classList.add('hidden');
    DOMElements.helpModal.setAttribute('aria-hidden', 'true');
  };

  DOMElements.openHelpBtn.addEventListener('click', openHelp);
  DOMElements.closeHelpModalBtn.addEventListener('click', closeHelp);
  DOMElements.helpOkBtn.addEventListener('click', closeHelp);

  DOMElements.helpModal.addEventListener('click', (e) => {
    if (e.target === DOMElements.helpModal) closeHelp();
  });
}
