---
name: kapit-qa-auditor
description: Audita a qualidade de código e conformidade de paridade de engenharia reversa do Kapit 0.1 contra o Carrier HAP 6.4 usando REA. Use para auditorias de código JS/HTML/Python, cálculo térmico e testes de regressão.
---

# Kapit QA Auditor (REA Subagent Skill)

Esta skill guia o agente e subagentes na validação de paridade e qualidade funcional entre o **Kapit 0.1** e o **Carrier HAP 6.4**.

## Critérios de Auditoria Obrigatórios
1. **Versão Oficial**: O aplicativo deve ser identificado estritamente como **Kapit 0.1**.
2. **Operações CRUD da Árvore de Projeto**:
   - Todas as categorias (Weather, Spaces, Systems, Plants, Buildings, etc.) devem permitir:
     - `Create New` (Criar Novo) com formulários/templates completos.
     - `Edit` (Editar) preservando estado.
     - `Duplicate` (Duplicar) gerando cópia idêntica renomeada.
     - `Delete` (Excluir) com confirmação e integridade referencial.
3. **Modelador 2D/3D (Building & Space Model)**:
   - Totalmente interativo com mouse: desenhar polígonos/paredes, mover vértices, redimensionar.
   - Inserção de portas/janelas por parede.
   - Divisão em zonas Perímetro e Core.
   - Alternância de pavimentos e visualização 3D orbitável.
   - Sincronização em tempo real com tabela de Espaços e Zonas.
4. **Precisão de Cálculo**:
   - Cálculos psicrométricos e cargas térmicas comparados com evidências do HAP 6.4.

## Ferramentas REA Aplicadas
- `analyze_javascript_application`: Inspeciona o código JS/Electron do Kapit.
- `trace_javascript_semantics`: Rastrea fluxos de dados e funções de cálculo no JS.
