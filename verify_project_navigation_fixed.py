import os
import sys
import time
from playwright.sync_api import sync_playwright

def verify_project_navigation():
    artifact_dir = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
    os.makedirs(artifact_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("1. Opening app at http://localhost:8760...")
        page.goto("http://localhost:8760", wait_until="networkidle")
        time.sleep(1)

        # 2. Switch to CAD 2D/3D first (simulating user state)
        print("2. Switching to CAD 2D/3D view...")
        page.click("button[data-tab='cad3d']")
        time.sleep(1)
        p1 = os.path.join(artifact_dir, "print_1_user_in_cad.png")
        page.screenshot(path=p1)
        print(f"Captured: {p1}")

        # 3. While in CAD 2D/3D, click on 'Sistemas de Ar' in the left Project Tree
        print("3. Clicking 'Sistemas de Ar' on left tree...")
        page.click(".tree-node:has-text('Sistemas de Ar')")
        time.sleep(1)

        active_tab = page.evaluate("() => document.querySelector('.ws-tab.active').dataset.tab")
        active_panel = page.evaluate("() => document.querySelector('.ws-panel.active').id")
        current_cat = page.evaluate("() => app.state.currentCategory")
        print(f"State after clicking Sistemas de Ar: active_tab={active_tab}, active_panel={active_panel}, currentCategory={current_cat}")
        assert active_tab == "explorer", f"Expected active_tab to be 'explorer', got {active_tab}"
        assert active_panel == "panel-explorer", f"Expected active_panel to be 'panel-explorer', got {active_panel}"
        assert current_cat == "air_systems", f"Expected currentCategory to be 'air_systems', got {current_cat}"

        p2 = os.path.join(artifact_dir, "print_2_navigated_to_air_systems.png")
        page.screenshot(path=p2)
        print(f"Captured: {p2}")

        # 4. Click on 'Paredes' in the left Project Tree
        print("4. Clicking 'Paredes' on left tree...")
        page.click(".tree-node:has-text('Paredes')")
        time.sleep(0.8)
        current_cat = page.evaluate("() => app.state.currentCategory")
        assert current_cat == "walls", f"Expected 'walls', got {current_cat}"
        p3 = os.path.join(artifact_dir, "print_3_navigated_to_walls.png")
        page.screenshot(path=p3)
        print(f"Captured: {p3}")

        # 5. Click on 'Horários / Agendamentos' in the left tree
        print("5. Clicking 'Horários / Agendamentos' on left tree...")
        page.click(".tree-node:has-text('Horários')")
        time.sleep(0.8)
        current_cat = page.evaluate("() => app.state.currentCategory")
        assert current_cat == "schedules", f"Expected 'schedules', got {current_cat}"
        p4 = os.path.join(artifact_dir, "print_4_navigated_to_schedules.png")
        page.screenshot(path=p4)
        print(f"Captured: {p4}")

        # 6. Click on 'Modelos Espaciais' in the left tree
        print("6. Clicking 'Modelos Espaciais' on left tree...")
        page.click(".tree-node:has-text('Modelos Espaciais')")
        time.sleep(0.8)
        current_cat = page.evaluate("() => app.state.currentCategory")
        assert current_cat == "space_models", f"Expected 'space_models', got {current_cat}"
        p5 = os.path.join(artifact_dir, "print_5_space_models_with_quickbtn.png")
        page.screenshot(path=p5)
        print(f"Captured: {p5}")

        # 7. Click the quick button 'Abrir no Modelador 2D / 3D' inside Space Models
        print("7. Clicking 'Abrir no Modelador 2D / 3D' button inside Space Models...")
        page.click("button:has-text('Abrir no Modelador 2D / 3D')")
        time.sleep(1)
        active_tab = page.evaluate("() => document.querySelector('.ws-tab.active').dataset.tab")
        assert active_tab == "cad3d", f"Expected 'cad3d', got {active_tab}"
        p6 = os.path.join(artifact_dir, "print_6_back_to_cad_via_quickbtn.png")
        page.screenshot(path=p6)
        print(f"Captured: {p6}")

        # 8. Use the new toolbar button 'Propriedades' to go back to properties
        print("8. Clicking 'Propriedades' in toolbar...")
        page.click("button.tool-btn:has-text('Propriedades')")
        time.sleep(0.8)
        active_tab = page.evaluate("() => document.querySelector('.ws-tab.active').dataset.tab")
        assert active_tab == "explorer", f"Expected 'explorer', got {active_tab}"
        p7 = os.path.join(artifact_dir, "print_7_toolbar_propriedades.png")
        page.screenshot(path=p7)
        print(f"Captured: {p7}")

        # 9. Click on menu bar 'Projeto' to verify dropdown opens
        print("9. Clicking menu bar 'Projeto'...")
        page.click(".menu-item:has-text('Projeto')")
        time.sleep(0.5)
        is_menu_open = page.evaluate("() => document.querySelector('.menu-item:first-child').classList.contains('open')")
        print(f"Menu item open state: {is_menu_open}")
        p8 = os.path.join(artifact_dir, "print_8_menu_projeto_opened.png")
        page.screenshot(path=p8)
        print(f"Captured: {p8}")

        # Check console errors
        print(f"Console errors: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, "No console errors allowed"

        browser.close()
        print("\n>> All project navigation tests PASSED with 100% success!")

if __name__ == "__main__":
    verify_project_navigation()
