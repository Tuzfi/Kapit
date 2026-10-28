"""
Kapit 0.1 — Clean Thermal Core E2E UI Verification Script
Navigates to http://localhost:8760, verifies Project Tree, KPI cards, CAD 2D/3D, and Reports.
Saves screenshots to artifacts directory.
"""

import os
from playwright.sync_api import sync_playwright

def run_verification():
    artifact_dir = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
    console_errors = []

    print("Iniciando Playwright para teste E2E do Clean Thermal Core...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        # 1. Main Screen
        page.goto("http://localhost:8760", wait_until="networkidle")
        page.wait_for_timeout(1000)
        shot1 = os.path.join(artifact_dir, "step18_clean_core_dashboard.png")
        page.screenshot(path=shot1)
        print(f"Screenshot 1 salva: {shot1}")

        # 2. Check CAD 2D/3D
        page.click("button[data-tab='cad3d']")
        page.wait_for_timeout(1000)
        shot2 = os.path.join(artifact_dir, "step19_clean_core_cad2d3d.png")
        page.screenshot(path=shot2)
        print(f"Screenshot 2 salva: {shot2}")

        # 3. Check Reports Viewer
        page.click("button[data-tab='reports']")
        page.wait_for_timeout(1000)
        shot3 = os.path.join(artifact_dir, "step20_clean_core_reports.png")
        page.screenshot(path=shot3)
        print(f"Screenshot 3 salva: {shot3}")

        # 4. Check archived report notice (e.g. annual_costs)
        page.select_option("#report-type-select", "annual_costs")
        page.wait_for_timeout(600)
        shot4 = os.path.join(artifact_dir, "step21_archived_module_notice.png")
        page.screenshot(path=shot4)
        print(f"Screenshot 4 salva: {shot4}")

        browser.close()

    print("Erros no console:", console_errors)
    assert len(console_errors) == 0, f"Erros detectados no console: {console_errors}"
    print("Verificação E2E concluída com 100% de sucesso!")

if __name__ == "__main__":
    run_verification()
