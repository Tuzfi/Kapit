# Módulos Obsoletos / Acessórios — Kapit 0.1
## Arquivo de Preservação e Guia de Recuperação

Esta pasta contém o backup completo de todos os submódulos, regras de negócio e interfaces que foram removidos do núcleo principal do **Kapit 0.1** para transformar a aplicação em um **Núcleo Limpo de Carga Térmica (Clean Thermal Core - ANSI/ASHRAE/ACCA Standard 183-2024 e ASHRAE Standard 62.1-2022)**.

---

### Conteúdo Deste Diretório:

#### 1. `obsoleto/kapit_engine/`
- **`plants.py`**:
  - Motor de simulação de centrais térmicas de água gelada e água quente.
  - Inclui modelo de torre de resfriamento evaporativa de Merkel (integral de entalpia potencial com 4 nós de Chebyshev), curvas de carga parcial de chillers parafuso/centrífugos (COP, IPLV, PLR), caldeiras de condensação e bombas de circulação hidrônica.
- **`tariffs_and_leed.py`**:
  - Motor de faturamento de concessionárias de energia elétrica e gás.
  - Estruturas de tarifação horossazonais (ponta e fora de ponta), cobranças de demanda contratada com gatilho de 80% (ratchets) e impostos.
  - Motor de auditoria de sustentabilidade LEED v4 / ASHRAE Standard 90.1 Apêndice G, calculando as 4 rotações de linha de base (0°, 90°, 180°, 270°) e créditos de GEE (Gases de Efeito Estufa / CO2e).
- **`air_systems_full_with_8760h.py`**:
  - Versão original contendo o loop de simulação energética anual de 8.760 horas (`simulate_air_system_energy_8760h`), que iterava hora a hora os 365 dias do ano.
- **`reports_full_with_plants_and_leed.py`**:
  - Gerador de relatórios contendo os relatórios de simulação mensal 8760h, detalhes de faturamento elétrico (6 tabelas), relatório de chillers/torres/caldeiras e resumo LEED v4.
- **`models_full_with_plants_and_tariffs.py`**:
  - Esquema de dados completo com as 20 categorias do Carrier HAP (incluindo chillers, boilers, cooling towers, electric rates, fuel rates, alternatives).

#### 2. `obsoleto/kapit_ui/`
- **`index_full_with_plants_and_tariffs.html`**:
  - Interface original completa com árvore lateral de 20 categorias, assistente de tarifas e abas de centrais térmicas.
- **`app_full_with_plants_and_tariffs.js`**:
  - Controlador frontend com chamadas para centrais térmicas, tarifas e energia anual.
- **`reports_ui_full_with_plants_and_leed.js`**:
  - Visualizador de relatórios com as 13 opções completas do Carrier HAP.

#### 3. `obsoleto/tests/`
- **`test_kapit_suite_full.py`**:
  - Suíte de testes automatizados original cobrindo centrais térmicas e tarifas elétricas.

---

### Como Recuperar ou Restaurar Qualquer Módulo

Se no futuro você desejar restaurar qualquer funcionalidade acessória de volta ao sistema ativo:

#### Para Restaurar Centrais Térmicas (Chillers, Torres e Caldeiras):
1. Copie `obsoleto/kapit_engine/plants.py` de volta para `kapit_engine/plants.py`.
2. No arquivo `server.py`, reative a importação de `simulate_plants` e adicione a chamada no endpoint `/api/calculate`.
3. No arquivo `kapit_ui/app.js`, adicione `"plants"`, `"chillers"`, `"cooling_towers"` e `"boilers"` no array `TREE_CATEGORIES`.

#### Para Restaurar Simulação Anual de 8.760 Horas:
1. Em `kapit_engine/air_systems.py`, reincorpore a função `simulate_air_system_energy_8760h` a partir de `obsoleto/kapit_engine/air_systems_full_with_8760h.py`.
2. Em `kapit_engine/reports.py`, descomente os geradores dos relatórios `monthly_sim` e `component_costs`.

#### Para Restaurar Tarifas Elétricas e LEED v4:
1. Copie `obsoleto/kapit_engine/tariffs_and_leed.py` de volta para `kapit_engine/tariffs_and_leed.py`.
2. No arquivo `server.py`, reative `calculate_tariff_billing_and_costs` e `calculate_leed_and_ashrae_90_1_summary`.
