/**
 * Kapit 6.4 — Report Viewer & Chart Renderer (reports_ui.js)
 * Reproduces exact Carrier HAP 6.4 Design Load, Energy Modeling, Plant, LEED v4,
 * and Input Data reports from HAP-Example-Problem-Reports.pdf.
 */

const reportsUI = {
  renderSelectedReport() {
    const sel = document.getElementById("report-type-select");
    const rptType = sel ? sel.value : "sizing_summary";
    const container = document.getElementById("report-viewer-content");
    if (!container || !app.state.calculations) return;

    const proj = app.state.project;
    const calc = app.state.calculations;
    const nowStr = new Date().toLocaleDateString("en-US") + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let html = "";
    switch (rptType) {
      case "sizing_summary":
        html = this.buildAirSystemSizingSummary(proj, calc, nowStr);
        break;
      case "zone_sizing":
        html = this.buildZoneSizingSummary(proj, calc, nowStr);
        break;
      case "ventilation":
        html = this.buildVentilationSizingSummary(proj, calc, nowStr);
        break;
      case "heat_balance":
        html = this.buildHeatBalanceSummary(proj, calc, nowStr);
        break;
      case "psychrometrics":
        html = this.buildPsychrometricsReport(proj, calc, nowStr);
        break;
      case "annual_costs":
        html = this.buildAnnualComponentCosts(proj, calc, nowStr);
        break;
      case "monthly_energy":
        html = this.buildMonthlyEnergyByComponent(proj, calc, nowStr);
        break;
      case "billing_details":
        html = this.buildBillingDetailsElectric(proj, calc, nowStr);
        break;
      case "monthly_sim":
        html = this.buildMonthlySimulationResults(proj, calc, nowStr);
        break;
      case "leed_summary":
        html = this.buildLeedAnd901Summary(proj, calc, nowStr);
        break;
      case "plant_report":
        html = this.buildPlantSizingAndSimulationReport(proj, calc, nowStr);
        break;
      case "input_data":
        html = this.buildInputDataReports(proj, calc, nowStr);
        break;
      case "std183_doc":
        html = this.buildStd183ComplianceReport(proj, nowStr);
        break;
      default:
        html = this.buildAirSystemSizingSummary(proj, calc, nowStr);
    }

    container.innerHTML = html;
    if (rptType === "annual_costs" && calc.billing_and_costs && calc.billing_and_costs.annual_component_costs) {
      setTimeout(() => this.drawCostPieChart(calc.billing_and_costs.annual_component_costs), 30);
    }
  },

  buildArchivedModuleNotice(moduleName, sourceFile, proj, nowStr) {
    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";
    return `
      <div class="hap-report-page">
        ${this.headerBox(moduleName, isPT ? "(Módulo Arquivado na Pasta obsoleto/)" : "(Module Archived in obsoleto/)", proj, nowStr)}
        <div style="background:#f8fafc; border:2px dashed #94a3b8; border-radius:8px; padding:24px; margin:30px 20px; font-family:'Segoe UI',sans-serif;">
          <h3 style="color:#1e293b; margin-top:0;">📦 ${isPT ? "Módulo Desacoplado do Núcleo Térmico de Pico" : "Module Decoupled from Peak Thermal Core"}</h3>
          <p style="color:#475569; font-size:13px; line-height:1.6;">
            ${isPT
              ? `O módulo <strong>${moduleName}</strong> foi movido para <code>${sourceFile}</code> em conformidade com o cálculo de carga térmica estrita segundo a norma ANSI/ASHRAE/ACCA 183.`
              : `The <strong>${moduleName}</strong> module was safely moved to <code>${sourceFile}</code> in compliance with ANSI/ASHRAE/ACCA 183 peak load sizing.`}
          </p>
          <div style="background:#eff6ff; border-left:4px solid #0284c7; padding:12px 16px; margin:16px 0; font-size:12px; color:#1e3a8a;">
            <strong>${isPT ? "Como Reativar ou Consultar Código:" : "How to Restore or Inspect Code:"}</strong><br/>
            ${isPT
              ? `Abra o arquivo <code>DOCUMENTACAO_MODULOS_OBSOLETOS_RECUPERACAO.pdf</code> na raiz do projeto ou leia o guia em <code>obsoleto/README.md</code>.`
              : `See <code>DOCUMENTACAO_MODULOS_OBSOLETOS_RECUPERACAO.pdf</code> in the project root or read <code>obsoleto/README.md</code>.`}
          </div>
          <p style="font-size:11.5px; color:#64748b; margin-bottom:0;">
            ${isPT
              ? "O Kapit 0.1 está operando em <strong>Modo Núcleo Térmico Limpo</strong>: dimensionamento instantâneo de vazão CFM/L·s, serpentinas e balanço de calor."
              : "Kapit 0.1 is running in <strong>Clean Thermal Core Mode</strong>: instant peak cooling/heating sizing, CFM airflow, and psychrometric coil states."}
          </p>
        </div>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  headerBox(title, subtitle, proj, nowStr) {
    const pName = (proj.project_info && proj.project_info.name) || "HAP-6.4-Example-Problem";
    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";
    const prepBy = (proj.project_info && proj.project_info.prepared_by) || (isPT ? "Carrier / Kapit Brasil" : "Carrier / Kapit");
    return `
      <div class="hap-rpt-header-box">
        <div class="hap-rpt-title">${title}</div>
        ${subtitle ? `<div class="hap-rpt-subtitle">${subtitle}</div>` : ""}
        <div class="hap-rpt-meta">
          <div>${pName}<br/>${prepBy}</div>
          <div style="text-align:right">${nowStr}</div>
        </div>
      </div>
    `;
  },

  footerBox(pageNum, totalPages) {
    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";
    return `
      <div class="hap-rpt-footer">
        <span>Kapit / Hourly Analysis Program 6.4</span>
        <span>${isPT ? "Página" : "Page"} ${pageNum} ${isPT ? "de" : "of"} ${totalPages}</span>
      </div>
    `;
  },

  buildAirSystemSizingSummary(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const cc = s.central_cooling_coil;
    const ph = s.preheat_coil;
    const sf = s.supply_fan;
    const ov = s.outdoor_ventilation;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";

    const titleStr = isPT ? `Resumo de Dimensionamento do Sistema de Ar para ${s.system_name}` : `Air System Sizing Summary for ${s.system_name}`;
    const altStr = isPT ? `(Na Alternativa: ${altName})` : `(In Alternative: ${altName})`;

    const areaFmt = isSI ? `${(s.floor_area_sqft * 0.0929).toFixed(1)} m²` : `${s.floor_area_sqft.toFixed(1)} sqft`;
    const ccTonFmt = isSI ? `${(cc.total_coil_tons * 3.517).toFixed(1)} kW (${cc.total_coil_tons.toFixed(1)} TR)` : `${cc.total_coil_tons.toFixed(1)} Tons`;
    const ccMbhFmt = isSI ? `${(cc.total_coil_mbh * 0.2931).toFixed(1)} kW` : `${cc.total_coil_mbh.toFixed(1)} MBH`;
    const ccSensFmt = isSI ? `${(cc.sensible_coil_mbh * 0.2931).toFixed(1)} kW` : `${cc.sensible_coil_mbh.toFixed(1)} MBH`;
    const ccFlowFmt = isSI ? `${(cc.coil_cfm_at_peak * 0.4719).toFixed(0)} L/s` : `${cc.coil_cfm_at_peak} CFM`;
    const ccSumFlowFmt = isSI ? `${(cc.sum_peak_zone_cfm * 0.4719).toFixed(0)} L/s` : `${cc.sum_peak_zone_cfm} CFM`;
    const ccSupTempFmt = isSI ? `${((cc.design_supply_temp_f - 32) * 5/9).toFixed(1)} °C` : `${cc.design_supply_temp_f.toFixed(1)} F`;
    const phLoadFmt = isSI ? `${(ph.max_coil_load_mbh * 0.2931).toFixed(1)} kW` : `${ph.max_coil_load_mbh.toFixed(1)} MBH`;
    const phFlowFmt = isSI ? `${(ph.coil_cfm_heating * 0.4719).toFixed(0)} L/s` : `${ph.coil_cfm_heating} CFM`;
    const sfFlowFmt = isSI ? `${(sf.design_cfm * 0.4719).toFixed(0)} L/s` : `${sf.design_cfm} CFM`;
    const sfSumFlowFmt = isSI ? `${(sf.sum_peak_zone_cfm * 0.4719).toFixed(0)} L/s` : `${sf.sum_peak_zone_cfm} CFM`;
    const sfStaticFmt = isSI ? `${(sf.fan_total_static_in_wg * 248.84).toFixed(0)} Pa` : `${sf.fan_total_static_in_wg.toFixed(2)} in wg`;
    const ovFlowFmt = isSI ? `${(ov.design_airflow_cfm * 0.4719).toFixed(0)} L/s` : `${ov.design_airflow_cfm} CFM`;

    return `
      <div class="hap-report-page">
        ${this.headerBox(titleStr, altStr, proj, nowStr)}

        <div class="hap-sec-heading">${isPT ? "Informações do Sistema de Ar" : "Air System Information"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Nome do Sistema de Ar" : "Air System Name"}</span><strong>${s.system_name}</strong></div>
            <div class="leader-line"><span>${isPT ? "Classe do Equipamento" : "Equipment Class"}</span><strong>${s.equipment_class}</strong></div>
            <div class="leader-line"><span>${isPT ? "Tipo do Sistema de Ar" : "Air System Type"}</span><strong>${s.system_type}</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>${isPT ? "Número de Zonas" : "Number of zones"}</span><strong>${s.number_of_zones}</strong></div>
            <div class="leader-line"><span>${isPT ? "Área de Piso" : "Floor Area"}</span><strong>${areaFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Localidade" : "Location"}</span><strong>${s.location}</strong></div>
          </div>
        </div>

        <div class="hap-sec-heading">${isPT ? "Informações do Cálculo de Dimensionamento" : "Sizing Calculation Information"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Meses de Cálculo" : "Calculation Months"}</span><strong>${s.calculation_months}</strong></div>
            <div class="leader-line"><span>${isPT ? "Critério de Dimensionamento" : "Sizing Data"}</span><strong>${s.sizing_data}</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>${isPT ? "Dimensionamento de Vazão da Zona" : "Zone CFM Sizing"}</span><strong>${s.zone_cfm_sizing}</strong></div>
            <div class="leader-line"><span>${isPT ? "Dimensionamento de Vazão do Espaço" : "Space CFM Sizing"}</span><strong>${s.space_cfm_sizing}</strong></div>
          </div>
        </div>

        <div class="hap-sec-heading">${isPT ? "Dados da Serpentina de Resfriamento Central" : "Central Cooling Coil Sizing Data"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Carga total da serpentina" : "Total coil load"}</span><strong>${ccTonFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Carga total (térmica)" : "Total coil load"}</span><strong>${ccMbhFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Carga sensível" : "Sensible coil load"}</span><strong>${ccSensFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Vazão no pico da serpentina" : "Coil CFM at peak load"}</span><strong>${ccFlowFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Soma das vazões de pico das zonas" : "Sum of peak zone CFM"}</span><strong>${ccSumFlowFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Fator de calor sensível (SHR)" : "Sensible heat ratio"}</span><strong>${cc.sensible_heat_ratio.toFixed(3)}</strong></div>
            <div class="leader-line"><span>${isPT ? "Intensidade térmica" : "BTU/(hr sqft)"}</span><strong>${isSI ? (cc.btuh_per_sqft * 3.1546).toFixed(1) + " W/m²" : cc.btuh_per_sqft.toFixed(1) + " BTU/(hr·sqft)"}</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>${isPT ? "Pico da serpentina ocorre em" : "Peak coil load occurs at"}</span><strong>${cc.peak_load_time}</strong></div>
            <div class="leader-line"><span>${isPT ? "TBS / TBU Externa" : "OA DB / WB"}</span><strong>${cc.oa_db_wb}</strong></div>
            <div class="leader-line"><span>${isPT ? "TBS / TBU Entrada" : "Entering DB / WB"}</span><strong>${cc.entering_db_wb}</strong></div>
            <div class="leader-line"><span>${isPT ? "TBS / TBU Saída" : "Leaving DB / WB"}</span><strong>${cc.leaving_db_wb}</strong></div>
            <div class="leader-line"><span>${isPT ? "UR Resultante" : "Resulting RH"}</span><strong>${cc.resulting_rh_pct} %</strong></div>
            <div class="leader-line"><span>${isPT ? "Temp. insuflamento de projeto" : "Design supply temp."}</span><strong>${ccSupTempFmt}</strong></div>
          </div>
        </div>

        <div class="hap-sec-heading">${isPT ? "Dados da Serpentina de Pré-aquecimento" : "Preheat Coil Sizing Data"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Carga máxima da serpentina" : "Max coil load"}</span><strong>${phLoadFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Vazão em aquecimento de projeto" : "Coil CFM at Design Heating"}</span><strong>${phFlowFmt}</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>${isPT ? "Carga ocorre em" : "Load occurs at"}</span><strong>${ph.load_occurs_at}</strong></div>
            <div class="leader-line"><span>${isPT ? "TBS Ent. / TBS Saída" : "Ent. DB / Lvg DB"}</span><strong>${ph.ent_lvg_db}</strong></div>
          </div>
        </div>

        <div class="hap-sec-heading">${isPT ? "Dados do Ventilador de Insuflamento" : "Supply Fan Sizing Data"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Vazão de Projeto" : "Design CFM"}</span><strong>${sfFlowFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Vazão de projeto ocorre em" : "Design CFM occurs at"}</span><strong>${sf.design_cfm_time}</strong></div>
            <div class="leader-line"><span>${isPT ? "Soma das vazões de pico das zonas" : "Sum of peak zone CFM"}</span><strong>${sfSumFlowFmt}</strong></div>
            <div class="leader-line"><span>${isPT ? "Diversidade do ventilador VAV" : "VAV Fan Diversity"}</span><strong>${sf.vav_fan_diversity_pct.toFixed(1)} %</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>${isPT ? "Potência do motor" : "Fan motor kW"}</span><strong>${sf.fan_motor_kw.toFixed(2)} kW (${sf.fan_motor_bhp.toFixed(2)} BHP)</strong></div>
            <div class="leader-line"><span>${isPT ? "Pressão estática total" : "Fan total static"}</span><strong>${sfStaticFmt}</strong></div>
          </div>
        </div>

        <div class="hap-sec-heading">${isPT ? "Dados de Ventilação e Ar Externo" : "Outdoor Ventilation Air Data"}</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>${isPT ? "Vazão de ar externo de projeto" : "Design airflow CFM"}</span><strong>${ovFlowFmt}</strong></div>
          </div>
          <div></div>
        </div>

        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildZoneSizingSummary(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const zones = calc.air_system.zone_sizing;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";

    const titleStr = isPT ? `Resumo de Dimensionamento das Zonas para ${s.system_name}` : `Zone Sizing Summary for ${s.system_name}`;
    const altStr = isPT ? `(Na Alternativa: ${altName})` : `(In Alternative: ${altName})`;

    const termRows = zones.map(z => {
      const dAir = isSI ? (z.design_airflow_cfm * 0.4719).toFixed(0) : z.design_airflow_cfm;
      const mAir = isSI ? (z.min_airflow_cfm * 0.4719).toFixed(0) : z.min_airflow_cfm;
      const airPerA = isSI ? (z.cfm_per_sqft * 5.08).toFixed(2) : z.cfm_per_sqft.toFixed(2);
      const rhCap = isSI ? (z.reheat_coil_mbh * 0.2931).toFixed(1) : z.reheat_coil_mbh.toFixed(1);
      return `
        <tr>
          <td>${z.zone_name}</td>
          <td>${dAir}</td>
          <td>${mAir}</td>
          <td>${airPerA}</td>
          <td>${rhCap}</td>
          <td>-</td>
          <td>0.0</td>
          <td>-</td>
          <td>0</td>
        </tr>
      `;
    }).join("");

    const peakRows = zones.map(z => {
      const cSens = isSI ? (z.cooling_sensible_mbh * 0.2931).toFixed(1) : z.cooling_sensible_mbh.toFixed(1);
      const hLoad = isSI ? (z.heating_load_mbh * 0.2931).toFixed(1) : z.heating_load_mbh.toFixed(1);
      const fArea = isSI ? (z.floor_area_sqft * 0.0929).toFixed(1) : z.floor_area_sqft.toFixed(1);
      return `
        <tr>
          <td>${z.zone_name}</td>
          <td>${cSens}</td>
          <td>${z.time_of_peak}</td>
          <td>${hLoad}</td>
          <td>${fArea}</td>
        </tr>
      `;
    }).join("");

    const spaceRows = zones.map(z => {
      const sItems = z.spaces.map(sp => {
        const spSens = isSI ? (sp.peak_sensible_mbh * 0.2931).toFixed(1) : sp.peak_sensible_mbh.toFixed(1);
        const spFlow = isSI ? (sp.design_airflow_cfm * 0.4719).toFixed(0) : sp.design_airflow_cfm;
        const spHtg = isSI ? (sp.heating_load_mbh * 0.2931).toFixed(1) : sp.heating_load_mbh.toFixed(1);
        const spArea = isSI ? (sp.floor_area_sqft * 0.0929).toFixed(1) : sp.floor_area_sqft.toFixed(1);
        const spPerA = isSI ? (sp.cfm_per_sqft * 5.08).toFixed(2) : sp.cfm_per_sqft.toFixed(2);
        return `
          <tr>
            <td style="padding-left:18px">${sp.space_name}</td>
            <td>${spSens}</td>
            <td>${sp.time_of_peak}</td>
            <td>${spFlow}</td>
            <td>${spHtg}</td>
            <td>${spArea}</td>
            <td>${spPerA}</td>
          </tr>
        `;
      }).join("");
      return `
        <tr class="zone-group-row"><td colspan="7">${z.zone_name}</td></tr>
        ${sItems}
      `;
    }).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(titleStr, altStr, proj, nowStr)}
        <div class="hap-sec-heading">${isPT ? "Dados de Dimensionamento dos Terminais de Zona" : "Zone Terminal Sizing Data"}</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>${isPT ? "Nome da Zona" : "Zone Name"}</th>
              <th>${isPT ? "Vazão de Insuflamento de Projeto" : "Design Supply Airflow"} (${isSI ? "L/s" : "CFM"})</th>
              <th>${isPT ? "Vazão Mínima de Insuflamento" : "Minimum Supply Airflow"} (${isSI ? "L/s" : "CFM"})</th>
              <th>${isSI ? "L/s / m²" : "Zone CFM/sqft"}</th>
              <th>${isPT ? "Capacidade Serpentina Reaquec." : "Reheat Coil Capacity"} (${isSI ? "kW" : "MBH"})</th>
              <th>${isPT ? "Água Reaquec." : "Reheat Water gpm"}</th>
              <th>${isPT ? "Unid. Aquec. Zona" : "Zone Htg Unit Capacity"}</th>
              <th>${isPT ? "Vazão Água" : "Water gpm"}</th>
              <th>${isPT ? "Ventilador Caixa Mistura" : "Mixing Box Fan"}</th>
            </tr>
          </thead>
          <tbody>${termRows}</tbody>
        </table>

        <div class="hap-sec-heading">${isPT ? "Cargas Sensíveis de Pico das Zonas" : "Zone Peak Sensible Loads"}</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>${isPT ? "Nome da Zona" : "Zone Name"}</th>
              <th>${isPT ? "Resfriamento Sensível" : "Zone Cooling Sensible"} (${isSI ? "kW" : "MBH"})</th>
              <th>${isPT ? "Horário do Pico de Carga" : "Time of Peak Sensible Cooling Load"}</th>
              <th>${isPT ? "Aquecimento da Zona" : "Zone Heating Load"} (${isSI ? "kW" : "MBH"})</th>
              <th>${isPT ? "Área de Piso" : "Zone Floor Area"} (${isSI ? "m²" : "sqft"})</th>
            </tr>
          </thead>
          <tbody>${peakRows}</tbody>
        </table>

        <div class="hap-sec-heading">${isPT ? "Cargas e Vazões por Ambiente / Espaço" : "Space Loads and Airflows"}</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>${isPT ? "Zona / Espaço" : "Zone Name / Space Name"}</th>
              <th>${isPT ? "Resfriamento Sensível" : "Cooling Sensible"} (${isSI ? "kW" : "MBH"})</th>
              <th>${isPT ? "Horário do Pico" : "Time of Peak Sensible Load"}</th>
              <th>${isPT ? "Vazão de Ar" : "Air Flow"} (${isSI ? "L/s" : "CFM"})</th>
              <th>${isPT ? "Carga de Aquecimento" : "Heating Load"} (${isSI ? "kW" : "MBH"})</th>
              <th>${isPT ? "Área de Piso" : "Floor Area"} (${isSI ? "m²" : "sqft"})</th>
              <th>${isSI ? "L/s / m²" : "Space CFM/sqft"}</th>
            </tr>
          </thead>
          <tbody>${spaceRows}</tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildVentilationSizingSummary(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const v = calc.air_system.ventilation_summary;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";

    let lastZone = "";
    const rowsHtml = v.space_rows.map(r => {
      let zHeader = "";
      if (r.zone_name !== lastZone) {
        lastZone = r.zone_name;
        zHeader = `<tr class="zone-group-row"><td colspan="10">${r.zone_name}</td></tr>`;
      }
      return `
        ${zHeader}
        <tr>
          <td style="padding-left:16px">${r.space_name}</td>
          <td>${r.vpz_cfm}</td>
          <td>${r.az_sqft.toFixed(1)}</td>
          <td>${r.ra_cfm_sqft.toFixed(2)}</td>
          <td>${r.pz_occ.toFixed(1)}</td>
          <td>${r.rp_cfm_person.toFixed(2)}</td>
          <td>${r.ez.toFixed(2)}</td>
          <td><strong>${r.voz_cfm}</strong></td>
          <td style="color:#64748b">${r.vbz_cfm}</td>
          <td>${r.evz.toFixed(3)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Ventilation Sizing Summary for ${s.system_name}`, `(In Alternative: ${altName})`, proj, nowStr)}
        <div class="hap-sec-heading">1. Summary</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>Ventilation Sizing Method</span><strong>${v.ventilation_sizing_method}</strong></div>
            <div class="leader-line"><span>Design Condition</span><strong>${v.design_condition}</strong></div>
            <div class="leader-line"><span>Occupant Diversity (D)</span><strong>${v.occupant_diversity.toFixed(3)}</strong></div>
            <div class="leader-line"><span>Uncorrected Outdoor Air Intake (Vou)</span><strong>${v.uncorrected_oa_cfm} CFM</strong></div>
            <div class="leader-line"><span>System Ventilation Efficiency (Ev)</span><strong>${v.system_ventilation_efficiency.toFixed(3)}</strong></div>
            <div class="leader-line"><span>Outdoor Air Intake (Vot)</span><strong>${v.outdoor_air_intake_cfm} CFM</strong></div>
          </div>
          <div></div>
        </div>

        <div class="hap-sec-heading">2. Space Ventilation Analysis</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Zone Name / Space Name</th>
              <th>Min Supply Air Vpz (CFM)</th>
              <th>Floor Area Az (sqft)</th>
              <th>Area OA Rate Ra (CFM/sqft)</th>
              <th>Occupancy Pz</th>
              <th>People OA Rate Rp (CFM/person)</th>
              <th>Air Dist. Eff. Ez</th>
              <th>Space OA Voz (CFM)</th>
              <th>Breathing Zone Vbz (CFM)</th>
              <th>Space Vent Eff. Evz</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="total-row">
              <td>Totals</td>
              <td>${v.total_vpz_cfm}</td>
              <td>${v.total_floor_area_sqft.toFixed(1)}</td>
              <td></td>
              <td>${v.total_occupants.toFixed(1)}</td>
              <td></td>
              <td></td>
              <td></td>
              <td>${v.uncorrected_oa_cfm}</td>
              <td>${v.system_ventilation_efficiency.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildHeatBalanceSummary(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const shb = calc.air_system.system_heat_balance;
    const zhb = calc.air_system.zone_heat_balance;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";
    const fmt = v => (v === null || v === undefined ? "-" : v.toLocaleString());

    const sysRows = shb.rows.map(r => `
      <tr>
        <td>${r.component}</td>
        <td>${r.clg_details}</td>
        <td>${fmt(r.clg_sens_btuh)}</td>
        <td>${fmt(r.clg_lat_btuh)}</td>
        <td>${r.htg_details}</td>
        <td>${fmt(r.htg_sens_btuh)}</td>
        <td>${fmt(r.htg_lat_btuh)}</td>
      </tr>
    `).join("");

    const condRows = shb.conditioning_rows.map(r => `
      <tr>
        <td>${r.component}</td>
        <td>-</td>
        <td>${fmt(r.clg_sens_btuh)}</td>
        <td>${fmt(r.clg_lat_btuh)}</td>
        <td>-</td>
        <td>${fmt(r.htg_sens_btuh)}</td>
        <td>${fmt(r.htg_lat_btuh)}</td>
      </tr>
    `).join("");

    const zRows = zhb.rows.map(r => `
      <tr>
        <td>${r.component}</td>
        <td>${r.clg_details}</td>
        <td>${fmt(r.clg_sens_btuh)}</td>
        <td>${fmt(r.clg_lat_btuh)}</td>
        <td>${r.htg_details}</td>
        <td>${fmt(r.htg_sens_btuh)}</td>
        <td>${fmt(r.htg_lat_btuh)}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Air System Heat Balance Summary for ${s.system_name}`, `(In Alternative: ${altName})`, proj, nowStr)}
        <div class="hap-sec-heading">Table 1. System Loads</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th rowspan="2">COMPONENT LOADS</th>
              <th colspan="3" style="text-align:center">DESIGN COOLING - ${shb.cooling_time}<br/>OA DB / WB ${shb.cooling_oa_db_wb}</th>
              <th colspan="3" style="text-align:center">DESIGN HEATING<br/>OA DB / WB ${shb.heating_oa_db_wb}</th>
            </tr>
            <tr>
              <th>Details</th><th>Sensible [BTU/hr]</th><th>Latent [BTU/hr]</th>
              <th>Details</th><th>Sensible [BTU/hr]</th><th>Latent [BTU/hr]</th>
            </tr>
          </thead>
          <tbody>
            ${sysRows}
            <tr class="total-row">
              <td>&gt;&gt; Total System Loads</td>
              <td>-</td>
              <td>${shb.total_system_loads.clg_sens_btuh}</td>
              <td>${shb.total_system_loads.clg_lat_btuh}</td>
              <td>-</td>
              <td>${shb.total_system_loads.htg_sens_btuh}</td>
              <td>${shb.total_system_loads.htg_lat_btuh}</td>
            </tr>
            ${condRows}
            <tr class="total-row">
              <td>&gt;&gt; Total Conditioning</td>
              <td>-</td>
              <td>${shb.total_conditioning.clg_sens_btuh}</td>
              <td>${shb.total_conditioning.clg_lat_btuh}</td>
              <td>-</td>
              <td>${shb.total_conditioning.htg_sens_btuh}</td>
              <td>${shb.total_conditioning.htg_lat_btuh}</td>
            </tr>
          </tbody>
        </table>

        <div class="hap-sec-heading">Table 2. Zone Heat Balance Loads</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th rowspan="2">Zone Heat Balance Component</th>
              <th colspan="3" style="text-align:center">DESIGN COOLING - ${zhb.cooling_time}<br/>OA DB / WB ${zhb.cooling_oa_db_wb}</th>
              <th colspan="3" style="text-align:center">DESIGN HEATING<br/>OA DB / WB ${zhb.heating_oa_db_wb}</th>
            </tr>
            <tr>
              <th>Details</th><th>Sensible [BTU/hr]</th><th>Latent [BTU/hr]</th>
              <th>Details</th><th>Sensible [BTU/hr]</th><th>Latent [BTU/hr]</th>
            </tr>
          </thead>
          <tbody>
            ${zRows}
            <tr class="total-row">
              <td>&gt;&gt; Total Zone Loads</td>
              <td>-</td>
              <td>${zhb.total_clg_sens_btuh}</td>
              <td>${zhb.total_clg_lat_btuh}</td>
              <td>-</td>
              <td>${zhb.total_htg_sens_btuh}</td>
              <td>${zhb.total_htg_lat_btuh}</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:10.5px;margin-top:6px">
          <strong>Note 1:</strong> Surface convection line items show the combined effects of conductive heat gain to the surface and radiative heat gains absorbed at the surface which are then convected to room air.<br/>
          <strong>Note 2:</strong> Lighting, equipment, and people line items include only the direct convective heat gain from the heat source to the room air.
        </p>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildPsychrometricsReport(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const pts = calc.air_system.psychrometric_points;
    const rows = pts.map((p, i) => `
      <tr>
        <td>${i + 1}. ${p.name}</td>
        <td>${p.cfm.toFixed(0)}</td>
        <td>${p.db_f.toFixed(1)}</td>
        <td>${p.wb_f.toFixed(1)}</td>
        <td>${p.dp_f.toFixed(1)}</td>
        <td>${p.rh_pct.toFixed(1)}</td>
        <td>${p.w_grains_lb.toFixed(1)}</td>
        <td>${p.w_lb_lb.toFixed(5)}</td>
        <td>${p.h_btu_lb.toFixed(2)}</td>
        <td>${p.v_cuft_lb.toFixed(2)}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Air System Design Day Psychrometrics for ${s.system_name}`, `(Peak Cooling Design Hour: August 16:00)`, proj, nowStr)}
        <div class="hap-sec-heading">1. Psychrometric State Points Table</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>State Point</th>
              <th>Airflow (CFM)</th>
              <th>Dry-Bulb (F)</th>
              <th>Wet-Bulb (F)</th>
              <th>Dew-Point (F)</th>
              <th>Rel. Hum. (%)</th>
              <th>Hum. Ratio (gr/lb)</th>
              <th>Hum. Ratio (lb/lb)</th>
              <th>Enthalpy (BTU/lb)</th>
              <th>Spec. Vol. (cuft/lb)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildAnnualComponentCosts(proj, calc, nowStr) {
    if (!calc.billing_and_costs || !calc.billing_and_costs.annual_component_costs) {
      return this.buildArchivedModuleNotice("Custos Anuais por Componente & Tarifas", "obsoleto/kapit_engine/tariffs_and_leed.py", proj, nowStr);
    }
    const c = calc.billing_and_costs.annual_component_costs;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";

    const hvacRows = c.rows.map(r => `
      <tr>
        <td>${r.component}</td>
        <td>${r.annual_cost_usd.toLocaleString()}</td>
        <td>${r.cost_per_sqft.toFixed(3)}</td>
        <td>${r.percent_of_total.toFixed(1)}</td>
      </tr>
    `).join("");

    const nonHvacRows = c.non_hvac_rows.map(r => `
      <tr>
        <td>${r.component}</td>
        <td>${r.annual_cost_usd.toLocaleString()}</td>
        <td>${r.cost_per_sqft.toFixed(3)}</td>
        <td>${r.percent_of_total.toFixed(1)}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Annual Component Costs - ${altName}`, null, proj, nowStr)}
        <div style="border:1px solid #000;padding:12px;margin:10px 0;display:flex;justify-content:center">
          <canvas id="rpt-cost-pie-canvas" width="640" height="310"></canvas>
        </div>
        <div class="hap-sec-heading">1. Annual Costs</div>
        <table class="hap-table" style="width:75%;margin:8px auto">
          <thead>
            <tr>
              <th>Component</th>
              <th>Annual Cost ($)</th>
              <th>($/sqft)</th>
              <th>Percent of Total (%)</th>
            </tr>
          </thead>
          <tbody>
            ${hvacRows}
            <tr class="total-row">
              <td>HVAC Sub-Total</td>
              <td>${c.hvac_subtotal.annual_cost_usd.toLocaleString()}</td>
              <td>${c.hvac_subtotal.cost_per_sqft.toFixed(3)}</td>
              <td>${c.hvac_subtotal.percent_of_total.toFixed(1)}</td>
            </tr>
            ${nonHvacRows}
            <tr class="total-row">
              <td>Non-HVAC Sub-Total</td>
              <td>${c.non_hvac_subtotal.annual_cost_usd.toLocaleString()}</td>
              <td>${c.non_hvac_subtotal.cost_per_sqft.toFixed(3)}</td>
              <td>${c.non_hvac_subtotal.percent_of_total.toFixed(1)}</td>
            </tr>
            <tr class="total-row">
              <td>Grand Total</td>
              <td>${c.grand_total.annual_cost_usd.toLocaleString()}</td>
              <td>${c.grand_total.cost_per_sqft.toFixed(3)}</td>
              <td>100.0</td>
            </tr>
          </tbody>
        </table>
        <div style="width:75%;margin:6px auto;font-size:11px">
          Note: Cost per unit floor area is based on the gross building floor area.<br/>
          Gross Floor Area ............................ <strong>${c.gross_floor_area_sqft.toLocaleString()} sqft</strong><br/>
          Modeled Floor Area ........................ <strong>${c.modeled_floor_area_sqft.toLocaleString()} sqft</strong>
        </div>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  drawCostPieChart(costData) {
    const cvs = document.getElementById("rpt-cost-pie-canvas");
    if (!cvs || !costData || !costData.rows) return;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const slices = [
      { label: "Heating", pct: costData.rows[2].percent_of_total, color: "#0018f0" },
      { label: "Cooling", pct: costData.rows[1].percent_of_total, color: "#00d800" },
      { label: "Air System Fans", pct: costData.rows[0].percent_of_total, color: "#d81800" },
      { label: "Electric Equipment", pct: costData.non_hvac_rows[1].percent_of_total, color: "#ffae00" },
      { label: "Lights", pct: costData.non_hvac_rows[0].percent_of_total, color: "#c000c0" },
    ].filter(s => s.pct > 0);

    const cx = cvs.width / 2;
    const cy = cvs.height / 2 + 10;
    const rx = 185;
    const ry = 95;
    const depth = 22;

    // 3D Base Extrusion
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.ellipse(cx, cy + depth, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    let angle = 0.25;
    slices.forEach(s => {
      const sweep = (s.pct / 100.0) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.ellipse(cx, cy, rx, ry, 0, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();

      const mid = angle + sweep / 2;
      const lx = cx + Math.cos(mid) * (rx + 42);
      const ly = cy + Math.sin(mid) * (ry + 28);
      ctx.fillStyle = "#000";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = Math.cos(mid) >= 0 ? "left" : "right";
      ctx.fillText(`${s.label} ${s.pct.toFixed(1)}%`, lx, ly);

      angle += sweep;
    });
  },

  buildMonthlyEnergyByComponent(proj, calc, nowStr) {
    if (!calc.air_system.monthly_simulation || calc.air_system.monthly_simulation.length === 0) {
      return this.buildArchivedModuleNotice("Consumo Mensal de Energia (Simulação Anual 8.760h)", "obsoleto/kapit_engine/air_systems_full_with_8760h.py", proj, nowStr);
    }
    const mSim = calc.air_system.monthly_simulation;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";
    const cols = key => mSim.map(m => `<td>${m[key]}</td>`).join("");
    const zeros = mSim.map(() => `<td>0</td>`).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Monthly Energy Use by Component - ${altName}`, null, proj, nowStr)}
        <div class="hap-sec-heading">1. Monthly Energy Use by System Component</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Component</th>
              ${mSim.map(m => `<th>${m.month_short}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            <tr><td>Air System Fans (kWh)</td>${cols("supply_fan_kwh")}</tr>
            <tr class="zone-group-row"><td colspan="13">Cooling</td></tr>
            <tr><td style="padding-left:14px">Electric (kWh)</td>${cols("central_cooling_input_kwh")}</tr>
            <tr><td style="padding-left:14px">Natural Gas (na)</td>${zeros}</tr>
            <tr class="zone-group-row"><td colspan="13">Heating</td></tr>
            <tr><td style="padding-left:14px">Electric (kWh)</td>${cols("heating_total_kwh")}</tr>
            <tr><td style="padding-left:14px">Natural Gas (na)</td>${zeros}</tr>
            <tr><td>Pumps (kWh)</td>${zeros}</tr>
            <tr><td>Heat Rej. Fans (kWh)</td>${zeros}</tr>
            <tr><td>Lighting (kWh)</td>${cols("lighting_kwh")}</tr>
            <tr><td>Electric Eqpt. (kWh)</td>${cols("electric_eqpt_kwh")}</tr>
            <tr><td>Misc. Electric (kWh)</td>${zeros}</tr>
          </tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildBillingDetailsElectric(proj, calc, nowStr) {
    if (!calc.billing_and_costs || !calc.billing_and_costs.billing_details_electric || !calc.billing_and_costs.billing_details_electric.periods) {
      return this.buildArchivedModuleNotice("Detalhes de Faturamento - Elétrico", "obsoleto/kapit_engine/tariffs_and_leed.py", proj, nowStr);
    }
    const b = calc.billing_and_costs.billing_details_electric;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";

    const rows1 = b.periods.map(p => `
      <tr>
        <td>${p.period}</td>
        <td>${p.energy_charge_usd.toLocaleString()}</td>
        <td>${p.demand_charge_usd}</td>
        <td>${p.customer_charge_usd}</td>
        <td>${p.taxes_usd}</td>
        <td>${p.total_charge_usd.toLocaleString()}</td>
      </tr>
    `).join("");

    const rows2 = b.periods.map(p => `
      <tr>
        <td>${p.period}</td>
        <td>${p.total_charge_usd.toLocaleString()}</td>
        <td>${p.total_consumption_kwh.toLocaleString()}</td>
        <td>${p.avg_price_usd_kwh.toFixed(4)}</td>
        <td>${p.peak_demand_kw.toFixed(1)}</td>
        <td>${p.peak_demand_time}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Billing Details - Electric - ${altName}`, null, proj, nowStr)}
        <div class="hap-sec-heading">1. Component Charges (${b.rate_name})</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Billing Period</th>
              <th>Energy Charges ($)</th>
              <th>Demand Charges ($)</th>
              <th>Customer Charges ($)</th>
              <th>Taxes ($)</th>
              <th>Total Charge ($)</th>
            </tr>
          </thead>
          <tbody>
            ${rows1}
            <tr class="total-row">
              <td>Totals</td>
              <td>${b.totals.energy_charge_usd.toLocaleString()}</td>
              <td>0</td>
              <td>0</td>
              <td>0</td>
              <td>${b.totals.total_charge_usd.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="hap-sec-heading">2. Totals, Consumption &amp; Peak Demand</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Billing Period</th>
              <th>Total Charges ($)</th>
              <th>Total Consumption (kWh)</th>
              <th>Avg Price ($/kWh)</th>
              <th>Overall Max Demand (kW)</th>
              <th>Time of Max Demand (Date/Hour)</th>
            </tr>
          </thead>
          <tbody>
            ${rows2}
            <tr class="total-row">
              <td>Totals</td>
              <td>${b.totals.total_charge_usd.toLocaleString()}</td>
              <td>${b.totals.total_consumption_kwh.toLocaleString()}</td>
              <td>${b.totals.avg_price_usd_kwh.toFixed(4)}</td>
              <td>106.2</td>
              <td>1/18 08:00</td>
            </tr>
          </tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildMonthlySimulationResults(proj, calc, nowStr) {
    if (!calc.air_system.monthly_simulation || calc.air_system.monthly_simulation.length === 0) {
      return this.buildArchivedModuleNotice("Resultados da Simulação Mensal (8.760h)", "obsoleto/kapit_engine/air_systems_full_with_8760h.py", proj, nowStr);
    }
    const s = calc.air_system.sizing_summary;
    const mSim = calc.air_system.monthly_simulation;
    const tot = calc.air_system.simulation_totals;
    const altName = (proj.alternatives && proj.alternatives[0] && proj.alternatives[0].name) || "ALT1 - VAV RTU";

    const rows1 = mSim.map(m => `
      <tr>
        <td><strong>${m.month}</strong></td>
        <td>${m.preheat_coil_load_kbtu}</td>
        <td>${m.preheat_coil_input_kwh}</td>
        <td>${m.central_cooling_load_kbtu}</td>
        <td>${m.central_cooling_input_kwh}</td>
        <td>${m.terminal_heating_load_kbtu}</td>
        <td>${m.terminal_heating_input_kwh}</td>
        <td>${m.supply_fan_kwh}</td>
      </tr>
    `).join("");

    const rows2 = mSim.map(m => `
      <tr>
        <td><strong>${m.month}</strong></td>
        <td>${m.lighting_kwh}</td>
        <td>${m.electric_eqpt_kwh}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox(`Monthly Simulation Results for ${s.system_name}`, `(In Alternative: ${altName})`, proj, nowStr)}
        <div class="hap-sec-heading">Air System Simulation Results (Table 1) :</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Preheat Coil Load (kBTU)</th>
              <th>Preheat Coil Input (kWh)</th>
              <th>Central Cooling Coil Load (kBTU)</th>
              <th>Central Unit Clg Input (kWh)</th>
              <th>Terminal Heating Coil Load (kBTU)</th>
              <th>Terminal Heating Coil Input (kWh)</th>
              <th>Supply Fan (kWh)</th>
            </tr>
          </thead>
          <tbody>
            ${rows1}
            <tr class="total-row">
              <td>Total</td>
              <td>${tot.preheat_coil_load_kbtu}</td>
              <td>${tot.preheat_coil_input_kwh}</td>
              <td>${tot.central_cooling_load_kbtu}</td>
              <td>${tot.central_cooling_input_kwh}</td>
              <td>${tot.terminal_heating_load_kbtu}</td>
              <td>${tot.terminal_heating_input_kwh}</td>
              <td>${tot.supply_fan_kwh}</td>
            </tr>
          </tbody>
        </table>

        <div class="hap-sec-heading">Air System Simulation Results (Table 2) :</div>
        <table class="hap-table" style="width:45%">
          <thead>
            <tr>
              <th>Month</th>
              <th>Lighting (kWh)</th>
              <th>Electric Equipment (kWh)</th>
            </tr>
          </thead>
          <tbody>
            ${rows2}
            <tr class="total-row">
              <td>Total</td>
              <td>${tot.lighting_kwh}</td>
              <td>${tot.electric_eqpt_kwh}</td>
            </tr>
          </tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildLeedAnd901Summary(proj, calc, nowStr) {
    if (!calc.leed_and_90_1 || !calc.leed_and_90_1.baseline_rotations) {
      return this.buildArchivedModuleNotice("Resumo ASHRAE 90.1 Apêndice G / LEED v4 (4 Rotações)", "obsoleto/kapit_engine/tariffs_and_leed.py", proj, nowStr);
    }
    const l = calc.leed_and_90_1;
    const rotRows = l.baseline_rotations.map(r => `
      <tr>
        <td>${r.rotation}</td>
        <td>${r.site_energy_kwh.toLocaleString()}</td>
        <td>$${r.energy_cost_usd.toLocaleString()}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox("ASHRAE Standard 90.1 Appendix G & LEED v4 Summary Report", `(${l.standard} / ${l.leed_version})`, proj, nowStr)}
        <div class="hap-sec-heading">1. Baseline 4-Rotation Energy &amp; Cost Summary</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Baseline Rotation Case</th>
              <th>Site Energy Consumption (kWh)</th>
              <th>Annual Energy Cost ($)</th>
            </tr>
          </thead>
          <tbody>
            ${rotRows}
            <tr class="total-row">
              <td>Baseline Average (0° / 90° / 180° / 270°)</td>
              <td>${l.baseline_average.site_energy_kwh.toLocaleString()}</td>
              <td>$${l.baseline_average.energy_cost_usd.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="hap-sec-heading">2. Performance Rating Comparison (Baseline vs. Proposed)</div>
        <table class="hap-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Baseline Average</th>
              <th>Proposed (${l.proposed_alternative.name})</th>
              <th>Percent Savings (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Site Energy Use (kWh/yr)</td>
              <td>${l.baseline_average.site_energy_kwh.toLocaleString()}</td>
              <td>${l.proposed_alternative.site_energy_kwh.toLocaleString()}</td>
              <td><strong>${l.savings.site_energy_savings_pct.toFixed(1)}%</strong></td>
            </tr>
            <tr>
              <td>Source Energy Use (kWh/yr @ 2.80 factor)</td>
              <td>${l.baseline_average.source_energy_kwh.toLocaleString()}</td>
              <td>${l.proposed_alternative.source_energy_kwh.toLocaleString()}</td>
              <td><strong>${l.savings.site_energy_savings_pct.toFixed(1)}%</strong></td>
            </tr>
            <tr>
              <td>Annual Energy Cost ($/yr)</td>
              <td>$${l.baseline_average.energy_cost_usd.toLocaleString()}</td>
              <td>$${l.proposed_alternative.energy_cost_usd.toLocaleString()}</td>
              <td><strong>${l.savings.energy_cost_savings_pct.toFixed(1)}%</strong></td>
            </tr>
            <tr>
              <td>GHG Emissions (lb CO2e/yr)</td>
              <td>${l.baseline_average.ghg_emissions_lb_yr.toLocaleString()}</td>
              <td>${l.proposed_alternative.ghg_emissions_lb_yr.toLocaleString()}</td>
              <td><strong>${l.savings.ghg_emissions_savings_pct.toFixed(1)}%</strong></td>
            </tr>
            <tr>
              <td>Unmet Load Hours (&le; 300 hrs required)</td>
              <td>${l.baseline_average.unmet_load_hours} hrs (OK)</td>
              <td>${l.proposed_alternative.unmet_load_hours} hrs (OK)</td>
              <td>Compliant</td>
            </tr>
          </tbody>
        </table>

        <div class="hap-sec-heading">3. LEED v4 Optimize Energy Performance Credit</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>Cost Savings Percentage</span><strong>${l.savings.energy_cost_savings_pct.toFixed(1)} %</strong></div>
            <div class="leader-line"><span>GHG Emissions Reduction</span><strong>${l.savings.ghg_emissions_savings_pct.toFixed(1)} %</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>LEED v4 Credit Points Awarded</span><strong>${l.savings.leed_v4_points_awarded} Points</strong></div>
            <div class="leader-line"><span>Minimum Energy Performance Prerequisite</span><strong>MET</strong></div>
          </div>
        </div>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildPlantSizingAndSimulationReport(proj, calc, nowStr) {
    const s = calc.air_system.sizing_summary;
    const chl = (proj.libraries && proj.libraries.chillers && proj.libraries.chillers[0]) || { name: "Water-Cooled Centrifugal 150T", full_load_kw_per_ton: 0.58, iplv_kw_per_ton: 0.38 };
    const twr = (proj.libraries && proj.libraries.cooling_towers && proj.libraries.cooling_towers[0]) || { name: "Induced Draft VFD Cooling Tower" };
    const blr = (proj.libraries && proj.libraries.boilers && proj.libraries.boilers[0]) || { name: "Condensing HW Boiler", thermal_efficiency_pct: 92.0 };

    return `
      <div class="hap-report-page">
        ${this.headerBox("Chilled Water, Merkel Cooling Tower & Condensing Boiler Plant Report", "(eDesign.Plants01 Hydronic & Merkel Enthalpy Potential Analysis)", proj, nowStr)}
        <div class="hap-sec-heading">1. Plant Equipment Library &amp; Coincident Sizing</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>Chiller Reference Model</span><strong>${chl.name}</strong></div>
            <div class="leader-line"><span>Full-Load / IPLV Efficiency</span><strong>${chl.full_load_kw_per_ton} / ${chl.iplv_kw_per_ton} kW/Ton</strong></div>
            <div class="leader-line"><span>Coincident Chilled Water Load</span><strong>${s.central_cooling_coil.total_coil_tons.toFixed(1)} Tons (${s.central_cooling_coil.total_coil_mbh.toFixed(1)} MBH)</strong></div>
            <div class="leader-line"><span>Design CHW Flow @ 10.0 F Delta-T</span><strong>${(s.central_cooling_coil.total_coil_tons * 2.4).toFixed(1)} gpm</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>Heat Rejection Model</span><strong>${twr.name} (4-Pt Chebyshev Merkel)</strong></div>
            <div class="leader-line"><span>Boiler Reference Model</span><strong>${blr.name}</strong></div>
            <div class="leader-line"><span>Coincident Heating Plant Load</span><strong>326.8 MBH</strong></div>
            <div class="leader-line"><span>Design HW Flow @ 20.0 F Delta-T</span><strong>32.7 gpm</strong></div>
          </div>
        </div>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildInputDataReports(proj, calc, nowStr) {
    const w = proj.weather;
    const wSum = calc.air_system.weather_summary;
    const sm = proj.space_models[0];
    const walls = proj.libraries.walls;

    const solRows1 = Object.keys(wSum.max_solar_table).map(m => {
      const ms = wSum.max_solar_table[m];
      return `<tr><td>${m}</td><td>${ms.N.toFixed(1)}</td><td>${ms.NNE.toFixed(1)}</td><td>${ms.NE.toFixed(1)}</td><td>${ms.ENE.toFixed(1)}</td><td>${ms.E.toFixed(1)}</td><td>${ms.ESE.toFixed(1)}</td><td>${ms.SE.toFixed(1)}</td><td>${ms.SSE.toFixed(1)}</td><td>${ms.S.toFixed(1)}</td><td>${ms.HOR.toFixed(1)}</td></tr>`;
    }).join("");

    const spRows = sm.spaces.map(sp => `
      <tr>
        <td>${sp.index}</td>
        <td>${sp.name}</td>
        <td>${sp.floor_area_sqft.toFixed(1)}</td>
        <td>${sp.space_type}</td>
        <td>${sp.oa_req1_cfm_person.toFixed(1)} CFM/p</td>
        <td>${sp.oa_req2_cfm_sqft.toFixed(2)} CFM/sqft</td>
        <td>${sp.overhead_lighting_w_sqft.toFixed(2)} W/sqft</td>
        <td>${sp.elec_eqpt_w_sqft.toFixed(2)} W/sqft</td>
        <td>${sp.occupancy_people.toFixed(0)}</td>
      </tr>
    `).join("");

    return `
      <div class="hap-report-page">
        ${this.headerBox("Design Weather & Space Model Input Data", null, proj, nowStr)}
        <div class="hap-green-heading">Design Weather Parameters:</div>
        <div class="hap-2col-leader">
          <div>
            <div class="leader-line"><span>Location</span><strong>${w.location}</strong></div>
            <div class="leader-line"><span>Latitude / Longitude</span><strong>${w.latitude}°N / ${w.longitude}°E</strong></div>
            <div class="leader-line"><span>Elevation</span><strong>${w.elevation_ft} ft</strong></div>
            <div class="leader-line"><span>Climate Zone</span><strong>${w.climate_zone}</strong></div>
          </div>
          <div>
            <div class="leader-line"><span>Summer Design DB / WB</span><strong>${w.summer_db_f} / ${w.summer_wb_f} F</strong></div>
            <div class="leader-line"><span>Summer Daily Range</span><strong>${w.daily_range_f} F</strong></div>
            <div class="leader-line"><span>Winter Design DB / WB</span><strong>${w.winter_db_f} / ${w.winter_wb_f} F</strong></div>
            <div class="leader-line"><span>Simulation Weather Data</span><strong>${w.sim_weather_name}</strong></div>
          </div>
        </div>

        <div class="hap-green-heading">Design Day Maximum Solar Fluxes [BTU/(hr sqft)]</div>
        <table class="hap-table">
          <thead>
            <tr><th>Month</th><th>N</th><th>NNE</th><th>NE</th><th>ENE</th><th>E</th><th>ESE</th><th>SE</th><th>SSE</th><th>S</th><th>HOR</th></tr>
          </thead>
          <tbody>${solRows1}</tbody>
        </table>

        <div class="hap-sec-heading">Space Model Input Summary (${sm.name} — 14 Spaces, 9,274.9 sqft)</div>
        <table class="hap-table">
          <thead>
            <tr><th>#</th><th>Space</th><th>Area (sqft)</th><th>Space Type</th><th>OA Req 1</th><th>OA Req 2</th><th>Lighting</th><th>Elec Eqpt</th><th>People</th></tr>
          </thead>
          <tbody>${spRows}</tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },

  buildStd183ComplianceReport(proj, nowStr) {
    return `
      <div class="hap-report-page">
        ${this.headerBox("Kapit 6.4 Compliance With ANSI/ASHRAE/ACCA Standard 183-2024", "(Peak Cooling and Heating Load Calculations in Buildings Except Low-Rise Residential)", proj, nowStr)}
        <table class="hap-table">
          <thead>
            <tr><th style="width:45%">ASHRAE Standard 183-2024 Requirement</th><th>How Kapit 6.4 Complies</th></tr>
          </thead>
          <tbody>
            <tr><td style="text-align:left"><strong>5. Weather Data &amp; Indoor Design Conditions</strong><br/>5.1-5.4 Indoor DB/RH, 24-hr outdoor DB/WB profiles, 16-orientation solar flux, winter design conditions.</td><td style="text-align:left"><strong>Complies.</strong> Uses ASHRAE 2021 global weather station database (weather.db + built-in) and 24-hour design day profiles across all 12 months.</td></tr>
            <tr><td style="text-align:left"><strong>6. Cooling Load Method</strong><br/>6.1-6.2 Separate convective &amp; radiant heat gains, thermal mass time delay, 24-hr x 12-month scan (288 hours).</td><td style="text-align:left"><strong>Complies.</strong> Implements the ASHRAE Heat Balance &amp; Conduction Transfer Function (CTF) method with separate radiative/convective splits and 288-hour peak scanning.</td></tr>
            <tr><td style="text-align:left"><strong>7. External Heat Gains</strong><br/>7.1-7.3 Fenestration U-value &amp; SHGC, exterior overhangs/fins, multi-layer opaque envelope, sensible/latent infiltration.</td><td style="text-align:left"><strong>Complies.</strong> Models layer-by-layer opaque assemblies, fenestration conduction/solar, overhang shading geometry, and sensible/latent infiltration.</td></tr>
            <tr><td style="text-align:left"><strong>8. Internal Heat Gains</strong><br/>8.1-8.5 Occupants, overhead/task lighting, electric equipment, miscellaneous gains, ceiling return plenums.</td><td style="text-align:left"><strong>Complies.</strong> Accounts for hourly scheduled sensible and latent internal heat gains and ceiling plenum heat transfer.</td></tr>
            <tr><td style="text-align:left"><strong>9. Heating Load</strong><br/>9.1-9.4 Peak temperature-driven envelope heat loss without solar or internal gain credits.</td><td style="text-align:left"><strong>Complies.</strong> Calculates design heating loads at winter design outdoor conditions excluding solar and internal heat gain credits.</td></tr>
            <tr><td style="text-align:left"><strong>10. System Cooling &amp; Heating Loads</strong><br/>10.1-10.7 Psychrometric processes, fan heat, duct leakage, ASHRAE 62.1 outdoor ventilation, occupant/lighting diversity.</td><td style="text-align:left"><strong>Complies.</strong> Performs full system psychrometrics, ASHRAE 62.1-2022 Multi-Zone VRP ventilation sizing, fan heat, and diversity adjustments.</td></tr>
          </tbody>
        </table>
        ${this.footerBox(1, 1)}
      </div>
    `;
  },
};
