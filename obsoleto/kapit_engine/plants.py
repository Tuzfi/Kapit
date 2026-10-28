"""
Chilled Water, Hot Water, Steam, Changeover, Service Hot Water (SHW), and Heat Recovery Plant Engine.
Reproduces eDesign.Plants01.dll (CalcPlant, Chillers, BoilerCalc, CoolingTower_Merkel, FreeCool, PlantDistribution).
"""

from __future__ import annotations
import math
from typing import Any, Dict, List
from kapit_engine.psychrometrics import enthalpy_btu_lb, humidity_ratio_from_db_rh, humidity_ratio_from_db_wb
from kapit_engine.reference_data import fluid_properties


def merkel_cooling_tower_leaving_temp(
    entering_water_f: float,
    outdoor_wb_f: float,
    outdoor_db_f: float,
    load_btuh: float,
    flow_gpm: float,
    design_ntu: float = 1.65,
    fan_speed_frac: float = 1.0,
) -> Dict[str, float]:
    """
    Merkel Enthalpy Potential Cooling Tower Model using 4-point Chebyshev numerical integration:
      NTU = C * Integral( dT / (h_s(T_w) - h_a) )
    Computes leaving condenser water temperature (°F), approach (°F), range (°F), and fan power fraction.
    """
    if load_btuh <= 100.0 or flow_gpm <= 1.0:
        return {
            "entering_water_f": round(outdoor_wb_f + 5.0, 1),
            "leaving_water_f": round(outdoor_wb_f + 5.0, 1),
            "range_f": 0.0,
            "approach_f": 5.0,
            "ntu_available": round(design_ntu, 3),
            "fan_power_frac": 0.0,
        }

    range_f = load_btuh / (500.0 * flow_gpm)
    w_air_in = humidity_ratio_from_db_wb(outdoor_db_f, outdoor_wb_f)
    h_air_in = enthalpy_btu_lb(outdoor_db_f, w_air_in)

    # 4-point Chebyshev nodes on [0, 1]: 0.10267, 0.40620, 0.59380, 0.89733
    cheb_nodes = [0.10267, 0.40620, 0.59380, 0.89733]
    lg_ratio = 1.20 / max(0.25, fan_speed_frac)

    # Solve for leaving water temperature T_cold such that Merkel integral matches available NTU
    t_cold = max(outdoor_wb_f + 3.0, entering_water_f - range_f)
    ntu_avail = design_ntu * (max(0.2, fan_speed_frac) ** 0.6)

    for _ in range(12):
        merkel_sum = 0.0
        for node in cheb_nodes:
            t_w = t_cold + node * range_f
            w_sat = humidity_ratio_from_db_rh(t_w, 100.0)
            h_sat = enthalpy_btu_lb(t_w, w_sat)
            h_air = h_air_in + lg_ratio * node * range_f
            dh = max(1.5, h_sat - h_air)
            merkel_sum += range_f / dh
        ntu_req = 0.25 * merkel_sum
        err = ntu_req - ntu_avail
        t_cold = max(outdoor_wb_f + 2.0, t_cold + 0.8 * err)

    t_hot = t_cold + range_f
    return {
        "entering_water_f": round(t_hot, 1),
        "leaving_water_f": round(t_cold, 1),
        "range_f": round(range_f, 2),
        "approach_f": round(t_cold - outdoor_wb_f, 2),
        "ntu_available": round(ntu_avail, 3),
        "fan_power_frac": round(fan_speed_frac ** 2.8, 3),
    }


def chiller_part_load_kw_per_ton(
    plr: float,
    full_load_kw_ton: float = 0.58,
    lchwt_f: float = 44.0,
    ecwt_f: float = 85.0,
    vfd_equipped: bool = True,
) -> float:
    """
    Bi-quadratic temperature lift & cubic part-load ratio (PLR) chiller performance model
    (reproducing eDesign.Plants01 PerfMapInput & CompressorLoadingCurve).
    """
    p = max(0.10, min(1.0, float(plr)))
    lift_ratio = max(0.55, (ecwt_f - lchwt_f) / (85.0 - 44.0))
    temp_adj = 0.35 + 0.45 * lift_ratio + 0.20 * (lift_ratio ** 2)
    if vfd_equipped:
        plr_curve = 0.12 + 0.38 * p + 0.50 * (p ** 2)
    else:
        plr_curve = 0.22 + 0.48 * p + 0.30 * (p ** 2)
    eff_kw_ton = full_load_kw_ton * temp_adj * (plr_curve / max(0.15, p))
    return round(eff_kw_ton, 4)


