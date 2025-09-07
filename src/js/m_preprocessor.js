//BẢNG QUY ĐỔI DẤU CÂU
const punctuationMap = new Map([
  // ===== KÝ TỰ TIẾNG TRUNG & FULL-WIDTH =====

  // Dấu câu cơ bản
  ['。', '.'],
  ['、', ','],
  ['．', '.'],
  ['，', ','],
  ['：', ':'],
  ['；', ';'],
  ['？', '?'],
  ['！', '!'],
  ['～', '~'],

  // Các loại ngoặc kép (dùng cho trích dẫn và tên tác phẩm)
  ['“', '“'],
  ['”', '”'],
  ['＂', '"'],
  ['«', '«'],
  ['»', '»'],
  ['『', '『'],
  ['』', '』'],
  ['「', '「'],
  ['」', '」'],
  ['《', '《'],
  ['》', '》'],
  ['〈', '〈'],
  ['〉', '〉'],

  // Các loại ngoặc đơn, nháy đơn
  ['（', '('],
  ['）', ')'],
  ['‘', "‘"],
  ['’', "’"],

  // Các loại ngoặc vuông (dùng cho ghi chú, nhấn mạnh)
  ['【', '['],
  ['】', ']'],
  ['〖', '['],
  ['〗', ']'],
  ['〔', '['],
  ['〕', ']'],

  // Các loại dấu khác
  ['——', '—'],
  ['—', '—'],
  ['……', '...'],
  ['…', '...'],
  ['•', '·'],
  ['·', '·'],

  // Ký tự full-width (toàn giác)
  ['＃', '#'],
  ['＄', '$'],
  ['％', '%'],
  ['＆', '&'],
  ['＋', '+'],
  ['＝', '='],
  ['＠', '@'],

  // ===== KÝ TỰ TIẾNG ANH / ASCII CƠ BẢN =====
  // Mục đích chính là để đồng bộ hóa việc xử lý khoảng trắng

  // Dấu câu cơ bản
  ['.', '.'],
  [',', ','],
  [':', ':'],
  [';', ';'],
  ['?', '?'],
  ['!', '!'],
  ['~', '~'],

  // Các loại ngoặc
  ['"', '"'],
  ["'", "'"],
  ['(', '('],
  [')', ')'],
  ['[', '['],
  [']', ']'],
  ['{', '{'],
  ['}', '}'],
  ['<', '<'],
  ['>', '>'],

  // Các ký tự khác
  ['*', '*'],
  ['#', '#'],
  ['$', '$'],
  ['%', '%'],
  ['^', '^'],
  ['&', '&'],
  ['+', '+'],
  ['=', '='],
  ['@', '@'],
  ['-', '-'],
  ['_', '_'],
  ['`', '`'],
  ['|', '|'],
  ['/', '/'],
  ['\\', '\\']
]);

// Tạo một biểu thức chính quy (regex) từ các key của bảng quy đổi
const puncRegexForConvert = new RegExp(
  Array.from(punctuationMap.keys()).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g'
);

// Tạo một danh sách TẤT CẢ các ký tự dấu câu (cả Trung và Anh) để xử lý khoảng trắng
const allPuncChars = [...new Set([...punctuationMap.keys(), ...punctuationMap.values()])];
const puncRegexForSpacing = new RegExp(
  `[ \\t]*([${allPuncChars.map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}])[ \\t]*`, 'g'
);


/*
 * 1. Xóa các khoảng trắng thừa xung quanh TẤT CẢ các dấu câu.
 * 2. Chuyển đổi dấu câu tiếng Trung sang tiếng Anh.
*/
export function standardizeText(text) {
  if (!text) return '';
  // Bước 1: Xóa khoảng trắng thừa xung quanh các dấu câu.
  // "我 。 你" -> "我。你"
  let processedText = text.replace(puncRegexForSpacing, '$1');

  // Bước 2: Chuyển đổi các dấu câu Trung sang Anh.
  // "我。你" -> "我.你"
  processedText = processedText.replace(puncRegexForConvert, (match) => punctuationMap.get(match));

  return processedText;
}

// Chỉ xử lý vế Tiếng Trung, giữ nguyên vế Tiếng Việt.
export function standardizeDictionaryLine(line) {
  // Bỏ qua các dòng chú thích hoặc dòng trống
  if (line.startsWith('#') || line.trim() === '') {
    return line;
  }

  const parts = line.split('=');

  // Xử lý cho cả hai loại định dạng
  if (parts.length < 2) {
    // Nếu không có dấu '=', chuẩn hóa cả dòng (dành cho file Blacklist)
    return standardizeText(line.trim());
  } else {
    // Nếu có dấu '=', chỉ chuẩn hóa phần bên trái (dành cho Vietphrase, Names, v.v...)
    const key = parts[0];
    const value = parts.slice(1).join('='); // Giữ nguyên 100% phần nghĩa
    const standardizedKey = standardizeText(key);

    return `${standardizedKey}=${value}`; // Chuẩn hóa [A]
    //return `${standardizedKey}=${standardizeText(value)}`; // Chuẩn hóa [A] [B] - LỖI KHOẢNG TRẮNG [B]

  }
}