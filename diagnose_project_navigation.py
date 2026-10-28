import os
import sys
import time
from playwright.sync_api import sync_playwright

def diagnose_navigation():
    artifact_dir = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
    os.makedirs(artifact_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Opening app at http://localhost:8760...")
        page.goto("http://localhost:8760", wait_until="networkidle")
        time.sleep(1)

        # Initial state print
        page.screenshot(path=os.path.join(artifact_dir, "diag_1_initial.png"))
        print("Captured diag_1_initial.png")

        # Check what is currently visible on page
        active_tab = page.evaluate("() => document.querySelector('.ws-tab.active') ? document.querySelector('.ws-tab.active').dataset.tab : null")
        active_panel = page.evaluate("() => document.querySelector('.ws-panel.active') ? document.querySelector('.ws-panel.active').id : null")
        current_cat = page.evaluate("() => app.state.currentCategory")
        print(f"Initial: active_tab={active_tab}, active_panel={active_panel}, currentCategory={current_cat}")

        # Test 1: Click on tree nodes
        tree_nodes = page.locator(".tree-node")
        count = tree_nodes.count()
        print(f"Found {count} tree nodes in project-tree.")

        # Click on 'Paredes' (Walls)
        print("Clicking on 'Paredes' in tree...")
        page.click(".tree-node:has-text('Paredes')")
        time.sleep(0.5)
        current_cat_after_walls = page.evaluate("() => app.state.currentCategory")
        panel_after_walls = page.evaluate("() => document.querySelector('.ws-panel.active') ? document.querySelector('.ws-panel.active').id : null")
        cat_title = page.evaluate("() => document.getElementById('current-category-title').textContent")
        print(f"After clicking Paredes: currentCategory={current_cat_after_walls}, active_panel={panel_after_walls}, title='{cat_title}'")
        page.screenshot(path=os.path.join(artifact_dir, "diag_2_clicked_walls.png"))

        # Test 2: Switch to CAD 2D/3D tab first
        print("Switching to CAD 2D/3D tab...")
        page.click("button[data-tab='cad3d']")
        time.sleep(1)
        active_panel_cad = page.evaluate("() => document.querySelector('.ws-panel.active').id")
        print(f"Active panel after switching to cad3d: {active_panel_cad}")
        page.screenshot(path=os.path.join(artifact_dir, "diag_3_cad_view.png"))

        # Now, while on CAD 2D/3D tab, click on 'Sistemas de Ar' (Air Systems) or 'Clima' in tree!
        print("Clicking 'Sistemas de Ar' in tree while on CAD tab...")
        page.click(".tree-node:has-text('Sistemas de Ar')")
        time.sleep(0.5)
        active_tab_after_tree = page.evaluate("() => document.querySelector('.ws-tab.active').dataset.tab")
        active_panel_after_tree = page.evaluate("() => document.querySelector('.ws-panel.active').id")
        cat_after_tree = page.evaluate("() => app.state.currentCategory")
        print(f"While on CAD, after clicking Sistemas de Ar: active_tab={active_tab_after_tree}, active_panel={active_panel_after_tree}, currentCategory={cat_after_tree}")
        page.screenshot(path=os.path.join(artifact_dir, "diag_4_clicked_tree_from_cad.png"))

        # Test 3: Click on 'Lista de Categorias e Editor de Propriedades' tab
        print("Clicking tab 'Lista de Categorias e Editor de Propriedades'...")
        page.click("button[data-tab='explorer']")
        time.sleep(0.5)
        active_panel_exp = page.evaluate("() => document.querySelector('.ws-panel.active').id")
        print(f"Active panel: {active_panel_exp}")
        page.screenshot(path=os.path.join(artifact_dir, "diag_5_explorer_panel.png"))

        # Test 4: Check if clicking entity rows in category list works or errors
        print("Checking entity rows in category list...")
        entity_rows = page.locator(".data-table tbody tr")
        row_count = entity_rows.count()
        print(f"Found {row_count} entity rows.")
        if row_count > 0:
            print("Clicking first entity row...")
            entity_rows.first.click()
            time.sleep(0.5)
            editor_content = page.evaluate("() => document.getElementById('entity-editor-container').innerHTML.length")
            print(f"Editor HTML content length: {editor_content}")
            page.screenshot(path=os.path.join(artifact_dir, "diag_6_entity_editor.png"))

        # Test 5: Menu Bar "Projeto"
        print("Testing Menu Bar 'Projeto'...")
        page.hover(".menu-item:has-text('Projeto')")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(artifact_dir, "diag_7_menu_projeto_hover.png"))

        # Test 6: Check all tree categories one by one to see if any throws an error
        all_cats = page.evaluate("() => TREE_CATEGORIES.map(c => c.id)")
        print(f"Testing all categories: {all_cats}")
        for c in all_cats:
            print(f"Testing selectCategory('{c}')...")
            try:
                page.evaluate(f"cat => app.selectCategory(cat)", c)
                time.sleep(0.1)
            except Exception as e:
                print(f"ERROR on category {c}: {e}")

        page.screenshot(path=os.path.join(artifact_dir, "diag_8_all_cats_tested.png"))

        print("\nConsole logs during test:")
        for l in console_logs:
            print("  ", l)

        browser.close()
        print("\nDiagnosis finished!")

if __name__ == "__main__":
    diagnose_navigation()
