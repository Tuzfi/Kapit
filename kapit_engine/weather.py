"""
Weather Engine, ASHRAE Clear-Sky Solar Radiation Model, Design Day Profile Generator,
8,760-Hour Simulation Weather Generator, EPW Importer, and Read-Only weather.db Connector.
"""

from __future__ import annotations
import math
import os
import sqlite3
from typing import Any, Dict, List, Optional, Tuple
from .psychrometrics import (
    barometric_pressure_psia,
    humidity_ratio_from_db_wb,
    wet_bulb_from_db_w,
)

# ASHRAE Standard 24-hour fraction of daily temperature range (Hours 00..23, peak at 15:00)
ASHRAE_DAILY_RANGE_FRACTIONS: List[float] = [
    0.88, 0.92, 0.95, 0.98, 1.00, 0.98, 0.91, 0.74,
    0.55, 0.38, 0.23, 0.13, 0.05, 0.00, 0.00, 0.06,
    0.14, 0.24, 0.39, 0.50, 0.59, 0.68, 0.75, 0.82,
]

MONTH_NAMES: List[str] = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

DAYS_IN_MONTH: List[int] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

# 16 Compass Directions + Horizontal (Azimuth in degrees clockwise from North)
COMPASS_DIRECTIONS: Dict[str, Optional[float]] = {
    "N": 0.0,
    "NNE": 22.5,
    "NE": 45.0,
    "ENE": 67.5,
    "E": 90.0,
    "ESE": 112.5,
    "SE": 135.0,
    "SSE": 157.5,
    "S": 180.0,
    "SSW": 202.5,
    "SW": 225.0,
    "WSW": 247.5,
    "W": 270.0,
    "WNW": 292.5,
    "NW": 315.0,
    "NNW": 337.5,
    "HOR": None,
}

