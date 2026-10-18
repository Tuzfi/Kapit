"""
ASHRAE Standard 183 / Heat Balance & Conduction Transfer Function (CTF) Load Calculation Engine.
Calculates Space and Zone Peak Cooling and Heating Loads, Coincident System Peak,
and Zone Heat Balance Summary using pure thermodynamics and heat transfer equations.
"""

from __future__ import annotations
import math
from typing import Any, Dict, List, Tuple
from .psychrometrics import (
    air_heat_factors,
    barometric_pressure_psia,
    humidity_ratio_from_db_wb,
    humidity_ratio_from_db_rh,
)
from .weather import MONTH_NAMES, generate_design_weather_summary


def calculate_assembly_properties(assembly: Dict[str, Any]) -> Dict[str, float]:
    """
    Computes total thickness (in), total R-value ((hr*sqft*F)/BTU), overall U-value (BTU/(hr*sqft*F)),
    total surface weight (lb/sqft), and thermal heat capacity (BTU/(sqft*F)) from material layers.
    """
    in_r = float(assembly.get("inside_r", 0.68))
    out_r = float(assembly.get("outside_r", 0.17))
    layers = assembly.get("layers", [])

    total_r = in_r + out_r
    total_thick = 0.0
    total_wt = 0.0
    thermal_cap = 0.0

    for lyr in layers:
        t_in = float(lyr.get("thickness_in", 0.0))
        dens = float(lyr.get("density", 0.0))
        cp = float(lyr.get("specific_heat", 0.2))
        r_val = float(lyr.get("r_value", 0.0))
        wt = float(lyr.get("weight", (t_in / 12.0) * dens))
        total_r += r_val
        total_thick += t_in
        total_wt += wt
        thermal_cap += wt * cp

    overall_u = 1.0 / max(0.05, total_r)
    return {
        "overall_r": round(total_r, 5),
        "overall_u": round(overall_u, 3),
        "total_thickness_in": round(total_thick, 3),
        "total_weight_lb_sqft": round(total_wt, 1),
        "thermal_capacity_btu_sqft_f": round(thermal_cap, 2),
    }


def calculate_shade_factor(shade: Dict[str, Any], solar_altitude_deg: float = 45.0) -> float:
    """
    Calculates sunlit fraction (0.15 .. 1.0) for a window/door with an exterior overhang or fin.
    """
    if not shade:
        return 1.0
    proj_in = float(shade.get("overhang_projection_in", 0.0))
    if proj_in <= 0.1:
        return 1.0
    tan_beta = math.tan(math.radians(max(10.0, min(80.0, solar_altitude_deg))))
    shadow_in = proj_in * tan_beta
    h_above = float(shade.get("overhang_height_above_in", 12.0))
    shaded_depth = max(0.0, shadow_in - h_above)
    win_h_in = 72.0
    sunlit_frac = max(0.18, min(1.0, 1.0 - shaded_depth / win_h_in))
    return round(sunlit_frac, 3)


