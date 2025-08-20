/**
 * BẢNG QUY ĐỔI DẤU CÂU
 * Chuyển đổi từ dấu câu tiếng Trung (full-width) sang tiếng Anh (half-width).
 */
const punctuationMap = new Map([
  ['。', '.'],
  ['，', ','],
  ['～', '~'],
  ['、', ','],
  ['：', ':'],
  ['；', ';'],
  ['？', '?'],
  ['！', '!'],
  ['“', '"'],
  ['”', '"'],
  ['‘', "'"],
  ['’', "'"],
  ['（', '('],
  ['）', ')'],
  ['——', '-'],
  ['—', '-'],
  ['……', '...'],
  ['【', '['],
  ['】', ']'],
  ['《', '<'],
  ['》', '>']
]);

// Tạo một biểu thức chính quy (regex) từ các key của bảng quy đổi
const puncRegexForConvert = new RegExp(
  Array.from(punctuationMap.keys()).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
  'g'
);

// Tạo một danh sách TẤT CẢ các ký tự dấu câu (cả Trung và Anh) để xử lý khoảng trắng
const allPuncChars = [...new Set([...punctuationMap.keys(), ...punctuationMap.values()])];
const puncRegexForSpacing = new RegExp(
  `[ \\t]*([${allPuncChars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}])[ \\t]*`,
  'g'
);


/**
 * Chuẩn hóa một chuỗi văn bản bất kỳ.
 * 1. Xóa các khoảng trắng thừa xung quanh TẤT CẢ các dấu câu.
 * 2. Chuyển đổi dấu câu tiếng Trung sang tiếng Anh.
 * @param {string} text - Văn bản đầu vào.
 * @returns {string} Văn bản đã được chuẩn hóa.
 */
export function standardizeText(text) {
  if (!text) return '';
  // Bước 1: Xóa khoảng trắng thừa xung quanh các dấu câu.
  // Ví dụ: "我 。 你" -> "我。你"
  let processedText = text.replace(puncRegexForSpacing, '$1');

  // Bước 2: Chuyển đổi các dấu câu Trung sang Anh.
  // Ví dụ: "我。你" -> "我.你"
  processedText = processedText.replace(puncRegexForConvert, (match) => punctuationMap.get(match));

  return processedText;
}

/**
 * Chuẩn hóa một dòng trong file từ điển (dạng [Tiếng Trung]=[Tiếng Việt]).
 * Chỉ xử lý vế Tiếng Trung, giữ nguyên vế Tiếng Việt.
 * @param {string} line - Một dòng từ file từ điển.
 * @returns {string} Dòng đã được chuẩn hóa.
 */
export function standardizeDictionaryLine(line) {
  // Bỏ qua các dòng chú thích hoặc dòng trống
  if (line.startsWith('#') || line.trim() === '') {
    return line;
  }

  const parts = line.split('=');
  // Nếu không phải định dạng key=value, trả về nguyên bản
  if (parts.length < 2) {
    return line;
  }

  const key = parts[0];
  const value = parts.slice(1).join('='); // Giữ nguyên 100% phần nghĩa

  // Chỉ chuẩn hóa phần key (tiếng Trung)
  const standardizedKey = standardizeText(key);

  return `${standardizedKey}=${value}`;
}