import DOMElements from './m_dom.js';
import { segmentText, translateWord } from './m_dictionary.js';
import { Trie, nameDictionary, temporaryNameDictionary } from './m_nameList.js';
import { standardizeText } from './m_preprocessor.js';
import { setLoading } from './m_utils.js';

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const luatNhanRuleCache = new WeakMap();

function applyLuatNhan(text, state) {
  const luatNhanDict = state.dictionaries.get('LuatNhan')?.dict;
  if (!luatNhanDict || luatNhanDict.size === 0) {
    return text;
  }

  let cachedRules = luatNhanRuleCache.get(luatNhanDict);
  if (!cachedRules) {
    cachedRules = [...luatNhanDict.entries()]
      .filter(([k]) => k.includes('{0}'))
      .sort((a, b) => b[0].length - a[0].length)
      .map(([ruleKey, ruleValue]) => {
        const escapedKey = escapeRegExp(ruleKey).replace('\\{0\\}', '([\u4e00-\u9fa5]+)');
        return {
          regex: new RegExp(escapedKey, 'g'),
          ruleValue
        };
      });
    luatNhanRuleCache.set(luatNhanDict, cachedRules);
  }

  let processedText = text;
  for (const { regex, ruleValue } of cachedRules) {
    processedText = processedText.replace(regex, (match, capturedWord) => {
      const translationResult = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
      const translatedCapturedWord = translationResult.found ? translationResult.best : capturedWord;
      return ruleValue.replace('{0}', translatedCapturedWord);
    });
  }
  return processedText;
}

const translationCache = new Map();
export function synthesizeCompoundTranslation(text, state) {
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }
  const segments = segmentText(text, state.dictionaryTrie, state.masterKeySet);
  if (segments.length <= 1) return [];
  // Giới hạn PHÂN ĐOẠN
  if (segments.length > 7) return [`${segments.join(' ')} - Quá dài để gợi ý`];
  // Bước 1: Lấy nghĩa của từng đoạn, nếu đoạn nào không có nghĩa (như '的')
  // thì tạm thời coi nó là một chuỗi rỗng [''] để không làm hỏng phép tính tổ hợp.
  const segmentMeanings = segments.map(seg => {
    const translation = translateWord(seg, state.dictionaries, nameDictionary, temporaryNameDictionary);
    return translation.all.length > 0 ? translation.all : [''];
  });

  const cartesian = (...a) => a.reduce((acc, val) => acc.flatMap(d => val.map(e => [d, e].flat())));
  let combinations = [];
  try {
    // Bước 2: Tạo ra tất cả các tổ hợp, sau đó loại bỏ các chuỗi rỗng '' đã thêm ở bước 1
    // rồi mới ghép lại thành câu hoàn chỉnh.
    combinations = cartesian(...segmentMeanings).map(combo => combo.filter(Boolean).join(' '));
  } catch (e) {
    return [`${text} - Số lượng tổ hợp quá nhiều`];
  }
  const uniqueCombinations = [...new Set(combinations)];
  // Giới hạn Nghĩa Dịch Nhanh
  const MAX_SUGGESTIONS = 100;
  const finalSuggestions = uniqueCombinations.slice(0, MAX_SUGGESTIONS);
  translationCache.set(text, finalSuggestions);
  return finalSuggestions;
}

