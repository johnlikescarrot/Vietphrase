import DOMElements from './m_dom.js';
import { translateWord } from './m_dictionary.js';
import { nameDictionary, temporaryNameDictionary } from './m_nameList.js';
import { standardizeText } from './m_preprocessor.js';

const UNAMBIGUOUS_OPENING = new Set(['(', '[', '{', '“', '‘', '『', '「', '《', '〈', '【', '〖', '〔']);
const UNAMBIGUOUS_CLOSING = new Set([')', ']', '}', '”', '’', '』', '」', '》', '〉', '】', '〗', '〕', ',', '.', '!', '?', ';', ':', '。', '：', '；', '，', '、', '！', '？', '…', '～']);
const AMBIGUOUS_QUOTES = new Set(['"', "'"]);
const ALL_PUNCTUATION = new Set([...UNAMBIGUOUS_OPENING, ...UNAMBIGUOUS_CLOSING, ...AMBIGUOUS_QUOTES]);

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let cachedLuatNhanRules = null;
let lastLuatNhanDict = null;

function getSortedLuatNhanRules(luatNhanDict) {
  if (lastLuatNhanDict === luatNhanDict && cachedLuatNhanRules) {
    return cachedLuatNhanRules;
  }
  lastLuatNhanDict = luatNhanDict;
  cachedLuatNhanRules = [...luatNhanDict.entries()]
    .filter(([key]) => key.includes('{0}'))
    .sort((a, b) => b[0].length - a[0].length)
    .map(([key, value]) => {
      const escapedKey = escapeRegExp(key).replace('\\{0\\}', '([\u4e00-\u9fa5]+)');
      return {
        regex: new RegExp(escapedKey, 'g'),
        template: value
      };
    });
  return cachedLuatNhanRules;
}

function applyLuatNhan(text, state) {
  const luatNhanDict = state.dictionaries.get('LuatNhan')?.dict;
  if (!luatNhanDict || luatNhanDict.size === 0) return text;

  let processedText = text;
  const rules = getSortedLuatNhanRules(luatNhanDict);
  for (const { regex, template } of rules) {
    processedText = processedText.replace(regex, (match, capturedWord) => {
      const translationResult = translateWord(capturedWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
      const translatedCapturedWord = translationResult.found ? translationResult.best : capturedWord;
      return template.replaceAll('{0}', translatedCapturedWord);
    });
  }
  return processedText;
}

function applyCapitalization(text, shouldCapitalize) {
  if (!shouldCapitalize) return { text, capitalized: false };
  const trimmed = text.trim();
  if (trimmed.length > 0 && !/\d/.test(trimmed.charAt(0)) && /\p{L}/u.test(trimmed)) {
    const firstCharIdx = text.indexOf(trimmed.charAt(0));
    return {
      text: text.substring(0, firstCharIdx) + trimmed.charAt(0).toUpperCase() + trimmed.slice(firstCharIdx + 1),
      capitalized: true
    };
  }
  return { text, capitalized: trimmed.length > 0 && /\d/.test(trimmed.charAt(0)) };
}

/**
 * Processes spacing and capitalization for a translated segment.
 * Includes "Smart Spacing" logic and enhanced punctuation handling.
 */
function processSpacingAndCapitalization(params) {
  let {
    textForSpan, originalWord, i, lastChar,
    isInsideDoubleQuote, isInsideSingleQuote,
    capitalizeNextWord
  } = params;

  const trimmed = textForSpan.trim();
  const capResult = applyCapitalization(textForSpan, capitalizeNextWord);
  textForSpan = capResult.text;

  // Reset capitalization flag only if we actually processed a visible word
  let newCapitalizeNextWord = (trimmed === '') ? capitalizeNextWord : false;

  // Enhance punctuation logic: trigger capitalization after ellipses and CJK equivalents
  if (/[.!?]$/.test(trimmed) || trimmed.endsWith('…')) {
    newCapitalizeNextWord = true;
  }
  if (UNAMBIGUOUS_OPENING.has(originalWord)) newCapitalizeNextWord = true;

  let leadingSpace = ' ';
  const firstChar = originalWord.charAt(0);
  let newIsInsideDoubleQuote = isInsideDoubleQuote;
  let newIsInsideSingleQuote = isInsideSingleQuote;

  if (AMBIGUOUS_QUOTES.has(firstChar)) {
    const isDouble = firstChar === '"';
    const isSingle = firstChar === "'";
    if (originalWord.length === 1) {
      if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) newCapitalizeNextWord = true;
    }
    if ((isDouble && !isInsideDoubleQuote) || (isSingle && !isInsideSingleQuote)) {
      if (UNAMBIGUOUS_OPENING.has(lastChar)) leadingSpace = '';
    } else {
      leadingSpace = '';
    }
    if (isDouble) newIsInsideDoubleQuote = !isInsideDoubleQuote;
    if (isSingle) newIsInsideSingleQuote = !isInsideSingleQuote;
  } else {
    if (UNAMBIGUOUS_OPENING.has(lastChar) || (isInsideDoubleQuote && lastChar === '"') || (isInsideSingleQuote && lastChar === "'") || UNAMBIGUOUS_CLOSING.has(firstChar)) {
      leadingSpace = '';
    }
  }

  if (i === 0 || /\s/.test(lastChar) || textForSpan === '') leadingSpace = '';


  // Smart Spacing: Ensure spacing between segments that were joined by punctuation logic
  if (leadingSpace === '' && i > 0 && trimmed !== '') {
    const isCurrentLatinDigit = /[a-zA-Z0-9]/.test(trimmed[0]);
    const isLastLatinDigit = /[a-zA-Z0-9]/.test(lastChar);
    if (isCurrentLatinDigit && isLastLatinDigit) leadingSpace = ' ';
  }

  return {
    textForSpan,
    leadingSpace,
    capitalizeNextWord: newCapitalizeNextWord,
    isInsideDoubleQuote: newIsInsideDoubleQuote,
    isInsideSingleQuote: newIsInsideSingleQuote
  };
}