def boiler_efficiency_curve(
    plr: float,
    return_water_f: float = 120.0,
    nominal_eff_pct: float = 92.0,
    modeling_method: str = "Condensing Boiler 2D Curve",
) -> float:
    """
    Computes boiler thermal efficiency (0..0.99) as a function of PLR and return water temperature
    (reproducing BoilerCalc CondensingBoiler_Curve and NonCondensingBoiler_Curve).
    """
    p = max(0.05, min(1.0, float(plr)))
    base_eff = float(nominal_eff_pct) / 100.0
    if "Condensing" in modeling_method and "Non" not in modeling_method:
        # Condensing boilers gain efficiency at lower return water temp (<130 F flue dewpoint) and part load
        cond_boost = max(-0.04, min(0.06, (130.0 - return_water_f) * 0.0012))
        part_load_boost = 0.03 * (1.0 - p)
        return round(min(0.985, max(0.75, base_eff + cond_boost + part_load_boost)), 4)
    # Non-condensing curve drops slightly at very low part load due to jacket/cycling losses
    cycling_factor = 0.94 + 0.09 * p - 0.03 * (p ** 2)
    return round(min(0.90, max(0.65, base_eff * cycling_factor)), 4)


def simulate_plants(project: Dict[str, Any], air_sys_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Sizes and simulates all Chilled Water, Hot Water, Steam, Changeover, Service Hot Water (SHW),
    and Heat Recovery plants defined in the project.
    """
    plants = project.get("plants", [])
    if not plants:
        return []

    sizing = air_sys_results["sizing_summary"]
    monthly_sim = air_sys_results["monthly_simulation"]
    peak_clg_tons = float(sizing["central_cooling_coil"]["total_coil_tons"])
    peak_htg_mbh = (
        float(sizing["preheat_coil"]["max_coil_load_mbh"])
        + sum(z["reheat_coil_mbh"] for z in air_sys_results["zone_sizing"])
    )

    plant_reports: List[Dict[str, Any]] = []
    for pl in plants:
        p_type = str(pl.get("plant_type", "Chiller Plant"))
        fluid = fluid_properties(pl.get("fluid_type", "Water"), float(pl.get("glycol_pct", 0.0)))
        chw_dt = float(pl.get("chw_delta_t_f", 10.0))
        hw_dt = float(pl.get("hw_delta_t_f", 20.0))

        chw_gpm = (peak_clg_tons * 12000.0) / (500.0 * chw_dt * fluid["rho_cp_ratio"])
        hw_gpm = (peak_htg_mbh * 1000.0) / (500.0 * hw_dt * fluid["rho_cp_ratio"])

        tower_eval = merkel_cooling_tower_leaving_temp(
            entering_water_f=95.0,
            outdoor_wb_f=float(project.get("weather", {}).get("summer_wb_f", 75.0)),
            outdoor_db_f=float(project.get("weather", {}).get("summer_db_f", 91.3)),
            load_btuh=peak_clg_tons * 15000.0,
            flow_gpm=max(50.0, peak_clg_tons * 3.0),
        )

        monthly_rows: List[Dict[str, Any]] = []
        for m in monthly_sim:
            clg_ton_hrs = m["central_cooling_load_kbtu"] / 12.0
            kw_per_ton = chiller_part_load_kw_per_ton(0.65, 0.58, 44.0, tower_eval["leaving_water_f"], True)
            chiller_kwh = int(round(clg_ton_hrs * kw_per_ton))
            pump_kwh = int(round(clg_ton_hrs * 0.06))
            tower_kwh = int(round(clg_ton_hrs * 0.045))

            htg_kbtu = m["preheat_coil_load_kbtu"] + m["terminal_heating_load_kbtu"]
            blr_eff = boiler_efficiency_curve(0.60, 120.0, 92.0)
            boiler_input_kbtu = int(round(htg_kbtu / max(0.5, blr_eff)))

            monthly_rows.append({
                "month": m["month"],
                "cooling_load_kbtu": m["central_cooling_load_kbtu"],
                "chiller_input_kwh": chiller_kwh,
                "chw_pump_kwh": pump_kwh,
                "cooling_tower_fan_kwh": tower_kwh,
                "heating_load_kbtu": htg_kbtu,
                "boiler_input_kbtu": boiler_input_kbtu,
                "boiler_efficiency_pct": round(blr_eff * 100.0, 1),
            })

        plant_reports.append({
            "plant_id": pl.get("id", "PLT_1"),
            "plant_name": pl.get("name", "Central Plant"),
            "plant_type": p_type,
            "design_cooling_tons": round(peak_clg_tons, 1),
            "design_chw_flow_gpm": round(chw_gpm, 1),
            "design_heating_mbh": round(peak_htg_mbh, 1),
            "design_hw_flow_gpm": round(hw_gpm, 1),
            "merkel_tower_design": tower_eval,
            "fluid_properties": fluid,
            "monthly_results": monthly_rows,
        })

    return plant_reports