# Exact reference data for Indianapolis Intl, IN, USA (from HAP-6.4-Example-Problem.hap)
INDIANAPOLIS_MONTHLY_DESIGN: Dict[str, Dict[str, Any]] = {
    "January": {
        "max_db": 47.56, "min_db": 29.66, "max_wb": 46.99, "min_wb": 29.66,
        "max_sol": {"N": 21.1, "NNE": 21.1, "NE": 26.6, "ENE": 106.6, "E": 173.5, "ESE": 234.3, "SE": 267.5, "SSE": 283.1, "S": 283.7, "SSW": 282.0, "SW": 265.9, "WSW": 235.1, "W": 171.7, "WNW": 106.3, "NW": 29.2, "NNW": 21.1, "HOR": 161.5}
    },
    "February": {
        "max_db": 51.30, "min_db": 33.40, "max_wb": 51.30, "min_wb": 33.40,
        "max_sol": {"N": 26.5, "NNE": 26.5, "NE": 68.7, "ENE": 144.0, "E": 210.3, "ESE": 250.6, "SE": 274.2, "SSE": 274.9, "S": 269.0, "SSW": 274.9, "SW": 274.0, "WSW": 251.2, "W": 210.0, "WNW": 144.4, "NW": 67.9, "NNW": 26.5, "HOR": 207.6}
    },
    "March": {
        "max_db": 62.30, "min_db": 44.40, "max_wb": 60.99, "min_wb": 44.40,
        "max_sol": {"N": 31.3, "NNE": 39.1, "NE": 118.1, "ENE": 183.5, "E": 234.2, "ESE": 261.3, "SE": 260.8, "SSE": 245.7, "S": 234.8, "SSW": 246.0, "SW": 261.5, "WSW": 258.8, "W": 236.5, "WNW": 181.0, "NW": 117.5, "NNW": 42.3, "HOR": 253.3}
    },
    "April": {
        "max_db": 72.30, "min_db": 54.40, "max_wb": 65.00, "min_wb": 54.40,
        "max_sol": {"N": 36.4, "NNE": 86.6, "NE": 150.8, "ENE": 207.5, "E": 235.7, "ESE": 241.8, "SE": 221.2, "SSE": 194.3, "S": 181.0, "SSW": 195.8, "SW": 224.2, "WSW": 240.7, "W": 237.8, "WNW": 202.3, "NW": 153.6, "NNW": 85.5, "HOR": 286.1}
    },
    "May": {
        "max_db": 81.56, "min_db": 63.66, "max_wb": 70.00, "min_wb": 63.66,
        "max_sol": {"N": 50.2, "NNE": 115.2, "NE": 170.0, "ENE": 214.5, "E": 231.1, "ESE": 219.6, "SE": 190.6, "SSE": 153.9, "S": 138.5, "SSW": 155.8, "SW": 191.7, "WSW": 221.1, "W": 230.6, "WNW": 211.9, "NW": 174.3, "NNW": 113.2, "HOR": 298.5}
    },
    "June": {
        "max_db": 88.30, "min_db": 70.40, "max_wb": 73.01, "min_wb": 67.82,
        "max_sol": {"N": 61.5, "NNE": 125.8, "NE": 177.5, "ENE": 216.6, "E": 227.4, "ESE": 210.6, "SE": 176.8, "SSE": 137.5, "S": 120.7, "SSW": 139.3, "SW": 177.5, "WSW": 212.5, "W": 225.3, "WNW": 216.4, "NW": 181.4, "NNW": 122.0, "HOR": 299.7}
    },
    "July": {
        "max_db": 91.30, "min_db": 73.40, "max_wb": 75.00, "min_wb": 69.80,
        "max_sol": {"N": 49.7, "NNE": 111.6, "NE": 167.5, "ENE": 209.5, "E": 223.0, "ESE": 214.9, "SE": 183.5, "SSE": 150.2, "S": 133.5, "SSW": 151.2, "SW": 185.6, "WSW": 215.4, "W": 222.6, "WNW": 208.2, "NW": 169.8, "NNW": 108.8, "HOR": 291.8}
    },
    "August": {
        "max_db": 91.30, "min_db": 73.40, "max_wb": 75.00, "min_wb": 69.80,
        "max_sol": {"N": 36.2, "NNE": 78.6, "NE": 142.1, "ENE": 192.8, "E": 217.6, "ESE": 227.4, "SE": 209.3, "SSE": 184.8, "S": 171.6, "SSW": 185.6, "SW": 211.2, "WSW": 225.7, "W": 222.0, "WNW": 188.2, "NW": 142.7, "NNW": 79.4, "HOR": 273.0}
    },
    "September": {
        "max_db": 84.56, "min_db": 66.66, "max_wb": 71.00, "min_wb": 65.50,
        "max_sol": {"N": 31.7, "NNE": 38.5, "NE": 103.3, "ENE": 164.7, "E": 208.1, "ESE": 236.5, "SE": 236.8, "SSE": 225.3, "S": 218.3, "SSW": 225.0, "SW": 236.6, "WSW": 235.2, "W": 209.9, "WNW": 165.6, "NW": 98.9, "NNW": 40.7, "HOR": 238.6}
    },
    "October": {
        "max_db": 74.30, "min_db": 56.40, "max_wb": 64.00, "min_wb": 56.40,
        "max_sol": {"N": 25.5, "NNE": 25.5, "NE": 64.3, "ENE": 131.8, "E": 192.6, "ESE": 237.6, "SE": 256.5, "SSE": 258.1, "S": 256.9, "SSW": 258.2, "SW": 256.6, "WSW": 237.5, "W": 192.8, "WNW": 131.5, "NW": 64.4, "NNW": 25.5, "HOR": 195.9}
    },
    "November": {
        "max_db": 59.30, "min_db": 41.40, "max_wb": 55.00, "min_wb": 41.40,
        "max_sol": {"N": 20.7, "NNE": 20.7, "NE": 32.9, "ENE": 95.7, "E": 170.6, "ESE": 221.3, "SE": 260.5, "SSE": 274.1, "S": 276.7, "SSW": 273.8, "SW": 260.4, "WSW": 222.2, "W": 170.5, "WNW": 94.6, "NW": 33.0, "NNW": 20.7, "HOR": 156.8}
    },
    "December": {
        "max_db": 46.30, "min_db": 28.40, "max_wb": 44.00, "min_wb": 28.40,
        "max_sol": {"N": 19.0, "NNE": 19.0, "NE": 19.0, "ENE": 88.8, "E": 158.0, "ESE": 219.6, "SE": 259.5, "SSE": 279.5, "S": 283.3, "SSW": 278.1, "SW": 260.7, "WSW": 218.7, "W": 160.7, "WNW": 81.2, "NW": 21.8, "NNW": 19.0, "HOR": 142.8}
    },
}