const translationCache = new Map();
export function synthesizeCompoundTranslation(text, state) {
  if (translationCache.has(text)) return translationCache.get(text);
  if (!state || !state.dictionaryTrie) return [];

  const segments = [];
  let i = 0;
  while (i < text.length) {
    const match = state.dictionaryTrie.findLongestMatch(text, i);
    if (match) {
      segments.push(match.key);
      i += match.key.length;
    } else {
      segments.push(text[i]);
      i++;
    }
  }

  if (segments.length <= 1) return [];
  if (segments.length > 7) return [`${segments.join(' ')} - Quá dài để gợi ý`];

  const segmentMeanings = segments.map(seg => {
    const translation = translateWord(seg, state.dictionaries, nameDictionary, temporaryNameDictionary);
    return translation.all.length > 0 ? translation.all : [''];
  });

  const cartesian = (...a) => a.reduce((acc, val) => acc.flatMap(d => val.map(e => [d, e].flat())));
  let combinations = [];
  try {
    combinations = cartesian(...segmentMeanings).map(combo => combo.filter(Boolean).join(' '));
  } catch (e) {
    return [`${text} - Số lượng tổ hợp quá nhiều`];
  }

  const uniqueCombinations = [...new Set(combinations)];
  const MAX_SUGGESTIONS = 100;
  const finalSuggestions = uniqueCombinations.slice(0, MAX_SUGGESTIONS);
  translationCache.set(text, finalSuggestions);
  return finalSuggestions;
}

