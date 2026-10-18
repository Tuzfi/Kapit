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

  init() {
    const cvs = document.getElementById("building-canvas");
    if (!cvs) return;
    this.attachEventListeners(cvs);
    this.ensureGeometries();
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
    let area = 0.0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      area += pts[i][0] * pts[j][1];
      area -= pts[j][0] * pts[i][1];
    }
    return Math.abs(area) / 2.0;
  },

  edgeOrientation(p1, p2) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    let angleDeg = Math.atan2(dx, -dy) * (180.0 / Math.PI);
    if (angleDeg < 0) angleDeg += 360.0;

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
        if (angleDeg >= c.min || angleDeg < c.max) return "N";
      } else if (angleDeg >= c.min && angleDeg < c.max) {
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
      const defaultOri = this.edgeOrientation(p1, p2);
      const grossArea = Math.round(len * flr_to_flr * 10) / 10;

      let isShared = false;
      for (const other of allSpacesOnLevel) {
        if (other.id === sp.id || !other.geometry || !other.geometry.polygon) continue;
        const oPts = other.geometry.polygon;
        for (let j = 0; j < oPts.length; j++) {
          const op1 = oPts[j];
          const op2 = oPts[(j + 1) % oPts.length];
          if ((Math.hypot(p1[0] - op2[0], p1[1] - op2[1]) < 1.0 && Math.hypot(p2[0] - op1[0], p2[1] - op1[1]) < 1.0) ||
              (Math.hypot(p1[0] - op1[0], p1[1] - op1[1]) < 1.0 && Math.hypot(p2[0] - op2[0], p2[1] - op2[1]) < 1.0)) {
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
      ctx.fillText(`${sp.floor_area_sqft} sqft`, midX, midY + 11);

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

          // Draw outward normal arrow and orientation label
          const midEdgeX = (p1.px + p2.px) / 2;
          const midEdgeY = (p1.py + p2.py) / 2;
          const dx = p2.px - p1.px;
          const dy = p2.py - p1.py;
          const edgeLen = Math.hypot(dx, dy);
          if (edgeLen > 0) {
            const nx = -dy / edgeLen;
            const ny = dx / edgeLen;
            const arrowLen = 22;
            const ax = midEdgeX + nx * arrowLen;
            const ay = midEdgeY + ny * arrowLen;

            ctx.strokeStyle = "#b45309";
            ctx.fillStyle = "#b45309";
            ctx.lineWidth = 2.2;
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

            const oriLabel = wall ? wall.orientation : "Exp";
            ctx.fillStyle = "#78350f";
            ctx.font = "bold 10px Segoe UI";
            ctx.textAlign = "center";
            ctx.fillText(`${oriLabel} (${wall ? wall.length_ft : 0}')`, ax + nx * 14, ay + ny * 14);
          }
        } else if (isWallHovered) {
          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 3.0;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
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
            const nx = -uy;
            const ny = ux;

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
            ctx.fillText(`🪟 x${totWin}`, midEdgeX - nx * 8, midEdgeY - ny * 8);
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
            ctx.fillText(`🚪 x${totDoor}`, midEdgeX, midEdgeY + 12);
          }
        }
      }

      // Corner handles if selected
      if (isSelected && pts.length === 4) {
        ctx.fillStyle = "#0284c7";
        pts.forEach(p => {
          ctx.fillRect(p.px - 4, p.py - 4, 8, 8);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(p.px - 4, p.py - 4, 8, 8);
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
      ctx.fillText(`${wFt} ft x ${hFt} ft (${wFt * hFt} sqft)`, rx + rw / 2, ry + rh / 2);
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
    ctx.fillText("3D Extruded Building Model (Mouse Orbit & Zoom)", ox + 15, oy + 22);

    const cx = ox + w / 2 + this.pan3d.x;
    const cy = oy + h / 2 + this.pan3d.y;
    const az = (this.rot3d.az * Math.PI) / 180.0;
    const el = (this.rot3d.el * Math.PI) / 180.0;
    const s3 = this.zoom3d * 1.1;

    const allSpaces = this.getAllSpaces();
    let minX = 9999, maxX = -9999, minY = 9999, maxY = -9999;
    allSpaces.forEach(sp => {
      if (sp.geometry && sp.geometry.polygon) {
        sp.geometry.polygon.forEach(pt => {
          if (pt[0] < minX) minX = pt[0];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[1] > maxY) maxY = pt[1];
        });
      }
    });
    const midX = (minX + maxX) / 2 || 150;
    const midY = (minY + maxY) / 2 || 150;

    const project3D = (x, y, z) => {
      const dx = (x - midX) * s3;
      const dy = (y - midY) * s3;
      const dz = z * 4.4 * s3;
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

    faces.sort((a, b) => a.depth - b.depth);

    faces.forEach(f => {
      ctx.beginPath();
      f.poly.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
      ctx.closePath();
      ctx.fillStyle = f.selected ? "#f59e0b" : (f.spaceSelected && f.type === "roof" ? "#38bdf8" : f.color);
      ctx.fill();
      ctx.strokeStyle = f.selected ? "#b45309" : (f.spaceSelected ? "#0284c7" : "#475569");
      ctx.lineWidth = f.selected ? 2.8 : (f.spaceSelected ? 2.0 : 0.9);
      ctx.stroke();

      // Render windows on 3D wall face
      if (f.windows && f.windows.length > 0 && f.poly.length === 4) {
        const [b1, b2, t2, t1] = f.poly;
        const wP = [
          { px: b1.px * 0.6 + t1.px * 0.4 + (b2.px - b1.px) * 0.22, py: b1.py * 0.6 + t1.py * 0.4 + (b2.py - b1.py) * 0.22 },
          { px: b1.px * 0.6 + t1.px * 0.4 + (b2.px - b1.px) * 0.78, py: b1.py * 0.6 + t1.py * 0.4 + (b2.py - b1.py) * 0.78 },
          { px: b1.px * 0.15 + t1.px * 0.85 + (b2.px - b1.px) * 0.78, py: b1.py * 0.15 + t1.py * 0.85 + (b2.py - b1.py) * 0.78 },
          { px: b1.px * 0.15 + t1.px * 0.85 + (b2.px - b1.px) * 0.22, py: b1.py * 0.15 + t1.py * 0.85 + (b2.py - b1.py) * 0.22 },
        ];
        ctx.beginPath();
        wP.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
        ctx.closePath();
        ctx.fillStyle = "#38bdf8";
        ctx.fill();
        ctx.strokeStyle = "#0369a1";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Render doors on 3D wall face
      if (f.doors && f.doors.length > 0 && f.poly.length === 4) {
        const [b1, b2, t2, t1] = f.poly;
        const dP = [
          { px: b1.px * 0.95 + t1.px * 0.05 + (b2.px - b1.px) * 0.35, py: b1.py * 0.95 + t1.py * 0.05 + (b2.py - b1.py) * 0.35 },
          { px: b1.px * 0.95 + t1.px * 0.05 + (b2.px - b1.px) * 0.65, py: b1.py * 0.95 + t1.py * 0.05 + (b2.py - b1.py) * 0.65 },
          { px: b1.px * 0.35 + t1.px * 0.65 + (b2.px - b1.px) * 0.65, py: b1.py * 0.35 + t1.py * 0.65 + (b2.py - b1.py) * 0.65 },
          { px: b1.px * 0.35 + t1.px * 0.65 + (b2.px - b1.px) * 0.35, py: b1.py * 0.35 + t1.py * 0.65 + (b2.py - b1.py) * 0.35 },
        ];
        ctx.beginPath();
        dP.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.px, p.py) : ctx.lineTo(p.px, p.py));
        ctx.closePath();
        ctx.fillStyle = "#d97706";
        ctx.fill();
        ctx.strokeStyle = "#78350f";
        ctx.lineWidth = 1.2;
        ctx.stroke();
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
    drawCardinal(-Math.PI / 2, "N", "#dc2626", true);
    drawCardinal(0, "E", "#475569", false);
    drawCardinal(Math.PI / 2, "S", "#475569", false);
    drawCardinal(Math.PI, "W", "#475569", false);

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
    window.addEventListener("keydown", (e) => this.onKeyDown(e));
  },

  onMouseDown(e, cvs) {
    const rect = cvs.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const splitX = this.viewMode === "split" ? cvs.width * 0.52 : (this.viewMode === "3d" ? 0 : cvs.width);

    if (mx < splitX && this.viewMode !== "3d") {
      const panX = this.pan2d.x;
      const panY = this.pan2d.y;
      const mPt = this.screenToModel(mx, my, panX, panY);

      if (this.currentTool === "draw_rect") {
        this.dragState = { mode: "draw_rect", x0: mPt.x, y0: mPt.y, x1: mPt.x, y1: mPt.y };
        return;
      }

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
        if (minD < 6.0) {
          this.selectedWallIdx = closestWall;
        } else if (this.selectedWallIdx === null || this.selectedWallIdx >= pts.length) {
          this.selectedWallIdx = 0;
        }

        this.dragState = {
          mode: "move_room",
          space: hitSpace,
          startX: mPt.x,
          startY: mPt.y,
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
      } else if (this.dragState.mode === "move_room") {
        const dx = mPt.x - this.dragState.startX;
        const dy = mPt.y - this.dragState.startY;
        const sp = this.dragState.space;
        sp.geometry.polygon = this.dragState.origPoly.map(pt => [pt[0] + dx, pt[1] + dy]);
        this.syncSpaceFromGeometry(sp);
        this.render();
      } else if (this.dragState.mode === "pan_2d") {
        this.pan2d.x = this.dragState.origPan.x + (mx - this.dragState.startScreenX);
        this.pan2d.y = this.dragState.origPan.y + (my - this.dragState.startScreenY);
        this.render();
      }
    } else if (mx < splitX && this.viewMode !== "3d") {
      // Wall hover detection on selected space
      const sp = this.getSelectedSpace();
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
      } else if (this.dragState.mode === "move_room") {
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
      el.innerHTML = `
        <div style="color:#64748b;font-style:italic;padding:12px;text-align:center">
          👈 Click on any room on the floor plan to inspect its walls, set orientations (North, South, East, West), assemblies, and add windows or doors.
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

    const wallTabsHtml = walls.map((w, idx) => {
      const act = idx === selIdx ? "active" : "";
      const oriIcon = w.is_interior ? "🚪 Partition" : `🧭 ${w.orientation}`;
      const winCount = (w.windows || []).reduce((s, wi) => s + (parseInt(wi.qty) || 1), 0);
      const doorCount = (w.doors || []).reduce((s, di) => s + (parseInt(di.qty) || 1), 0);
      const tags = (winCount > 0 ? ` 🪟${winCount}` : "") + (doorCount > 0 ? ` 🚪${doorCount}` : "");
      return `
        <button class="wall-tab-btn ${act}" onclick="modeler.selectWallTab(${idx})">
          🧱 Wall ${idx + 1} (${oriIcon}, ${w.length_ft}')${tags}
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

    const wallOptionsHtml = wallLibs.map(wl => `
      <option value="${wl.id}" ${wl.id === wall.wall_assembly_id ? "selected" : ""}>${wl.name} (U=${wl.overall_u})</option>
    `).join("");

    const orientationOptionsHtml = this.COMPASS_CARDINALS.map(c => `
      <option value="${c.code}" ${c.code === wall.orientation ? "selected" : ""}>${c.label}</option>
    `).join("");

    // Calculate window and door total areas
    const ceilingH = parseFloat(sp.ceiling_height_ft || 9.0);
    const grossArea = Math.round(wall.length_ft * 12.0 * 10) / 10;
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
      return `
        <div class="aperture-card">
          <select onchange="modeler.updateWindowOnWall(${selIdx}, ${wIdx}, 'window_id', this.value)">${optHtml}</select>
          <label style="font-size:10px">Qty: <input type="number" min="1" max="20" value="${qty}" onchange="modeler.updateWindowOnWall(${selIdx}, ${wIdx}, 'qty', this.value)" /></label>
          <span style="color:#0369a1;font-weight:600">${wW}'x${wH}' (${a} sqft)</span>
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
      return `
        <div class="aperture-card">
          <select onchange="modeler.updateDoorOnWall(${selIdx}, ${dIdx}, 'door_id', this.value)">${optHtml}</select>
          <label style="font-size:10px">Qty: <input type="number" min="1" max="10" value="${qty}" onchange="modeler.updateDoorOnWall(${selIdx}, ${dIdx}, 'qty', this.value)" /></label>
          <span style="color:#b45309;font-weight:600">${dW}'x${dH}' (${a} sqft)</span>
          <button class="btn-xs danger" onclick="modeler.removeDoorFromWall(${selIdx}, ${dIdx})" title="Remove Door">✕</button>
        </div>
      `;
    }).join("");

    const netWallArea = Math.max(0, Math.round((grossArea - winAreaTot - doorAreaTot) * 10) / 10);

    el.innerHTML = `
      <div class="wall-inspector-header">
        <div class="wi-title">
          🏢 <strong>${sp.name}</strong> — Wall &amp; Openings Inspector (Paredes, Direções, Janelas e Portas)
        </div>
        <div class="wi-meta">
          Level: <strong>${sp.level}</strong> | Area: <strong>${sp.floor_area_sqft} sqft</strong> | Zone: <strong>${sp.zone_name}</strong> | Exposure: <strong>${sp.exposure}</strong>
        </div>
      </div>

      <div class="wall-tabs-row">${wallTabsHtml}</div>

      <div class="wall-detail-grid">
        <!-- Col 1: Wall Properties -->
        <div class="wall-prop-col">
          <label>Orientation / Exposure (Direção da Parede):
            <select onchange="modeler.setWallOrientation(${selIdx}, this.value)">
              ${orientationOptionsHtml}
            </select>
          </label>
          <label>Wall Construction Assembly (Tipo de Parede):
            <select onchange="modeler.setWallAssembly(${selIdx}, this.value)">
              ${wallOptionsHtml}
            </select>
          </label>
          <div class="wall-dim-readout">
            <div>Length: <strong>${wall.length_ft} ft</strong> | Floor-to-Ceiling: <strong>${ceilingH} ft</strong></div>
            <div>Gross Wall: <strong>${grossArea} sqft</strong> | Windows: <strong>${winAreaTot} sqft</strong> | Doors: <strong>${doorAreaTot} sqft</strong></div>
            <div style="font-size:11.5px;color:#005a9e;margin-top:2px">Net Conduction Area: <strong>${netWallArea} sqft</strong></div>
          </div>
        </div>

        <!-- Col 2: Windows -->
        <div class="wall-aperture-col">
          <div class="aperture-header">
            <span>🪟 Windows on Wall ${selIdx + 1} (${(wall.windows || []).length})</span>
            <button class="btn-xs primary" onclick="modeler.addWindowToWall(${selIdx})">+ Add Window</button>
          </div>
          <div class="aperture-list">
            ${windowsListHtml || '<div style="color:#94a3b8;font-style:italic;padding:8px;font-size:11px">No windows on this wall. Click "+ Add Window" above to insert.</div>'}
          </div>
        </div>

        <!-- Col 3: Doors -->
        <div class="wall-aperture-col">
          <div class="aperture-header">
            <span>🚪 Doors on Wall ${selIdx + 1} (${(wall.doors || []).length})</span>
            <button class="btn-xs primary" onclick="modeler.addDoorToWall(${selIdx})">+ Add Door</button>
          </div>
          <div class="aperture-list">
            ${doorsListHtml || '<div style="color:#94a3b8;font-style:italic;padding:8px;font-size:11px">No doors on this wall. Click "+ Add Door" above to insert.</div>'}
          </div>
        </div>
      </div>
    `;
  },

  selectWallTab(idx) {
    this.selectedWallIdx = idx;
    this.render();
  },

  setWallOrientation(wIdx, newOri) {
    const sp = this.getSelectedSpace();
    if (!sp || !sp.walls || !sp.walls[wIdx]) return;
    const w = sp.walls[wIdx];
    w.orientation = newOri;
    w.custom_orientation = true;
    w.is_interior = newOri === "Partition";
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
  }
};
