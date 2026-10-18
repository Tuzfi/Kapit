"""
Kapit Zero-Dependency HTTP/REST API Server & Static UI Host.
Provides all endpoints for Project Management, HVAC Load & Sizing Calculations,
8,760-Hour Energy Simulation, Weather Station Search (weather.db + built-in),
Wizards, Native .hap Import/Export, gbXML Import/Export, and XLSX/CSV Report Exports.
"""

from __future__ import annotations
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import mimetypes
import os
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

from kapit_engine.hap_io import (
    export_gbxml,
    export_hap64_archive,
    import_gbxml,
    import_hap64_archive,
)
from kapit_engine.heat_balance import calculate_assembly_properties
from kapit_engine.models import create_hap64_example_project
from kapit_engine.psychrometrics import PsychState
from kapit_engine.reference_data import (
    ACTIVITY_LEVELS,
    AIR_SYSTEM_TYPES,
    ASHRAE_62_1_2022_USAGES,
    ASHRAE_90_1_2022_LPD,
    EPA_EGRID_SUBREGIONS,
    MATERIAL_LAYERS,
    PLANT_TYPES,
    UTILITY_TARIFF_TEMPLATES,
)
from kapit_engine.reports import (
    generate_csv_export,
    generate_xlsx_workbook,
    run_full_project_calculations,
)
from kapit_engine.units import convert_value, evaluate_inline_expression
from kapit_engine.weather import (
    generate_design_weather_summary,
    query_installed_weather_db,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UI_DIR = os.path.join(BASE_DIR, "kapit_ui")

# Global active project state (initialized with Carrier HAP 6.4 Example Problem)
ACTIVE_PROJECT: Dict[str, Any] = create_hap64_example_project()


def get_reference_catalogs() -> Dict[str, Any]:
    return {
        "activity_levels": ACTIVITY_LEVELS,
        "ashrae_62_1_usages": ASHRAE_62_1_2022_USAGES,
        "ashrae_90_1_lpd": ASHRAE_90_1_2022_LPD,
        "material_layers": MATERIAL_LAYERS,
        "air_system_types": AIR_SYSTEM_TYPES,
        "plant_types": PLANT_TYPES,
        "utility_tariff_templates": UTILITY_TARIFF_TEMPLATES,
        "epa_egrid_subregions": EPA_EGRID_SUBREGIONS,
    }


def generate_building_wizard_model(params: Dict[str, Any], project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reproduces HAP 6.4 Building Wizard (WizardsB.dll FloorPlanGenerator):
    Generates Building Levels, Spaces, Zones, and Space Model from footprint shape
    (Rectangular, Courtyard, L-Shape, U-Shape, T-Shape, H-Shape), dimensions, levels,
    zoning method (Perimeter & Core, By Exposure, One Zone per Floor), and WWR %.
    """
    bldg_name = str(params.get("name", "Wizard Building"))
    shape = str(params.get("shape", "Rectangular"))
    length_ft = max(20.0, float(params.get("length_ft", 120.0)))
    width_ft = max(20.0, float(params.get("width_ft", 80.0)))
    num_levels = max(1, int(params.get("levels", 1)))
    flr_to_flr_ft = max(8.0, float(params.get("level_height_ft", 12.0)))
    flr_to_ceil_ft = max(7.0, float(params.get("ceiling_height_ft", 9.0)))
    perim_depth_ft = max(10.0, min(width_ft * 0.35, float(params.get("perimeter_depth_ft", 15.0))))
    wwr_pct = max(0.0, min(90.0, float(params.get("wwr_pct", 25.0))))
    bldg_usage = str(params.get("building_type", "School / Classroom"))

    shape_factor = {
        "Rectangular": 1.0,
        "Courtyard": 0.85,
        "L-Shape": 0.75,
        "U-Shape": 0.80,
        "T-Shape": 0.75,
        "H-Shape": 0.82,
    }.get(shape, 1.0)

    level_area = round(length_ft * width_ft * shape_factor, 1)
    core_area = max(100.0, round((length_ft - 2 * perim_depth_ft) * (width_ft - 2 * perim_depth_ft) * shape_factor, 1))
    perim_total = max(100.0, level_area - core_area)

    is_office = "office" in bldg_usage.lower()
    lpd = 0.66 if is_office else 0.72
    epd = 0.75 if is_office else 0.90
    oa_p = 5.0 if is_office else 10.0
    oa_a = 0.06 if is_office else 0.12
    occ_dens = 5.0 if is_office else 25.0  # people per 1000 sqft
    lgt_sched = "1892741299" if is_office else "211440243"
    occ_sched = "624527384" if is_office else "956582207"

    new_spaces = []
    idx = 1
    for lvl in range(1, num_levels + 1):
        lvl_name = f"Level {lvl}"
        orientations = [
            ("North Perimeter", "N", length_ft),
            ("East Perimeter", "E", width_ft),
            ("South Perimeter", "S", length_ft),
            ("West Perimeter", "W", width_ft),
        ]
        for label, exp, wall_len in orientations:
            sp_area = round(perim_total * (wall_len / (2 * (length_ft + width_ft))), 1)
            ext_wall = round(wall_len * flr_to_flr_ft, 1)
            win_qty = max(1, int(round((ext_wall * (wwr_pct / 100.0)) / 21.0)))
            ppl = max(1.0, round(sp_area * occ_dens / 1000.0, 1))
            poly = []
            walls_list = []
            if exp == "N":
                poly = [[0.0, width_ft - perim_depth_ft], [length_ft, width_ft - perim_depth_ft], [length_ft, width_ft], [0.0, width_ft]]
                walls_list = [{"id": f"W_{idx}_1", "orientation": "N", "length_ft": length_ft, "gross_area_sqft": ext_wall, "windows": [{"window_id": "WIN_1", "qty": win_qty}], "doors": []}]
            elif exp == "E":
                poly = [[length_ft - perim_depth_ft, perim_depth_ft], [length_ft, perim_depth_ft], [length_ft, width_ft - perim_depth_ft], [length_ft - perim_depth_ft, width_ft - perim_depth_ft]]
                walls_list = [{"id": f"W_{idx}_1", "orientation": "E", "length_ft": width_ft, "gross_area_sqft": ext_wall, "windows": [{"window_id": "WIN_1", "qty": win_qty}], "doors": []}]
            elif exp == "S":
                poly = [[0.0, 0.0], [length_ft, 0.0], [length_ft, perim_depth_ft], [0.0, perim_depth_ft]]
                walls_list = [{"id": f"W_{idx}_1", "orientation": "S", "length_ft": length_ft, "gross_area_sqft": ext_wall, "windows": [{"window_id": "WIN_1", "qty": win_qty}], "doors": [{"door_id": "DOOR_1", "qty": 1}] if lvl == 1 else []}]
            elif exp == "W":
                poly = [[0.0, perim_depth_ft], [perim_depth_ft, perim_depth_ft], [perim_depth_ft, width_ft - perim_depth_ft], [0.0, width_ft - perim_depth_ft]]
                walls_list = [{"id": f"W_{idx}_1", "orientation": "W", "length_ft": width_ft, "gross_area_sqft": ext_wall, "windows": [{"window_id": "WIN_1", "qty": win_qty}], "doors": []}]

            new_spaces.append({
                "id": f"S_WIZ_{idx}",
                "index": idx,
                "name": f"L{lvl} - {label}",
                "level": lvl_name,
                "geometry": {"level": lvl_name, "polygon": poly},
                "walls": walls_list,
                "roof_sqft": sp_area if lvl == num_levels else 0.0,
                "floor_type": "Slab on grade" if lvl == 1 else "Above conditioned space",
                "zone_id": f"Z_WIZ_{idx}",
                "zone_name": f"L{lvl} - {label}",
                "floor_area_sqft": sp_area,
                "volume_cuft": round(sp_area * flr_to_ceil_ft, 1),
                "ceiling_height_ft": flr_to_ceil_ft,
                "interior_wall_sqft": round(wall_len * flr_to_ceil_ft, 1),
                "exterior_wall_sqft": ext_wall,
                "exposure": exp,
                "window_qty": win_qty,
                "door_qty": 1 if (lvl == 1 and exp == "S") else 0,
                "space_type": "Office - Open Plan" if is_office else "Classroom - Ages 9+",
                "ashrae_62_usage": "OFFICE: Office space" if is_office else "EDUCATION: Classroom (age 9 plus)",
                "oa_req1_cfm_person": oa_p,
                "oa_req2_cfm_sqft": oa_a,
                "direct_exhaust_cfm": 0.0,
                "lighting_usage": "Office" if is_office else "Classroom",
                "overhead_lighting_w_sqft": lpd,
                "lighting_type": "Fluorescent: Recessed, no Lens, Unvented",
                "lighting_schedule_id": lgt_sched,
                "lighting_schedule_name": "90.1 Office Lights/Elec" if is_office else "90.1 School Lights/Elec",
                "task_lighting_w_sqft": 0.0,
                "elec_eqpt_w_sqft": epd,
                "elec_schedule_id": lgt_sched,
                "elec_schedule_name": "90.1 Office Lights/Elec" if is_office else "90.1 School Lights/Elec",
                "occupancy_people": ppl,
                "occupancy_schedule_id": occ_sched,
                "occupancy_schedule_name": "90.1 Office Occupancy" if is_office else "90.1 School Occupancy",
                "activity_level": "Office Work",
                "sensible_btuh_person": 245.0,
                "latent_btuh_person": 205.0,
                "infiltration_clg_ach": 0.25,
                "infiltration_htg_ach": 0.25,
                "infiltration_sim_ach": 0.25,
                "infiltration_occurs": "Unoccupied",
            })
            idx += 1

        # Core zone
        ppl_core = max(1.0, round(core_area * occ_dens / 1000.0, 1))
        core_poly = [
            [perim_depth_ft, perim_depth_ft],
            [length_ft - perim_depth_ft, perim_depth_ft],
            [length_ft - perim_depth_ft, width_ft - perim_depth_ft],
            [perim_depth_ft, width_ft - perim_depth_ft],
        ]
        new_spaces.append({
            "id": f"S_WIZ_{idx}",
            "index": idx,
            "name": f"L{lvl} - Core Zone",
            "level": lvl_name,
            "geometry": {"level": lvl_name, "polygon": core_poly},
            "walls": [],
            "roof_sqft": core_area if lvl == num_levels else 0.0,
            "floor_type": "Slab on grade" if lvl == 1 else "Above conditioned space",
            "zone_id": f"Z_WIZ_{idx}",
            "zone_name": f"L{lvl} - Core Zone",
            "floor_area_sqft": core_area,
            "volume_cuft": round(core_area * flr_to_ceil_ft, 1),
            "ceiling_height_ft": flr_to_ceil_ft,
            "interior_wall_sqft": round(2 * (length_ft + width_ft - 4 * perim_depth_ft) * flr_to_ceil_ft, 1),
            "exterior_wall_sqft": 0.0,
            "exposure": "N",
            "window_qty": 0,
            "door_qty": 0,
            "space_type": "Office - Open Plan" if is_office else "Classroom - Ages 9+",
            "ashrae_62_usage": "OFFICE: Office space" if is_office else "EDUCATION: Classroom (age 9 plus)",
            "oa_req1_cfm_person": oa_p,
            "oa_req2_cfm_sqft": oa_a,
            "direct_exhaust_cfm": 0.0,
            "lighting_usage": "Office" if is_office else "Classroom",
            "overhead_lighting_w_sqft": lpd,
            "lighting_type": "Fluorescent: Recessed, no Lens, Unvented",
            "lighting_schedule_id": lgt_sched,
            "lighting_schedule_name": "90.1 Office Lights/Elec" if is_office else "90.1 School Lights/Elec",
            "task_lighting_w_sqft": 0.0,
            "elec_eqpt_w_sqft": epd,
            "elec_schedule_id": lgt_sched,
            "elec_schedule_name": "90.1 Office Lights/Elec" if is_office else "90.1 School Lights/Elec",
            "occupancy_people": ppl_core,
            "occupancy_schedule_id": occ_sched,
            "occupancy_schedule_name": "90.1 Office Occupancy" if is_office else "90.1 School Occupancy",
            "activity_level": "Office Work",
            "sensible_btuh_person": 245.0,
            "latent_btuh_person": 205.0,
            "infiltration_clg_ach": 0.0,
            "infiltration_htg_ach": 0.0,
            "infiltration_sim_ach": 0.0,
            "infiltration_occurs": "Unoccupied",
        })
        idx += 1

    bldg_levels = []
    for l_num in range(1, num_levels + 1):
        bldg_levels.append({
            "name": f"Level {l_num}",
            "elevation_ft": round((l_num - 1) * flr_to_flr_ft, 1),
            "floor_to_floor_ft": flr_to_flr_ft,
            "floor_to_ceiling_ft": flr_to_ceil_ft,
        })

    project["buildings"][0]["name"] = bldg_name
    project["buildings"][0]["footprint_shape"] = shape
    project["buildings"][0]["levels"] = bldg_levels
    project["buildings"][0]["number_of_stories"] = num_levels
    project["buildings"][0]["gross_floor_area_sqft"] = round(level_area * num_levels, 1)
    project["space_models"][0]["name"] = bldg_name
    project["space_models"][0]["building_name"] = bldg_name
    project["space_models"][0]["spaces"] = new_spaces
    project["air_systems"][0]["number_of_zones"] = len(new_spaces)
    return project


class KapitRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        pass  # Keep console clean

    def _send_json(self, data: Any, status: int = 200) -> None:
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(raw)

    def _send_bytes(self, raw: bytes, content_type: str, filename: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_body_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        global ACTIVE_PROJECT
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/project":
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({
                "project": ACTIVE_PROJECT,
                "calculations": calc,
                "catalogs": get_reference_catalogs(),
            })
            return

        if path == "/api/weather/stations":
            q = qs.get("q", [""])[0]
            stations = query_installed_weather_db(q, limit=60)
            self._send_json({"stations": stations})
            return

        if path == "/api/export/hap":
            raw_hap = export_hap64_archive(ACTIVE_PROJECT)
            fname = f"{ACTIVE_PROJECT.get('project_info', {}).get('name', 'KapitProject')}.hap"
            self._send_bytes(raw_hap, "application/octet-stream", fname)
            return

        if path == "/api/export/gbxml":
            xml_str = export_gbxml(ACTIVE_PROJECT)
            fname = f"{ACTIVE_PROJECT.get('project_info', {}).get('name', 'KapitProject')}.xml"
            self._send_bytes(xml_str.encode("utf-8"), "application/xml; charset=utf-8", fname)
            return

        if path == "/api/export/xlsx":
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            raw_xlsx = generate_xlsx_workbook(calc)
            fname = f"{ACTIVE_PROJECT.get('project_info', {}).get('name', 'KapitProject')}_Reports.xlsx"
            self._send_bytes(
                raw_xlsx,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fname,
            )
            return

        if path == "/api/export/csv":
            rpt_type = qs.get("type", ["monthly_simulation"])[0]
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            csv_str = generate_csv_export(calc, rpt_type)
            fname = f"{ACTIVE_PROJECT.get('project_info', {}).get('name', 'KapitProject')}_{rpt_type}.csv"
            self._send_bytes(csv_str.encode("utf-8"), "text/csv; charset=utf-8", fname)
            return

        if path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        # Serve static UI files from kapit_ui/
        rel_path = "index.html" if path in ("/", "") else path.lstrip("/")
        file_path = os.path.normpath(os.path.join(UI_DIR, rel_path))
        if file_path.startswith(UI_DIR) and os.path.isfile(file_path):
            ctype, _ = mimetypes.guess_type(file_path)
            with open(file_path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype or "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "Not Found")

    def do_POST(self) -> None:
        global ACTIVE_PROJECT
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_body_json()

        if path == "/api/project":
            if "project" in body and isinstance(body["project"], dict):
                ACTIVE_PROJECT = body["project"]
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/project/reset":
            ACTIVE_PROJECT = create_hap64_example_project()
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/calculate":
            proj = body.get("project", ACTIVE_PROJECT)
            if isinstance(proj, dict):
                ACTIVE_PROJECT = proj
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/weather/preview":
            w_cfg = body.get("weather", ACTIVE_PROJECT.get("weather", {}))
            summary = generate_design_weather_summary(w_cfg)
            self._send_json({"weather_summary": summary})
            return

        if path == "/api/psychrometrics/calc":
            mode = body.get("mode", "db_wb")
            cfm = float(body.get("cfm", 1000.0))
            db_f = float(body.get("db_f", 75.0))
            elev_ft = float(body.get("elevation_ft", 790.0))
            if mode == "db_rh":
                rh_pct = float(body.get("rh_pct", 50.0))
                st = PsychState.from_db_rh("Custom State", cfm, db_f, rh_pct, elev_ft)
            else:
                wb_f = float(body.get("wb_f", 62.5))
                st = PsychState.from_db_wb("Custom State", cfm, db_f, wb_f, elev_ft)
            self._send_json({"state": st.to_dict()})
            return

        if path == "/api/units/eval":
            expr = body.get("expression", "0")
            q_type = body.get("quantity_type", "")
            to_sys = body.get("to_system", "IP")
            val = evaluate_inline_expression(expr)
            conv_val, unit_lbl = convert_value(val, q_type, to_sys) if q_type else (val, "")
            self._send_json({"evaluated": val, "converted": conv_val, "unit": unit_lbl})
            return

        if path == "/api/assembly/calc":
            assly = body.get("assembly", {})
            props = calculate_assembly_properties(assly)
            self._send_json({"properties": props})
            return

        if path == "/api/wizards/building":
            ACTIVE_PROJECT = generate_building_wizard_model(body, ACTIVE_PROJECT)
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/wizards/baseline":
            # Duplicates current Alternative with [B000] prefix per ASHRAE 90.1 Appendix G rules
            alts = ACTIVE_PROJECT.get("alternatives", [])
            src_alt = alts[0] if alts else {"name": "ALT1 - VAV RTU", "space_model_ids": ["136003010"], "air_system_ids": ["1033919366"], "plant_ids": []}
            base_alt = dict(src_alt)
            base_alt["id"] = f"B000_{len(alts) + 1}"
            base_alt["name"] = f"[B000] {src_alt.get('name', 'Baseline')} (ASHRAE 90.1 App G)"
            base_alt["is_baseline"] = True
            base_alt["baseline_of_id"] = src_alt.get("id")
            if not any(a.get("is_baseline") for a in alts):
                alts.append(base_alt)
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/import/hap":
            if "file_path" in body and os.path.isfile(body["file_path"]):
                ACTIVE_PROJECT = import_hap64_archive(body["file_path"])
            elif "base64_data" in body:
                raw_bytes = base64.b64decode(body["base64_data"])
                ACTIVE_PROJECT = import_hap64_archive(raw_bytes)
            else:
                default_hap = r"C:\Users\Public\Documents\Carrier Hourly Analysis Program\HAP-6.4-Example-Problem.hap"
                if os.path.isfile(default_hap):
                    ACTIVE_PROJECT = import_hap64_archive(default_hap)
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        if path == "/api/import/gbxml":
            xml_text = body.get("xml_content", "")
            if xml_text:
                ACTIVE_PROJECT = import_gbxml(xml_text, ACTIVE_PROJECT)
            calc = run_full_project_calculations(ACTIVE_PROJECT)
            self._send_json({"project": ACTIVE_PROJECT, "calculations": calc})
            return

        self._send_json({"error": f"Unknown endpoint {path}"}, status=404)


def run_server(host: str = "127.0.0.1", port: int = 8760) -> None:
    server = ThreadingHTTPServer((host, port), KapitRequestHandler)
    print(f"Kapit HVAC Server running at http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    import sys
    port = 8760
    if len(sys.argv) > 1 and sys.argv[1] == "--port" and len(sys.argv) > 2:
        port = int(sys.argv[2])
    elif len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port=port)
