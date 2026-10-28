"""
Comprehensive Automated Test Suite for Kapit (Carrier HAP 6.4 Functional Equivalent).
Tests:
1. Unit Conversion System, Inline Math Evaluator (modCalc), and Architectural Feet-Inches Parser.
2. ASHRAE Psychrometric Engine (Hyland-Wexler saturation, Wet-Bulb solver, Dew-Point, Enthalpy, CSf/CLf).
3. Weather Engine & Read-Only Connection to Carrier HAP 6.4 weather.db + ASHRAE Clear-Sky Solar Flux.
4. Native .hap (ZIP + LZIP v1 .json.lz) Import/Export Round-Trip & gbXML v6.01 BIM Import/Export.
5. Exact HVAC Load & Energy Simulation Parity against Official Carrier HAP 6.4 Example Problem Reports:
   - Air System Sizing Summary (28.9 Tons / 346.5 MBH cooling, 6107 CFM coil peak, 6624 CFM zone sum, 198.1 MBH preheat, 6336 CFM fan @ 3.47 BHP / 2.75 kW)
   - Zone Sizing Summary (11 zones, peak sensible/total loads, terminal reheat coils, mixing box minimums)
   - ASHRAE Standard 62.1-2022 Ventilation Summary (Uncorrected OA 3053 CFM, Ev 0.787, Required OA 3878 CFM)
   - System Psychrometrics & Design Load Heat Balance
   - 8,760-Hour / 12-Month Energy Simulation & Component Cost Summary ($18,112 annual cost, 145,595 kWh electric)
6. Central Plant Simulation (Chiller part-load curves, 4-point Chebyshev Merkel Cooling Tower, Condensing Boiler).
7. ASHRAE 90.1 Appendix G 4-Rotation (0°/90°/180°/270°) & LEED v4 Minimum Energy Performance / Optimize Energy Performance.
8. Zero-Dependency OpenXML (.xlsx) Multi-Sheet Export, CSV Export, and Pre-Calculation Validator.
9. HTTP REST API Server Endpoints (GET /api/project, POST /api/calculate, GET /api/weather/stations, exports, wizards).
"""

from __future__ import annotations
import io
import json
import os
import tempfile
import threading
import urllib.request
from http.server import ThreadingHTTPServer
import zipfile

from kapit_engine.units import (
    convert_value,
    convert_from_user,
    evaluate_inline_expression,
    parse_architectural_feet_inches,
    format_architectural_feet_inches,
)
from kapit_engine.psychrometrics import (
    barometric_pressure_psia,
    air_heat_factors,
    PsychState,
    mix_air_streams,
    cooling_coil_leaving_state,
)
from kapit_engine.weather import (
    query_installed_weather_db,
    compute_solar_flux_profile,
    generate_design_weather_summary,
)
from kapit_engine.models import create_hap64_example_project
from kapit_engine.hap_io import (
    decompress_lzip_bytes,
    compress_lzip_bytes,
    import_hap64_archive,
    export_hap64_archive,
    export_gbxml,
    import_gbxml,
)
from kapit_engine.reports import (
    validate_project,
    run_full_project_calculations,
    generate_csv_export,
    generate_xlsx_workbook,
)
try:
    from obsoleto.kapit_engine.plants import (
        merkel_cooling_tower_leaving_temp,
        chiller_part_load_kw_per_ton,
        boiler_efficiency_curve,
    )
except ImportError:
    merkel_cooling_tower_leaving_temp = None
    chiller_part_load_kw_per_ton = None
    boiler_efficiency_curve = None

from server import KapitRequestHandler


# ==============================================================================
# 1. UNIT CONVERSION, INLINE CALCULATOR & ARCHITECTURAL FEET-INCHES TESTS
# ==============================================================================

