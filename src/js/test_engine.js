import { performTranslation } from './m_translation.js';
import DOMElements from './m_dom.js';

export function runTests(state) {
  console.log('--- RUNNING TRANSLATION ENGINE TESTS ---');

  const testCases = [
    {
      name: 'Basic Translation',
      input: '你好',
      expected: 'xin chào'
    },
    {
      name: 'Longest Match Segmentation',
      input: '中国人',
      expected: 'người Trung Quốc'
    },
    {
      name: 'Dictionary Priority (Names over Vietphrase)',
      input: '李白',
      expected: 'Lý Bạch'
    },
    {
      name: 'Punctuation Spacing',
      input: '你好! 我是张三.',
      expected: 'xin chào! tôi là Trương Tam.'
    },
    {
      name: 'Capitalization after sentence end',
      input: '你好. 我是张三.',
      expected: 'xin chào. Tôi là Trương Tam.'
    }
  ];

  let passed = 0;
  testCases.forEach(tc => {
    DOMElements.inputText.value = tc.input;
    performTranslation(state);
    const result = DOMElements.outputPanel.textContent.trim();

    // Using strict equality to catch regressions
    if (result === tc.expected) {
      console.log(`✅ PASS: ${tc.name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${tc.name}`);
      console.error(`   Input: ${tc.input}`);
      console.error(`   Expected: "${tc.expected}"`);
      console.error(`   Got:      "${result}"`);
    }
  });

  console.log(`--- TEST SUMMARY: ${passed}/${testCases.length} PASSED ---`);
}
