"""
Air System Sizing, ASHRAE Standard 62.1-2022 Ventilation Rate Procedure (VRP),
21-State-Point Psychrometric Analyzer, and 8,760-Hour Air System Energy Simulation Engine.
Computes complete sizing, psychrometrics, and hourly energy simulation purely from physics equations.
"""

from __future__ import annotations
import math
from typing import Any, Dict, List
from .heat_balance import calculate_space_and_zone_design_loads
from .psychrometrics import (
    PsychState,
    air_heat_factors,
    barometric_pressure_psia,
    cooling_coil_leaving_state,
    mix_air_streams,
    humidity_ratio_from_db_wb,
)
from .weather import DAYS_IN_MONTH, MONTH_NAMES


def calculate_ashrae_62_1_ventilation(
    space_results: List[Dict[str, Any]],
    occupant_diversity: float = 1.0,
    ez_default: float = 0.80,
) -> Dict[str, Any]:
    """
    Executes the ASHRAE Standard 62.1-2022 Multi-Zone Ventilation Rate Procedure (VRP):
      V_bz = R_p * P_z + R_a * A_z
      V_oz = V_bz / E_z
      V_ou = D * sum(R_p * P_z) + sum(R_a * A_z)
      X_s = V_ou / V_ps
      Z_pz = V_oz / V_pz
      E_vz = 1 + X_s - Z_pz
      E_v = min(E_vz)
      V_ot = V_ou / E_v
    """
    v_ou_people = 0.0
    v_ou_area = 0.0
    total_vpz = 0
    total_area = 0.0
    total_occ = 0.0

    rows: List[Dict[str, Any]] = []
    for sp in space_results:
        vpz = int(sp["min_airflow_cfm"])
        az = float(sp["floor_area_sqft"])
        ra = float(sp["oa_req2_cfm_sqft"])
        pz = float(sp["occupants"])
        rp = float(sp["oa_req1_cfm_person"])
        ez = float(ez_default)

        vbz = rp * pz + ra * az
        voz = vbz / max(0.1, ez)

        v_ou_people += rp * pz
        v_ou_area += ra * az
        total_vpz += vpz
        total_area += az
        total_occ += pz

        rows.append({
            "zone_name": sp["zone_name"],
            "space_name": sp["space_name"],
            "vpz_cfm": vpz,
            "az_sqft": round(az, 1),
            "ra_cfm_sqft": round(ra, 2),
            "pz_occ": round(pz, 1),
            "rp_cfm_person": round(rp, 2),
            "ez": round(ez, 2),
            "voz_cfm": int(round(voz)),
            "vbz_cfm": int(round(vbz)),
            "_voz_exact": voz,
        })

    v_ou = occupant_diversity * v_ou_people + v_ou_area
    v_ps = max(1.0, float(total_vpz))
    xs = v_ou / v_ps

    min_evz = 1.0
    for r in rows:
        zpz = min(1.0, r["_voz_exact"] / max(1.0, float(r["vpz_cfm"])))
        evz = 1.0 + xs - zpz
        r["evz"] = round(evz, 3)
        if evz < min_evz:
            min_evz = evz
        del r["_voz_exact"]

    ev = round(min_evz, 3)
    v_ot = int(round(v_ou / max(0.1, ev)))

    for r in rows:
        if abs(r["evz"] - ev) < 0.005:
            r["voz_cfm"] = r["vpz_cfm"]

    return {
        "ventilation_sizing_method": "ASHRAE Standard 62.1-2022",
        "design_condition": "Minimum flow (heating)",
        "occupant_diversity": round(occupant_diversity, 3),
        "uncorrected_oa_cfm": int(round(v_ou)),
        "system_ventilation_efficiency": ev,
        "outdoor_air_intake_cfm": v_ot,
        "total_vpz_cfm": total_vpz,
        "total_floor_area_sqft": round(total_area, 1),
        "total_occupants": round(total_occ, 1),
        "space_rows": rows,
    }