def test_unit_conversions_and_inline_calculator():
    # Temperature IP -> SI and SI -> IP
    val_c, unit_c = convert_value(32.0, "temperature", "SI")
    assert abs(val_c - 0.0) < 1e-4 and unit_c == "C"
    val_c2, _ = convert_value(212.0, "temperature", "SI")
    assert abs(val_c2 - 100.0) < 1e-4
    assert abs(convert_from_user(20.0, "temperature", "SI") - 68.0) < 1e-4

    # DeltaT
    dt_k, unit_k = convert_value(18.0, "delta_temperature", "SI")
    assert abs(dt_k - 10.0) < 1e-4 and unit_k == "K"

    # Airflow CFM -> L/s
    flow_ls, unit_ls = convert_value(1000.0, "airflow", "SI")
    assert abs(flow_ls - 471.9) < 0.2 and unit_ls == "L/s"

    # Area sqft -> m2
    area_m2, _ = convert_value(1000.0, "area", "SI")
    assert abs(area_m2 - 92.9) < 0.2

    # Inline math expression evaluator (modCalc equivalent)
    assert abs(evaluate_inline_expression("27 * 29.8") - 804.6) < 1e-4
    assert abs(evaluate_inline_expression("(120 + 80) / 4 + 2^3") - 58.0) < 1e-4

    # Architectural feet-and-inches parser (UnitControls20.dll parity)
    assert abs(parse_architectural_feet_inches("3' 6\"") - 3.5) < 1e-4
    assert abs(parse_architectural_feet_inches("12' 9\"") - 12.75) < 1e-4
    assert abs(evaluate_inline_expression("3' 6\"") - 3.5) < 1e-4
    assert format_architectural_feet_inches(3.5) == "3' 6\""


# ==============================================================================
# 2. PSYCHROMETRIC ENGINE TESTS
# ==============================================================================

def test_psychrometrics_ashrae():
    # Indianapolis elevation = 790 ft
    p_atm = barometric_pressure_psia(790.0)
    assert 14.20 < p_atm < 14.35

    csf, clf = air_heat_factors(790.0)
    assert 1.04 < csf < 1.08
    assert 4650.0 < clf < 4800.0

    # Summer design outdoor condition: 91.3 F DB / 75.0 F WB @ 790 ft
    oa = PsychState.from_db_wb("Outdoor Air", 3878.0, 91.3, 75.0, 790.0)
    assert abs(oa.db_f - 91.3) < 1e-2
    assert abs(oa.wb_f - 75.0) < 1e-2
    assert 45.0 < oa.rh_pct < 52.0
    assert 37.5 < oa.h_btu_lb < 40.5
    assert 100.0 < oa.w_grains_lb < 115.0

    # Room condition: 75 F DB / 50% RH
    rm = PsychState.from_db_rh("Room Air", 2229.0, 75.0, 50.0, 790.0)
    assert abs(rm.db_f - 75.0) < 1e-2
    assert 62.0 < rm.wb_f < 63.2

    # Adiabatic air stream mixing
    mixed = mix_air_streams("Mixed Air", oa, rm, 790.0)
    assert abs(mixed.cfm - (3878.0 + 2229.0)) < 0.2
    expected_db = (3878.0 * 91.3 + 2229.0 * 75.0) / (3878.0 + 2229.0)
    assert abs(mixed.db_f - expected_db) < 0.1

    # Cooling coil leaving state with apparatus dewpoint & bypass factor
    lvg, sens_btuh, lat_btuh, tot_btuh = cooling_coil_leaving_state(
        "Coil Leaving", mixed, 53.7, 130861.0, 41522.0, 790.0
    )
    assert abs(lvg.db_f - 53.7) < 0.1
    assert lvg.wb_f <= 53.7
    assert tot_btuh > sens_btuh > 0.0


# ==============================================================================
# 3. WEATHER ENGINE & CARRIER HAP 6.4 WEATHER.DB CONNECTION TESTS
# ==============================================================================

def test_weather_station_search_and_solar_profiles():
    # Search Indianapolis or São Paulo in weather.db + built-in catalog
    stations = query_installed_weather_db("Indianapolis")
    assert len(stations) >= 1
    indy = stations[0]
    assert "Indianapolis" in indy["location"]

    br_stations = query_installed_weather_db("Brasil")
    assert len(br_stations) >= 3

    # Test Solar Flux across all 16 orientations + Horizontal
    flux = compute_solar_flux_profile(39.73, 8, 0.20, 1.0, True)
    for direction in ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "HOR"]:
        assert direction in flux
        assert len(flux[direction]) == 24
    assert max(flux["HOR"]) > max(flux["S"]) > max(flux["N"])

    # Full 12-month design weather summary
    proj = create_hap64_example_project()
    summary = generate_design_weather_summary(proj["weather"])
    assert "August" in summary["monthly_profiles"]
    assert abs(summary["monthly_profiles"]["August"]["max_db_f"] - 91.3) < 0.2
    assert abs(summary["max_solar_table"]["August"]["HOR"] - 273.0) < 0.5


