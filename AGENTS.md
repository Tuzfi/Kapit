# Kapit 0.1 — REA Agent & Subagent Configuration (`morluto/rea`)

Este repositório inclui a skill e a arquitetura de agentes do **Reverse Engineer Anything (`morluto/rea` v6.5.0)**:

- **Skill Local Instalada**: [`.agents/skills/reverse-engineer-anything/SKILL.md`](file:///c:/Users/yanteles/Documents/Kapit/.agents/skills/reverse-engineer-anything/SKILL.md)
- **Servidor MCP Registrado**: `rea-agents` (`rea mcp` configurado para Antigravity, VS Code, OpenCode e Pi)
- **Subagentes Definidos**:
  1. `rea-hap-inspector`: Inspeciona os binários gerenciados e nativos do Carrier HAP 6.4 (`hap.exe`, `HAPGUI.dll`, `edesign.gui.dll`, `PlantsGUI01.dll`, `WizardsA.dll`, `WizardsB.dll`, `HAPCore64.dll`, `HAPDataHandler64.dll`, `eDesign.Core01.dll`, `eDesign.Plants01.dll`, `weather.db`) usando `rea inspect-managed-artifact`, `rea inspect-managed-members`, `rea inspect-pe-resources` e `rea inspect-sqlite-database`.
  2. `rea-qa-auditor`: Audita o código JavaScript/HTML/Python do **Kapit 0.1** usando `rea analyze-javascript-application`, `rea trace-javascript-semantics` e testes automatizados ponta-a-ponta, garantindo paridade funcional com o Carrier HAP 6.4.

## Regras de Engenharia Reversa e Paridade
- Nunca modificar nenhum arquivo dentro de `C:\Program Files (x86)\Carrier HAP 6.4`.
- Versão oficial do aplicativo: **Kapit 0.1**.
- Todas as categorias da árvore do HAP 6.4 devem permitir **Criar Novo (Create New)**, **Editar (Edit)**, **Duplicar (Duplicate)** e **Excluir (Delete)** com templates completos e recálculo automático.
- O modelador **2D/3D de Edifícios (`Building` & `Space Model`)** deve ser 100% interativo (desenhar ambientes com o mouse, mover, redimensionar, adicionar janelas/portas por parede, dividir em zonas Perímetro/Core, alternar pavimentos/níveis, rotacionar/dar zoom em 3D com o mouse e sincronizar automaticamente as áreas/volumes/paredes/janelas com os Espaços e Zonas do projeto).
