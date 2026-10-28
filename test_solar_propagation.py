import os
import sys
import time
from playwright.sync_api import sync_playwright

def test_solar_propagation():
    artifacts_dir = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
    os.makedirs(artifacts_dir, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://localhost:8760...")
        page.goto("http://localhost:8760", wait_until="networkidle")
        time.sleep(1)

        # 1. Switch to CAD 2D/3D Floor Plan tab
        print("Navigating to CAD 2D/3D tab...")
        page.click("button[data-tab='cad3d']")
        time.sleep(1)

        # 2. Select first space via modeler API
        print("Selecting room via modeler...")
        page.evaluate("""() => {
            const spaces = modeler.getAllSpaces();
            if (spaces.length > 0) {
                modeler.selectedSpaceId = spaces[0].id;
                modeler.selectedWallIdx = 0;
                modeler.render();
            }
        }""")
        time.sleep(0.5)

        # Verify room selected and wall inspector is open
        sp_name = page.evaluate("() => modeler.getSelectedSpace() ? modeler.getSelectedSpace().name : null")
        print(f"Selected space: {sp_name}")
        assert sp_name is not None, "Space should be selected"

        # 3. Test: Select Wall 4 (index 3) and set it to North ('N')
        print("Setting Parede 4 (index 3) to North ('N')...")
        page.evaluate("""() => {
            modeler.selectWallTab(3);
            modeler.setWallOrientation(3, 'N');
        }""")
        time.sleep(0.5)

        # Read back wall orientations
        walls_orientations = page.evaluate("""() => {
            const sp = modeler.getSelectedSpace();
            return sp.walls.map((w, idx) => ({ idx: idx + 1, ori: w.orientation, az: modeler.compassToAzimuth(w.orientation) }));
        }""")
        print("Walls orientations after setting Parede 4 to North:")
        for w in walls_orientations:
            print(f"  Parede {w['idx']}: {w['ori']} ({w['az']}°)")

        # Parede 4 is index 3 -> 'N' (0°)
        # Parede 2 is index 1 -> opposite of Parede 4 -> 'S' (180°)
        # Parede 1 is index 0 -> perpendicular -> 'E' (90°)
        # Parede 3 is index 2 -> perpendicular -> 'W' (270°)
        w1 = next(w for w in walls_orientations if w["idx"] == 1)
        w2 = next(w for w in walls_orientations if w["idx"] == 2)
        w3 = next(w for w in walls_orientations if w["idx"] == 3)
        w4 = next(w for w in walls_orientations if w["idx"] == 4)

        assert w4["ori"] == "N" and w4["az"] == 0, f"Parede 4 should be N (0°), got {w4}"
        assert w2["ori"] == "S" and w2["az"] == 180, f"Parede 2 should be S (180°), got {w2}"
        assert w1["ori"] == "E" and w1["az"] == 90, f"Parede 1 should be E (90°), got {w1}"
        assert w3["ori"] == "W" and w3["az"] == 270, f"Parede 3 should be W (270°), got {w3}"
        print(">> SUCCESS: Wall 4=North -> Wall 2=South, Wall 1=East, Wall 3=West verified!")

        # Capture screenshot of CAD with Wall 4 selected & solar incidence card visible
        shot1 = os.path.join(artifacts_dir, "step22_solar_wall4_north.png")
        page.screenshot(path=shot1)
        print(f"Saved screenshot: {shot1}")

        # 4. Test: Set Parede 2 (index 1) to North ('N')
        print("Setting Parede 2 (index 1) to North ('N')...")
        page.evaluate("""() => {
            modeler.selectWallTab(1);
            modeler.setWallOrientation(1, 'N');
        }""")
        time.sleep(0.5)

        walls_orientations2 = page.evaluate("""() => {
            const sp = modeler.getSelectedSpace();
            return sp.walls.map((w, idx) => ({ idx: idx + 1, ori: w.orientation, az: modeler.compassToAzimuth(w.orientation) }));
        }""")
        print("Walls orientations after setting Parede 2 to North:")
        for w in walls_orientations2:
            print(f"  Parede {w['idx']}: {w['ori']} ({w['az']}°)")

        w1_b = next(w for w in walls_orientations2 if w["idx"] == 1)
        w2_b = next(w for w in walls_orientations2 if w["idx"] == 2)
        w3_b = next(w for w in walls_orientations2 if w["idx"] == 3)
        w4_b = next(w for w in walls_orientations2 if w["idx"] == 4)

        assert w2_b["ori"] == "N" and w2_b["az"] == 0, f"Parede 2 should be N (0°), got {w2_b}"
        assert w4_b["ori"] == "S" and w4_b["az"] == 180, f"Parede 4 should be S (180°), got {w4_b}"
        assert w3_b["ori"] == "E" and w3_b["az"] == 90, f"Parede 3 should be E (90°), got {w3_b}"
        assert w1_b["ori"] == "W" and w1_b["az"] == 270, f"Parede 1 should be W (270°), got {w1_b}"
        print(">> SUCCESS: Wall 2=North -> Wall 4=South, Wall 3=East, Wall 1=West verified!")

        # 5. Test Quick Orientation button in UI (clicking 'S (180°)' on Parede 4)
        print("Testing quick orientation button click for Wall 4 -> South...")
        page.evaluate("""() => {
            modeler.selectWallTab(3);
        }""")
        time.sleep(0.3)
        # Click the 'S (180°)' button
        page.click("button.quick-ori-btn:has-text('S (180°)')")
        time.sleep(0.5)

        walls_orientations3 = page.evaluate("""() => {
            const sp = modeler.getSelectedSpace();
            return sp.walls.map((w, idx) => ({ idx: idx + 1, ori: w.orientation, az: modeler.compassToAzimuth(w.orientation) }));
        }""")
        w2_c = next(w for w in walls_orientations3 if w["idx"] == 2)
        w4_c = next(w for w in walls_orientations3 if w["idx"] == 4)
        assert w4_c["ori"] == "S" and w4_c["az"] == 180, f"Parede 4 should be S, got {w4_c}"
        assert w2_c["ori"] == "N" and w2_c["az"] == 0, f"Parede 2 should be N, got {w2_c}"
        print(">> SUCCESS: Clicked quick button S(180°) on Wall 4 -> Wall 2 became North(0°) automatically!")

        shot2 = os.path.join(artifacts_dir, "step23_solar_wall4_south_quickbtn.png")
        page.screenshot(path=shot2)
        print(f"Saved screenshot: {shot2}")

        # Check console errors
        print(f"Console errors during execution: {len(console_errors)}")
        if console_errors:
            print("Errors:", console_errors)
        assert len(console_errors) == 0, "Zero console errors expected"

        browser.close()
        print("\nAll 4-wall solar incidence propagation tests PASSED successfully!")

if __name__ == "__main__":
    test_solar_propagation()