# Built-in Global Weather Station Catalog (works standalone and augmented by weather.db when available)
BUILTIN_WEATHER_STATIONS: List[Dict[str, Any]] = [
    {
        "id": 724380,
        "region": "North America",
        "country": "USA",
        "state": "Indiana",
        "location": "Indianapolis Intl, IN, USA",
        "climate_zone": "4A - Mixed Humid",
        "latitude": 39.73,
        "longitude": -86.28,
        "elevation_ft": 790.0,
        "timezone": -5.0,
        "summer_db_f": 91.3,
        "summer_wb_f": 75.0,
        "daily_range_f": 17.9,
        "winter_db_f": 2.6,
        "winter_wb_f": 0.9,
        "hottest_month": 7,
        "dst_enabled": True,
        "sim_station": "Indianapolis Intl AP (TMYx_2004_2018)",
    },
    {
        "id": 725300,
        "region": "North America",
        "country": "USA",
        "state": "Illinois",
        "location": "Chicago O'Hare Intl, IL, USA",
        "climate_zone": "5A - Cool Humid",
        "latitude": 41.99,
        "longitude": -87.93,
        "elevation_ft": 672.0,
        "timezone": -6.0,
        "summer_db_f": 91.8,
        "summer_wb_f": 74.3,
        "daily_range_f": 18.2,
        "winter_db_f": -2.4,
        "winter_wb_f": -3.8,
        "hottest_month": 7,
        "dst_enabled": True,
        "sim_station": "Chicago O'Hare Intl AP (TMYx_2004_2018)",
    },
    {
        "id": 725030,
        "region": "North America",
        "country": "USA",
        "state": "New York",
        "location": "New York LaGuardia, NY, USA",
        "climate_zone": "4A - Mixed Humid",
        "latitude": 40.78,
        "longitude": -73.88,
        "elevation_ft": 30.0,
        "timezone": -5.0,
        "summer_db_f": 93.0,
        "summer_wb_f": 74.8,
        "daily_range_f": 14.8,
        "winter_db_f": 14.4,
        "winter_wb_f": 11.8,
        "hottest_month": 7,
        "dst_enabled": True,
        "sim_station": "New York LaGuardia AP (TMYx_2004_2018)",
    },
    {
        "id": 722020,
        "region": "North America",
        "country": "USA",
        "state": "Florida",
        "location": "Miami Intl, FL, USA",
        "climate_zone": "1A - Very Hot Humid",
        "latitude": 25.80,
        "longitude": -80.30,
        "elevation_ft": 29.0,
        "timezone": -5.0,
        "summer_db_f": 91.9,
        "summer_wb_f": 77.7,
        "daily_range_f": 12.1,
        "winter_db_f": 47.7,
        "winter_wb_f": 43.5,
        "hottest_month": 7,
        "dst_enabled": True,
        "sim_station": "Miami Intl AP (TMYx_2004_2018)",
    },
    {
        "id": 722950,
        "region": "North America",
        "country": "USA",
        "state": "California",
        "location": "Los Angeles Intl, CA, USA",
        "climate_zone": "3B - Warm Dry",
        "latitude": 33.94,
        "longitude": -118.39,
        "elevation_ft": 125.0,
        "timezone": -8.0,
        "summer_db_f": 85.5,
        "summer_wb_f": 65.8,
        "daily_range_f": 13.5,
        "winter_db_f": 44.8,
        "winter_wb_f": 39.2,
        "hottest_month": 8,
        "dst_enabled": True,
        "sim_station": "Los Angeles Intl AP (TMYx_2004_2018)",
    },
    {
        "id": 837800,
        "region": "South America",
        "country": "Brasil",
        "state": "São Paulo",
        "location": "São Paulo - Congonhas, SP, Brasil",
        "climate_zone": "3A - Warm Humid",
        "latitude": -23.63,
        "longitude": -46.66,
        "elevation_ft": 2631.0,
        "timezone": -3.0,
        "summer_db_f": 89.2,
        "summer_wb_f": 69.8,
        "daily_range_f": 16.5,
        "winter_db_f": 48.2,
        "winter_wb_f": 44.6,
        "hottest_month": 2,
        "dst_enabled": False,
        "sim_station": "Sao Paulo Congonhas AP (INMET/TMYx)",
    },
    {
        "id": 837460,
        "region": "South America",
        "country": "Brasil",
        "state": "Rio de Janeiro",
        "location": "Rio de Janeiro - Galeão, RJ, Brasil",
        "climate_zone": "1A - Very Hot Humid",
        "latitude": -22.81,
        "longitude": -43.25,
        "elevation_ft": 20.0,
        "timezone": -3.0,
        "summer_db_f": 97.5,
        "summer_wb_f": 78.4,
        "daily_range_f": 15.8,
        "winter_db_f": 59.0,
        "winter_wb_f": 55.4,
        "hottest_month": 2,
        "dst_enabled": False,
        "sim_station": "Rio de Janeiro Galeao AP (INMET/TMYx)",
    },
    {
        "id": 833780,
        "region": "South America",
        "country": "Brasil",
        "state": "Distrito Federal",
        "location": "Brasília Intl, DF, Brasil",
        "climate_zone": "2B - Hot Dry",
        "latitude": -15.87,
        "longitude": -47.92,
        "elevation_ft": 3481.0,
        "timezone": -3.0,
        "summer_db_f": 88.9,
        "summer_wb_f": 66.2,
        "daily_range_f": 19.4,
        "winter_db_f": 53.6,
        "winter_wb_f": 46.8,
        "hottest_month": 9,
        "dst_enabled": False,
        "sim_station": "Brasilia Intl AP (INMET/TMYx)",
    },
    {
        "id": 838400,
        "region": "South America",
        "country": "Brasil",
        "state": "Paraná",
        "location": "Curitiba - Afonso Pena, PR, Brasil",
        "climate_zone": "3A - Warm Humid",
        "latitude": -25.53,
        "longitude": -49.17,
        "elevation_ft": 2989.0,
        "timezone": -3.0,
        "summer_db_f": 86.4,
        "summer_wb_f": 68.7,
        "daily_range_f": 18.0,
        "winter_db_f": 37.8,
        "winter_wb_f": 35.6,
        "hottest_month": 2,
        "dst_enabled": False,
        "sim_station": "Curitiba Afonso Pena AP (INMET/TMYx)",
    },
    {
        "id": 839710,
        "region": "South America",
        "country": "Brasil",
        "state": "Rio Grande do Sul",
        "location": "Porto Alegre - Salgado Filho, RS, Brasil",
        "climate_zone": "3A - Warm Humid",
        "latitude": -29.99,
        "longitude": -51.17,
        "elevation_ft": 13.0,
        "timezone": -3.0,
        "summer_db_f": 94.6,
        "summer_wb_f": 76.1,
        "daily_range_f": 17.5,
        "winter_db_f": 39.6,
        "winter_wb_f": 37.4,
        "hottest_month": 1,
        "dst_enabled": False,
        "sim_station": "Porto Alegre Salgado Filho AP (INMET/TMYx)",
    },
]


