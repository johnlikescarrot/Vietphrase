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
      // Luôn cố gắng dịch phần bên trong {0}
      const translationResult = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);

      // Nếu dịch được thì dùng kết quả, không thì dùng lại chính chữ Hán gốc
      const translatedCapturedWord = translationResult.found ? translationResult.best : capturedWord;

      // Áp dụng luật với phần đã được dịch
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
  const segments = segmentText(text, state.masterKeySet);
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
  const MAX_SUGGESTIONS = 15;
  const finalSuggestions = uniqueCombinations.slice(0, MAX_SUGGESTIONS);
  translationCache.set(text, finalSuggestions);
  return finalSuggestions;
}

export function performTranslation(state, options = {}) {
  console.clear(); // Xóa log cũ

  if (!state || !state.dictionaries || !state.dictionaryTrie) {
    DOMElements.outputPanel.textContent = 'Lỗi: Từ điển chưa được tải hoặc xử lý.';
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

  // LỚP 1: TÁCH TẤT CẢ CÁC TỪ ĐIỂN NAME RA XỬ LÝ RIÊNG BẰNG PLACEHOLDER
  let processedText = standardizedText;
  const placeholders = new Map();
  let placeholderId = 0;

  // Lấy từ điển Names và Names2 từ state, nếu không có thì tạo Map rỗng để tránh lỗi
  const namesDict = state.dictionaries.get('Names')?.dict || new Map();
  const names2Dict = state.dictionaries.get('Names2')?.dict || new Map();

  // Hợp nhất tất cả các từ điển name theo thứ tự ưu tiên:
  // Names -> Names2 -> NameList (nameDictionary).
  // Mục được thêm sau sẽ ghi đè lên mục trước đó nếu có key (chữ Hán) trùng lặp.
  const combinedNameMap = new Map([
    ...namesDict.entries(),
    ...names2Dict.entries(),
    ...nameDictionary.entries() // nameDictionary là Name List của người dùng, có ưu tiên cao nhất
  ]);

  // Sắp xếp các key (chữ Hán) đã hợp nhất theo độ dài giảm dần.
  // Điều này cực kỳ quan trọng để ưu tiên khớp các cụm từ dài trước (ví dụ: "Lý Phù Trần" trước "Lý Phù").
  const sortedCombinedKeys = [...combinedNameMap.keys()].sort((a, b) => b.length - a.length);

  // Bắt đầu quá trình "đục lỗ" với danh sách key đã được hợp nhất và sắp xếp
  for (const nameKey of sortedCombinedKeys) {
    if (processedText.includes(nameKey)) {
      const placeholder = `%%NAME_${placeholderId}%%`;
      // Lấy nghĩa từ Map đã hợp nhất (đã chứa sẵn nghĩa đúng theo độ ưu tiên)
      const nameValue = combinedNameMap.get(nameKey);
      placeholders.set(placeholder, { original: nameKey, translation: nameValue });
      const escapedKey = escapeRegExp(nameKey);
      processedText = processedText.replace(new RegExp(escapedKey, 'g'), placeholder);
      placeholderId++;
    }
  }

  // LỚP 1.5: ÁP DỤNG LUẬT NHÂN TRƯỚC KHI DỊCH
  processedText = applyLuatNhan(processedText, state);

  // LỚP 2: DỊCH PHẦN VĂN BẢN CÒN LẠI VÀ XỬ LÝ LOGIC VIẾT HOA
  const isVietphraseMode = DOMElements.modeToggle.checked;
  const UNAMBIGUOUS_OPENING = new Set(['(', '[', '{', '“', '‘']);
  const UNAMBIGUOUS_CLOSING = new Set([')', ']', '}', '”', '’', ',', '.', '!', '?', ';', ':', '。', '：', '；', '，', '、', '！', '？', '……', '～']);
  const AMBIGUOUS_QUOTES = new Set(['"', "'"]);
  const ALL_PUNCTUATION = new Set([...UNAMBIGUOUS_OPENING, ...UNAMBIGUOUS_CLOSING, ...AMBIGUOUS_QUOTES]);
  const lines = processedText.split('\n');
  const translatedLineHtmls = lines.map(line => {
    if (line.trim() === '') return null;
    let isInsideDoubleQuote = false;
    let isInsideSingleQuote = false;
    let capitalizeNextWord = false; // DÙNG CSS trong thẻ p text-transform: capitalize;
    let lineHtml = '';
    let lastChar = '';
    let i = 0;
    while (i < line.length) {
      const placeholderMatch = line.substring(i).match(/^%%NAME_\d+%%/);
      if (placeholderMatch) {
        const placeholder = placeholderMatch[0];
        let leadingSpace = ' ';
        if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || i === 0 || /\s/.test(lastChar)) {
          leadingSpace = '';
        }
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = placeholder;
        if (capitalizeNextWord) {
          span.dataset.capitalize = 'true';
          capitalizeNextWord = false;
        }
        span.textContent = placeholder;
        lineHtml += leadingSpace + span.outerHTML;
        i += placeholder.length;
        lastChar = placeholder.slice(-1);
        continue;
      }
      let bestMatch = null;
      if (temporaryNameDictionary.size > 0) {
        let longestKey = '';
        for (const [key] of temporaryNameDictionary.entries()) {
          if (line.startsWith(key, i) && key.length > longestKey.length) longestKey = key;
        }
        if (longestKey) bestMatch = { key: longestKey, value: { translation: temporaryNameDictionary.get(longestKey), type: 'temp' } };
      }

      if (!bestMatch) {
        // Bước 1: Tìm TẤT CẢ các từ có thể khớp, từ ngắn đến dài
        const allMatches = state.dictionaryTrie.findAllMatches(line, i);
        if (allMatches.length > 0) {
          // Bước 2: Tạm thời chọn từ dài nhất làm ứng cử viên
          let bestChoice = allMatches[allMatches.length - 1];

          // Bước 3: Nếu có nhiều hơn 1 lựa chọn (ví dụ: '在' và '在劫')
          if (allMatches.length > 1) {
            const longestMatch = bestChoice;

            // Lặp qua các lựa chọn NGẮN HƠN để xem có lựa chọn nào tốt hơn không
            for (const currentMatch of allMatches) {
              if (currentMatch.key.length >= longestMatch.key.length) continue;

              const next_i = i + currentMatch.key.length;
              if (next_i >= line.length) continue;

              // Bước 4: "Nhìn về phía trước" để xem từ tiếp theo sẽ là gì
              const nextMatch = state.dictionaryTrie.findLongestMatch(line, next_i);

              // Bước 5: So sánh và đưa ra quyết định thông minh
              // Điều kiện quan trọng:
              // Chỉ chọn từ ngắn hơn ('在') KHI VÀ CHỈ KHI
              // từ tiếp theo nó tìm được ('劫云中') dài hơn hẳn từ dài nhất ban đầu ('在劫').
              // Điều này tránh việc phá vỡ các từ bình thường như '词语'.
              if (nextMatch && nextMatch.key.length > longestMatch.key.length) {
                bestChoice = currentMatch; // Tìm thấy một phương án tốt hơn
                break; // Dừng lại và chọn phương án này
              }
            }
          }
          bestMatch = bestChoice;
        }
      }
      if (bestMatch) {
        const { key: originalWord, value } = bestMatch;

        if (value.type === 'Blacklist' || value.translation === '') {
          // Tạo một span ẩn để giữ lại data-original
          const span = document.createElement('span');
          span.className = 'word blacklisted-word'; // Thêm class để nhận biết nếu cần

          // Quan trọng: Giữ lại chữ Hán gốc để các bảng dịch có thể lấy được
          span.dataset.original = originalWord;

          // Quan trọng: Không hiển thị chữ này ra kết quả dịch
          span.textContent = '';

          lineHtml += span.outerHTML; // Thêm thẻ ẩn vào kết quả
          lastChar = originalWord.slice(-1);
          i += originalWord.length;
          continue; // Tiếp tục vòng lặp
        }

        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = originalWord;
        let textForSpan = !translationResult.found ? '' : (isVietphraseMode ? `(${translationResult.all.join('/')})` : translationResult.best);
        if (!translationResult.found) span.classList.add('untranslatable');
        if (isVietphraseMode && translationResult.found) span.classList.add('vietphrase-word');
        if (capitalizeNextWord && /\p{L}/u.test(textForSpan)) {
          textForSpan = textForSpan.charAt(0).toUpperCase() + textForSpan.slice(1);
          capitalizeNextWord = false;
        }
        span.textContent = textForSpan;
        if (textForSpan.trim() === '') { leadingSpace = ''; }
        const trimmedText = textForSpan.trim();
        if (/[.!?]$/.test(trimmedText)) {
          capitalizeNextWord = true;
        }
        let leadingSpace = ' ';
        const firstChar = originalWord.charAt(0);
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";
          // CHỈ kích hoạt viết hoa nếu KÝ TỰ LÀ MỘT DẤU NGOẶC KÉP DUY NHẤT
          if (originalWord.length === 1) {
            if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
              capitalizeNextWord = true;
            }
          }
          // Logic còn lại để xử lý khoảng trắng và trạng thái vẫn giữ nguyên
          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            if (UNAMBIGUOUS_OPENING.has(lastChar)) leadingSpace = '';
          } else {
            leadingSpace = '';
          }
          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;
        } else {
          if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }
        if (i === 0 || /\s/.test(lastChar)) leadingSpace = '';
        lineHtml += leadingSpace + span.outerHTML;
        lastChar = originalWord.slice(-1);
        i += originalWord.length;
      } else {
        const currentChar = line[i];
        let nonMatchEnd = i + 1;
        if (!ALL_PUNCTUATION.has(currentChar)) {
          while (nonMatchEnd < line.length) {
            if (line.substring(nonMatchEnd).match(/^%%NAME_\d+%%/)) break;
            let isKnownWordAhead = false;
            if (temporaryNameDictionary.size > 0) {
              for (const key of temporaryNameDictionary.keys()) {
                if (line.startsWith(key, nonMatchEnd)) { isKnownWordAhead = true; break; }
              }
            }
            if (!isKnownWordAhead && state.dictionaryTrie.findLongestMatch(line, nonMatchEnd)) isKnownWordAhead = true;
            if (isKnownWordAhead || (nonMatchEnd < line.length && ALL_PUNCTUATION.has(line[nonMatchEnd]))) break;
            nonMatchEnd++;
          }
        }
        const nonMatchBlock = line.substring(i, nonMatchEnd);

        // Giữ lại data-original để các bảng Dịch nhanh/Chỉnh sửa name không bị mất chữ,
        // nhưng không hiển thị chữ đó ra kết quả dịch cuối cùng.
        if (/^[\u4e00-\u9fa5]+$/.test(nonMatchBlock)) {
          const span = document.createElement('span');
          span.className = 'word untranslatable';
          span.dataset.original = nonMatchBlock;
          span.textContent = ''; // Quan trọng: không hiển thị ra kết quả
          lineHtml += span.outerHTML;
          lastChar = nonMatchBlock.slice(-1);
          i = nonMatchEnd;
          continue;
        }

        let textForSpan = nonMatchBlock;
        if (capitalizeNextWord && /\p{L}/u.test(textForSpan)) {
          textForSpan = textForSpan.charAt(0).toUpperCase() + textForSpan.slice(1);
          capitalizeNextWord = false;
        }
        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = nonMatchBlock;
        span.textContent = textForSpan;
        const trimmedText = textForSpan.trim();
        if (/[.!?]$/.test(trimmedText)) {
          capitalizeNextWord = true;
        }
        let leadingSpace = ' ';
        const firstChar = nonMatchBlock.charAt(0);
        if (AMBIGUOUS_QUOTES.has(firstChar)) {
          const isDouble = firstChar === '"';
          const isSingle = firstChar === "'";
          // CHỈ kích hoạt viết hoa nếu TỪ GỐC LÀ MỘT DẤU NGOẶC KÉP DUY NHẤT
          if (nonMatchBlock.length === 1) {
            if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
              capitalizeNextWord = true;
            }
          }
          // Logic còn lại để xử lý khoảng trắng và trạng thái vẫn giữ nguyên
          if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
            if (UNAMBIGUOUS_OPENING.has(lastChar)) leadingSpace = '';
          } else {
            leadingSpace = '';
          }
          if (isDouble) isInsideDoubleQuote = !isInsideDoubleQuote;
          if (isSingle) isInsideSingleQuote = !isInsideSingleQuote;
        } else {
          if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || UNAMBIGUOUS_CLOSING.has(firstChar)) {
            leadingSpace = '';
          }
        }
        if (i === 0 || /\s/.test(lastChar)) leadingSpace = '';
        lineHtml += leadingSpace + span.outerHTML;
        lastChar = nonMatchBlock.slice(-1);
        i = nonMatchEnd;
      }
    }
    return `<p>${lineHtml.trim()}</p>`;
  }).filter(Boolean);

  // LỚP 3: THAY THẾ PLACEHOLDER VÀ VIẾT HOA ĐẦU DÒNG
  let finalHtml = translatedLineHtmls.join('');
  for (const [placeholder, data] of placeholders.entries()) {
    const spanRegex = new RegExp(`(<span class="word" data-original="${escapeRegExp(placeholder)}"[^>]*>)${escapeRegExp(placeholder)}(</span>)`, 'g');
    finalHtml = finalHtml.replace(spanRegex, (match, openingTag) => {
      let translation = data.translation;
      if (openingTag.includes('data-capitalize="true"')) {
        if (translation) translation = translation.charAt(0).toUpperCase() + translation.slice(1);
      }
      return `<span class="word from-name-dict" data-original="${data.original}">${translation}</span>`;
    });
  }
  const finalContainer = document.createElement('div');
  finalContainer.innerHTML = finalHtml;

  DOMElements.outputPanel.innerHTML = finalContainer.innerHTML;
  if (!options.preserveTempDict) {
    temporaryNameDictionary.clear();
  }
}