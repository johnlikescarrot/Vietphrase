import { segmentText, translateWord } from './m_dictionary.js';
import { Trie } from './m_nameList.js';

/**
 * Logic Verification Suite for Vietphrase ZXC Engine
 */
export function runTests() {
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

  // --- Test 3: Overlapping Keys Priority ---
  const overlapTrie = new Trie();
  // Simulate insertion order for priority: lower priority (higher value) first, then override
  overlapTrie.insert('大', { translation: 'đại', type: 'Vietphrase' });
  overlapTrie.insert('大家', { translation: 'mọi người', type: 'Names' }, true);

  const overlapSegments = segmentText('大家', overlapTrie);
  assert('Overlapping Keys (Longest Match)',
    overlapSegments.length === 1 && overlapSegments[0] === '大家',
    `Expected '大家', got: ${JSON.stringify(overlapSegments)}`);

  // --- Test 4: Empty Input ---
  const emptySegments = segmentText('', testTrie);
  assert('Empty Input Handling',
    emptySegments.length === 0 || (emptySegments.length === 1 && emptySegments[0] === ''),
    `Expected empty segments for empty input. Got: ${JSON.stringify(emptySegments)}`);

  // --- Test 5: Non-Chinese Block Preservation ---
  const mixedSegments = segmentText('你好! Hello.', testTrie);
  assert('Non-Chinese Block Preservation',
    mixedSegments.includes('! Hello.'),
    `Expected non-chinese block to be preserved. Got: ${JSON.stringify(mixedSegments)}`);

  console.log(`%c --- Kết quả: ${results.passed}/${results.total} thành công --- `,
    `background: ${results.failed > 0 ? '#ff4444' : '#44ff44'}; color: #000; font-weight: bold;`);

  return results;
}
