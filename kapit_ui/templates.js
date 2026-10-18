/**
 * Kapit 0.1 — Default Entity Templates for Project Libraries & Systems
 * Provides complete, technically sound templates for "Create New Item" across all 20 categories.
 */

const ENTITY_TEMPLATES = {
  weather: {
    location: "São Paulo - Congonhas, SP, Brasil",
    climate_zone: "3A - Warm Humid",
    latitude: -23.63,
    longitude: -46.66,
    elevation_ft: 2631.0,
    timezone: -3.0,
    summer_db_f: 89.2,
    summer_wb_f: 69.8,
    daily_range_f: 16.5,
    winter_db_f: 48.2,
    winter_wb_f: 44.6,
    oa_co2_ppm: 400,
    ground_reflectance: 0.20,
    soil_conductivity: 0.80,
    calc_start_month: 1,
    calc_end_month: 12,
    sim_weather_name: "Sao Paulo Congonhas AP (INMET/TMYx)",
  },

  buildings: {
    id: "BLDG_NEW",
    name: "New Commercial Building",
    footprint_shape: "Rectangular",
    gross_floor_area_sqft: 10000.0,
    number_of_stories: 1,
    levels: [
      { name: "Level 1", elevation_ft: 0.0, floor_to_floor_ft: 12.0, floor_to_ceiling_ft: 9.0 }
    ],
  },

  space_models: {
    id: "SM_NEW",
    name: "New Space Model",
    building_name: "New Commercial Building",
    infiltration_model: "Constant Infiltration",
    spaces: [],
  },

  air_systems: {
    id: "SYS_NEW",
    name: "New VAV Air System",
    equipment_class: "PKG ROOF",
    system_type: "VAV",
    number_of_zones: 1,
    zone_ids: [],
    sizing_data: {
      zone_cfm_sizing: "Peak zone sensible load",
      space_cfm_sizing: "Individual peak space loads",
    },
    central_cooling: {
      cooling_source: "DX Air-Cooled",
      supply_temp_f: 55.0,
      eer: 11.2,
      dx_staging: "Variable Speed (Inverter)",
    },
    preheat_coil: {
      heating_source: "Electric Resistance",
      setpoint_f: 52.0,
    },
    supply_fan: {
      fan_type: "Forward Curved with VFD",
      static_pressure_in_wg: 2.00,
      overall_efficiency_pct: 58.0,
    },
    ventilation: {
      sizing_method: "ASHRAE Standard 62.1-2022",
      occupant_diversity: 1.0,
    },
    economizer: {
      control: "Integrated Differential Enthalpy",
      upper_cutoff_f: 65.0,
    },
    zone_components: {
      terminal_type: "VAV with Electric Reheat",
      occ_cooling_tstat_f: 75.0,
      unocc_cooling_tstat_f: 82.0,
      occ_heating_tstat_f: 70.0,
      unocc_heating_tstat_f: 62.0,
      min_airflow_pct: 25.0,
      reheat_design_supply_temp_f: 90.0,
      ez_heating: 0.80,
    },
  },

  plants: {
    id: "PLT_NEW",
    name: "New Central Chilled & Hot Water Plant",
    plant_type: "Chilled Water & Hot Water Plant",
    fluid_type: "Water",
    glycol_pct: 0.0,
    chw_supply_temp_f: 44.0,
    chw_delta_t_f: 10.0,
    hw_supply_temp_f: 180.0,
    hw_delta_t_f: 20.0,
    chiller_ids: [],
    tower_ids: [],
    boiler_ids: [],
  },

  alternatives: {
    id: "ALT_NEW",
    name: "New Design Alternative",
    space_model_ids: [],
    air_system_ids: [],
    plant_ids: [],
    electric_rate_id: "",
    fuel_rate_id: "",
    is_baseline: false,
  },

  space_types: {
    id: "ST_NEW",
    name: "Office - Open Plan",
    ashrae_62_usage: "OFFICE: Office space",
    oa_req1_cfm_person: 5.0,
    oa_req2_cfm_sqft: 0.06,
    overhead_lighting_w_sqft: 0.66,
    elec_eqpt_w_sqft: 0.75,
    occupancy_density_per_1000sqft: 5.0,
    sensible_btuh_person: 245.0,
    latent_btuh_person: 205.0,
    infiltration_ach: 0.20,
  },

  schedules: {
    id: "SCH_NEW",
    name: "New Commercial Occupancy",
    schedule_type: "Fractional",
    profiles: {
      "Design Day": [0,0,0,0,0,0,10,50,90,95,95,95,95,95,95,90,50,20,10,0,0,0,0,0],
      "Weekday":    [0,0,0,0,0,0,10,50,90,95,95,95,95,95,95,90,50,20,10,0,0,0,0,0],
      "Saturday":   [0,0,0,0,0,0,0,10,20,20,20,20,20,10,0,0,0,0,0,0,0,0,0,0],
      "Sunday":     [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    },
  },

  walls: {
    id: "WALL_NEW",
    name: "New Exterior Insulated Wall",
    wall_type: "Exterior Wall",
    outside_absorptivity: 0.675,
    inside_r: 0.68,
    outside_r: 0.17,
    overall_u: 0.064,
    overall_r: 15.62,
    total_weight_lb_sqft: 18.5,
    layers: [
      { name: "Face Brick 4 in", thickness_in: 4.0, density: 125.0, specific_heat: 0.20, r_value: 0.80, weight: 41.7 },
      { name: "Continuous Insulation R-13", thickness_in: 2.5, density: 2.0, specific_heat: 0.22, r_value: 13.0, weight: 0.4 },
      { name: "Gypsum Sheathing 1/2 in", thickness_in: 0.5, density: 50.0, specific_heat: 0.26, r_value: 0.45, weight: 2.1 },
      { name: "Steel Stud Air Cavity", thickness_in: 3.5, density: 0.075, specific_heat: 0.24, r_value: 0.91, weight: 0.0 },
      { name: "Interior Gypsum Board 5/8 in", thickness_in: 0.625, density: 50.0, specific_heat: 0.26, r_value: 0.56, weight: 2.6 },
    ],
  },

  roofs: {
    id: "ROOF_NEW",
    name: "New Insulated Built-Up Roof",
    outside_absorptivity: 0.675,
    inside_r: 0.68,
    outside_r: 0.17,
    overall_u: 0.032,
    overall_r: 31.25,
    total_weight_lb_sqft: 8.5,
    layers: [
      { name: "Roof Membrane & Gravel", thickness_in: 0.375, density: 70.0, specific_heat: 0.35, r_value: 0.33, weight: 2.2 },
      { name: "Polyiso Continuous Insulation R-30", thickness_in: 5.2, density: 2.0, specific_heat: 0.36, r_value: 30.0, weight: 0.9 },
      { name: "Metal Deck 22 ga", thickness_in: 0.036, density: 489.0, specific_heat: 0.12, r_value: 0.00, weight: 1.5 },
    ],
  },

  ceilings: {
    id: "CEIL_NEW",
    name: "New Acoustic Tile Ceiling",
    overall_u: 0.350,
    overall_r: 2.86,
    total_weight_lb_sqft: 1.2,
    layers: [
      { name: "Acoustic Lay-in Tile 5/8 in", thickness_in: 0.625, density: 18.0, specific_heat: 0.32, r_value: 2.20, weight: 0.9 }
    ],
  },

  floors: {
    id: "FLR_NEW",
    name: "New Slab On Grade Concrete Floor",
    overall_u: 0.733,
    overall_r: 1.36,
    total_weight_lb_sqft: 48.0,
    layers: [
      { name: "Concrete Slab 4 in", thickness_in: 4.0, density: 140.0, specific_heat: 0.20, r_value: 0.40, weight: 46.7 },
      { name: "Floor Tile / Finish", thickness_in: 0.25, density: 65.0, specific_heat: 0.25, r_value: 0.15, weight: 1.4 },
    ],
  },

  windows: {
    id: "WIN_NEW",
    name: "New Double Low-E Window (W01)",
    overall_u: 0.360,
    overall_shgc: 0.360,
    width_ft: 3.5,
    height_ft: 6.0,
    area_sqft: 21.0,
    frame_type: "Thermally Broken Aluminum",
    internal_shade_type: "None",
  },

  doors: {
    id: "DOOR_NEW",
    name: "New Commercial Glass Door (D01)",
    glass_u: 0.630,
    glass_shgc: 0.330,
    width_ft: 6.0,
    height_ft: 8.0,
    area_sqft: 48.0,
    door_type: "Glass Entrance Door",
  },

  shades: {
    id: "SHD_NEW",
    name: "New Exterior Overhang",
    overhang_projection_in: 24.0,
    overhang_height_above_in: 12.0,
    left_extension_in: 12.0,
    right_extension_in: 12.0,
  },

  chillers: {
    id: "CHL_NEW",
    name: "New Water-Cooled Centrifugal Chiller",
    chiller_type: "Centrifugal Water-Cooled",
    capacity_tons: 200.0,
    full_load_kw_per_ton: 0.54,
    min_plr_pct: 15.0,
    condenser_flow_gpm_ton: 3.0,
  },

  cooling_towers: {
    id: "TWR_NEW",
    name: "New Induced Draft Cooling Tower",
    tower_type: "Induced Draft, Variable Speed Fan",
    design_range_f: 10.0,
    design_approach_f: 7.0,
    fan_hp_per_100gpm: 3.2,
  },

  boilers: {
    id: "BLR_NEW",
    name: "New High-Efficiency Condensing Boiler",
    boiler_type: "Condensing Gas Boiler",
    rated_capacity_mbh: 800.0,
    full_load_thermal_efficiency_pct: 95.0,
    fuel_type: "Natural Gas",
  },

  electric_rates: {
    id: "RATE_ELEC_NEW",
    name: "Commercial Electric Rate",
    rate_type: "Flat Energy with Demand",
    flat_price_usd_per_kwh: 0.1245,
    demand_price_usd_per_kw: 14.50,
    customer_charge_usd_month: 45.0,
    co2e_lb_per_kwh: 0.852,
  },

  fuel_rates: {
    id: "RATE_FUEL_NEW",
    name: "Commercial Natural Gas Rate",
    rate_type: "Flat Rate",
    unit_name: "MCF",
    flat_price_usd_per_unit: 10.50,
    customer_charge_usd_month: 25.0,
  },
};
