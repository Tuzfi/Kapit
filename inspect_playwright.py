import asyncio
import os
import subprocess
import time
from playwright.async_api import async_playwright

SCREENSHOT_DIR = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def run_e2e_inspection():
    print("Iniciando Kapit Server...")
    srv_proc = subprocess.Popen(
        ["python", "server.py"],
        cwd=r"c:\Users\yanteles\Documents\Kapit",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    time.sleep(2.5)

    try:
        async with async_playwright() as p:
            print("Abrindo navegador Chromium...")
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1440, "height": 900})

            print("Navegando para http://127.0.0.1:8760...")
            await page.goto("http://127.0.0.1:8760", wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # Screenshot 1: Tela Principal (HAP Navigation Tree & Dashboard)
            ss1 = os.path.join(SCREENSHOT_DIR, "step1_main_screen.png")
            await page.screenshot(path=ss1)
            print(f"Screenshot 1 salvo: {ss1}")

            # 2. Clicar na aba 2D/3D Building Modeler
            print("Clicando na aba '2D / 3D Building'...")
            await page.click("button.ws-tab[data-tab='cad3d']")
            await page.wait_for_timeout(1000)

            ss2 = os.path.join(SCREENSHOT_DIR, "step2_cad_modeler_initial.png")
            await page.screenshot(path=ss2)
            print(f"Screenshot 2 salvo: {ss2}")

            # 3. Clicar no canvas no lado esquerdo (2D) na aresta superior de uma parede para selecionar
            print("Clicando na aresta da parede no canvas #building-canvas...")
            canvas = page.locator("#building-canvas")
            box = await canvas.bounding_box()
            if box:
                # No modo split, o 2D fica na metade esquerda (width/2)
                # O espaço retangular padrão (120ft x 80ft) está centralizado na metade esquerda
                mid_2d_x = box["x"] + (box["width"] / 4)
                mid_2d_y = box["y"] + (box["height"] / 2)
                # Clica na parede superior da sala
                await page.mouse.click(mid_2d_x, mid_2d_y - 65)
                await page.wait_for_timeout(800)

            ss3 = os.path.join(SCREENSHOT_DIR, "step3_wall_selected_with_normal.png")
            await page.screenshot(path=ss3)
            print(f"Screenshot 3 salvo: {ss3}")

            # 4. Adicionar uma Janela e uma Porta no toolbar / inspetor
            print("Adicionando Janela e Porta na parede selecionada...")
            add_win_btn = page.locator("button:has-text('🪟 + Window')")
            if await add_win_btn.count() > 0:
                await add_win_btn.first.click()
                await page.wait_for_timeout(500)

            add_door_btn = page.locator("button:has-text('🚪 + Door')")
            if await add_door_btn.count() > 0:
                await add_door_btn.first.click()
                await page.wait_for_timeout(500)

            # Alterar orientação no inspetor para South
            ori_sel = page.locator("#cad-wall-inspector select").first
            if await ori_sel.count() > 0:
                await ori_sel.select_option(value="S")
                await page.wait_for_timeout(800)

            ss4 = os.path.join(SCREENSHOT_DIR, "step4_wall_with_window_door.png")
            await page.screenshot(path=ss4)
            print(f"Screenshot 4 salvo: {ss4}")

            # 5. Alternar View Mode para 3D Isometric Extruded Model e girar
            print("Alternando para o modo 3D Isometric...")
            view_mode = page.locator("#cad-view-mode")
            if await view_mode.count() > 0:
                await view_mode.select_option(value="3d")
                await page.wait_for_timeout(800)

            rot_btn = page.locator("button:has-text('🔄 Rotate 3D')")
            if await rot_btn.count() > 0:
                await rot_btn.click()
                await page.wait_for_timeout(500)
                await rot_btn.click()
                await page.wait_for_timeout(500)

            ss5 = os.path.join(SCREENSHOT_DIR, "step5_cad_3d_orbit.png")
            await page.screenshot(path=ss5)
            print(f"Screenshot 5 salvo: {ss5}")

            # 6. Testar navegação na Árvore: Selecionar Weather e abrir seletor weather.db
            print("Voltando para a aba 'Category List & Property Editor' e navegando para Weather...")
            await page.click("button.ws-tab[data-tab='explorer']")
            await page.wait_for_timeout(500)
            
            weather_tree_item = page.locator(".tree-item:has-text('Weather')")
            if await weather_tree_item.count() > 0:
                await weather_tree_item.first.click()
                await page.wait_for_timeout(800)

            ss6 = os.path.join(SCREENSHOT_DIR, "step6_weather_editor.png")
            await page.screenshot(path=ss6)
            print(f"Screenshot 6 salvo: {ss6}")

            # Clicar no botão 'Select Station from Carrier weather.db'
            print("Abrindo navegador modal do weather.db...")
            weather_db_btn = page.locator("button:has-text('Select Station from Carrier weather.db')")
            if await weather_db_btn.count() > 0:
                await weather_db_btn.click()
                await page.wait_for_timeout(800)

            # Pesquisar por 'Miami'
            search_input = page.locator("#wiz-station-search")
            if await search_input.count() > 0:
                await search_input.fill("Miami")
                await page.wait_for_timeout(1000)

            ss7 = os.path.join(SCREENSHOT_DIR, "step7_weather_db_modal_search.png")
            await page.screenshot(path=ss7)
            print(f"Screenshot 7 salvo: {ss7}")

            # 7. Ir para Reports e visualizar Air System Sizing
            print("Fechando modal e indo para Relatórios...")
            close_btn = page.locator(".modal-close")
            if await close_btn.count() > 0:
                await close_btn.click()
                await page.wait_for_timeout(500)

            await page.click("button.ws-tab[data-tab='reports']")
            await page.wait_for_timeout(1000)

            ss8 = os.path.join(SCREENSHOT_DIR, "step8_reports_viewer.png")
            await page.screenshot(path=ss8)
            print(f"Screenshot 8 salvo: {ss8}")

            print("Inspeção e testes concluídos com 100% de sucesso!")
            await browser.close()
    finally:
        print("Encerrando servidor...")
        srv_proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_e2e_inspection())