export function performTranslation(state, options = {}) {
  setLoading(DOMElements.outputPanel, true);
  console.clear(); // Xóa log cũ

  if (!state || !state.dictionaries || !state.dictionaryTrie) {
    DOMElements.outputPanel.textContent = 'Lỗi: Từ điển chưa được tải hoặc xử lý.';
    setLoading(DOMElements.outputPanel, false);
    return;
  }

  const textToTranslate = options.forceText ?? DOMElements.inputText.value;
  const standardizedText = standardizeText(textToTranslate);
  if (!standardizedText.trim()) {
    DOMElements.outputPanel.textContent = 'Kết quả sẽ hiện ở đây...';
    setLoading(DOMElements.outputPanel, false);
    return;
  }
  if (!options.forceText) {
    state.lastTranslatedText = standardizedText;
  }

  // LỚP 1: TÁCH TẤT CẢ CÁC TỪ ĐIỂN NAME RA XỬ LÝ RIÊNG BẰNG PLACEHOLDER (Đã tối ưu O(n))
  const placeholders = new Map();
  let placeholderId = 0;

  const nameTrie = new Trie();
  const namesDict = state.dictionaries.get('Names')?.dict || new Map();
  const names2Dict = state.dictionaries.get('Names2')?.dict || new Map();

  namesDict.forEach((v, k) => nameTrie.insert(k, { translation: v }));
  names2Dict.forEach((v, k) => nameTrie.insert(k, { translation: v }, true));
  nameDictionary.forEach((v, k) => nameTrie.insert(k, { translation: v }, true));

  let currentIndex = 0;
  let resultText = '';
  while (currentIndex < standardizedText.length) {
    const match = nameTrie.findLongestMatch(standardizedText, currentIndex);
    if (match) {
      const placeholder = `%%NAME_${placeholderId}%%`;
      const firstMeaning = match.value.translation.split(/[;/]/)[0].trim();
      placeholders.set(placeholder, { original: match.key, translation: firstMeaning });
      resultText += placeholder;
      currentIndex += match.key.length;
      placeholderId++;
    } else {
      resultText += standardizedText[currentIndex];
      currentIndex++;
    }
  }
  let processedText = resultText;

  // LỚP 1.5: ÁP DỤNG LUẬT NHÂN TRƯỚC KHI DỊCH
  processedText = applyLuatNhan(processedText, state);

  // LỚP 2: DỊCH PHẦN VĂN BẢN CÒN LẠI VÀ XỬ LÝ LOGIC VIẾT HOA
  const isVietphraseMode = DOMElements.modeToggle.checked;
  const UNAMBIGUOUS_OPENING = new Set(['(', '[', '{', '“', '‘', '『', '「', '《', '〈', '【', '〖', '〔']);
  const UNAMBIGUOUS_CLOSING = new Set([')', ']', '}', '”', '’', '』', '」', '》', '〉', '】', '〗', '〕', ',', '.', '!', '?', ';', ':', '。', '：', '；', '，', '、', '！', '？', '…', '～']);
  const AMBIGUOUS_QUOTES = new Set(['"', "'"]);
  const ALL_PUNCTUATION = new Set([...UNAMBIGUOUS_OPENING, ...UNAMBIGUOUS_CLOSING, ...AMBIGUOUS_QUOTES]);

  // Tối ưu hóa: Xây dựng Trie cho temporaryNameDictionary nếu có
  let tempNameTrie = null;
  if (temporaryNameDictionary.size > 0) {
    tempNameTrie = new Trie();
    temporaryNameDictionary.forEach((v, k) => tempNameTrie.insert(k, { translation: v }));
  }

  const lines = processedText.split('\n');
  const fragment = document.createDocumentFragment();

  lines.forEach(line => {
    const p = document.createElement('p');
    if (line.trim() === '') {
      p.innerHTML = '&nbsp;';
      fragment.appendChild(p);
      return;
    }

    let isInsideDoubleQuote = false;
    let isInsideSingleQuote = false;
    let capitalizeNextWord = false;
    let lastChar = '';
    let i = 0;

    while (i < line.length) {
      const placeholderMatch = line.substring(i).match(/^%%NAME_\d+%%/);
      let originalWord = '';
      let isPlaceholder = false;
      let placeholderVal = null;

      if (placeholderMatch) {
        isPlaceholder = true;
        originalWord = placeholderMatch[0];
        placeholderVal = placeholders.get(originalWord);
      } else {
        let bestMatch = null;
        if (tempNameTrie) {
          bestMatch = tempNameTrie.findLongestMatch(line, i);
          if (bestMatch) {
            bestMatch.value = { translation: bestMatch.value.translation, type: 'temp' };
          }
        }

        if (!bestMatch) {
          bestMatch = state.dictionaryTrie.findLongestMatch(line, i);
        }

        if (bestMatch) {
          originalWord = bestMatch.key;
          const value = bestMatch.value;

          if (value.type === 'Blacklist' || value.translation === '') {
            const span = document.createElement('span');
            span.className = 'word blacklisted-word';
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
              if (tempNameTrie && tempNameTrie.findLongestMatch(line, nonMatchEnd)) isKnownAhead = true;
              if (!isKnownAhead && state.dictionaryTrie.findLongestMatch(line, nonMatchEnd)) isKnownAhead = true;
              if (isKnownAhead || (nonMatchEnd < line.length && ALL_PUNCTUATION.has(line[nonMatchEnd]))) break;
              nonMatchEnd++;
            }
          }
          originalWord = line.substring(i, nonMatchEnd);
        }
      }

      const span = document.createElement('span');
      span.className = 'word';
      let textForSpan = '';
      let isFromNameDict = false;

      if (isPlaceholder) {
        textForSpan = placeholderVal.translation;
        span.dataset.original = placeholderVal.original;
        isFromNameDict = true;
      } else {
        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        textForSpan = !translationResult.found ? originalWord : (isVietphraseMode ? `(${translationResult.all.join('/')})` : translationResult.best);
        span.dataset.original = originalWord;
        if (!translationResult.found) {
          span.classList.add('untranslatable');
          if (/^[\u4e00-\u9fa5]+$/.test(originalWord)) textForSpan = '';
        }
        if (isVietphraseMode && translationResult.found) span.classList.add('vietphrase-word');
      }

      if (capitalizeNextWord) {
        const idx = textForSpan.search(/\p{L}/u);
        if (idx !== -1) {
          const firstLetter = textForSpan.charAt(idx);
          if (!/^\d/.test(firstLetter)) {
            textForSpan = textForSpan.slice(0, idx) + firstLetter.toUpperCase() + textForSpan.slice(idx + 1);
            capitalizeNextWord = false;
          } else {
            capitalizeNextWord = false;
          }
        }
      }

      span.textContent = textForSpan;
      if (isFromNameDict) span.classList.add('from-name-dict');

      const trimmedText = textForSpan.trim();
      if (/[.!?]$/.test(trimmedText) || UNAMBIGUOUS_OPENING.has(originalWord)) {
        capitalizeNextWord = true;
      }

      let leadingSpace = ' ';
      const firstCharOfOriginal = originalWord.charAt(0);
      if (AMBIGUOUS_QUOTES.has(firstCharOfOriginal)) {
        const isDouble = firstCharOfOriginal === '"';
        const isSingle = firstCharOfOriginal === "'";
        const isOpening = (isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote);

        if (originalWord.length === 1) {
          if (isOpening) capitalizeNextWord = true;
        }

        if (isOpening) {
           if (UNAMBIGUOUS_OPENING.has(lastChar)) leadingSpace = '';
        } else {
           leadingSpace = '';
        }

        if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
        if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;
      } else {
        if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || UNAMBIGUOUS_CLOSING.has(firstCharOfOriginal)) {
          leadingSpace = '';
        }
      }

      if (i === 0 || /\s/.test(lastChar) || textForSpan.trim() === '') leadingSpace = '';

      if (leadingSpace) p.appendChild(document.createTextNode(leadingSpace));
      p.appendChild(span);

      lastChar = originalWord.slice(-1);
      i += originalWord.length;
    }
    fragment.appendChild(p);
  });

  DOMElements.outputPanel.innerHTML = '';
  DOMElements.outputPanel.appendChild(fragment);
  setLoading(DOMElements.outputPanel, false);
  if (!options.preserveTempDict) {
    temporaryNameDictionary.clear();
  }
}