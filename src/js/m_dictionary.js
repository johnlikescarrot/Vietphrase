const HAN_VIET_DICT_NAME = 'PhienAm';
const DICTIONARY_FILES = [
  {
    id: 'Names2',
    names: ['Names2.txt', 'Name2.txt', 'Names3.txt', 'Name3.txt'],
    priority: 20
  },
  {
    id: 'Names',
    names: ['Names.txt', 'Name.txt'],
    priority: 21
  },
  {
    id: 'LuatNhan',
    names: ['LuatNhan.txt', 'Luat Nhan.txt'],
    priority: 30,
    style: 'LuatNhan-Style'
  },
  {
    id: 'Vietphrase',
    names: ['Vietphrase.txt', 'VP.txt', 'VietPhrase_hadesloki.txt'],
    priority: 40
  },
  {
    id: 'Chapter',
    names: ['Chapter.txt', 'X_Chapter.txt', 'Vietphrase_Chapter.txt'],
    priority: 41
  },
  {
    id: 'Number',
    names: ['Number.txt', 'X_Number.txt', 'Vietphrase_Number.txt'],
    priority: 42
  },
  {
    id: 'Pronouns',
    names: ['Pronouns.txt', 'DaiTu.txt', 'DaiTuNhanXung.txt', 'dai-tu-nhan-xung.txt'],
    priority: 50
  },
  {
    id: 'PhienAm',
    names: ['ChinesePhienAmWords.txt', 'PhienAm.txt', 'HanViet.txt', 'HV.txt'],
    priority: 60
  },
  {
    id: 'English',
    names: ['English.txt', 'Babylon.txt'],
    priority: 98
  },
  {
    id: 'Blacklist',
    names: ['IgnoredChinesePhrases.txt', 'IgnoreList.txt', 'Blacklist.txt'],
    priority: 99,
    style: 'Blacklist-Style'
  }
];

const REQUIRED_FILES = [
  'Vietphrase',
  HAN_VIET_DICT_NAME,
  'Names',
];

// --- INDEXEDDB ---
const DB_NAME = 'VietphraseDB';
const STORE_NAME = 'dictionaryStore';

function serializeDictionaries(dictionaries) {
  const serializable = [];
  for (const [name, data] of dictionaries.entries()) {
    serializable.push([name, {
      priority: data.priority,
      dict: Array.from(data.dict.entries())
    }]);
  }
  return serializable;
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onerror = () => reject("Lỗi khi mở IndexedDB.");
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function saveDataToDB(db, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data);
    request.onerror = () => reject("Không thể lưu dữ liệu vào DB.");
    request.onsuccess = () => resolve();
  });
}

async function getDataFromDB(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject("Không thể đọc dữ liệu từ DB.");
    request.onsuccess = () => resolve(request.result);
  });
}

export async function clearAllDictionaries() {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject('Không thể xóa dữ liệu.');
    } catch (error) {
      reject(error);
    }
  });
}

export async function initializeDictionaries() {
  try {
    const db = await openDB();
    const cachedData = await getDataFromDB(db, 'parsed-dictionaries');
    if (cachedData) {
      const dictionaries = new Map();
      cachedData.data.forEach(([name, data]) => {
        dictionaries.set(name, {
          priority: data.priority,
          dict: new Map(data.dict)
        });
      });
      console.log('Tải từ điển từ IndexedDB thành công.');
      return dictionaries;
    }
    console.log('Không tìm thấy từ điển đã lưu.');
    return null;
  } catch (error) {
    console.error("Lỗi khởi tạo từ điển:", error);
    return null;
  }
}

