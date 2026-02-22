import asyncio
from playwright.async_api import async_playwright
import os

async def verify_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Open the app
        await page.goto("http://localhost:8000")
        await page.wait_for_selector("#translate-btn")

        # 1. Verify Settings Panel
        await page.click("#settings-btn")
        await page.wait_for_timeout(300) # Wait for animation
        settings_visible = await page.is_visible("#settings-panel")
        settings_opacity = await page.evaluate("window.getComputedStyle(document.getElementById('settings-panel')).opacity")
        print(f"Settings Panel Visible: {settings_visible}, Opacity: {settings_opacity}")
        await page.screenshot(path="verify_settings_final.png")

        # 2. Verify Alert Modal
        await page.click("#translate-btn") # Should trigger "Vui lòng tải từ điển" alert
        await page.wait_for_timeout(300)
        alert_visible = await page.is_visible("#custom-dialog-modal")
        alert_opacity = await page.evaluate("window.getComputedStyle(document.querySelector('#custom-dialog-modal .modal-content')).opacity")
        print(f"Alert Modal Visible: {alert_visible}, Opacity: {alert_opacity}")
        await page.screenshot(path="verify_alert_final.png")

        # 3. Verify Modal Closure
        await page.click("#custom-dialog-ok-btn")
        await page.wait_for_timeout(300)
        alert_hidden = await page.is_hidden("#custom-dialog-modal")
        print(f"Alert Modal Hidden after OK: {alert_hidden}")

        await browser.close()

        if settings_visible and alert_visible and float(settings_opacity) > 0 and float(alert_opacity) > 0:
            print("UI Verification PASSED")
        else:
            print("UI Verification FAILED")

if __name__ == "__main__":
    asyncio.run(verify_ui())
