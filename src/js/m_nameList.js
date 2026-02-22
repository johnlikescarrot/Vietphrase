import DOMElements from './m_dom.js';
import { debounce } from './m_utils.js';
import { customConfirm } from './m_dialog.js';
import { performTranslation } from './m_translation.js';

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

export let nameDictionary = new Map();
export let temporaryNameDictionary = new Map();

export function renderNameList(sortType = 'newest') {
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

export function saveNameDictionaryToStorage() {
  try {
    localStorage.setItem('nameDictionary', JSON.stringify(Array.from(nameDictionary.entries())));
  } catch (e) {
    console.error("Lỗi khi lưu Name List vào localStorage:", e);
  }
}

function loadNameDictionaryFromStorage() {
  const stored = localStorage.getItem('nameDictionary');
  if (stored) {
    try {
        nameDictionary = new Map(JSON.parse(stored));
    } catch (e) {
        console.error("Lỗi khi load Name List:", e);
        nameDictionary = new Map();
    }
  }
}

export function initializeNameList(state) {
  loadNameDictionaryFromStorage();
  renderNameList();
  rebuildMasterData(state);

  const sortBtn = document.getElementById('name-list-sort-btn');
  const sortDropdown = document.getElementById('name-list-sort-dropdown');

  if (sortBtn && sortDropdown) {
      sortBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sortDropdown.classList.toggle('hidden');
      });

      document.addEventListener('click', () => {
        sortDropdown.classList.add('hidden');
      });

      sortDropdown.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', () => {
          renderNameList(option.dataset.sort);
          sortDropdown.classList.add('hidden');
        });
      });
  }

  DOMElements.nameListSaveBtn.addEventListener('click', () => {
    const text = DOMElements.nameListTextarea.value;
    const newDict = new Map();
    text.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        newDict.set(parts[0].trim(), parts.slice(1).join("=").trim());
      }
    });
    nameDictionary = newDict;
    saveNameDictionaryToStorage();
    rebuildMasterData(state);
    performTranslation(state, { forceText: state.lastTranslatedText });

    const originalText = DOMElements.nameListSaveBtn.textContent;
    DOMElements.nameListSaveBtn.textContent = 'Đã lưu!';
    DOMElements.nameListSaveBtn.disabled = true;
    setTimeout(() => {
      DOMElements.nameListSaveBtn.textContent = originalText;
      DOMElements.nameListSaveBtn.disabled = false;
    }, 1500);
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
    const text = Array.from(nameDictionary.entries()).map(([cn, vn]) => `${cn}=${vn}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NamesUser.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });

  DOMElements.nameListImportBtn.addEventListener('click', () => {
    DOMElements.nameListFileInput.click();
  });

  DOMElements.nameListFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      text.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          nameDictionary.set(parts[0].trim(), parts.slice(1).join("=").trim());
        }
      });
      saveNameDictionaryToStorage();
      renderNameList();
      rebuildMasterData(state);
      performTranslation(state, { forceText: state.lastTranslatedText });
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

export const debouncedRebuildMasterData = debounce((state) => rebuildMasterData(state), 100);

export function rebuildMasterData(state) {
  if (!state || !state.dictionaries) return;

  state.masterKeySet = new Set([...nameDictionary.keys()]);
  state.dictionaries.forEach(d => {
    d.dict.forEach((_, key) => state.masterKeySet.add(key));
  });

  const dictionaryTrie = new Trie();
  const priorityOrder = [
    'NamesUser', 'Names2', 'Names', 'LuatNhan', 'Vietphrase',
    'Chapter', 'Number', 'Pronouns', 'PhienAm', 'English', 'Blacklist'
  ];

  const allDictionaries = new Map(state.dictionaries);
  if (nameDictionary.size > 0) {
    allDictionaries.set('NamesUser', { priority: 0, dict: nameDictionary });
  }

  priorityOrder.forEach(dictName => {
    const dictInfo = allDictionaries.get(dictName);
    if (dictInfo && dictInfo.dict) {
      dictInfo.dict.forEach((translation, key) => {
        dictionaryTrie.insert(key, { translation, type: dictName, ruleKey: key });
      });
    }
  });

  state.dictionaryTrie = dictionaryTrie;
}

export function updateMasterDataForDeletion(cn, state) {
  if (!state || !state.masterKeySet || !state.dictionaryTrie) return;
  state.masterKeySet.delete(cn);
  state.dictionaryTrie.insert(cn, null, true);
}
