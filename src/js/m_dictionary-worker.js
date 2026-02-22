import { standardizeDictionaryLine } from './m_preprocessor.js';

// --- CÁC HÀM PARSE ---
function parseStyleChung(text) {
  const dictionary = new Map();
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    if (line.startsWith('#') || line.trim() === '') return;
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim();
      if (key) dictionary.set(key, value);
    }
  });
  return dictionary;
}

function parseBlacklistStyle(text) {
  const dictionary = new Map();
  const lines = text.split(/\r?\n/);
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      dictionary.set(trimmedLine, '');
    }
  });
  return dictionary;
}

function parseDictionary(text, style = 'Style-Chung') {
  switch (style) {
    case 'Blacklist-Style': return parseBlacklistStyle(text);
    default: return parseStyleChung(text);
  }
}

// --- CÁC HÀM LÀM VIỆC VỚI INDEXEDDB ---
// Những hàm này được sao chép từ m_dictionary.js để worker có thể tự truy cập CSDL
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
    request.onerror = () => reject("Không thể lưu dữ liệu vào DB từ Worker.");
    request.onsuccess = () => resolve();
  });
}

async function getDataFromDB(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onerror = () => reject("Không thể đọc dữ liệu từ DB từ Worker.");
    request.onsuccess = () => resolve(request.result);
  });
}


// --- BỘ NÃO CỦA WORKER ---
self.onmessage = async function (e) {
  try {
    const { filesContent } = e.data;
    // Bước 1: Mở kết nối tới CSDL
    const db = await openDB();
    // Bước 2: Lấy dữ liệu từ điển hiện có từ CSDL
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

    // Bước 2B: Chuẩn hóa nội dung các file từ điển cần thiết
    const dictionariesToStandardize = new Set([
      'Names2', 'Names',
      'LuatNhan',
      'Vietphrase', 'Chapter', 'Number',
      'Pronouns', 'PhienAm',
      'English',
      'Blacklist'
    ]);

    // Bước 3: Phân tích (Parse) nội dung các file mới và cập nhật
    filesContent.forEach(item => {
      const fileInfo = item.fileInfo;
      const dictionaryId = fileInfo.id;

      let contentToParse = item.content;
      // Nếu file này nằm trong danh sách cần chuẩn hóa, hãy xử lý nó
      if (dictionariesToStandardize.has(dictionaryId)) {
        contentToParse = contentToParse
          .split(/\r?\n/)
          .map(standardizeDictionaryLine)
          .join('\n');
      }
      const newDict = parseDictionary(contentToParse, fileInfo.style);

      // Luôn ghi đè từ điển cũ bằng dữ liệu mới từ file
      dictionaries.set(dictionaryId, { priority: fileInfo.priority, dict: newDict });
    });

    // Bước 4: Chuẩn bị dữ liệu để lưu vào IndexedDB
    const storableDicts = Array.from(dictionaries.entries()).map(([name, data]) => {
      return [name, {
        priority: data.priority,
        dict: Array.from(data.dict.entries())
      }];
    });
    // Bước 5: Lưu dữ liệu đã xử lý vào CSDL
    await saveDataToDB(db, { id: 'parsed-dictionaries', data: storableDicts });
    // Bước 6: Gửi một thông báo thành công đơn giản về luồng chính
    self.postMessage({ status: 'success' });
  } catch (error) {
    // Nếu có lỗi bên trong worker, gửi thông báo lỗi chi tiết về
    self.postMessage({ status: 'error', error: error.message + "\n" + error.stack });
  }
};