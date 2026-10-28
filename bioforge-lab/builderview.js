'use strict';
// Drawing the builder: the hex grid with the design (cells show the test tank's live signals and fluids), Bud parts
// and aim arrows, selections, warnings, ghosts of what is being placed, and the preview window. Also the grid's
// zoom and pan (browser only).

const BUILDER_PANEL_WIDTH = 320;                          // px of menu kept clear when centring the grid
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;
const ZOOM_START = 1.9;
const ZOOM_PER_WHEEL_UNIT = 0.0015;
const HEX_FILL_SIZE = HEX_SPACING_X / Math.sqrt(3) - 0.6; // grid px from a hex's centre to its corners, drawn
const HEX_OUTLINE_SIZE = HEX_SPACING_X / Math.sqrt(3) - 1.2;
const BUILDER_BACKGROUND = '#0b1418';
const PLACEABLE_TINT = 'rgba(120,220,120,0.3)';
const BLOCKED_TINT = 'rgba(230,90,90,0.25)';
const BUD_PART_COLOR = '#c8e07a';
const WARNING_COLOR = '#e8875a';
const HOVERED_WARNING_COLOR = '#ffb48f';
const SELECTION_COLOR = '#e8c547';
const DIM_TEXT_COLOR = '#6f7b88';

// ---------- Zoom and pan ----------
function createGridView() {
  return { zoom: ZOOM_START, panX: 0, panY: 0 };
}

// the screen point of the grid's centre: the middle of the space right of the panel, moved by the pan
function gridOrigin(app) {
  const canvas = app.canvas;
  return {
    x: BUILDER_PANEL_WIDTH + (canvas.width - BUILDER_PANEL_WIDTH) / 2 + app.gridView.panX,
    y: canvas.height / 2 + app.gridView.panY,
  };
}

// a screen point in grid px
function screenToGrid(app, screenX, screenY) {
  const origin = gridOrigin(app);
  return [(screenX - origin.x) / app.gridView.zoom, (screenY - origin.y) / app.gridView.zoom];
}

// zoom so the whole hex grid fits right of the panel
function fitGridToScreen(app) {
  const width = app.canvas.width - BUILDER_PANEL_WIDTH - 30;
  const height = app.canvas.height - 60;
  const gridWidth = (2 * GRID_RADIUS + 1) * HEX_SPACING_X;
  const gridHeight = (2 * GRID_RADIUS + 1) * HEX_SPACING_Y + 30;
  app.gridView.zoom = clampZoom(Math.min(width / gridWidth, height / gridHeight));
  app.gridView.panX = 0;
  app.gridView.panY = 0;
}

const clampZoom = zoom => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));

// zooms by a mouse wheel turn, keeping the grid point under the cursor in place
function zoomAtCursor(app, screenX, screenY, wheelDelta) {
  const view = app.gridView;
  const origin = gridOrigin(app);
  const zoom = clampZoom(view.zoom * Math.exp(-wheelDelta * ZOOM_PER_WHEEL_UNIT));
  view.panX += (screenX - origin.x) * (1 - zoom / view.zoom);
  view.panY += (screenY - origin.y) * (1 - zoom / view.zoom);
  view.zoom = zoom;
}

// ---------- The builder ----------
function drawBuilder(app) {
  const context = app.context;
  context.fillStyle = BUILDER_BACKGROUND;
  context.fillRect(0, 0, app.canvas.width, app.canvas.height);
  const origin = gridOrigin(app);
  context.save();
  context.translate(origin.x, origin.y);
  context.scale(app.gridView.zoom, app.gridView.zoom);
  drawGridHexes(app, origin);
  drawDesignCells(app);
  drawBudParts(app);
  drawSelection(app);
  drawWarningMarks(app);
  drawLibraryDragHint(app);
  drawPlacementGhost(app);
  drawGridLabels(app);
  context.restore();
  context.fillStyle = DIM_TEXT_COLOR;
  context.font = '12px system-ui';
  context.textAlign = 'center';
  context.fillText('Wheel: zoom · Middle-drag: pan · F: whole grid', app.canvas.width / 2, 20);
}

function traceHex(context, x, y, size) {
  context.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    context.lineTo(x + Math.cos(angle) * size, y + Math.sin(angle) * size);
  }
  context.closePath();
}

function keyToPixel(key) {
  const { q, r } = parseHexKey(key);
  return hexToPixel(q, r);
}

