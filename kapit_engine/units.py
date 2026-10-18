"""
Unit Conversion System & Inline Expression Evaluator for Kapit.
Reproduces eDesign.Core01 UnitsOfMeasure, LocalizedConversions, UnitControls20 modCalc,
and architectural feet-and-inches parsing (e.g., 3' 6", 12', 5'4"3/4 <-> mm/m).
"""

from __future__ import annotations
import ast
import math
import operator
import re
from typing import Any, Dict, Tuple, Union


# Supported safe operators for inline calculator (modCalc equivalent)
_SAFE_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.BitXor: operator.pow,  # Support '^' as exponentiation like HAP modCalc
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def evaluate_inline_expression(expr: Union[str, float, int]) -> float:
    """
    Evaluates mathematical expressions entered into numeric fields (+, -, *, /, ^)
    or architectural feet-inches strings (e.g., "3' 6\"", "12'", "2' 6\"").
    """
    if isinstance(expr, (int, float)):
        return float(expr)
    text = str(expr).strip()
    if not text:
        return 0.0

    # Check for architectural feet-and-inches notation: e.g., 3' 6", 6' 10", 5'4"3/4
    if "'" in text or '"' in text:
        return parse_architectural_feet_inches(text)

    # Replace comma decimal if no dot is present
    if "," in text and "." not in text:
        text = text.replace(",", ".")
    else:
        text = text.replace(",", "")

    # Replace ^ with ** for Python AST evaluation
    text_expr = text.replace("^", "**")

    try:
        return float(text_expr)
    except ValueError:
        pass

    def _eval_node(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval_node(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in _SAFE_OPS:
            left = _eval_node(node.left)
            right = _eval_node(node.right)
            return float(_SAFE_OPS[type(node.op)](left, right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in _SAFE_OPS:
            return float(_SAFE_OPS[type(node.op)](_eval_node(node.operand)))
        raise ValueError(f"Unsupported expression syntax: {expr}")

    tree = ast.parse(text_expr, mode="eval")
    return _eval_node(tree)


def parse_architectural_feet_inches(text: str) -> float:
    """
    Parses architectural feet-and-inches strings into decimal feet:
    Examples:
      "12'" -> 12.0
      "3' 6\"" -> 3.5
      "2' 6\"" -> 2.5
      "6' 10\"" -> 6.833333333333333
      "5'4\"3/4" -> 5.395833333333333
    """
    s = text.strip()
    sign = -1.0 if s.startswith("-") else 1.0
    s = s.lstrip("+-").strip()

    feet = 0.0
    inches = 0.0

    if "'" in s:
        parts = s.split("'", 1)
        feet = float(parts[0].strip() or 0.0)
        rem = parts[1].strip()
    else:
        rem = s

    if rem:
        rem = rem.replace('"', " ").strip()
        tokens = [t for t in rem.split() if t]
        for tok in tokens:
            if "/" in tok:
                num, den = tok.split("/", 1)
                inches += float(num) / float(den)
            else:
                inches += float(tok)

    return sign * (feet + inches / 12.0)


def format_architectural_feet_inches(decimal_feet: float) -> str:
    """Formats decimal feet as architectural feet and inches (e.g., 3.5 -> 3' 6\")."""
    sign = "-" if decimal_feet < 0 else ""
    val = abs(decimal_feet)
    total_inches = round(val * 12.0, 2)
    ft = int(total_inches // 12)
    inch = total_inches - ft * 12
    if abs(inch - round(inch)) < 1e-2:
        inch_int = int(round(inch))
        if inch_int == 12:
            ft += 1
            inch_int = 0
        if inch_int == 0:
            return f"{sign}{ft}'"
        return f"{sign}{ft}' {inch_int}\""
    return f"{sign}{ft}' {inch:.1f}\""


# Conversion registry: (category: (ip_label, si_label, factor_ip_to_si, offset_ip_to_si, precision_ip, precision_si))
# Value_SI = (Value_IP + offset_pre) * factor
UNIT_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "temperature": {
        "ip_unit": "F",
        "si_unit": "C",
        "to_si": lambda f: (f - 32.0) * 5.0 / 9.0,
        "to_ip": lambda c: c * 9.0 / 5.0 + 32.0,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "delta_temperature": {
        "ip_unit": "F",
        "si_unit": "K",
        "to_si": lambda df: df * 5.0 / 9.0,
        "to_ip": lambda dc: dc * 9.0 / 5.0,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "length_ft_m": {
        "ip_unit": "ft",
        "si_unit": "m",
        "to_si": lambda ft: ft * 0.3048,
        "to_ip": lambda m: m / 0.3048,
        "ip_prec": 1,
        "si_prec": 2,
    },
    "length_in_mm": {
        "ip_unit": "in",
        "si_unit": "mm",
        "to_si": lambda inch: inch * 25.4,
        "to_ip": lambda mm: mm / 25.4,
        "ip_prec": 3,
        "si_prec": 1,
    },
    "area": {
        "ip_unit": "sqft",
        "si_unit": "m²",
        "to_si": lambda sqft: sqft * 0.09290304,
        "to_ip": lambda sqm: sqm / 0.09290304,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "volume": {
        "ip_unit": "cuft",
        "si_unit": "m³",
        "to_si": lambda cuft: cuft * 0.0283168466,
        "to_ip": lambda cum: cum / 0.0283168466,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "airflow": {
        "ip_unit": "CFM",
        "si_unit": "L/s",
        "to_si": lambda cfm: cfm * 0.47194745,
        "to_ip": lambda ls: ls / 0.47194745,
        "ip_prec": 0,
        "si_prec": 1,
    },
    "airflow_per_area": {
        "ip_unit": "CFM/sqft",
        "si_unit": "L/s/m²",
        "to_si": lambda v: v * 5.08,
        "to_ip": lambda v: v / 5.08,
        "ip_prec": 2,
        "si_prec": 2,
    },
    "airflow_per_person": {
        "ip_unit": "CFM/person",
        "si_unit": "L/s/person",
        "to_si": lambda v: v * 0.47194745,
        "to_ip": lambda v: v / 0.47194745,
        "ip_prec": 2,
        "si_prec": 2,
    },
    "heat_btuh_w": {
        "ip_unit": "BTU/hr",
        "si_unit": "W",
        "to_si": lambda btuh: btuh * 0.29307107,
        "to_ip": lambda w: w / 0.29307107,
        "ip_prec": 0,
        "si_prec": 0,
    },
    "heat_mbh_kw": {
        "ip_unit": "MBH",
        "si_unit": "kW",
        "to_si": lambda mbh: mbh * 0.29307107,
        "to_ip": lambda kw: kw / 0.29307107,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "cooling_tons_kw": {
        "ip_unit": "Tons",
        "si_unit": "kW",
        "to_si": lambda tons: tons * 3.51685284,
        "to_ip": lambda kw: kw / 3.51685284,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "energy_kbtu_kwh": {
        "ip_unit": "kBTU",
        "si_unit": "kWh",
        "to_si": lambda kbtu: kbtu * 0.29307107,
        "to_ip": lambda kwh: kwh / 0.29307107,
        "ip_prec": 0,
        "si_prec": 0,
    },
    "u_value": {
        "ip_unit": "BTU/(hr·sqft·F)",
        "si_unit": "W/(m²·K)",
        "to_si": lambda u: u * 5.6782633,
        "to_ip": lambda u: u / 5.6782633,
        "ip_prec": 3,
        "si_prec": 3,
    },
    "r_value": {
        "ip_unit": "(hr·sqft·F)/BTU",
        "si_unit": "(m²·K)/W",
        "to_si": lambda r: r / 5.6782633,
        "to_ip": lambda r: r * 5.6782633,
        "ip_prec": 5,
        "si_prec": 4,
    },
    "density": {
        "ip_unit": "lb/cuft",
        "si_unit": "kg/m³",
        "to_si": lambda d: d * 16.018463,
        "to_ip": lambda d: d / 16.018463,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "specific_heat": {
        "ip_unit": "BTU/(lb·F)",
        "si_unit": "kJ/(kg·K)",
        "to_si": lambda cp: cp * 4.1868,
        "to_ip": lambda cp: cp / 4.1868,
        "ip_prec": 2,
        "si_prec": 2,
    },
    "surface_weight": {
        "ip_unit": "lb/sqft",
        "si_unit": "kg/m²",
        "to_si": lambda w: w * 4.8824276,
        "to_ip": lambda w: w / 4.8824276,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "power_density": {
        "ip_unit": "W/sqft",
        "si_unit": "W/m²",
        "to_si": lambda p: p / 0.09290304,
        "to_ip": lambda p: p * 0.09290304,
        "ip_prec": 2,
        "si_prec": 2,
    },
    "solar_flux": {
        "ip_unit": "BTU/(hr·sqft)",
        "si_unit": "W/m²",
        "to_si": lambda f: f * 3.15459075,
        "to_ip": lambda f: f / 3.15459075,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "water_flow": {
        "ip_unit": "gpm",
        "si_unit": "L/s",
        "to_si": lambda gpm: gpm * 0.0630902,
        "to_ip": lambda ls: ls / 0.0630902,
        "ip_prec": 1,
        "si_prec": 2,
    },
    "static_pressure": {
        "ip_unit": "in wg",
        "si_unit": "Pa",
        "to_si": lambda inwg: inwg * 248.84,
        "to_ip": lambda pa: pa / 248.84,
        "ip_prec": 2,
        "si_prec": 0,
    },
    "water_head": {
        "ip_unit": "ft H2O",
        "si_unit": "kPa",
        "to_si": lambda ft: ft * 2.9890669,
        "to_ip": lambda kpa: kpa / 2.9890669,
        "ip_prec": 1,
        "si_prec": 1,
    },
    "enthalpy": {
        "ip_unit": "BTU/lb",
        "si_unit": "kJ/kg",
        "to_si": lambda h: h * 2.326,
        "to_ip": lambda h: h / 2.326,
        "ip_prec": 2,
        "si_prec": 2,
    },
    "humidity_ratio": {
        "ip_unit": "grains/lb",
        "si_unit": "g/kg",
        "to_si": lambda gr: gr / 7.0,
        "to_ip": lambda gkg: gkg * 7.0,
        "ip_prec": 1,
        "si_prec": 2,
    },
}


def convert_value(value: float, quantity_type: str, to_system: str = "IP") -> Tuple[float, str]:
    """
    Converts an internal IP value to the target unit system ('IP' or 'SI').
    All internal engine storage follows HAP convention (English IP base units).
    """
    defn = UNIT_DEFINITIONS.get(quantity_type)
    if not defn:
        return value, ""
    if to_system.upper() == "SI":
        conv = defn["to_si"](value)
        return round(conv, defn["si_prec"]), defn["si_unit"]
    return round(value, defn["ip_prec"]), defn["ip_unit"]


def convert_from_user(value: float, quantity_type: str, from_system: str = "IP") -> float:
    """Converts a user-supplied value in 'IP' or 'SI' to internal IP base units."""
    defn = UNIT_DEFINITIONS.get(quantity_type)
    if not defn or from_system.upper() == "IP":
        return float(value)
    return float(defn["to_ip"](value))
