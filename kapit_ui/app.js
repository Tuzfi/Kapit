/**
 * Kapit 0.1 — Main Application Controller (app.js)
 * Implements Project Tree Navigation, Category List Views, Multi-Tab Property Editors,
 * 2D Floor Plan & 3D Extruded Building Canvas, ASHRAE Psychrometric Chart, and Wizards.
 */

const TREE_CATEGORIES = [
  { id: "weather", label: "Weather", icon: "☀️", group: "Project" },
  { id: "buildings", label: "Buildings", icon: "🏢", group: "Project" },
  { id: "space_models", label: "Space Models", icon: "📐", group: "Project" },
  { id: "air_systems", label: "Systems", icon: "❄️", group: "Project" },
  { id: "plants", label: "Plants", icon: "⚙️", group: "Project" },
  { id: "alternatives", label: "Alternatives", icon: "📊", group: "Project" },
  { id: "space_types", label: "Space Types", icon: "🏷️", group: "Project Libraries" },
  { id: "schedules", label: "Schedules", icon: "🕒", group: "Project Libraries" },
  { id: "walls", label: "Walls", icon: "🧱", group: "Project Libraries" },
  { id: "roofs", label: "Roofs", icon: "🏠", group: "Project Libraries" },
  { id: "ceilings", label: "Ceilings", icon: "⬜", group: "Project Libraries" },
  { id: "floors", label: "Floors", icon: "⬛", group: "Project Libraries" },
  { id: "windows", label: "Windows", icon: "🪟", group: "Project Libraries" },
  { id: "doors", label: "Doors", icon: "🚪", group: "Project Libraries" },
  { id: "shades", label: "Shades", icon: "⛱️", group: "Project Libraries" },
  { id: "chillers", label: "Chillers", icon: "🧊", group: "Project Libraries" },
  { id: "cooling_towers", label: "Cooling Towers", icon: "💨", group: "Project Libraries" },
  { id: "boilers", label: "Boilers", icon: "🔥", group: "Project Libraries" },
  { id: "electric_rates", label: "Electric Rates", icon: "⚡", group: "Project Libraries" },
  { id: "fuel_rates", label: "Fuel Rates", icon: "🔥", group: "Project Libraries" },
];

