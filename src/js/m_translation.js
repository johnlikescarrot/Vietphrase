import DOMElements from './m_dom.js';
import { segmentText, translateWord } from './m_dictionary.js';
import { nameDictionary, temporaryNameDictionary } from './m_nameList.js';
import { standardizeText } from './m_preprocessor.js';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyLuatNhan(text, state) {
  const luatNhanDict = state.dictionaries.get('LuatNhan')?.dict;
  if (!luatNhanDict || luatNhanDict.size === 0) {
    return text;
  }

  let processedText = text;
  const sortedRules = [...luatNhanDict.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [ruleKey, ruleValue] of sortedRules) {
    if (!ruleKey.includes('{0}')) continue;
    const escapedKey = escapeRegExp(ruleKey).replace('\\{0\\}', '([\u4e00-\u9fa5]+)');
    const regex = new RegExp(escapedKey, 'g');
    processedText = processedText.replace(regex, (match, capturedWord) => {
      if (state.masterKeySet.has(capturedWord)) {
        const translationResult = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        if (translationResult && translationResult.found) {
          return ruleValue.replace('{0}', translationResult.best);
        }
      }
      return match;
    });
  }

  return processedText;
}

const translationCache = new Map();
export function synthesizeCompoundTranslation(text, state) {
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }
  const segments = segmentText(text, state.masterKeySet);
  if (segments.length <= 1) {
    return [];
  }
  if (segments.length > 10) {
    return [`${segments.join(' ')} - Quá dài để gợi ý`];
  }
  const segmentMeanings = segments.map(seg => {
    const translation = translateWord(seg, state.dictionaries, nameDictionary, temporaryNameDictionary);
    return translation.all;
  });
  const cartesian = (...a) => a.reduce((acc, val) => acc.flatMap(d => val.map(e => [d, e].flat())));
  let combinations = [];
  try {
    combinations = cartesian(...segmentMeanings).map(combo => combo.join(' '));
  } catch (e) {
    return [`${text} - Số lượng tổ hợp quá nhiều`];
  }
  const uniqueCombinations = [...new Set(combinations)];
  const MAX_SUGGESTIONS = 50;
  const finalSuggestions = uniqueCombinations.slice(0, MAX_SUGGESTIONS);
  translationCache.set(text, finalSuggestions);
  return finalSuggestions;
}