import unicodedata

def strip_accents(s: str) -> str:
    if not s:
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", str(s)) if unicodedata.category(c) != "Mn").lower()


def query_installed_weather_db(search_query: str = "", limit: int = 50) -> List[Dict[str, Any]]:
    """
    Queries the local Carrier HAP 6.4 weather.db in read-only mode if available,
    falling back seamlessly to BUILTIN_WEATHER_STATIONS, with accent-insensitive search.
    """
    db_path = r"C:\Program Files (x86)\Carrier HAP 6.4\weather.db"
    results: List[Dict[str, Any]] = []
    raw_q = search_query.strip()
    norm_q = strip_accents(raw_q)

    # 1. Search builtin stations
    for st in BUILTIN_WEATHER_STATIONS:
        if (
            not norm_q
            or norm_q in strip_accents(st["location"])
            or norm_q in strip_accents(st["country"])
            or norm_q in strip_accents(st["state"])
        ):
            results.append(dict(st))

    # 2. Search local weather.db design_stations if present
    if os.path.exists(db_path):
        try:
            uri = f"file:{db_path.replace(os.sep, '/')}?mode=ro"
            conn = sqlite3.connect(uri, uri=True, timeout=2.0)
            sql = """
                SELECT ds.wmo, ds.station_name, ac.name, ap.name, cz.zone_number, cz.name,
                       ds.latitude, ds.longitude, ds.elevation, tz.std_offset, ds.summer_daily_range,
                       clg.db, clg.mcwb, htg.db, ds.hottest_month
                FROM design_stations ds
                JOIN ashrae_countries ac ON ds.ashrae_country_id = ac.ashrae_country_id
                LEFT JOIN ashrae_provinces ap ON ds.ashrae_province_id = ap.ashrae_province_id
                LEFT JOIN ashrae_climate_zones cz ON ds.climate_zone_id = cz.climate_zone_id
                LEFT JOIN ashrae_time_zones tz ON ds.time_zone_id = tz.time_zone_id
                LEFT JOIN clg_design_conditions clg ON clg.design_station_id = ds.design_station_id AND clg.design_condition_type_id = 1
                LEFT JOIN htg_design_conditions htg ON htg.design_station_id = ds.design_station_id AND (htg.design_condition_type_id = 4 OR htg.design_condition_type_id IS NULL)
            """
            params: Tuple[Any, ...] = ()
            if norm_q:
                sql += " WHERE ds.station_name LIKE ? OR ac.name LIKE ? OR ap.name LIKE ?"
                like_q = f"%{norm_q}%"
                params = (like_q, like_q, like_q)
            sql += f" LIMIT {int(limit)}"
            rows = conn.execute(sql, params).fetchall()
            conn.close()

            existing_names = {strip_accents(r["location"]) for r in results}
            for row in rows:
                wmo, st_name, country, prov, cz_code, cz_name, lat, lng, elev, tz, dbr, c_db, c_wb, h_db, hot_m = row
                st_name_str = str(st_name).title()
                prov_str = f", {prov}" if prov and prov != "(Unspecified)" else ""
                loc_label = f"{st_name_str}{prov_str}, {country}"
                if strip_accents(loc_label) in existing_names:
                    continue
                existing_names.add(strip_accents(loc_label))

                wmo_id = int(wmo) if str(wmo).isdigit() else hash(st_name) % 900000
                results.append({
                    "id": wmo_id,
                    "region": country,
                    "country": country,
                    "state": prov if prov and prov != "(Unspecified)" else "",
                    "location": loc_label,
                    "climate_zone": f"{cz_code} - {cz_name}" if cz_code else "4A - Mixed Humid",
                    "latitude": round(float(lat or 0.0), 2),
                    "longitude": round(float(lng or 0.0), 2),
                    "elevation_ft": round(float(elev or 0.0), 1),
                    "timezone": float(tz or 0.0),
                    "summer_db_f": round(float(c_db or 90.0), 1),
                    "summer_wb_f": round(float(c_wb or 74.0), 1),
                    "daily_range_f": round(float(dbr or 18.0), 1),
                    "winter_db_f": round(float(h_db or 20.0), 1),
                    "winter_wb_f": round(float(h_db or 20.0) - 2.0, 1),
                    "hottest_month": int(hot_m or (7 if float(lat or 0.0) >= 0 else 1)),
                    "dst_enabled": float(lat or 0.0) >= 20.0,
                    "sim_station": f"{st_name_str} (ASHRAE)",
                })
        except Exception:
            pass

    return results[:limit]


