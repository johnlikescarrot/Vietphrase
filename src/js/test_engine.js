import { segmentText, translateWord } from './m_dictionary.js';
import { Trie } from './m_nameList.js';

/**
 * Logic Verification Suite for Vietphrase ZXC Engine
 */
export function runTests(state) {
  console.log('%c --- Bắt đầu kiểm tra Engine --- ', 'background: #222; color: #bada55; font-size: 1.2em;');

  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };

  function assert(name, condition, details = '') {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`%c[PASS] %c${name}`, 'color: green; font-weight: bold;', 'color: inherit;');
    } else {
      results.failed++;
      console.error(`[FAIL] ${name} ${details}`);
    }
  }

  // --- Test 1: Longest Match Segmentation ---
  const testTrie = new Trie();
  testTrie.insert('中国', { translation: 'Trung Quốc' });
  testTrie.insert('中国人', { translation: 'người Trung Quốc' });

  const segments = segmentText('我是中国人', testTrie);
  assert('Longest Match Segmentation',
    segments.includes('中国人') && !segments.includes('中国'),
    `Expected '中国人' to be matched as a whole. Got: ${JSON.stringify(segments)}`);

  // --- Test 2: Name Priority ---
  const nameDict = new Map();
  nameDict.set('李白', 'Lý Thái Bạch');

  const dicts = new Map();
  dicts.set('Vietphrase', { priority: 40, dict: new Map([['李白', 'lý bạch']]) });

  const translation = translateWord('李白', dicts, nameDict, new Map());
  assert('Name Priority (User List over Vietphrase)',
    translation.best === 'Lý Thái Bạch',
    `Expected 'Lý Thái Bạch', got '${translation.best}'`);

  // --- Test 3: Punctuation Handling ---
  // Note: This requires full performTranslation mock which is complex,
  // so we test the logic inside segmentText for non-chinese blocks
  const mixedSegments = segmentText('你好! Hello.', testTrie);
  assert('Non-Chinese Block Preservation',
    mixedSegments.includes('! Hello.'),
    `Expected non-chinese block to be preserved. Got: ${JSON.stringify(mixedSegments)}`);

  console.log(`%c --- Kết quả: ${results.passed}/${results.total} thành công --- `,
    `background: ${results.failed > 0 ? '#ff4444' : '#44ff44'}; color: #000; font-weight: bold;`);

  return results;
}
