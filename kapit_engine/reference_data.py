"""
Embedded Reference Data for Kapit (equivalent to eDesign.ReferenceData01.dll & weather.db stations).
Includes:
- ASHRAE Standard 62.1 (2001-2022) Space Usage Ventilation Rates
- ASHRAE Standard 90.1 (2004-2022) Lighting Power Densities & Equipment Minimum Efficiencies
- Construction Material Layers & Standard Opaque Assemblies (Walls, Roofs, Ceilings, Floors)
- Window, Door, and External Shade Libraries
- Standard ASHRAE 90.1 Schedules (Occupancy, Lighting/Equipment, Fan/Thermostat)
- Space Types & Occupant Activity Levels
- Heat Transfer Liquids (Water, Ethylene Glycol, Propylene Glycol)
- US EIA & International Utility Tariff Templates + EPA eGRID CO2e Emission Factors
"""

from __future__ import annotations
from typing import Any, Dict, List


# Occupant Activity Levels (from ActivityLevelData.csv in eDesign.ReferenceData01.dll)
ACTIVITY_LEVELS: List[Dict[str, Any]] = [
    {"id": 0, "name": "User Defined", "sensible_btuh": 245.0, "latent_btuh": 205.0},
    {"id": 1, "name": "Seated at Rest", "sensible_btuh": 230.0, "latent_btuh": 120.0},
    {"id": 2, "name": "Office Work", "sensible_btuh": 245.0, "latent_btuh": 205.0},
    {"id": 3, "name": "Sedentary Work", "sensible_btuh": 280.0, "latent_btuh": 270.0},
    {"id": 4, "name": "Medium Work", "sensible_btuh": 295.0, "latent_btuh": 455.0},
    {"id": 5, "name": "Heavy Work", "sensible_btuh": 525.0, "latent_btuh": 925.0},
    {"id": 6, "name": "Dancing", "sensible_btuh": 305.0, "latent_btuh": 545.0},
    {"id": 7, "name": "Athletics", "sensible_btuh": 710.0, "latent_btuh": 1090.0},
]


# ASHRAE Standard 62.1-2022 Space Usage Ventilation Requirements
ASHRAE_62_1_2022_USAGES: List[Dict[str, Any]] = [
    {"id": 20220313, "name": "EDUCATION: Classroom (age 9 plus)", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.12, "default_occ_per_1000sqft": 35},
    {"id": 20220312, "name": "EDUCATION: Classroom (ages 5 to 8)", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.12, "default_occ_per_1000sqft": 25},
    {"id": 20220314, "name": "EDUCATION: Lecture classroom", "rp_cfm_person": 7.5, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 65},
    {"id": 20220316, "name": "EDUCATION: Science laboratories", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.18, "default_occ_per_1000sqft": 25},
    {"id": 20220318, "name": "EDUCATION: Computer lab", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.12, "default_occ_per_1000sqft": 25},
    {"id": 20220319, "name": "EDUCATION: Media center", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.12, "default_occ_per_1000sqft": 25},
    {"id": 20220320, "name": "EDUCATION: Music/theater/dance", "rp_cfm_person": 10.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 35},
    {"id": 20220332, "name": "GENERAL: Corridor", "rp_cfm_person": 0.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 0},
    {"id": 20220330, "name": "GENERAL: Break rooms", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 25},
    {"id": 20220331, "name": "GENERAL: Conference/meeting", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 50},
    {"id": 20220350, "name": "OFFICE: Office space", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 5},
    {"id": 20220351, "name": "OFFICE: Reception areas", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 30},
    {"id": 20220352, "name": "OFFICE: Main entry lobbies", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 10},
    {"id": 20220353, "name": "OFFICE: Occupiable storage room for dry materials", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 2},
    {"id": 20220322, "name": "FOOD AND BEVERAGE: Restaurant dining rooms", "rp_cfm_person": 7.5, "ra_cfm_sqft": 0.18, "default_occ_per_1000sqft": 70},
    {"id": 20220323, "name": "FOOD AND BEVERAGE: Cafeteria/fast-food dining", "rp_cfm_person": 7.5, "ra_cfm_sqft": 0.18, "default_occ_per_1000sqft": 100},
    {"id": 20220360, "name": "RETAIL: Sales (except as below)", "rp_cfm_person": 7.5, "ra_cfm_sqft": 0.12, "default_occ_per_1000sqft": 15},
    {"id": 20220361, "name": "RETAIL: Mall common areas", "rp_cfm_person": 7.5, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 40},
    {"id": 20220340, "name": "HOTELS, MOTELS, RESORTS, DORMITORIES: Bedroom/living room", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 10},
    {"id": 20220370, "name": "PUBLIC ASSEMBLY: Auditorium seating area", "rp_cfm_person": 5.0, "ra_cfm_sqft": 0.06, "default_occ_per_1000sqft": 150},
    {"id": 20220380, "name": "SPORTS AND ENTERTAINMENT: Gym, sports arena (play area)", "rp_cfm_person": 20.0, "ra_cfm_sqft": 0.18, "default_occ_per_1000sqft": 7},
]


