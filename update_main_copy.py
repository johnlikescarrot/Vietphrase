import sys

file_path = "src/js/main.js"
with open(file_path, "r") as f:
    content = f.read()

# 1. Update import
content = content.replace(
    "import { showModalWithAnimation, hideModalWithAnimation } from './m_utils.js';",
    "import { showModalWithAnimation, hideModalWithAnimation, getCleanTranslation } from './m_utils.js';"
)

# 2. Add event listener after copyBtn block
search_text = "  DOMElements.copyBtn.addEventListener('click', async () => {"
if search_text in content:
    # Find the end of this block
    start_pos = content.find(search_text)
    end_pos = content.find("  });", start_pos) + 5

    copy_clean_code = """
  DOMElements.copyCleanBtn.addEventListener('click', async () => {
    const text = getCleanTranslation(DOMElements.outputPanel);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const originalText = DOMElements.copyCleanBtn.textContent;
      DOMElements.copyCleanBtn.textContent = 'Copied!';
      DOMElements.copyCleanBtn.disabled = true;
      setTimeout(() => {
        DOMElements.copyCleanBtn.textContent = originalText;
        DOMElements.copyCleanBtn.disabled = false;
      }, 1500);
    } catch (err) {
      console.error('Failed to copy clean text: ', err);
      customAlert('Không thể sao chép bản dịch sạch. Vui lòng kiểm tra quyền truy cập clipboard.');
    }
  });
"""
    content = content[:end_pos] + copy_clean_code + content[end_pos:]
    with open(file_path, "w") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("SEARCH NOT FOUND")
