import { performTranslation } from './m_translation.js';
import DOMElements from './m_dom.js';

/**
 * Runs translation engine tests.
 * @param {Object} state - The application state, must have dictionaries and dictionaryTrie populated.
 */
export function runTests(state) {
  if (!state || !state.dictionaries || !state.dictionaryTrie) {
    console.error('❌ Cannot run tests: Application state or Trie not initialized.');
    return;
  }

  console.log('--- RUNNING TRANSLATION ENGINE TESTS ---');

  const testCases = [
    { name: 'Basic Translation', input: '你好', expected: 'xin chào' },
    { name: 'Longest Match Segmentation', input: '中国人', expected: 'người Trung Quốc' },
    { name: 'Dictionary Priority', input: '李白', expected: 'Lý Bạch' },
    { name: 'Punctuation Spacing', input: '你好! 我是张三.', expected: 'xin chào! Tôi là Trương Tam.' },
    { name: 'Capitalization after sentence end', input: '你好. 我是张三.', expected: 'xin chào. Tôi là Trương Tam.' },
    { name: 'Unknown words handling', input: '未知词汇ABC', expected: '未知词汇ABC' },
    { name: 'Ellipses Capitalization (...)', input: '你好... 我是张三.', expected: 'xin chào... Tôi là Trương Tam.' },
    { name: 'CJK Ellipses Capitalization (……)', input: '你好…… 我是张三.', expected: 'xin chào…… Tôi là Trương Tam.' },
    { name: 'Single Char Ellipses (…)', input: '你好… 我是张三.', expected: 'xin chào… Tôi là Trương Tam.' },
    { name: 'Smart Spacing (Numbers)', input: '我有100元', expected: 'Tôi có 100 tệ' },
    { name: 'Smart Spacing (Latin/CJK)', input: 'ABC你好', expected: 'ABC xin chào' },
    { name: 'Mixed Punctuation and Spacing', input: '他说: "你好!" 我回答: "谢谢."', expected: 'hắn nói: "xin chào!" Tôi trả lời: "cảm ơn."' },
  ];

  let passed = 0;
  testCases.forEach(tc => {
    try {
      DOMElements.inputText.value = tc.input;
      performTranslation(state);
      const result = DOMElements.outputPanel.textContent.trim();

      if (result === tc.expected) {
        console.log(`✅ PASS: ${tc.name}`);
        passed++;
      } else {
        console.error(`❌ FAIL: ${tc.name}`);
        console.error(`   Input:    ${tc.input}`);
        console.error(`   Expected: "${tc.expected}"`);
        console.error(`   Got:      "${result}"`);
      }
    } catch (err) {
      console.error(`💥 ERROR in test "${tc.name}":`, err);
    }
  });

  console.log(`--- TEST SUMMARY: ${passed}/${testCases.length} PASSED ---`);
}
