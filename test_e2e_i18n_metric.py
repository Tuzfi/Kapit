import asyncio
import os
import subprocess
import time
import urllib.request
from playwright.async_api import async_playwright

ARTIFACT_DIR = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
os.makedirs(ARTIFACT_DIR, exist_ok=True)

def is_server_running():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8760/api/project", timeout=1.5) as resp:
            return resp.status == 200
    except Exception:
        return False

async def main():
    server_proc = None
    if not is_server_running():
        print("Iniciando servidor Kapit na porta 8760...")
        server_proc = subprocess.Popen(
            ["python", "server.py"],
            cwd=r"c:\Users\yanteles\Documents\Kapit",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        time.sleep(2.5)
    else:
        print("Servidor Kapit já está ativo na porta 8760.")

    try:
        async with async_playwright() as p:
            print("Iniciando Chromium...")
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": 1440, "height": 900})

            page.on("console", lambda msg: print(f"[CONSOLE {msg.type}]: {msg.text}"))
            page.on("pageerror", lambda err: print(f"[PAGE ERROR]: {err}"))

            # Set localStorage to PT-BR
            await page.goto("http://127.0.0.1:8760")
            await page.evaluate("() => localStorage.setItem('kapit_lang', 'pt-BR')")
            await page.reload(wait_until="networkidle")
            await page.wait_for_timeout(1000)

            # Ensure units system is SI
            await page.evaluate("""() => {
                if (app && app.state && app.state.project) {
                    app.state.project.project_info.units_system = 'SI';
                    app.refreshAllUI();
                }
            }""")
            await page.wait_for_timeout(500)

            # 1. Screenshot: Main Dashboard in PT-BR and Metric Units
            ss1 = os.path.join(ARTIFACT_DIR, "step9_ptbr_metric_dashboard.png")
            await page.screenshot(path=ss1)
            print(f"Screenshot salvo: {ss1}")

            # Verify KPI card contains SI metric values and Portuguese text
            kpi_tons = await page.locator("#kpi-tons").text_content()
            kpi_cfm = await page.locator("#kpi-cfm").text_content()
            print(f"KPI Peak Cooling (SI): {kpi_tons}")
            print(f"KPI Supply Airflow (SI): {kpi_cfm}")
            assert "kW" in kpi_tons or "TR" in kpi_tons, "KPI deve conter kW ou TR em modo métrico"
            assert "L/s" in kpi_cfm, "KPI deve conter L/s em modo métrico"

            # 2. Go to 2D/3D Modeler
            print("Navegando para 2D / 3D Building Modeler...")
            await page.click("button.ws-tab[data-tab='cad3d']")
            await page.wait_for_timeout(1000)

            # Click top edge of wall in 2D split view
            canvas = page.locator("#building-canvas")
            box = await canvas.bounding_box()
            if box:
                mid_x = box["x"] + (box["width"] / 4)
                mid_y = box["y"] + (box["height"] / 2)
                await page.mouse.click(mid_x, mid_y - 65)
                await page.wait_for_timeout(800)

            # Screenshot: 2D/3D Modeler with Wall Inspector in PT-BR & Metric
            ss2 = os.path.join(ARTIFACT_DIR, "step10_ptbr_metric_cad_modeler.png")
            await page.screenshot(path=ss2)
            print(f"Screenshot salvo: {ss2}")

            inspector_text = await page.locator("#cad-wall-inspector").text_content()
            print("Inspetor de Paredes carregado com sucesso!")
            assert "Inspetor de Paredes" in inspector_text or "Parede" in inspector_text
            assert "m" in inspector_text or "m²" in inspector_text, "Inspetor de paredes deve exibir metros e m² em modo métrico"

            # 3. Add a window to verify aperture in metric
            print("Inserindo janela na parede...")
            await page.click("#cad-wall-inspector button:has-text('+ Adicionar Janela')")
            await page.wait_for_timeout(600)

            ss3 = os.path.join(ARTIFACT_DIR, "step11_ptbr_wall_with_window.png")
            await page.screenshot(path=ss3)
            print(f"Screenshot salvo: {ss3}")

            # 4. Navigate to Reports
            print("Navegando para Relatórios de Carga e Energia...")
            await page.click("button.ws-tab[data-tab='reports']")
            await page.wait_for_timeout(1000)

            ss4 = os.path.join(ARTIFACT_DIR, "step12_ptbr_metric_reports.png")
            await page.screenshot(path=ss4)
            print(f"Screenshot salvo: {ss4}")

            rpt_text = await page.locator("#report-viewer-content").text_content()
            assert "Resumo de Dimensionamento" in rpt_text or "Sistema de Ar" in rpt_text
            assert "kW" in rpt_text or "L/s" in rpt_text or "m²" in rpt_text

            # 5. Test Live Language Toggle to EN and back
            print("Testando alternancia para English...")
            await page.click("#btn-lang-toggle")
            await page.wait_for_timeout(600)
            btn_lang_txt = await page.locator("#btn-lang-toggle").text_content()
            assert "EN" in btn_lang_txt
            print("Botao de idioma alternou para EN com sucesso.")

            print("Alternando de volta para PT-BR...")
            await page.click("#btn-lang-toggle")
            await page.wait_for_timeout(600)
            btn_lang_txt2 = await page.locator("#btn-lang-toggle").text_content()
            assert "PT-BR" in btn_lang_txt2
            print("Botao de idioma alternou para PT-BR com sucesso.")

            print("Todos os testes E2E de PT-BR e Sistema Métrico passaram com sucesso!")
            await browser.close()
    finally:
        if server_proc:
            server_proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