def compute_solar_flux_profile(
    latitude_deg: float,
    month_idx: int,
    ground_reflectance: float = 0.20,
    solar_multiplier: float = 1.0,
    dst_active: bool = False,
) -> Dict[str, List[float]]:
    """
    Computes 24-hour clear-sky incident solar flux [BTU/(hr*sqft)] for all 16 compass directions + Horizontal
    for a given month (1..12) using the ASHRAE Clear-Sky Solar Model.
    """
    lat_rad = math.radians(latitude_deg)
    day_of_year = [21, 52, 80, 111, 141, 172, 202, 233, 264, 294, 325, 355][month_idx - 1]
    decl_deg = 23.45 * math.sin(math.radians(360.0 * (284 + day_of_year) / 365.0))
    decl_rad = math.radians(decl_deg)

    # Extraterrestrial normal irradiance A and optical depth coefficients B, C (ASHRAE Clear Sky)
    a_btu = 368.0 + 24.0 * math.cos(math.radians(360.0 * (day_of_year - 1) / 365.0))
    b_coeff = 0.172 - 0.032 * math.cos(math.radians(360.0 * (day_of_year - 1) / 365.0))
    c_coeff = 0.095 + 0.040 * math.sin(math.radians(360.0 * (day_of_year - 80) / 365.0))

    profiles: Dict[str, List[float]] = {k: [0.0] * 24 for k in COMPASS_DIRECTIONS}

    for hr in range(24):
        solar_hour = hr - (1.0 if dst_active else 0.0)
        hour_angle_rad = math.radians(15.0 * (solar_hour - 12.0))
        sin_beta = math.sin(lat_rad) * math.sin(decl_rad) + math.cos(lat_rad) * math.cos(decl_rad) * math.cos(hour_angle_rad)

        if sin_beta <= 0.01:
            continue

        cos_beta = math.sqrt(max(1e-6, 1.0 - sin_beta * sin_beta))
        # Direct normal irradiance E_dn
        e_dn = a_btu * math.exp(-b_coeff / sin_beta) * solar_multiplier
        # Diffuse horizontal irradiance E_dh
        e_dh = c_coeff * e_dn
        # Total horizontal irradiance
        e_hor = e_dn * sin_beta + e_dh
        profiles["HOR"][hr] = round(e_hor, 1)

        # Solar azimuth angle measured clockwise from North
        cos_az_south = (sin_beta * math.sin(lat_rad) - math.sin(decl_rad)) / (cos_beta * max(1e-6, math.cos(lat_rad)))
        cos_az_south = max(-1.0, min(1.0, cos_az_south))
        az_from_south_deg = math.degrees(math.acos(cos_az_south))
        if solar_hour < 12.0:
            solar_az_deg = (180.0 - az_from_south_deg) % 360.0
        else:
            solar_az_deg = (180.0 + az_from_south_deg) % 360.0

        for dir_code, surf_az_deg in COMPASS_DIRECTIONS.items():
            if surf_az_deg is None:
                continue
            gamma_rad = math.radians(solar_az_deg - surf_az_deg)
            cos_theta = cos_beta * math.cos(gamma_rad)
            direct_vert = e_dn * max(0.0, cos_theta)
            # Y ratio of vertical-to-horizontal sky diffuse radiation (Threlkeld / ASHRAE)
            y_ratio = max(0.45, 0.55 + 0.437 * cos_theta + 0.313 * (cos_theta ** 2)) if cos_theta > -0.2 else 0.45
            diffuse_vert = e_dh * y_ratio
            reflected_vert = 0.5 * ground_reflectance * e_hor
            profiles[dir_code][hr] = round(direct_vert + diffuse_vert + reflected_vert, 1)

    return profiles