export function performTranslation(state, options = {}) {
  if (!state || !state.dictionaries || !state.dictionaryTrie) {
    DOMElements.outputPanel.textContent = 'Lỗi: Từ điển chưa được tải hoặc xử lý.';
    return;
  }

  const textToTranslate = options.forceText ?? DOMElements.inputText.value;
  const standardizedText = standardizeText(textToTranslate);
  if (!standardizedText) {
    DOMElements.outputPanel.textContent = 'Kết quả sẽ hiện ở đây...';
    return;
  }
  if (!options.forceText) state.lastTranslatedText = standardizedText;

  let processedText = applyLuatNhan(standardizedText, state);
  const isVietphraseMode = DOMElements.modeToggle.checked;
  const lines = processedText.split('\n');

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
      if (temporaryNameDictionary.size > 0) {
        let longestKey = '';
        for (const [key] of temporaryNameDictionary.entries()) {
          if (line.startsWith(key, i) && key.length > longestKey.length) longestKey = key;
        }
        if (longestKey) bestMatch = { key: longestKey, value: { translation: temporaryNameDictionary.get(longestKey), type: 'temp' } };
      }

      if (!bestMatch) bestMatch = state.dictionaryTrie.findLongestMatch(line, i);

      if (bestMatch) {
        const { key: originalWord, value } = bestMatch;
        const isName = value.type === 'Names' || value.type === 'Names2' || value.type === 'NamesUser' || value.type === 'temp';

        if (value.type === 'Blacklist' || value.translation === '') {
          const span = document.createElement('span');
          span.className = 'word blacklisted-word';
          span.dataset.original = originalWord;
          span.textContent = '';
          lineHtml += span.outerHTML;
          lastChar = originalWord.slice(-1);
          i += originalWord.length;
          continue;
        }

        const translationResult = translateWord(originalWord, state.dictionaries, nameDictionary, temporaryNameDictionary);
        const span = document.createElement('span');
        span.className = isName ? 'word from-name-dict' : 'word';
        span.dataset.original = originalWord;

        let textForSpan = !translationResult.found ? '' : (isVietphraseMode ? `(${translationResult.all.join('/')})` : translationResult.best);
        if (!translationResult.found) span.classList.add('untranslatable');
        if (isVietphraseMode && translationResult.found) span.classList.add('vietphrase-word');

        const result = processSpacingAndCapitalization({
          textForSpan, originalWord, i, lastChar, isInsideDoubleQuote, isInsideSingleQuote, capitalizeNextWord
        });

        textForSpan = result.textForSpan;
        isInsideDoubleQuote = result.isInsideDoubleQuote;
        isInsideSingleQuote = result.isInsideSingleQuote;
        capitalizeNextWord = result.capitalizeNextWord;

        span.textContent = textForSpan;
        lineHtml += result.leadingSpace + span.outerHTML;
        lastChar = originalWord.slice(-1);
        i += originalWord.length;
      } else {
        const currentChar = line[i];
        let nonMatchEnd = i + 1;
        if (!ALL_PUNCTUATION.has(currentChar)) {
          while (nonMatchEnd < line.length) {
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
        if (/^[\u4e00-\u9fa5]+$/.test(nonMatchBlock)) {
          const span = document.createElement('span');
          span.className = 'word untranslatable';
          span.dataset.original = nonMatchBlock;
          span.textContent = '';
          lineHtml += span.outerHTML;
          lastChar = nonMatchBlock.slice(-1);
          i = nonMatchEnd;
          continue;
        }

        const result = processSpacingAndCapitalization({
          textForSpan: nonMatchBlock, originalWord: nonMatchBlock, i, lastChar, isInsideDoubleQuote, isInsideSingleQuote, capitalizeNextWord
        });

        isInsideDoubleQuote = result.isInsideDoubleQuote;
        isInsideSingleQuote = result.isInsideSingleQuote;
        capitalizeNextWord = result.capitalizeNextWord;

        const span = document.createElement('span');
        span.className = 'word';
        span.dataset.original = nonMatchBlock;
        span.textContent = result.textForSpan;
        lineHtml += result.leadingSpace + span.outerHTML;
        lastChar = nonMatchBlock.slice(-1);
        i = nonMatchEnd;
      }
    }
    return `<p>${lineHtml.trim()}</p>`;
  }).filter(Boolean);

  DOMElements.outputPanel.innerHTML = translatedLineHtmls.join('');
  if (!options.preserveTempDict) temporaryNameDictionary.clear();
}
