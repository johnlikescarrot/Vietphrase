// CẤU TRÚC DỮ LIỆU TRIE ĐỂ TĂNG TỐC TÌM KIẾM
class TrieNode {
  constructor() {
    this.children = {};
    this.value = null;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(key, value, overwrite = false) {
    let node = this.root;
    for (const char of key) {
      if (!node.children[char]) {
        node.children[char] = new TrieNode();
      }
      node = node.children[char];
    }
    if (overwrite || node.value === null) {
      node.value = value;
    }
  }

  findLongestMatch(text, startIndex) {
    let node = this.root;
    let longestMatch = null;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (!node.children[char]) {
        break;
      }
      node = node.children[char];
      if (node.value !== null) {
        longestMatch = {
          key: text.substring(startIndex, i + 1),
          value: node.value,
        };
      }
    }
    return longestMatch;
  }
}

import DOMElements from './m_dom.js';
import { customConfirm } from './m_dialog.js';
import { performTranslation } from './m_translation.js';
import { standardizeDictionaryLine } from './m_preprocessor.js';

export let nameDictionary = new Map();
export let temporaryNameDictionary = new Map();

function renderSortedNameList(sortType = 'newest') {
  if (nameDictionary.size === 0) {
    DOMElements.nameListTextarea.value = '';
    return;
  }

  let sortedEntries;
  const entries = Array.from(nameDictionary.entries());

  switch (sortType) {
    case 'oldest':
      sortedEntries = entries.reverse();
      break;
    case 'vn-az':
      sortedEntries = entries.sort((a, b) => a[1].localeCompare(b[1], 'vi'));
      break;
    case 'vn-za':
      sortedEntries = entries.sort((a, b) => b[1].localeCompare(a[1], 'vi'));
      break;
    case 'cn-az':
      sortedEntries = entries.sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));
      break;
    case 'cn-za':
      sortedEntries = entries.sort((a, b) => b[0].localeCompare(a[0], 'zh-CN'));
      break;
    case 'newest':
    default:
      sortedEntries = entries;
      break;
  }

  const text = sortedEntries.map(([cn, vn]) => `${cn}=${vn}`).join('\n');
  DOMElements.nameListTextarea.value = text;
}

export function initializeNameList(state) {
  loadNameDictionaryFromStorage();
  renderNameList();
  rebuildMasterData(state);

  const sortBtn = document.getElementById('name-list-sort-btn');
  const sortDropdown = document.getElementById('name-list-sort-dropdown');

  sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sortDropdown.classList.toggle('hidden');
  });

  document.querySelectorAll('.sort-option').forEach(button => {
    button.addEventListener('click', () => {
      const sortType = button.dataset.sort;
      renderSortedNameList(sortType);
      sortDropdown.classList.add('hidden');
    });
  });

  document.addEventListener('click', (e) => {
    if (!sortBtn.contains(e.target) && !sortDropdown.contains(e.target)) {
      sortDropdown.classList.add('hidden');
    }
  });

  DOMElements.nameListSaveBtn.addEventListener('click', () => {
    const rawText = DOMElements.nameListTextarea.value;
    // Chuẩn hóa từng dòng trong Name List trước khi parse và lưu
    const standardizedText = rawText
      .split(/\r?\n/)
      .map(standardizeDictionaryLine)
      .join('\n');

    // Gán lại giá trị đã chuẩn hóa vào ô textarea để người dùng thấy
    DOMElements.nameListTextarea.value = standardizedText;

    nameDictionary = parseDictionary(standardizedText);

    saveNameDictionaryToStorage();
    rebuildMasterData(state);

    const originalText = DOMElements.nameListSaveBtn.textContent;
    DOMElements.nameListSaveBtn.textContent = 'Đã lưu!';
    DOMElements.nameListSaveBtn.disabled = true;
    setTimeout(() => {
      DOMElements.nameListSaveBtn.textContent = originalText;

      DOMElements.nameListSaveBtn.disabled = false;
    }, 1500);
    performTranslation(state, { forceText: state.lastTranslatedText });
  });
  DOMElements.nameListDeleteBtn.addEventListener('click', async () => {
    if (await customConfirm('Bạn có chắc muốn xóa toàn bộ Bảng Thuật Ngữ? Hành động này không thể hoàn tác.')) {
      nameDictionary.clear();
      saveNameDictionaryToStorage();
      renderNameList();
      rebuildMasterData(state);
      performTranslation(state, { forceText: state.lastTranslatedText });
    }

  });

  DOMElements.nameListExportBtn.addEventListener('click', () => {
    const text = DOMElements.nameListTextarea.value;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'NameList.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  DOMElements.nameListImportBtn.addEventListener('click', () => DOMElements.nameListFileInput.click());
  DOMElements.nameListFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        DOMElements.nameListTextarea.value = event.target.result;
        DOMElements.nameListSaveBtn.click();

      };
      reader.readAsText(file);
    }
  });
}

