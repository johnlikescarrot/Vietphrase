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
  if (!state || !state.dictionaries || !state.dictionaryTrie) {
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

  // Dấu mở không gây nhầm lẫn (ngoặc các loại)
  const UNAMBIGUOUS_OPENING = new Set(['(', '[', '{', '“', '‘']);

  // Dấu đóng và dấu phân cách không gây nhầm lẫn
  const UNAMBIGUOUS_CLOSING = new Set([')', ']', '}', '”', '’', ',', '.', '!', '?', ';', ':', '。', '：', '；', '，', '、', '！', '？', '……', '～']);

  // Dấu trích dẫn cần xử lý trạng thái mở/đóng
  const AMBIGUOUS_QUOTES = new Set(['"', "'"]);

  // Set tổng hợp tất cả các dấu câu
  const ALL_PUNCTUATION = new Set([...UNAMBIGUOUS_OPENING, ...UNAMBIGUOUS_CLOSING, ...AMBIGUOUS_QUOTES]);

  const lines = standardizedText.split('\n');

  const translatedLineHtmls = lines.map(line => {
    if (line.trim() === '') return null;

    let isInsideDoubleQuote = false;
    let isInsideSingleQuote = false;

    let lineHtml = '';
    let lastChar = '';
    let i = 0;
    while (i < line.length) {
      let bestMatch = null;
      if (temporaryNameDictionary.size > 0) {
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

      if (!bestMatch) {
        const trieMatch = state.dictionaryTrie.findLongestMatch(line, i);
        if (trieMatch) {
          bestMatch = trieMatch;
        }
      }

      if (bestMatch) {
        const { key: originalWord, value } = bestMatch;

        // Xử lý đặc biệt cho LuatNhan
        if (value.type === 'LuatNhan' && value.translation.includes('{0}')) {
          const ruleKey = value.ruleKey; // Lấy quy tắc gốc đã lưu ở Bước 1
          // Tạo một biểu thức chính quy (regex) để tìm ra phần chữ Hán tương ứng với {0}
          const regexPattern = escapeRegExp(ruleKey).replace(/\\{0\\}/g, '([\u4e00-\u9fa5]+)');
          const regex = new RegExp(`^${regexPattern}$`);
          const match = originalWord.match(regex);

          // Nếu tìm thấy và có nội dung cho {0}
          if (match && match[1]) {
            const capturedWord = match[1]; // Đây chính là chữ '我'
            // Dịch phần chữ Hán đó
            const translationOfCapturedWord = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
            // Thay thế {0} bằng kết quả dịch
            const finalTranslation = value.translation.replace('{0}', translationOfCapturedWord.best);

            // Tạo thẻ span cho kết quả dịch
            const span = document.createElement('span');
            span.className = 'word'; // Giữ class 'word' để có thể bấm vào chỉnh sửa
            span.dataset.original = originalWord; // QUAN TRỌNG: Giữ lại chữ Hán gốc
            span.textContent = finalTranslation;

            let leadingSpace = ' ';
            const firstChar = originalWord.charAt(0);

            // Logic xử lý trạng thái cho dấu ngoặc kép và ngoặc đơn
            if (AMBIGUOUS_QUOTES.has(firstChar)) {
              const isDouble = firstChar === '"';
              const isSingle = firstChar === "'";

              // Kiểm tra xem đây là dấu MỞ hay ĐÓNG
              if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
                // --- XỬ LÝ DẤU MỞ ---
                // Mặc định là có khoảng trắng phía trước, trừ khi nó đứng sau 1 dấu mở khác
                if (UNAMBIGUOUS_OPENING.has(lastChar)) {
                  leadingSpace = '';
                }
              } else {
                // --- XỬ LÝ DẤU ĐÓNG ---
                // Luôn không có khoảng trắng phía trước
                leadingSpace = '';
              }

              // Lật lại trạng thái (mở -> đóng, đóng -> mở)
              if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
              if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

            } else {
              // Logic cho các ký tự không phải là dấu ngoặc kép/đơn
              // Không có khoảng trắng nếu đứng sau dấu mở hoặc đứng trước dấu đóng/phân cách
              if (UNAMBIGUOUS_OPENING.has(lastChar) ||
                (isInsideDoubleQuote && lastChar === '"') || // Xử lý trường hợp ngay sau dấu mở "
                (isInsideSingleQuote && lastChar === "'") || // Xử lý trường hợp ngay sau dấu mở '
                UNAMBIGUOUS_CLOSING.has(firstChar)) {
                leadingSpace = '';
              }
            }

            // Quy tắc cuối cùng: Không bao giờ có khoảng trắng ở đầu dòng hoặc sau một khoảng trắng có sẵn
            if (i === 0 || /\s/.test(lastChar)) {
              leadingSpace = '';
            }
            lineHtml += leadingSpace + span.outerHTML;
            lastChar = originalWord.slice(-1);
            i += originalWord.length;
            continue; // Bỏ qua các bước xử lý còn lại và tiếp tục vòng lặp
          }
        }

        if (value.type === 'Blacklist' || value.translation === '') {
          i += originalWord.length;
          continue;
        }
        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = originalWord;
        if (!translationResult.found) {
          span.classList.add('untranslatable');
          span.textContent = originalWord;
        } else if (isVietphraseMode) {
          span.classList.add('vietphrase-word');
          span.textContent = `(${translationResult.all.join('/')})`;
        } else {
          span.textContent = translationResult.best;
        }
        let leadingSpace = ' ';
        const firstChar = originalWord.charAt(0);

        // Logic xử lý trạng thái cho dấu ngoặc kép và ngoặc đơn
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";

          // Kiểm tra xem đây là dấu MỞ hay ĐÓNG
          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            // --- XỬ LÝ DẤU MỞ ---
            // Mặc định là có khoảng trắng phía trước, trừ khi nó đứng sau 1 dấu mở khác
            if (UNAMBIGUOUS_OPENING.has(lastChar)) {
              leadingSpace = '';
            }
          } else {
            // --- XỬ LÝ DẤU ĐÓNG ---
            // Luôn không có khoảng trắng phía trước
            leadingSpace = '';
          }

          // Lật lại trạng thái (mở -> đóng, đóng -> mở)
          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

        } else {
          // Logic cho các ký tự không phải là dấu ngoặc kép/đơn
          // Không có khoảng trắng nếu đứng sau dấu mở hoặc đứng trước dấu đóng/phân cách
          if (UNAMBIGUOUS_OPENING.has(lastChar) ||
            (isInsideDoubleQuote && lastChar === '"') || // Xử lý trường hợp ngay sau dấu mở "
            (isInsideSingleQuote && lastChar === "'") || // Xử lý trường hợp ngay sau dấu mở '
            UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }

        // Quy tắc cuối cùng: Không bao giờ có khoảng trắng ở đầu dòng hoặc sau một khoảng trắng có sẵn
        if (i === 0 || /\s/.test(lastChar)) {
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
            if (temporaryNameDictionary.size > 0) {
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
        const processedBlock = nonMatchBlock;
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = nonMatchBlock;
        span.textContent = processedBlock;
        let leadingSpace = ' ';
        const firstChar = nonMatchBlock.charAt(0);

        // Logic xử lý trạng thái cho dấu ngoặc kép và ngoặc đơn
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";

          // Kiểm tra xem đây là dấu MỞ hay ĐÓNG
          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            // --- XỬ LÝ DẤU MỞ ---
            // Mặc định là có khoảng trắng phía trước, trừ khi nó đứng sau 1 dấu mở khác
            if (UNAMBIGUOUS_OPENING.has(lastChar)) {
              leadingSpace = '';
            }
          } else {
            // --- XỬ LÝ DẤU ĐÓNG ---
            // Luôn không có khoảng trắng phía trước
            leadingSpace = '';
          }

          // Lật lại trạng thái (mở -> đóng, đóng -> mở)
          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;

        } else {
          // Logic cho các ký tự không phải là dấu ngoặc kép/đơn
          // Không có khoảng trắng nếu đứng sau dấu mở hoặc đứng trước dấu đóng/phân cách
          if (UNAMBIGUOUS_OPENING.has(lastChar) ||
            (isInsideDoubleQuote && lastChar === '"') || // Xử lý trường hợp ngay sau dấu mở "
            (isInsideSingleQuote && lastChar === "'") || // Xử lý trường hợp ngay sau dấu mở '
            UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }

        // Quy tắc cuối cùng: Không bao giờ có khoảng trắng ở đầu dòng hoặc sau một khoảng trắng có sẵn
        if (i === 0 || /\s/.test(lastChar)) {
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

    let capitalizeNextLetter = true; // Cờ ghi nhớ: true = cần viết hoa chữ cái tiếp theo

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode;
      let text = node.nodeValue;

      // Nếu cờ đang bật và chúng ta tìm thấy một chữ cái trong node này...
      if (capitalizeNextLetter && /\p{L}/u.test(text)) {
        // ...thì viết hoa chữ cái đầu tiên tìm thấy.
        text = text.replace(/\p{L}/u, (letter) => letter.toUpperCase());
        // Và tắt cờ đi vì đã hoàn thành nhiệm vụ.
        capitalizeNextLetter = false;
      }

      // Xử lý riêng các câu bắt đầu và kết thúc bên trong cùng một node.
      text = text.replace(/([.!?:]\s*)(\p{L})/ug, (_, punctuationAndSpace, letter) => `${punctuationAndSpace}${letter.toUpperCase()}`);

      // Cập nhật lại giá trị cho node
      node.nodeValue = text;

      // Cuối cùng, cập nhật cờ cho node tiếp theo.
      // Cờ sẽ được bật lên nếu node hiện tại kết thúc bằng dấu câu.
      const trimmedText = text.trim();
      if (trimmedText.length > 0 && /[“.!?]$/.test(trimmedText)) {
        capitalizeNextLetter = true;
      }
    }
    return `<p>${tempDiv.innerHTML}</p>`;
  }).filter(Boolean);

  DOMElements.outputPanel.innerHTML = translatedLineHtmls.join('');
  temporaryNameDictionary.clear();
}