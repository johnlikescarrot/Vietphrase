import DOMElements from './m_dom.js';
import { debounce } from './m_utils.js';

export function initializeSearch() {
  if (!DOMElements.searchInput) return;

  const handleSearch = debounce(() => {
    const query = DOMElements.searchInput.value.trim().toLowerCase();
    clearHighlights();

    if (query.length < 2) return;

    highlightText(DOMElements.outputPanel, query);
  }, 300);

  DOMElements.searchInput.addEventListener('input', handleSearch);

  // Also clear search when translating new text
  if (DOMElements.translateBtn) {
    DOMElements.translateBtn.addEventListener('click', () => {
      DOMElements.searchInput.value = '';
    });
  }
}

function clearHighlights() {
  if (!DOMElements.outputPanel) return;
  const highlights = DOMElements.outputPanel.querySelectorAll('.search-highlight');
  highlights.forEach(span => {
    const textNode = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(textNode, span);
  });
  DOMElements.outputPanel.normalize();
}

function highlightText(container, query) {
  if (!container) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentNode && node.parentNode.classList.contains('search-highlight')) continue;
    nodes.push(node);
  }

  nodes.forEach(textNode => {
    const text = textNode.nodeValue;
    const lowerText = text.toLowerCase();
    let index = lowerText.indexOf(query);

    if (index !== -1) {
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;

      while (index !== -1) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));

        const span = document.createElement('span');
        span.className = 'search-highlight';
        span.textContent = text.substring(index, index + query.length);
        fragment.appendChild(span);

        lastIndex = index + query.length;
        index = lowerText.indexOf(query, lastIndex);
      }

      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));

      if (textNode.parentNode) {
        textNode.parentNode.replaceChild(fragment, textNode);
      }
    }
  });
}