function parseDictionary(text) {
  const dictionary = new Map();
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    if (line.startsWith('#') || line.trim() === '') return;
    const parts = line.split('=');
    if (parts.length >= 2) {
      let key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (key.startsWith('$')) {
        // Nếu có, loại bỏ ký tự '$' ở đầu đi
        key = key.substring(1).trim();
      }

      if (key) {
        dictionary.set(key, value);
      }
    }
  });
  return dictionary;
}

export function renderNameList() {
  if (nameDictionary.size === 0) {
    DOMElements.nameListTextarea.value = '';
    return;
  }
  const sortedNames = [...nameDictionary.entries()];
  const text = sortedNames.map(([cn, vn]) => `${cn}=${vn}`).join('\n');
  DOMElements.nameListTextarea.value = text;
}

export function saveNameDictionaryToStorage() {
  localStorage.setItem('nameDictionary', JSON.stringify(Array.from(nameDictionary.entries())));
}

function loadNameDictionaryFromStorage() {
  const stored = localStorage.getItem('nameDictionary');
  if (stored) nameDictionary = new Map(JSON.parse(stored));
}

export function rebuildMasterData(state) {
  if (!state || !state.dictionaries) {
    console.warn("rebuildMasterData được gọi nhưng từ điển chưa sẵn sàng.");
    return;
  }

  console.time('TrieBuiding'); // Bắt đầu đếm thời gian xây dựng Trie

  // 1. Xây dựng lại masterKeySet như cũ để các chức năng khác không bị ảnh hưởng
  state.masterKeySet = new Set([...nameDictionary.keys()]);
  state.dictionaries.forEach(d => {
    d.dict.forEach((_, key) => state.masterKeySet.add(key));
  });
  console.log(`Master key set rebuilt with ${state.masterKeySet.size} unique keys.`);

  // 2. Khởi tạo Trie và định nghĩa độ ưu tiên của từ điển
  const dictionaryTrie = new Trie();
  const priorityOrder = [
    'NamesUser',
    'Names2', 'Names',
    'LuatNhan',
    'Chapter', 'Number', 'Vietphrase',
    'Pronouns', 'PhienAm',
    'English',
    'Blacklist'
  ];

  const allDictionaries = new Map(state.dictionaries);

  // Thêm Name List của người dùng vào như một từ điển riêng với độ ưu tiên cao nhất (0)
  if (nameDictionary.size > 0) {
    allDictionaries.set('NamesUser', { priority: 0, dict: nameDictionary });
  }

  // 3. Nạp từ điển vào Trie theo đúng thứ tự ưu tiên
  priorityOrder.forEach(dictName => {
    const dictInfo = allDictionaries.get(dictName);
    if (dictInfo && dictInfo.dict) {
      dictInfo.dict.forEach((translation, key) => {
        dictionaryTrie.insert(key, { translation, type: dictName, ruleKey: key });
      });
    }
  });

  state.dictionaryTrie = dictionaryTrie; // Lưu Trie vào state
  console.timeEnd('TrieBuiding'); // Kết thúc đếm thời gian
}

// Hàm tối ưu chỉ để xóa một từ khỏi Trie và Set mà không cần rebuild toàn bộ
export function updateMasterDataForDeletion(cn, state) {
  if (!state || !state.masterKeySet || !state.dictionaryTrie) {
    console.warn("updateMasterDataForDeletion được gọi nhưng state chưa sẵn sàng.");
    return;
  }

  // Chỉ cần xóa khỏi Set
  state.masterKeySet.delete(cn);

  // Và "xóa" khỏi Trie bằng cách ghi đè giá trị của nó thành null.
  // Thao tác này cực kỳ nhanh so với việc build lại toàn bộ Trie.
  state.dictionaryTrie.insert(cn, null, true);
}