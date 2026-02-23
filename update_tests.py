import sys

file_path = "src/js/test_engine.js"
with open(file_path, "r") as f:
    content = f.read()

new_tests = """    { name: 'Ellipses Capitalization (...)', input: '你好... 我是张三.', expected: 'xin chào... Tôi là Trương Tam.' },
    { name: 'CJK Ellipses Capitalization (……)', input: '你好…… 我是张三.', expected: 'xin chào…… Tôi là Trương Tam.' },
    { name: 'Single Char Ellipses (…)', input: '你好… 我是张三.', expected: 'xin chào… Tôi là Trương Tam.' },
    { name: 'Smart Spacing (Numbers)', input: '我有100元', expected: 'Tôi có 100 tệ' },
    { name: 'Smart Spacing (Latin/CJK)', input: 'ABC你好', expected: 'ABC xin chào' },
    { name: 'Mixed Punctuation and Spacing', input: '他说: "你好!" 我回答: "谢谢."', expected: 'hắn nói: "xin chào!" Tôi trả lời: "cảm ơn."' },"""

search_text = "{ name: 'Unknown words handling', input: '未知词汇ABC', expected: '未知词汇ABC' }"
if search_text in content:
    content = content.replace(search_text, search_text + ",\n" + new_tests)
    with open(file_path, "w") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("SEARCH NOT FOUND")