export async function loadDictionariesFromServer(logHandler) {
  return new Promise(async (resolve, reject) => {
    const filesContent = [];
    for (const fileInfo of DICTIONARY_FILES) {
      const pNames = Array.isArray(fileInfo.names) ? fileInfo.names : [fileInfo.name];
      let response = null, foundName = null;
      for (const pName of pNames) {
        if (!pName) continue;
        try {
          const res = await fetch(`data/${pName}`);
          if (res.ok) { response = res; foundName = pName; break; }
        } catch (e) { /* ignore */ }
      }
      const loadingLi = logHandler.append(`Đang tải ${fileInfo.id}...`, 'loading');
      if (response && response.ok) {
        const content = await response.text();
        filesContent.push({ content, fileInfo });
        logHandler.update(loadingLi, `Đã tải xong: ${foundName}`, 'success');
      } else {
        logHandler.update(loadingLi, `Không tìm thấy ${fileInfo.id} trên server.`, 'info');
      }
    }

    const worker = new Worker('src/js/m_dictionary-worker.js', { type: 'module' });
    const processingLi = logHandler.append('Đang xử lý và xây dựng từ điển (có thể mất vài phút)...', 'loading');

    // Chỉ gửi nội dung file, không cần gửi từ điển hiện tại nữa
    worker.postMessage({ filesContent });

    worker.onmessage = async (e) => {
      if (e.data.status === 'error') {
        logHandler.update(processingLi, `Lỗi Worker: ${e.data.error}`, 'error');
        worker.terminate();
        return reject(new Error(e.data.error));
      }

      if (e.data.status === 'success') {
        logHandler.update(processingLi, 'Xử lý và lưu trữ hoàn tất.', 'success');

        // Tải lại dữ liệu mới nhất từ CSDL 
        const finalLi = logHandler.append('Đang nạp từ điển vào ứng dụng...', 'loading');
        const newDictionaries = await initializeDictionaries();
        logHandler.update(finalLi, 'Đã nạp xong.', 'success');

        worker.terminate();
        logHandler.append('Quá trình hoàn tất.', 'complete');
        resolve(newDictionaries);
      }
    };

    worker.onerror = (error) => {
      logHandler.update(processingLi, `Lỗi nghiêm trọng: ${error.message || 'Worker gặp sự cố không xác định.'}`, 'error');
      worker.terminate();
      reject(error);
    };
  });
}

export async function loadDictionariesFromFile(files, currentDictionaries, logHandler) {
  return new Promise(async (resolve, reject) => {
    const filesToProcess = [];
    const usedActualFileNames = new Set();
    for (const fileInfo of DICTIONARY_FILES) {
      const pNames = Array.isArray(fileInfo.names) ? fileInfo.names : [fileInfo.name];
      let file = null;
      for (const pName of pNames) {
        if (!pName) continue;
        const potentialFile = Array.from(files).find(f => f.name.toLowerCase() === pName.toLowerCase() && !usedActualFileNames.has(f.name));
        if (potentialFile) { file = potentialFile; break; }
      }
      if (file) {
        usedActualFileNames.add(file.name);
        filesToProcess.push({ file, fileInfo });
      }
    }

    const filesContent = [];
    for (const item of filesToProcess) {
      const { file } = item;
      const loadingLi = logHandler.append(`Đang đọc file: ${file.name}...`, 'loading');
      try {
        const content = await file.text();
        filesContent.push({ content, fileInfo: item.fileInfo });
        logHandler.update(loadingLi, `Đã đọc xong: ${file.name}`, 'success');
      } catch (error) {
        logHandler.update(loadingLi, `Lỗi đọc file: ${file.name}`, 'error');
        return reject(error);
      }
    }

    const worker = new Worker('src/js/m_dictionary-worker.js', { type: 'module' });
    const processingLi = logHandler.append('Đang xử lý và xây dựng từ điển (có thể mất vài phút)...', 'loading');

    // Chỉ gửi nội dung file, không cần gửi từ điển hiện tại nữa
    worker.postMessage({ filesContent });

    worker.onmessage = async (e) => {
      if (e.data.status === 'error') {
        logHandler.update(processingLi, `Lỗi Worker: ${e.data.error}`, 'error');
        worker.terminate();
        return reject(new Error(e.data.error));
      }

      if (e.data.status === 'success') {
        logHandler.update(processingLi, 'Xử lý và lưu trữ hoàn tất.', 'success');

        // Tải lại dữ liệu mới nhất từ CSDL
        const finalLi = logHandler.append('Đang nạp từ điển vào ứng dụng...', 'loading');
        const newDictionaries = await initializeDictionaries();
        logHandler.update(finalLi, 'Đã nạp xong.', 'success');

        worker.terminate();
        logHandler.append('Quá trình hoàn tất.', 'complete');
        resolve(newDictionaries);
      }
    };

    worker.onerror = (error) => {
      logHandler.update(processingLi, `Lỗi nghiêm trọng: ${error.message || 'Worker gặp sự cố không xác định.'}`, 'error');
      worker.terminate();
      reject(error);
    };
  });
}

