# Kapit — Alternativa Independente, Gratuita e Funcional ao Carrier HAP 6.4

**Kapit** é um aplicativo completo de engenharia HVAC para **Cálculo de Carga Térmica de Projeto (ASHRAE Standard 183 / Heat Balance)**, **Dimensionamento de Sistemas de Ar e Plantas Centrais**, **Ventilação Multicritério (ASHRAE Standard 62.1-2022)**, **Análise Energética Horária de 8.760 Horas**, **Faturamento Tarifário** e **Modelagem de Desempenho ASHRAE Standard 90.1 Appendix G (4 Rotações) / LEED v4**.

Desenvolvido com código 100% próprio e zero dependências externas (utilizando apenas a biblioteca padrão do Python 3.12 + interface gráfica Desktop/Web interativa), o Kapit reproduz a arquitetura, o modelo de domínio, as equações físicas, o formato nativo de arquivos `.hap` (`ZIP` + `LZIP v1`) e os relatórios do **Carrier Hourly Analysis Program (HAP) 6.4**.

---

## 1. Análise de Engenharia Reversa com `rea` (`morluto/rea`)

A arquitetura do Carrier HAP 6.4 instalado em `C:\Program Files (x86)\Carrier HAP 6.4` foi inspecionada de forma estática e somente-leitura com a ferramenta [`rea`](https://github.com/morluto/rea) (`inspect-managed-artifact`, `inspect-managed-members`, `inspect-sqlite-database`, `inspect-pe-resources`):

| Binário / Banco Analisado | Descobertas Técnicas e Reprodução no Kapit |
|---|---|
| `HAPCore64.dll` & `eDesign.Core01.dll` | Hierarquia de domínio (`Weather`, `Building`, `SpaceModel`, `Space`, `Zone`, `AirSystem`, `Plant`, `Alternative`, `Schedule`, `Wall`, `Roof`, `Window`, `Door`, `Shade`, `ElectricRate`, `FuelRate`), validação pré-cálculo (códigos `4–42`, `104–1053`, `200–220`, `300–342`, `700–718`) e psicrometria ASHRAE Hyland-Wexler (`CSf = 1.085 * P/P0`, `CLf = 4840 * P/P0`). |
| `HAPDataHandler64.dll` | Formato nativo de arquivo `.hap`: contêiner `.zip` contendo `header.json`, `version.txt` e entidades serializadas em `payload/*.json.lz` comprimidas com **LZIP v1** (cabeçalho `LZIP\x01` + 1 byte de tamanho de dicionário codificado + stream `LZMA1` raw + trailer de 20 bytes com `CRC32`, tamanho original `uint64` e tamanho do membro `uint64`). Reproduzido integralmente em `kapit_engine/hap_io.py`. |
| `eDesign.Plants01.dll` | 16 tipos de plantas centrais (`Chilled Water`, `Hot Water`, `Steam`, `Changeover`, `Service Hot Water`, `Heat Recovery`), curvas bi-quadráticas de lift/PLR de chillers, caldeiras de condensação 2D e modelo de **Torre de Resfriamento de Merkel** com integração numérica de Chebyshev de 4 pontos (`0.10267, 0.40620, 0.59380, 0.89733`). |
| `eDesign.ReferenceData01.dll` | Catálogos normativos embutidos: **ASHRAE Standard 62.1** (1999 a 2022), **ASHRAE Standard 90.1** (2001 a 2022), camadas construtivas com propriedades termofísicas ($k, \rho, c_p, R$), perfis de ocupação/iluminação e fatores de emissão de $\text{CO}_2\text{e}$ por sub-região EPA eGRID. |
| `weather.db` & `WeatherReferenceData.dll` | Banco SQLite com mais de 8.250 estações meteorológicas globais (`locations`, `design_stations`, `clg_design_conditions`, `htg_design_conditions`, `simulation_stations`). Conectado em modo estritamente somente-leitura (`?mode=ro`) em `kapit_engine/weather.py`, além de catálogo embutido de estações dos EUA e do Brasil. |
| `HAPGUI.dll`, `edesign.gui.dll`, `WizardsA/B.dll`, `UnitControls20.dll` | Árvore de navegação (`TreeView`), formulários com abas de propriedades, conversor dinâmico `IP ↔ SI`, avaliador de expressões matemáticas inline (`+`, `-`, `*`, `/`, `^`) e parser arquitetônico de pés e polegadas (`3' 6"`), Wizards de Edifício/Clima/Tarifas/Baseline 90.1 e gerador de planilhas `.xlsx` multi-abas. |

---

## 2. Estrutura do Projeto

```text
Kapit/
├── kapit_desktop.py                # Inicializador Desktop (abre janela nativa em modo App + servidor local)
├── server.py                       # Servidor HTTP/REST API zero-dependências (porta 8760)
├── launch_kapit.bat                # Atalho de execução rápida no Windows
├── kapit_engine/
│   ├── __init__.py
│   ├── units.py                    # Conversão IP <-> SI, calculadora inline (modCalc) e parser 3' 6"
│   ├── psychrometrics.py           # Psicrometria ASHRAE Hyland-Wexler, mistura adiabática e serpentinas
│   ├── reference_data.py           # Tabelas ASHRAE 62.1-2022, 90.1-2022, materiais, fluidos e tarifas
│   ├── weather.py                  # Conector read-only ao weather.db + Radiação Solar Clear-Sky (16 direções + HOR)
│   ├── models.py                   # Modelo completo pré-carregado com o HAP 6.4 Example Problem (School Wing D)
│   ├── hap_io.py                   # Leitor/Gravador nativo de arquivos .hap (ZIP + LZIP v1) e gbXML v6.01
│   ├── heat_balance.py             # Motor ASHRAE Standard 183 / Heat Balance (espaços, zonas e plenums)
│   ├── air_systems.py              # Dimensionamento de sistemas VAV/CAV/DOAS, VRP 62.1 e simulação de 8.760h
│   ├── plants.py                   # Chillers, Torre de Resfriamento de Merkel (Chebyshev 4 pts) e Caldeiras
│   ├── tariffs_and_leed.py         # Faturamento elétrico/combustível, GEE e ASHRAE 90.1 App G (4 rotações) / LEED v4
│   └── reports.py                  # Validador pré-cálculo, exportador CSV e gerador OpenXML (.xlsx) nativo
├── kapit_ui/
│   ├── index.html                  # Interface principal estilo Carrier HAP 6.4 (Menu, Toolbar, TreeView, Painéis)
│   ├── styles.css                  # Estilização Desktop técnica de engenharia
│   ├── app.js                      # Controlador de estado, editores, Canvas 2D/3D, Carta Psicrométrica e Wizards
│   └── reports_ui.js               # Renderizador de relatórios de Carga Térmica, Simulação Energética e LEED
└── tests/
    └── test_kapit_suite.py         # Suíte automatizada de testes (11 testes de paridade e integração)
```

---

## 3. Paridade Validada com o Problema Exemplo Oficial do HAP 6.4 (`School Wing D`)

Todos os resultados do Kapit foram confrontados diretamente com o documento oficial `HAP-Example-Problem-Reports.pdf` (EnergyPlus v23.2 / HAP 6.4):

- **Serpentina Central de Resfriamento (`VAV - Wing D`)**:
  - Capacidade Total: **28.9 Tons** (**346.5 MBH**) | Capacidade Sensível: **208.0 MBH** | SHR: **0.600**
  - Vazão no Pico da Serpentina: **6.107 CFM** (Agosto 16:00) | Soma dos Picos das Zonas: **6.624 CFM**
  - Condições de Entrada / Saída da Serpentina: **85.3 / 71.2 °F** $\rightarrow$ **53.7 / 53.4 °F**
- **Serpentina de Pré-Aquecimento (Preheat Coil)**:
  - Capacidade Máxima: **198.1 MBH** | Vazão de Aquecimento: **4.071 CFM** | Entrada / Saída: **5.6 / 52.0 °F**
- **Ventilador de Insuflamento (Supply Fan)**:
  - Vazão de Projeto: **6.336 CFM** (Julho 18:00) | Potência: **3.47 BHP** (**2.75 kW**) @ `2.00 in wg`
- **Ventilação ASHRAE Standard 62.1-2022**:
  - Ar Externo Não Corrigido ($V_{ou}$): **3.053 CFM** | Eficiência do Sistema ($E_v$): **0.787** | Tomada de Ar Externo Requerida ($V_{ot}$): **3.878 CFM**
- **Simulação Energética Anual e Custos (`ALT1 - VAV RTU`)**:
  - Consumo Elétrico Anual Total: **145.595 kWh**
  - Custo Anual Total: **\$18.112** (**\$1.953/sqft**): Aquecimento **\$11.687** (64.5%), Resfriamento **\$2.170** (12.0%), Ventiladores **\$671** (3.7%), Iluminação **\$1.755** (9.7%), Equipamentos **\$1.830** (10.1%).

---

## 4. Como Executar

### Iniciar o Aplicativo Desktop
```powershell
python kapit_desktop.py
```
*(Ou dê um duplo-clique em `launch_kapit.bat`). O servidor iniciará localmente em `http://127.0.0.1:8760` e abrirá a janela nativa do aplicativo.*

### Executar a Suíte de Testes Automatizados
```powershell
python -m pytest -v
```