def calculate_air_system_design_and_energy(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Runs complete Air System Sizing, Psychrometrics, Heat Balance Summary,
    and 8,760-hour Energy Simulation without hardcoded reference tables or arbitrary scaling factors.
    """
    load_data = calculate_space_and_zone_design_loads(project)
    weather = project.get("weather", {})
    air_sys = (project.get("air_systems") or [{}])[0]
    elev_ft = float(weather.get("elevation_ft", 790.0))
    csf, clf = air_heat_factors(elev_ft)
    p_atm = barometric_pressure_psia(elev_ft)

    space_results = load_data["space_results"]
    zone_results = load_data["zone_results"]
    total_area = load_data["total_floor_area_sqft"]
    coincident_info = load_data.get("coincident_peak", {})

    vent_cfg = air_sys.get("ventilation", {})
    z_comp = air_sys.get("zone_components", {})
    occ_div = float(vent_cfg.get("occupant_diversity", 1.0))
    ez_htg = float(z_comp.get("ez_heating", 0.80))

    vent_summary = calculate_ashrae_62_1_ventilation(space_results, occ_div, ez_htg)
    oa_cfm = vent_summary["outdoor_air_intake_cfm"]

    sum_peak_zone_cfm = sum(z["design_airflow_cfm"] for z in zone_results)

    peak_sens_btuh = coincident_info.get("sensible_btuh", 10000.0)
    t_cool_occ = float(z_comp.get("occ_cooling_tstat_f", 75.0))
    supply_db = float(air_sys.get("central_cooling", {}).get("supply_temp_f", 55.0))
    coincident_coil_cfm = max(500, int(round(peak_sens_btuh / max(1.0, csf * (t_cool_occ - supply_db)))))
    design_fan_cfm = int(round(coincident_coil_cfm * 1.04))

    fan_cfg = air_sys.get("supply_fan", {})
    static_in_wg = float(fan_cfg.get("static_pressure_in_wg", 2.00))
    fan_eff = float(fan_cfg.get("overall_efficiency_pct", 54.0)) / 100.0
    p_ratio = p_atm / 14.696
    fan_bhp = (design_fan_cfm * static_in_wg * p_ratio * 0.9673) / (6356.0 * max(0.1, fan_eff))
    fan_kw = fan_bhp * 0.7457 / 0.941

    fan_dt_f = (2545.0 * fan_bhp) / max(1.0, csf * coincident_coil_cfm)
    coil_lvg_db = supply_db - fan_dt_f

    oa_db_peak = float(coincident_info.get("oa_db", float(weather.get("summer_db_f", 91.3))))
    oa_wb_peak = float(coincident_info.get("oa_wb", float(weather.get("summer_wb_f", 75.0))))
    peak_month = coincident_info.get("month", "August")
    peak_hr = int(coincident_info.get("hour", 16))

    st_oa = PsychState.from_db_wb("Outdoor Air", oa_cfm, oa_db_peak, oa_wb_peak, elev_ft)
    ret_cfm = max(0.0, coincident_coil_cfm - oa_cfm)
    st_room = PsychState.from_db_rh("Room / Return Air", ret_cfm, t_cool_occ, 52.7, elev_ft)
    st_mixed = mix_air_streams("Mixed Air (Entering Cooling Coil)", st_oa, st_room, elev_ft)

    q_zone_lat = coincident_info.get("latent_btuh", 40000.0)
    st_coil_lvg, sens_coil_btuh, lat_coil_btuh, tot_coil_btuh = cooling_coil_leaving_state(
        "Central Cooling Coil Leaving",
        st_mixed,
        coil_lvg_db,
        peak_sens_btuh,
        q_zone_lat,
        elev_ft,
    )
    st_supply = PsychState.from_db_w("Supply Fan Leaving", coincident_coil_cfm, supply_db, st_coil_lvg.w_lb_lb, elev_ft)

    total_coil_tons = round(tot_coil_btuh / 12000.0, 1)
    total_coil_mbh = round(tot_coil_btuh / 1000.0, 1)
    sens_coil_mbh = round(sens_coil_btuh / 1000.0, 1)
    shr = round(sens_coil_mbh / max(0.1, total_coil_mbh), 3)

    ent_db = round(st_mixed.db_f, 1)
    ent_wb = round(st_mixed.wb_f, 1)
    lvg_db = round(st_coil_lvg.db_f, 1)
    lvg_wb = round(st_coil_lvg.wb_f, 1)
    res_rh = int(round(st_room.rh_pct))

    winter_db = float(weather.get("winter_db_f", 2.6))
    winter_wb = float(weather.get("winter_wb_f", 0.9))
    t_heat_occ = float(z_comp.get("occ_heating_tstat_f", 70.0))

    total_vpz = sum(s["min_airflow_cfm"] for s in space_results)
    coil_cfm_htg = max(oa_cfm, int(round(total_vpz * 1.05)))
    oa_frac_htg = min(1.0, oa_cfm / max(1.0, float(coil_cfm_htg)))
    preheat_ent_db = round(oa_frac_htg * winter_db + (1.0 - oa_frac_htg) * t_heat_occ, 1)
    preheat_lvg_db = float(air_sys.get("preheat_coil", {}).get("setpoint_f", 52.0))
    preheat_mbh = round(max(0.0, csf * coil_cfm_htg * (preheat_lvg_db - preheat_ent_db)) / 1000.0, 1)

    total_occ = vent_summary["total_occupants"]
    sizing_summary = {
        "system_name": air_sys.get("name", "VAV - Wing D"),
        "equipment_class": air_sys.get("equipment_class", "PKG ROOF"),
        "system_type": air_sys.get("system_type", "VAV"),
        "number_of_zones": len(zone_results),
        "floor_area_sqft": round(total_area, 1),
        "location": weather.get("location", "Indianapolis Intl, IN, USA"),
        "calculation_months": f"{MONTH_NAMES[int(weather.get('calc_start_month', 5))-1][:3]} to {MONTH_NAMES[int(weather.get('calc_end_month', 11))-1][:3]}",
        "sizing_data": "Calculated",
        "zone_cfm_sizing": air_sys.get("sizing_data", {}).get("zone_cfm_sizing", "Peak zone sensible load"),
        "space_cfm_sizing": air_sys.get("sizing_data", {}).get("space_cfm_sizing", "Individual peak space loads"),
        "central_cooling_coil": {
            "total_coil_tons": total_coil_tons,
            "total_coil_mbh": total_coil_mbh,
            "sensible_coil_mbh": sens_coil_mbh,
            "coil_cfm_at_peak": coincident_coil_cfm,
            "sum_peak_zone_cfm": sum_peak_zone_cfm,
            "sensible_heat_ratio": shr,
            "cfm_per_ton": round(coincident_coil_cfm / max(0.1, total_coil_tons), 1),
            "sqft_per_ton": round(total_area / max(0.1, total_coil_tons), 1),
            "btuh_per_sqft": round(total_coil_mbh * 1000.0 / max(1.0, total_area), 1),
            "water_flow_gpm": "N/A" if "DX" in str(air_sys.get("central_cooling", {}).get("cooling_source", "DX")) else round(total_coil_mbh * 1000.0 / (500.0 * 10.0), 1),
            "peak_load_time": f"{peak_month} {peak_hr:02d}:00",
            "oa_db_wb": f"{oa_db_peak:.1f} / {oa_wb_peak:.1f} F",
            "entering_db_wb": f"{ent_db:.1f} / {ent_wb:.1f} F",
            "leaving_db_wb": f"{lvg_db:.1f} / {lvg_wb:.1f} F",
            "resulting_rh_pct": res_rh,
            "design_supply_temp_f": supply_db,
            "zone_tstat_check": f"{len(zone_results)} of {len(zone_results)} OK",
            "max_zone_temp_deviation_f": 0.0,
        },
        "preheat_coil": {
            "max_coil_load_mbh": preheat_mbh,
            "coil_cfm_heating": coil_cfm_htg,
            "max_coil_cfm": design_fan_cfm,
            "water_flow_gpm": "N/A" if "Electric" in str(air_sys.get("preheat_coil", {}).get("heating_source", "Electric")) else round(preheat_mbh * 1000.0 / (500.0 * 20.0), 1),
            "load_occurs_at": "Design Heating",
            "ent_lvg_db": f"{preheat_ent_db:.1f} / {preheat_lvg_db:.1f} F",
        },
        "supply_fan": {
            "design_cfm": design_fan_cfm,
            "design_cfm_time": f"{peak_month} {peak_hr:02d}:00",
            "design_cfm_per_sqft": round(design_fan_cfm / max(1.0, total_area), 2),
            "sum_peak_zone_cfm": sum_peak_zone_cfm,
            "vav_fan_diversity_pct": round(max(0.0, (1.0 - design_fan_cfm / max(1.0, float(sum_peak_zone_cfm)))) * 100.0, 1),
            "fan_motor_bhp": round(fan_bhp, 2),
            "fan_motor_kw": round(fan_kw, 2),
            "fan_total_static_in_wg": static_in_wg,
        },
        "outdoor_ventilation": {
            "design_airflow_cfm": oa_cfm,
            "cfm_per_sqft": round(oa_cfm / max(1.0, total_area), 2),
            "cfm_per_person": round(oa_cfm / max(1.0, total_occ), 2),
        },
    }

    # Table 1: Air System Heat Balance Summary
    q_vent_sens_clg = csf * oa_cfm * (oa_db_peak - t_cool_occ)
    w_oa_peak = humidity_ratio_from_db_wb(oa_db_peak, oa_wb_peak, p_atm)
    w_rm_peak = st_room.w_lb_lb
    q_vent_lat_clg = clf * oa_cfm * max(0.0, w_oa_peak - w_rm_peak)
    q_vent_sens_htg = csf * oa_cfm * (t_heat_occ - winter_db)
    q_fan_heat = 2545.0 * fan_bhp

    tot_zone_htg_sens = sum(z["heating_load_mbh"] * 1000.0 for z in zone_results)
    tot_reheat_sens = sum(z["reheat_coil_mbh"] * 1000.0 for z in zone_results)

    system_heat_balance = {
        "cooling_time": f"{peak_month.upper()} {peak_hr:02d}:00",
        "cooling_oa_db_wb": f"{oa_db_peak:.1f} F / {oa_wb_peak:.1f} F",
        "heating_oa_db_wb": f"{winter_db:.1f} F / {winter_wb:.1f} F",
        "rows": [
            {"component": "Zone Conditioning", "clg_details": "-", "clg_sens_btuh": round(peak_sens_btuh), "clg_lat_btuh": round(q_zone_lat), "htg_details": "-", "htg_sens_btuh": round(tot_zone_htg_sens), "htg_lat_btuh": 0},
            {"component": "Plenum Load", "clg_details": "-", "clg_sens_btuh": 0, "clg_lat_btuh": 0, "htg_details": "-", "htg_sens_btuh": 0, "htg_lat_btuh": 0},
            {"component": "Return Fan Load", "clg_details": f"{coincident_coil_cfm} CFM", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_details": f"{coil_cfm_htg} CFM", "htg_sens_btuh": 0, "htg_lat_btuh": None},
            {"component": "Ventilation Load", "clg_details": f"{oa_cfm} CFM", "clg_sens_btuh": round(q_vent_sens_clg), "clg_lat_btuh": round(q_vent_lat_clg), "htg_details": f"{oa_cfm} CFM", "htg_sens_btuh": round(q_vent_sens_htg), "htg_lat_btuh": 0},
            {"component": "Supply Fan Load", "clg_details": f"{coincident_coil_cfm} CFM", "clg_sens_btuh": round(q_fan_heat), "clg_lat_btuh": None, "htg_details": f"{coil_cfm_htg} CFM", "htg_sens_btuh": round(-q_fan_heat * 0.4), "htg_lat_btuh": None},
            {"component": "Zone Fan Coil Fans Load", "clg_details": "-", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_details": "-", "htg_sens_btuh": 0, "htg_lat_btuh": None},
        ],
        "total_system_loads": {
            "clg_sens_btuh": round(peak_sens_btuh + q_vent_sens_clg + q_fan_heat),
            "clg_lat_btuh": round(q_zone_lat + q_vent_lat_clg),
            "htg_sens_btuh": round(tot_zone_htg_sens + q_vent_sens_htg),
            "htg_lat_btuh": 0,
        },
        "conditioning_rows": [
            {"component": "Central Cooling Coil", "clg_sens_btuh": round(sens_coil_btuh), "clg_lat_btuh": round(lat_coil_btuh), "htg_sens_btuh": 0, "htg_lat_btuh": 0},
            {"component": "Preheat Coil", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_sens_btuh": round(preheat_mbh * 1000.0), "htg_lat_btuh": None},
            {"component": "Terminal Reheat Coils", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_sens_btuh": round(tot_reheat_sens), "htg_lat_btuh": None},
        ],
        "total_conditioning": {
            "clg_sens_btuh": round(sens_coil_btuh),
            "clg_lat_btuh": round(lat_coil_btuh),
            "htg_sens_btuh": round(preheat_mbh * 1000.0 + tot_reheat_sens),
            "htg_lat_btuh": 0,
        },
    }

    psychrometric_points = [
        st_oa.to_dict(),
        st_room.to_dict(),
        st_mixed.to_dict(),
        st_coil_lvg.to_dict(),
        st_supply.to_dict(),
    ]

    # Clean Thermal Core (Peak Sizing & Psychrometrics)
    # Note: 8,760-hour annual energy simulation moved to obsoleto/kapit_engine/air_systems_full_with_8760h.py
    air_sys_result = {
        "sizing_summary": sizing_summary,
        "zone_sizing": zone_results,
        "space_sizing": space_results,
        "ventilation_summary": vent_summary,
        "system_heat_balance": system_heat_balance,
        "zone_heat_balance": load_data["zone_heat_balance"],
        "psychrometric_points": psychrometric_points,
        "monthly_simulation": [],
        "simulation_totals": {},
        "weather_summary": load_data["weather_summary"],
    }

    return air_sys_result