export async function loadSingleDictionaryFromFile(file, dictionaryId, currentDictionaries, logHandler) {
  return new Promise(async (resolve, reject) => {
    const loadingLi = logHandler.append(`Đang đọc file: ${file.name}...`, 'loading');
    let fileContent;
    try {
      fileContent = await file.text();
      logHandler.update(loadingLi, `Đã đọc xong: ${file.name}`, 'success');
    } catch (error) {
      logHandler.update(loadingLi, `Lỗi đọc file: ${file.name}`, 'error');
      return reject(error);
    }

    const fileInfo = DICTIONARY_FILES.find(f => f.id === dictionaryId);
    if (!fileInfo) {
      return reject(new Error(`Không tìm thấy cấu hình cho: ${dictionaryId}`));
    }

    const worker = new Worker('src/js/m_dictionary-worker.js', { type: 'module' });
    const processingLi = logHandler.append(`Đang xử lý và lưu ${dictionaryId} (có thể mất vài phút)...`, 'loading');

    // Chỉ gửi nội dung file và thông tin file
    worker.postMessage({
      filesContent: [{ content: fileContent, fileInfo }],
    });

    worker.onmessage = async (e) => {
      if (e.data.status === 'error') {
        logHandler.update(processingLi, `Lỗi Worker: ${e.data.error}`, 'error');
        worker.terminate();
        return reject(new Error(e.data.error));
      }

      if (e.data.status === 'success') {
        logHandler.update(processingLi, `Đã xử lý và lưu xong ${dictionaryId}.`, 'success');

        // Tải lại toàn bộ dữ liệu mới nhất từ CSDL
        const finalLi = logHandler.append('Đang nạp lại từ điển vào ứng dụng...', 'loading');
        const newDictionaries = await initializeDictionaries();
        logHandler.update(finalLi, 'Đã nạp xong.', 'success');

        worker.terminate();
        logHandler.append('Quá trình hoàn tất.', 'complete');
        resolve(newDictionaries);
      }
    };

    worker.onerror = (error) => {
      logHandler.update(processingLi, `Lỗi nghiêm trọng: ${error.message || 'Worker gặp sự cố không xác định.'}`, 'error');
      worker.terminate();
      reject(error);
    };
  });
}

export function getTranslationFromPrioritizedDicts(word, dictionaries, nameDict) {
  if (!dictionaries) return null;
  const sortedDicts = [...dictionaries.values()].sort((a, b) => a.priority - b.priority);
  for (const dictInfo of sortedDicts) {
    if (dictInfo.dict.has(word)) return dictInfo.dict.get(word);
  }
  return null;
}

export function getHanViet(word, dictionaries) {
  if (!dictionaries) return null;
  const hanVietDict = dictionaries.get(HAN_VIET_DICT_NAME)?.dict;
  if (!word || !hanVietDict) {
    return null;
  }
  const getSingleCharHanViet = (char) => {
    if (hanVietDict.has(char)) {
      return hanVietDict.get(char).split('/')[0].split(';')[0].trim();
    }
    return '';
  };
  const tokens = word.match(/[\u4e00-\u9fa5]+|[^\u4e00-\u9fa5]+/g) || [];
  const translatedTokens = tokens.map(token => {
    if (/[\u4e00-\u9fa5]/.test(token)) {
      return [...token].map(getSingleCharHanViet).filter(Boolean).join(' ');
    } else {
      return token;
    }
  });
  return translatedTokens.join(' ');
}

export function segmentText(text, masterKeySet) {
  if (!masterKeySet) return [text];
  const segments = [];
  let currentIndex = 0;
  const textLength = text.length;
  const maxLen = 10;

  while (currentIndex < textLength) {
    if (!/[\u4e00-\u9fa5]/.test(text[currentIndex])) {
      let nonChineseBlock = '';
      let i = currentIndex;
      while (i < textLength && !/[\u4e00-\u9fa5]/.test(text[i])) {
        nonChineseBlock += text[i];
        i++;
      }
      segments.push(nonChineseBlock);
      currentIndex += nonChineseBlock.length;
      continue;
    }

    let foundWord = null;
    for (let len = Math.min(maxLen, textLength - currentIndex); len > 0; len--) {
      const potentialWord = text.substr(currentIndex, len);
      if (masterKeySet.has(potentialWord)) {
        foundWord = potentialWord;
        break;
      }
    }

    if (foundWord) {
      segments.push(foundWord);
      currentIndex += foundWord.length;
    } else {
      segments.push(text[currentIndex]);
      currentIndex++;
    }
  }
  return segments;
}