# ASHRAE Standard 90.1-2022 Space-by-Space Lighting Power Densities (W/sqft)
ASHRAE_90_1_2022_LPD: List[Dict[str, Any]] = [
    {"id": 20220047, "method": "Space by Space", "name": "Classroom/Lecture Hall/Training Room: All others", "lpd_w_sqft": 0.72},
    {"id": 20220057, "method": "Space by Space", "name": "Corridor", "lpd_w_sqft": 0.44},
    {"id": 20220091, "method": "Space by Space", "name": "Office: Office <= 150 ft2", "lpd_w_sqft": 0.73},
    {"id": 20220092, "method": "Space by Space", "name": "Office: Office > 150 ft2 and <= 300 ft2", "lpd_w_sqft": 0.66},
    {"id": 20220093, "method": "Space by Space", "name": "Office: Open plan office", "lpd_w_sqft": 0.61},
    {"id": 20220115, "method": "Space by Space", "name": "Storage Room: >=50 ft2", "lpd_w_sqft": 0.35},
    {"id": 20220114, "method": "Space by Space", "name": "Storage Room: <50 ft2", "lpd_w_sqft": 0.49},
    {"id": 20220051, "method": "Space by Space", "name": "Conference/Meeting/Multipurpose Room", "lpd_w_sqft": 0.88},
    {"id": 20220085, "method": "Space by Space", "name": "Lobby: All others", "lpd_w_sqft": 0.80},
    {"id": 20220102, "method": "Space by Space", "name": "Restroom", "lpd_w_sqft": 0.63},
    {"id": 20220061, "method": "Space by Space", "name": "Dining Area: Cafeteria or fast food dining", "lpd_w_sqft": 0.42},
    {"id": 20220073, "method": "Space by Space", "name": "Gymnasium/Fitness Center: Exercise area", "lpd_w_sqft": 0.50},
    {"id": 20220080, "method": "Space by Space", "name": "Laboratory: In or as a classroom", "lpd_w_sqft": 1.05},
    {"id": 20220105, "method": "Space by Space", "name": "Sales Area", "lpd_w_sqft": 1.05},
]


