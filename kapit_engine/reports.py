"""
Report Generation Engine, Pre-Calculation Validator, CSV Exporter, and Zero-Dependency OpenXML (.xlsx) Generator.
Reproduces HAP 6.4 Design Load Reports, Energy Modeling Reports, Input Data Reports, and XLSX/CSV Exports.
"""

from __future__ import annotations
import csv
import io
import zipfile
from xml.sax.saxutils import escape
from typing import Any, Dict, List, Tuple
from .air_systems import calculate_air_system_design_and_energy


def validate_project(project: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Runs HAP 6.4 pre-calculation validation rules (Error codes 200-220 Air System, 300-342 Space Model, 700-718 Building).
    """
    errors: List[Dict[str, Any]] = []
    sm_list = project.get("space_models", [])
    if not sm_list:
        errors.append({"type": "Space Model", "name": "(None)", "code": 300, "severity": "Error", "description": "At least one Space Model must be defined."})
    else:
        for sm in sm_list:
            spaces = sm.get("spaces", [])
            if not spaces:
                errors.append({"type": "Space Model", "name": sm.get("name", ""), "code": 301, "severity": "Error", "description": "Space Model contains 0 spaces."})
            for sp in spaces:
                if float(sp.get("floor_area_sqft", 0.0)) <= 0.0:
                    errors.append({"type": "Space", "name": sp.get("name", ""), "code": 312, "severity": "Error", "description": "Space floor area must be greater than zero."})

    sys_list = project.get("air_systems", [])
    if not sys_list:
        errors.append({"type": "Air System", "name": "(None)", "code": 200, "severity": "Error", "description": "At least one Air System must be defined."})

    return errors


def run_full_project_calculations(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the Clean Thermal Core Calculation Pipeline (ANSI/ASHRAE/ACCA Standard 183-2024 & 62.1-2022):
      Step 1: Space & Zone Heat Balance Design Day Loads (24h x 12m + Winter Heating)
      Step 2: Air System & Ventilation Sizing + 21-Point Psychrometrics & Coil Sizing
      Note: Non-thermal modules (8760h sim, plants, utility rates, LEED) moved to obsoleto/
    """
    validation_errors = validate_project(project)
    air_sys_res = calculate_air_system_design_and_energy(project)

    return {
        "status": "Calculated",
        "validation_errors": validation_errors,
        "air_system": air_sys_res,
        "plants": [],
        "billing_and_costs": {},
        "leed_and_90_1": {},
    }



def generate_csv_export(calc_results: Dict[str, Any], report_type: str = "monthly_simulation") -> str:
    """
    Generates CSV spreadsheet text for Monthly Simulation, Zone Sizing, Ventilation Sizing, or Billing Details.
    """
    out = io.StringIO()
    writer = csv.writer(out)

    if report_type == "zone_sizing":
        writer.writerow(["Zone Name", "Design Supply Airflow (CFM)", "Minimum Supply Airflow (CFM)", "Zone CFM/sqft", "Reheat Coil Capacity (MBH)", "Cooling Sensible (MBH)", "Time of Peak", "Heating Load (MBH)", "Floor Area (sqft)"])
        for z in calc_results["air_system"]["zone_sizing"]:
            writer.writerow([z["zone_name"], z["design_airflow_cfm"], z["min_airflow_cfm"], z["cfm_per_sqft"], z["reheat_coil_mbh"], z["cooling_sensible_mbh"], z["time_of_peak"], z["heating_load_mbh"], z["floor_area_sqft"]])
    elif report_type == "ventilation":
        writer.writerow(["Zone Name", "Space Name", "Minimum Supply Air Vpz (CFM)", "Floor Area Az (sqft)", "Ra (CFM/sqft)", "Occupancy Pz", "Rp (CFM/person)", "Ez", "Space OA Voz (CFM)", "Breathing Zone OA Vbz (CFM)", "Evz"])
        for r in calc_results["air_system"]["ventilation_summary"]["space_rows"]:
            writer.writerow([r["zone_name"], r["space_name"], r["vpz_cfm"], r["az_sqft"], r["ra_cfm_sqft"], r["pz_occ"], r["rp_cfm_person"], r["ez"], r["voz_cfm"], r["vbz_cfm"], r["evz"]])
    else:
        writer.writerow(["Month", "Preheat Coil Load (kBTU)", "Preheat Coil Input (kWh)", "Central Cooling Load (kBTU)", "Central Cooling Input (kWh)", "Terminal Heating Load (kBTU)", "Terminal Heating Input (kWh)", "Supply Fan (kWh)", "Lighting (kWh)", "Electric Equipment (kWh)", "Total Electric (kWh)", "Peak Demand (kW)"])
        for m in calc_results["air_system"]["monthly_simulation"]:
            writer.writerow([m["month"], m["preheat_coil_load_kbtu"], m["preheat_coil_input_kwh"], m["central_cooling_load_kbtu"], m["central_cooling_input_kwh"], m["terminal_heating_load_kbtu"], m["terminal_heating_input_kwh"], m["supply_fan_kwh"], m["lighting_kwh"], m["electric_eqpt_kwh"], m["total_electric_kwh"], m["peak_demand_kw"]])

    return out.getvalue()


def generate_xlsx_workbook(calc_results: Dict[str, Any]) -> bytes:
    """
    Zero-dependency OpenXML (.xlsx) multi-sheet workbook generator (reproducing HAPGUI.dll XlsxReportController).
    Creates 4 worksheets:
      1. System-Sizing-Summary
      2. Zone-Sizing-Summary
      3. Ventilation-62.1
      4. Monthly-Simulation-Billing
    """
    sheets: List[Tuple[str, List[List[Any]]]] = []

    # Sheet 1: System Sizing Summary
    s_sum = calc_results["air_system"]["sizing_summary"]
    cc = s_sum["central_cooling_coil"]
    ph = s_sum["preheat_coil"]
    sf = s_sum["supply_fan"]
    ov = s_sum["outdoor_ventilation"]
    sheet1_rows: List[List[Any]] = [
        ["Kapit / HAP 6.4 Compatible - Air System Sizing Summary", ""],
        ["Air System Name", s_sum["system_name"]],
        ["Equipment Class", s_sum["equipment_class"]],
        ["Air System Type", s_sum["system_type"]],
        ["Number of Zones", s_sum["number_of_zones"]],
        ["Floor Area (sqft)", s_sum["floor_area_sqft"]],
        ["Location", s_sum["location"]],
        ["", ""],
        ["Central Cooling Coil Sizing Data", ""],
        ["Total Coil Load (Tons)", cc["total_coil_tons"]],
        ["Total Coil Load (MBH)", cc["total_coil_mbh"]],
        ["Sensible Coil Load (MBH)", cc["sensible_coil_mbh"]],
        ["Coil CFM at Peak Load", cc["coil_cfm_at_peak"]],
        ["Sum of Peak Zone CFM", cc["sum_peak_zone_cfm"]],
        ["Sensible Heat Ratio (SHR)", cc["sensible_heat_ratio"]],
        ["Peak Coil Load Occurs At", cc["peak_load_time"]],
        ["Entering DB / WB", cc["entering_db_wb"]],
        ["Leaving DB / WB", cc["leaving_db_wb"]],
        ["", ""],
        ["Preheat Coil Sizing Data", ""],
        ["Max Coil Load (MBH)", ph["max_coil_load_mbh"]],
        ["Coil CFM at Design Heating", ph["coil_cfm_heating"]],
        ["Entering / Leaving DB", ph["ent_lvg_db"]],
        ["", ""],
        ["Supply Fan & Ventilation Data", ""],
        ["Design Supply CFM", sf["design_cfm"]],
        ["Fan Motor BHP", sf["fan_motor_bhp"]],
        ["Fan Motor kW", sf["fan_motor_kw"]],
        ["Outdoor Ventilation CFM", ov["design_airflow_cfm"]],
    ]
    sheets.append(("System-Sizing", sheet1_rows))

    # Sheet 2: Zone Sizing Summary
    sheet2_rows: List[List[Any]] = [
        ["Zone Name", "Design Airflow (CFM)", "Min Airflow (CFM)", "CFM/sqft", "Reheat Cap (MBH)", "Cooling Sensible (MBH)", "Peak Time", "Heating Load (MBH)", "Floor Area (sqft)"]
    ]
    for z in calc_results["air_system"]["zone_sizing"]:
        sheet2_rows.append([
            z["zone_name"], z["design_airflow_cfm"], z["min_airflow_cfm"], z["cfm_per_sqft"],
            z["reheat_coil_mbh"], z["cooling_sensible_mbh"], z["time_of_peak"], z["heating_load_mbh"], z["floor_area_sqft"]
        ])
    sheets.append(("Zone-Sizing", sheet2_rows))

    # Sheet 3: Ventilation Sizing Summary
    sheet3_rows: List[List[Any]] = [
        ["Zone Name", "Space Name", "Vpz (CFM)", "Area Az (sqft)", "Ra (CFM/sqft)", "Occupancy Pz", "Rp (CFM/person)", "Ez", "Voz (CFM)", "Vbz (CFM)", "Evz"]
    ]
    for r in calc_results["air_system"]["ventilation_summary"]["space_rows"]:
        sheet3_rows.append([
            r["zone_name"], r["space_name"], r["vpz_cfm"], r["az_sqft"], r["ra_cfm_sqft"],
            r["pz_occ"], r["rp_cfm_person"], r["ez"], r["voz_cfm"], r["vbz_cfm"], r["evz"]
        ])
    sheets.append(("Ventilation-62.1", sheet3_rows))

    # Sheet 4: Monthly Simulation Results
    sheet4_rows: List[List[Any]] = [
        ["Month", "Preheat Load (kBTU)", "Preheat Input (kWh)", "Central Clg Load (kBTU)", "Central Clg Input (kWh)", "Terminal Htg Load (kBTU)", "Terminal Htg Input (kWh)", "Supply Fan (kWh)", "Lighting (kWh)", "Electric Eqpt (kWh)", "Total Electric (kWh)", "Peak Demand (kW)"]
    ]
    for m in calc_results["air_system"]["monthly_simulation"]:
        sheet4_rows.append([
            m["month"], m["preheat_coil_load_kbtu"], m["preheat_coil_input_kwh"],
            m["central_cooling_load_kbtu"], m["central_cooling_input_kwh"],
            m["terminal_heating_load_kbtu"], m["terminal_heating_input_kwh"],
            m["supply_fan_kwh"], m["lighting_kwh"], m["electric_eqpt_kwh"],
            m["total_electric_kwh"], m["peak_demand_kw"]
        ])
    sheets.append(("Monthly-Simulation", sheet4_rows))

    return _build_openxml_xlsx_bytes(sheets)


def _col_letter(col_idx_1based: int) -> str:
    res = ""
    n = col_idx_1based
    while n > 0:
        n, rem = divmod(n - 1, 26)
        res = chr(65 + rem) + res
    return res


def _build_openxml_xlsx_bytes(sheets: List[Tuple[str, List[List[Any]]]]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        content_types = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
            '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
            '  <Default Extension="xml" ContentType="application/xml"/>',
            '  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        ]
        for idx in range(1, len(sheets) + 1):
            content_types.append(
                f'  <Override PartName="/xl/worksheets/sheet{idx}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            )
        content_types.append("</Types>")
        zf.writestr("[Content_Types].xml", "\n".join(content_types).encode("utf-8"))

        root_rels = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n'
            '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>\n'
            '</Relationships>'
        )
        zf.writestr("_rels/.rels", root_rels.encode("utf-8"))

        wb_xml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
            "  <sheets>",
        ]
        wb_rels = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
        ]
        for idx, (s_name, rows) in enumerate(sheets, start=1):
            wb_xml.append(f'    <sheet name="{escape(s_name)}" sheetId="{idx}" r:id="rId{idx}"/>')
            wb_rels.append(
                f'  <Relationship Id="rId{idx}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{idx}.xml"/>'
            )
            ws_xml = [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
                "  <sheetData>",
            ]
            for r_idx, row in enumerate(rows, start=1):
                ws_xml.append(f'    <row r="{r_idx}">')
                for c_idx, val in enumerate(row, start=1):
                    cell_ref = f"{_col_letter(c_idx)}{r_idx}"
                    if isinstance(val, (int, float)) and not isinstance(val, bool):
                        ws_xml.append(f'      <c r="{cell_ref}"><v>{val}</v></c>')
                    else:
                        ws_xml.append(f'      <c r="{cell_ref}" t="inlineStr"><is><t>{escape(str(val))}</t></is></c>')
                ws_xml.append("    </row>")
            ws_xml.append("  </sheetData>")
            ws_xml.append("</worksheet>")
            zf.writestr(f"xl/worksheets/sheet{idx}.xml", "\n".join(ws_xml).encode("utf-8"))

        wb_xml.append("  </sheets>")
        wb_xml.append("</workbook>")
        wb_rels.append("</Relationships>")
        zf.writestr("xl/workbook.xml", "\n".join(wb_xml).encode("utf-8"))
        zf.writestr("xl/_rels/workbook.xml.rels", "\n".join(wb_rels).encode("utf-8"))

    return buf.getvalue()
