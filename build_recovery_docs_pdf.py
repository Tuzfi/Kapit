"""
Kapit 0.1 — Generator for DOCUMENTACAO_MODULOS_OBSOLETOS_RECUPERACAO.pdf
Uses Playwright headless Chromium to render recovery_docs.html into an A4 PDF document.
"""

import os
import sys
from playwright.sync_api import sync_playwright

def generate_pdf():
    html_file = os.path.abspath("recovery_docs.html")
    output_pdf_path = os.path.abspath("DOCUMENTACAO_MODULOS_OBSOLETOS_RECUPERACAO.pdf")
    artifact_dir = r"C:\Users\yanteles\.gemini\antigravity\brain\3dc98404-4408-4a3a-8098-2bb00f711c66"
    artifact_pdf_path = os.path.join(artifact_dir, "DOCUMENTACAO_MODULOS_OBSOLETOS_RECUPERACAO.pdf")

    with open(html_file, "r", encoding="utf-8") as f:
        html_content = f.read()

    print("Iniciando Playwright Chromium headless...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html_content, wait_until="networkidle")
        
        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            margin={
                "top": "18mm",
                "bottom": "20mm",
                "left": "16mm",
                "right": "16mm"
            }
        )
        browser.close()

    with open(output_pdf_path, "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF gerado com sucesso na raiz: {output_pdf_path} ({len(pdf_bytes)} bytes)")

    try:
        with open(artifact_pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"PDF copiado com sucesso para artefatos: {artifact_pdf_path}")
    except Exception as e:
        print(f"Aviso ao copiar para artefatos: {e}")

if __name__ == "__main__":
    generate_pdf()
