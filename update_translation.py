import sys
import re

file_path = "src/js/m_translation.js"
with open(file_path, "r") as f:
    content = f.read()

# Add setLoading at start
start_pattern = r"export function performTranslation\(state, options = \{\}\) \{"
if "setLoading(DOMElements.outputPanel, true);" not in content:
    content = re.sub(start_pattern, "export function performTranslation(state, options = {}) {\n  setLoading(DOMElements.outputPanel, true);", content)

# Use index based replacement for safety
start_marker = "const lines = processedText.split('\\n');"
if start_marker not in content:
    start_marker = "const lines = processedText.split(\"\\n\");"

if start_marker in content:
    start_index = content.find(start_marker)
    # The function is at the end of the file, so we replace from start_marker to the end,
    # then add back the closing brace if needed.

    new_body = r'''const lines = processedText.split("\n");
  const fragment = document.createDocumentFragment();

  lines.forEach(line => {
    if (line.trim() === "") return;
    const p = document.createElement("p");
    let isInsideDoubleQuote = false;
    let isInsideSingleQuote = false;
    let capitalizeNextWord = false;
    let lastChar = "";
    let i = 0;

    while (i < line.length) {
      const placeholderMatch = line.substring(i).match(/^%%NAME_\d+%%/);
      let originalWord = "";
      let isPlaceholder = false;

      if (placeholderMatch) {
        isPlaceholder = true;
        originalWord = placeholderMatch[0];
      } else {
        let bestMatch = null;
        if (temporaryNameDictionary.size > 0) {
          let longestKey = "";
          for (const [key] of temporaryNameDictionary.entries()) {
            if (line.startsWith(key, i) && key.length > longestKey.length) longestKey = key;
          }
          if (longestKey) bestMatch = { key: longestKey, value: { translation: temporaryNameDictionary.get(longestKey), type: "temp" } };
        }

        if (!bestMatch) {
          bestMatch = state.dictionaryTrie.findLongestMatch(line, i);
        }

        if (bestMatch) {
          originalWord = bestMatch.key;
          const value = bestMatch.value;

          if (value.type === "Blacklist" || value.translation === "") {
            const span = document.createElement("span");
            span.className = "word blacklisted-word";
            span.dataset.original = originalWord;
            p.appendChild(span);
            lastChar = originalWord.slice(-1);
            i += originalWord.length;
            continue;
          }
        } else {
          const currentChar = line[i];
          let nonMatchEnd = i + 1;
          if (!ALL_PUNCTUATION.has(currentChar)) {
            while (nonMatchEnd < line.length) {
              if (line.substring(nonMatchEnd).match(/^%%NAME_\d+%%/)) break;
              let isKnownAhead = false;
              if (temporaryNameDictionary.size > 0) {
                for (const key of temporaryNameDictionary.keys()) {
                  if (line.startsWith(key, nonMatchEnd)) { isKnownAhead = true; break; }
                }
              }
              if (!isKnownAhead && state.dictionaryTrie.findLongestMatch(line, nonMatchEnd)) isKnownAhead = true;
              if (isKnownAhead || (nonMatchEnd < line.length && ALL_PUNCTUATION.has(line[nonMatchEnd]))) break;
              nonMatchEnd++;
            }
          }
          originalWord = line.substring(i, nonMatchEnd);
        }
      }

      const span = document.createElement("span");
      span.className = "word";
      let textForSpan = "";
      let isFromNameDict = false;

      if (isPlaceholder) {
        const data = placeholders.get(originalWord);
        textForSpan = data.translation;
        span.dataset.original = data.original;
        isFromNameDict = true;
      } else {
        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        textForSpan = !translationResult.found ? originalWord : (isVietphraseMode ? `(${translationResult.all.join("/")})` : translationResult.best);
        span.dataset.original = originalWord;
        if (!translationResult.found) {
          span.classList.add("untranslatable");
          if (/^[\u4e00-\u9fa5]+$/.test(originalWord)) textForSpan = "";
        }
        if (isVietphraseMode && translationResult.found) span.classList.add("vietphrase-word");
      }

      if (capitalizeNextWord) {
        const firstChar = textForSpan.trim().charAt(0);
        if (!/^\d/.test(firstChar) && /\p{L}/u.test(firstChar)) {
          textForSpan = textForSpan.charAt(0).toUpperCase() + textForSpan.slice(1);
          capitalizeNextWord = false;
        } else if (/^\d/.test(firstChar)) {
          capitalizeNextWord = false;
        }
      }

      span.textContent = textForSpan;
      if (isFromNameDict) span.classList.add("from-name-dict");

      const trimmedText = textForSpan.trim();
      if (/[.!?]$/.test(trimmedText) || UNAMBIGUOUS_OPENING.has(originalWord)) {
        capitalizeNextWord = true;
      }

      let leadingSpace = " ";
      const firstCharOfOriginal = originalWord.charAt(0);
      if (AMBIGUOUS_QUOTES.has(firstCharOfOriginal)) {
        const isDouble = firstCharOfOriginal === '"';
        const isSingle = firstCharOfOriginal === "'";
        if (originalWord.length === 1) {
          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) capitalizeNextWord = true;
        }
        if (!((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote))) leadingSpace = "";
        if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
        if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;
      } else {
        if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || UNAMBIGUOUS_CLOSING.has(firstCharOfOriginal)) {
          leadingSpace = "";
        }
      }

      if (i === 0 || /\s/.test(lastChar) || textForSpan.trim() === "") leadingSpace = "";

      if (leadingSpace) p.appendChild(document.createTextNode(leadingSpace));
      p.appendChild(span);

      lastChar = originalWord.slice(-1);
      i += originalWord.length;
    }
    fragment.appendChild(p);
  });

  DOMElements.outputPanel.innerHTML = "";
  DOMElements.outputPanel.appendChild(fragment);
  setLoading(DOMElements.outputPanel, false);
  if (!options.preserveTempDict) {
    temporaryNameDictionary.clear();
  }
}'''

    # We replace from start_index to the end of function
    # To find the end of function, we can look for the last }
    end_index = content.rfind("}")
    if end_index > start_index:
        new_content = content[:start_index] + new_body
        with open(file_path, "w") as f:
            f.write(new_content)
        print("Successfully optimized performTranslation using index-based replacement.")
    else:
        print("Could not find end of function.")
else:
    print("Could not find start marker.")
