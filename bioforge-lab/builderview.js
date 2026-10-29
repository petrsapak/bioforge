'use strict';
// Drawing the builder: the hex grid with the design (cells show the test tank's live signals and fluids), Bud parts
// and aim arrows, selections, warnings, ghosts of what is being placed, and the preview window. Also the grid's
// zoom and pan (browser only).

const BUILDER_PANEL_WIDTH = 350;                          // px of the windows on each side, kept clear by F
const FIT_MIN_WIDTH = 300;                                // px the grid fits into at least, on a narrow screen
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
const NERVE_VIEW_SHADE = 'rgba(11,20,24,0.62)';           // laid over the cells in the Nerve view
const VESSEL_VIEW_SHADE = 'rgba(11,20,24,0.4)';           // laid over the cells in the Vessels view
const NEURON_GHOST_ALPHA = 0.5;                           // the neuron a click would put in, under the mouse
const FIBRE_REMOVE_COLOR = '#ff7a6a';                     // a drag that would remove the fibre already there
const FIBRE_NERVE_VIEW_WIDTH = 1;                         // grid px
const FIBRE_BODY_VIEW_WIDTH = 0.7;                        // grid px
const FIBRE_HIGHLIGHT_WIDTH = 1.9;                        // grid px: the fibre under the mouse, or one being laid
const FIBRE_BODY_VIEW_ALPHA = 0.3;
const FIBRE_DIMMED_ALPHA = 0.22;                          // the other fibres while one is highlighted
const MIRROR_AXIS_COLOR = 'rgba(126,200,240,0.55)';
const SAME_TYPE_COLOR = '#7fe8ff';                        // Shift: the outline on every cell of the chosen type
const SAME_TYPE_SHADE = 'rgba(11,20,24,0.55)';            // Shift: laid over the other cells
const SAME_TYPE_COUNT_Y = 112;                             // px from the top: the Shift count, under the limits
const CURSOR_SIZE = 32;                                   // px of the cursor image

// ---------- Zoom and pan ----------
function createGridView() {
  return { zoom: ZOOM_START, panX: 0, panY: 0 };
}

