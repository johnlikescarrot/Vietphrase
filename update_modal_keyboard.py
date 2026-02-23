import sys

file_path = "src/js/m_modal.js"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add state for active suggestion
content = content.replace(
    "let isPanelVisible = false;",
    "let isPanelVisible = false;\nlet activeSuggestionIndex = -1;"
)

# 2. Add toggle listener for Quick Edit and keyboard listener in initializeModal
q_toggle_logic = """
  DOMElements.qVietphraseToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const container = DOMElements.qVietphraseOptionsContainer;
    const isHidden = container.classList.contains('hidden');
    if (isHidden) {
      container.classList.remove('hidden');
      activeSuggestionIndex = -1;
    } else {
      container.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    const qContainer = DOMElements.qVietphraseOptionsContainer;
    const editContainer = DOMElements.vietphraseOptionsContainer;
    const activeContainer = !qContainer.classList.contains('hidden') ? qContainer : (!editContainer.classList.contains('hidden') ? editContainer : null);

    if (!activeContainer) return;

    const options = Array.from(activeContainer.querySelectorAll('.vietphrase-option'));
    if (options.length === 0) return;

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
    } else if (e.key === 'Escape') {
      activeContainer.classList.add('hidden');
      activeSuggestionIndex = -1;
    }
  });
"""

# Insert before updateLockIcon call
content = content.replace("  updateLockIcon(DOMElements.qLockBtn", q_toggle_logic + "\n  updateLockIcon(DOMElements.qLockBtn")

# 3. Add updateActiveSuggestion helper
helper_func = """
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

"""
content = content.replace("function showQuickEditPanel(selection) {", helper_func + "function showQuickEditPanel(selection) {")

# 4. Update populateQuickEditPanel to populate suggestions
populate_logic = """
  const optionsContainer = DOMElements.qVietphraseOptionsContainer;
  const uniqueMeanings = new Set();
  if (allMeanings.name) uniqueMeanings.add(allMeanings.name);
  allMeanings.names.forEach(m => uniqueMeanings.add(m));
  allMeanings.names2.forEach(m => uniqueMeanings.add(m));
  allMeanings.vietphrase.forEach(m => uniqueMeanings.add(m));

  optionsContainer.innerHTML = '';
  uniqueMeanings.forEach(meaning => {
    const div = document.createElement('div');
    div.className = 'vietphrase-option';
    div.textContent = meaning;
    div.addEventListener('click', () => {
      DOMElements.qInputTc.value = meaning;
      optionsContainer.classList.add('hidden');
    });
    optionsContainer.appendChild(div);
  });
"""

content = content.replace(
    "DOMElements.qDeleteBtn.disabled = !nameDictionary.has(text);",
    populate_logic + "\n  DOMElements.qDeleteBtn.disabled = !nameDictionary.has(text);"
)

with open(file_path, "w") as f:
    f.write(content)
print("SUCCESS")
