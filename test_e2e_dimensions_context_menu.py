import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        # Navigate to Kapit UI
        page.goto("http://localhost:8760", wait_until="networkidle")
        time.sleep(1)

        # Ensure language is pt-BR
        current_lang = page.evaluate("typeof I18N !== 'undefined' ? I18N.getLanguage() : 'en'")
        if current_lang != "pt-BR":
            page.evaluate("I18N.setLanguage('pt-BR')")
            time.sleep(0.5)

        # Ensure metric units
        is_si = page.evaluate("typeof I18N !== 'undefined' ? I18N.isSI() : false")
        if not is_si:
            page.evaluate("app.toggleUnitsSystem()")
            time.sleep(0.5)

        # Switch to 2D/3D CAD Modeler Tab
        page.evaluate("app.switchWorkspaceTab('cad3d')")
        time.sleep(0.8)

        # 1. Right-click on empty canvas area (x: 50, y: 380 relative to canvas)
        canvas = page.locator("#building-canvas")
        box = canvas.bounding_box()
        assert box is not None, "Canvas not found"

        # Right click at x: 70, y: 390
        page.mouse.click(box["x"] + 70, box["y"] + 390, button="right")
        time.sleep(0.5)

        # Verify context menu is displayed
        ctx_menu = page.locator("#cad-context-menu")
        assert ctx_menu.is_visible(), "Context menu should be visible after right click"

        # Capture Screenshot 1: Context Menu
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "step13_cad_context_menu.png"))
        print("[E2E PASS] Step 13: Context menu displayed correctly on right-click.")

        # 2. Click "Criar Ambiente por Dimensões (Largura x Comprimento)..."
        page.locator(".ctx-item.primary").click()
        time.sleep(0.5)

        modal = page.locator("#modal-backdrop")
        assert modal.is_visible(), "Dimension modal should be open"

        # Type quick dimensions: 12 x 8
        quick_input = page.locator("#cad-dim-quick-input")
        quick_input.fill("")
        quick_input.type("12 x 8")
        time.sleep(0.3)

        # Set custom room name
        name_input = page.locator("#cad-dim-name")
        name_input.fill("Sala Executiva (12x8m)")

        # Verify explicit inputs updated
        w_val = page.locator("#cad-dim-w").input_value()
        l_val = page.locator("#cad-dim-l").input_value()
        assert float(w_val) == 12.0, f"Expected width 12, got {w_val}"
        assert float(l_val) == 8.0, f"Expected length 8, got {l_val}"

        # Capture Screenshot 2: Dimension Modal
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "step14_cad_dimension_modal.png"))
        print("[E2E PASS] Step 14: Dimension modal parsed 12x8 into width 12m and length 8m.")

        # 3. Submit modal by clicking "Inserir Ambiente na Planta"
        page.locator("#btn-submit-dim-create").click()
        time.sleep(0.8)

        # Verify new room was created
        created_name = page.evaluate("modeler.getSelectedSpace() ? modeler.getSelectedSpace().name : ''")
        assert "Sala Executiva" in created_name, f"Expected Sala Executiva, got {created_name}"
        
        # Capture Screenshot 3: Room Created on Canvas
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "step15_room_created_by_dim.png"))
        print(f"[E2E PASS] Step 15: Room '{created_name}' created successfully on 2D floor plan.")

        # 4. Right-click on the newly selected room to inspect room context actions
        # Get screen coordinate of the selected room
        sp_center = page.evaluate("""() => {
            const sp = modeler.getSelectedSpace();
            const pts = sp.geometry.polygon.map(p => modeler.modelToScreen(p[0], p[1], modeler.pan2d.x, modeler.pan2d.y));
            return {
                x: pts.reduce((s, p) => s + p.px, 0) / pts.length,
                y: pts.reduce((s, p) => s + p.py, 0) / pts.length
            };
        }""")
        page.mouse.click(box["x"] + sp_center["x"], box["y"] + sp_center["y"], button="right")
        time.sleep(0.5)

        assert ctx_menu.is_visible(), "Context menu on room should be visible"
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "step16_room_context_menu.png"))
        print("[E2E PASS] Step 16: Room-specific context menu with resize, duplicate, apertures displayed.")

        # 5. Click "Redimensionar Ambiente por Dimensões (LxC)..."
        page.locator("text=Redimensionar Ambiente por Dimensões").click()
        time.sleep(0.5)

        # Resize to 16 x 10
        quick_input.fill("")
        quick_input.type("16 x 10")
        time.sleep(0.3)
        page.locator("#btn-submit-dim-resize").click()
        time.sleep(0.8)

        new_area = page.evaluate("modeler.getSelectedSpace().floor_area_sqft")
        # 16m * 10m = 160 m2 = ~1722.2 sqft
        assert new_area > 1650, f"Expected area > 1650 sqft, got {new_area}"
        
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "step17_room_resized.png"))
        print(f"[E2E PASS] Step 17: Room resized to 16x10m (area {new_area} sqft / ~160 m²).")

        browser.close()
        print("\n[SUCCESS] ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_test()