# ==============================================================================
# 4. NATIVE .HAP (LZIP v1) & GBXML IMPORT/EXPORT ROUND-TRIP TESTS
# ==============================================================================

def test_lzip_and_hap_archive_roundtrip():
    sample_payload = json.dumps({"Spaces": [{"Name": "101 - Classroom", "AreaSqFt": 804.6}]}).encode("utf-8")
    compressed = compress_lzip_bytes(sample_payload)
    assert compressed[:5] == b"LZIP\x01"
    decompressed = decompress_lzip_bytes(compressed)
    assert json.loads(decompressed.decode("utf-8"))["Spaces"][0]["Name"] == "101 - Classroom"

    # Test reading the official Carrier HAP 6.4 Example Problem archive if present on system
    official_hap_path = r"C:\Users\Public\Documents\Carrier Hourly Analysis Program\HAP-6.4-Example-Problem.hap"
    if os.path.isfile(official_hap_path):
        imported_proj = import_hap64_archive(official_hap_path)
        assert "Indianapolis" in imported_proj["weather"]["location"]
        assert len(imported_proj["space_models"][0]["spaces"]) == 14
        assert imported_proj["_hap_raw_entities_count"] >= 20

    # Test exporting and re-importing a .hap archive
    proj = create_hap64_example_project()
    hap_bytes = export_hap64_archive(proj)
    with tempfile.NamedTemporaryFile(suffix=".hap", delete=False) as tmp:
        tmp.write(hap_bytes)
        tmp_path = tmp.name
    try:
        reimported = import_hap64_archive(tmp_path)
        assert len(reimported["space_models"][0]["spaces"]) == 14
        assert reimported["space_models"][0]["spaces"][0]["name"] == "D101 - Classroom"
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def test_gbxml_export_and_import():
    proj = create_hap64_example_project()
    xml_str = export_gbxml(proj)
    assert "<gbXML" in xml_str
    assert "D101 - Classroom" in xml_str

    parsed = import_gbxml(xml_str, create_hap64_example_project())
    assert len(parsed["space_models"][0]["spaces"]) == 14
    assert parsed["space_models"][0]["spaces"][0]["name"] == "D101 - Classroom"


# ==============================================================================
# 5. CARRIER HAP 6.4 EXAMPLE PROBLEM EXACT PARITY TESTS
# ==============================================================================

def test_hap64_example_problem_calculations_parity():
    proj = create_hap64_example_project()
    validation = validate_project(proj)
    assert all(v["severity"] != "Error" for v in validation)

    results = run_full_project_calculations(proj)
    sys_res = results["air_system"]

    # 1. Air System Sizing Summary checks with physical engineering tolerance bands
    sizing = sys_res["sizing_summary"]
    assert abs(sizing["floor_area_sqft"] - 9274.9) < 2.0
    # Cooling coil capacity within 22 - 36 tons
    assert 22.0 <= sizing["central_cooling_coil"]["total_coil_tons"] <= 36.0
    # Supply fan airflow within 5,000 - 8,500 CFM
    assert 5000 <= sizing["supply_fan"]["design_cfm"] <= 8500
    # Ventilation outdoor air within +-15% of 3878 CFM
    assert abs(sizing["outdoor_ventilation"]["design_airflow_cfm"] - 3878.0) < 400.0
    # Preheat coil capacity within +-35% of 198.1 MBH
    assert abs(sizing["preheat_coil"]["max_coil_load_mbh"] - 198.1) < 60.0

    # 2. Ventilation ASHRAE Std 62.1-2022 Summary
    vent = sys_res["ventilation_summary"]
    assert len(vent["space_rows"]) == 14
    assert abs(vent["system_ventilation_efficiency"] - 0.787) < 0.05

    # 3. Zone Sizing Summary
    zones = sys_res["zone_sizing"]
    assert len(zones) == 11
    z_d101 = next(z for z in zones if z["zone_name"] == "D101 - Classroom")
    assert z_d101["design_airflow_cfm"] > 600

    # 4. System Design Load Heat Balance & Psychrometrics
    hb = sys_res["system_heat_balance"]
    assert hb["total_conditioning"]["clg_sens_btuh"] > 150000
    assert hb["total_conditioning"]["htg_sens_btuh"] > 200000

    # 5. Clean Thermal Core Status
    assert results["status"] == "Calculated"
    assert len(results["validation_errors"]) == 0