export function translateWord(word, dictionaries, nameDict, tempDict, getAllMeanings) {
  let meaningsStr;
  let found = false;
  let fromUserDict = false;

  if (tempDict.has(word)) {
    meaningsStr = tempDict.get(word);
    found = true;
    fromUserDict = true;
  } else if (nameDict.has(word)) {
    meaningsStr = nameDict.get(word);
    found = true;
    fromUserDict = true;
  } else {
    meaningsStr = getTranslationFromPrioritizedDicts(word, dictionaries);
    if (meaningsStr !== null && typeof meaningsStr !== 'undefined') {
      found = true;
    }
  }

  if (!found) {
    return { best: word, all: [], found: false };
  }

  const allMeaningsRaw = meaningsStr.split(';').flatMap(m => m.split('/')).map(m => m.trim());
  const allMeaningsFlat = fromUserDict ? allMeaningsRaw : allMeaningsRaw.filter(Boolean);
  if (allMeaningsFlat.length === 0 && !fromUserDict) {
    return { best: word, all: [], found: false };
  }

  const bestMeaning = allMeaningsFlat[0] ?? '';

  return { best: bestMeaning, all: allMeaningsFlat, found: true };
}

export function getAllMeanings(word, dictionaries, nameDict) {
  const allMeanings = {
    name: null,       // Dành cho Name List
    names: [],        // Dành cho Names.txt
    names2: [],       // Dành cho Names2.txt
    vietphrase: [],   // Dành cho Vietphrase.txt
    chapter: [],      // Dành cho Vietphrase_Chapter.txt
    number: [],       // Dành cho Vietphrase_Number.txt
    hanviet: null,
  };

  // 1. Lấy nghĩa từ Name List (nếu có)
  if (nameDict.has(word)) {
    allMeanings.name = nameDict.get(word);
  }

  // 2. Lấy nghĩa từ Names.txt (nếu có)
  const namesDict = dictionaries.get('Names')?.dict;
  if (namesDict && namesDict.has(word)) {
    const namesMeanings = namesDict.get(word);
    allMeanings.names = namesMeanings.split(/[;/]/).map(m => m.trim()).filter(Boolean);
  }

  // 3. Lấy nghĩa từ Names2.txt (nếu có)
  const names2Dict = dictionaries.get('Names2')?.dict;
  if (names2Dict && names2Dict.has(word)) {
    const names2Meanings = names2Dict.get(word);
    allMeanings.names2 = names2Meanings.split(/[;/]/).map(m => m.trim()).filter(Boolean);
  }

  // 4. Lấy nghĩa từ Vietphrase (nếu có)
  const vpDict = dictionaries.get('Vietphrase')?.dict;
  if (vpDict && vpDict.has(word)) {
    const vpMeanings = vpDict.get(word);
    allMeanings.vietphrase = vpMeanings.split(/[;/]/).map(m => m.trim()).filter(Boolean);
  }

  // 4.1 Lấy nghĩa từ Vietphrase_Chapter (nếu có)
  const chapterDict = dictionaries.get('Chapter')?.dict;
  if (chapterDict && chapterDict.has(word)) {
    const chapterMeanings = chapterDict.get(word);
    allMeanings.chapter = chapterMeanings.split(/[;/]/).map(m => m.trim()).filter(Boolean);
  }

  // 4.2 Lấy nghĩa từ Vietphrase_Number (nếu có)
  const numberDict = dictionaries.get('Number')?.dict;
  if (numberDict && numberDict.has(word)) {
    const numberMeanings = numberDict.get(word);
    allMeanings.number = numberMeanings.split(/[;/]/).map(m => m.trim()).filter(Boolean);
  }

  // 5. Lấy nghĩa Hán Việt
  allMeanings.hanviet = getHanViet(word, dictionaries);

  return allMeanings;
}