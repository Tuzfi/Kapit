# Kapit 0.1 — REA Agent & Subagent Configuration (`morluto/rea`)

Este repositório inclui a skill e a arquitetura de agentes do **Reverse Engineer Anything (`morluto/rea` v6.5.0)**:

- **Skill Local Instalada**: [`.agents/skills/reverse-engineer-anything/SKILL.md`](file:///c:/Users/yanteles/Documents/Kapit/.agents/skills/reverse-engineer-anything/SKILL.md)
- **Servidor MCP Registrado**: `rea-agents` (`rea mcp` configurado para Antigravity, VS Code, OpenCode e Pi)
- **Subagentes Definidos**:
  1. `rea-hap-inspector`: Inspeciona os binários gerenciados e nativos do Carrier HAP 6.4 (`hap.exe`, `HAPGUI.dll`, `edesign.gui.dll`, `PlantsGUI01.dll`, `WizardsA.dll`, `WizardsB.dll`, `HAPCore64.dll`, `HAPDataHandler64.dll`, `eDesign.Core01.dll`, `eDesign.Plants01.dll`, `weather.db`) usando `rea inspect-managed-artifact`, `rea inspect-managed-members`, `rea inspect-pe-resources` e `rea inspect-sqlite-database`.
  2. `rea-reverse-engineer`: Analisa e confronta evidências binárias, esquemas de dados, arquivos de projeto (.hap ZIP/LZIP, gbXML) e métodos de cálculo térmico/psicrometria ASHRAE.
  3. `rea-geometry-reconstructor`: Especialista no subsistema geométrico 2D/3D (WizardsB.dll FloorPlanGenerator, polígonos de ambientes, detecção de arestas/paredes com o mouse, cálculo de vetor normal e azimute solar N/NE/E/SE/S/SW/W/NW, inserção e renderização arquitetônica de janelas e portas em 2D/3D, rosa dos ventos/ViewCube e sincronização com Space Model).
  4. `rea-qa-auditor`: Audita o código JavaScript/HTML/Python do **Kapit 0.1** usando `rea analyze-javascript-application`, `rea trace-javascript-semantics` e testes de integridade, garantindo paridade funcional com o Carrier HAP 6.4.
  5. `rea-e2e-verifier`: Executa testes automatizados ponta-a-ponta (E2E) com Playwright em runtime, simulando cliques reais, desenho de ambientes, seleção de paredes, adição de esquadrias, rotação 3D e validação de ausência de erros no console.
  6. `rea-thermal-load-analyst`: Especialista em engenharia reversa das rotinas de cálculo térmico (HAPCore64.dll e eDesign.Core01.dll), isolando o núcleo estritamente necessário para cálculo de carga térmica de pico (dimensionamento de serpentinas, vazões de insuflamento e balanço térmico ASHRAE 183) e auditando módulos secundários dispensáveis (simulação anual 8760h, tarifas, centrais de água gelada, LEED v4).

## Regras de Engenharia Reversa e Paridade
- Nunca modificar nenhum arquivo dentro de `C:\Program Files (x86)\Carrier HAP 6.4`.
- Versão oficial do aplicativo: **Kapit 0.1**.
- Todas as categorias da árvore do HAP 6.4 devem permitir **Criar Novo (Create New)**, **Editar (Edit)**, **Duplicar (Duplicate)** e **Excluir (Delete)** com templates completos e recálculo automático.
- O modelador **2D/3D de Edifícios (`Building` & `Space Model`)** deve ser 100% interativo (desenhar ambientes com o mouse, mover, redimensionar, adicionar janelas/portas por parede, dividir em zonas Perímetro/Core, alternar pavimentos/níveis, rotacionar/dar zoom em 3D com o mouse e sincronizar automaticamente as áreas/volumes/paredes/janelas com os Espaços e Zonas do projeto).
