/**
 * Kapit 0.1 — Internationalization (i18n) & Metric/SI Formatting Engine (i18n.js)
 * Supports Portuguese (PT-BR) and English (EN) with live switching,
 * and unified Imperial (IP) vs Metric (SI) unit conversions.
 */

const I18N = {
  lang: localStorage.getItem("kapit_lang") || "pt-BR",

  dict: {
    "pt-BR": {
      // Header & Window Title
      "app.title": "Kapit 0.1 — Programa de Análise Horária (Cálculo Térmico HVAC, Dimensionamento e Simulação Energética)",
      "app.brand": "KAPIT 0.1",
      "app.pill_std183": "Norma ASHRAE 183 / Balanço Térmico",
      "app.pill_std62": "ASHRAE 62.1-2022 & 90.1-2022",

      // Menu Bar
      "menu.project": "Projeto",
      "menu.project.new": "Novo / Redefinir Problema Exemplo (Ctrl+N)",
      "menu.project.open": "Abrir Projeto (.hap / .kapit)...",
      "menu.project.load_example": "Carregar Exemplo Instalado HAP-6.4-Example-Problem.hap",
      "menu.project.save_json": "Salvar Projeto (.kapit JSON)",
      "menu.project.export_hap": "Exportar Arquivo Carrier HAP 6.4 (.hap)",
      "menu.project.import_gbxml": "Importar Geometria BIM gbXML...",
      "menu.project.export_gbxml": "Exportar Geometria BIM gbXML (.xml)",
      "menu.project.preferences": "Preferências (Unidades, Normas, LEED)...",

      "menu.edit": "Editar",
      "menu.edit.new": "Criar Novo Item... (Ins)",
      "menu.edit.duplicate": "Duplicar Item Selecionado (Ctrl+D)",
      "menu.edit.delete": "Excluir Item Selecionado (Del)",
      "menu.edit.properties": "Propriedades... (Enter)",
      "menu.edit.baseline": "Duplicar Alternativa como Linha de Base [B000] (ASHRAE 90.1)",

      "menu.view": "Exibir",
      "menu.view.explorer": "Navegador do Projeto e Editores",
      "menu.view.cad3d": "Planta Baixa 2D e Visualizador 3D do Edifício",
      "menu.view.psych": "Carta Psicrométrica Interativa",
      "menu.view.reports": "Visualizador de Relatórios de Carga e Energia",

      "menu.reports": "Relatórios",
      "menu.reports.sizing_summary": "1. Resumo de Dimensionamento do Sistema de Ar",
      "menu.reports.zone_sizing": "2. Resumo de Dimensionamento das Zonas",
      "menu.reports.ventilation": "3. Resumo de Ventilação e Ar Externo (ASHRAE 62.1)",
      "menu.reports.heat_balance": "4. Balanço Térmico do Sistema de Ar e Zonas",
      "menu.reports.psychrometrics": "5. Psicrometria do Sistema e Carta",
      "menu.reports.annual_costs": "6. Custos Anuais por Componente (Gráfico e Tabela)",
      "menu.reports.monthly_energy": "7. Consumo Mensal de Energia por Componente",
      "menu.reports.billing_details": "8. Detalhes de Faturamento - Elétrico",
      "menu.reports.monthly_sim": "9. Resultados da Simulação Mensal",
      "menu.reports.leed_summary": "10. Resumo ASHRAE 90.1 Apêndice G / LEED v4",
      "menu.reports.plant_report": "11. Relatório de Centrais de Água Gelada / Caldeiras",
      "menu.reports.input_data": "12. Relatórios de Dados de Entrada (Todas as Categorias)",
      "menu.reports.export_xlsx": "Exportar Pasta de Trabalho para Excel (.xlsx)",
      "menu.reports.export_sim_csv": "Exportar Simulação Mensal (.csv)",
      "menu.reports.export_zone_csv": "Exportar Dimensionamento de Zonas (.csv)",

      "menu.wizards": "Assistentes",
      "menu.wizards.weather": "Assistente de Clima (Busca Global de Estações)...",
      "menu.wizards.building": "Assistente de Planta e Espaços do Edifício...",
      "menu.wizards.equipment": "Assistente de Equipamentos HVAC e Centrais...",
      "menu.wizards.tariff": "Assistente de Tarifas de Energia (EIA / Brasil)...",

      "menu.documentation": "Documentação",
      "menu.documentation.std183": "Conformidade com ANSI/ASHRAE/ACCA Standard 183",
      "menu.documentation.leed": "Guia ASHRAE 90.1 Apêndice G e GEE do LEED v4",

      "menu.language": "Idioma",

      // Toolbar
      "toolbar.open_hap": "📂 Abrir .hap",
      "toolbar.save_hap": "💾 Salvar .hap",
      "toolbar.calc": "⚡ Calcular Carga e Energia",
      "toolbar.explorer": "📋 Propriedades",
      "toolbar.reports": "📊 Relatórios",
      "toolbar.building_2d3d": "🏢 Edifício 2D / 3D",
      "toolbar.psych": "📈 Psicrometria",
      "toolbar.wiz_weather": "🌍 Assistente de Clima",
      "toolbar.wiz_building": "📐 Assistente de Edifício",
      "toolbar.wiz_equipment": "❄️ Equipamentos HVAC",
      "toolbar.units_ip": "📐 Unidades: IP (Inglês)",
      "toolbar.units_si": "📐 Unidades: SI (Métrico)",
      "toolbar.lang_btn": "🌐 Idioma: PT-BR",
      "toolbar.calc_placeholder": "Calc: ex: 3' 6\" ou 120*0.85 ou 15.5+4",

      // Tree View Groups & Categories
      "tree.group_project": "Projeto",
      "tree.group_libraries": "Bibliotecas do Projeto",
      "tree.weather": "Clima",
      "tree.buildings": "Edifícios",
      "tree.space_models": "Modelos Espaciais",
      "tree.air_systems": "Sistemas de Ar",
      "tree.plants": "Centrais Térmicas",
      "tree.alternatives": "Alternativas",
      "tree.space_types": "Tipos de Espaço",
      "tree.schedules": "Horários / Agendamentos",
      "tree.walls": "Paredes",
      "tree.roofs": "Telhados / Coberturas",
      "tree.ceilings": "Forros e Tetos",
      "tree.floors": "Pisos e Lajes",
      "tree.windows": "Janelas / Esquadrias",
      "tree.doors": "Portas",
      "tree.shades": "Quebra-Sóis / Brises",
      "tree.chillers": "Chillers / Resfriadores",
      "tree.cooling_towers": "Torres de Resfriamento",
      "tree.boilers": "Caldeiras",
      "tree.electric_rates": "Tarifas Elétricas",
      "tree.fuel_rates": "Tarifas de Combustível",

      // KPI Card
      "kpi.title": "Resumo de Carga Térmica (ASHRAE 183)",
      "kpi.cooling": "Resfriamento de Pico:",
      "kpi.supply": "Insuflamento de Projeto:",
      "kpi.oa": "Ar Externo (62.1):",
      "kpi.heat": "Pré-aquecimento / Serpentina:",
      "kpi.shr": "Fator Calor Sensível (SHR):",
      "kpi.density": "Densidade Térmica:",

      // Tabs
      "tab.explorer": "📋 Lista de Categorias e Editor de Propriedades",
      "tab.cad3d": "🏢 Planta Baixa 2D e Modelo Extrudado 3D",
      "tab.psych": "🌡️ Carta Psicrométrica e Calculadora de Estados",
      "tab.reports": "📄 Relatórios de Carga Térmica e Energia (Formato HAP 6.4)",

      // Entity List & Actions
      "actions.new": "+ Criar Novo (Ins)",
      "actions.duplicate": "📋 Duplicar (Ctrl+D)",
      "actions.delete": "🗑️ Excluir (Del)",
      "actions.apply_calc": "Aplicar e Recalcular",
      "list.th_name": "Nome",
      "list.th_type": "Tipo / Detalhes",
      "list.th_summary": "Parâmetro Resumo",
      "list.create_hint": "<Criar Novo Item de {cat}...>",

      // Modeler 2D / 3D
      "cad.level": "Pavimento:",
      "cad.tool_select": "👆 Selecionar / Mover",
      "cad.tool_draw_rect": "📐 Desenhar Ambiente (Arrastar)",
      "cad.tool_enter_dim": "⌨️ Inserir por Medidas (LxC)",
      "cad.tool_split_perim": "✂️ Dividir Perímetro/Núcleo",
      "cad.tool_add_window": "🪟 + Janela",
      "cad.tool_add_door": "🚪 + Porta",
      "cad.tool_delete_room": "🗑️ Excluir Ambiente",
      "cad.ctx_create_dim": "⌨️ Criar Ambiente por Dimensões (Largura x Comprimento)...",
      "cad.ctx_draw_rect": "📐 Desenhar Ambiente com o Mouse (Arrastar)",
      "cad.ctx_resize_dim": "📏 Redimensionar Ambiente por Dimensões (LxC)...",
      "cad.ctx_duplicate": "📋 Duplicar este Ambiente (Ctrl+D)",
      "cad.ctx_split": "✂️ Dividir em Zonas Perímetro/Núcleo",
      "cad.ctx_add_win": "🪟 + Adicionar Janela nesta Parede",
      "cad.ctx_add_door": "🚪 + Adicionar Porta nesta Parede",
      "cad.ctx_delete": "🗑️ Excluir este Ambiente (Del)",
      "cad.ctx_fit": "🔍 Ajustar Vista (Fit View)",
      "cad.ctx_rot3d": "🔄 Girar Modelo 3D (45°)",
      "cad.dim_modal_title": "Criar Ambiente por Dimensões (Largura x Comprimento)",
      "cad.dim_modal_title_resize": "Redimensionar Ambiente por Dimensões",
      "cad.dim_modal_desc": "Digite a largura e comprimento (ex: 12x8, 15.5 x 10, 30' x 20' ou 10m x 8m)",
      "cad.dim_input_label": "Dimensões Rápidas (Largura x Comprimento):",
      "cad.dim_width_label": "Largura",
      "cad.dim_length_label": "Comprimento / Profundidade",
      "cad.dim_ceiling_label": "Pé-direito",
      "cad.dim_name_label": "Nome do Ambiente:",
      "cad.dim_type_label": "Uso do Espaço (ASHRAE 62.1):",
      "cad.dim_btn_create": "Inserir Ambiente na Planta",
      "cad.dim_btn_resize": "Aplicar Novas Dimensões",
      "cad.view_mode": "Modo de Visualização:",
      "cad.view_split": "Dividido: Planta 2D + Isométrica 3D",
      "cad.view_2d": "Planta Baixa Arquitetônica 2D",
      "cad.view_3d": "Modelo Isométrico 3D Extrudado",
      "cad.color_by": "Colorir Por:",
      "cad.color_zone": "Zona Térmica HVAC",
      "cad.color_load": "Intensidade de Carga Térmica",
      "cad.color_usage": "Uso do Espaço ASHRAE 62.1",
      "cad.fit_view": "🔍 Ajustar Vista",
      "cad.rotate_3d": "🔄 Girar 3D",
      "cad.selection_hint": "Clique em um ambiente para selecionar ou arraste para mover. Use 'Desenhar Ambiente' para criar novos espaços.",
      "cad.orbit_hint": "3D: Arraste com o botão esquerdo para orbitar e use a roda do mouse para zoom.",
      "cad.empty_inspector": "👈 Clique em qualquer ambiente na planta baixa para inspecionar suas paredes, definir orientações solares (Norte, Sul, Leste, Oeste), tipos de parede e adicionar janelas ou portas.",
      "cad.wall_inspector_title": "Inspetor de Paredes e Esquadrias (Direções, Janelas e Portas)",
      "cad.wall_tab_prefix": "Parede",
      "cad.orientation_label": "Orientação / Exposição Solar (Direção da Parede):",
      "cad.assembly_label": "Montagem Construtiva da Parede (Tipo de Parede):",
      "cad.length": "Comprimento:",
      "cad.ceiling_height": "Pé-direito:",
      "cad.gross_area": "Área Bruta:",
      "cad.windows_area": "Janelas:",
      "cad.doors_area": "Portas:",
      "cad.net_area": "Área Líquida de Condução:",
      "cad.windows_col_title": "Janelas na Parede",
      "cad.doors_col_title": "Portas na Parede",
      "cad.add_win_btn": "+ Adicionar Janela",
      "cad.add_door_btn": "+ Adicionar Porta",
      "cad.no_windows": "Nenhuma janela nesta parede. Clique em '+ Adicionar Janela' acima para inserir.",
      "cad.no_doors": "Nenhuma porta nesta parede. Clique em '+ Adicionar Porta' acima para inserir.",
      "cad.level_opt_1": "Nível 1",
      "cad.level_opt_2": "Nível 2",
      "cad.auto_propagate_label": "Calcular automaticamente as outras 3 paredes (90° / 180° / 270°)",
      "cad.solar_incidence_title": "☀️ Ângulo de Incidência Solar & Azimute",
      "cad.wall_azimuth_label": "Azimute Solar da Parede:",
      "cad.opposite_wall_label": "Parede Oposta (180°):",
      "cad.adjacent_walls_label": "Paredes Perpendiculares (90° / 270°):",
      "cad.peak_solar_flux_label": "Radiação Solar de Pico:",
      "cad.quick_orientations": "Atalhos Rápidos de Orientação:",
      "cad.ctx_orient_title": "🧭 Definir Orientação Solar (Sincronizar as 4 Paredes)...",

      // Compass Cardinals
      "compass.N": "Norte (N - 0°)",
      "compass.NNE": "Norte-Nordeste (NNE - 22.5°)",
      "compass.NE": "Nordeste (NE - 45°)",
      "compass.ENE": "Leste-Nordeste (ENE - 67.5°)",
      "compass.E": "Leste (L / E - 90°)",
      "compass.ESE": "Leste-Sudeste (ESE - 112.5°)",
      "compass.SE": "Sudeste (SE - 135°)",
      "compass.SSE": "Sul-Sudeste (SSE - 157.5°)",
      "compass.S": "Sul (S - 180°)",
      "compass.SSW": "Sul-Sudoeste (SSO - 202.5°)",
      "compass.SW": "Sudoeste (SO / SW - 225°)",
      "compass.WSW": "Oeste-Sudoeste (OSO - 247.5°)",
      "compass.W": "Oeste (O / W - 270°)",
      "compass.WNW": "Oeste-Noroeste (ONO - 292.5°)",
      "compass.NW": "Noroeste (NO / NW - 315°)",
      "compass.NNW": "Norte-Noroeste (NNO - 337.5°)",
      "compass.Partition": "Parede Interna / Divisória (Partition)",
      "compass.Underground": "Subsolo / Parede Enterrada (Underground)",

      // Psychrometrics
      "psych.title": "Carta Psicrométrica ASHRAE Corrigida por Altitude",
      "psych.state_calc": "Calculadora Interativa de Pontos de Estado",
      "psych.flow": "Vazão de Ar:",
      "psych.db": "Bulbo Seco:",
      "psych.wb": "Bulbo Úmido:",
      "psych.calc_btn": "Calcular Estado Psicrométrico",
      "psych.cycle_title": "Pontos de Estado do Ciclo do Sistema de Ar",
      "psych.th_point": "Ponto de Estado",
      "psych.th_flow": "Vazão",
      "psych.th_db": "TBS",
      "psych.th_wb": "TBU",
      "psych.th_rh": "UR (%)",
      "psych.th_h": "Entalpia h",

      // Reports Page
      "rpt.select_label": "Selecionar Relatório:",
      "rpt.btn_print": "🖨️ Imprimir / Salvar PDF",
      "rpt.btn_xlsx": "📗 Exportar Excel (.xlsx)",
      "rpt.btn_csv": "📄 Exportar CSV (.csv)",

      // Modals
      "modal.close": "Fechar",
      "modal.cancel": "Cancelar",
      "modal.apply": "Aplicar",
      "modal.ok": "OK / Salvar",
      "pref.title": "Preferências do Projeto (Unidades, Normas ASHRAE e Idioma)",
      "pref.name": "Nome do Projeto",
      "pref.units": "Sistema de Unidades de Medida",
      "pref.units_ip": "Inglês / Imperial (IP — °F, ft, sqft, CFM, Tons)",
      "pref.units_si": "Métrico / Internacional (SI — °C, m, m², L/s, kW/TR)",
      "pref.lang": "Idioma da Interface",
      "pref.lang_pt": "Português (Brasil) — PT-BR",
      "pref.lang_en": "English (United States) — EN",
      "pref.vent": "Norma de Ventilação e Ar Externo",
      "pref.energy": "Norma de Eficiência Energética",
      "pref.save_btn": "Salvar Preferências",

      // Status Bar
      "status.vent_prefix": "Norma de Ventilação:",
      "status.energy_prefix": "Norma de Energia:",
      "status.units_prefix": "Unidades:",
      "status.units_ip": "Inglês (IP)",
      "status.units_si": "Métrico (SI)",
      "status.ready": "Pronto — Projeto Calculado (0 Erros de Validação)",
      "status.recalculating": "Recalculando balanço térmico...",
    },

    "en": {
      // Header & Window Title
      "app.title": "Kapit 0.1 — Hourly Analysis Program (HVAC Load, Sizing, Plant & Energy Modeling)",
      "app.brand": "KAPIT 0.1",
      "app.pill_std183": "ASHRAE Standard 183 / Heat Balance",
      "app.pill_std62": "ASHRAE 62.1-2022 & 90.1-2022",

      // Menu Bar
      "menu.project": "Project",
      "menu.project.new": "New / Reset Example Problem (Ctrl+N)",
      "menu.project.open": "Open Project (.hap / .kapit)...",
      "menu.project.load_example": "Load Installed HAP-6.4-Example-Problem.hap",
      "menu.project.save_json": "Save Project (.kapit JSON)",
      "menu.project.export_hap": "Export Carrier HAP 6.4 Archive (.hap)",
      "menu.project.import_gbxml": "Import gbXML BIM Geometry...",
      "menu.project.export_gbxml": "Export gbXML BIM Geometry (.xml)",
      "menu.project.preferences": "Preferences (Units, Standards, LEED)...",

      "menu.edit": "Edit",
      "menu.edit.new": "Create New Item... (Ins)",
      "menu.edit.duplicate": "Duplicate Selected Item (Ctrl+D)",
      "menu.edit.delete": "Delete Selected Item (Del)",
      "menu.edit.properties": "Properties... (Enter)",
      "menu.edit.baseline": "Duplicate Alternative as Baseline [B000] (ASHRAE 90.1)",

      "menu.view": "View",
      "menu.view.explorer": "Project Explorer & Editors",
      "menu.view.cad3d": "2D Floor Plan & 3D Building Viewer",
      "menu.view.psych": "Interactive Psychrometric Chart",
      "menu.view.reports": "Design Load & Energy Reports Viewer",

      "menu.reports": "Reports",
      "menu.reports.sizing_summary": "1. Air System Sizing Summary",
      "menu.reports.zone_sizing": "2. Zone Sizing Summary",
      "menu.reports.ventilation": "3. Ventilation Sizing Summary (ASHRAE 62.1)",
      "menu.reports.heat_balance": "4. Air System & Zone Heat Balance Summary",
      "menu.reports.psychrometrics": "5. System Psychrometrics & Chart",
      "menu.reports.annual_costs": "6. Annual Component Costs (Pie Chart & Table)",
      "menu.reports.monthly_energy": "7. Monthly Energy Use by Component",
      "menu.reports.billing_details": "8. Billing Details - Electric",
      "menu.reports.monthly_sim": "9. Monthly Simulation Results",
      "menu.reports.leed_summary": "10. ASHRAE 90.1 Appendix G / LEED v4 Summary",
      "menu.reports.plant_report": "11. Chiller, Cooling Tower & Boiler Plant Report",
      "menu.reports.input_data": "12. Input Data Reports (All Categories)",
      "menu.reports.export_xlsx": "Export Workbook to Excel (.xlsx)",
      "menu.reports.export_sim_csv": "Export Monthly Simulation (.csv)",
      "menu.reports.export_zone_csv": "Export Zone Sizing (.csv)",

      "menu.wizards": "Wizards",
      "menu.wizards.weather": "Weather Wizard (Global Station Search)...",
      "menu.wizards.building": "Building Footprint & Space Wizard...",
      "menu.wizards.equipment": "HVAC Equipment & Plant Wizard...",
      "menu.wizards.tariff": "Utility Rate Wizard (EIA / Brasil)...",

      "menu.documentation": "Documentation",
      "menu.documentation.std183": "Compliance with ANSI/ASHRAE/ACCA Standard 183",
      "menu.documentation.leed": "ASHRAE 90.1 Appendix G & LEED v4 GHG Guide",

      "menu.language": "Language",

      // Toolbar
      "toolbar.open_hap": "📂 Open .hap",
      "toolbar.save_hap": "💾 Save .hap",
      "toolbar.calc": "⚡ Calculate Design & Energy",
      "toolbar.explorer": "📋 Properties",
      "toolbar.reports": "📊 Reports Viewer",
      "toolbar.building_2d3d": "🏢 2D / 3D Building",
      "toolbar.psych": "📈 Psychrometrics",
      "toolbar.wiz_weather": "🌍 Weather Wizard",
      "toolbar.wiz_building": "📐 Building Wizard",
      "toolbar.wiz_equipment": "❄️ Equipment Wizard",
      "toolbar.units_ip": "📐 Units: IP (English)",
      "toolbar.units_si": "📐 Units: SI (Metric)",
      "toolbar.lang_btn": "🌐 Lang: EN",
      "toolbar.calc_placeholder": "Calc: e.g. 3' 6\" or 120*0.85",

      // Tree View Groups & Categories
      "tree.group_project": "Project",
      "tree.group_libraries": "Project Libraries",
      "tree.weather": "Weather",
      "tree.buildings": "Buildings",
      "tree.space_models": "Space Models",
      "tree.air_systems": "Systems",
      "tree.plants": "Plants",
      "tree.alternatives": "Alternatives",
      "tree.space_types": "Space Types",
      "tree.schedules": "Schedules",
      "tree.walls": "Walls",
      "tree.roofs": "Roofs",
      "tree.ceilings": "Ceilings",
      "tree.floors": "Floors",
      "tree.windows": "Windows",
      "tree.doors": "Doors",
      "tree.shades": "Shades",
      "tree.chillers": "Chillers",
      "tree.cooling_towers": "Cooling Towers",
      "tree.boilers": "Boilers",
      "tree.electric_rates": "Electric Rates",
      "tree.fuel_rates": "Fuel Rates",

      // KPI Card
      "kpi.title": "Peak Thermal Load Summary (ASHRAE 183)",
      "kpi.cooling": "Peak Cooling:",
      "kpi.supply": "Supply Design:",
      "kpi.oa": "Outdoor Air (62.1):",
      "kpi.heat": "Preheat Coil:",
      "kpi.shr": "Sensible Heat Ratio (SHR):",
      "kpi.density": "Thermal Density:",

      // Tabs
      "tab.explorer": "📋 Category List & Property Editor",
      "tab.cad3d": "🏢 2D Floor Plan & 3D Extruded Model",
      "tab.psych": "🌡️ System Psychrometric Chart & Calculator",
      "tab.reports": "📄 Design Load & Energy Reports (HAP 6.4 Format)",

      // Entity List & Actions
      "actions.new": "+ Create New (Ins)",
      "actions.duplicate": "📋 Duplicate (Ctrl+D)",
      "actions.delete": "🗑️ Delete (Del)",
      "actions.apply_calc": "Apply & Recalculate",
      "list.th_name": "Name",
      "list.th_type": "Type / Details",
      "list.th_summary": "Summary Parameter",
      "list.create_hint": "<Create New {cat} Item...>",

      // Modeler 2D / 3D
      "cad.level": "Level:",
      "cad.tool_select": "👆 Select / Move",
      "cad.tool_draw_rect": "📐 Draw Room (Drag)",
      "cad.tool_enter_dim": "⌨️ Enter Dimensions (WxL)",
      "cad.tool_split_perim": "✂️ Split Perim/Core",
      "cad.tool_add_window": "🪟 + Window",
      "cad.tool_add_door": "🚪 + Door",
      "cad.tool_delete_room": "🗑️ Delete Room",
      "cad.ctx_create_dim": "⌨️ Create Space by Dimensions (Width x Length)...",
      "cad.ctx_draw_rect": "📐 Draw Room with Mouse (Drag)",
      "cad.ctx_resize_dim": "📏 Resize Selected Space by Dimensions (WxL)...",
      "cad.ctx_duplicate": "📋 Duplicate this Space (Ctrl+D)",
      "cad.ctx_split": "✂️ Split Perimeter / Core",
      "cad.ctx_add_win": "🪟 + Add Window to this Wall",
      "cad.ctx_add_door": "🚪 + Add Door to this Wall",
      "cad.ctx_delete": "🗑️ Delete this Space (Del)",
      "cad.ctx_fit": "🔍 Fit View",
      "cad.ctx_rot3d": "🔄 Rotate 3D Model (45°)",
      "cad.dim_modal_title": "Create Space by Dimensions (Width x Length)",
      "cad.dim_modal_title_resize": "Resize Space by Dimensions",
      "cad.dim_modal_desc": "Type width and length (e.g. 12x8, 15.5 x 10, 30' x 20' or 10m x 8m)",
      "cad.dim_input_label": "Quick Dimensions (Width x Length):",
      "cad.dim_width_label": "Width",
      "cad.dim_length_label": "Length / Depth",
      "cad.dim_ceiling_label": "Ceiling Height",
      "cad.dim_name_label": "Space Name:",
      "cad.dim_type_label": "Usage Archetype (ASHRAE 62.1):",
      "cad.dim_btn_create": "Insert Space into Plan",
      "cad.dim_btn_resize": "Apply New Dimensions",
      "cad.view_mode": "View Mode:",
      "cad.view_split": "Split 2D Floor Plan + 3D Extruded",
      "cad.view_2d": "2D Architectural Floor Plan",
      "cad.view_3d": "3D Isometric Extruded Model",
      "cad.color_by": "Color By:",
      "cad.color_zone": "HVAC Thermal Zone",
      "cad.color_load": "Peak Cooling Intensity",
      "cad.color_usage": "ASHRAE 62.1 Space Usage",
      "cad.fit_view": "🔍 Fit View",
      "cad.rotate_3d": "🔄 Rotate 3D",
      "cad.selection_hint": "Click a room to select or drag to move. Use 'Draw Room' to sketch new spaces.",
      "cad.orbit_hint": "3D: Left drag to orbit, mouse wheel to zoom.",
      "cad.empty_inspector": "👈 Click on any room on the floor plan to inspect its walls, set orientations (North, South, East, West), assemblies, and add windows or doors.",
      "cad.wall_inspector_title": "Wall & Openings Inspector (Orientations, Windows & Doors)",
      "cad.wall_tab_prefix": "Wall",
      "cad.orientation_label": "Orientation / Solar Exposure:",
      "cad.assembly_label": "Wall Construction Assembly:",
      "cad.length": "Length:",
      "cad.ceiling_height": "Floor-to-Ceiling:",
      "cad.gross_area": "Gross Wall:",
      "cad.windows_area": "Windows:",
      "cad.doors_area": "Doors:",
      "cad.net_area": "Net Conduction Area:",
      "cad.windows_col_title": "Windows on Wall",
      "cad.doors_col_title": "Doors on Wall",
      "cad.add_win_btn": "+ Add Window",
      "cad.add_door_btn": "+ Add Door",
      "cad.no_windows": "No windows on this wall. Click '+ Add Window' above to insert.",
      "cad.no_doors": "No doors on this wall. Click '+ Add Door' above to insert.",
      "cad.level_opt_1": "Level 1",
      "cad.level_opt_2": "Level 2",
      "cad.auto_propagate_label": "Auto-calculate the other 3 walls (90° / 180° / 270°)",
      "cad.solar_incidence_title": "☀️ Solar Incidence Angle & Azimuth",
      "cad.wall_azimuth_label": "Wall Solar Azimuth:",
      "cad.opposite_wall_label": "Opposite Wall (180°):",
      "cad.adjacent_walls_label": "Perpendicular Walls (90° / 270°):",
      "cad.peak_solar_flux_label": "Peak Solar Flux:",
      "cad.quick_orientations": "Quick Orientation Presets:",
      "cad.ctx_orient_title": "🧭 Set Solar Orientation (Synchronize 4 Walls)...",

      // Compass Cardinals
      "compass.N": "North (N - 0°)",
      "compass.NNE": "North-Northeast (NNE - 22.5°)",
      "compass.NE": "Northeast (NE - 45°)",
      "compass.ENE": "East-Northeast (ENE - 67.5°)",
      "compass.E": "East (E - 90°)",
      "compass.ESE": "East-Southeast (ESE - 112.5°)",
      "compass.SE": "Southeast (SE - 135°)",
      "compass.SSE": "South-Southeast (SSE - 157.5°)",
      "compass.S": "South (S - 180°)",
      "compass.SSW": "South-Southwest (SSW - 202.5°)",
      "compass.SW": "Southwest (SW - 225°)",
      "compass.WSW": "West-Southwest (WSW - 247.5°)",
      "compass.W": "West (W - 270°)",
      "compass.WNW": "West-Northwest (WNW - 292.5°)",
      "compass.NW": "Northwest (NW - 315°)",
      "compass.NNW": "North-Northwest (NNW - 337.5°)",
      "compass.Partition": "Interior Partition",
      "compass.Underground": "Underground / Below Grade",

      // Psychrometrics
      "psych.title": "ASHRAE Sea-Level / Altitude-Corrected Psychrometric Chart",
      "psych.state_calc": "Interactive State Point Calculator",
      "psych.flow": "Airflow:",
      "psych.db": "Dry-Bulb:",
      "psych.wb": "Wet-Bulb:",
      "psych.calc_btn": "Compute Psychrometric State",
      "psych.cycle_title": "System Cycle State Points",
      "psych.th_point": "Point",
      "psych.th_flow": "Airflow",
      "psych.th_db": "DB",
      "psych.th_wb": "WB",
      "psych.th_rh": "RH (%)",
      "psych.th_h": "Enthalpy h",

      // Reports Page
      "rpt.select_label": "Select Report:",
      "rpt.btn_print": "🖨️ Print / Save PDF",
      "rpt.btn_xlsx": "📗 Export Excel (.xlsx)",
      "rpt.btn_csv": "📄 Export CSV (.csv)",

      // Modals
      "modal.close": "Close",
      "modal.cancel": "Cancel",
      "modal.apply": "Apply",
      "modal.ok": "OK / Save",
      "pref.title": "Project Preferences (Units, ASHRAE Standards & Language)",
      "pref.name": "Project Name",
      "pref.units": "Measurement Units",
      "pref.units_ip": "English / Imperial (IP — °F, ft, sqft, CFM, Tons)",
      "pref.units_si": "Metric / International (SI — °C, m, m², L/s, kW/TR)",
      "pref.lang": "User Interface Language",
      "pref.lang_pt": "Portuguese (Brazil) — PT-BR",
      "pref.lang_en": "English (United States) — EN",
      "pref.vent": "Ventilation Standard",
      "pref.energy": "Energy Standard",
      "pref.save_btn": "Save Preferences",

      // Status Bar
      "status.vent_prefix": "Ventilation Standard:",
      "status.energy_prefix": "Energy Standard:",
      "status.units_prefix": "Units:",
      "status.units_ip": "English (IP)",
      "status.units_si": "Metric (SI)",
      "status.ready": "Ready — Project Calculated (0 Validation Errors)",
      "status.recalculating": "Recalculating heat balance...",
    }
  },

  t(key, params = {}) {
    const currentLang = this.getLanguage();
    const table = this.dict[currentLang] || this.dict["en"];
    let text = table[key] || (this.dict["en"] && this.dict["en"][key]) || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
    return text;
  },

  getLanguage() {
    return this.lang || "pt-BR";
  },

  setLanguage(newLang) {
    if (newLang !== "pt-BR" && newLang !== "en") newLang = "pt-BR";
    this.lang = newLang;
    try {
      localStorage.setItem("kapit_lang", newLang);
    } catch (e) {}
    this.applyTranslationsToDOM();
    if (typeof app !== "undefined" && app.refreshAllUI) {
      app.refreshAllUI();
    }
  },

  toggleLanguage() {
    const next = this.getLanguage() === "pt-BR" ? "en" : "pt-BR";
    this.setLanguage(next);
  },

  isSI() {
    if (typeof app !== "undefined" && app.state && app.state.project && app.state.project.project_info) {
      return app.state.project.project_info.units_system === "SI";
    }
    return false;
  },

  // ---------------------------------------------------------
  // Unit Formatting Helpers (Converts internally stored IP values to SI if active)
  // ---------------------------------------------------------
  formatLength(ft, decimals = 2) {
    if (this.isSI()) {
      const m = ft * 0.3048;
      return `${m.toFixed(decimals)} m`;
    }
    return `${Number(ft).toFixed(decimals)} ft`;
  },

  formatArea(sqft, decimals = 1) {
    if (this.isSI()) {
      const m2 = sqft * 0.09290304;
      return `${m2.toFixed(decimals)} m²`;
    }
    return `${Number(sqft).toFixed(decimals)} sqft`;
  },

  formatVolume(cuft, decimals = 1) {
    if (this.isSI()) {
      const m3 = cuft * 0.0283168466;
      return `${m3.toFixed(decimals)} m³`;
    }
    return `${Number(cuft).toFixed(decimals)} cuft`;
  },

  formatTemp(f, decimals = 1) {
    if (this.isSI()) {
      const c = (f - 32.0) * 5.0 / 9.0;
      return `${c.toFixed(decimals)} °C`;
    }
    return `${Number(f).toFixed(decimals)} °F`;
  },

  formatDeltaTemp(df, decimals = 1) {
    if (this.isSI()) {
      const dk = df * 5.0 / 9.0;
      return `${dk.toFixed(decimals)} K`;
    }
    return `${Number(df).toFixed(decimals)} °F`;
  },

  formatAirflow(cfm, decimals = 0) {
    if (this.isSI()) {
      const ls = cfm * 0.47194745;
      return `${ls.toFixed(decimals)} L/s`;
    }
    return `${Number(cfm).toLocaleString(undefined, { maximumFractionDigits: decimals })} CFM`;
  },

  formatCooling(tons, decimals = 1) {
    if (this.isSI()) {
      const kw = tons * 3.51685284;
      return `${kw.toFixed(decimals)} kW (${Number(tons).toFixed(decimals)} TR)`;
    }
    const mbh = tons * 12.0;
    return `${Number(tons).toFixed(decimals)} Tons (${mbh.toFixed(decimals)} MBH)`;
  },

  formatHeat(mbh, decimals = 1) {
    if (this.isSI()) {
      const kw = mbh * 0.29307107;
      return `${kw.toFixed(decimals)} kW`;
    }
    return `${Number(mbh).toFixed(decimals)} MBH`;
  },

  formatUValue(u, decimals = 3) {
    if (this.isSI()) {
      const siU = u * 5.6782633;
      return `${siU.toFixed(decimals)} W/(m²·K)`;
    }
    return `${Number(u).toFixed(decimals)} BTU/(hr·sqft·°F)`;
  },

  formatPressure(psia, decimals = 2) {
    if (this.isSI()) {
      const kpa = psia * 6.894757;
      return `${kpa.toFixed(decimals)} kPa`;
    }
    return `${Number(psia).toFixed(3)} psia`;
  },

  // Updates static DOM nodes marked with data-i18n attributes
  applyTranslationsToDOM() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      const trans = this.t(key);
      if (trans) {
        if (el.tagName === "INPUT" && el.hasAttribute("placeholder")) {
          el.placeholder = trans;
        } else {
          el.innerHTML = trans;
        }
      }
    });

    // Update title
    document.title = this.t("app.title");

    // Update Language button in toolbar
    const langBtn = document.getElementById("btn-lang-toggle");
    if (langBtn) {
      langBtn.innerHTML = `<span>${this.getLanguage() === "pt-BR" ? "🌐 PT-BR" : "🌐 EN"}</span>`;
      langBtn.title = this.getLanguage() === "pt-BR" ? "Alternar Idioma para English (EN)" : "Switch Language to Português (PT-BR)";
    }

    // Update Units button in toolbar
    const unitBtn = document.getElementById("btn-unit-toggle");
    if (unitBtn) {
      const isSI = this.isSI();
      unitBtn.innerHTML = `<span>${isSI ? this.t("toolbar.units_si") : this.t("toolbar.units_ip")}</span>`;
    }
  }
};

window.I18N = I18N;
window.t = (key, params) => I18N.t(key, params);
