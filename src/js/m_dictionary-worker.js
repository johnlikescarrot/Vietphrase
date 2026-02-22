import { standardizeDictionaryLine } from './m_preprocessor.js';

/**
 * Analyze and standardize the dictionary in a single pass to save memory.
 */
function parseDictionaryOptimized(text, shouldStandardize, style = 'Style-Chung') {
  const dictionary = new Map();
  let start = 0;
  let end = text.indexOf('\n');

  while (start < text.length) {
    let line = end === -1 ? text.substring(start) : text.substring(start, end);
    // Handle \r character if present (Windows line endings)
    if (line.endsWith('\r')) line = line.slice(0, -1);

    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      let finalLine = trimmedLine;
      if (shouldStandardize) {
        finalLine = standardizeDictionaryLine(trimmedLine);
      }

      if (style === 'Blacklist-Style') {
        dictionary.set(finalLine, '');
      } else {
        const eqIdx = finalLine.indexOf('=');
        if (eqIdx !== -1) {
          const key = finalLine.substring(0, eqIdx).trim();
          const value = finalLine.substring(eqIdx + 1).trim();
          if (key) dictionary.set(key, value);
        }
      }
    }

    if (end === -1) break;
    start = end + 1;
    end = text.indexOf('\n', start);
  }
  return dictionary;
}

// --- INDEXEDDB FUNCTIONS ---
const DB_NAME = 'VietphraseDB';
const STORE_NAME = 'dictionaryStore';

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME);
      request.onerror = () => reject(new Error('Lỗi khi mở IndexedDB từ Worker. Có thể do chế độ ẩn danh.'));
      request.onsuccess = () => resolve(request.result);
    } catch (e) {
      reject(new Error('Lỗi hệ thống khi mở IndexedDB: ' + e.message));
    }
  });
}

async function saveDataToDB(db, data) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data);
    request.onerror = () => reject(new Error("Không thể lưu dữ liệu vào DB từ Worker."));
    request.onsuccess = () => resolve();
  });
}

async function getDataFromDB(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject(new Error("Không thể đọc dữ liệu từ DB từ Worker."));
    request.onsuccess = () => resolve(request.result);
  });
}

// --- WORKER LOGIC ---
self.onmessage = async function (e) {
  try {
    const { filesContent } = e.data;
    const db = await openDB();
    const cachedData = await getDataFromDB(db, 'parsed-dictionaries');
    const dictionaries = new Map();

    if (cachedData) {
      cachedData.data.forEach(([name, data]) => {
        dictionaries.set(name, {
          priority: data.priority,
          dict: new Map(data.dict)
        });
      });
    }

    const dictionariesToStandardize = new Set([
      'Names2', 'Names', 'LuatNhan', 'Vietphrase',
      'Chapter', 'Number', 'Pronouns', 'PhienAm',
      'English', 'Blacklist'
    ]);

    filesContent.forEach(item => {
      const fileInfo = item.fileInfo;
      const dictionaryId = fileInfo.id;
      const shouldStandardize = dictionariesToStandardize.has(dictionaryId);

      const newDict = parseDictionaryOptimized(item.content, shouldStandardize, fileInfo.style);
      dictionaries.set(dictionaryId, { priority: fileInfo.priority, dict: newDict });
    });

    const storableDicts = Array.from(dictionaries.entries()).map(([name, data]) => {
      return [name, {
        priority: data.priority,
        dict: Array.from(data.dict.entries())
      }];
    });

    await saveDataToDB(db, { id: 'parsed-dictionaries', data: storableDicts });
    self.postMessage({ status: 'success' });
  } catch (error) {
    self.postMessage({ status: 'error', error: error.message + "\n" + error.stack });
  }
};
