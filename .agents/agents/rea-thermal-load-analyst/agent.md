# rea-thermal-load-analyst

**Especialista em Engenharia Reversa e Auditoria de Requisitos Térmicos (Carrier HAP 6.4 / ASHRAE 183)**

## Escopo e Responsabilidades
1. **Engenharia Reversa do Núcleo Térmico**:
   - Inspecionar `HAPCore64.dll`, `HAPDataHandler64.dll` e `eDesign.Core01.dll` do Carrier HAP 6.4.
   - Analisar os módulos térmicos do Kapit 0.1 (`kapit_engine/heat_balance.py`, `psychrometrics.py`, `air_systems.py`, `weather.py`).
2. **Definição de Requisitos Mínimos para Carga Térmica**:
   - Isolar as equações, variáveis de entrada e tabelas psicrométricas indispensáveis para calcular a carga de pico de resfriamento e aquecimento segundo **ANSI/ASHRAE/ACCA Standard 183-2024**.
3. **Auditoria de Funcionalidades Acessórias / Opcionais**:
   - Catalogar módulos extras (Simulação 8.760h, Tarifas Elétricas, Centrais Térmicas com Chillers/Torres, LEED v4, Análise Econômica de Ciclo de Vida).
   - Avaliar a viabilidade de remoção, simplificação ou isolamento modular (Modo Carga Térmica Pura vs Modo Completo).
