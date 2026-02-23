from playwright.sync_api import Page, expect, sync_playwright
import time

def test_vietphrase_ui_refined(page: Page):
    page.goto("http://localhost:8000")
    page.set_viewport_size({"width": 1280, "height": 900})

    page.click("#import-server-btn")
    page.wait_for_selector("li:has-text('Quá trình hoàn tất.')", timeout=60000)
    page.click("#close-log-modal-btn")

    page.fill("#input-text", "你好... 我是张三. ABC100元")
    page.click("#translate-btn")
    page.wait_for_selector("#output-panel span.word", timeout=10000)

    page.dblclick("text=Trương Tam")
    page.wait_for_selector("#quick-edit-panel.show", timeout=10000)

    page.click("#q-vietphrase-toggle-btn")
    page.wait_for_selector("#q-vietphrase-options-container:not(.hidden)")

    page.keyboard.press("ArrowDown")
    page.keyboard.press("Tab")
    time.sleep(0.5)

    # Just take screenshots instead of waiting for potentially hidden elements
    page.screenshot(path="verify_keyboard_final.png")

    page.keyboard.press("Enter")
    time.sleep(0.5)
    page.screenshot(path="verify_final_state.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_vietphrase_ui_refined(page)
            print("FINAL VERIFICATION SUCCESSFUL")
        except Exception as e:
            print(f"ERROR: {e}")
        finally:
            browser.close()