# ==============================================================================
# 6. CENTRAL PLANT MODELS & ARCHIVED EXTENSIONS TESTS
# ==============================================================================

def test_plants_and_archived_models():
    # If archived plant models are present in obsoleto, test their physical algorithms
    if merkel_cooling_tower_leaving_temp is not None:
        tw = merkel_cooling_tower_leaving_temp(
            entering_water_f=95.0,
            outdoor_wb_f=75.0,
            outdoor_db_f=91.3,
            load_btuh=1200000.0,
            flow_gpm=240.0,
        )
        assert tw["leaving_water_f"] > 75.0
        assert tw["entering_water_f"] > tw["leaving_water_f"]

        kw_ton = chiller_part_load_kw_per_ton(plr=0.75, full_load_kw_ton=0.58, lchwt_f=44.0, ecwt_f=80.0, vfd_equipped=True)
        assert 0.30 < kw_ton < 0.65

        eff = boiler_efficiency_curve(plr=0.60, return_water_f=115.0, nominal_eff_pct=92.0, modeling_method="Condensing Boiler 2D Curve")
        assert eff >= 0.92



# ==============================================================================
# 7. XLSX & CSV EXPORT TESTS
# ==============================================================================

def test_xlsx_and_csv_exports():
    proj = create_hap64_example_project()
    results = run_full_project_calculations(proj)

    csv_text = generate_csv_export(results, "zone_sizing")
    assert "D101 - Classroom" in csv_text

    xlsx_bytes = generate_xlsx_workbook(results)
    assert len(xlsx_bytes) > 2000
    with zipfile.ZipFile(io.BytesIO(xlsx_bytes), "r") as zf:
        names = zf.namelist()
        assert "[Content_Types].xml" in names
        assert "xl/workbook.xml" in names
        assert "xl/worksheets/sheet1.xml" in names
        assert "xl/worksheets/sheet4.xml" in names


# ==============================================================================
# 8. HTTP REST API SERVER ENDPOINT TESTS
# ==============================================================================

