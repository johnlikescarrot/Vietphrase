import sys

file_path = "src/js/m_modal.js"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add translateWord to imports
content = content.replace(
    "import { getHanViet, getAllMeanings } from './m_dictionary.js';",
    "import { getHanViet, getAllMeanings, translateWord } from './m_dictionary.js';"
)

# 2. Add listener in initializeModal
search_listener = "  DOMElements.qExpandRightBtn.addEventListener('click', () => expandSelection('right', state));"
replace_listener = search_listener + "\n  DOMElements.qSplitBtn.addEventListener('click', () => splitSelectedWord(state));"
content = content.replace(search_listener, replace_listener)

# 3. Add splitSelectedWord function (I'll add it before expansion functions)
search_func = "function expandSelection(direction, state) {"
split_func_code = """function splitSelectedWord(state) {
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
      parent.insertBefore(document.createTextNode(' '), nextSibling);
    }
    parent.insertBefore(span, nextSibling);
  }

  targetSpan.remove();
  selectionState.spans = Array.from(DOMElements.outputPanel.querySelectorAll('.word'));
  hideQuickEditPanel();
}

"""
content = content.replace(search_func, split_func_code + search_func)

with open(file_path, "w") as f:
    f.write(content)
print("SUCCESS")