const app = {
  state: {
    project: null,
    calculations: null,
    catalogs: null,
    currentCategory: "weather",
    selectedIndex: 0,
    activeSubTab: 0,
    _recalcTimer: null,
  },

  async init() {
    try {
      const res = await fetch("/api/project");
      const data = await res.json();
      this.state.project = data.project;
      this.state.calculations = data.calculations;
      this.state.catalogs = data.catalogs;
      
      if (typeof modeler !== "undefined" && modeler.init) {
        modeler.init();
      }
      
      this.setupGlobalKeyboardShortcuts();
      this.refreshAllUI();
    } catch (err) {
      console.error("Failed to initialize project:", err);
      const msg = document.getElementById("status-msg");
      if (msg) msg.textContent = "Error loading project: " + err.message;
    }
  },

  setupGlobalKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      // Don't intercept when user is typing inside text input or textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;
      if (e.key === "Insert") {
        e.preventDefault();
        this.createNewEntityInCurrentCategory();
      } else if (e.key === "Delete") {
        e.preventDefault();
        this.deleteSelectedEntity();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        this.duplicateSelectedEntity();
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.editSelectedEntity();
      }
    });
  },

  triggerAutoRecalculate() {
    if (this.state._recalcTimer) {
      clearTimeout(this.state._recalcTimer);
    }
    const statusEl = document.getElementById("status-msg");
    if (statusEl) statusEl.textContent = "Recalculating...";
    this.state._recalcTimer = setTimeout(async () => {
      try {
        const res = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: this.state.project }),
        });
        const data = await res.json();
        if (data.project) this.state.project = data.project;
        if (data.calculations) this.state.calculations = data.calculations;
        this.renderKpiCard();
        this.renderCategoryList();
        if (typeof reportsUI !== "undefined" && reportsUI.renderSelectedReport) {
          reportsUI.renderSelectedReport();
        }
        if (statusEl) statusEl.textContent = "Ready — Recalculated";
      } catch (err) {
        console.error("Auto recalculate error:", err);
        if (statusEl) statusEl.textContent = "Recalculation error: " + err.message;
      }
    }, 400);
  },

  refreshAllUI() {
    const proj = this.state.project;
    if (!proj) return;
    document.getElementById("window-title").textContent =
      `Kapit 0.1 - [${proj.project_info.name}]`;
    document.getElementById("status-vent").textContent =
      `Ventilation Standard: ${proj.project_info.ventilation_standard}`;
    document.getElementById("status-energy").textContent =
      `Energy Standard: ${proj.project_info.energy_standard}`;
    document.getElementById("status-units").textContent =
      `Units: ${proj.project_info.units_system === "SI" ? "Metric (SI)" : "English (IP)"}`;
    document.getElementById("btn-unit-toggle").textContent =
      `Units: ${proj.project_info.units_system === "SI" ? "SI (Metric)" : "IP (English)"}`;

    this.renderTree();
    this.renderKpiCard();
    this.renderCategoryList();
    this.renderEntityEditor();
    this.renderBuildingCanvas();
    this.renderPsychrometricChart();
    this.calcCustomPsychPoint();
    reportsUI.renderSelectedReport();
  },

  getCategoryItems(catId) {
    const p = this.state.project;
    if (!p) return [];
    if (catId === "weather") return [p.weather];
    if (["buildings", "space_models", "air_systems", "plants", "alternatives"].includes(catId)) {
      if (!p[catId]) p[catId] = [];
      return p[catId];
    }
    if (!p.libraries) p.libraries = {};
    if (!p.libraries[catId]) p.libraries[catId] = [];
    return p.libraries[catId];
  },

  renderTree() {
    const treeEl = document.getElementById("project-tree");
    let html = "";
    let lastGroup = "";
    TREE_CATEGORIES.forEach(cat => {
      if (cat.group !== lastGroup) {
        lastGroup = cat.group;
        html += `<div class="tree-group-title">📁 ${cat.group}</div>`;
      }
      const items = this.getCategoryItems(cat.id);
      const isAct = this.state.currentCategory === cat.id ? "active" : "";
      html += `
        <div class="tree-node ${isAct}" onclick="app.selectCategory('${cat.id}')">
          <span>${cat.icon} ${cat.label}</span>
          <span class="tree-badge">${items.length}</span>
        </div>
      `;
    });
    treeEl.innerHTML = html;
  },

  selectCategory(catId) {
    this.state.currentCategory = catId;
    this.state.selectedIndex = 0;
    this.state.activeSubTab = 0;
    this.renderTree();
    this.renderCategoryList();
    this.renderEntityEditor();
  },

  renderKpiCard() {
    const calc = this.state.calculations;
    if (!calc) return;
    const s = calc.air_system.sizing_summary;
    const cc = s.central_cooling_coil;
    const ph = s.preheat_coil;
    const b = calc.billing_and_costs.billing_details_electric.totals;
    const isSI = this.state.project.project_info.units_system === "SI";

    if (isSI) {
      document.getElementById("kpi-tons").textContent = `${(cc.total_coil_tons * 3.517).toFixed(1)} kW (${cc.total_coil_tons.toFixed(1)} Tons)`;
      document.getElementById("kpi-cfm").textContent = `${(s.supply_fan.design_cfm * 0.4719).toFixed(0)} L/s`;
      document.getElementById("kpi-oa").textContent = `${(s.outdoor_ventilation.design_airflow_cfm * 0.4719).toFixed(0)} L/s`;
    } else {
      document.getElementById("kpi-tons").textContent = `${cc.total_coil_tons.toFixed(1)} Tons (${cc.total_coil_mbh.toFixed(1)} MBH)`;
      document.getElementById("kpi-cfm").textContent = `${s.supply_fan.design_cfm.toLocaleString()} CFM`;
      document.getElementById("kpi-oa").textContent = `${s.outdoor_ventilation.design_airflow_cfm.toLocaleString()} CFM`;
    }
    document.getElementById("kpi-heat").textContent = `${ph.max_coil_load_mbh.toFixed(1)} MBH Preheat`;
    document.getElementById("kpi-kwh").textContent = `${b.total_consumption_kwh.toLocaleString()} kWh/yr`;
    document.getElementById("kpi-cost").textContent = `$${b.total_charge_usd.toLocaleString()} / yr`;
  },

  renderCategoryList() {
    const catId = this.state.currentCategory;
    const catMeta = TREE_CATEGORIES.find(c => c.id === catId);
    document.getElementById("current-category-title").textContent =
      `${catMeta ? catMeta.label : catId} — Items in Project`;

    const items = this.getCategoryItems(catId);
    const wrap = document.getElementById("entity-list-container");

    if (catId === "weather") {
      const w = items[0];
      wrap.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Location</th><th>Climate Zone</th><th>Summer DB / WB (F)</th><th>Winter DB (F)</th><th>Elevation (ft)</th><th>Simulation Weather</th></tr></thead>
          <tbody>
            <tr class="selected-row" ondblclick="app.openWeatherStationBrowser()" style="cursor:pointer" title="Double-click to open Weather Station Browser">
              <td>${w.location}</td><td>${w.climate_zone}</td><td>${w.summer_db_f} / ${w.summer_wb_f}</td><td>${w.winter_db_f}</td><td>${w.elevation_ft}</td><td>${w.sim_weather_name}</td>
            </tr>
          </tbody>
        </table>
      `;
      return;
    }

    let headers = ["Name", "Type / Details", "Summary Parameter"];
    const rowsHtml = items.map((it, idx) => {
      const sel = idx === this.state.selectedIndex ? "selected-row" : "";
      const name = it.name || it.location || `Item ${idx + 1}`;
      let col2 = it.system_type || it.wall_type || it.schedule_type || it.rate_type || it.chiller_type || it.boiler_type || it.door_type || it.building_name || "Standard";
      let col3 = it.overall_u !== undefined ? `U = ${it.overall_u} BTU/(hr·sqft·F)` :
                 it.flat_price_usd_per_kwh !== undefined ? `$${it.flat_price_usd_per_kwh}/kWh` :
                 it.flat_price_usd_per_unit !== undefined ? `$${it.flat_price_usd_per_unit}/MCF` :
                 it.spaces ? `${it.spaces.length} Spaces` :
                 it.levels ? `${it.levels.length} Level(s)` :
                 it.number_of_zones ? `${it.number_of_zones} Zones` : "Active";
      return `
        <tr class="${sel}" onclick="app.selectItemRow(${idx})" ondblclick="app.openEntityModal(${idx})" style="cursor:pointer" title="Click to view, double-click for modal dialog">
          <td><strong>${name}</strong></td>
          <td>${col2}</td>
          <td>${col3}</td>
        </tr>
      `;
    }).join("");

    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr><th>${headers[0]}</th><th>${headers[1]}</th><th>${headers[2]}</th></tr></thead>
        <tbody>
          <tr onclick="app.createNewEntityInCurrentCategory()" style="color:#005a9e;font-style:italic;cursor:pointer">
            <td colspan="3">&lt;Create New ${catMeta ? catMeta.label : ""} Item...&gt;</td>
          </tr>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  },

  selectItemRow(idx) {
    this.state.selectedIndex = idx;
    this.renderCategoryList();
    this.renderEntityEditor();
  },

  openEntityModal(idx) {
    this.selectItemRow(idx);
    const catId = this.state.currentCategory;
    const catMeta = TREE_CATEGORIES.find(c => c.id === catId);
    const items = this.getCategoryItems(catId);
    const item = items[idx];
    if (!item) return;

    const backdrop = document.getElementById("modal-backdrop");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    const footEl = document.getElementById("modal-footer");

    titleEl.textContent = `${catMeta ? catMeta.label : catId} Properties — [${item.name || item.location || 'Item'}]`;
    this._modalItemBackup = JSON.parse(JSON.stringify(item));
    this._modalTargetItem = item;

    let editorHtml = "";
    if (catId === "weather") {
      editorHtml = this.buildWeatherEditor(item);
    } else if (catId === "space_models") {
      editorHtml = this.buildSpaceModelEditor(item);
    } else if (catId === "air_systems") {
      editorHtml = this.buildAirSystemEditor(item);
    } else if (["walls", "roofs", "ceilings", "floors"].includes(catId)) {
      editorHtml = this.buildAssemblyEditor(item, catId);
    } else if (catId === "schedules") {
      editorHtml = this.buildScheduleEditor(item);
    } else {
      editorHtml = this.buildGenericEntityEditor(item, catId);
    }

    bodyEl.innerHTML = `<div style="max-height:65vh;overflow-y:auto;padding-right:8px">${editorHtml}</div>`;
    footEl.innerHTML = `
      <button class="btn-sm" onclick="app.cancelEntityModal()">Cancel</button>
      <button class="btn-sm" onclick="app.applyEntityModal()">Apply</button>
      <button class="btn-sm primary" onclick="app.saveEntityModal()">OK</button>
    `;
    backdrop.style.display = "flex";
  },

  applyEntityModal() {
    this.refreshAllUI();
    this.triggerAutoRecalculate();
  },

  saveEntityModal() {
    this.applyEntityModal();
    this.closeModal();
  },

  cancelEntityModal() {
    if (this._modalTargetItem && this._modalItemBackup) {
      Object.assign(this._modalTargetItem, this._modalItemBackup);
      this.refreshAllUI();
    }
    this.closeModal();
  },

  openWeatherStationBrowser() {
    this.openWizard("weather");
  },

  setSubTab(idx) {
    this.state.activeSubTab = idx;
    this.renderEntityEditor();
  },

  renderEntityEditor() {
    const catId = this.state.currentCategory;
    const items = this.getCategoryItems(catId);
    const item = items[this.state.selectedIndex] || items[0];
    const container = document.getElementById("entity-editor-container");
    if (!item) {
      container.innerHTML = `<div class="editor-body">No item in this category. Click <strong>+ Create New Item</strong> above to add one.</div>`;
      return;
    }

    if (catId === "weather") {
      container.innerHTML = this.buildWeatherEditor(item);
    } else if (catId === "space_models") {
      container.innerHTML = this.buildSpaceModelEditor(item);
    } else if (catId === "air_systems") {
      container.innerHTML = this.buildAirSystemEditor(item);
    } else if (["walls", "roofs", "ceilings", "floors"].includes(catId)) {
      container.innerHTML = this.buildAssemblyEditor(item, catId);
    } else if (catId === "schedules") {
      container.innerHTML = this.buildScheduleEditor(item);
    } else {
      container.innerHTML = this.buildGenericEntityEditor(item, catId);
    }
  },

  buildWeatherEditor(w) {
    const tab = this.state.activeSubTab;
    const wSum = this.state.calculations.air_system.weather_summary;
    let body = "";
    if (tab === 0) {
      body = `
        <div style="margin-bottom:12px;display:flex;gap:12px;align-items:center;background:#f0f9ff;border:1px solid #bae6fd;padding:10px 14px;border-radius:6px;">
          <button type="button" class="btn-sm primary" onclick="app.openWeatherStationBrowser()" style="font-weight:600;padding:6px 14px;cursor:pointer;background:#0284c7;color:#fff;border:none;border-radius:4px;">
            🌍 Select Station from Carrier weather.db (4,000+ Stations)...
          </button>
          <span style="font-size:12px;color:#0369a1;">Direct SQLite access to Carrier HAP 6.4 global meteorological stations database</span>
        </div>
        <div class="form-grid">
          <label>Location Name <input type="text" value="${w.location}" onchange="app.state.project.weather.location=this.value" /></label>
          <label>Climate Zone <input type="text" value="${w.climate_zone}" onchange="app.state.project.weather.climate_zone=this.value" /></label>
          <label>Latitude (°N) <input type="number" step="0.01" value="${w.latitude}" onchange="app.state.project.weather.latitude=parseFloat(this.value)" /></label>
          <label>Longitude (°E) <input type="number" step="0.01" value="${w.longitude}" onchange="app.state.project.weather.longitude=parseFloat(this.value)" /></label>
          <label>Elevation (ft) <input type="number" step="1" value="${w.elevation_ft}" onchange="app.state.project.weather.elevation_ft=parseFloat(this.value)" /></label>
          <label>Time Zone (GMT Offset) <input type="number" step="0.5" value="${w.timezone}" onchange="app.state.project.weather.timezone=parseFloat(this.value)" /></label>
          <label>Summer Design Dry-Bulb (F) <input type="number" step="0.1" value="${w.summer_db_f}" onchange="app.state.project.weather.summer_db_f=parseFloat(this.value)" /></label>
          <label>Summer Coincident Wet-Bulb (F) <input type="number" step="0.1" value="${w.summer_wb_f}" onchange="app.state.project.weather.summer_wb_f=parseFloat(this.value)" /></label>
          <label>Summer Daily Range (F) <input type="number" step="0.1" value="${w.daily_range_f}" onchange="app.state.project.weather.daily_range_f=parseFloat(this.value)" /></label>
          <label>Winter Design Dry-Bulb (F) <input type="number" step="0.1" value="${w.winter_db_f}" onchange="app.state.project.weather.winter_db_f=parseFloat(this.value)" /></label>
          <label>Winter Design Wet-Bulb (F) <input type="number" step="0.1" value="${w.winter_wb_f}" onchange="app.state.project.weather.winter_wb_f=parseFloat(this.value)" /></label>
          <label>Outdoor Air CO2 Level (ppm) <input type="number" value="${w.oa_co2_ppm}" onchange="app.state.project.weather.oa_co2_ppm=parseInt(this.value)" /></label>
          <label>Ground Reflectance (0..1) <input type="number" step="0.05" value="${w.ground_reflectance}" onchange="app.state.project.weather.ground_reflectance=parseFloat(this.value)" /></label>
          <label>Soil Conductivity [BTU/(hr·ft·F)] <input type="number" step="0.05" value="${w.soil_conductivity}" onchange="app.state.project.weather.soil_conductivity=parseFloat(this.value)" /></label>
          <label>First Cooling Design Month (1..12) <input type="number" min="1" max="12" value="${w.calc_start_month}" onchange="app.state.project.weather.calc_start_month=parseInt(this.value)" /></label>
          <label>Last Cooling Design Month (1..12) <input type="number" min="1" max="12" value="${w.calc_end_month}" onchange="app.state.project.weather.calc_end_month=parseInt(this.value)" /></label>
        </div>
      `;
    } else if (tab === 1) {
      const mRows = Object.keys(wSum.monthly_profiles).map(m => {
        const mp = wSum.monthly_profiles[m];
        return `<tr><td><strong>${m}</strong></td><td>${mp.max_db_f.toFixed(1)} F</td><td>${mp.min_db_f.toFixed(1)} F</td><td>${mp.max_wb_f.toFixed(1)} F</td><td>${mp.db_hourly.slice(8, 18).join(" / ")}</td></tr>`;
      }).join("");
      body = `
        <table class="data-table">
          <thead><tr><th>Month</th><th>Max Design DB</th><th>Min Design DB</th><th>Max Coinc. WB</th><th>Hourly DB Profile (08:00 .. 17:00)</th></tr></thead>
          <tbody>${mRows}</tbody>
        </table>
      `;
    } else {
      const sRows = Object.keys(wSum.max_solar_table).map(m => {
        const ms = wSum.max_solar_table[m];
        return `<tr><td><strong>${m}</strong></td><td>${ms.N}</td><td>${ms.NE}</td><td>${ms.E}</td><td>${ms.SE}</td><td>${ms.S}</td><td>${ms.SW}</td><td>${ms.W}</td><td>${ms.NW}</td><td><strong>${ms.HOR}</strong></td></tr>`;
      }).join("");
      body = `
        <table class="data-table">
          <thead><tr><th>Month</th><th>N</th><th>NE</th><th>E</th><th>SE</th><th>S</th><th>SW</th><th>W</th><th>NW</th><th>HOR [BTU/(hr·sqft)]</th></tr></thead>
          <tbody>${sRows}</tbody>
        </table>
      `;
    }

    return `
      <div class="sub-tabs">
        <button class="sub-tab ${tab===0?'active':''}" onclick="app.setSubTab(0)">1. Design Parameters</button>
        <button class="sub-tab ${tab===1?'active':''}" onclick="app.setSubTab(1)">2. Design Temperatures (24x12)</button>
        <button class="sub-tab ${tab===2?'active':''}" onclick="app.setSubTab(2)">3. Design Solar Fluxes (16 Orientations)</button>
      </div>
      <div class="editor-body">${body}</div>
    `;
  },

  buildSpaceModelEditor(sm) {
    const tab = this.state.activeSubTab;
    const smIdx = this.state.selectedIndex;
    let body = "";
    if (tab === 0) {
      const rows = (sm.spaces || []).map((sp, i) => `
        <tr>
          <td>${sp.index !== undefined ? sp.index : (i + 1)}</td>
          <td><input type="text" value="${sp.name || ''}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].name=this.value; app.triggerAutoRecalculate();" /></td>
          <td><input type="text" value="${sp.zone_name || ''}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].zone_name=this.value; app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.1" value="${sp.floor_area_sqft || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].floor_area_sqft=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.1" value="${sp.oa_req1_cfm_person || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].oa_req1_cfm_person=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.01" value="${sp.oa_req2_cfm_sqft || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].oa_req2_cfm_sqft=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.01" value="${sp.overhead_lighting_w_sqft || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].overhead_lighting_w_sqft=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.01" value="${sp.elec_eqpt_w_sqft || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].elec_eqpt_w_sqft=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="1" value="${sp.occupancy_people || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].occupancy_people=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
          <td><input type="number" step="0.05" value="${sp.infiltration_clg_ach || 0}" onchange="app.state.project.space_models[${smIdx}].spaces[${i}].infiltration_clg_ach=parseFloat(this.value); app.triggerAutoRecalculate();" /></td>
        </tr>
      `).join("");
      body = `
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th><th>Space Name</th><th>Zone</th><th>Area (sqft)</th>
              <th>OA Rp (CFM/p)</th><th>OA Ra (CFM/sqft)</th><th>Lighting (W/sqft)</th>
              <th>Elec Eqpt (W/sqft)</th><th>People</th><th>Infil (ACH)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    } else {
      body = `
        <div class="form-grid">
          <label>Space Model Name <input type="text" value="${sm.name}" onchange="app.state.project.space_models[${smIdx}].name=this.value; app.triggerAutoRecalculate();" /></label>
          <label>Associated Building <input type="text" value="${sm.building_name || ''}" onchange="app.state.project.space_models[${smIdx}].building_name=this.value" /></label>
          <label>Infiltration Model
            <select onchange="app.state.project.space_models[${smIdx}].infiltration_model=this.value; app.triggerAutoRecalculate();">
              <option value="Constant Infiltration" ${sm.infiltration_model === 'Constant Infiltration' ? 'selected' : ''}>Constant Infiltration</option>
              <option value="Weather-Driven Infiltration" ${sm.infiltration_model === 'Weather-Driven Infiltration' ? 'selected' : ''}>Weather-Driven Infiltration</option>
            </select>
          </label>
          <label>Window-to-Wall Ratio (WWR %) <input type="text" value="${(sm.spaces && sm.spaces.length) ? sm.spaces.length + ' Spaces Configured' : 'No Spaces'}" readonly /></label>
        </div>
      `;
    }
    return `
      <div class="sub-tabs">
        <button class="sub-tab ${tab===0?'active':''}" onclick="app.setSubTab(0)">1. Spaces Grid (C1FlexGrid Multi-Group Editor)</button>
        <button class="sub-tab ${tab===1?'active':''}" onclick="app.setSubTab(1)">2. General, Zoning &amp; WWR Summary</button>
      </div>
      <div class="editor-body">${body}</div>
    `;
  },

  buildAirSystemEditor(sys) {
    const tab = this.state.activeSubTab;
    const sysIdx = this.state.selectedIndex;
    const sysTypesOpts = (this.state.catalogs.air_system_types || []).map(t =>
      `<option value="${t.name}" ${sys.system_type===t.name?'selected':''}>${t.name} (${t.category})</option>`
    ).join("");

    let body = "";
    if (tab === 0) {
      body = `
        <div class="form-grid">
          <label>Air System Name <input type="text" value="${sys.name}" onchange="app.state.project.air_systems[${sysIdx}].name=this.value; app.triggerAutoRecalculate();" /></label>
          <label>Equipment Class <input type="text" value="${sys.equipment_class || 'PKG ROOF'}" onchange="app.state.project.air_systems[${sysIdx}].equipment_class=this.value" /></label>
          <label>Air System Type (22 HAP Types) <select onchange="app.state.project.air_systems[${sysIdx}].system_type=this.value; app.triggerAutoRecalculate();">${sysTypesOpts}</select></label>
          <label>Ventilation Sizing Method
            <select onchange="app.state.project.air_systems[${sysIdx}].ventilation.sizing_method=this.value; app.triggerAutoRecalculate();">
              <option value="ASHRAE Standard 62.1-2022" ${sys.ventilation && sys.ventilation.sizing_method==='ASHRAE Standard 62.1-2022'?'selected':''}>ASHRAE Standard 62.1-2022</option>
              <option value="Sum of Space OA Airflows" ${sys.ventilation && sys.ventilation.sizing_method==='Sum of Space OA Airflows'?'selected':''}>Sum of Space OA Airflows</option>
            </select>
          </label>
          <label>Economizer Control <input type="text" value="${sys.economizer ? sys.economizer.control : 'None'}" onchange="if(!app.state.project.air_systems[${sysIdx}].economizer) app.state.project.air_systems[${sysIdx}].economizer={}; app.state.project.air_systems[${sysIdx}].economizer.control=this.value; app.triggerAutoRecalculate();" /></label>
          <label>Economizer Upper Cutoff (F) <input type="number" step="0.5" value="${sys.economizer ? sys.economizer.upper_cutoff_f : 65}" onchange="app.state.project.air_systems[${sysIdx}].economizer.upper_cutoff_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Preheat Coil Setpoint (F) <input type="number" step="0.5" value="${sys.preheat_coil ? sys.preheat_coil.setpoint_f : 50}" onchange="app.state.project.air_systems[${sysIdx}].preheat_coil.setpoint_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Central Cooling Supply Temp (F) <input type="number" step="0.5" value="${sys.central_cooling ? sys.central_cooling.supply_temp_f : 55}" onchange="app.state.project.air_systems[${sysIdx}].central_cooling.supply_temp_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Supply Fan Total Static (in wg) <input type="number" step="0.1" value="${sys.supply_fan ? sys.supply_fan.static_pressure_in_wg : 1.5}" onchange="app.state.project.air_systems[${sysIdx}].supply_fan.static_pressure_in_wg=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Supply Fan Efficiency (%) <input type="number" step="1" value="${sys.supply_fan ? sys.supply_fan.overall_efficiency_pct : 65}" onchange="app.state.project.air_systems[${sysIdx}].supply_fan.overall_efficiency_pct=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>AHRI Cooling Rating (EER) <input type="number" step="0.2" value="${sys.central_cooling ? sys.central_cooling.eer : 11.2}" onchange="app.state.project.air_systems[${sysIdx}].central_cooling.eer=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>DX Staging Configuration <input type="text" value="${sys.central_cooling ? sys.central_cooling.dx_staging : '2-Stage'}" onchange="app.state.project.air_systems[${sysIdx}].central_cooling.dx_staging=this.value" /></label>
        </div>
      `;
    } else {
      const zc = sys.zone_components || {};
      body = `
        <div class="form-grid">
          <label>Occupied Cooling Setpoint (F) <input type="number" step="0.5" value="${zc.occ_cooling_tstat_f || 75}" onchange="if(!app.state.project.air_systems[${sysIdx}].zone_components) app.state.project.air_systems[${sysIdx}].zone_components={}; app.state.project.air_systems[${sysIdx}].zone_components.occ_cooling_tstat_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Unoccupied Cooling Setpoint (F) <input type="number" step="0.5" value="${zc.unocc_cooling_tstat_f || 82}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.unocc_cooling_tstat_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Occupied Heating Setpoint (F) <input type="number" step="0.5" value="${zc.occ_heating_tstat_f || 70}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.occ_heating_tstat_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Unoccupied Heating Setpoint (F) <input type="number" step="0.5" value="${zc.unocc_heating_tstat_f || 64}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.unocc_heating_tstat_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Supply Terminal Type <input type="text" value="${zc.terminal_type || 'VAV with Electric Reheat'}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.terminal_type=this.value" /></label>
          <label>Minimum VAV Airflow (%) <input type="number" step="1" value="${zc.min_airflow_pct || 20}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.min_airflow_pct=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Reheat Design Supply Temp (F) <input type="number" step="1" value="${zc.reheat_design_supply_temp_f || 95}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.reheat_design_supply_temp_f=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
          <label>Heating Air Dist. Effectiveness Ez <input type="number" step="0.05" value="${zc.ez_heating || 0.8}" onchange="app.state.project.air_systems[${sysIdx}].zone_components.ez_heating=parseFloat(this.value); app.triggerAutoRecalculate();" /></label>
        </div>
      `;
    }

    return `
      <div class="sub-tabs">
        <button class="sub-tab ${tab===0?'active':''}" onclick="app.setSubTab(0)">1. General, System Components &amp; DX Equipment</button>
        <button class="sub-tab ${tab===1?'active':''}" onclick="app.setSubTab(1)">2. Zone Components, Thermostats &amp; VAV Terminals</button>
      </div>
      <div class="editor-body">${body}</div>
    `;
  },

  buildAssemblyEditor(assly, catId) {
    const layers = assly.layers || [];
    const asslyIdx = this.state.selectedIndex;
    const lRows = layers.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><input type="text" value="${l.name}" onchange="app.updateLayer('${catId}', ${i}, 'name', this.value)" /></td>
        <td><input type="number" step="0.125" value="${l.thickness_in}" onchange="app.updateLayer('${catId}', ${i}, 'thickness_in', parseFloat(this.value))" /></td>
        <td><input type="number" step="0.5" value="${l.density}" onchange="app.updateLayer('${catId}', ${i}, 'density', parseFloat(this.value))" /></td>
        <td><input type="number" step="0.01" value="${l.specific_heat}" onchange="app.updateLayer('${catId}', ${i}, 'specific_heat', parseFloat(this.value))" /></td>
        <td><input type="number" step="0.05" value="${l.r_value}" onchange="app.updateLayer('${catId}', ${i}, 'r_value', parseFloat(this.value))" /></td>
        <td>${l.weight || '-'}</td>
      </tr>
    `).join("");

    return `
      <div class="editor-body">
        <div class="form-grid" style="margin-bottom:10px">
          <label>Assembly Name <input type="text" value="${assly.name}" onchange="app.getCategoryItems('${catId}')[${asslyIdx}].name=this.value; app.triggerAutoRecalculate();" /></label>
          <label>Overall U-Value [BTU/(hr·sqft·F)] <input type="number" step="0.001" value="${assly.overall_u}" readonly /></label>
          <label>Overall R-Value [(hr·sqft·F)/BTU] <input type="number" step="0.01" value="${assly.overall_r}" readonly /></label>
          <label>Total Weight (lb/sqft) <input type="number" step="0.1" value="${assly.total_weight_lb_sqft}" readonly /></label>
        </div>
        <table class="data-table">
          <thead><tr><th>#</th><th>Material Layer</th><th>Thickness (in)</th><th>Density (lb/cuft)</th><th>Specific Heat</th><th>R-Value</th><th>Weight (lb/sqft)</th></tr></thead>
          <tbody>
            <tr><td>-</td><td>Inside Surface Resistance</td><td>-</td><td>-</td><td>-</td><td>${assly.inside_r || 0.68}</td><td>-</td></tr>
            ${lRows}
            <tr><td>-</td><td>Outside Surface Resistance</td><td>-</td><td>-</td><td>-</td><td>${assly.outside_r || 0.17}</td><td>-</td></tr>
          </tbody>
        </table>
      </div>
    `;
  },

  async updateLayer(catId, layerIdx, field, val) {
    const assly = this.getCategoryItems(catId)[this.state.selectedIndex];
    assly.layers[layerIdx][field] = val;
    const res = await fetch("/api/assembly/calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assembly: assly }),
    });
    const data = await res.json();
    Object.assign(assly, data.properties);
    this.renderCategoryList();
    this.renderEntityEditor();
    this.triggerAutoRecalculate();
  },

  buildScheduleEditor(sched) {
    const schedIdx = this.state.selectedIndex;
    const profNames = Object.keys(sched.profiles || {});
    const pRows = profNames.map(pName => {
      const hrs = sched.profiles[pName];
      return `
        <tr>
          <td><strong>${pName}</strong></td>
          ${hrs.map((v, h) => `<td style="padding:2px"><input type="number" min="0" max="100" value="${v}" style="width:34px;text-align:center" onchange="app.getCategoryItems('schedules')[${schedIdx}].profiles['${pName}'][${h}]=parseInt(this.value); app.triggerAutoRecalculate();" /></td>`).join("")}
        </tr>
      `;
    }).join("");

    return `
      <div class="editor-body">
        <div class="form-grid" style="margin-bottom:10px">
          <label>Schedule Name <input type="text" value="${sched.name}" onchange="app.getCategoryItems('schedules')[${schedIdx}].name=this.value; app.triggerAutoRecalculate();" /></label>
          <label>Schedule Type <input type="text" value="${sched.schedule_type}" readonly /></label>
        </div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Profile</th>
                ${Array.from({ length: 24 }, (_, h) => `<th>${String(h).padStart(2, "0")}</th>`).join("")}
              </tr>
            </thead>
            <tbody>${pRows}</tbody>
          </table>
        </div>
      </div>
    `;
  },

  buildGenericEntityEditor(item, catId) {
    const selIdx = this.state.selectedIndex;
    const fields = Object.keys(item).filter(k => typeof item[k] !== "object");
    const inputs = fields.map(k => {
      const val = item[k];
      const isNum = typeof val === "number";
      return `
        <label>${k}
          <input type="${isNum ? "number" : "text"}" step="any" value="${val}"
            onchange="app.getCategoryItems('${catId}')[${selIdx}]['${k}']=${isNum ? "parseFloat(this.value)" : "this.value"}; app.triggerAutoRecalculate();" />
        </label>
      `;
    }).join("");

    // Render nested objects/arrays as collapsible sections
    const complexFields = Object.keys(item).filter(k => typeof item[k] === "object" && item[k] !== null);
    const complexHtml = complexFields.map(ck => {
      const cVal = item[ck];
      if (Array.isArray(cVal)) {
        return `
          <div style="margin-top:10px">
            <strong>${ck} (${cVal.length} items)</strong>
            <div style="font-size:11px;color:#475569;margin-top:4px">${cVal.map(it => typeof it === 'object' ? (it.name || it.id || JSON.stringify(it)) : it).join(", ")}</div>
          </div>
        `;
      } else {
        const subInputs = Object.keys(cVal).map(sk => {
          const sVal = cVal[sk];
          const sIsNum = typeof sVal === "number";
          return `
            <label>${sk}
              <input type="${sIsNum ? 'number' : 'text'}" step="any" value="${sVal}"
                onchange="app.getCategoryItems('${catId}')[${selIdx}]['${ck}']['${sk}']=${sIsNum ? 'parseFloat(this.value)' : 'this.value'}; app.triggerAutoRecalculate();" />
            </label>
          `;
        }).join("");
        return `
          <fieldset style="border:1px solid #cbd5e1;border-radius:4px;padding:8px;margin-top:12px">
            <legend style="font-weight:600;font-size:11px;color:#334155">${ck}</legend>
            <div class="form-grid">${subInputs}</div>
          </fieldset>
        `;
      }
    }).join("");

    return `<div class="editor-body"><div class="form-grid">${inputs}</div>${complexHtml}</div>`;
  },

  async saveAndCalculate() {
    await this.runCalculations();
  },

  async runCalculations() {
    document.getElementById("status-msg").textContent = "Calculating 3-Step Heat Balance, Sizing & 8,760-hr Energy Simulation...";
    const res = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: this.state.project }),
    });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.refreshAllUI();
    document.getElementById("status-msg").textContent = "Ready — Project Calculated (0 Validation Errors)";
  },

  async resetProject() {
    const res = await fetch("/api/project/reset", { method: "POST" });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.refreshAllUI();
  },

  async loadInstalledExampleHap() {
    const res = await fetch("/api/import/hap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.refreshAllUI();
    document.getElementById("status-msg").textContent =
      "Loaded HAP-6.4-Example-Problem.hap from Public Documents!";
  },

  openFilePicker(accept) {
    const inp = document.getElementById("hidden-file-input");
    inp.accept = accept;
    inp.click();
  },

  async handleFileUpload(ev) {
    const file = ev.target.files[0];
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".hap")) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const res = await fetch("/api/import/hap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64_data: b64 }),
      });
      const data = await res.json();
      this.state.project = data.project;
      this.state.calculations = data.calculations;
      this.refreshAllUI();
    } else {
      const txt = await file.text();
      const proj = JSON.parse(txt);
      this.state.project = proj;
      await this.runCalculations();
    }
  },

  downloadProjectJson() {
    const blob = new Blob([JSON.stringify(this.state.project, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.state.project.project_info.name}.kapit.json`;
    a.click();
  },

  toggleUnitsSystem() {
    const cur = this.state.project.project_info.units_system;
    this.state.project.project_info.units_system = cur === "SI" ? "IP" : "SI";
    this.refreshAllUI();
  },

  async evalInlineCalc() {
    const expr = document.getElementById("inline-calc-input").value;
    if (!expr) return;
    const res = await fetch("/api/units/eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expression: expr }),
    });
    const data = await res.json();
    document.getElementById("inline-calc-result").textContent =
      data.evaluated !== undefined ? Number(data.evaluated).toFixed(2) : "Err";
  },

  switchWorkspaceTab(tabName) {
    document.querySelectorAll(".ws-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tabName));
    document.querySelectorAll(".ws-panel").forEach(p => p.classList.toggle("active", p.id === `panel-${tabName}`));
    if (tabName === "cad3d") this.renderBuildingCanvas();
    if (tabName === "psych") this.renderPsychrometricChart();
    if (tabName === "reports") reportsUI.renderSelectedReport();
  },

  openReport(reportType) {
    this.switchWorkspaceTab("reports");
    const sel = document.getElementById("report-type-select");
    if (sel) {
      sel.value = reportType;
      reportsUI.renderSelectedReport();
    }
  },

  createNewEntityInCurrentCategory() {
    const catId = this.state.currentCategory;
    if (catId === "weather") {
      this.openWizard("weather");
      return;
    }
    const items = this.getCategoryItems(catId);
    let template = null;
    if (typeof ENTITY_TEMPLATES !== "undefined" && ENTITY_TEMPLATES[catId]) {
      template = JSON.parse(JSON.stringify(ENTITY_TEMPLATES[catId]));
    } else if (items.length > 0) {
      template = JSON.parse(JSON.stringify(items[0]));
    } else {
      template = { name: "New Item" };
    }
    template.id = `${catId.toUpperCase()}_${Date.now()}`;
    template.name = `${template.name || "Item"} ${items.length + 1}`;
    items.push(template);
    this.state.selectedIndex = items.length - 1;
    this.refreshAllUI();
    this.triggerAutoRecalculate();
  },

  duplicateSelectedEntity() {
    const catId = this.state.currentCategory;
    if (catId === "weather") {
      alert("Weather is a project singleton and cannot be duplicated.");
      return;
    }
    const items = this.getCategoryItems(catId);
    if (!items || items.length === 0 || this.state.selectedIndex < 0) return;
    const orig = items[this.state.selectedIndex];
    if (!orig) return;

    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = `${catId.toUpperCase()}_${Date.now()}`;
    copy.name = `${orig.name || "Item"} (Copy)`;
    items.push(copy);
    this.state.selectedIndex = items.length - 1;
    this.refreshAllUI();
    this.triggerAutoRecalculate();
  },

  deleteSelectedEntity() {
    const catId = this.state.currentCategory;
    if (catId === "weather") {
      alert("Weather properties cannot be deleted.");
      return;
    }
    const items = this.getCategoryItems(catId);
    if (!items || items.length === 0) return;
    const idx = this.state.selectedIndex;
    if (idx < 0 || idx >= items.length) return;

    const item = items[idx];
    const name = item.name || `Item ${idx + 1}`;
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }

    items.splice(idx, 1);
    this.state.selectedIndex = Math.max(0, idx - 1);
    this.refreshAllUI();
    this.triggerAutoRecalculate();
  },

  editSelectedEntity() {
    this.switchWorkspaceTab("explorer");
  },

  async duplicateAsBaseline() {
    const res = await fetch("/api/wizards/baseline", { method: "POST" });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.selectCategory("alternatives");
    this.refreshAllUI();
    document.getElementById("status-msg").textContent =
      "Created [B000] ASHRAE 90.1 Appendix G Baseline Alternative!";
  },

  // 2D Floor Plan & 3D Extruded Building Renderer
  renderBuildingCanvas() {
    if (typeof modeler !== "undefined" && modeler.render) {
      modeler.render();
      return;
    }
    const cvs = document.getElementById("building-canvas");
    if (!cvs || !this.state.project) return;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);
  },

  // ASHRAE Psychrometric Chart Renderer
  renderPsychrometricChart() {
    const cvs = document.getElementById("psych-canvas");
    if (!cvs || !this.state.calculations) return;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const padL = 55, padR = 55, padT = 25, padB = 42;
    const plotW = cvs.width - padL - padR;
    const plotH = cvs.height - padT - padB;

    const dbMin = 30.0, dbMax = 110.0;
    const wMax = 0.030; // lb/lb (210 grains/lb)

    const toX = db => padL + ((db - dbMin) / (dbMax - dbMin)) * plotW;
    const toY = w => padT + plotH - (Math.min(wMax, w) / wMax) * plotH;

    // Saturation vapor pressure helper in JS for plotting smooth RH curves
    const satW = (dbF, rhFrac) => {
      const tK = (dbF - 32) * (5 / 9) + 273.15;
      const pwsPa = 610.78 * Math.exp((17.27 * (tK - 273.15)) / (tK - 35.85));
      const pwPsi = (pwsPa * rhFrac) / 6894.76;
      const pAtm = 14.281;
      return (0.621945 * pwPsi) / Math.max(0.5, pAtm - pwPsi);
    };

    // Grid lines (Dry-Bulb vertical lines)
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let db = 30; db <= 110; db += 10) {
      const x = toX(db);
      ctx.beginPath();
      ctx.moveTo(x, padT);
      ctx.lineTo(x, padT + plotH);
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.font = "11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(`${db}°F`, x, padT + plotH + 16);
    }

    // Horizontal humidity ratio lines
    for (let w = 0; w <= 0.030; w += 0.005) {
      const y = toY(w);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
      ctx.fillStyle = "#334155";
      ctx.textAlign = "left";
      ctx.fillText(`${(w * 7000).toFixed(0)} gr`, padL + plotW + 6, y + 4);
    }

    // Relative Humidity Curves (20%, 40%, 60%, 80%, 100%)
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(rh => {
      ctx.beginPath();
      let started = false;
      for (let db = dbMin; db <= dbMax; db += 1) {
        const w = satW(db, rh);
        if (w > wMax) break;
        const x = toX(db), y = toY(w);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rh === 1.0 ? "#0284c7" : "#94a3b8";
      ctx.lineWidth = rh === 1.0 ? 2 : 1;
      ctx.stroke();
    });

    // ASHRAE 55 Comfort Zone Polygon (68..78 F, 30..60% RH)
    ctx.beginPath();
    const czPts = [
      { db: 68, w: satW(68, 0.30) },
      { db: 78, w: satW(78, 0.30) },
      { db: 78, w: satW(78, 0.60) },
      { db: 68, w: satW(68, 0.60) },
    ];
    czPts.forEach((p, i) => (i === 0 ? ctx.moveTo(toX(p.db), toY(p.w)) : ctx.lineTo(toX(p.db), toY(p.w))));
    ctx.closePath();
    ctx.fillStyle = "rgba(34, 197, 94, 0.18)";
    ctx.fill();
    ctx.strokeStyle = "#16a34a";
    ctx.stroke();

    // Plot System Cycle State Points
    const pts = this.state.calculations.air_system.psychrometric_points;
    if (pts && pts.length >= 5) {
      // Connect OA -> Mixed -> Room and Mixed -> Coil Lvg -> Supply -> Room
      const drawLine = (p1, p2, color) => {
        ctx.beginPath();
        ctx.moveTo(toX(p1.db_f), toY(p1.w_lb_lb));
        ctx.lineTo(toX(p2.db_f), toY(p2.w_lb_lb));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.4;
        ctx.stroke();
      };
      drawLine(pts[0], pts[1], "#f59e0b"); // OA to Room mixing line
      drawLine(pts[2], pts[3], "#0284c7"); // Cooling & Dehumidification coil line
      drawLine(pts[3], pts[4], "#dc2626"); // Supply fan heat line
      drawLine(pts[4], pts[1], "#16a34a"); // Room sensible/latent load line

      pts.forEach((p, idx) => {
        const x = toX(p.db_f), y = toY(p.w_lb_lb);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#1e293b";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 10.5px Segoe UI";
        ctx.fillText(`${idx + 1}: ${p.name.split(" ")[0]} (${p.db_f.toFixed(1)}F)`, x + 7, y - 6 + (idx % 2) * 12);
      });
    }

    // Render table in side panel
    const tblWrap = document.getElementById("system-psych-table-wrap");
    if (tblWrap && pts) {
      tblWrap.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Point</th><th>CFM</th><th>DB (F)</th><th>WB (F)</th><th>RH (%)</th><th>h (BTU/lb)</th></tr></thead>
          <tbody>
            ${pts.map((p, i) => `<tr><td>${i+1}. ${p.name}</td><td>${p.cfm.toFixed(0)}</td><td>${p.db_f.toFixed(1)}</td><td>${p.wb_f.toFixed(1)}</td><td>${p.rh_pct.toFixed(0)}%</td><td>${p.h_btu_lb.toFixed(1)}</td></tr>`).join("")}
          </tbody>
        </table>
      `;
    }
  },

  async calcCustomPsychPoint() {
    const cfm = parseFloat(document.getElementById("ps-cfm").value || 6107);
    const db = parseFloat(document.getElementById("ps-db").value || 85.3);
    const wb = parseFloat(document.getElementById("ps-wb").value || 71.2);
    const elev = this.state.project ? this.state.project.weather.elevation_ft : 790.0;

    const res = await fetch("/api/psychrometrics/calc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "db_wb", cfm, db_f: db, wb_f: wb, elevation_ft: elev }),
    });
    const data = await res.json();
    const s = data.state;
    const card = document.getElementById("custom-psych-output");
    if (card && s) {
      card.innerHTML = `
        <div><strong>Dry-Bulb / Wet-Bulb:</strong> ${s.db_f.toFixed(1)} °F / ${s.wb_f.toFixed(1)} °F</div>
        <div><strong>Dew-Point / RH:</strong> ${s.dp_f.toFixed(1)} °F / ${s.rh_pct.toFixed(1)} %</div>
        <div><strong>Humidity Ratio W:</strong> ${s.w_grains_lb.toFixed(1)} grains/lb (${s.w_lb_lb.toFixed(5)} lb/lb)</div>
        <div><strong>Enthalpy h:</strong> ${s.h_btu_lb.toFixed(2)} BTU/lb_da</div>
        <div><strong>Specific Volume v:</strong> ${s.v_cuft_lb.toFixed(2)} ft³/lb_da (P = ${s.p_atm_psia} psia)</div>
      `;
    }
  },

  // Wizards Modal System
  async openWizard(wizType) {
    const backdrop = document.getElementById("modal-backdrop");
    const titleEl = document.getElementById("modal-title");
    const bodyEl = document.getElementById("modal-body");
    const footEl = document.getElementById("modal-footer");
    backdrop.style.display = "flex";

    if (wizType === "weather") {
      titleEl.textContent = "Weather Wizard — Global ASHRAE Station Database (weather.db + Built-in)";
      const res = await fetch("/api/weather/stations?q=");
      const data = await res.json();
      this._wizardStations = data.stations;

      bodyEl.innerHTML = `
        <div style="margin-bottom:10px;display:flex;gap:8px">
          <input type="text" id="wiz-station-search" placeholder="Search city, state, or country (e.g., Sao Paulo, Miami, Chicago, Indianapolis)..." style="flex:1;padding:6px" oninput="app.searchWizardStations(this.value)" />
        </div>
        <div style="max-height:340px;overflow-y:auto" id="wiz-stations-table-wrap">
          ${this.renderWizardStationsTable(data.stations)}
        </div>
      `;
      footEl.innerHTML = `<button class="btn-sm" onclick="app.closeModal()">Close</button>`;
    } else if (wizType === "building") {
      titleEl.textContent = "Building Footprint & Space Model Wizard (WizardsB.dll FloorPlanGenerator)";
      bodyEl.innerHTML = `
        <div class="form-grid">
          <label>Building Name <input type="text" id="bw-name" value="Commercial Office / School Building" /></label>
          <label>Building Usage Archetype
            <select id="bw-type">
              <option>School / Classroom</option>
              <option>Office Building</option>
            </select>
          </label>
          <label>Footprint Shape
            <select id="bw-shape">
              <option>Rectangular</option>
              <option>Courtyard</option>
              <option>L-Shape</option>
              <option>U-Shape</option>
              <option>T-Shape</option>
              <option>H-Shape</option>
            </select>
          </label>
          <label>Footprint Length (ft) <input type="number" id="bw-len" value="120" /></label>
          <label>Footprint Width (ft) <input type="number" id="bw-wid" value="80" /></label>
          <label>Number of Levels <input type="number" id="bw-lvls" value="1" min="1" max="40" /></label>
          <label>Floor-to-Floor Height (ft) <input type="number" id="bw-flr-h" value="12" /></label>
          <label>Floor-to-Ceiling Height (ft) <input type="number" id="bw-ceil-h" value="9" /></label>
          <label>Perimeter Zone Depth (ft) <input type="number" id="bw-perim" value="15" /></label>
          <label>Window-to-Wall Ratio (WWR %) <input type="number" id="bw-wwr" value="25" /></label>
        </div>
      `;
      footEl.innerHTML = `
        <button class="btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn-sm primary" onclick="app.submitBuildingWizard()">Generate Building &amp; Space Model</button>
      `;
    } else if (wizType === "equipment") {
      titleEl.textContent = "HVAC Equipment & Central Plant Wizard";
      const sysOpts = this.state.catalogs.air_system_types.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
      const pltOpts = this.state.catalogs.plant_types.map(t => `<option value="${t.name}">${t.name}</option>`).join("");
      bodyEl.innerHTML = `
        <div class="form-grid">
          <label>Air System Name <input type="text" id="ew-sys-name" value="${this.state.project.air_systems[0].name}" /></label>
          <label>Air System Type <select id="ew-sys-type">${sysOpts}</select></label>
          <label>Cooling Supply Temp (F) <input type="number" id="ew-sup-t" value="55.0" /></label>
          <label>DX / Chiller Efficiency (EER) <input type="number" id="ew-eer" value="11.2" step="0.2" /></label>
          <label>Add Central Hydronic Plant?
            <select id="ew-add-plant">
              <option value="yes">Yes — Add Chilled Water &amp; Hot Water Plant</option>
              <option value="no">No — Packaged DX / Standalone</option>
            </select>
          </label>
          <label>Central Plant Type <select id="ew-plt-type">${pltOpts}</select></label>
        </div>
      `;
      footEl.innerHTML = `
        <button class="btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn-sm primary" onclick="app.submitEquipmentWizard()">Apply Equipment &amp; Plant</button>
      `;
    } else if (wizType === "tariff") {
      titleEl.textContent = "Utility Rate Wizard — US EIA State Averages & Brasil Commercial Tariffs";
      const tRows = this.state.catalogs.utility_tariff_templates.map((t, i) => `
        <tr onclick="app.applyTariffTemplate(${i})">
          <td><strong>${t.region}</strong></td>
          <td>$${t.electric_usd_kwh.toFixed(4)} / kWh</td>
          <td>$${t.gas_usd_mcf.toFixed(2)} / MCF</td>
          <td>${t.co2_elec_lb_kwh} lb/kWh</td>
          <td><button class="btn-sm primary">Select</button></td>
        </tr>
      `).join("");
      bodyEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Region / Utility Template</th><th>Electric Rate</th><th>Natural Gas Rate</th><th>CO2e Factor</th><th>Action</th></tr></thead>
          <tbody>${tRows}</tbody>
        </table>
      `;
      footEl.innerHTML = `<button class="btn-sm" onclick="app.closeModal()">Close</button>`;
    }
  },

  renderWizardStationsTable(stations) {
    return `
      <table class="data-table">
        <thead><tr><th>Location</th><th>Climate Zone</th><th>Lat / Long</th><th>Elev (ft)</th><th>Summer DB/WB</th><th>Winter DB</th><th>Select</th></tr></thead>
        <tbody>
          ${stations.map((st, i) => `
            <tr onclick="app.applyWeatherStation(${i})">
              <td><strong>${st.location}</strong></td>
              <td>${st.climate_zone}</td>
              <td>${st.latitude} / ${st.longitude}</td>
              <td>${st.elevation_ft}</td>
              <td>${st.summer_db_f} / ${st.summer_wb_f} F</td>
              <td>${st.winter_db_f} F</td>
              <td><button class="btn-sm primary">Use</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  },

  async searchWizardStations(q) {
    const res = await fetch(`/api/weather/stations?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    this._wizardStations = data.stations;
    document.getElementById("wiz-stations-table-wrap").innerHTML =
      this.renderWizardStationsTable(data.stations);
  },

  async applyWeatherStation(idx) {
    const st = this._wizardStations[idx];
    if (!st) return;
    Object.assign(this.state.project.weather, {
      location: st.location,
      climate_zone: st.climate_zone,
      latitude: st.latitude,
      longitude: st.longitude,
      elevation_ft: st.elevation_ft,
      timezone: st.timezone,
      summer_db_f: st.summer_db_f,
      summer_wb_f: st.summer_wb_f,
      daily_range_f: st.daily_range_f,
      winter_db_f: st.winter_db_f,
      winter_wb_f: st.winter_wb_f,
      sim_weather_name: st.sim_station,
    });
    const statusEl = document.getElementById("status-msg");
    if (statusEl) statusEl.textContent = `Applied Station: ${st.location} (${st.climate_zone}) — Recalculating...`;
    this.closeModal();
    await this.runCalculations();
  },

  async submitBuildingWizard() {
    const payload = {
      name: document.getElementById("bw-name").value,
      building_type: document.getElementById("bw-type").value,
      shape: document.getElementById("bw-shape").value,
      length_ft: parseFloat(document.getElementById("bw-len").value),
      width_ft: parseFloat(document.getElementById("bw-wid").value),
      levels: parseInt(document.getElementById("bw-lvls").value),
      level_height_ft: parseFloat(document.getElementById("bw-flr-h").value),
      ceiling_height_ft: parseFloat(document.getElementById("bw-ceil-h").value),
      perimeter_depth_ft: parseFloat(document.getElementById("bw-perim").value),
      wwr_pct: parseFloat(document.getElementById("bw-wwr").value),
    };
    const res = await fetch("/api/wizards/building", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.closeModal();
    this.selectCategory("space_models");
    this.refreshAllUI();
  },

  async submitEquipmentWizard() {
    const sys = this.state.project.air_systems[0];
    sys.name = document.getElementById("ew-sys-name").value;
    sys.system_type = document.getElementById("ew-sys-type").value;
    sys.central_cooling.supply_temp_f = parseFloat(document.getElementById("ew-sup-t").value);
    sys.central_cooling.eer = parseFloat(document.getElementById("ew-eer").value);
    if (document.getElementById("ew-add-plant").value === "yes") {
      this.state.project.plants = [{
        id: "PLT_WIZ_1",
        name: "Central Chilled & Hot Water Plant",
        plant_type: document.getElementById("ew-plt-type").value,
        fluid_type: "Water",
        glycol_pct: 0.0,
        chw_delta_t_f: 10.0,
        hw_delta_t_f: 20.0,
      }];
    }
    this.closeModal();
    await this.runCalculations();
  },

  async applyTariffTemplate(idx) {
    const t = this.state.catalogs.utility_tariff_templates[idx];
    if (!t) return;
    this.state.project.libraries.electric_rates[0].name = t.region;
    this.state.project.libraries.electric_rates[0].flat_price_usd_per_kwh = t.electric_usd_kwh;
    this.state.project.libraries.electric_rates[0].co2e_lb_per_kwh = t.co2_elec_lb_kwh;
    this.state.project.libraries.fuel_rates[0].name = `Gas - ${t.region}`;
    this.state.project.libraries.fuel_rates[0].flat_price_usd_per_unit = t.gas_usd_mcf;
    this.closeModal();
    await this.runCalculations();
  },

  openPreferencesModal() {
    const backdrop = document.getElementById("modal-backdrop");
    const p = this.state.project.project_info;
    backdrop.style.display = "flex";
    document.getElementById("modal-title").textContent = "Project Preferences (Units, ASHRAE Standards & LEED)";
    document.getElementById("modal-body").innerHTML = `
      <div class="form-grid">
        <label>Project Name <input type="text" id="pref-name" value="${p.name}" /></label>
        <label>Measurement Units
          <select id="pref-units">
            <option value="IP" ${p.units_system==="IP"?"selected":""}>English (IP)</option>
            <option value="SI" ${p.units_system==="SI"?"selected":""}>Metric (SI)</option>
          </select>
        </label>
        <label>Ventilation Standard
          <select id="pref-vent">
            <option>ASHRAE Standard 62.1-2022</option>
            <option>ASHRAE Standard 62.1-2019</option>
            <option>ASHRAE Standard 62.1-2016</option>
            <option>ASHRAE Standard 62.1-2013</option>
          </select>
        </label>
        <label>Energy Standard
          <select id="pref-energy">
            <option>ASHRAE Standard 90.1-2022</option>
            <option>ASHRAE Standard 90.1-2019</option>
            <option>ASHRAE Standard 90.1-2016</option>
            <option>ASHRAE Standard 90.1-2013</option>
          </select>
        </label>
      </div>
    `;
    document.getElementById("modal-footer").innerHTML = `
      <button class="btn-sm" onclick="app.closeModal()">Cancel</button>
      <button class="btn-sm primary" onclick="app.savePreferences()">Save Preferences</button>
    `;
  },

  savePreferences() {
    const p = this.state.project.project_info;
    p.name = document.getElementById("pref-name").value;
    p.units_system = document.getElementById("pref-units").value;
    p.ventilation_standard = document.getElementById("pref-vent").value;
    p.energy_standard = document.getElementById("pref-energy").value;
    this.closeModal();
    this.refreshAllUI();
  },

  openGbxmlImportModal() {
    const backdrop = document.getElementById("modal-backdrop");
    backdrop.style.display = "flex";
    document.getElementById("modal-title").textContent = "Import gbXML BIM Geometry";
    document.getElementById("modal-body").innerHTML = `
      <p style="margin-bottom:8px">Paste gbXML content below or export current project to gbXML first to test:</p>
      <textarea id="gbxml-textarea" style="width:100%;height:220px;font-family:monospace;font-size:11.5px"></textarea>
    `;
    document.getElementById("modal-footer").innerHTML = `
      <button class="btn-sm" onclick="app.closeModal()">Cancel</button>
      <button class="btn-sm primary" onclick="app.submitGbxmlImport()">Import gbXML</button>
    `;
  },

  async submitGbxmlImport() {
    const xml = document.getElementById("gbxml-textarea").value;
    if (!xml.trim()) return;
    const res = await fetch("/api/import/gbxml", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xml_content: xml }),
    });
    const data = await res.json();
    this.state.project = data.project;
    this.state.calculations = data.calculations;
    this.closeModal();
    this.refreshAllUI();
  },

  closeModal() {
    document.getElementById("modal-backdrop").style.display = "none";
  },
};

window.addEventListener("DOMContentLoaded", () => app.init());