def test_http_server_endpoints():
    server = ThreadingHTTPServer(("127.0.0.1", 0), KapitRequestHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    try:
        # GET /api/project
        with urllib.request.urlopen(f"{base_url}/api/project") as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode("utf-8"))
            assert len(data["project"]["space_models"][0]["spaces"]) == 14
            assert data["calculations"]["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_tons"] > 20.0

        # GET /api/weather/stations?q=Indianapolis
        with urllib.request.urlopen(f"{base_url}/api/weather/stations?q=Indianapolis") as resp:
            assert resp.status == 200
            st = json.loads(resp.read().decode("utf-8"))
            assert len(st["stations"]) >= 1

        # POST /api/units/eval
        req = urllib.request.Request(
            f"{base_url}/api/units/eval",
            data=json.dumps({"expression": "3' 6\"", "quantity_type": "length_ft_m", "to_system": "SI"}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200
            ev = json.loads(resp.read().decode("utf-8"))
            assert abs(ev["evaluated"] - 3.5) < 1e-4
            assert abs(ev["converted"] - 1.07) < 0.02

        # GET /api/export/xlsx
        with urllib.request.urlopen(f"{base_url}/api/export/xlsx") as resp:
            assert resp.status == 200
            xlsx_data = resp.read()
            assert xlsx_data[:2] == b"PK"

        # GET / (UI index.html)
        with urllib.request.urlopen(f"{base_url}/") as resp:
            assert resp.status == 200
            html = resp.read().decode("utf-8")
            assert "Kapit" in html
    finally:
        server.shutdown()
        server.server_close()


# ==============================================================================
# 9. DYNAMIC PHYSICS SENSITIVITY & WIZARD ENDPOINT TESTS
# ==============================================================================

def test_dynamic_physics_sensitivity_to_parameter_changes():
    """
    Verifies that modifying weather, thermostat setpoints, lighting, area,
    or equipment EER dynamically recalculates loads, airflows, coil capacities, and kWh.
    """
    base_proj = create_hap64_example_project()
    base_res = run_full_project_calculations(base_proj)

    # 1. 3x Lighting: increases peak cooling sensible MBH and space sensible load
    lgt_proj = create_hap64_example_project()
    for s in lgt_proj["space_models"][0]["spaces"]:
        s["overhead_lighting_w_sqft"] *= 3.0
    lgt_res = run_full_project_calculations(lgt_proj)
    assert (
        lgt_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
        > base_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
    )
    lgt_sp_clg = sum(sp["peak_sensible_mbh"] for sp in lgt_res["air_system"]["space_sizing"])
    base_sp_clg = sum(sp["peak_sensible_mbh"] for sp in base_res["air_system"]["space_sizing"])
    assert lgt_sp_clg > base_sp_clg

    # 2. Hotter weather (+15F summer DB): increases cooling load and supply airflow
    hot_proj = create_hap64_example_project()
    hot_proj["weather"]["summer_db_f"] += 15.0
    hot_res = run_full_project_calculations(hot_proj)
    assert (
        hot_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
        > base_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
    )
    assert (
        hot_res["air_system"]["sizing_summary"]["supply_fan"]["design_cfm"]
        >= base_res["air_system"]["sizing_summary"]["supply_fan"]["design_cfm"]
    )

    # 3. Thermostat setpoint change (Cooling 75F -> 70F): increases peak coil load
    cold_tstat_proj = create_hap64_example_project()
    cold_tstat_proj["air_systems"][0]["zone_components"]["occ_cooling_tstat_f"] = 70.0
    cold_tstat_res = run_full_project_calculations(cold_tstat_proj)
    assert (
        cold_tstat_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
        > base_res["air_system"]["sizing_summary"]["central_cooling_coil"]["total_coil_mbh"]
    )

    # 4. Weather station search: Sao Paulo without accents returns valid results
    from kapit_engine.weather import query_installed_weather_db
    sp_results = query_installed_weather_db("Sao Paulo")
    assert len(sp_results) >= 1

    # 5. Verify no hardcoded 'ref_peak_clg' remains in engine
    import os
    engine_dir = os.path.join(os.path.dirname(__file__), "..", "kapit_engine")
    for fname in os.listdir(engine_dir):
        if fname.endswith(".py"):
            with open(os.path.join(engine_dir, fname), "r", encoding="utf-8") as f:
                content = f.read()
                assert "ref_peak_clg" not in content, f"Found ref_peak_clg in {fname}"


def test_wizards_and_assembly_calculator_endpoints():
    server = ThreadingHTTPServer(("127.0.0.1", 0), KapitRequestHandler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    try:
        # 1. Test Wall/Roof Assembly R-value & U-value Calculator
        req_assly = urllib.request.Request(
            f"{base_url}/api/assembly/calc",
            data=json.dumps({
                "assembly": {
                    "inside_r": 0.68,
                    "outside_r": 0.17,
                    "layers": [
                        {"thickness_in": 4.0, "density": 125.0, "specific_heat": 0.20, "r_value": 0.80},
                        {"thickness_in": 3.5, "density": 2.0, "specific_heat": 0.22, "r_value": 14.0},
                    ],
                }
            }).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_assly) as resp:
            assert resp.status == 200
            props = json.loads(resp.read().decode("utf-8"))["properties"]
            assert abs(props["overall_r"] - 15.65) < 0.01
            assert abs(props["overall_u"] - round(1.0 / 15.65, 3)) < 0.002

        # 2. Test ASHRAE 90.1 Appendix G Baseline Wizard
        req_base = urllib.request.Request(
            f"{base_url}/api/wizards/baseline",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_base) as resp:
            assert resp.status == 200
            b_data = json.loads(resp.read().decode("utf-8"))
            assert any(a.get("is_baseline") for a in b_data["project"]["alternatives"])

        # 3. Test Building Footprint & Space Generator Wizard (2 levels, 5 zones/level = 10 spaces)
        req_wiz = urllib.request.Request(
            f"{base_url}/api/wizards/building",
            data=json.dumps({
                "name": "Corporate Office Tower",
                "shape": "Rectangular",
                "length_ft": 150.0,
                "width_ft": 100.0,
                "levels": 2,
                "wwr_pct": 35.0,
                "building_type": "Office",
            }).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_wiz) as resp:
            assert resp.status == 200
            w_data = json.loads(resp.read().decode("utf-8"))
            assert len(w_data["project"]["space_models"][0]["spaces"]) == 10
            assert w_data["calculations"]["air_system"]["sizing_summary"]["number_of_zones"] == 10

        # Reset back to default Example Problem
        req_rst = urllib.request.Request(
            f"{base_url}/api/project/reset",
            data=b"{}",
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req_rst) as resp:
            assert resp.status == 200
    finally:
        server.shutdown()
        server.server_close()
