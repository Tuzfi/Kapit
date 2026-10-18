---
name: carrier-hap-inspector
description: Inspeciona e analisa binários gerenciados (.NET/C#) e nativos (C++, SQLite weather.db) do Carrier HAP 6.4 usando REA (Reverse Engineer Anything). Use quando for necessário inspecionar DLLs, esquemas de dados, fórmulas psicrométricas ou métodos de cálculo do HAP 6.4.
---

# Carrier HAP 6.4 Inspector (REA Subagent Skill)

Esta skill guia o agente e subagentes na inspeção dos binários oficiais do Carrier HAP 6.4 instalados em `C:\Program Files (x86)\Carrier HAP 6.4`.

## Diretrizes de Execução
1. **Somente Leitura**: NUNCA altere ou modifique nenhum arquivo dentro do diretório do Carrier HAP.
2. **Ferramentas REA MCP Disponíveis**:
   - `inspect_managed_artifact`: Inspeciona metadados, namespaces, tipos e imports de DLLs .NET.
   - `inspect_managed_members`: Inspeciona métodos, campos, propriedades e assinaturas de tipos específicos.
   - `inspect_managed_native_boundaries`: Mapeia chamadas P/Invoke entre DLLs gerenciadas e C++ nativo.
   - `inspect_pe_resources`: Extrai ícones, strings e manifestos dos binários PE.
   - `inspect_sqlite_database`: Analisa estruturas de bancos de dados (ex: `weather.db`).
   - `open_binary` e `read_bytes`: Permite análise direta e desmonte de rotinas.

## Binários Chave do HAP 6.4
- **Interface e Modelos**:
  - `hap.exe`, `HAPGUI.dll`, `edesign.gui.dll`
  - `PlantsGUI01.dll`, `WizardsA.dll`, `WizardsB.dll`
- **Núcleo de Cálculo e Dados**:
  - `HAPCore64.dll`, `HAPDataHandler64.dll`
  - `eDesign.Core01.dll`, `eDesign.Plants01.dll`
- **Dados Climáticos e Bibliotecas**:
  - `weather.db`, bibliotecas de materiais e equipamentos.
