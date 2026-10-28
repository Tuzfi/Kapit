/**
 * Kapit 0.1 — Interactive 2D Floor Plan & 3D Building Modeler (modeler.js)
 * Implements mouse-driven architectural sketching, move, resize, wall selection,
 * wall exposure / orientation configuration (N, NE, E, SE, S, SW, W, NW, Partition, Underground),
 * aperture (window/door) editing per wall, perimeter/core zoning, multi-level stacking,
 * and mouse-rotatable 3D isometric extruded building visualization.
 */

const modeler = {
  activeLevel: "Level 1",
  selectedSpaceId: null,
  selectedWallIdx: 0,
  hoveredWallIdx: null,
  currentTool: "select", // "select" | "draw_rect"
  viewMode: "split",     // "split" | "2d" | "3d"
  colorMode: "zone",     // "zone" | "load" | "usage"

  // 2D Canvas State
  pan2d: { x: 40, y: 40 },
  zoom2d: 1.25,
  gridSnap: 1.0, // ft
  dragState: null,

  // 3D Canvas State
  rot3d: { az: 38, el: 35 },
  zoom3d: 1.15,
  pan3d: { x: 0, y: 0 },
  drag3d: null,

  ZONE_COLORS: [
    "#93c5fd", "#86efac", "#fde047", "#fca5a5", "#c4b5fd",
    "#fdba74", "#6ee7b7", "#7dd3fc", "#f472b6", "#a7f3d0",
    "#e2e8f0", "#cbd5e1"
  ],

  COMPASS_CARDINALS: [
    { code: "N", label: "North (N - 0°)" },
    { code: "NNE", label: "North-Northeast (NNE - 22.5°)" },
    { code: "NE", label: "Northeast (NE - 45°)" },
    { code: "ENE", label: "East-Northeast (ENE - 67.5°)" },
    { code: "E", label: "East (E - 90°)" },
    { code: "ESE", label: "East-Southeast (ESE - 112.5°)" },
    { code: "SE", label: "Southeast (SE - 135°)" },
    { code: "SSE", label: "South-Southeast (SSE - 157.5°)" },
    { code: "S", label: "South (S - 180°)" },
    { code: "SSW", label: "South-Southwest (SSW - 202.5°)" },
    { code: "SW", label: "Southwest (SW - 225°)" },
    { code: "WSW", label: "West-Southwest (WSW - 247.5°)" },
    { code: "W", label: "West (W - 270°)" },
    { code: "WNW", label: "West-Northwest (WNW - 292.5°)" },
    { code: "NW", label: "Northwest (NW - 315°)" },
    { code: "NNW", label: "North-Northwest (NNW - 337.5°)" },
    { code: "Partition", label: "Interior Partition (Parede Interna)" },
    { code: "Underground", label: "Underground / Below Grade (Enterrada)" },
  ],

  autoPropagateOrientations: true,

  COMPASS_AZIMUTHS: {
    "N": 0,
    "NNE": 22.5,
    "NE": 45,
    "ENE": 67.5,
    "E": 90,
    "ESE": 112.5,
    "SE": 135,
    "SSE": 157.5,
    "S": 180,
    "SSW": 202.5,
    "SW": 225,
    "WSW": 247.5,
    "W": 270,
    "WNW": 292.5,
    "NW": 315,
    "NNW": 337.5
  },

  compassToAzimuth(cardinal) {
    if (!cardinal) return null;
    if (this.COMPASS_AZIMUTHS && this.COMPASS_AZIMUTHS[cardinal] !== undefined) {
      return this.COMPASS_AZIMUTHS[cardinal];
    }
    return null;
  },

  azimuthToCompass(azimuth) {
    let az = ((azimuth % 360) + 360) % 360;
    const cardinals = [
      { code: "N", az: 0 },
      { code: "NNE", az: 22.5 },
      { code: "NE", az: 45 },
      { code: "ENE", az: 67.5 },
      { code: "E", az: 90 },
      { code: "ESE", az: 112.5 },
      { code: "SE", az: 135 },
      { code: "SSE", az: 157.5 },
      { code: "S", az: 180 },
      { code: "SSW", az: 202.5 },
      { code: "SW", az: 225 },
      { code: "WSW", az: 247.5 },
      { code: "W", az: 270 },
      { code: "WNW", az: 292.5 },
      { code: "NW", az: 315 },
      { code: "NNW", az: 337.5 },
      { code: "N", az: 360 }
    ];
    let best = cardinals[0];
    let minDiff = 999;
    for (const c of cardinals) {
      const diff = Math.abs(az - c.az);
      if (diff < minDiff) {
        minDiff = diff;
        best = c;
      }
    }
    return best.code;
  },

  getWallGeometricAngle(sp, wIdx) {
    if (sp && sp.geometry && sp.geometry.polygon && sp.geometry.polygon.length >= 3) {
      const pts = sp.geometry.polygon;
      const p1 = pts[wIdx % pts.length];
      const p2 = pts[(wIdx + 1) % pts.length];
      const norm = this.getEdgeOutwardNormal(p1, p2, pts);
      let azDeg = Math.atan2(norm.nx, -norm.ny) * (180.0 / Math.PI);
      if (azDeg < 0) azDeg += 360.0;
      return Math.round(azDeg * 10) / 10;
    }
    const totalWalls = (sp && sp.walls && sp.walls.length) || 4;
    return (wIdx * (360.0 / totalWalls)) % 360.0;
  },

  getPeakSolarFlux(orientation) {
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const fluxMap = {
      "N": 39.0,
      "NNE": 85.0,
      "NE": 165.0,
      "ENE": 205.0,
      "E": 216.0,
      "ESE": 195.0,
      "SE": 168.0,
      "SSE": 135.0,
      "S": 109.0,
      "SSW": 135.0,
      "SW": 168.0,
      "WSW": 195.0,
      "W": 216.0,
      "WNW": 205.0,
      "NW": 165.0,
      "NNW": 85.0,
      "Horizontal": 285.0,
      "Partition": 0.0,
      "Underground": 0.0
    };
    const btu = fluxMap[orientation] || 0.0;
    if (isSI) {
      const wm2 = Math.round(btu * 3.15459);
      return `${wm2} W/m²`;
    }
    return `${btu} BTU/(hr·ft²)`;
  },

  init() {
    const cvs = document.getElementById("building-canvas");
    if (!cvs) return;
    this.attachEventListeners(cvs);
    this.ensureGeometries();
    this.render();
  },

  resetView() {
    this.pan2d = { x: 40, y: 40 };
    this.zoom2d = 1.25;
    this.pan3d = { x: 0, y: 0 };
    this.zoom3d = 1.0;
    this.rot3d = { az: 38, el: 35 };
    this.render();
  },

  ensureGeometries() {
    const proj = app.state.project;
    if (!proj || !proj.space_models || !proj.space_models[0]) return;
    const sm = proj.space_models[0];
    const spaces = sm.spaces || [];

    const defaultLayout = {
      "S_D112": { x: 10, y: 55, w: 32, h: 28 },
      "S_D113": { x: 42, y: 55, w: 188, h: 32 },
      "S_D111": { x: 25, y: 87, w: 42, h: 38 },
      "S_D110": { x: 25, y: 125, w: 42, h: 32 },
      "S_D109": { x: 25, y: 157, w: 42, h: 26 },
      "S_D108": { x: 67, y: 87, w: 163, h: 96 },
      "S_D107": { x: 125, y: 183, w: 105, h: 82 },
      "S_D106": { x: 125, y: 265, w: 105, h: 82 },
      "S_D114": { x: 230, y: 55, w: 38, h: 265 },
      "S_D105": { x: 230, y: 320, w: 38, h: 27 },
      "S_D101": { x: 268, y: 15, w: 112, h: 78 },
      "S_D102": { x: 268, y: 93, w: 112, h: 76 },
      "S_D103": { x: 268, y: 169, w: 112, h: 80 },
      "S_D104": { x: 268, y: 249, w: 112, h: 80 },
    };

    let curGridX = 20, curGridY = 20;
    spaces.forEach((sp) => {
      if (!sp.geometry || !sp.geometry.polygon || sp.geometry.polygon.length < 3) {
        const layout = defaultLayout[sp.id] || { x: curGridX, y: curGridY, w: 40, h: 30 };
        if (!defaultLayout[sp.id]) {
          curGridX += 50;
          if (curGridX > 250) { curGridX = 20; curGridY += 45; }
        }
        sp.geometry = {
          level: sp.level || "Level 1",
          polygon: [
            [layout.x, layout.y],
            [layout.x + layout.w, layout.y],
            [layout.x + layout.w, layout.y + layout.h],
            [layout.x, layout.y + layout.h]
          ]
        };
      }
      this.syncSpaceFromGeometry(sp);
    });

    if (spaces.length > 0 && !this.selectedSpaceId) {
      this.selectedSpaceId = spaces[0].id;
      this.selectedWallIdx = 0;
    }
  },

  getSpacesOnLevel(levelName) {
    const proj = app.state.project;
    if (!proj || !proj.space_models || !proj.space_models[0]) return [];
    return (proj.space_models[0].spaces || []).filter(s => (s.level || "Level 1") === levelName);
  },

  getAllSpaces() {
    const proj = app.state.project;
    if (!proj || !proj.space_models || !proj.space_models[0]) return [];
    return proj.space_models[0].spaces || [];
  },

  getSelectedSpace() {
    return this.getAllSpaces().find(s => s.id === this.selectedSpaceId);
  },

  screenToModel(px, py, ox, oy) {
    const x = (px - ox) / this.zoom2d;
    const y = (py - oy) / this.zoom2d;
    const snap = this.gridSnap;
    return {
      x: Math.round(x / snap) * snap,
      y: Math.round(y / snap) * snap,
    };
  },

  modelToScreen(mx, my, ox, oy) {
    return {
      px: ox + mx * this.zoom2d,
      py: oy + my * this.zoom2d,
    };
  },

  polygonArea(pts) {
    return Math.abs(this.getSignedPolygonArea(pts));
  },

  getSignedPolygonArea(pts) {
    let area = 0.0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
    }
    return area / 2.0;
  },

  getEdgeOutwardNormal(p1, p2, polyPts) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    if (len === 0) return { nx: 0, ny: -1, len: 0, dx: 0, dy: 0 };
    // In canvas / model space (y increases downwards):
    // If polygon is Clockwise (signedArea > 0), outward normal is (dy/len, -dx/len)
    // If polygon is Counter-Clockwise (signedArea < 0), outward normal is (-dy/len, dx/len)
    const isCW = this.getSignedPolygonArea(polyPts) >= 0;
    const sign = isCW ? 1.0 : -1.0;
    return {
      nx: (dy / len) * sign,
      ny: (-dx / len) * sign,
      len: len,
      dx: dx,
      dy: dy,
    };
  },

  normalToCompass(nx, ny) {
    // Standard architectural compass where North is up (-Y):
    // North (N): nx = 0, ny = -1 -> Azimuth 0°
    // East  (E): nx = 1, ny = 0  -> Azimuth 90°
    // South (S): nx = 0, ny = 1  -> Azimuth 180°
    // West  (W): nx = -1, ny = 0 -> Azimuth 270°
    let azDeg = Math.atan2(nx, -ny) * (180.0 / Math.PI);
    if (azDeg < 0) azDeg += 360.0;

    const compass = [
      { code: "N", min: 348.75, max: 11.25 },
      { code: "NNE", min: 11.25, max: 33.75 },
      { code: "NE", min: 33.75, max: 56.25 },
      { code: "ENE", min: 56.25, max: 78.75 },
      { code: "E", min: 78.75, max: 101.25 },
      { code: "ESE", min: 101.25, max: 123.75 },
      { code: "SE", min: 123.75, max: 146.25 },
      { code: "SSE", min: 146.25, max: 168.75 },
      { code: "S", min: 168.75, max: 191.25 },
      { code: "SSW", min: 191.25, max: 213.75 },
      { code: "SW", min: 213.75, max: 236.25 },
      { code: "WSW", min: 236.25, max: 258.75 },
      { code: "W", min: 258.75, max: 281.25 },
      { code: "WNW", min: 281.25, max: 303.75 },
      { code: "NW", min: 303.75, max: 326.25 },
      { code: "NNW", min: 326.25, max: 348.75 },
    ];
    for (const c of compass) {
      if (c.code === "N") {
        if (azDeg >= c.min || azDeg < c.max) return "N";
      } else if (azDeg >= c.min && azDeg < c.max) {
        return c.code;
      }
    }
    return "S";
  },

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  },

  segmentsOverlapCollinear(p1, p2, op1, op2, tolerance = 1.5) {
    const d1 = this.distToSegment(op1[0], op1[1], p1[0], p1[1], p2[0], p2[1]);
    const d2 = this.distToSegment(op2[0], op2[1], p1[0], p1[1], p2[0], p2[1]);
    const d3 = this.distToSegment(p1[0], p1[1], op1[0], op1[1], op2[0], op2[1]);
    const d4 = this.distToSegment(p2[0], p2[1], op1[0], op1[1], op2[0], op2[1]);

    if ((d1 < tolerance && d2 < tolerance) || (d3 < tolerance && d4 < tolerance)) {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const len2 = dx * dx + dy * dy;
      if (len2 < 1.0) return false;
      const to1 = ((op1[0] - p1[0]) * dx + (op1[1] - p1[1]) * dy) / len2;
      const to2 = ((op2[0] - p1[0]) * dx + (op2[1] - p1[1]) * dy) / len2;
      const minO = Math.min(to1, to2);
      const maxO = Math.max(to1, to2);
      const overlapStart = Math.max(0.0, minO);
      const overlapEnd = Math.min(1.0, maxO);
      const overlapLen = (overlapEnd - overlapStart) * Math.sqrt(len2);
      return overlapLen > 2.0;
    }
    return false;
  },

  syncSpaceFromGeometry(sp) {
    if (!sp.geometry || !sp.geometry.polygon) return;
    const pts = sp.geometry.polygon;
    const area = this.polygonArea(pts);
    const flr_to_ceil = parseFloat(sp.ceiling_height_ft || 9.0);
    const flr_to_flr = 12.0;

    sp.floor_area_sqft = Math.round(area * 10) / 10;
    sp.volume_cuft = Math.round(area * flr_to_ceil * 10) / 10;

    const existingWalls = sp.walls || [];
    const newWalls = [];
    let grossExtWall = 0.0;
    let grossIntWall = 0.0;
    let longestLen = 0.0;
    let mainExposure = "S";

    const allSpacesOnLevel = this.getSpacesOnLevel(sp.level || "Level 1");

    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const norm = this.getEdgeOutwardNormal(p1, p2, pts);
      const defaultOri = this.normalToCompass(norm.nx, norm.ny);
      const grossArea = Math.round(len * flr_to_flr * 10) / 10;

      let isShared = false;
      for (const other of allSpacesOnLevel) {
        if (other.id === sp.id || !other.geometry || !other.geometry.polygon) continue;
        const oPts = other.geometry.polygon;
        for (let j = 0; j < oPts.length; j++) {
          const op1 = oPts[j];
          const op2 = oPts[(j + 1) % oPts.length];
          if (this.segmentsOverlapCollinear(p1, p2, op1, op2)) {
            isShared = true;
            break;
          }
        }
        if (isShared) break;
      }

      const prev = existingWalls[i] || {};
      const ori = prev.custom_orientation ? prev.orientation : (isShared ? "Partition" : (prev.orientation || defaultOri));
      const isInterior = ori === "Partition" || (isShared && !prev.custom_orientation);

      if (isInterior) {
        grossIntWall += grossArea;
      } else {
        grossExtWall += grossArea;
        if (len > longestLen) {
          longestLen = len;
          mainExposure = ori;
        }
      }

      newWalls.push({
        id: prev.id || `WALL_${sp.id}_${i}`,
        wall_index: i,
        orientation: ori,
        custom_orientation: !!prev.custom_orientation,
        length_ft: Math.round(len * 10) / 10,
        gross_area_sqft: grossArea,
        wall_assembly_id: prev.wall_assembly_id || "WALL_1",
        is_interior: isInterior,
        windows: prev.windows || [],
        doors: prev.doors || [],
      });
    }

    sp.walls = newWalls;
    sp.exterior_wall_sqft = Math.round(grossExtWall * 10) / 10;
    sp.interior_wall_sqft = Math.round(grossIntWall * 10) / 10;
    sp.exposure = mainExposure;

    let totWin = 0, totDoor = 0;
    newWalls.forEach(w => {
      (w.windows || []).forEach(wi => totWin += (parseInt(wi.qty) || 1));
      (w.doors || []).forEach(di => totDoor += (parseInt(di.qty) || 1));
    });
    sp.window_qty = totWin;
    sp.door_qty = totDoor;
  },

  getSpaceColor(sp) {
    if (this.colorMode === "zone") {
      const spaces = this.getAllSpaces();
      const zNames = [...new Set(spaces.map(s => s.zone_name))];
      const zIdx = zNames.indexOf(sp.zone_name);
      return this.ZONE_COLORS[(zIdx >= 0 ? zIdx : 0) % this.ZONE_COLORS.length];
    } else if (this.colorMode === "load") {
      const calc = app.state.calculations;
      if (!calc) return "#bae6fd";
      const zs = (calc.air_system.zone_sizing || []).find(z => z.zone_name === sp.zone_name);
      if (!zs) return "#bae6fd";
      const int = (zs.cooling_sensible_load_mbh * 1000) / Math.max(1, zs.floor_area_sqft);
      if (int > 35) return "#f87171";
      if (int > 25) return "#fbbf24";
      if (int > 15) return "#86efac";
      return "#93c5fd";
    } else {
      const u = sp.ashrae_62_usage || "";
      if (u.includes("OFFICE")) return "#93c5fd";
      if (u.includes("CLASSROOM") || u.includes("EDUCATION")) return "#86efac";
      if (u.includes("CORRIDOR")) return "#fde047";
      return "#c4b5fd";
    }
  },

  render() {
    const cvs = document.getElementById("building-canvas");
    if (!cvs || !app.state.project) return;
    const ctx = cvs.getContext("2d");
    ctx.clearRect(0, 0, cvs.width, cvs.height);

    const mode = this.viewMode;
    if (mode === "2d" || mode === "split") {
      const w = mode === "split" ? cvs.width * 0.52 : cvs.width;
      this.render2D(ctx, 0, 0, w, cvs.height);
    }
    if (mode === "3d" || mode === "split") {
      const x = mode === "split" ? cvs.width * 0.52 : 0;
      const w = mode === "split" ? cvs.width * 0.48 : cvs.width;
      this.render3D(ctx, x, 0, w, cvs.height);
    }

    this.updateStatusReadout();
    this.renderWallInspector();
  },

  render2D(ctx, ox, oy, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.clip();

    const panX = ox + this.pan2d.x;
    const panY = oy + this.pan2d.y;

    // Grid
    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    const gridPx = 10 * this.zoom2d;
    for (let x = panX % gridPx; x < ox + w; x += gridPx) {
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + h); ctx.stroke();
    }
    for (let y = panY % gridPx; y < oy + h; y += gridPx) {
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + w, y); ctx.stroke();
    }

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12.5px Segoe UI";
    ctx.fillText(`2D Floor Plan & Zoning — ${this.activeLevel}`, ox + 15, oy + 22);

    const spaces = this.getSpacesOnLevel(this.activeLevel);
    spaces.forEach(sp => {
      if (!sp.geometry || !sp.geometry.polygon) return;
      const pts = sp.geometry.polygon.map(pt => this.modelToScreen(pt[0], pt[1], panX, panY));
      const isSelected = sp.id === this.selectedSpaceId;

      // Fill room
      ctx.beginPath();
      pts.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
      ctx.closePath();
      ctx.fillStyle = this.getSpaceColor(sp);
      ctx.fill();

      // Base room outline
      ctx.strokeStyle = isSelected ? "#0284c7" : "#475569";
      ctx.lineWidth = isSelected ? 2.5 : 1.4;
      ctx.stroke();

      // Room label
      const midX = pts.reduce((sum, p) => sum + p.px, 0) / pts.length;
      const midY = pts.reduce((sum, p) => sum + p.py, 0) / pts.length;
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 11px Segoe UI";
      ctx.textAlign = "center";
      ctx.fillText(sp.name.split(" - ")[0], midX, midY - 2);
      ctx.font = "9.5px Segoe UI";
      const areaText = typeof I18N !== "undefined" ? I18N.formatArea(sp.floor_area_sqft, 0) : `${sp.floor_area_sqft} sqft`;
      ctx.fillText(areaText, midX, midY + 11);

      // Render Walls, Orientations, Windows & Doors
      for (let i = 0; i < pts.length; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const isWallSelected = isSelected && (this.selectedWallIdx === i);
        const isWallHovered = isSelected && (this.hoveredWallIdx === i);
        const wall = sp.walls && sp.walls[i];

        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);

        if (isWallSelected) {
          ctx.strokeStyle = "#f59e0b"; // Golden Amber for active selected wall
          ctx.lineWidth = 4.5;
          ctx.stroke();

          // Draw outward normal arrow and orientation label using exact polygon outward normal
          const midEdgeX = (p1.px + p2.px) / 2;
          const midEdgeY = (p1.py + p2.py) / 2;
          const polyScreen = pts.map(p => [p.px, p.py]);
          const norm = this.getEdgeOutwardNormal([p1.px, p1.py], [p2.px, p2.py], polyScreen);
          const nx = norm.nx;
          const ny = norm.ny;
          const arrowLen = 24;
          const ax = midEdgeX + nx * arrowLen;
          const ay = midEdgeY + ny * arrowLen;

          ctx.strokeStyle = "#b45309";
          ctx.fillStyle = "#b45309";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(midEdgeX, midEdgeY);
          ctx.lineTo(ax, ay);
          ctx.stroke();

          // Arrow head
          const angle = Math.atan2(ny, nx);
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - 7 * Math.cos(angle - Math.PI / 6), ay - 7 * Math.sin(angle - Math.PI / 6));
          ctx.lineTo(ax - 7 * Math.cos(angle + Math.PI / 6), ay - 7 * Math.sin(angle + Math.PI / 6));
          ctx.closePath();
          ctx.fill();

          let oriLabel = wall ? wall.orientation : "Exp";
          if (typeof I18N !== "undefined" && wall) {
            oriLabel = I18N.t("compass." + wall.orientation).split(" (")[0] || wall.orientation;
          }
          const lenText = typeof I18N !== "undefined" ? I18N.formatLength(wall ? wall.length_ft : 0, 1) : `${wall ? wall.length_ft : 0}'`;
          ctx.fillStyle = "#78350f";
          ctx.font = "bold 10px Segoe UI";
          ctx.textAlign = "center";
          ctx.fillText(`${oriLabel} (${lenText})`, ax + nx * 14, ay + ny * 14);
        } else if (isWallHovered) {
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 3.0;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw compass orientation badge on all walls when room is selected
        if (isSelected && !isWallSelected && wall) {
          const midEdgeX = (p1.px + p2.px) / 2;
          const midEdgeY = (p1.py + p2.py) / 2;
          const polyScreen = pts.map(p => [p.px, p.py]);
          const norm = this.getEdgeOutwardNormal([p1.px, p1.py], [p2.px, p2.py], polyScreen);
          const nx = norm.nx;
          const ny = norm.ny;
          const badgeX = midEdgeX + nx * 14;
          const badgeY = midEdgeY + ny * 14;

          const az = this.compassToAzimuth(wall.orientation);
          const badgeText = az !== null ? `P${i + 1}: ${wall.orientation} (${az}°)` : `P${i + 1}: ${wall.orientation}`;

          ctx.font = "bold 9px Segoe UI";
          const tw = ctx.measureText(badgeText).width;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.strokeStyle = "#94a3b8";
          ctx.lineWidth = 1;
          ctx.fillRect(badgeX - tw / 2 - 4, badgeY - 7, tw + 8, 14);
          ctx.strokeRect(badgeX - tw / 2 - 4, badgeY - 7, tw + 8, 14);

          ctx.fillStyle = "#1e293b";
          ctx.textAlign = "center";
          ctx.fillText(badgeText, badgeX, badgeY + 3.5);
        }

        // Draw Windows on wall edge
        if (wall && wall.windows && wall.windows.length > 0) {
          const totWin = wall.windows.reduce((sum, w) => sum + (parseInt(w.qty) || 1), 0);
          const midEdgeX = (p1.px + p2.px) / 2;
          const midEdgeY = (p1.py + p2.py) / 2;
          const dx = (p2.px - p1.px);
          const dy = (p2.py - p1.py);
          const edgeLen = Math.hypot(dx, dy);
          if (edgeLen > 0) {
            const ux = dx / edgeLen;
            const uy = dy / edgeLen;
            const polyScreen = pts.map(p => [p.px, p.py]);
            const norm = this.getEdgeOutwardNormal([p1.px, p1.py], [p2.px, p2.py], polyScreen);
            const nx = norm.nx;
            const ny = norm.ny;

            const spanW = Math.min(edgeLen * 0.7, Math.max(16, totWin * 14));
            const wStartX = midEdgeX - (ux * spanW) / 2;
            const wStartY = midEdgeY - (uy * spanW) / 2;
            const wEndX = midEdgeX + (ux * spanW) / 2;
            const wEndY = midEdgeY + (uy * spanW) / 2;

            // Architectural double blue line
            ctx.strokeStyle = "#0284c7";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(wStartX + nx * 2, wStartY + ny * 2);
            ctx.lineTo(wEndX + nx * 2, wEndY + ny * 2);
            ctx.stroke();

            ctx.strokeStyle = "#38bdf8";
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.moveTo(wStartX - nx * 2, wStartY - ny * 2);
            ctx.lineTo(wEndX - nx * 2, wEndY - ny * 2);
            ctx.stroke();

            ctx.fillStyle = "#0369a1";
            ctx.font = "bold 9px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText(`🪟 x${totWin}`, midEdgeX + nx * 10, midEdgeY + ny * 10);
          }
        }

        // Draw Doors on wall edge
        if (wall && wall.doors && wall.doors.length > 0) {
          const totDoor = wall.doors.reduce((sum, d) => sum + (parseInt(d.qty) || 1), 0);
          const midEdgeX = (p1.px + p2.px) / 2;
          const midEdgeY = (p1.py + p2.py) / 2;
          const dx = (p2.px - p1.px);
          const dy = (p2.py - p1.py);
          const edgeLen = Math.hypot(dx, dy);
          if (edgeLen > 0) {
            const ux = dx / edgeLen;
            const uy = dy / edgeLen;
            const polyScreen = pts.map(p => [p.px, p.py]);
            const norm = this.getEdgeOutwardNormal([p1.px, p1.py], [p2.px, p2.py], polyScreen);
            const nx = norm.nx;
            const ny = norm.ny;
            const dGap = Math.min(edgeLen * 0.45, 18);

            ctx.strokeStyle = "#b45309";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(midEdgeX - (ux * dGap) / 2, midEdgeY - (uy * dGap) / 2);
            ctx.lineTo(midEdgeX + (ux * dGap) / 2, midEdgeY + (uy * dGap) / 2);
            ctx.stroke();

            ctx.fillStyle = "#92400e";
            ctx.font = "bold 9px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText(`🚪 x${totDoor}`, midEdgeX + nx * 12, midEdgeY + ny * 12);
          }
        }
      }

      // Corner handles if selected for interactive resizing
      if (isSelected && pts.length === 4) {
        pts.forEach((p, vIdx) => {
          const isVHover = this.hoveredVertexIdx === vIdx;
          ctx.fillStyle = isVHover ? "#f59e0b" : "#0284c7";
          ctx.fillRect(p.px - 5, p.py - 5, 10, 10);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(p.px - 5, p.py - 5, 10, 10);
        });
      }
    });

    // Drawing preview rectangle if dragging
    if (this.dragState && this.dragState.mode === "draw_rect") {
      const s = this.dragState;
      const p1 = this.modelToScreen(s.x0, s.y0, panX, panY);
      const p2 = this.modelToScreen(s.x1, s.y1, panX, panY);
      const rx = Math.min(p1.px, p2.px);
      const ry = Math.min(p1.py, p2.py);
      const rw = Math.abs(p2.px - p1.px);
      const rh = Math.abs(p2.py - p1.py);

      ctx.fillStyle = "rgba(147, 197, 253, 0.4)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      const wFt = Math.abs(s.x1 - s.x0);
      const hFt = Math.abs(s.y1 - s.y0);
      ctx.fillStyle = "#0284c7";
      ctx.font = "bold 11px Segoe UI";
      const isSI = typeof I18N !== "undefined" && I18N.isSI();
      const previewText = isSI
        ? `${(wFt * 0.3048).toFixed(1)} m x ${(hFt * 0.3048).toFixed(1)} m (${(wFt * hFt * 0.0929).toFixed(1)} m²)`
        : `${wFt} ft x ${hFt} ft (${wFt * hFt} sqft)`;
      ctx.fillText(previewText, rx + rw / 2, ry + rh / 2);
    }

    ctx.textAlign = "left";
    ctx.restore();
  },

  render3D(ctx, ox, oy, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, w, h);
    ctx.clip();

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12.5px Segoe UI";
    const orbitTitle = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR"
      ? "Modelo Isométrico 3D Extrudado (Órbita e Zoom com Mouse)"
      : "3D Extruded Building Model (Mouse Orbit & Zoom)";
    ctx.fillText(orbitTitle, ox + 15, oy + 22);

    const cx = ox + w / 2 + this.pan3d.x;
    const cy = oy + h / 2 + this.pan3d.y;
    const az = (this.rot3d.az * Math.PI) / 180.0;
    const el = (this.rot3d.el * Math.PI) / 180.0;

    const allSpaces = this.getAllSpaces();
    const activeSpaces = allSpaces.filter(sp => (sp.level || "Level 1") === this.activeLevel);
    const targetSpaces = activeSpaces.length > 0 ? activeSpaces : allSpaces;

    // Filter to primary architectural cluster to avoid distant sketch outliers from scaling down the building
    const mainCluster = targetSpaces.filter(sp => {
      if (!sp.geometry || !sp.geometry.polygon) return false;
      const cX = sp.geometry.polygon.reduce((s, p) => s + p[0], 0) / sp.geometry.polygon.length;
      const cY = sp.geometry.polygon.reduce((s, p) => s + p[1], 0) / sp.geometry.polygon.length;
      return cX <= 420 && cY <= 400;
    });
    const spacesToFit = mainCluster.length > 0 ? mainCluster : targetSpaces;

    let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
    spacesToFit.forEach(sp => {
      if (sp.geometry && sp.geometry.polygon) {
        sp.geometry.polygon.forEach(pt => {
          if (pt[0] < minX) minX = pt[0];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[1] > maxY) maxY = pt[1];
        });
      }
    });

    const midX = (minX + maxX) / 2 || 190;
    const midY = (minY + maxY) / 2 || 180;
    const spanX = Math.max(120, maxX - minX);
    const spanY = Math.max(120, maxY - minY);
    const maxSpan = Math.max(spanX, spanY);
    const fitScale = (Math.min(w, h) * 0.82) / maxSpan;
    const s3 = fitScale * this.zoom3d;

    const project3D = (x, y, z) => {
      const dx = (x - midX) * s3;
      const dy = (y - midY) * s3;
      const dz = z * 3.8 * s3;
      const xr = dx * Math.cos(az) - dy * Math.sin(az);
      const yr = dx * Math.sin(az) + dy * Math.cos(az);
      return {
        px: cx + xr,
        py: cy + yr * Math.sin(el) - dz * Math.cos(el),
        depth: yr * Math.cos(el) + dz * Math.sin(el),
      };
    };

    const faces = [];
    allSpaces.forEach(sp => {
      if (!sp.geometry || !sp.geometry.polygon) return;
      const pts = sp.geometry.polygon;
      const baseZ = sp.level === "Level 2" ? 12 : 0;
      const topZ = baseZ + 12;
      const color = this.getSpaceColor(sp);
      const isSpaceSelected = sp.id === this.selectedSpaceId;

      const botPts = pts.map(p => project3D(p[0], p[1], baseZ));
      const topPts = pts.map(p => project3D(p[0], p[1], topZ));

      // Wall faces
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        const b1 = botPts[i], b2 = botPts[j], t2 = topPts[j], t1 = topPts[i];
        const avgDepth = (b1.depth + b2.depth + t1.depth + t2.depth) / 4;
        const isWallSelected = isSpaceSelected && (this.selectedWallIdx === i);
        const wall = sp.walls && sp.walls[i];

        faces.push({
          type: "wall",
          wallIndex: i,
          spaceId: sp.id,
          poly: [b1, b2, t2, t1],
          color: isWallSelected ? "#fde68a" : (i % 2 === 0 ? "#cbd5e1" : "#94a3b8"),
          depth: avgDepth,
          selected: isWallSelected,
          spaceSelected: isSpaceSelected,
          wall: wall,
          windows: wall ? wall.windows : [],
          doors: wall ? wall.doors : [],
        });
      }

      // Roof face
      const roofDepth = topPts.reduce((sum, p) => sum + p.depth, 0) / topPts.length;
      faces.push({
        type: "roof",
        poly: topPts,
        color: color,
        depth: roofDepth + 5,
        selected: isSpaceSelected,
        space: sp,
      });
    });

    // Painter's algorithm: sort faces from back to front (largest depth first)
    faces.sort((a, b) => b.depth - a.depth);

    faces.forEach(f => {
      ctx.beginPath();
      f.poly.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
      ctx.closePath();
      ctx.fillStyle = f.selected ? "#f59e0b" : (f.spaceSelected && f.type === "roof" ? "#38bdf8" : f.color);
      ctx.fill();
      ctx.strokeStyle = f.selected ? "#b45309" : (f.spaceSelected ? "#0284c7" : "#475569");
      ctx.lineWidth = f.selected ? 2.8 : (f.spaceSelected ? 2.0 : 0.9);
      ctx.stroke();

      // Bilinear interpolation helper for exact quad face projection
      if (f.poly.length === 4) {
        const [b1, b2, t2, t1] = f.poly;
        const lerpFace = (u, v) => ({
          px: (1 - u) * (1 - v) * b1.px + u * (1 - v) * b2.px + u * v * t2.px + (1 - u) * v * t1.px,
          py: (1 - u) * (1 - v) * b1.py + u * (1 - v) * b2.py + u * v * t2.py + (1 - u) * v * t1.py,
        });

        // Render windows on 3D wall face
        if (f.windows && f.windows.length > 0) {
          const wP = [
            lerpFace(0.20, 0.28),
            lerpFace(0.80, 0.28),
            lerpFace(0.80, 0.85),
            lerpFace(0.20, 0.85),
          ];
          ctx.beginPath();
          wP.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
          ctx.closePath();
          ctx.fillStyle = "rgba(56, 189, 248, 0.85)";
          ctx.fill();
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Render doors on 3D wall face
        if (f.doors && f.doors.length > 0) {
          const dP = [
            lerpFace(0.35, 0.0),
            lerpFace(0.65, 0.0),
            lerpFace(0.65, 0.75),
            lerpFace(0.35, 0.75),
          ];
          ctx.beginPath();
          dP.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
          ctx.closePath();
          ctx.fillStyle = "rgba(180, 83, 9, 0.9)";
          ctx.fill();
          ctx.strokeStyle = "#78350f";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Roof label
      if (f.type === "roof" && f.space) {
        const rx = f.poly.reduce((s, p) => s + p.px, 0) / f.poly.length;
        const ry = f.poly.reduce((s, p) => s + p.py, 0) / f.poly.length;
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 9.5px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText(f.space.name.split(" - ")[0], rx, ry + 3);
      }
    });

    // 3D Compass / Orientation Rose (HAP 6.4 ViewCube Style)
    const compX = ox + w - 46;
    const compY = oy + 46;
    const compR = 26;

    ctx.save();
    ctx.translate(compX, compY);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, compR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Rotated Cardinal points according to model 3D azimuth
    const compAngle = -az; // Clockwise view rotation
    const drawCardinal = (radOffset, label, color, isBold) => {
      const ang = compAngle + radOffset;
      const lx = Math.cos(ang) * (compR - 8);
      const ly = Math.sin(ang) * (compR - 8);
      ctx.fillStyle = color;
      ctx.font = isBold ? "bold 10.5px Segoe UI" : "600 9px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, lx, ly);
    };

    // North points up in standard plan view (angle -PI/2)
    const isPTComp = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";
    drawCardinal(-Math.PI / 2, "N", "#dc2626", true);
    drawCardinal(0, isPTComp ? "L" : "E", "#475569", false);
    drawCardinal(Math.PI / 2, "S", "#475569", false);
    drawCardinal(Math.PI, isPTComp ? "O" : "W", "#475569", false);

    // North Indicator Arrow
    const nArrowAngle = compAngle - Math.PI / 2;
    ctx.strokeStyle = "#dc2626";
    ctx.fillStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(nArrowAngle) * (compR - 13), Math.sin(nArrowAngle) * (compR - 13));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(nArrowAngle) * (compR - 13), Math.sin(nArrowAngle) * (compR - 13), 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.textAlign = "left";
    ctx.restore();
  },

  attachEventListeners(cvs) {
    cvs.addEventListener("mousedown", (e) => this.onMouseDown(e, cvs));
    cvs.addEventListener("mousemove", (e) => this.onMouseMove(e, cvs));
    cvs.addEventListener("mouseup", (e) => this.onMouseUp(e, cvs));
    cvs.addEventListener("wheel", (e) => this.onWheel(e, cvs), { passive: false });
    cvs.addEventListener("contextmenu", (e) => this.onContextMenu(e, cvs));
    window.addEventListener("click", (e) => {
      const menu = document.getElementById("cad-context-menu");
      if (menu && menu.style.display !== "none" && !menu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  },

  onMouseDown(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const splitX = this.viewMode === "split" ? cvs.width * 0.52 : (this.viewMode === "3d" ? 0 : cvs.width);

    if (mx < splitX && this.viewMode !== "3d") {
      // Right click is reserved for CAD context menu
      if (e.button === 2) return;
      const panX = this.pan2d.x;
      const panY = this.pan2d.y;
      const mPt = this.screenToModel(mx, my, panX, panY);

      // 1. Check if clicking on an interactive resize handle of the currently selected room
      const selSp = this.getSelectedSpace();
      if (selSp && selSp.geometry && selSp.geometry.polygon && selSp.geometry.polygon.length === 4) {
        const polyScreen = selSp.geometry.polygon.map(p => this.modelToScreen(p[0], p[1], panX, panY));
        for (let vIdx = 0; vIdx < polyScreen.length; vIdx++) {
          if (Math.hypot(mx - polyScreen[vIdx].px, my - polyScreen[vIdx].py) <= 9) {
            this.dragState = {
              mode: "resize_vertex",
              space: selSp,
              vertexIdx: vIdx,
              startX: mPt.x,
              startY: mPt.y,
              origPoly: JSON.parse(JSON.stringify(selSp.geometry.polygon)),
            };
            this.render();
            return;
          }
        }
      }

      // 2. Draw rectangle tool
      if (this.currentTool === "draw_rect") {
        this.dragState = { mode: "draw_rect", x0: mPt.x, y0: mPt.y, x1: mPt.x, y1: mPt.y };
        return;
      }

      // 3. Room hit testing
      const spaces = this.getSpacesOnLevel(this.activeLevel);
      let hitSpace = null;
      for (const sp of spaces) {
        if (sp.geometry && this.isPointInsidePoly(mPt.x, mPt.y, sp.geometry.polygon)) {
          hitSpace = sp;
          break;
        }
      }

      if (hitSpace) {
        this.selectedSpaceId = hitSpace.id;
        const pts = hitSpace.geometry.polygon;
        let closestWall = 0;
        let minD = 999999;
        for (let i = 0; i < pts.length; i++) {
          const d = this.distToSegment(mPt.x, mPt.y, pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]);
          if (d < minD) {
            minD = d;
            closestWall = i;
          }
        }
        if (minD < 8.0) {
          this.selectedWallIdx = closestWall;
        } else if (this.selectedWallIdx === null || this.selectedWallIdx >= pts.length) {
          this.selectedWallIdx = 0;
        }

        // Pending select/move with 5px drag threshold to prevent accidental movement on clicks
        this.dragState = {
          mode: "pending_select_or_move",
          space: hitSpace,
          startX: mPt.x,
          startY: mPt.y,
          startScreenX: mx,
          startScreenY: my,
          origPoly: JSON.parse(JSON.stringify(hitSpace.geometry.polygon)),
        };
      } else {
        this.selectedSpaceId = null;
        this.dragState = { mode: "pan_2d", startScreenX: mx, startScreenY: my, origPan: { ...this.pan2d } };
      }
      this.render();
    } else {
      this.drag3d = {
        startX: mx,
        startY: my,
        origAz: this.rot3d.az,
        origEl: this.rot3d.el,
        isPan: e.button === 2 || e.shiftKey,
        origPan: { ...this.pan3d }
      };
    }
  },

  onMouseMove(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const splitX = this.viewMode === "split" ? cvs.width * 0.52 : (this.viewMode === "3d" ? 0 : cvs.width);
    const panX = this.pan2d.x;
    const panY = this.pan2d.y;

    if (this.dragState) {
      const mPt = this.screenToModel(mx, my, panX, panY);

      if (this.dragState.mode === "draw_rect") {
        this.dragState.x1 = mPt.x;
        this.dragState.y1 = mPt.y;
        this.render();
      } else if (this.dragState.mode === "pending_select_or_move") {
        if (Math.hypot(mx - this.dragState.startScreenX, my - this.dragState.startScreenY) > 5) {
          this.dragState.mode = "move_room";
        }
      } else if (this.dragState.mode === "move_room") {
        const dx = mPt.x - this.dragState.startX;
        const dy = mPt.y - this.dragState.startY;
        const sp = this.dragState.space;
        const snap = this.gridSnap;
        sp.geometry.polygon = this.dragState.origPoly.map(pt => [
          Math.round((pt[0] + dx) / snap) * snap,
          Math.round((pt[1] + dy) / snap) * snap
        ]);
        this.syncSpaceFromGeometry(sp);
        this.render();
      } else if (this.dragState.mode === "resize_vertex") {
        const sp = this.dragState.space;
        const vIdx = this.dragState.vertexIdx;
        const orig = this.dragState.origPoly;
        const snap = this.gridSnap;
        const nX = Math.round(mPt.x / snap) * snap;
        const nY = Math.round(mPt.y / snap) * snap;

        // Keep 4-point orthogonal room rectangular when moving a corner
        const poly = JSON.parse(JSON.stringify(orig));
        poly[vIdx] = [nX, nY];
        if (vIdx === 0) {
          poly[1][1] = nY;
          poly[3][0] = nX;
        } else if (vIdx === 1) {
          poly[0][1] = nY;
          poly[2][0] = nX;
        } else if (vIdx === 2) {
          poly[3][1] = nY;
          poly[1][0] = nX;
        } else if (vIdx === 3) {
          poly[2][1] = nY;
          poly[0][0] = nX;
        }
        sp.geometry.polygon = poly;
        this.syncSpaceFromGeometry(sp);
        this.render();
      } else if (this.dragState.mode === "pan_2d") {
        this.pan2d.x = this.dragState.origPan.x + (mx - this.dragState.startScreenX);
        this.pan2d.y = this.dragState.origPan.y + (my - this.dragState.startScreenY);
        this.render();
      }
    } else if (mx < splitX && this.viewMode !== "3d") {
      // Dynamic cursor and hover detection
      const sp = this.getSelectedSpace();
      let hoveredVertex = null;
      if (sp && sp.geometry && sp.geometry.polygon && sp.geometry.polygon.length === 4) {
        const polyScreen = sp.geometry.polygon.map(p => this.modelToScreen(p[0], p[1], panX, panY));
        for (let vIdx = 0; vIdx < polyScreen.length; vIdx++) {
          if (Math.hypot(mx - polyScreen[vIdx].px, my - polyScreen[vIdx].py) <= 8) {
            hoveredVertex = vIdx;
            break;
          }
        }
      }

      if (hoveredVertex !== null) {
        this.hoveredVertexIdx = hoveredVertex;
        cvs.style.cursor = "crosshair";
        this.render();
      } else {
        if (this.hoveredVertexIdx !== null) {
          this.hoveredVertexIdx = null;
          this.render();
        }
        cvs.style.cursor = this.currentTool === "draw_rect" ? "crosshair" : "default";

        // Wall edge hover detection
        if (sp && sp.geometry && sp.geometry.polygon) {
          const mPt = this.screenToModel(mx, my, panX, panY);
          const pts = sp.geometry.polygon;
          let closest = null, minD = 999999;
          for (let i = 0; i < pts.length; i++) {
            const d = this.distToSegment(mPt.x, mPt.y, pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]);
            if (d < minD) { minD = d; closest = i; }
          }
          if (minD < 5.0 && closest !== this.hoveredWallIdx) {
            this.hoveredWallIdx = closest;
            this.render();
          } else if (minD >= 5.0 && this.hoveredWallIdx !== null) {
            this.hoveredWallIdx = null;
            this.render();
          }
        }
      }
    }

    if (this.drag3d) {
      if (this.drag3d.isPan) {
        this.pan3d.x = this.drag3d.origPan.x + (mx - this.drag3d.startX);
        this.pan3d.y = this.drag3d.origPan.y + (my - this.drag3d.startY);
      } else {
        const dAz = (mx - this.drag3d.startX) * 0.5;
        const dEl = (my - this.drag3d.startY) * 0.4;
        this.rot3d.az = (this.drag3d.origAz + dAz + 360) % 360;
        this.rot3d.el = Math.max(15, Math.min(85, this.drag3d.origEl + dEl));
      }
      this.render();
    }
  },

  onMouseUp() {
    if (this.dragState) {
      if (this.dragState.mode === "draw_rect") {
        const s = this.dragState;
        const xMin = Math.min(s.x0, s.x1);
        const yMin = Math.min(s.y0, s.y1);
        const w = Math.abs(s.x1 - s.x0);
        const h = Math.abs(s.y1 - s.y0);

        if (w >= 10 && h >= 10) {
          this.createNewRoomFromRect(xMin, yMin, w, h);
        }
      } else if (this.dragState.mode === "move_room" || this.dragState.mode === "resize_vertex") {
        app.triggerAutoRecalculate();
      }
      this.dragState = null;
      this.render();
    }
    this.drag3d = null;
  },

  onWheel(e, cvs) {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const splitX = this.viewMode === "split" ? cvs.width * 0.52 : (this.viewMode === "3d" ? 0 : cvs.width);

    if (mx < splitX && this.viewMode !== "3d") {
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
      this.zoom2d = Math.max(0.4, Math.min(4.0, this.zoom2d * zoomFactor));
    } else {
      const zoomFactor = e.deltaY < 0 ? 1.10 : 0.90;
      this.zoom3d = Math.max(0.3, Math.min(3.5, this.zoom3d * zoomFactor));
    }
    this.render();
  },

  onKeyDown(e) {
    if (e.key === "Escape") {
      this.hideContextMenu();
    }
    if (e.key === "Delete" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") {
      this.deleteSelectedRoom();
    }
  },

  isPointInsidePoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  },

  createNewRoomFromRect(x, y, w, h) {
    const proj = app.state.project;
    if (!proj || !proj.space_models || !proj.space_models[0]) return;
    const spaces = proj.space_models[0].spaces;
    const newIdx = spaces.length + 1;
    const newId = `S_ROOM_${Date.now()}`;
    const newName = `Room ${newIdx} (${w}x${h})`;

    const newSpace = {
      id: newId,
      index: newIdx,
      name: newName,
      level: this.activeLevel,
      zone_id: `Z_ROOM_${newIdx}`,
      zone_name: `${newName} Zone`,
      floor_area_sqft: w * h,
      volume_cuft: w * h * 9.0,
      ceiling_height_ft: 9.0,
      interior_wall_sqft: (w + h) * 9.0,
      exterior_wall_sqft: 2 * (w + h) * 12.0,
      exposure: "S",
      window_qty: 2,
      door_qty: 0,
      space_type: "Office - Open Plan",
      ashrae_62_usage: "OFFICE: Office space",
      oa_req1_cfm_person: 5.0,
      oa_req2_cfm_sqft: 0.06,
      overhead_lighting_w_sqft: 0.66,
      elec_eqpt_w_sqft: 0.75,
      occupancy_people: Math.max(1, Math.round((w * h) / 200)),
      occupancy_schedule_id: "956582207",
      lighting_schedule_id: "211440243",
      elec_schedule_id: "211440243",
      sensible_btuh_person: 245.0,
      latent_btuh_person: 205.0,
      infiltration_clg_ach: 0.20,
      infiltration_htg_ach: 0.20,
      infiltration_occurs: "Unoccupied",
      geometry: {
        level: this.activeLevel,
        polygon: [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ]
      }
    };

    this.syncSpaceFromGeometry(newSpace);
    spaces.push(newSpace);
    this.selectedSpaceId = newId;
    this.selectedWallIdx = 0;
    this.currentTool = "select";
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  deleteSelectedRoom() {
    if (!this.selectedSpaceId) return;
    const spaces = app.state.project.space_models[0].spaces;
    const idx = spaces.findIndex(s => s.id === this.selectedSpaceId);
    if (idx >= 0) {
      spaces.splice(idx, 1);
      this.selectedSpaceId = spaces.length > 0 ? spaces[0].id : null;
      this.selectedWallIdx = 0;
      this.render();
      app.refreshAllUI();
      app.triggerAutoRecalculate();
    }
  },

  splitSelectedPerimeterCore(depthFt = 15.0) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.geometry || !sp.geometry.polygon || sp.geometry.polygon.length !== 4) {
      alert("Please select a rectangular room to split into Perimeter & Core zones.");
      return;
    }
    const pts = sp.geometry.polygon;
    const x0 = pts[0][0], y0 = pts[0][1];
    const x1 = pts[2][0], y1 = pts[2][1];
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);

    if (w < depthFt * 2.5 || h < depthFt * 2.5) {
      alert(`Room dimensions (${w}' x ${h}') are too small for ${depthFt}' perimeter depth.`);
      return;
    }

    const spaces = app.state.project.space_models[0].spaces;
    const origIdx = spaces.findIndex(s => s.id === sp.id);
    spaces.splice(origIdx, 1);

    const subDefs = [
      { name: `${sp.name} - North Perim`, poly: [[x0, y1 - depthFt], [x1, y1 - depthFt], [x1, y1], [x0, y1]] },
      { name: `${sp.name} - East Perim`,  poly: [[x1 - depthFt, y0 + depthFt], [x1, y0 + depthFt], [x1, y1 - depthFt], [x1 - depthFt, y1 - depthFt]] },
      { name: `${sp.name} - South Perim`, poly: [[x0, y0], [x1, y0], [x1, y0 + depthFt], [x0, y0 + depthFt]] },
      { name: `${sp.name} - West Perim`,  poly: [[x0, y0 + depthFt], [x0 + depthFt, y0 + depthFt], [x0 + depthFt, y1 - depthFt], [x0, y1 - depthFt]] },
      { name: `${sp.name} - Core`,        poly: [[x0 + depthFt, y0 + depthFt], [x1 - depthFt, y0 + depthFt], [x1 - depthFt, y1 - depthFt], [x0 + depthFt, y1 - depthFt]] },
    ];

    subDefs.forEach((def, i) => {
      const nSp = JSON.parse(JSON.stringify(sp));
      nSp.id = `S_SPLIT_${Date.now()}_${i}`;
      nSp.name = def.name;
      nSp.zone_id = `Z_SPLIT_${Date.now()}_${i}`;
      nSp.zone_name = `${def.name} Zone`;
      nSp.geometry = { level: sp.level, polygon: def.poly };
      this.syncSpaceFromGeometry(nSp);
      spaces.push(nSp);
    });

    this.selectedSpaceId = spaces[spaces.length - 1].id;
    this.selectedWallIdx = 0;
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  // Interactive Wall & Openings Inspector Renderer
  renderWallInspector() {
    const el = document.getElementById("cad-wall-inspector");
    if (!el) return;

    const sp = this.getSelectedSpace();
    if (!sp) {
      const emptyMsg = typeof I18N !== "undefined" ? I18N.t("cad.empty_inspector") : "👈 Click on any room on the floor plan to inspect its walls.";
      el.innerHTML = `
        <div style="color:#64748b;font-style:italic;padding:12px;text-align:center">
          ${emptyMsg}
        </div>
      `;
      return;
    }

    const walls = sp.walls || [];
    if (this.selectedWallIdx === null || this.selectedWallIdx < 0 || this.selectedWallIdx >= walls.length) {
      this.selectedWallIdx = 0;
    }
    const selIdx = this.selectedWallIdx;
    const wall = walls[selIdx];

    const isPT = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR";
    const wallTabsHtml = walls.map((w, idx) => {
      const act = idx === selIdx ? "active" : "";
      let oriStr = w.orientation;
      if (typeof I18N !== "undefined") {
        oriStr = I18N.t("compass." + w.orientation).split(" (")[0] || w.orientation;
      }
      const oriIcon = w.is_interior ? (isPT ? "🚪 Divisória" : "🚪 Partition") : `🧭 ${oriStr}`;
      const winCount = (w.windows || []).reduce((s, wi) => s + (parseInt(wi.qty) || 1), 0);
      const doorCount = (w.doors || []).reduce((s, di) => s + (parseInt(di.qty) || 1), 0);
      const tags = (winCount > 0 ? ` 🪟${winCount}` : "") + (doorCount > 0 ? ` 🚪${doorCount}` : "");
      const lenFmt = typeof I18N !== "undefined" ? I18N.formatLength(w.length_ft, 1) : `${w.length_ft}'`;
      const tabPrefix = typeof I18N !== "undefined" ? I18N.t("cad.wall_tab_prefix") : "Wall";
      return `
        <button class="wall-tab-btn ${act}" onclick="modeler.selectWallTab(${idx})">
          🧱 ${tabPrefix} ${idx + 1} (${oriIcon}, ${lenFmt})${tags}
        </button>
      `;
    }).join("");

    if (!wall) {
      el.innerHTML = `<div class="wall-tabs-row">${wallTabsHtml}</div>`;
      return;
    }

    // Wall libraries lookup
    const wallLibs = (app.state.project.libraries && app.state.project.libraries.walls) || [];
    const winLibs = (app.state.project.libraries && app.state.project.libraries.windows) || [];
    const doorLibs = (app.state.project.libraries && app.state.project.libraries.doors) || [];

    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const wallOptionsHtml = wallLibs.map(wl => {
      const uFmt = isSI ? `U=${(wl.overall_u * 5.67826).toFixed(3)} W/m²K` : `U=${wl.overall_u}`;
      return `<option value="${wl.id}" ${wl.id === wall.wall_assembly_id ? "selected" : ""}>${wl.name} (${uFmt})</option>`;
    }).join("");

    const orientationOptionsHtml = this.COMPASS_CARDINALS.map(c => {
      const lbl = typeof I18N !== "undefined" ? I18N.t("compass." + c.code) : c.label;
      return `<option value="${c.code}" ${c.code === wall.orientation ? "selected" : ""}>${lbl}</option>`;
    }).join("");

    // Calculate window and door total areas
    const ceilingH = parseFloat(sp.ceiling_height_ft || 9.0);
    const grossArea = Math.round(wall.length_ft * ceilingH * 10) / 10;
    let winAreaTot = 0.0;
    let doorAreaTot = 0.0;

    const windowsListHtml = (wall.windows || []).map((wi, wIdx) => {
      const winLib = winLibs.find(l => l.id === wi.window_id) || winLibs[0] || { width_ft: 3.5, height_ft: 6.0 };
      const wW = wi.width_ft || winLib.width_ft || 3.5;
      const wH = wi.height_ft || winLib.height_ft || 6.0;
      const qty = parseInt(wi.qty) || 1;
      const a = Math.round(wW * wH * qty * 10) / 10;
      winAreaTot += a;

      const optHtml = winLibs.map(wl => `<option value="${wl.id}" ${wl.id === wi.window_id ? "selected" : ""}>${wl.name}</option>`).join("");
      const dimLabel = isSI
        ? `${(wW * 0.3048).toFixed(2)}m x ${(wH * 0.3048).toFixed(2)}m (${(a * 0.0929).toFixed(2)} m²)`
        : `${wW}'x${wH}' (${a} sqft)`;
      return `
        <div class="aperture-card">
          <select onchange="modeler.updateWindowOnWall(${selIdx}, ${wIdx}, 'window_id', this.value)">${optHtml}</select>
          <label style="font-size:10px">${isPT ? "Qtd:" : "Qty:"} <input type="number" min="1" max="20" value="${qty}" onchange="modeler.updateWindowOnWall(${selIdx}, ${wIdx}, 'qty', this.value)" /></label>
          <span style="color:#0369a1;font-weight:600">${dimLabel}</span>
          <button class="btn-xs danger" onclick="modeler.removeWindowFromWall(${selIdx}, ${wIdx})" title="Remove Window">✕</button>
        </div>
      `;
    }).join("");

    const doorsListHtml = (wall.doors || []).map((di, dIdx) => {
      const doorLib = doorLibs.find(l => l.id === di.door_id) || doorLibs[0] || { width_ft: 6.0, height_ft: 8.0 };
      const dW = di.width_ft || doorLib.width_ft || 6.0;
      const dH = di.height_ft || doorLib.height_ft || 8.0;
      const qty = parseInt(di.qty) || 1;
      const a = Math.round(dW * dH * qty * 10) / 10;
      doorAreaTot += a;

      const optHtml = doorLibs.map(dl => `<option value="${dl.id}" ${dl.id === di.door_id ? "selected" : ""}>${dl.name}</option>`).join("");
      const dimLabel = isSI
        ? `${(dW * 0.3048).toFixed(2)}m x ${(dH * 0.3048).toFixed(2)}m (${(a * 0.0929).toFixed(2)} m²)`
        : `${dW}'x${dH}' (${a} sqft)`;
      return `
        <div class="aperture-card">
          <select onchange="modeler.updateDoorOnWall(${selIdx}, ${dIdx}, 'door_id', this.value)">${optHtml}</select>
          <label style="font-size:10px">${isPT ? "Qtd:" : "Qty:"} <input type="number" min="1" max="10" value="${qty}" onchange="modeler.updateDoorOnWall(${selIdx}, ${dIdx}, 'qty', this.value)" /></label>
          <span style="color:#b45309;font-weight:600">${dimLabel}</span>
          <button class="btn-xs danger" onclick="modeler.removeDoorFromWall(${selIdx}, ${dIdx})" title="Remove Door">✕</button>
        </div>
      `;
    }).join("");

    const netWallArea = Math.max(0, Math.round((grossArea - winAreaTot - doorAreaTot) * 10) / 10);
    const areaFmt = typeof I18N !== "undefined" ? I18N.formatArea(sp.floor_area_sqft) : `${sp.floor_area_sqft} sqft`;
    const lenFmt = typeof I18N !== "undefined" ? I18N.formatLength(wall.length_ft, 2) : `${wall.length_ft} ft`;
    const ceilFmt = typeof I18N !== "undefined" ? I18N.formatLength(ceilingH, 2) : `${ceilingH} ft`;
    const grossFmt = typeof I18N !== "undefined" ? I18N.formatArea(grossArea, 1) : `${grossArea} sqft`;
    const winFmt = typeof I18N !== "undefined" ? I18N.formatArea(winAreaTot, 1) : `${winAreaTot} sqft`;
    const doorFmt = typeof I18N !== "undefined" ? I18N.formatArea(doorAreaTot, 1) : `${doorAreaTot} sqft`;
    const netFmt = typeof I18N !== "undefined" ? I18N.formatArea(netWallArea, 1) : `${netWallArea} sqft`;

    const curAz = this.compassToAzimuth(wall.orientation);
    const peakFlux = this.getPeakSolarFlux(wall.orientation);

    let oppText = "—";
    let perpText = "—";

    if (sp.walls && sp.walls.length === 4) {
      const oppIdx = (selIdx + 2) % 4;
      const oppWall = sp.walls[oppIdx];
      const oppAz = this.compassToAzimuth(oppWall.orientation);
      oppText = `${isPT ? "Parede" : "Wall"} ${oppIdx + 1}: ${oppWall.orientation}${oppAz !== null ? ` (${oppAz}°)` : ""}`;

      const p1Idx = (selIdx + 1) % 4;
      const p2Idx = (selIdx + 3) % 4;
      const p1Wall = sp.walls[p1Idx];
      const p2Wall = sp.walls[p2Idx];
      perpText = `P${p1Idx + 1}: ${p1Wall.orientation} | P${p2Idx + 1}: ${p2Wall.orientation}`;
    } else if (sp.walls && sp.walls.length > 4) {
      const oppIdx = (selIdx + Math.floor(sp.walls.length / 2)) % sp.walls.length;
      const oppWall = sp.walls[oppIdx];
      oppText = `${isPT ? "Parede" : "Wall"} ${oppIdx + 1}: ${oppWall.orientation}`;
      perpText = `Total: ${sp.walls.length} ${isPT ? "paredes" : "walls"}`;
    }

    const solarCardHtml = (curAz !== null) ? `
      <div class="solar-incidence-card">
        <div class="sic-title">${typeof I18N !== "undefined" ? I18N.t("cad.solar_incidence_title") : "☀️ Ângulo de Incidência Solar & Azimute"}</div>
        <div class="sic-grid">
          <div class="sic-item">
            <span class="lbl">${typeof I18N !== "undefined" ? I18N.t("cad.wall_azimuth_label") : "Azimute da Parede:"}</span>
            <span class="val">${curAz}° (${wall.orientation})</span>
          </div>
          <div class="sic-item">
            <span class="lbl">${typeof I18N !== "undefined" ? I18N.t("cad.peak_solar_flux_label") : "Radiação de Pico:"}</span>
            <span class="val">${peakFlux}</span>
          </div>
          <div class="sic-item">
            <span class="lbl">${typeof I18N !== "undefined" ? I18N.t("cad.opposite_wall_label") : "Parede Oposta (180°):"}</span>
            <span class="val">${oppText}</span>
          </div>
          <div class="sic-item">
            <span class="lbl">${typeof I18N !== "undefined" ? I18N.t("cad.adjacent_walls_label") : "Perpendiculares (90°/270°):"}</span>
            <span class="val">${perpText}</span>
          </div>
        </div>
      </div>
    ` : "";

    el.innerHTML = `
      <div class="wall-inspector-header">
        <div class="wi-title">
          🏢 <strong>${sp.name}</strong> — ${typeof I18N !== "undefined" ? I18N.t("cad.wall_inspector_title") : "Wall & Openings Inspector"}
        </div>
        <div class="wi-meta">
          ${typeof I18N !== "undefined" ? I18N.t("cad.level") : "Level:"} <strong>${sp.level}</strong> | ${isPT ? "Área" : "Area"}: <strong>${areaFmt}</strong> | ${isPT ? "Zona" : "Zone"}: <strong>${sp.zone_name}</strong> | ${isPT ? "Exposição" : "Exposure"}: <strong>${sp.exposure}</strong>
        </div>
      </div>

      <div class="wall-tabs-row">${wallTabsHtml}</div>

      <div class="wall-detail-grid">
        <!-- Col 1: Wall Properties -->
        <div class="wall-prop-col">
          <label>${typeof I18N !== "undefined" ? I18N.t("cad.orientation_label") : "Orientation / Solar Exposure:"}
            <select onchange="modeler.setWallOrientation(${selIdx}, this.value)">
              ${orientationOptionsHtml}
            </select>
          </label>

          <div class="solar-prop-toggle">
            <label>
              <input type="checkbox" id="cad-auto-propagate" ${this.autoPropagateOrientations ? "checked" : ""} onchange="modeler.autoPropagateOrientations = this.checked" />
              <span>${typeof I18N !== "undefined" ? I18N.t("cad.auto_propagate_label") : "Calcular automaticamente as outras 3 paredes (90° / 180° / 270°)"}</span>
            </label>
          </div>

          <div>
            <span style="font-size:10.5px;font-weight:600;color:#64748b">${typeof I18N !== "undefined" ? I18N.t("cad.quick_orientations") : "Atalhos Rápidos de Orientação:"}</span>
            <div class="quick-ori-row">
              <button type="button" class="quick-ori-btn ${wall.orientation === 'N' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'N')">N (0°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'NE' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'NE')">NE (45°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'E' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'E')">L / E (90°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'SE' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'SE')">SE (135°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'S' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'S')">S (180°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'SW' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'SW')">SO / SW (225°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'W' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'W')">O / W (270°)</button>
              <button type="button" class="quick-ori-btn ${wall.orientation === 'NW' ? 'active' : ''}" onclick="modeler.setWallOrientation(${selIdx}, 'NW')">NO / NW (315°)</button>
            </div>
          </div>

          ${solarCardHtml}

          <label style="margin-top:4px">${typeof I18N !== "undefined" ? I18N.t("cad.assembly_label") : "Wall Construction Assembly:"}
            <select onchange="modeler.setWallAssembly(${selIdx}, this.value)">
              ${wallOptionsHtml}
            </select>
          </label>
          <div class="wall-dim-readout">
            <div>${typeof I18N !== "undefined" ? I18N.t("cad.length") : "Length:"} <strong>${lenFmt}</strong> | ${typeof I18N !== "undefined" ? I18N.t("cad.ceiling_height") : "Floor-to-Ceiling:"} <strong>${ceilFmt}</strong></div>
            <div>${typeof I18N !== "undefined" ? I18N.t("cad.gross_area") : "Gross Wall:"} <strong>${grossFmt}</strong> | ${typeof I18N !== "undefined" ? I18N.t("cad.windows_area") : "Windows:"} <strong>${winFmt}</strong> | ${typeof I18N !== "undefined" ? I18N.t("cad.doors_area") : "Doors:"} <strong>${doorFmt}</strong></div>
            <div style="font-size:11.5px;color:#005a9e;margin-top:2px">${typeof I18N !== "undefined" ? I18N.t("cad.net_area") : "Net Conduction Area:"} <strong>${netFmt}</strong></div>
          </div>
        </div>

        <!-- Col 2: Windows -->
        <div class="wall-aperture-col">
          <div class="aperture-header">
            <span>🪟 ${typeof I18N !== "undefined" ? I18N.t("cad.windows_col_title") : "Windows on Wall"} ${selIdx + 1} (${(wall.windows || []).length})</span>
            <button class="btn-xs primary" onclick="modeler.addWindowToWall(${selIdx})">${typeof I18N !== "undefined" ? I18N.t("cad.add_win_btn") : "+ Add Window"}</button>
          </div>
          <div class="aperture-list">
            ${windowsListHtml || `<div style="color:#94a3b8;font-style:italic;padding:8px;font-size:11px">${typeof I18N !== "undefined" ? I18N.t("cad.no_windows") : "No windows on this wall."}</div>`}
          </div>
        </div>

        <!-- Col 3: Doors -->
        <div class="wall-aperture-col">
          <div class="aperture-header">
            <span>🚪 ${typeof I18N !== "undefined" ? I18N.t("cad.doors_col_title") : "Doors on Wall"} ${selIdx + 1} (${(wall.doors || []).length})</span>
            <button class="btn-xs primary" onclick="modeler.addDoorToWall(${selIdx})">${typeof I18N !== "undefined" ? I18N.t("cad.add_door_btn") : "+ Add Door"}</button>
          </div>
          <div class="aperture-list">
            ${doorsListHtml || `<div style="color:#94a3b8;font-style:italic;padding:8px;font-size:11px">${typeof I18N !== "undefined" ? I18N.t("cad.no_doors") : "No doors on this wall."}</div>`}
          </div>
        </div>
      </div>
    `;
  },

  selectWallTab(idx) {
    this.selectedWallIdx = idx;
    this.render();
  },

  setWallOrientation(wIdx, newOri, forcePropagate = null) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx]) return;
    const shouldPropagate = forcePropagate !== null ? forcePropagate : this.autoPropagateOrientations;

    const w = sp.walls[wIdx];
    w.orientation = newOri;
    w.custom_orientation = true;
    w.is_interior = newOri === "Partition";

    const targetAz = this.compassToAzimuth(newOri);

    if (shouldPropagate && targetAz !== null && sp.walls.length >= 3) {
      // Base geometric normal angle for this target wall
      const baseAngle = this.getWallGeometricAngle(sp, wIdx);
      // Angular rotation delta needed to place target wall at targetAz
      const deltaTheta = ((targetAz - baseAngle) % 360 + 360) % 360;

      // Automatically propagate to all other walls in the space
      for (let j = 0; j < sp.walls.length; j++) {
        if (j === wIdx) continue;
        const otherWall = sp.walls[j];
        if (otherWall.orientation === "Partition" || otherWall.orientation === "Underground") continue;
        const otherBaseAngle = this.getWallGeometricAngle(sp, j);
        const newSolarAz = ((otherBaseAngle + deltaTheta) % 360 + 360) % 360;
        const otherOri = this.azimuthToCompass(newSolarAz);
        otherWall.orientation = otherOri;
        otherWall.custom_orientation = true;
        otherWall.is_interior = false;
      }
    }

    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  setWallAssembly(wIdx, assemblyId) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx]) return;
    sp.walls[wIdx].wall_assembly_id = assemblyId;
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  addWindowToWall(wIdx) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx]) return;
    const w = sp.walls[wIdx];
    if (!w.windows) w.windows = [];
    const winLibs = (app.state.project.libraries && app.state.project.libraries.windows) || [];
    const winLib = winLibs[0] || { id: "WIN_NEW", width_ft: 3.5, height_ft: 6.0 };
    w.windows.push({
      window_id: winLib.id,
      qty: 1,
      width_ft: winLib.width_ft || 3.5,
      height_ft: winLib.height_ft || 6.0,
      area_sqft: (winLib.width_ft || 3.5) * (winLib.height_ft || 6.0),
    });
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  updateWindowOnWall(wIdx, winIdx, field, val) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx] || !sp.walls[wIdx].windows[winIdx]) return;
    const wi = sp.walls[wIdx].windows[winIdx];
    if (field === "qty") {
      wi.qty = Math.max(1, parseInt(val) || 1);
    } else if (field === "window_id") {
      wi.window_id = val;
      const winLibs = (app.state.project.libraries && app.state.project.libraries.windows) || [];
      const match = winLibs.find(l => l.id === val);
      if (match) {
        wi.width_ft = match.width_ft;
        wi.height_ft = match.height_ft;
        wi.area_sqft = match.area_sqft || (match.width_ft * match.height_ft);
      }
    }
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  removeWindowFromWall(wIdx, winIdx) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx] || !sp.walls[wIdx].windows) return;
    sp.walls[wIdx].windows.splice(winIdx, 1);
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  addDoorToWall(wIdx) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx]) return;
    const w = sp.walls[wIdx];
    if (!w.doors) w.doors = [];
    const doorLibs = (app.state.project.libraries && app.state.project.libraries.doors) || [];
    const doorLib = doorLibs[0] || { id: "DOOR_NEW", width_ft: 6.0, height_ft: 8.0 };
    w.doors.push({
      door_id: doorLib.id,
      qty: 1,
      width_ft: doorLib.width_ft || 6.0,
      height_ft: doorLib.height_ft || 8.0,
      area_sqft: (doorLib.width_ft || 6.0) * (doorLib.height_ft || 8.0),
    });
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  updateDoorOnWall(wIdx, doorIdx, field, val) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx] || !sp.walls[wIdx].doors[doorIdx]) return;
    const di = sp.walls[wIdx].doors[doorIdx];
    if (field === "qty") {
      di.qty = Math.max(1, parseInt(val) || 1);
    } else if (field === "door_id") {
      di.door_id = val;
      const doorLibs = (app.state.project.libraries && app.state.project.libraries.doors) || [];
      const match = doorLibs.find(l => l.id === val);
      if (match) {
        di.width_ft = match.width_ft;
        di.height_ft = match.height_ft;
        di.area_sqft = match.area_sqft || (match.width_ft * match.height_ft);
      }
    }
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  removeDoorFromWall(wIdx, doorIdx) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx] || !sp.walls[wIdx].doors) return;
    sp.walls[wIdx].doors.splice(doorIdx, 1);
    this.syncSpaceFromGeometry(sp);
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  // Convenience methods for toolbar buttons
  addWindowToSelectedWall() {
    this.addWindowToWall(this.selectedWallIdx || 0);
  },

  addDoorToSelectedWall() {
    this.addDoorToWall(this.selectedWallIdx || 0);
  },

  updateStatusReadout() {
    const sp = this.getSelectedSpace();
    const infoEl = document.getElementById("cad-selection-info");
    if (!infoEl) return;
    if (sp) {
      const wall = sp.walls && sp.walls[this.selectedWallIdx];
      const wInfo = wall ? ` | Selected Wall ${this.selectedWallIdx + 1}: <strong>${wall.orientation} (${wall.length_ft}')</strong>` : "";
      infoEl.innerHTML = `<strong>Selected Space:</strong> ${sp.name} | Area: <strong>${sp.floor_area_sqft} sqft</strong> | Zone: <strong>${sp.zone_name}</strong> | Windows: <strong>${sp.window_qty || 0}</strong> | Doors: <strong>${sp.door_qty || 0}</strong>${wInfo}`;
    } else {
      infoEl.innerHTML = `Click room to select / drag to move. Click wall edges to set direction, windows, and doors.`;
    }
  },

  // --- Right-Click Context Menu & Dimension Input Subsystem ---

  onContextMenu(e, cvs) {
    e.preventDefault();
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const splitX = this.viewMode === "split" ? cvs.width * 0.52 : (this.viewMode === "3d" ? 0 : cvs.width);

    if (mx < splitX && this.viewMode !== "3d") {
      const panX = this.pan2d.x;
      const panY = this.pan2d.y;
      const mPt = this.screenToModel(mx, my, panX, panY);

      // Hit test room
      const spaces = this.getSpacesOnLevel(this.activeLevel);
      let hitSpace = null;
      for (const sp of spaces) {
        if (sp.geometry && this.isPointInsidePoly(mPt.x, mPt.y, sp.geometry.polygon)) {
          hitSpace = sp;
          break;
        }
      }

      if (hitSpace) {
        this.selectedSpaceId = hitSpace.id;
        const pts = hitSpace.geometry.polygon;
        let closestWall = 0, minD = 999999;
        for (let i = 0; i < pts.length; i++) {
          const d = this.distToSegment(mPt.x, mPt.y, pts[i][0], pts[i][1], pts[(i + 1) % pts.length][0], pts[(i + 1) % pts.length][1]);
          if (d < minD) { minD = d; closestWall = i; }
        }
        this.selectedWallIdx = closestWall;
        this.render();
      }

      this.showContextMenu(e.clientX, e.clientY, mPt, hitSpace);
    } else {
      this.show3DContextMenu(e.clientX, e.clientY);
    }
  },

  showContextMenu(clientX, clientY, mPt, hitSpace) {
    const menu = document.getElementById("cad-context-menu");
    if (!menu) return;

    let itemsHtml = "";

    // 1. Create Room by Dimensions (Always available, targeted at click coordinate)
    itemsHtml += `
      <div class="ctx-item primary" onclick="modeler.hideContextMenu(); modeler.openCreateRoomByDimensionsModal({ x: ${mPt.x}, y: ${mPt.y} })">
        <span>⌨️</span> <strong>${typeof I18N !== "undefined" ? I18N.t("cad.ctx_create_dim") : "Criar Ambiente por Dimensões (LxC)..."}</strong>
      </div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.currentTool='draw_rect'; modeler.render()">
        <span>📐</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_draw_rect") : "Desenhar Ambiente com o Mouse (Arrastar)"}
      </div>
    `;

    // 2. If a room is clicked or selected
    if (hitSpace) {
      const wallIdx = this.selectedWallIdx || 0;
      const wall = hitSpace.walls && hitSpace.walls[wallIdx];
      let oriStr = wall ? wall.orientation : "";
      if (typeof I18N !== "undefined" && wall) {
        oriStr = I18N.t("compass." + wall.orientation).split(" (")[0] || wall.orientation;
      }
      const wallLabel = wall ? ` (${oriStr})` : "";

      itemsHtml += `
        <div class="ctx-sep"></div>
        <div class="ctx-header">🏢 ${hitSpace.name}</div>
        <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.openResizeRoomModal('${hitSpace.id}')">
          <span>📏</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_resize_dim") : "Redimensionar Ambiente por Dimensões (LxC)..."}
        </div>
        <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.duplicateSpace('${hitSpace.id}')">
          <span>📋</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_duplicate") : "Duplicar este Ambiente (Ctrl+D)"}
        </div>
        <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.splitSelectedPerimeterCore(15)">
          <span>✂️</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_split") : "Dividir em Zonas Perímetro/Núcleo"}
        </div>
        <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.addWindowToSelectedWall()">
          <span>🪟</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_add_win") : "+ Adicionar Janela nesta Parede"}${wallLabel}
        </div>
        <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.addDoorToSelectedWall()">
          <span>🚪</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_add_door") : "+ Adicionar Porta nesta Parede"}${wallLabel}
        </div>
        <div class="ctx-item" style="display:flex;justify-content:space-between;align-items:center;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:5px 8px;margin:3px 6px" onclick="event.stopPropagation()">
          <span style="font-size:11px;font-weight:600;color:#92400e">🧭 Orientação:</span>
          <div style="display:flex;gap:3px">
            <button type="button" class="btn-xs ${wall && wall.orientation === 'N' ? 'primary' : ''}" onclick="modeler.hideContextMenu(); modeler.setWallOrientation(${wallIdx}, 'N')">N (0°)</button>
            <button type="button" class="btn-xs ${wall && wall.orientation === 'E' ? 'primary' : ''}" onclick="modeler.hideContextMenu(); modeler.setWallOrientation(${wallIdx}, 'E')">L (90°)</button>
            <button type="button" class="btn-xs ${wall && wall.orientation === 'S' ? 'primary' : ''}" onclick="modeler.hideContextMenu(); modeler.setWallOrientation(${wallIdx}, 'S')">S (180°)</button>
            <button type="button" class="btn-xs ${wall && wall.orientation === 'W' ? 'primary' : ''}" onclick="modeler.hideContextMenu(); modeler.setWallOrientation(${wallIdx}, 'W')">O (270°)</button>
          </div>
        </div>
        <div class="ctx-item danger" onclick="modeler.hideContextMenu(); modeler.deleteSelectedRoom()">
          <span>🗑️</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_delete") : "Excluir este Ambiente (Del)"}
        </div>
      `;
    }

    // 3. General View Actions
    itemsHtml += `
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.resetView()">
        <span>🔍</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_fit") : "Ajustar Vista (Fit View)"}
      </div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.rot3d.az=(modeler.rot3d.az+45)%360; modeler.render()">
        <span>🔄</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_rot3d") : "Girar Modelo 3D (45°)"}
      </div>
    `;

    menu.innerHTML = itemsHtml;
    menu.style.display = "block";

    // Adjust position so context menu never clips out of the viewport
    const menuW = menu.offsetWidth || 280;
    const menuH = menu.offsetHeight || 320;
    let posX = clientX;
    let posY = clientY;
    if (posX + menuW > window.innerWidth) posX = window.innerWidth - menuW - 12;
    if (posY + menuH > window.innerHeight) posY = window.innerHeight - menuH - 12;
    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;
  },

  show3DContextMenu(clientX, clientY) {
    const menu = document.getElementById("cad-context-menu");
    if (!menu) return;
    menu.innerHTML = `
      <div class="ctx-header">🎮 3D Viewport</div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.rot3d.az=(modeler.rot3d.az+45)%360; modeler.render()">
        <span>🔄</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_rot3d") : "Girar Modelo 3D (45°)"}
      </div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.resetView()">
        <span>🔍</span> ${typeof I18N !== "undefined" ? I18N.t("cad.ctx_fit") : "Ajustar Vista (Fit View)"}
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.viewMode='2d'; document.getElementById('cad-view-mode').value='2d'; modeler.render()">
        <span>📐</span> ${typeof I18N !== "undefined" ? I18N.t("cad.view_2d") : "Planta Baixa Arquitetônica 2D"}
      </div>
      <div class="ctx-item" onclick="modeler.hideContextMenu(); modeler.viewMode='split'; document.getElementById('cad-view-mode').value='split'; modeler.render()">
        <span>🏢</span> ${typeof I18N !== "undefined" ? I18N.t("cad.view_split") : "Dividido: 2D + Isométrica 3D"}
      </div>
    `;
    menu.style.display = "block";
    const menuW = menu.offsetWidth || 240;
    const menuH = menu.offsetHeight || 180;
    let posX = clientX;
    let posY = clientY;
    if (posX + menuW > window.innerWidth) posX = window.innerWidth - menuW - 12;
    if (posY + menuH > window.innerHeight) posY = window.innerHeight - menuH - 12;
    menu.style.left = `${Math.max(10, posX)}px`;
    menu.style.top = `${Math.max(10, posY)}px`;
  },

  hideContextMenu() {
    const menu = document.getElementById("cad-context-menu");
    if (menu) menu.style.display = "none";
  },

  parseDimensionsInput(dimStr) {
    if (!dimStr || typeof dimStr !== "string") return null;
    let s = dimStr.trim();
    // Normalize decimal commas if 'x', 'X' or '*' is present: e.g. 12,5 x 8,5 -> 12.5 x 8.5
    if (/[xX*]/.test(s)) {
      s = s.replace(/(\d+),(\d+)/g, "$1.$2");
    }
    const regex = /^([\d\.]+)\s*(m|ft|\'|\")?\s*(?:[xX*,\s]+)\s*([\d\.]+)\s*(m|ft|\'|\")?$/;
    const match = s.match(regex);
    if (!match) return null;

    const val1 = parseFloat(match[1]);
    const unit1 = match[2] ? match[2].toLowerCase() : null;
    const val2 = parseFloat(match[3]);
    const unit2 = match[4] ? match[4].toLowerCase() : null;

    if (isNaN(val1) || isNaN(val2) || val1 <= 0 || val2 <= 0) return null;

    const isSI = typeof I18N !== "undefined" && I18N.isSI();

    const toInternalFt = (val, explicitUnit) => {
      if (explicitUnit === "m") return val / 0.3048;
      if (explicitUnit === "ft" || explicitUnit === "'" || explicitUnit === '"') return val;
      return isSI ? (val / 0.3048) : val;
    };

    const toUserVal = (val, explicitUnit) => {
      if (explicitUnit === "m") return isSI ? val : val / 0.3048;
      if (explicitUnit === "ft" || explicitUnit === "'") return isSI ? val * 0.3048 : val;
      return val;
    };

    const widthFt = toInternalFt(val1, unit1);
    const lengthFt = toInternalFt(val2, unit2);

    return {
      widthFt: Math.round(widthFt * 10) / 10,
      lengthFt: Math.round(lengthFt * 10) / 10,
      widthUser: Math.round(toUserVal(val1, unit1) * 100) / 100,
      lengthUser: Math.round(toUserVal(val2, unit2) * 100) / 100,
      unit1,
      unit2,
    };
  },

  openCreateRoomByDimensionsModal(clickMpt = null) {
    this.pendingPlacement = clickMpt;
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const unitLen = isSI ? "m" : "ft";

    // Smart default dimensions
    const initW = isSI ? 10.0 : 30.0;
    const initL = isSI ? 8.0 : 25.0;
    const initH = isSI ? 3.0 : 9.0;
    const quickVal = `${initW} x ${initL}`;

    const spaces = this.getAllSpaces();
    const initName = `Room ${spaces.length + 1}`;

    const typeOptions = [
      "Office - Open Plan",
      "Office - Enclosed",
      "Conference Room",
      "Classroom",
      "Corridor",
      "Lobby",
      "Restroom",
      "Mechanical / Electrical Room",
      "Storage",
      "Cafeteria / Dining"
    ];
    const typeOptionsHtml = typeOptions.map(t => `<option value="${t}">${t}</option>`).join("");

    const backdrop = document.getElementById("modal-backdrop");
    backdrop.style.display = "flex";
    document.getElementById("modal-title").textContent = typeof I18N !== "undefined" ? I18N.t("cad.dim_modal_title") : "Criar Ambiente por Dimensões (LxC)";

    document.getElementById("modal-body").innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px;border-radius:6px">
          <label style="display:block;font-weight:700;font-size:13px;color:#0369a1;margin-bottom:6px">
            ${typeof I18N !== "undefined" ? I18N.t("cad.dim_input_label") : "Dimensões Rápidas (Largura x Comprimento):"}
          </label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="cad-dim-quick-input" value="${quickVal}" placeholder="Ex: 12x8, 15.5 x 10, 10m x 8m, 30' x 20'" 
                   oninput="modeler.onQuickDimChange(this.value)"
                   style="flex:1;padding:8px 12px;font-size:15px;font-weight:600;border:2px solid #0284c7;border-radius:4px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.08)" />
            <span style="font-size:12px;color:#64748b;font-style:italic">Largura x Comprimento</span>
          </div>
          <div style="font-size:11px;color:#0284c7;margin-top:4px">
            💡 ${typeof I18N !== "undefined" ? I18N.t("cad.dim_modal_desc") : "Digite largura e comprimento (ex: 12x8, 15.5 x 10, 30' x 20' ou 10m x 8m)"}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_width_label") : "Largura"} (${unitLen}):</span>
            <input type="number" id="cad-dim-w" step="0.1" min="0.5" value="${initW}" oninput="modeler.onExplicitDimChange()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_length_label") : "Comprimento"} (${unitLen}):</span>
            <input type="number" id="cad-dim-l" step="0.1" min="0.5" value="${initL}" oninput="modeler.onExplicitDimChange()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_ceiling_label") : "Pé-direito"} (${unitLen}):</span>
            <input type="number" id="cad-dim-h" step="0.1" min="1.0" value="${initH}" oninput="modeler.updateCalculatedArea()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_name_label") : "Nome do Ambiente:"}</span>
            <input type="text" id="cad-dim-name" value="${initName}" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_type_label") : "Uso do Espaço:"}</span>
            <select id="cad-dim-type" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px">
              ${typeOptionsHtml}
            </select>
          </label>
        </div>

        <div class="dim-calc-preview" id="cad-dim-preview-box"></div>
      </div>
    `;

    document.getElementById("modal-footer").innerHTML = `
      <button class="btn-sm" onclick="app.closeModal()">Cancelar</button>
      <button class="btn-sm primary" id="btn-submit-dim-create" onclick="modeler.submitCreateRoomByDimensions()">${typeof I18N !== "undefined" ? I18N.t("cad.dim_btn_create") : "Inserir Ambiente na Planta"}</button>
    `;

    this.updateCalculatedArea();

    // Hook up Enter key
    setTimeout(() => {
      const input = document.getElementById("cad-dim-quick-input");
      if (input) {
        input.focus();
        input.select();
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            modeler.submitCreateRoomByDimensions();
          }
        });
      }
    }, 80);
  },

  onQuickDimChange(val) {
    const parsed = this.parseDimensionsInput(val);
    if (parsed) {
      const elW = document.getElementById("cad-dim-w");
      const elL = document.getElementById("cad-dim-l");
      if (elW) elW.value = parsed.widthUser;
      if (elL) elL.value = parsed.lengthUser;
      this.updateCalculatedArea();
    }
  },

  onExplicitDimChange() {
    const w = parseFloat(document.getElementById("cad-dim-w")?.value) || 0;
    const l = parseFloat(document.getElementById("cad-dim-l")?.value) || 0;
    const elQuick = document.getElementById("cad-dim-quick-input");
    if (elQuick) elQuick.value = `${w} x ${l}`;
    this.updateCalculatedArea();
  },

  updateCalculatedArea() {
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const wVal = parseFloat(document.getElementById("cad-dim-w")?.value) || 0;
    const lVal = parseFloat(document.getElementById("cad-dim-l")?.value) || 0;
    const hVal = parseFloat(document.getElementById("cad-dim-h")?.value) || 0;

    const areaUser = wVal * lVal;
    const volUser = areaUser * hVal;
    const perimUser = 2 * (wVal + lVal);

    const box = document.getElementById("cad-dim-preview-box");
    if (!box) return;

    const areaStr = isSI 
      ? `${areaUser.toFixed(2)} m² <small style="color:#64748b">(${(areaUser / 0.092903).toFixed(0)} sqft)</small>`
      : `${areaUser.toFixed(1)} sqft <small style="color:#64748b">(${(areaUser * 0.092903).toFixed(1)} m²)</small>`;
    const volStr = isSI
      ? `${volUser.toFixed(1)} m³ <small style="color:#64748b">(${(volUser / 0.0283168).toFixed(0)} cuft)</small>`
      : `${volUser.toFixed(0)} cuft <small style="color:#64748b">(${(volUser * 0.0283168).toFixed(1)} m³)</small>`;
    const perimStr = isSI
      ? `${perimUser.toFixed(2)} m`
      : `${perimUser.toFixed(1)} ft`;

    const lblArea = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR" ? "Área de Piso Estimada" : "Estimated Floor Area";
    const lblVol = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR" ? "Volume Interno" : "Interior Volume";
    const lblPerim = typeof I18N !== "undefined" && I18N.getLanguage() === "pt-BR" ? "Perímetro (Paredes)" : "Wall Perimeter";

    box.innerHTML = `
      <div class="dcp-stat">
        <span class="dcp-lbl">${lblArea}</span>
        <span class="dcp-val">${areaStr}</span>
      </div>
      <div class="dcp-stat">
        <span class="dcp-lbl">${lblVol}</span>
        <span class="dcp-val">${volStr}</span>
      </div>
      <div class="dcp-stat">
        <span class="dcp-lbl">${lblPerim}</span>
        <span class="dcp-val">${perimStr}</span>
      </div>
    `;
  },

  submitCreateRoomByDimensions() {
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const wUser = parseFloat(document.getElementById("cad-dim-w")?.value);
    const lUser = parseFloat(document.getElementById("cad-dim-l")?.value);
    const hUser = parseFloat(document.getElementById("cad-dim-h")?.value) || (isSI ? 3.0 : 9.0);
    const name = document.getElementById("cad-dim-name")?.value.trim() || "New Room";
    const spaceType = document.getElementById("cad-dim-type")?.value || "Office - Open Plan";

    if (isNaN(wUser) || isNaN(lUser) || wUser <= 0 || lUser <= 0) {
      alert("Por favor insira dimensões válidas maiores que zero.");
      return;
    }

    const widthFt = isSI ? (wUser / 0.3048) : wUser;
    const lengthFt = isSI ? (lUser / 0.3048) : lUser;
    const heightFt = isSI ? (hUser / 0.3048) : hUser;

    let posX = 30, posY = 30;
    if (this.pendingPlacement) {
      posX = this.pendingPlacement.x;
      posY = this.pendingPlacement.y;
      this.pendingPlacement = null;
    } else {
      const spaces = this.getSpacesOnLevel(this.activeLevel);
      let maxX = 30, maxY = 30;
      spaces.forEach(s => {
        if (s.geometry && s.geometry.polygon) {
          s.geometry.polygon.forEach(pt => {
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] > maxY) maxY = pt[1];
          });
        }
      });
      posX = Math.round((maxX + 15) / this.gridSnap) * this.gridSnap;
      posY = 30;
    }

    this.createNewRoomFromRect(posX, posY, Math.round(widthFt * 10) / 10, Math.round(lengthFt * 10) / 10);

    const selSp = this.getSelectedSpace();
    if (selSp) {
      selSp.name = name;
      selSp.zone_name = `${name} Zone`;
      selSp.ceiling_height_ft = Math.round(heightFt * 10) / 10;
      selSp.space_type = spaceType;
      this.syncSpaceFromGeometry(selSp);
    }

    app.closeModal();
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  openResizeRoomModal(spaceId) {
    const sp = spaceId ? this.getAllSpaces().find(s => s.id === spaceId) : this.getSelectedSpace();
    if (!sp || !sp.geometry || !sp.geometry.polygon || sp.geometry.polygon.length !== 4) {
      alert("Por favor selecione um ambiente retangular para redimensionar.");
      return;
    }
    const pts = sp.geometry.polygon;
    const x0 = pts[0][0], y0 = pts[0][1];
    const x1 = pts[2][0], y1 = pts[2][1];
    const curWFt = Math.abs(x1 - x0);
    const curLFt = Math.abs(y1 - y0);
    const curHFt = parseFloat(sp.ceiling_height_ft || 9.0);

    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const curWUser = isSI ? Math.round(curWFt * 0.3048 * 100) / 100 : Math.round(curWFt * 10) / 10;
    const curLUser = isSI ? Math.round(curLFt * 0.3048 * 100) / 100 : Math.round(curLFt * 10) / 10;
    const curHUser = isSI ? Math.round(curHFt * 0.3048 * 100) / 100 : Math.round(curHFt * 10) / 10;
    const unitLen = isSI ? "m" : "ft";

    const backdrop = document.getElementById("modal-backdrop");
    backdrop.style.display = "flex";
    document.getElementById("modal-title").textContent = `${typeof I18N !== "undefined" ? I18N.t("cad.dim_modal_title_resize") : "Redimensionar Ambiente"} — ${sp.name}`;

    document.getElementById("modal-body").innerHTML = `
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px;border-radius:6px">
          <label style="display:block;font-weight:700;font-size:13px;color:#0369a1;margin-bottom:6px">
            ${typeof I18N !== "undefined" ? I18N.t("cad.dim_input_label") : "Dimensões Rápidas (Largura x Comprimento):"}
          </label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="cad-dim-quick-input" value="${curWUser} x ${curLUser}" placeholder="Ex: 12x8, 15.5 x 10, 10m x 8m, 30' x 20'" 
                   oninput="modeler.onQuickDimChange(this.value)"
                   style="flex:1;padding:8px 12px;font-size:15px;font-weight:600;border:2px solid #0284c7;border-radius:4px;box-shadow:inset 0 1px 2px rgba(0,0,0,0.08)" />
            <span style="font-size:12px;color:#64748b;font-style:italic">Largura x Comprimento</span>
          </div>
          <div style="font-size:11px;color:#0284c7;margin-top:4px">
            💡 ${typeof I18N !== "undefined" ? I18N.t("cad.dim_modal_desc") : "Digite largura e comprimento"}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_width_label") : "Largura"} (${unitLen}):</span>
            <input type="number" id="cad-dim-w" step="0.1" min="0.5" value="${curWUser}" oninput="modeler.onExplicitDimChange()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_length_label") : "Comprimento"} (${unitLen}):</span>
            <input type="number" id="cad-dim-l" step="0.1" min="0.5" value="${curLUser}" oninput="modeler.onExplicitDimChange()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
          <label style="display:flex;flex-direction:column;font-weight:600;font-size:12px;color:#334155;gap:4px">
            <span>${typeof I18N !== "undefined" ? I18N.t("cad.dim_ceiling_label") : "Pé-direito"} (${unitLen}):</span>
            <input type="number" id="cad-dim-h" step="0.1" min="1.0" value="${curHUser}" oninput="modeler.updateCalculatedArea()" style="padding:6px 8px;border:1px solid #cbd5e1;border-radius:3px;font-size:13px" />
          </label>
        </div>

        <div class="dim-calc-preview" id="cad-dim-preview-box"></div>
      </div>
    `;

    document.getElementById("modal-footer").innerHTML = `
      <button class="btn-sm" onclick="app.closeModal()">Cancelar</button>
      <button class="btn-sm primary" id="btn-submit-dim-resize" onclick="modeler.submitResizeRoom('${sp.id}')">${typeof I18N !== "undefined" ? I18N.t("cad.dim_btn_resize") : "Aplicar Novas Dimensões"}</button>
    `;

    this.updateCalculatedArea();

    // Hook up Enter key
    setTimeout(() => {
      const input = document.getElementById("cad-dim-quick-input");
      if (input) {
        input.focus();
        input.select();
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            modeler.submitResizeRoom(sp.id);
          }
        });
      }
    }, 80);
  },

  submitResizeRoom(spaceId) {
    const sp = this.getAllSpaces().find(s => s.id === spaceId);
    if (!sp || !sp.geometry || !sp.geometry.polygon) return;
    const isSI = typeof I18N !== "undefined" && I18N.isSI();
    const wUser = parseFloat(document.getElementById("cad-dim-w")?.value);
    const lUser = parseFloat(document.getElementById("cad-dim-l")?.value);
    const hUser = parseFloat(document.getElementById("cad-dim-h")?.value) || (isSI ? 3.0 : 9.0);

    if (isNaN(wUser) || isNaN(lUser) || wUser <= 0 || lUser <= 0) {
      alert("Por favor insira dimensões válidas.");
      return;
    }

    const wFt = isSI ? (wUser / 0.3048) : wUser;
    const lFt = isSI ? (lUser / 0.3048) : lUser;
    const hFt = isSI ? (hUser / 0.3048) : hUser;

    const pts = sp.geometry.polygon;
    const minX = Math.min(...pts.map(p => p[0]));
    const minY = Math.min(...pts.map(p => p[1]));

    sp.geometry.polygon = [
      [minX, minY],
      [Math.round((minX + wFt) * 10) / 10, minY],
      [Math.round((minX + wFt) * 10) / 10, Math.round((minY + lFt) * 10) / 10],
      [minX, Math.round((minY + lFt) * 10) / 10],
    ];
    sp.ceiling_height_ft = Math.round(hFt * 10) / 10;
    this.syncSpaceFromGeometry(sp);

    app.closeModal();
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  },

  duplicateSpace(spaceId) {
    const targetId = spaceId || this.selectedSpaceId;
    const spaces = app.state.project.space_models[0].spaces;
    const sp = spaces.find(s => s.id === targetId);
    if (!sp) return;

    const cloned = JSON.parse(JSON.stringify(sp));
    const newIdx = spaces.length + 1;
    cloned.id = `S_ROOM_DUP_${Date.now()}`;
    cloned.index = newIdx;
    cloned.name = `${sp.name} (Cópia)`;
    cloned.zone_id = `Z_DUP_${Date.now()}`;
    cloned.zone_name = `${cloned.name} Zone`;

    // Offset polygon by 20 ft
    if (cloned.geometry && cloned.geometry.polygon) {
      cloned.geometry.polygon = cloned.geometry.polygon.map(pt => [pt[0] + 20, pt[1] + 20]);
    }
    this.syncSpaceFromGeometry(cloned);
    spaces.push(cloned);
    this.selectedSpaceId = cloned.id;
    this.selectedWallIdx = 0;
    this.render();
    app.refreshAllUI();
    app.triggerAutoRecalculate();
  }
};