export function performTranslation(state, options = {}) {
  if (!state || !state.dictionaries || !state.dictionaryTrie || !state.nameListTrie) {
    DOMElements.outputPanel.textContent = 'Lỗi: Từ điển chưa được tải hoặc xử lý. Vui lòng thử lại.';
    return;
  }

  const textToTranslate = options.forceText ?? DOMElements.inputText.value;
  const standardizedText = standardizeText(textToTranslate);

  if (!standardizedText.trim()) {
    DOMElements.outputPanel.textContent = 'Kết quả sẽ hiện ở đây...';
    return;
  }
  if (!options.forceText) {
    state.lastTranslatedText = standardizedText;
  }

  const isVietphraseMode = DOMElements.modeToggle.checked;
  const UNAMBIGUOUS_OPENING = new Set(['(', '[', '{', '“', '‘']);
  const UNAMBIGUOUS_CLOSING = new Set([')', ']', '}', '”', '’', ',', '.', '!', '?', ';', ':', '。', '：', '；', '，', '、', '！', '？', '……', '～']);
  const AMBIGUOUS_QUOTES = new Set(['"', "'"]);
  const ALL_PUNCTUATION = new Set([...UNAMBIGUOUS_OPENING, ...UNAMBIGUOUS_CLOSING, ...AMBIGUOUS_QUOTES]);

  const lines = standardizedText.split('\n');

  const translatedLineHtmls = lines.map(line => {
    if (line.trim() === '') return null;

    let isInsideDoubleQuote = false;
    let isInsideSingleQuote = false;
    let capitalizeNextWord = false;

    let lineHtml = '';
    let lastChar = '';
    let i = 0;
    while (i < line.length) {
      let bestMatch = null;

      // === QUY TRÌNH TRA CỨU  ===
      // 1. Ưu tiên tuyệt đối: Tra cứu trong Trie của Name List trước
      bestMatch = state.nameListTrie.findLongestMatch(line, i);

      // 2. Nếu không có, tra từ điển tạm thời
      if (!bestMatch && temporaryNameDictionary.size > 0) {
        let longestKey = '';
        for (const [key] of temporaryNameDictionary.entries()) {
          if (line.startsWith(key, i) && key.length > longestKey.length) {
            longestKey = key;
          }
        }
        if (longestKey) {
          bestMatch = { key: longestKey, value: { translation: temporaryNameDictionary.get(longestKey), type: 'temp' } };
        }
      }

      // 3. Nếu vẫn không có, tra trong Trie của các từ điển chính
      if (!bestMatch) {
        bestMatch = state.dictionaryTrie.findLongestMatch(line, i);
      }

      // === KẾT THÚC QUY TRÌNH TRA CỨU ===

      if (bestMatch) {
        const { key: originalWord, value } = bestMatch;
        // Từ đây, mọi logic xử lý phức tạp về dấu câu, viết hoa, khoảng trắng...
        // sẽ được áp dụng đồng đều cho cả từ trong Name List và các từ điển khác.

        if (value.type === 'LuatNhan' && value.translation.includes('{0}')) {
          const ruleKey = value.ruleKey;
          const regexPattern = escapeRegExp(ruleKey).replace(/\\{0\\}/g, '([\\u4e00-\\u9fa5]+)');
          const regex = new RegExp(`^${regexPattern}$`);
          const match = originalWord.match(regex);
          if (match && match[1]) {
            const capturedWord = match[1];
            const translationOfCapturedWord = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
            let finalTranslation = value.translation.replace('{0}', translationOfCapturedWord.best);
            if (capitalizeNextWord && /\p{L}/u.test(finalTranslation)) {
              finalTranslation = finalTranslation.charAt(0).toUpperCase() + finalTranslation.slice(1);
              capitalizeNextWord = false;
            }

            const span = document.createElement('span');
            span.className = 'word';
            span.dataset.original = originalWord;
            span.textContent = finalTranslation;
            let leadingSpace = ' ';
            const firstChar = originalWord.charAt(0);
            if (AMBIGUOUS_QUOTES.has(firstChar)) {
              const isDouble = firstChar === '"';
              const isSingle = firstChar === "'";

              if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
                capitalizeNextWord = true;
                if (UNAMBIGUOUS_OPENING.has(lastChar)) {
                  leadingSpace = '';
                }
              } else {
                leadingSpace = '';
              }

              if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
              if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

            } else {
              if (UNAMBIGUOUS_OPENING.has(lastChar) ||
                (isInsideDoubleQuote && lastChar === '"') ||
                (isInsideSingleQuote && lastChar === "'") ||
                UNAMBIGUOUS_CLOSING.has(firstChar)) {
                leadingSpace = '';
              }
            }

            if (i === 0 || /\s/.test(lastChar)) {
              leadingSpace = '';
            }
            lineHtml += leadingSpace + span.outerHTML;
            lastChar = originalWord.slice(-1);
            i += originalWord.length;
            continue;
          }
        }

        if (value.type === 'Blacklist' || value.translation === '') {
          i += originalWord.length;
          continue;
        }

        // Dù là từ Name List hay từ điển khác, ta đều dùng hàm translateWord để lấy các nghĩa khác nhau
        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = originalWord;

        let textForSpan;
        if (!translationResult.found) {
          span.classList.add('untranslatable');
          textForSpan = originalWord;
        } else if (isVietphraseMode) {
          span.classList.add('vietphrase-word');
          textForSpan = `(${translationResult.all.join('/')})`;
        } else {
          // Luôn lấy nghĩa ưu tiên cao nhất đã tìm được
          textForSpan = translationResult.best;
        }

        if (capitalizeNextWord && /\p{L}/u.test(textForSpan)) {
          textForSpan = textForSpan.charAt(0).toUpperCase() + textForSpan.slice(1);
          capitalizeNextWord = false;
        }
        span.textContent = textForSpan;

        let leadingSpace = ' ';
        const firstChar = originalWord.charAt(0);
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";

          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            capitalizeNextWord = true;
            if (UNAMBIGUOUS_OPENING.has(lastChar)) {
              leadingSpace = '';
            }
          } else {
            leadingSpace = '';
          }

          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

        } else {
          if (UNAMBIGUOUS_OPENING.has(lastChar) ||
            (isInsideDoubleQuote && lastChar === '"') ||
            (isInsideSingleQuote && lastChar === "'") ||
            UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }

        if (i === 0 || /\s/.test(lastChar) || lastChar === '') {
          leadingSpace = '';
        }
        lineHtml += leadingSpace + span.outerHTML;
        lastChar = originalWord.slice(-1);
        i += originalWord.length;
      } else {
        const currentChar = line[i];
        let nonMatchEnd;
        if (ALL_PUNCTUATION.has(currentChar)) {
          nonMatchEnd = i + 1;
        } else {
          nonMatchEnd = i + 1;
          while (nonMatchEnd < line.length) {
            let isKnownWordAhead = false;
            if (state.nameListTrie.findLongestMatch(line, nonMatchEnd)) {
              isKnownWordAhead = true;
            }
            if (!isKnownWordAhead && temporaryNameDictionary.size > 0) {
              for (const key of temporaryNameDictionary.keys()) {
                if (line.startsWith(key, nonMatchEnd)) { isKnownWordAhead = true; break; }
              }
            }
            if (!isKnownWordAhead && state.dictionaryTrie.findLongestMatch(line, nonMatchEnd)) {
              isKnownWordAhead = true;
            }
            if (isKnownWordAhead || (nonMatchEnd < line.length && ALL_PUNCTUATION.has(line[nonMatchEnd]))) { break; }
            nonMatchEnd++;
          }
        }
        const nonMatchBlock = line.substring(i, nonMatchEnd);
        let textForSpan = nonMatchBlock;

        if (capitalizeNextWord && /\p{L}/u.test(textForSpan)) {
          textForSpan = textForSpan.charAt(0).toUpperCase() + textForSpan.slice(1);
          capitalizeNextWord = false;
        }

        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = nonMatchBlock;
        span.textContent = textForSpan;

        let leadingSpace = ' ';
        const firstChar = nonMatchBlock.charAt(0);
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";

          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            capitalizeNextWord = true;
            if (UNAMBIGUOUS_OPENING.has(lastChar)) {
              leadingSpace = '';
            }
          } else {
            leadingSpace = '';
          }

          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

        } else {
          if (UNAMBIGUOUS_OPENING.has(lastChar) ||
            (isInsideDoubleQuote && lastChar === '"') ||
            (isInsideSingleQuote && lastChar === "'") ||
            UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }

        if (i === 0 || /\s/.test(lastChar) || lastChar === '') {
          leadingSpace = '';
        }
        lineHtml += leadingSpace + span.outerHTML;
        lastChar = nonMatchBlock.slice(-1);
        i = nonMatchEnd;
      }
    }

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = lineHtml.trim();
    const treeWalker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT);
    let capitalizeNextLetter = true;

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode;
      let text = node.nodeValue;

      if (capitalizeNextLetter && /\p{L}/u.test(text)) {
        text = text.replace(/\p{L}/u, (letter) => letter.toUpperCase());
        capitalizeNextLetter = false;
      }

      text = text.replace(/([.!?:]\s*)(\p{L})/ug, (_, punctuationAndSpace, letter) => `${punctuationAndSpace}${letter.toUpperCase()}`);
      node.nodeValue = text;
      const trimmedText = text.trim();
      if (trimmedText.length > 0 && /[.!?:]$/.test(trimmedText)) {
        capitalizeNextLetter = true;
      } else {
        capitalizeNextLetter = false;
      }
    }
    return `<p>${tempDiv.innerHTML}</p>`;
  }).filter(Boolean);

  DOMElements.outputPanel.innerHTML = translatedLineHtmls.join('');
  temporaryNameDictionary.clear();
}