// the screen point of the grid's centre: the middle of the screen, moved by the pan
function gridOrigin(app) {
  const canvas = app.canvas;
  return {
    x: canvas.width / 2 + app.gridView.panX,
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
  const width = Math.max(FIT_MIN_WIDTH, app.canvas.width - 2 * BUILDER_PANEL_WIDTH - 30);
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
  drawMirrorAxes(app);
  drawDesignCells(app);
  drawVesselLayer(app);
  drawNerveLayer(app);
  drawBudParts(app);
  drawSelection(app);
  drawSameTypeCells(app);
  drawWarningMarks(app);
  drawLibraryDragHint(app);
  drawPlacementGhost(app);
  drawNeuronGhost(app);
  drawRemovalTarget(app);
  drawFibreDrag(app);
  drawVesselRemovalTarget(app);
  drawVesselDrag(app);
  drawGridLabels(app);
  context.restore();
  context.fillStyle = DIM_TEXT_COLOR;
  context.font = '12px system-ui';
  context.textAlign = 'center';
  context.fillText('Wheel: zoom · Middle-drag: pan · F: whole grid', app.canvas.width / 2, 20);
  if (isShowingSameType(app)) drawSameTypeCount(app);
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

// the empty grid; the hex under the mouse, and its mirror images, are tinted green if the chosen cell can go there,
// red if not
function drawGridHexes(app, origin) {
  const context = app.context;
  const zoom = app.gridView.zoom;
  const margin = HEX_SPACING_X * zoom;                    // hexes this far off screen are skipped
  const isBusy = app.layer !== 'body' || app.stamp || app.partDrag || app.aimDragKey || app.libraryDrag;
  const tinted = isBusy ? new Map() : hoverTints(app);
  for (let q = -GRID_RADIUS; q <= GRID_RADIUS; q++) {
    for (let r = -GRID_RADIUS; r <= GRID_RADIUS; r++) {
      if (!isInGrid(q, r)) continue;
      const [x, y] = hexToPixel(q, r);
      const screenX = origin.x + x * zoom;
      const screenY = origin.y + y * zoom;
      const offScreen = screenX < -margin || screenX > app.canvas.width + margin ||
        screenY < -margin || screenY > app.canvas.height + margin;
      if (offScreen) continue;
      traceHex(context, x, y, HEX_FILL_SIZE);
      context.fillStyle = tinted.get(hexKey(q, r)) || '#132228';
      context.fill();
    }
  }
}

// the tint of each hex a click would fill: the hex under the mouse and its free mirror images, or the hex alone in
// red if the cells don't fit there. Over a cell, nothing is tinted.
function hoverTints(app) {
  const tints = new Map();
  if (!app.hoverHex || app.edited.cells.has(hexKey(...app.hoverHex))) return tints;
  const hexes = mirroredPlacement(app.edited, ...app.hoverHex, app.selectedType, app.mirrorAxes);
  if (!hexes.length) tints.set(hexKey(...app.hoverHex), BLOCKED_TINT);
  for (const hex of hexes) tints.set(hexKey(...hex), PLACEABLE_TINT);
  return tints;
}

// the symmetry axes: dashed lines across the grid through the Nucleus
function drawMirrorAxes(app) {
  if (!app.mirrorAxes.length) return;
  const context = app.context;
  const [centreX, centreY] = hexToPixel(...mirrorCentre(app.edited));
  const reach = 2 * GRID_RADIUS * HEX_SPACING_X;
  context.strokeStyle = MIRROR_AXIS_COLOR;
  context.lineWidth = 1;
  context.setLineDash([6, 4]);
  for (const axisTurns of app.mirrorAxes) {
    const angle = axisTurns * Math.PI / 6;
    context.beginPath();
    context.moveTo(centreX - Math.cos(angle) * reach, centreY - Math.sin(angle) * reach);
    context.lineTo(centreX + Math.cos(angle) * reach, centreY + Math.sin(angle) * reach);
    context.stroke();
  }
  context.setLineDash([]);
}

// Shift held in the Body view shows where the chosen cell type is used
const isShowingSameType = app => app.keysHeld.has('shift') && app.layer === 'body' && !app.stamp;

// Shift: the other cells shaded, and every cell of the chosen type outlined
function drawSameTypeCells(app) {
  if (!isShowingSameType(app)) return;
  const context = app.context;
  for (const cell of app.edited.cells.values()) {
    const [x, y] = hexToPixel(cell.q, cell.r);
    traceHex(context, x, y, HEX_FILL_SIZE);
    if (cell.typeName !== app.selectedType) {
      context.fillStyle = SAME_TYPE_SHADE;
      context.fill();
      continue;
    }
    context.strokeStyle = SAME_TYPE_COLOR;
    context.lineWidth = 2;
    context.stroke();
  }
}

// Shift: how many cells of the chosen type the design has, under the limits line at the top
function drawSameTypeCount(app) {
  const count = [...app.edited.cells.values()].filter(cell => cell.typeName === app.selectedType).length;
  const context = app.context;
  context.fillStyle = SAME_TYPE_COLOR;
  context.font = '13px system-ui';
  context.textAlign = 'center';
  const label = `${count} ${CELLS[app.selectedType].name} cell${count === 1 ? '' : 's'}`;
  context.fillText(label, app.canvas.width / 2, SAME_TYPE_COUNT_Y);
}

// The canvas cursor: in the Body view a hex ring filled with the chosen cell's colour (red with a minus while a
// right-drag removes), elsewhere the browser's own. Set only when it changes, since setting it restarts the cursor.
function updateCursor(app) {
  const style = app.mode === 'build' && app.layer === 'body' && !app.stamp ? cellCursor(app) : '';
  if (style === app.cursorStyle) return;
  app.cursorStyle = style;
  app.canvas.style.cursor = style;
}

// a CSS cursor of a small hex, its hot spot in the middle
function cellCursor(app) {
  const isErasing = app.paintDrag && app.paintDrag.isErasing;
  const fill = isErasing ? '#e05a4a' : CELLS[app.selectedType].color;
  const mark = isErasing ? '<path d="M11 16h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CURSOR_SIZE}" height="${CURSOR_SIZE}">` +
    '<path d="M16 3l11.3 6.5v13L16 29 4.7 22.5v-13z" fill="#0b1418" fill-opacity=".35" stroke="#fff" ' +
    'stroke-width="1.6"/>' +
    `<circle cx="16" cy="16" r="6" fill="${fill}" stroke="#0b1418" stroke-width="1"/>${mark}</svg>`;
  const half = CURSOR_SIZE / 2;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${half} ${half}, crosshair`;
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

// Fibres side by side in their lanes, in different colours where they share a cell (see laidOutBodyFibres), brighter
// while they carry a signal in the test tank. In the Nerve view the cells fade and the neurons and fibres stand out,
// and the highlighted fibre is drawn whole and bold over the others, which dim; in the Body view the fibres stay
// faint. The fibres go over the neuron badges, so that every cell they pass through shows.
function drawNerveLayer(app) {
  const context = app.context;
  const isNerveView = app.layer === 'nerve';
  if (isNerveView) shadeCells(app, NERVE_VIEW_SHADE);
  if (isNerveView) drawNeuronBadges(app);
  const liveFibreKey = fibre => keyOfCell(fibre.from) + '>' + keyOfCell(fibre.to);
  const liveValues = new Map(app.tank.fibres.map(fibre => [liveFibreKey(fibre), fibre.value]));
  const valueOf = fibre => liveValues.get(fibreStartKey(fibre) + '>' + fibreEndKey(fibre)) || 0;
  const highlighted = isNerveView ? highlightedFibre(app) : null;
  const width = isNerveView ? FIBRE_NERVE_VIEW_WIDTH : FIBRE_BODY_VIEW_WIDTH;
  const laidOut = laidOutBodyFibres(app.edited, FIBRE_COLORS.length);
  for (const { fibre, points, colorIndex } of laidOut) {
    if (fibre === highlighted) continue;
    const alpha = !isNerveView ? FIBRE_BODY_VIEW_ALPHA : highlighted ? FIBRE_DIMMED_ALPHA : 1;
    drawFibre(context, points, valueOf(fibre), { color: FIBRE_COLORS[colorIndex], alpha, width });
  }
  const shown = laidOut.find(({ fibre }) => fibre === highlighted);
  if (shown) drawHighlightedFibre(app, shown, valueOf(shown.fibre));
}

// the fibre to highlight: the one whose row in the card is hovered, else the one under the mouse (the one a
// right-click takes out), but not while one is being laid
function highlightedFibre(app) {
  if (app.hoveredFibre) return app.hoveredFibre;
  if (app.fibreDrag || !app.hoverPoint) return null;
  const target = nerveRemovalTarget(app.edited, app.hoverPoint);
  return target && target.fibre ? target.fibre : null;
}

// a highlighted fibre: bold in its colour from start to end, with a ring round the cell it starts in and the cell it
// ends in
function drawHighlightedFibre(app, { fibre, points, colorIndex }, value) {
  const context = app.context;
  const color = FIBRE_COLORS[colorIndex];
  drawFibre(context, points, Math.max(value, 0.6), { color, width: FIBRE_HIGHLIGHT_WIDTH });
  context.strokeStyle = color;
  context.lineWidth = 1;
  for (const key of [fibreStartKey(fibre), fibreEndKey(fibre)]) {
    const [x, y] = keyToPixel(key);
    strokeCircle(context, x, y, CELL_RADIUS);
  }
}

// lays a shade over every cell of the design, so a layer drawn on top stands out
function shadeCells(app, shade) {
  const context = app.context;
  context.fillStyle = shade;
  for (const designCell of app.edited.cells.values()) {
    const [x, y] = hexToPixel(designCell.q, designCell.r);
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.fill();
  }
}

// Vessels from cell centre to cell centre, lit while a Heart pumps them in the test tank (grey and dashed while a Valve
// shuts them). In the Vessels view the cells fade a little and the vessels stand out; in the other views they stay
// faint.
function drawVesselLayer(app) {
  const isVesselView = app.layer === 'vessel';
  if (isVesselView) shadeCells(app, VESSEL_VIEW_SHADE);
  const liveStates = new Map(app.tank.vessels.map(vessel =>
    [vesselKey(keyOfCell(vessel.first), keyOfCell(vessel.second)), vesselState(vessel)]));
  for (const { link, route } of routedBodyVessels(app.edited)) {
    const state = liveStates.get(vesselKey(fibreStartKey(link), fibreEndKey(link))) || 'idle';
    drawVessel(app.context, route.hexes.map(keyToPixel), state, isVesselView ? 0.95 : 0.3, isVesselView ? 3.4 : 2);
  }
}

// the same text for a vessel either way round
function vesselKey(firstKey, secondKey) {
  return firstKey < secondKey ? firstKey + '~' + secondKey : secondKey + '~' + firstKey;
}

// Vessels view: the vessel a right-click would take out, in red
function drawVesselRemovalTarget(app) {
  if (app.layer !== 'vessel' || app.vesselDrag || !app.hoverPoint) return;
  const vessel = vesselRemovalTarget(app.edited, app.hoverPoint);
  const routed = vessel && routedBodyVessels(app.edited).find(({ link }) => link === vessel);
  if (!routed) return;
  const context = app.context;
  context.strokeStyle = FIBRE_REMOVE_COLOR;
  context.lineWidth = 4.4;
  context.lineCap = 'round';
  context.beginPath();
  routed.route.hexes.map(keyToPixel).forEach(([x, y]) => context.lineTo(x, y));
  context.stroke();
}

// A vessel being laid: over another cell, the route it would take through the body with its units ("+3"), or in red
// with "remove" if that vessel is already there; elsewhere a dashed line from its start cell to the mouse.
function drawVesselDrag(app) {
  if (!app.vesselDrag || !app.hoverPoint) return;
  const context = app.context;
  const fromKey = app.vesselDrag.fromKey;
  const [startX, startY] = keyToPixel(fromKey);
  const toKey = app.hoverHex ? hexKey(...app.hoverHex) : null;
  const route = toKey && toKey !== fromKey
    ? routeFibre(createRouteArea(bodyCells(app.edited)), parseHexKey(fromKey), parseHexKey(toKey))
    : null;
  context.strokeStyle = SELECTION_COLOR;
  context.lineWidth = 1.2;
  strokeCircle(context, startX, startY, CELL_RADIUS);
  if (!route) {
    context.strokeStyle = VESSEL_PUMPED_COLOR;
    context.lineWidth = 2;
    context.setLineDash([3, 2]);
    strokeLine(context, startX, startY, app.hoverPoint[0], app.hoverPoint[1]);
    context.setLineDash([]);
    return;
  }
  const isThere = app.edited.vessels.some(vessel => isVesselBetween(vessel, fromKey, toKey));
  const points = route.hexes.map(keyToPixel);
  if (isThere) {
    context.strokeStyle = FIBRE_REMOVE_COLOR;
    context.lineWidth = 4.4;
    context.beginPath();
    points.forEach(([x, y]) => context.lineTo(x, y));
    context.stroke();
  } else {
    drawVessel(context, points, 'pumped', 0.9, 3.4);
  }
  const [endX, endY] = keyToPixel(toKey);
  context.font = 'bold 7px system-ui';
  context.textAlign = 'left';
  context.fillStyle = isThere ? FIBRE_REMOVE_COLOR : VESSEL_PUMPED_COLOR;
  context.fillText(isThere ? 'remove' : `+${route.units}`, endX + CELL_RADIUS + 2, endY - CELL_RADIUS);
}

// the neurons on top of the faded cells, lit with their live signal
function drawNeuronBadges(app) {
  const liveCells = new Map(app.tank.cells.map(cell => [keyOfCell(cell), cell]));
  for (const designCell of app.edited.cells.values()) {
    if (!designCell.neuron) continue;
    const [x, y] = hexToPixel(designCell.q, designCell.r);
    const live = liveCells.get(keyOfCell(designCell));
    drawNeuronBadge(app.context, { ...designCell, x, y, signal: live ? live.signal : 0 }, CELL_RADIUS * 0.9);
  }
}

// Nerve view: the neuron a right-click would take out, ringed in red. A fibre it would take out is the highlighted
// one (see highlightedFibre).
function drawRemovalTarget(app) {
  if (app.layer !== 'nerve' || app.fibreDrag || app.hoveredFibre || !app.hoverPoint) return;
  const target = nerveRemovalTarget(app.edited, app.hoverPoint);
  if (!target || !target.neuronKey) return;
  const context = app.context;
  const [x, y] = keyToPixel(target.neuronKey);
  context.strokeStyle = FIBRE_REMOVE_COLOR;
  context.lineWidth = 1.5;
  strokeCircle(context, x, y, CELL_RADIUS * 0.65);
}

// Nerve view: the chosen neuron, faint, in the empty cell under the mouse, showing what a click would do
function drawNeuronGhost(app) {
  if (app.layer !== 'nerve' || app.fibreDrag || !app.hoverHex) return;
  const cell = app.edited.cells.get(hexKey(...app.hoverHex));
  if (!cell || cell.neuron) return;
  const [x, y] = hexToPixel(...app.hoverHex);
  const ghost = { x, y, neuron: { kind: app.selectedNeuron }, signal: 0, boundKey: null };
  drawNeuronBadge(app.context, ghost, CELL_RADIUS * 0.9, NEURON_GHOST_ALPHA);
  app.context.globalAlpha = 1;
}

// A fibre being laid, along the cells the mouse has passed through (see extendFibrePath). With the mouse on the cell
// its path ends in, it shows what letting go does: its units ("+3"), "reroute" for a fibre already there on another
// route, or "remove" in red for one already there on this route. Elsewhere a dashed line runs on to the mouse.
function drawFibreDrag(app) {
  if (!app.fibreDrag || !app.hoverPoint) return;
  const context = app.context;
  const { fromKey, pathKeys } = app.fibreDrag;
  const [startX, startY] = keyToPixel(fromKey);
  context.strokeStyle = SELECTION_COLOR;
  context.lineWidth = 1.2;
  strokeCircle(context, startX, startY, CELL_RADIUS);
  const points = pathKeys.map(keyToPixel);
  const endKey = pathKeys[pathKeys.length - 1];
  const isOnEnd = pathKeys.length > 1 && !!app.hoverHex && hexKey(...app.hoverHex) === endKey;
  if (!isOnEnd) {
    if (points.length > 1) drawFibre(context, points, 1, { color: FIBRE_ACTIVE_COLOR, width: FIBRE_HIGHLIGHT_WIDTH });
    const [lastX, lastY] = points[points.length - 1];
    context.globalAlpha = 0.9;
    context.strokeStyle = FIBRE_COLOR;
    context.lineWidth = 1;
    context.setLineDash([3, 2]);
    strokeLine(context, lastX, lastY, app.hoverPoint[0], app.hoverPoint[1]);
    context.setLineDash([]);
    context.globalAlpha = 1;
    return;
  }
  const toggle = planFibreToggle(app.edited, fromKey, endKey, pathKeys.slice(1, -1));
  const isRemoval = toggle.result === 'removed';
  const color = isRemoval ? FIBRE_REMOVE_COLOR : FIBRE_ACTIVE_COLOR;
  const [endX, endY] = points[points.length - 1];
  context.strokeStyle = color;
  context.lineWidth = 1.2;
  strokeCircle(context, endX, endY, CELL_RADIUS);
  drawFibre(context, points, isRemoval ? 0 : 1, { color, width: FIBRE_HIGHLIGHT_WIDTH });
  context.font = 'bold 7px system-ui';
  context.textAlign = 'left';
  context.fillStyle = color;
  const label = isRemoval ? 'remove' : toggle.result === 'rerouted' ? 'reroute' : `+${pathKeys.length - 1}`;
  context.fillText(label, endX + CELL_RADIUS + 2, endY - CELL_RADIUS);
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

// While the mouse is on a row of the Needs card, a small orange "!" and an outline on every cell that row is about.
// The grid stays clean otherwise, however many warnings there are.
function drawWarningMarks(app) {
  const context = app.context;
  const hoveredKeys = new Set(app.warnings.filter(warning => warning.need === app.hoveredNeed)
    .flatMap(warning => warning.keys));
  context.font = 'bold 6px system-ui';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const key of hoveredKeys) {
    const [x, y] = keyToPixel(key);
    const markX = x + CELL_RADIUS * 0.6;
    const markY = y - CELL_RADIUS * 0.6;
    context.fillStyle = WARNING_COLOR;
    fillCircle(context, markX, markY, 3.2);
    context.fillStyle = BUILDER_BACKGROUND;
    context.fillText('!', markX, markY + 0.3);
  }
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
