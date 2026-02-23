import sys

file_path = "src/js/m_translation.js"
with open(file_path, "r") as f:
    content = f.read()

search_text = "  if (i === 0 || /\\s/.test(lastChar) || textForSpan === '') leadingSpace = '';"

replace_text = '''  if (i === 0 || /\\s/.test(lastChar) || textForSpan === '') leadingSpace = '';

  // Smart Spacing: Ensure spacing between Vietnamese and Latin/Digits is prioritized
  if (leadingSpace === '' && i > 0 && textForSpan !== '') {
    const isCurrentLatinDigit = /[a-zA-Z0-9]/.test(textForSpan.trim().charAt(0));
    const isLastLatinDigit = /[a-zA-Z0-9]/.test(lastChar);
    if (isCurrentLatinDigit && isLastLatinDigit) leadingSpace = ' ';
  }'''

if search_text in content:
    new_content = content.replace(search_text, replace_text)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("SUCCESS")
else:
    print("SEARCH TEXT NOT FOUND")