// the empty grid; the hex under the mouse is tinted green if the chosen cell can go there, red if not
function drawGridHexes(app, origin) {
  const context = app.context;
  const zoom = app.gridView.zoom;
  const margin = HEX_SPACING_X * zoom;                    // hexes this far off screen are skipped
  const isBusy = app.stamp || app.partDrag || app.aimDragKey || app.libraryDrag;
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (!isInGrid(q, r)) continue;
      const [x, y] = hexToPixel(q, r);
      const screenX = origin.x + x * zoom;
      const screenY = origin.y + y * zoom;
      const offScreen = screenX < -margin || screenX > app.canvas.width + margin ||
        screenY < -margin || screenY > app.canvas.height + margin;
      if (offScreen) continue;
      const isHovered = !isBusy && app.hoverHex && app.hoverHex[0] === q && app.hoverHex[1] === r;
      traceHex(context, x, y, HEX_FILL_SIZE);
      context.fillStyle = !isHovered ? '#132228'
        : canPlaceCell(app.edited, q, r, app.selectedType) ? PLACEABLE_TINT : BLOCKED_TINT;
      context.fill();
    }
  }
}

// Each cell is drawn as a still copy of its live test tank cell, at its grid slot. Planned cells (not joined to the
// body) are washed out, with a dashed outline.
function drawDesignCells(app) {
  const context = app.context;
  const liveCells = new Map(app.tank.cells.map(cell => [keyOfCell(cell), cell]));
  const joined = joinedKeys(app.edited);
  const atRest = { centerX: 0, centerY: 0, heading: 0 };  // thorns and mouths face away from the nucleus
  for (const [key, designCell] of app.edited.cells) {
    const [x, y] = hexToPixel(designCell.q, designCell.r);
    const source = liveCells.get(key) || makeDisplayCell(designCell.typeName, 0, 0);
    drawCell(context, { ...source, x, y, radius: CELL_RADIUS, creature: atRest }, app.fluidView);
    if (joined.has(key)) continue;
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.fillStyle = 'rgba(19,34,40,0.6)';
    context.fill();
    traceHex(context, x, y, HEX_OUTLINE_SIZE);
    context.strokeStyle = '#8a96a3';
    context.lineWidth = 1;
    context.setLineDash([2, 2]);
    context.stroke();
    context.setLineDash([]);
  }
}

// where each Bud's part will grow (dots, brighter for the clicked Bud) and its aim arrow (its tip is a drag handle)
function drawBudParts(app) {
  const context = app.context;
  const cells = bodyCells(app.edited);
  context.lineCap = 'round';
  for (const bud of cells) {
    const key = keyOfCell(bud);
    if (!bud.budPart || (app.partDrag && app.partDrag.budKey === key)) continue;   // a dragged part follows the mouse
    const isFocused = key === app.focusKey;
    for (const partCell of planBudPart(cells, bud).cells) drawBudPartDot(context, partCell, isFocused);
    const arrow = app.aimDragKey === key && app.hoverPoint
      ? arrowToPoint(bud, app.hoverPoint)
      : budAimArrow(cells, bud);
    if (arrow) drawAimArrow(context, arrow, isFocused);
  }
  context.globalAlpha = 1;
}

function drawBudPartDot(context, partCell, isFocused) {
  const [x, y] = hexToPixel(partCell.q, partCell.r);
  context.globalAlpha = isFocused ? 0.55 : 0.25;
  context.fillStyle = CELLS[partCell.typeName].color;
  fillCircle(context, x, y, CELL_RADIUS * 0.7);
  if (!isFocused) return;
  context.globalAlpha = 0.8;
  context.strokeStyle = '#fff';
  context.lineWidth = 1;
  context.setLineDash([2, 2]);
  traceHex(context, x, y, HEX_OUTLINE_SIZE);
  context.stroke();
  context.setLineDash([]);
}

// the aim arrow while it is dragged: from the Bud to the mouse
function arrowToPoint(bud, point) {
  const [budX, budY] = hexToPixel(bud.q, bud.r);
  const length = Math.hypot(point[0] - budX, point[1] - budY) || 1;
  const directionX = (point[0] - budX) / length;
  const directionY = (point[1] - budY) / length;
  return {
    directionX,
    directionY,
    startX: budX + directionX * CELL_RADIUS,
    startY: budY + directionY * CELL_RADIUS,
    tipX: point[0],
    tipY: point[1],
  };
}

function drawAimArrow(context, arrow, isFocused) {
  const { directionX, directionY, startX, startY, tipX, tipY } = arrow;
  context.globalAlpha = isFocused ? 0.95 : 0.5;
  context.strokeStyle = BUD_PART_COLOR;
  context.lineWidth = isFocused ? 2 : 1.5;
  context.beginPath();
  context.moveTo(startX, startY);
  context.lineTo(tipX, tipY);
  context.moveTo(tipX - directionX * 6 - directionY * 4, tipY - directionY * 6 + directionX * 4);
  context.lineTo(tipX, tipY);
  context.lineTo(tipX - directionX * 6 + directionY * 4, tipY - directionY * 6 - directionX * 4);
  context.stroke();
  if (!isFocused) return;
  context.fillStyle = BUD_PART_COLOR;                     // the handle: grab here to aim
  fillCircle(context, tipX, tipY, 3.5);
}

