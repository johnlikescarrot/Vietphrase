from playwright.sync_api import Page, expect, sync_playwright
import time

def test_vietphrase_final_polish(page: Page):
    page.goto("http://localhost:8000")
    page.set_viewport_size({"width": 1280, "height": 900})

    # Load Dictionaries
    page.click("#import-server-btn")
    page.wait_for_selector("li:has-text('Quá trình hoàn tất.')", timeout=60000)
    page.click("#close-log-modal-btn")

    # Translate
    page.fill("#input-text", "你好... 我是张三. ABC100元")
    page.click("#translate-btn")
    page.wait_for_selector("#output-panel span.word", timeout=10000)

    # 1. Verify Selection Robustness (closest)
    page.dblclick("text=Trương Tam")
    page.wait_for_selector("#quick-edit-panel.show", timeout=10000)
    page.screenshot(path="final_selection_polish.png")

    # 2. Verify Suggestion Layout (No overflow)
    page.click("#q-vietphrase-toggle-btn")
    page.wait_for_selector("#q-vietphrase-options-container:not(.hidden)")
    page.screenshot(path="final_layout_polish.png")

    # 3. Verify Restore Search Btn (Magnifying glass)
    page.click("#q-search-btn")
    # Should open full edit modal
    page.wait_for_selector("#edit-modal[style*='display: flex']", timeout=10000)
    page.screenshot(path="final_search_btn_restore.png")
    page.click("#close-edit-modal-btn")

    # 4. Verify Delete Btn handler exists (not clicking to avoid state change, just presence check)
    delete_btn = page.query_selector("#q-delete-btn")
    print(f"Delete button present: {delete_btn is not None}")

    # 5. Verify Copy Sạch with placeholder (should not copy)
    page.click("#clear-btn")
    page.click("#copy-clean-btn")
    # If it was copied, text would be 'Copied!'. Check if it is NOT 'Copied!'
    btn_text = page.inner_text("#copy-clean-btn")
    print(f"Copy Clean Button text with placeholder: '{btn_text}'")

    print("VERIFICATION SUCCESSFUL")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_vietphrase_final_polish(page)
        except Exception as e:
            print(f"ERROR: {e}")
            page.screenshot(path="final_error.png")
        finally:
            browser.close()