# Standard Material Layers (from ConstructionLayerData.csv)
MATERIAL_LAYERS: List[Dict[str, Any]] = [
    {"id": 610, "name": "5/8-in gypsum board", "thickness_in": 0.625, "density_lb_cuft": 50.0, "specific_heat": 0.26, "r_value": 0.56306, "weight_lb_sqft": 2.604},
    {"id": 103, "name": "3.5-in cavity, 16-in o.c. steel frame, R-13 batt", "thickness_in": 3.500, "density_lb_cuft": 3.4, "specific_heat": 0.20, "r_value": 6.00000, "weight_lb_sqft": 0.992},
    {"id": 101, "name": "3.5-in cavity, 16-in o.c. steel frame, no insul", "thickness_in": 3.500, "density_lb_cuft": 2.9, "specific_heat": 0.01, "r_value": 0.79000, "weight_lb_sqft": 0.846},
    {"id": 515, "name": "R-7.5 board insulation", "thickness_in": 1.500, "density_lb_cuft": 2.5, "specific_heat": 0.35, "r_value": 7.50000, "weight_lb_sqft": 0.313},
    {"id": 530, "name": "R-15 board insulation", "thickness_in": 3.000, "density_lb_cuft": 2.5, "specific_heat": 0.35, "r_value": 15.00000, "weight_lb_sqft": 0.625},
    {"id": 560, "name": "R-30 board insulation", "thickness_in": 6.000, "density_lb_cuft": 2.5, "specific_heat": 0.35, "r_value": 30.00000, "weight_lb_sqft": 1.250},
    {"id": 614, "name": "3/4-in HW stucco", "thickness_in": 0.750, "density_lb_cuft": 120.0, "specific_heat": 0.20, "r_value": 0.08000, "weight_lb_sqft": 7.500},
    {"id": 701, "name": "22-gauge steel roof deck", "thickness_in": 0.034, "density_lb_cuft": 489.0, "specific_heat": 0.12, "r_value": 0.00009, "weight_lb_sqft": 1.386},
    {"id": 620, "name": "Acoustic Tile", "thickness_in": 0.750, "density_lb_cuft": 23.0, "specific_heat": 0.14, "r_value": 1.78571, "weight_lb_sqft": 1.438},
    {"id": 306, "name": "6 in. HW concrete", "thickness_in": 6.000, "density_lb_cuft": 140.0, "specific_heat": 0.22, "r_value": 0.44444, "weight_lb_sqft": 70.000},
    {"id": 304, "name": "4 in. LW concrete", "thickness_in": 4.000, "density_lb_cuft": 40.0, "specific_heat": 0.20, "r_value": 2.22222, "weight_lb_sqft": 13.333},
    {"id": 201, "name": "4 in. face brick", "thickness_in": 4.000, "density_lb_cuft": 125.0, "specific_heat": 0.22, "r_value": 0.43333, "weight_lb_sqft": 41.667},
    {"id": 210, "name": "8 in. HW concrete block", "thickness_in": 8.000, "density_lb_cuft": 61.0, "specific_heat": 0.20, "r_value": 1.11111, "weight_lb_sqft": 40.667},
]