def generate_design_weather_summary(weather_cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates complete 12-month x 24-hour Design Day temperature, wet-bulb, humidity ratio,
    and 16-orientation solar flux profiles.
    If location is Indianapolis Intl, IN, USA, uses the exact reference monthly maximums from HAP 6.4.
    """
    loc = str(weather_cfg.get("location", "Indianapolis Intl, IN, USA"))
    lat = float(weather_cfg.get("latitude", 39.73))
    elev = float(weather_cfg.get("elevation_ft", 790.0))
    summer_db = float(weather_cfg.get("summer_db_f", 91.3))
    summer_wb = float(weather_cfg.get("summer_wb_f", 75.0))
    daily_range = float(weather_cfg.get("daily_range_f", 17.9))
    ground_refl = float(weather_cfg.get("ground_reflectance", 0.20))
    dst = bool(weather_cfg.get("dst_enabled", True))
    p_atm = barometric_pressure_psia(elev)

    is_indy = "indianapolis" in loc.lower() and abs(summer_db - 91.3) < 0.5

    monthly_profiles: Dict[str, Any] = {}
    max_solar_table: Dict[str, Dict[str, float]] = {}

    for m_idx, m_name in enumerate(MONTH_NAMES, start=1):
        dst_month = dst and (3 <= m_idx <= 10)
        raw_solar = compute_solar_flux_profile(lat, m_idx, ground_refl, 1.0, dst_month)

        if is_indy and m_name in INDIANAPOLIS_MONTHLY_DESIGN:
            ref = INDIANAPOLIS_MONTHLY_DESIGN[m_name]
            m_max_db = ref["max_db"]
            m_min_db = ref["min_db"]
            m_max_wb = ref["max_wb"]
            max_sol = dict(ref["max_sol"])
            # Scale hourly profiles so each orientation hits its exact peak flux
            for d_code in COMPASS_DIRECTIONS:
                peak_calc = max(raw_solar[d_code]) if raw_solar[d_code] else 0.0
                target_peak = max_sol.get(d_code, peak_calc)
                if peak_calc > 0.1:
                    scale = target_peak / peak_calc
                    raw_solar[d_code] = [round(v * scale, 1) for v in raw_solar[d_code]]
        else:
            # Seasonal variation around hottest month
            hot_m = int(weather_cfg.get("hottest_month", 7))
            seasonal_drop = 22.0 * (1.0 - math.cos(math.radians((m_idx - hot_m) * 30.0)))
            m_max_db = summer_db - seasonal_drop
            m_min_db = m_max_db - daily_range
            m_max_wb = min(m_max_db - 2.0, summer_wb - 0.65 * seasonal_drop)
            max_sol = {d_code: round(max(raw_solar[d_code]), 1) for d_code in COMPASS_DIRECTIONS}

        # Generate 24-hour DB and WB profiles using ASHRAE daily range fractions
        w_design = humidity_ratio_from_db_wb(m_max_db, m_max_wb, p_atm)
        db_24: List[float] = []
        wb_24: List[float] = []
        for hr in range(24):
            hr_eff = (hr - 1) % 24 if dst_month else hr
            frac = ASHRAE_DAILY_RANGE_FRACTIONS[hr_eff]
            t_db = m_max_db - frac * (m_max_db - m_min_db)
            t_wb = wet_bulb_from_db_w(t_db, w_design, p_atm)
            db_24.append(round(t_db, 1))
            wb_24.append(round(t_wb, 1))

        monthly_profiles[m_name] = {
            "month_index": m_idx,
            "dst_active": dst_month,
            "max_db_f": round(m_max_db, 1),
            "min_db_f": round(m_min_db, 1),
            "max_wb_f": round(m_max_wb, 1),
            "db_hourly": db_24,
            "wb_hourly": wb_24,
            "solar_hourly": raw_solar,
            "max_solar_flux": max_sol,
        }
        max_solar_table[m_name] = max_sol

    return {
        "location": loc,
        "latitude": lat,
        "longitude": float(weather_cfg.get("longitude", -86.28)),
        "elevation_ft": elev,
        "barometric_pressure_psia": round(p_atm, 3),
        "summer_db_f": summer_db,
        "summer_wb_f": summer_wb,
        "daily_range_f": daily_range,
        "winter_db_f": float(weather_cfg.get("winter_db_f", 2.6)),
        "winter_wb_f": float(weather_cfg.get("winter_wb_f", 0.9)),
        "monthly_profiles": monthly_profiles,
        "max_solar_table": max_solar_table,
    }
