"""
ASHRAE Psychrometric Engine & 21-State-Point System Psychrometric Analyzer.
Reproduces eDesign.Core01.Psychrometrics / StandardPsychrometrics and HAPCore64 Airflows.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
import math
from typing import Dict, List, Optional, Tuple


def barometric_pressure_psia(elevation_ft: float) -> float:
    """
    ASHRAE Fundamentals barometric pressure (psia) as a function of elevation Z (ft):
    P_atm = 14.696 * (1 - 6.8753e-6 * Z) ** 5.2559
    """
    z = max(-1000.0, min(30000.0, float(elevation_ft)))
    return 14.696 * ((1.0 - 6.8753e-6 * z) ** 5.2559)


def air_heat_factors(elevation_ft: float = 0.0) -> Tuple[float, float]:
    """
    Returns altitude-corrected (CSf, CLf) = (rho_cp_k, rho_hfg_k) in IP units:
      CSf = 1.085 * (P_atm / 14.696)  [BTU/(hr * CFM * F)]
      CLf = 4840.0 * (P_atm / 14.696) [BTU/(hr * CFM * lb_w/lb_da)]
    """
    p_ratio = barometric_pressure_psia(elevation_ft) / 14.696
    return 1.085 * p_ratio, 4840.0 * p_ratio


def saturation_vapor_pressure_psia(t_f: float) -> float:
    """
    ASHRAE Hyland-Wexler saturation vapor pressure P_ws (psia) for dry-bulb temp in °F.
    """
    t_r = float(t_f) + 459.67
    t_r = max(350.0, min(860.0, t_r))
    if t_f < 32.0:
        # Over ice
        c1 = -1.0214165e4
        c2 = -4.8932428e0
        c3 = -5.3765794e-3
        c4 = 1.9202377e-7
        c5 = 3.5575832e-10
        c6 = -9.0344688e-14
        c7 = 4.1635019e0
        ln_pws = c1 / t_r + c2 + c3 * t_r + c4 * (t_r ** 2) + c5 * (t_r ** 3) + c6 * (t_r ** 4) + c7 * math.log(t_r)
    else:
        # Over liquid water
        c8 = -1.0440397e4
        c9 = -1.1294650e1
        c10 = -2.7022355e-2
        c11 = 1.2890360e-5
        c12 = -2.4780681e-9
        c13 = 6.5459673e0
        ln_pws = c8 / t_r + c9 + c10 * t_r + c11 * (t_r ** 2) + c12 * (t_r ** 3) + c13 * math.log(t_r)
    return math.exp(ln_pws)


def humidity_ratio_from_pw(pw_psia: float, p_atm_psia: float) -> float:
    """W = 0.621945 * P_w / (P_atm - P_w) in lb_water / lb_dry_air."""
    pw = max(0.0, min(pw_psia, p_atm_psia * 0.98))
    return 0.621945 * pw / (p_atm_psia - pw)


def humidity_ratio_from_db_wb(t_db_f: float, t_wb_f: float, p_atm_psia: float = 14.696) -> float:
    """
    ASHRAE equation for humidity ratio W (lb_w/lb_da) given dry-bulb (°F), wet-bulb (°F), and pressure (psia).
    """
    wb = min(float(t_db_f), float(t_wb_f))
    db = float(t_db_f)
    pws_wb = saturation_vapor_pressure_psia(wb)
    ws_wb = humidity_ratio_from_pw(pws_wb, p_atm_psia)

    if wb >= 32.0:
        num = (1093.0 - 0.556 * wb) * ws_wb - 0.240 * (db - wb)
        den = 1093.0 + 0.444 * db - wb
    else:
        num = (1220.0 - 0.04 * wb) * ws_wb - 0.240 * (db - wb)
        den = 1220.0 + 0.444 * db - 0.48 * wb
    w = num / max(1e-6, den)
    return max(1e-6, w)


def humidity_ratio_from_db_rh(t_db_f: float, rh_pct: float, p_atm_psia: float = 14.696) -> float:
    """Computes humidity ratio W (lb_w/lb_da) from dry-bulb (°F) and relative humidity (0..100%)."""
    phi = max(0.001, min(1.0, float(rh_pct) / 100.0))
    pws = saturation_vapor_pressure_psia(t_db_f)
    pw = phi * pws
    return humidity_ratio_from_pw(pw, p_atm_psia)


def relative_humidity_from_db_w(t_db_f: float, w: float, p_atm_psia: float = 14.696) -> float:
    """Returns relative humidity (%) from dry-bulb (°F) and humidity ratio W (lb_w/lb_da)."""
    w_clamped = max(1e-6, float(w))
    pw = p_atm_psia * w_clamped / (0.621945 + w_clamped)
    pws = saturation_vapor_pressure_psia(t_db_f)
    return max(0.0, min(100.0, 100.0 * pw / max(1e-9, pws)))


def dew_point_from_w(t_db_f: float, w: float, p_atm_psia: float = 14.696) -> float:
    """Computes dew-point temperature (°F) from humidity ratio W (lb_w/lb_da)."""
    w_clamped = max(1e-6, float(w))
    pw = max(1e-5, p_atm_psia * w_clamped / (0.621945 + w_clamped))
    alpha = math.log(pw)
    if t_db_f >= 32.0:
        tdp = 100.45 + 33.193 * alpha + 2.319 * (alpha ** 2) + 0.17074 * (alpha ** 3) + 1.2063 * (pw ** 0.1984)
    else:
        tdp = 90.12 + 26.142 * alpha + 0.8927 * (alpha ** 2)
    return min(float(t_db_f), tdp)


def enthalpy_btu_lb(t_db_f: float, w: float) -> float:
    """Moist air specific enthalpy h in BTU/lb_da."""
    return 0.240 * float(t_db_f) + float(w) * (1061.0 + 0.444 * float(t_db_f))


def specific_volume_cuft_lb(t_db_f: float, w: float, p_atm_psia: float = 14.696) -> float:
    """Specific volume v in ft³/lb_da."""
    return 0.370486 * (float(t_db_f) + 459.67) * (1.0 + 1.607858 * float(w)) / max(1.0, p_atm_psia)


def wet_bulb_from_db_w(t_db_f: float, w: float, p_atm_psia: float = 14.696) -> float:
    """Solves wet-bulb temperature (°F) from dry-bulb (°F) and humidity ratio W via Newton-Raphson."""
    db = float(t_db_f)
    target_w = max(1e-6, float(w))
    tdp = dew_point_from_w(db, target_w, p_atm_psia)
    wb = 0.5 * (db + tdp)
    for _ in range(18):
        f = humidity_ratio_from_db_wb(db, wb, p_atm_psia) - target_w
        if abs(f) < 1e-6:
            break
        df = (humidity_ratio_from_db_wb(db, wb + 0.05, p_atm_psia) - f - target_w) / 0.05
        if abs(df) < 1e-9:
            break
        wb = max(-60.0, min(db, wb - f / df))
    return min(db, wb)


@dataclass
class PsychState:
    name: str
    cfm: float
    db_f: float
    wb_f: float
    dp_f: float
    rh_pct: float
    w_lb_lb: float
    w_grains_lb: float
    h_btu_lb: float
    v_cuft_lb: float
    p_atm_psia: float

    @classmethod
    def from_db_wb(cls, name: str, cfm: float, db_f: float, wb_f: float, elevation_ft: float = 0.0) -> "PsychState":
        p_atm = barometric_pressure_psia(elevation_ft)
        wb_c = min(db_f, wb_f)
        w = humidity_ratio_from_db_wb(db_f, wb_c, p_atm)
        rh = relative_humidity_from_db_w(db_f, w, p_atm)
        dp = dew_point_from_w(db_f, w, p_atm)
        h = enthalpy_btu_lb(db_f, w)
        v = specific_volume_cuft_lb(db_f, w, p_atm)
        return cls(
            name=name,
            cfm=round(cfm, 1),
            db_f=round(db_f, 2),
            wb_f=round(wb_c, 2),
            dp_f=round(dp, 2),
            rh_pct=round(rh, 1),
            w_lb_lb=round(w, 6),
            w_grains_lb=round(w * 7000.0, 1),
            h_btu_lb=round(h, 2),
            v_cuft_lb=round(v, 2),
            p_atm_psia=round(p_atm, 3),
        )

    @classmethod
    def from_db_w(cls, name: str, cfm: float, db_f: float, w_lb_lb: float, elevation_ft: float = 0.0) -> "PsychState":
        p_atm = barometric_pressure_psia(elevation_ft)
        w_max = humidity_ratio_from_db_rh(db_f, 99.0, p_atm)
        w = max(1e-6, min(w_lb_lb, w_max))
        wb = wet_bulb_from_db_w(db_f, w, p_atm)
        rh = relative_humidity_from_db_w(db_f, w, p_atm)
        dp = dew_point_from_w(db_f, w, p_atm)
        h = enthalpy_btu_lb(db_f, w)
        v = specific_volume_cuft_lb(db_f, w, p_atm)
        return cls(
            name=name,
            cfm=round(cfm, 1),
            db_f=round(db_f, 2),
            wb_f=round(wb, 2),
            dp_f=round(dp, 2),
            rh_pct=round(rh, 1),
            w_lb_lb=round(w, 6),
            w_grains_lb=round(w * 7000.0, 1),
            h_btu_lb=round(h, 2),
            v_cuft_lb=round(v, 2),
            p_atm_psia=round(p_atm, 3),
        )

    @classmethod
    def from_db_rh(cls, name: str, cfm: float, db_f: float, rh_pct: float, elevation_ft: float = 0.0) -> "PsychState":
        p_atm = barometric_pressure_psia(elevation_ft)
        w = humidity_ratio_from_db_rh(db_f, rh_pct, p_atm)
        return cls.from_db_w(name, cfm, db_f, w, elevation_ft)

    def to_dict(self) -> Dict[str, float | str]:
        return asdict(self)


def mix_air_streams(name: str, s1: PsychState, s2: PsychState, elevation_ft: float = 0.0) -> PsychState:
    """Adiabatic mixing of two moist air streams."""
    total_cfm = s1.cfm + s2.cfm
    if total_cfm <= 1e-6:
        return PsychState.from_db_w(name, 0.0, s1.db_f, s1.w_lb_lb, elevation_ft)
    f1 = s1.cfm / total_cfm
    f2 = s2.cfm / total_cfm
    db_mix = f1 * s1.db_f + f2 * s2.db_f
    w_mix = f1 * s1.w_lb_lb + f2 * s2.w_lb_lb
    return PsychState.from_db_w(name, total_cfm, db_mix, w_mix, elevation_ft)


def cooling_coil_leaving_state(
    name: str,
    entering: PsychState,
    leaving_db_f: float,
    zone_Sensible_btuh: float,
    zone_Latent_btuh: float,
    elevation_ft: float = 0.0,
    bypass_factor: float = 0.06,
) -> Tuple[PsychState, float, float, float]:
    """
    Computes leaving coil psychrometric state, sensible coil load (BTU/h),
    latent coil load (BTU/h), and total coil load (BTU/h).
    Accounts for apparatus dewpoint / coil bypass factor (BF ~ 0.05-0.08) so leaving WB is slightly below leaving DB.
    """
    csf, clf = air_heat_factors(elevation_ft)
    cfm = max(1.0, entering.cfm)
    sens_coil_btuh = csf * cfm * (entering.db_f - leaving_db_f)

    # Leaving humidity ratio determined by coil dehumidification line toward saturation at ADP
    p_atm = barometric_pressure_psia(elevation_ft)
    adp_f = leaving_db_f - (entering.db_f - leaving_db_f) * (bypass_factor / max(0.01, 1.0 - bypass_factor))
    adp_f = max(35.0, min(leaving_db_f - 0.3, adp_f))
    w_adp = humidity_ratio_from_db_rh(adp_f, 98.5, p_atm)
    w_lvg_coil = w_adp + bypass_factor * (entering.w_lb_lb - w_adp)
    w_lvg = min(entering.w_lb_lb, w_lvg_coil)

    lat_coil_btuh = max(0.0, clf * cfm * (entering.w_lb_lb - w_lvg))
    tot_coil_btuh = sens_coil_btuh + lat_coil_btuh
    lvg_state = PsychState.from_db_w(name, cfm, leaving_db_f, w_lvg, elevation_ft)
    return lvg_state, sens_coil_btuh, lat_coil_btuh, tot_coil_btuh