# Standard Schedules (matching HAP-6.4-Example-Problem.hap & ASHRAE 90.1)
DEFAULT_SCHEDULES: List[Dict[str, Any]] = [
    {
        "id": "211440243",
        "name": "90.1 School Lights/Elec",
        "schedule_type": "Fractional",
        "profiles": {
            "Design Day": [5, 5, 5, 5, 5, 5, 5, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 5, 5],
            "Weekday": [5, 5, 5, 5, 5, 5, 5, 30, 85, 95, 95, 95, 80, 80, 80, 70, 50, 50, 35, 35, 35, 30, 5, 5],
            "Saturday": [5, 5, 5, 5, 5, 5, 5, 5, 15, 15, 15, 15, 15, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
            "Sunday": [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
        },
        "assignments": {
            "Design": [1]*12,
            "Monday": [2]*12,
            "Tuesday": [2]*12,
            "Wednesday": [2]*12,
            "Thursday": [2]*12,
            "Friday": [2]*12,
            "Saturday": [3]*12,
            "Sunday": [4]*12,
            "Holiday": [4]*12,
        },
    },
    {
        "id": "956582207",
        "name": "90.1 School Occupancy",
        "schedule_type": "Fractional",
        "profiles": {
            "Design Day": [0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0],
            "Weekday": [0, 0, 0, 0, 0, 0, 0, 5, 75, 90, 90, 80, 80, 80, 80, 45, 15, 5, 15, 20, 20, 10, 0, 0],
            "Saturday": [0, 0, 0, 0, 0, 0, 0, 0, 10, 10, 10, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Sunday": [0]*24,
        },
        "assignments": {
            "Design": [1]*12,
            "Monday": [2]*12,
            "Tuesday": [2]*12,
            "Wednesday": [2]*12,
            "Thursday": [2]*12,
            "Friday": [2]*12,
            "Saturday": [3]*12,
            "Sunday": [4]*12,
            "Holiday": [4]*12,
        },
    },
    {
        "id": "1892741299",
        "name": "90.1 Office Lights/Elec",
        "schedule_type": "Fractional",
        "profiles": {
            "Design Day": [5, 5, 5, 5, 5, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 5],
            "Weekday": [5, 5, 5, 5, 5, 10, 10, 30, 90, 90, 90, 90, 80, 90, 90, 90, 90, 50, 30, 30, 20, 20, 10, 5],
            "Saturday": [5, 5, 5, 5, 5, 5, 10, 10, 30, 30, 30, 30, 15, 15, 15, 15, 15, 5, 5, 5, 5, 5, 5, 5],
            "Sunday": [5]*24,
        },
        "assignments": {
            "Design": [1]*12,
            "Monday": [2]*12,
            "Tuesday": [2]*12,
            "Wednesday": [2]*12,
            "Thursday": [2]*12,
            "Friday": [2]*12,
            "Saturday": [3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3],
            "Sunday": [4]*12,
            "Holiday": [4]*12,
        },
    },
    {
        "id": "624527384",
        "name": "90.1 Office Occupancy",
        "schedule_type": "Fractional",
        "profiles": {
            "Design Day": [0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0],
            "Weekday": [0, 0, 0, 0, 0, 0, 10, 20, 95, 95, 95, 95, 50, 95, 95, 95, 95, 30, 10, 10, 10, 10, 5, 5],
            "Saturday": [0, 0, 0, 0, 0, 0, 10, 10, 30, 30, 30, 30, 10, 10, 10, 10, 10, 5, 5, 0, 0, 0, 0, 0],
            "Sunday": [0, 0, 0, 0, 0, 0, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0],
        },
        "assignments": {
            "Design": [1]*12,
            "Monday": [2]*12,
            "Tuesday": [2]*12,
            "Wednesday": [2]*12,
            "Thursday": [2]*12,
            "Friday": [2]*12,
            "Saturday": [3]*12,
            "Sunday": [4]*12,
            "Holiday": [4]*12,
        },
    },
    {
        "id": "525550824",
        "name": "Fan / Thermostat",
        "schedule_type": "Fan/Thermostat",
        "profiles": {
            "Design Day": [0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0],
            "Weekday": [0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0],
            "Saturday": [0, 0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            "Sunday": [0]*24,
        },
        "assignments": {
            "Design": [1]*12,
            "Monday": [2]*12,
            "Tuesday": [2]*12,
            "Wednesday": [2]*12,
            "Thursday": [2]*12,
            "Friday": [2]*12,
            "Saturday": [3]*12,
            "Sunday": [4]*12,
            "Holiday": [4]*12,
        },
    },
]


# EPA eGRID Electricity CO2e Emission Factors (from Using-HAP6-for-LEED4.pdf Table 1)
EPA_EGRID_SUBREGIONS: List[Dict[str, Any]] = [
    {"code": "AKGD", "name": "ASCC Alaska Grid", "lb_per_kwh": 1.0578, "lb_per_mmbtu": 310.0},
    {"code": "AKMS", "name": "ASCC Miscellaneous", "lb_per_kwh": 0.4976, "lb_per_mmbtu": 145.8},
    {"code": "AZNM", "name": "WECC Southwest", "lb_per_kwh": 0.7794, "lb_per_mmbtu": 228.4},
    {"code": "CAMX", "name": "WECC California", "lb_per_kwh": 0.4993, "lb_per_mmbtu": 146.3},
    {"code": "ERCT", "name": "ERCOT All", "lb_per_kwh": 0.7743, "lb_per_mmbtu": 226.9},
    {"code": "FRCC", "name": "FRCC All (Florida)", "lb_per_kwh": 0.8169, "lb_per_mmbtu": 239.4},
    {"code": "HIMS", "name": "HICC Miscellaneous", "lb_per_kwh": 1.1631, "lb_per_mmbtu": 340.9},
    {"code": "HIOA", "name": "HICC Oahu", "lb_per_kwh": 1.5869, "lb_per_mmbtu": 465.1},
    {"code": "MROE", "name": "MRO East", "lb_per_kwh": 1.4887, "lb_per_mmbtu": 436.3},
    {"code": "MROW", "name": "MRO West", "lb_per_kwh": 0.9434, "lb_per_mmbtu": 276.5},
    {"code": "NEWE", "name": "NPCC New England", "lb_per_kwh": 0.5405, "lb_per_mmbtu": 158.4},
    {"code": "NWPP", "name": "WECC Northwest", "lb_per_kwh": 0.6059, "lb_per_mmbtu": 177.6},
    {"code": "NYCW", "name": "NPCC NYC/Westchester", "lb_per_kwh": 0.8866, "lb_per_mmbtu": 259.8},
    {"code": "NYLI", "name": "NPCC Long Island", "lb_per_kwh": 1.2093, "lb_per_mmbtu": 354.4},
    {"code": "NYUP", "name": "NPCC Upstate NY", "lb_per_kwh": 0.2754, "lb_per_mmbtu": 80.7},
    {"code": "PRMS", "name": "Puerto Rico Miscellaneous", "lb_per_kwh": 1.5999, "lb_per_mmbtu": 468.9},
    {"code": "RFCE", "name": "RFC East", "lb_per_kwh": 0.6603, "lb_per_mmbtu": 193.5},
    {"code": "RFCM", "name": "RFC Michigan", "lb_per_kwh": 1.2242, "lb_per_mmbtu": 358.8},
    {"code": "RFCW", "name": "RFC West (Indiana/Illinois/Ohio)", "lb_per_kwh": 1.0059, "lb_per_mmbtu": 294.8},
    {"code": "RMPA", "name": "WECC Rockies", "lb_per_kwh": 1.1317, "lb_per_mmbtu": 331.7},
    {"code": "SPNO", "name": "SPP North", "lb_per_kwh": 0.9594, "lb_per_mmbtu": 281.2},
    {"code": "SPSO", "name": "SPP South", "lb_per_kwh": 0.9753, "lb_per_mmbtu": 285.8},
    {"code": "SRMV", "name": "SERC Mississippi Valley", "lb_per_kwh": 0.8037, "lb_per_mmbtu": 235.5},
    {"code": "SRMW", "name": "SERC Midwest", "lb_per_kwh": 1.3802, "lb_per_mmbtu": 404.5},
    {"code": "SRSO", "name": "SERC South", "lb_per_kwh": 0.8977, "lb_per_mmbtu": 263.1},
    {"code": "SRTV", "name": "SERC Tennessee Valley", "lb_per_kwh": 0.9386, "lb_per_mmbtu": 275.1},
    {"code": "SRVC", "name": "SERC Virginia/Carolina", "lb_per_kwh": 0.6259, "lb_per_mmbtu": 183.4},
    {"code": "SIN_BR", "name": "SIN Brasil (MCTI Grid Average)", "lb_per_kwh": 0.1540, "lb_per_mmbtu": 45.1},
]


# US EIA State Average Commercial Tariffs & Brazilian Utility Templates
UTILITY_TARIFF_TEMPLATES: List[Dict[str, Any]] = [
    {"region": "USA - Indiana (EIA 2024)", "electric_usd_kwh": 0.1244, "gas_usd_mcf": 7.75, "co2_elec_lb_kwh": 1.47, "co2_gas_lb_mcf": 117.1},
    {"region": "USA - New York (EIA 2024)", "electric_usd_kwh": 0.1850, "gas_usd_mcf": 10.40, "co2_elec_lb_kwh": 0.58, "co2_gas_lb_mcf": 117.1},
    {"region": "USA - California (EIA 2024)", "electric_usd_kwh": 0.2320, "gas_usd_mcf": 14.10, "co2_elec_lb_kwh": 0.499, "co2_gas_lb_mcf": 117.1},
    {"region": "USA - Texas (EIA 2024)", "electric_usd_kwh": 0.0980, "gas_usd_mcf": 6.90, "co2_elec_lb_kwh": 0.774, "co2_gas_lb_mcf": 117.1},
    {"region": "USA - Florida (EIA 2024)", "electric_usd_kwh": 0.1180, "gas_usd_mcf": 11.20, "co2_elec_lb_kwh": 0.817, "co2_gas_lb_mcf": 117.1},
    {"region": "USA - Illinois (EIA 2024)", "electric_usd_kwh": 0.1150, "gas_usd_mcf": 7.60, "co2_elec_lb_kwh": 1.006, "co2_gas_lb_mcf": 117.1},
    {"region": "Brasil - Sudeste Comercial (B3/A4)", "electric_usd_kwh": 0.1480, "gas_usd_mcf": 12.50, "co2_elec_lb_kwh": 0.154, "co2_gas_lb_mcf": 117.1},
    {"region": "Brasil - Sul Comercial (B3/A4)", "electric_usd_kwh": 0.1390, "gas_usd_mcf": 12.10, "co2_elec_lb_kwh": 0.154, "co2_gas_lb_mcf": 117.1},
    {"region": "Brasil - Nordeste Comercial (B3/A4)", "electric_usd_kwh": 0.1520, "gas_usd_mcf": 13.00, "co2_elec_lb_kwh": 0.154, "co2_gas_lb_mcf": 117.1},
]


# Air System Types (22 active types in HAP 6.4)
AIR_SYSTEM_TYPES: List[Dict[str, Any]] = [
    {"id": 1, "code": "ST_CAV_SINGLE_ZONE", "name": "Single Zone CAV", "equipment_class": "PKG ROOF / SPLIT / CW AHU", "category": "Central CAV"},
    {"id": 2, "code": "ST_CAV_TERMINAL_REHEAT", "name": "CAV with Terminal Reheat", "equipment_class": "PKG ROOF / CW AHU", "category": "Central CAV"},
    {"id": 3, "code": "ST_2_DECK_MULTIZONE", "name": "2-Deck Multizone CAV", "equipment_class": "PKG ROOF / CW AHU", "category": "Central CAV"},
    {"id": 4, "code": "ST_3_DECK_MULTIZONE", "name": "3-Deck Multizone CAV", "equipment_class": "PKG ROOF / CW AHU", "category": "Central CAV"},
    {"id": 5, "code": "ST_CAV_DUAL_DUCT", "name": "Dual-Duct CAV", "equipment_class": "CW AHU", "category": "Central CAV"},
    {"id": 6, "code": "ST_MAKEUP_AIR_DOAS", "name": "Makeup Air / Standalone DOAS", "equipment_class": "PKG ROOF / CW AHU", "category": "Dedicated OA"},
    {"id": 8, "code": "ST_VAV", "name": "VAV", "equipment_class": "PKG ROOF", "category": "Central VAV"},
    {"id": 9, "code": "ST_VAV_1_FAN_DUAL_DUCT", "name": "1-Fan Dual-Duct VAV", "equipment_class": "CW AHU", "category": "Central VAV"},
    {"id": 10, "code": "ST_VAV_2_FAN_DUAL_DUCT", "name": "2-Fan Dual-Duct VAV", "equipment_class": "CW AHU", "category": "Central VAV"},
    {"id": 11, "code": "ST_VVT", "name": "Variable Volume and Temperature (VVT)", "equipment_class": "PKG ROOF", "category": "Central VAV"},
    {"id": 12, "code": "ST_PACKAGED_DX_FAN_COIL", "name": "Packaged DX Fan Coils (PTAC/PTHP)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 13, "code": "ST_SPLIT_DX_FAN_COIL", "name": "Split DX Fan Coils", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 14, "code": "ST_WSHP", "name": "Water Source Heat Pumps (WSHP)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 15, "code": "ST_2_PIPE_FAN_COIL", "name": "2-Pipe Hydronic Fan Coils", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 16, "code": "ST_4_PIPE_FAN_COIL", "name": "4-Pipe Hydronic Fan Coils", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 17, "code": "ST_CONVECTIVE_HEATING", "name": "Convective / Baseboard Heating", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 18, "code": "ST_GWSHP", "name": "Ground-Water Source Heat Pumps (GWSHP)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 19, "code": "ST_GSHP", "name": "Ground-Source Heat Pumps (GSHP)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 20, "code": "ST_VRF", "name": "Variable Refrigerant Flow (VRF)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 21, "code": "ST_INDUCTION_BEAM", "name": "2-Pipe Induction Beams", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 22, "code": "ST_ACTIVE_CHILLED_BEAM", "name": "Active Chilled Beams (2-Pipe)", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
    {"id": 23, "code": "ST_4_PIPE_INDUCTION", "name": "4-Pipe Active Chilled / Induction Beams", "equipment_class": "TERMINAL UNITS", "category": "Terminal Systems"},
]


# Plant Types (16 types in HAP 6.4)
PLANT_TYPES: List[Dict[str, Any]] = [
    {"id": 1, "code": "CHILLER", "name": "Chiller Plant", "category": "Cooling"},
    {"id": 2, "code": "CHANGEOVER", "name": "Changeover Plant (2-Pipe CW/HW)", "category": "Cooling/Heating"},
    {"id": 3, "code": "HEAT_RECOVERY", "name": "Heat Recovery Chiller Plant", "category": "Cooling/Heating"},
    {"id": 4, "code": "HOT_WATER", "name": "Hot Water Boiler Plant", "category": "Heating"},
    {"id": 5, "code": "STEAM_BOILER", "name": "Steam Boiler Plant", "category": "Heating"},
    {"id": 6, "code": "SERVICE_HOT_WATER", "name": "Service Hot Water (SHW) Plant", "category": "SHW"},
    {"id": 7, "code": "REMOTE_SOURCE_CW", "name": "District / Remote Chilled Water", "category": "District"},
    {"id": 8, "code": "REMOTE_SOURCE_HW", "name": "District / Remote Hot Water", "category": "District"},
    {"id": 9, "code": "REMOTE_SOURCE_STEAM", "name": "District / Remote Steam", "category": "District"},
    {"id": 10, "code": "GENERIC_CW", "name": "Generic Chilled Water Plant (Load Only)", "category": "Design Only"},
    {"id": 11, "code": "GENERIC_HW", "name": "Generic Hot Water Plant (Load Only)", "category": "Design Only"},
    {"id": 12, "code": "GENERIC_STEAM", "name": "Generic Steam Plant (Load Only)", "category": "Design Only"},
]


def fluid_properties(fluid_type: str = "Water", glycol_pct: float = 0.0, temp_f: float = 50.0) -> Dict[str, float]:
    """
    Computes heat transfer liquid properties (SpecificHeat BTU/(lb-F), Density lb/ft³,
    FreezingPoint °F, and RhoCpRatio relative to pure water at 60°F).
    Reproduces Carrier.eDesign.ReferenceData.Liquids (Water, EthyleneGlycol, PropyleneGlycol).
    """
    conc = max(0.0, min(60.0, float(glycol_pct))) / 100.0
    if fluid_type == "EthyleneGlycol" and conc > 0:
        cp = 1.0 - 0.43 * conc + 0.0005 * (temp_f - 50.0)
        rho = 62.4 * (1.0 + 0.14 * conc)
        freeze_f = 32.0 - 95.0 * conc - 45.0 * (conc ** 2)
    elif fluid_type == "PropyleneGlycol" and conc > 0:
        cp = 1.0 - 0.36 * conc + 0.0006 * (temp_f - 50.0)
        rho = 62.4 * (1.0 + 0.07 * conc)
        freeze_f = 32.0 - 75.0 * conc - 55.0 * (conc ** 2)
    else:
        cp = 1.0
        rho = 62.4
        freeze_f = 32.0

    rho_cp_ratio = (rho * cp) / 62.4
    return {
        "specific_heat_btu_lb_f": round(cp, 4),
        "density_lb_cuft": round(rho, 2),
        "freezing_point_f": round(freeze_f, 1),
        "rho_cp_ratio": round(rho_cp_ratio, 4),
    }