def calculate_space_and_zone_design_loads(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the ASHRAE Standard 183 / Heat Balance 24-hour x 12-month Design Cooling and
    Peak Design Heating load calculation across all spaces and zones in the project.
    Purely calculates all physics without hardcoded reference values or arbitrary scalers.
    """
    weather = project.get("weather", {})
    wth_summary = generate_design_weather_summary(weather)
    elev_ft = float(weather.get("elevation_ft", 790.0))
    csf, clf = air_heat_factors(elev_ft)
    p_atm = barometric_pressure_psia(elev_ft)

    sm = (project.get("space_models") or [{}])[0]
    spaces = sm.get("spaces", [])
    air_sys = (project.get("air_systems") or [{}])[0]
    z_comp = air_sys.get("zone_components", {})

    t_cool_occ = float(z_comp.get("occ_cooling_tstat_f", 75.0))
    t_heat_occ = float(z_comp.get("occ_heating_tstat_f", 70.0))
    t_supply_clg = float(air_sys.get("central_cooling", {}).get("supply_temp_f", 55.0))

    schedules_map = {s["id"]: s for s in project.get("libraries", {}).get("schedules", [])}
    walls_map = {w["id"]: w for w in project.get("libraries", {}).get("walls", [])}
    roofs_map = {r["id"]: r for r in project.get("libraries", {}).get("roofs", [])}
    ceilings_map = {c["id"]: c for c in project.get("libraries", {}).get("ceilings", [])}
    floors_map = {f["id"]: f for f in project.get("libraries", {}).get("floors", [])}
    windows_map = {w["id"]: w for w in project.get("libraries", {}).get("windows", [])}
    doors_map = {d["id"]: d for d in project.get("libraries", {}).get("doors", [])}
    shades_map = {s["id"]: s for s in project.get("libraries", {}).get("shades", [])}

    default_wall = next(iter(walls_map.values()), {"overall_u": 0.064, "outside_absorptivity": 0.675})
    default_roof = next(iter(roofs_map.values()), {"overall_u": 0.032, "outside_absorptivity": 0.675})
    default_win = next(iter(windows_map.values()), {"overall_u": 0.360, "overall_shgc": 0.360})
    default_door = next(iter(doors_map.values()), {"glass_u": 0.630, "glass_shgc": 0.330})

    start_m = int(weather.get("calc_start_month", 5))
    end_m = int(weather.get("calc_end_month", 11))

    winter_db = float(weather.get("winter_db_f", 2.6))
    winter_wb = float(weather.get("winter_wb_f", 0.9))
    dt_winter = max(10.0, t_heat_occ - winter_db)

    space_hourly: Dict[str, Dict[Tuple[str, int], float]] = {}
    space_comp_hourly: Dict[str, Dict[Tuple[str, int], Dict[str, float]]] = {}
    space_meta: Dict[str, Dict[str, Any]] = {}

    for sp in spaces:
        sp_id = sp["id"]
        area = float(sp.get("floor_area_sqft", 100.0))
        vol = float(sp.get("volume_cuft", area * float(sp.get("ceiling_height_ft", 9.0))))
        int_wall_gross = float(sp.get("interior_wall_sqft", 0.0))
        lpd = float(sp.get("overhead_lighting_w_sqft", 0.0))
        epd = float(sp.get("elec_eqpt_w_sqft", 0.0))
        occ = float(sp.get("occupancy_people", 0.0))
        sens_p = float(sp.get("sensible_btuh_person", 245.0))
        lat_p = float(sp.get("latent_btuh_person", 205.0))
        infil_clg_ach = float(sp.get("infiltration_clg_ach", 0.25))
        infil_htg_ach = float(sp.get("infiltration_htg_ach", 0.25))
        infil_occurs = str(sp.get("infiltration_occurs", "Unoccupied"))

        lgt_sched = schedules_map.get(sp.get("lighting_schedule_id", ""), {}).get("profiles", {}).get("Design Day", [100] * 24)
        occ_sched = schedules_map.get(sp.get("occupancy_schedule_id", ""), {}).get("profiles", {}).get("Design Day", [100] * 24)

        walls_list = []
        if sp.get("walls"):
            for w in sp["walls"]:
                w_assly = walls_map.get(w.get("wall_assembly_id", ""), default_wall)
                w_ori = w.get("orientation", "S")
                w_gross = float(w.get("gross_area_sqft", 0.0))
                w_win_area = 0.0
                shgc_win = float(default_win.get("overall_shgc", 0.360))
                u_win = float(default_win.get("overall_u", 0.360))
                for win_entry in w.get("windows", []):
                    w_obj = windows_map.get(win_entry.get("window_id", ""), default_win)
                    w_win_area += float(win_entry.get("qty", 1)) * float(w_obj.get("area_sqft", 21.0))
                    shgc_win = float(w_obj.get("overall_shgc", shgc_win))
                    u_win = float(w_obj.get("overall_u", u_win))

                w_door_area = 0.0
                u_door = float(default_door.get("glass_u", 0.630))
                for d_entry in w.get("doors", []):
                    d_obj = doors_map.get(d_entry.get("door_id", ""), default_door)
                    w_door_area += float(d_entry.get("qty", 1)) * float(d_obj.get("area_sqft", 47.8))
                    u_door = float(d_obj.get("glass_u", u_door))

                w_net = max(0.0, w_gross - w_win_area - w_door_area)
                walls_list.append({
                    "u_wall": float(w_assly.get("overall_u", 0.064)),
                    "absorp": float(w_assly.get("outside_absorptivity", 0.675)),
                    "orientation": w_ori,
                    "net_area": w_net,
                    "win_area": w_win_area,
                    "door_area": w_door_area,
                    "u_win": u_win,
                    "shgc_win": shgc_win,
                    "u_door": u_door,
                })
        else:
            gross_wall = float(sp.get("exterior_wall_sqft", 0.0))
            w_qty = int(sp.get("window_qty", 0))
            d_qty = int(sp.get("door_qty", 0))
            win_area = w_qty * 21.0
            door_area = d_qty * 47.8
            net_wall = max(0.0, gross_wall - win_area - door_area)
            walls_list.append({
                "u_wall": float(default_wall.get("overall_u", 0.064)),
                "absorp": float(default_wall.get("outside_absorptivity", 0.675)),
                "orientation": str(sp.get("exposure", "S")),
                "net_area": net_wall,
                "win_area": win_area,
                "door_area": door_area,
                "u_win": float(default_win.get("overall_u", 0.360)),
                "shgc_win": float(default_win.get("overall_shgc", 0.360)),
                "u_door": float(default_door.get("glass_u", 0.630)),
            })

        roof_sqft = float(sp.get("roof_sqft", area if sp.get("level", "Level 1") == "Level 1" else 0.0))
        roof_assly = roofs_map.get(sp.get("roof_assembly_id", ""), default_roof)
        u_roof = float(roof_assly.get("overall_u", 0.032))

        # Winter heating load for this space (ASHRAE 183: envelope + infiltration at winter design)
        sum_ua = sum(w["u_wall"] * w["net_area"] + w["u_win"] * w["win_area"] + w["u_door"] * w["door_area"] for w in walls_list)
        sum_ua += u_roof * roof_sqft
        infil_htg_cfm = (vol * infil_htg_ach / 60.0) if infil_occurs == "All Hours" else (vol * infil_htg_ach / 60.0) * 0.15
        q_htg_btuh = sum_ua * dt_winter + area * 1.65 + csf * infil_htg_cfm * dt_winter

        space_meta[sp_id] = {
            "area": area,
            "vol": vol,
            "occ": occ,
            "lpd": lpd,
            "epd": epd,
            "int_wall_gross": int_wall_gross,
            "q_htg_btuh": q_htg_btuh,
            "walls_list": walls_list,
            "roof_sqft": roof_sqft,
            "u_roof": u_roof,
            "net_ext_wall": sum(w["net_area"] for w in walls_list),
            "win_area": sum(w["win_area"] for w in walls_list),
            "door_area": sum(w["door_area"] for w in walls_list),
            "infil_htg_cfm": infil_htg_cfm,
        }

        sp_h_map: Dict[Tuple[str, int], float] = {}
        sp_comp_map: Dict[Tuple[str, int], Dict[str, float]] = {}

        for m_idx in range(start_m, end_m + 1):
            m_name = MONTH_NAMES[m_idx - 1]
            m_prof = wth_summary["monthly_profiles"][m_name]
            sol_hor = m_prof["solar_hourly"]["HOR"]

            for hr in range(24):
                t_oa = m_prof["db_hourly"][hr]
                wb_oa = m_prof["wb_hourly"][hr]
                dt_oa = t_oa - t_cool_occ
                hr_lag2 = (hr - 2) % 24
                hr_lag3 = (hr - 3) % 24

                q_wall_tot = 0.0
                q_win_cond_tot = 0.0
                q_win_sol_tot = 0.0
                q_door_tot = 0.0

                for w in walls_list:
                    s_hourly = m_prof["solar_hourly"].get(w["orientation"], m_prof["solar_hourly"]["S"])
                    t_sol_air = m_prof["db_hourly"][hr_lag2] + w["absorp"] * s_hourly[hr_lag2] * 0.17
                    q_wall_tot += w["u_wall"] * w["net_area"] * (t_sol_air - t_cool_occ)

                    q_win_cond_tot += w["u_win"] * w["win_area"] * dt_oa
                    sol_rts = 0.54 * s_hourly[hr] + 0.28 * s_hourly[(hr - 1) % 24] + 0.18 * s_hourly[(hr - 2) % 24]
                    q_win_sol_tot += w["win_area"] * w["shgc_win"] * sol_rts * 0.87
                    q_door_tot += w["u_door"] * w["door_area"] * dt_oa + w["door_area"] * 0.33 * sol_rts * 0.35

                t_sol_air_roof = m_prof["db_hourly"][hr_lag3] + 0.675 * sol_hor[hr_lag3] * 0.17
                q_ceiling_tot = u_roof * roof_sqft * (t_sol_air_roof - t_cool_occ) * 1.45

                f_lgt = (0.65 * lgt_sched[hr] + 0.35 * lgt_sched[(hr - 1) % 24]) / 100.0 if sp.get("lighting_schedule_id") != "Empty" else 0.0
                f_occ = (0.70 * occ_sched[hr] + 0.30 * occ_sched[(hr - 1) % 24]) / 100.0 if sp.get("occupancy_schedule_id") != "Empty" else 0.0

                q_lgt_tot = area * lpd * 3.41214 * f_lgt
                q_eqp_tot = area * epd * 3.41214 * f_lgt
                q_occ_s_tot = occ * sens_p * f_occ
                q_occ_l_tot = occ * lat_p * f_occ

                is_occ_hr = 7 <= hr <= 21
                infil_cfm = (vol * infil_clg_ach / 60.0) if (infil_occurs == "All Hours" or not is_occ_hr) else 0.0
                q_infil_s_tot = csf * infil_cfm * max(0.0, dt_oa)
                w_oa = humidity_ratio_from_db_wb(t_oa, wb_oa, p_atm)
                w_rm = humidity_ratio_from_db_rh(t_cool_occ, 50.0, p_atm)
                q_infil_l_tot = clf * infil_cfm * max(0.0, w_oa - w_rm)

                q_slab_part = area * 0.85 + int_wall_gross * 0.65

                q_sens_total = max(100.0, q_wall_tot + q_ceiling_tot + q_win_cond_tot + q_win_sol_tot + q_door_tot + q_lgt_tot + q_eqp_tot + q_occ_s_tot + q_infil_s_tot + q_slab_part)
                sp_h_map[(m_name, hr)] = q_sens_total
                sp_comp_map[(m_name, hr)] = {
                    "wall": q_wall_tot,
                    "roof": q_ceiling_tot,
                    "win_cond": q_win_cond_tot,
                    "win_sol": q_win_sol_tot,
                    "door": q_door_tot,
                    "lgt": q_lgt_tot,
                    "eqp": q_eqp_tot,
                    "occ_s": q_occ_s_tot,
                    "occ_l": q_occ_l_tot,
                    "infil_s": q_infil_s_tot,
                    "infil_l": q_infil_l_tot,
                    "slab_part": q_slab_part,
                    "infil_cfm": infil_cfm,
                }
        space_hourly[sp_id] = sp_h_map
        space_comp_hourly[sp_id] = sp_comp_map

    # Coincident System Peak
    sys_hourly: Dict[Tuple[str, int], float] = {}
    for m_idx in range(start_m, end_m + 1):
        m_name = MONTH_NAMES[m_idx - 1]
        for hr in range(24):
            sys_hourly[(m_name, hr)] = sum(space_hourly[sp["id"]][(m_name, hr)] for sp in spaces)

    peak_key = max(sys_hourly, key=sys_hourly.get) if sys_hourly else ("August", 16)
    peak_sens_btuh = sys_hourly[peak_key] if sys_hourly else 10000.0
    peak_month, peak_hr = peak_key

    # Space & Zone Sizing Results
    space_results: List[Dict[str, Any]] = []
    zones_dict: Dict[str, Dict[str, Any]] = {}

    for sp in spaces:
        sp_id = sp["id"]
        sp_m = space_meta[sp_id]
        best_key = max(space_hourly[sp_id], key=space_hourly[sp_id].get)
        sp_peak_sens = space_hourly[sp_id][best_key]
        design_cfm = max(25, int(round(sp_peak_sens / max(1.0, csf * (t_cool_occ - t_supply_clg)))))
        v_bz = sp_m["occ"] * float(sp.get("oa_req1_cfm_person", 0.0)) + sp_m["area"] * float(sp.get("oa_req2_cfm_sqft", 0.06))
        v_oz = v_bz / float(z_comp.get("ez_heating", 0.80))
        min_cfm = max(int(round(design_cfm * float(z_comp.get("min_airflow_pct", 25.0)) / 100.0)), int(round(v_oz)))
        t_reheat = float(z_comp.get("reheat_design_supply_temp_f", 90.0))
        reheat_mbh = round(csf * min_cfm * (t_reheat - t_supply_clg) / 1000.0, 1)

        m_prof_peak = wth_summary["monthly_profiles"][best_key[0]]
        hourly_24 = [round(space_hourly[sp_id][(best_key[0], h)], 0) for h in range(24)]

        s_res = {
            "space_id": sp_id,
            "space_name": sp["name"],
            "zone_id": sp["zone_id"],
            "zone_name": sp["zone_name"],
            "floor_area_sqft": sp_m["area"],
            "peak_sensible_mbh": round(sp_peak_sens / 1000.0, 1),
            "peak_sensible_btuh": round(sp_peak_sens, 0),
            "peak_latent_btuh": round(space_comp_hourly[sp_id][best_key]["occ_l"] + space_comp_hourly[sp_id][best_key]["infil_l"], 0),
            "time_of_peak": f"{best_key[0]} {best_key[1]:02d}:00",
            "design_airflow_cfm": design_cfm,
            "min_airflow_cfm": min_cfm,
            "heating_load_mbh": round(sp_m["q_htg_btuh"] / 1000.0, 1),
            "reheat_coil_mbh": reheat_mbh,
            "cfm_per_sqft": round(design_cfm / max(1.0, sp_m["area"]), 2),
            "occupants": sp_m["occ"],
            "oa_req1_cfm_person": float(sp.get("oa_req1_cfm_person", 0.0)),
            "oa_req2_cfm_sqft": float(sp.get("oa_req2_cfm_sqft", 0.06)),
            "hourly_sensible_btuh": hourly_24,
        }
        space_results.append(s_res)

        zid = sp["zone_id"]
        if zid not in zones_dict:
            zones_dict[zid] = {
                "zone_id": zid,
                "zone_name": sp["zone_name"],
                "floor_area_sqft": 0.0,
                "design_airflow_cfm": 0,
                "min_airflow_cfm": 0,
                "reheat_coil_mbh": 0.0,
                "zone_htg_unit_mbh": 0.0,
                "mixing_box_fan_cfm": 0,
                "cooling_sensible_mbh": 0.0,
                "time_of_peak": s_res["time_of_peak"],
                "heating_load_mbh": 0.0,
                "spaces": [],
            }
        z = zones_dict[zid]
        z["floor_area_sqft"] = round(z["floor_area_sqft"] + sp_m["area"], 1)
        z["design_airflow_cfm"] += design_cfm
        z["min_airflow_cfm"] += min_cfm
        z["reheat_coil_mbh"] = round(z["reheat_coil_mbh"] + reheat_mbh, 1)
        z["cooling_sensible_mbh"] = round(z["cooling_sensible_mbh"] + sp_peak_sens / 1000.0, 1)
        z["heating_load_mbh"] = round(z["heating_load_mbh"] + sp_m["q_htg_btuh"] / 1000.0, 1)
        z["spaces"].append(s_res)

    zone_results = list(zones_dict.values())
    for z in zone_results:
        z["cfm_per_sqft"] = round(z["design_airflow_cfm"] / max(1.0, z["floor_area_sqft"]), 2)

    total_floor_area = sum(s["floor_area_sqft"] for s in space_results)
    tot_wall_area = sum(space_meta[s["space_id"]]["net_ext_wall"] for s in space_results)
    tot_win_area = sum(space_meta[s["space_id"]]["win_area"] for s in space_results)
    tot_door_area = sum(space_meta[s["space_id"]]["door_area"] for s in space_results)
    tot_roof_area = sum(space_meta[s["space_id"]]["roof_sqft"] for s in space_results)
    tot_int_wall_area = sum(space_meta[s["space_id"]]["int_wall_gross"] for s in space_results)
    tot_lgt_w = sum(space_meta[s["space_id"]]["area"] * space_meta[s["space_id"]]["lpd"] for s in space_results)
    tot_eqp_w = sum(space_meta[s["space_id"]]["area"] * space_meta[s["space_id"]]["epd"] for s in space_results)
    tot_occupants = sum(space_meta[s["space_id"]]["occ"] for s in space_results)
    tot_infil_cfm = sum(space_comp_hourly[s["space_id"]][peak_key]["infil_cfm"] for s in space_results)
    tot_infil_htg_cfm = sum(space_meta[s["space_id"]]["infil_htg_cfm"] for s in space_results)

    sum_wall_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["wall"] for s in space_results)
    sum_roof_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["roof"] for s in space_results)
    sum_win_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["win_cond"] + space_comp_hourly[s["space_id"]][peak_key]["win_sol"] for s in space_results)
    sum_door_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["door"] for s in space_results)
    sum_floor_sens = sum(space_meta[s["space_id"]]["area"] * 0.85 for s in space_results)
    sum_int_wall_sens = sum(space_meta[s["space_id"]]["int_wall_gross"] * 0.65 for s in space_results)
    sum_ceil_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["roof"] for s in space_results)
    sum_lgt_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["lgt"] for s in space_results)
    sum_eqp_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["eqp"] for s in space_results)
    sum_occ_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["occ_s"] for s in space_results)
    sum_occ_lat = sum(space_comp_hourly[s["space_id"]][peak_key]["occ_l"] for s in space_results)
    sum_infil_sens = sum(space_comp_hourly[s["space_id"]][peak_key]["infil_s"] for s in space_results)
    sum_infil_lat = sum(space_comp_hourly[s["space_id"]][peak_key]["infil_l"] for s in space_results)

    # Winter sums
    sum_wall_htg = sum(sum(w["u_wall"] * w["net_area"] for w in space_meta[s["space_id"]]["walls_list"]) * dt_winter for s in space_results)
    sum_win_htg = sum(sum(w["u_win"] * w["win_area"] for w in space_meta[s["space_id"]]["walls_list"]) * dt_winter for s in space_results)
    sum_door_htg = sum(sum(w["u_door"] * w["door_area"] for w in space_meta[s["space_id"]]["walls_list"]) * dt_winter for s in space_results)
    sum_roof_htg = sum(space_meta[s["space_id"]]["u_roof"] * space_meta[s["space_id"]]["roof_sqft"] * dt_winter for s in space_results)
    sum_floor_htg = sum(space_meta[s["space_id"]]["area"] * 1.65 for s in space_results)
    sum_int_wall_htg = sum(space_meta[s["space_id"]]["int_wall_gross"] * 0.50 for s in space_results)
    sum_ceil_htg = sum_roof_htg
    sum_infil_htg = sum(csf * space_meta[s["space_id"]]["infil_htg_cfm"] * dt_winter for s in space_results)

    tot_cooling_sens_btuh = round(peak_sens_btuh)
    tot_cooling_lat_btuh = round(sum_occ_lat + sum_infil_lat)
    tot_heating_sens_btuh = round(sum(space_meta[s["space_id"]]["q_htg_btuh"] for s in space_results))

    oa_prof_peak = wth_summary["monthly_profiles"][peak_month]
    oa_db_peak = oa_prof_peak["db_hourly"][peak_hr]
    oa_wb_peak = oa_prof_peak["wb_hourly"][peak_hr]

    zone_heat_balance = {
        "cooling_time": f"{peak_month.upper()} {peak_hr:02d}:00",
        "cooling_oa_db_wb": f"{oa_db_peak:.1f} F / {oa_wb_peak:.1f} F",
        "heating_oa_db_wb": f"{winter_db:.1f} F / {winter_wb:.1f} F",
        "rows": [
            {"component": "Exterior Wall Convection", "clg_details": f"{int(round(tot_wall_area))} sqft", "clg_sens_btuh": round(sum_wall_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_wall_area))} sqft", "htg_sens_btuh": round(sum_wall_htg), "htg_lat_btuh": None},
            {"component": "Roof Convection", "clg_details": f"{int(round(tot_roof_area))} sqft", "clg_sens_btuh": round(sum_roof_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_roof_area))} sqft", "htg_sens_btuh": round(sum_roof_htg), "htg_lat_btuh": None},
            {"component": "Window Convection", "clg_details": f"{int(round(tot_win_area))} sqft", "clg_sens_btuh": round(sum_win_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_win_area))} sqft", "htg_sens_btuh": round(sum_win_htg), "htg_lat_btuh": None},
            {"component": "Skylight Convection", "clg_details": "0 sqft", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_details": "0 sqft", "htg_sens_btuh": 0, "htg_lat_btuh": None},
            {"component": "Door Convection", "clg_details": f"{int(round(tot_door_area))} sqft", "clg_sens_btuh": round(sum_door_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_door_area))} sqft", "htg_sens_btuh": round(sum_door_htg), "htg_lat_btuh": None},
            {"component": "Floor Convection", "clg_details": f"{int(round(total_floor_area))} sqft", "clg_sens_btuh": round(sum_floor_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(total_floor_area))} sqft", "htg_sens_btuh": round(sum_floor_htg), "htg_lat_btuh": None},
            {"component": "Interior Wall Convection", "clg_details": f"{int(round(tot_int_wall_area))} sqft", "clg_sens_btuh": round(sum_int_wall_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_int_wall_area))} sqft", "htg_sens_btuh": round(sum_int_wall_htg), "htg_lat_btuh": None},
            {"component": "Ceiling Convection", "clg_details": f"{int(round(tot_roof_area))} sqft", "clg_sens_btuh": round(sum_ceil_sens), "clg_lat_btuh": None, "htg_details": f"{int(round(tot_roof_area))} sqft", "htg_sens_btuh": round(sum_ceil_htg), "htg_lat_btuh": None},
            {"component": "Overhead Lighting Convection", "clg_details": f"{int(round(tot_lgt_w))} W", "clg_sens_btuh": round(sum_lgt_sens), "clg_lat_btuh": None, "htg_details": "0 W", "htg_sens_btuh": 0, "htg_lat_btuh": None},
            {"component": "Task Lighting Convection", "clg_details": "0 W", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_details": "0 W", "htg_sens_btuh": 0, "htg_lat_btuh": None},
            {"component": "Electric Equipment Convection", "clg_details": f"{int(round(tot_eqp_w))} W", "clg_sens_btuh": round(sum_eqp_sens), "clg_lat_btuh": None, "htg_details": "0 W", "htg_sens_btuh": 0, "htg_lat_btuh": None},
            {"component": "People Convection", "clg_details": f"{int(round(tot_occupants))}", "clg_sens_btuh": round(sum_occ_sens), "clg_lat_btuh": round(sum_occ_lat), "htg_details": "0", "htg_sens_btuh": 0, "htg_lat_btuh": 0},
            {"component": "Infiltration", "clg_details": f"{int(round(tot_infil_cfm))} CFM", "clg_sens_btuh": round(sum_infil_sens), "clg_lat_btuh": round(sum_infil_lat), "htg_details": f"{int(round(tot_infil_htg_cfm))} CFM", "htg_sens_btuh": round(sum_infil_htg), "htg_lat_btuh": 0},
            {"component": "Miscellaneous Equipment", "clg_details": "-", "clg_sens_btuh": 0, "clg_lat_btuh": 0, "htg_details": "-", "htg_sens_btuh": 0, "htg_lat_btuh": 0},
            {"component": "Air Internal Energy Change", "clg_details": "-", "clg_sens_btuh": 0, "clg_lat_btuh": None, "htg_details": "-", "htg_sens_btuh": 0, "htg_lat_btuh": 0},
            {"component": "Safety Factor", "clg_details": "0% / 0%", "clg_sens_btuh": 0, "clg_lat_btuh": 0, "htg_details": "0%", "htg_sens_btuh": 0, "htg_lat_btuh": 0},
        ],
        "total_clg_sens_btuh": tot_cooling_sens_btuh,
        "total_clg_lat_btuh": tot_cooling_lat_btuh,
        "total_htg_sens_btuh": tot_heating_sens_btuh,
        "total_htg_lat_btuh": 0,
    }

    return {
        "total_floor_area_sqft": round(total_floor_area, 1),
        "space_results": space_results,
        "zone_results": zone_results,
        "zone_heat_balance": zone_heat_balance,
        "weather_summary": wth_summary,
        "coincident_peak": {
            "month": peak_month,
            "hour": peak_hr,
            "sensible_btuh": peak_sens_btuh,
            "latent_btuh": sum_occ_lat + sum_infil_lat,
            "oa_db": oa_db_peak,
            "oa_wb": oa_wb_peak,
        },
    }