// the clicked cell (white) and the Ctrl+clicked selection (dashed gold)
function drawSelection(app) {
  const context = app.context;
  if (app.focusKey) {
    const [x, y] = keyToPixel(app.focusKey);
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.strokeStyle = '#fff';
    context.lineWidth = 2;
    context.stroke();
  }
  context.strokeStyle = SELECTION_COLOR;
  context.lineWidth = 1.5;
  context.setLineDash([3, 2]);
  for (const key of app.selection) {
    const [x, y] = keyToPixel(key);
    traceHex(context, x, y, HEX_OUTLINE_SIZE);
    context.stroke();
  }
  context.setLineDash([]);
}

// A small orange "!" on every cell a warning is about. The warning under the mouse outlines its cells, and the
// other marks fade.
function drawWarningMarks(app) {
  const context = app.context;
  const hovered = app.warnings[app.hoveredWarning];
  const hoveredKeys = new Set(hovered ? hovered.keys : []);
  context.font = 'bold 6px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const key of new Set(app.warnings.flatMap(warning => warning.keys))) {
    const [x, y] = keyToPixel(key);
    const markX = x + CELL_RADIUS * 0.6;
    const markY = y - CELL_RADIUS * 0.6;
    context.globalAlpha = !hovered || hoveredKeys.has(key) ? 1 : 0.35;
    context.fillStyle = WARNING_COLOR;
    fillCircle(context, markX, markY, 3.2);
    context.fillStyle = BUILDER_BACKGROUND;
    context.fillText('!', markX, markY + 0.3);
  }
  context.globalAlpha = 1;
  context.textBaseline = 'alphabetic';
  context.strokeStyle = HOVERED_WARNING_COLOR;
  context.lineWidth = 2.5;
  for (const key of hoveredKeys) {
    const [x, y] = keyToPixel(key);
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.stroke();
  }
}

// a library part dragged over the grid: says where to drop it
function drawLibraryDragHint(app) {
  if (!app.libraryDrag || !app.hoverPoint) return;
  const context = app.context;
  const hoveredCell = app.hoverHex && app.edited.cells.get(hexKey(...app.hoverHex));
  const overBud = hoveredCell && CELLS[hoveredCell.typeName].growsParts;
  context.fillStyle = overBud ? BUD_PART_COLOR : '#8a96a3';
  context.font = '6px system-ui';
  context.textAlign = 'left';
  const text = overBud ? `Drop: this Bud grows "${app.libraryDrag.name}"` : 'Drop it on a Bud';
  context.fillText(text, app.hoverPoint[0] + 8, app.hoverPoint[1] - 6);
}

// a Bud part being dragged, or a part being stamped: a ghost under the mouse, green if it fits, red if not
function drawPlacementGhost(app) {
  if (!(app.partDrag || app.stamp) || !app.hoverHex) return;
  const context = app.context;
  const [q, r] = app.hoverHex;
  const drag = app.partDrag;
  const placement = drag
    ? budPartPlacement(app.edited, drag.budKey, drag.rotation, q - drag.grab[0], r - drag.grab[1])
    : stampPlacement(app.edited, app.stamp, q, r);
  for (const cell of placement.cells) {
    const [x, y] = hexToPixel(cell.q, cell.r);
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.fillStyle = placement.problem ? 'rgba(230,90,90,0.3)' : PLACEABLE_TINT;
    context.fill();
    context.globalAlpha = 0.6;
    context.fillStyle = CELLS[cell.typeName].color;
    fillCircle(context, x, y, CELL_RADIUS * 0.8);
    context.globalAlpha = 1;
  }
}

// "FRONT" above the grid, and which fluid the view shows below it
function drawGridLabels(app) {
  const context = app.context;
  context.fillStyle = DIM_TEXT_COLOR;
  context.font = '7px system-ui';
  context.textAlign = 'center';
  context.fillText('▲ FRONT', 0, -GRID_RADIUS * HEX_SPACING_Y - 14);
  if (!app.fluidView) return;
  const fluid = FLUIDS[app.fluidView - 1];
  context.fillStyle = fluid.color;
  context.fillText(`showing ${fluid.name} level`, 0, GRID_RADIUS * HEX_SPACING_Y + 20);
}

// ---------- The preview window ----------
// the test tank drawn into the floating preview window, scaled to fit
function drawPreview(app) {
  const canvas = byId('preview-canvas');
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (app.isPreviewCollapsed() || !width || !height) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext('2d');
  const tank = app.tank;
  const scale = Math.min(width / tank.width, height / tank.height);
  context.fillStyle = BUILDER_BACKGROUND;
  context.fillRect(0, 0, width, height);
  context.save();
  context.translate((width - tank.width * scale) / 2, (height - tank.height * scale) / 2);
  context.scale(scale, scale);
  drawWater(context, tank, tank.width, tank.height);
  drawWorld(context, tank, app.fluidView);
  context.restore();
}
