'use strict';
// The Reference window (browser-only): a creature from the Templates screen shown beside the Lab, to study while
// building another. It runs live in its own test tank, drawn as the Lab's grid draws a design (or swimming, like the
// Preview), and following the Lab's layer tab. The Lab's own design is never touched.

const REFERENCE_STORAGE_NAME = 'reference';               // the creature shown, kept per game
const REFERENCE_PADDING = 14;                             // px of canvas kept clear round the creature
const REFERENCE_MAX_SCALE = 2.5;                          // screen px per grid px, for a small creature
const REFERENCE_SWIM_ZOOM = 0.7;                          // share of the grid's scale when swimming: room for puffs
const REFERENCE_HEX_COLOR = '#132228';                    // the hex under each cell, as on the Lab's grid
const REFERENCE_NO_INPUT = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };   // no keys fire it

// The window's buttons and mouse, and the creature it showed last time, if any
function setUpReference(app) {
  app.isReferenceCollapsed = makeCollapsible(byId('reference'), byId('reference-bar'), byId('reference-toggle'),
    'reference');
  byId('reference-close').onclick = () => closeReference(app);
  byId('reference-view').onclick = () => toggleReferenceView(app);
  const canvas = byId('reference-canvas');
  canvas.addEventListener('mousemove', event => {
    if (app.reference) app.reference.hoverPoint = referenceGridPoint(app.reference, event.offsetX, event.offsetY);
  });
  canvas.addEventListener('mouseleave', () => {
    if (app.reference) app.reference.hoverPoint = null;
  });
  const saved = readStorage(REFERENCE_STORAGE_NAME, null);
  if (saved) showInReference(app, migrateLibraryEntry(saved));
  showReferenceWindow(app);
}

// Opens the window on a creature (a Templates entry: { name, cells, fibres }), and remembers it
function openReference(app, entry, name) {
  const saved = { name, isCreature: true, cells: entry.cells, fibres: entry.fibres || [] };
  writeStorage(REFERENCE_STORAGE_NAME, saved);
  showInReference(app, saved);
  showReferenceWindow(app);
}

// the creature in the window, in its own test tank; the view (grid or swimming) stays as it was
function showInReference(app, entry) {
  const edited = createEditedDesign(entry, Infinity);
  app.reference = {
    name: entry.name,
    edited,
    tank: createTestTankFor(bodyDesign(edited)),
    isSwimming: app.reference ? app.reference.isSwimming : false,
    hoverPoint: null,                                     // grid px under the mouse, or null
    transform: null,                                      // { scale, x, y }: grid px to canvas px, as last drawn
  };
  byId('reference-name').textContent = entry.name;
  showReferenceView(app);
}

// closes the window and forgets its creature
function closeReference(app) {
  app.reference = null;
  writeStorage(REFERENCE_STORAGE_NAME, null);
  showReferenceWindow(app);
}

// the window shows in the Lab while it has a creature
function showReferenceWindow(app) {
  byId('reference').style.display = app.mode === 'build' && app.reference ? '' : 'none';
}

// switches between the creature on the grid and the creature swimming
function toggleReferenceView(app) {
  if (!app.reference) return;
  app.reference.isSwimming = !app.reference.isSwimming;
  showReferenceView(app);
}

// the view button names the other view
function showReferenceView(app) {
  byId('reference-view').textContent = app.reference.isSwimming ? 'Grid' : 'Swim';
}

// ---------- Each frame ----------
// steps the creature's tank and draws the window, unless it is closed or folded
function runReference(app, dt) {
  const reference = app.reference;
  if (!reference || app.isReferenceCollapsed()) return;
  stepTestTank(reference.tank, dt, REFERENCE_NO_INPUT);
  if (reference.isSwimming) drawReferenceSwimming(app);
  else drawReferenceGrid(app);
  byId('reference-note').textContent = describeReferenceHover(reference);
}

// The creature as the Lab's grid shows it, scaled to fit: each cell on its hex, live from its tank, with its neurons
// and fibres as the Lab's layer tab shows them. In the Nerve view, the fibre or cell under the mouse is highlighted.
function drawReferenceGrid(app) {
  const reference = app.reference;
  const canvas = byId('reference-canvas');
  const context = fitWindowCanvas(canvas);
  if (!context) return;
  const transform = fitReferenceToCanvas(reference.edited, canvas.width, canvas.height);
  reference.transform = transform;
  context.fillStyle = BUILDER_BACKGROUND;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(transform.x, transform.y);
  context.scale(transform.scale, transform.scale);
  for (const cell of reference.edited.cells.values()) {
    const [x, y] = hexToPixel(cell.q, cell.r);
    traceHex(context, x, y, HEX_FILL_SIZE);
    context.fillStyle = REFERENCE_HEX_COLOR;
    context.fill();
  }
  const view = {
    context,
    edited: reference.edited,
    tank: reference.tank,
    layer: app.layer,
    fluidView: app.fluidView,
    hoverPoint: reference.hoverPoint,
    hoveredFibre: null,
    fibreDrag: null,
  };
  drawDesignCells(view);
  drawNerveLayer(view, laidOutBodyFibres(reference.edited, FIBRE_COLORS.length));
  context.restore();
}

// The creature swimming in its tank, framed close: the water's motes on the whole canvas, the creature at the
// grid's scale (so the frame doesn't pulse as it beats), centred on its live cells, with its puffs and fluids
function drawReferenceSwimming(app) {
  const tank = app.reference.tank;
  const canvas = byId('reference-canvas');
  const context = fitWindowCanvas(canvas);
  if (!context) return;
  drawWater(context, tank, canvas.width, canvas.height);
  const scale = REFERENCE_SWIM_ZOOM * fitReferenceToCanvas(app.reference.edited, canvas.width, canvas.height).scale;
  const live = fitPointsToCanvas(tank.cells.map(cell => [cell.x, cell.y]), canvas.width, canvas.height);
  const liveCenterX = (canvas.width / 2 - live.x) / live.scale;   // tank px at the canvas's centre, as live fits it
  const liveCenterY = (canvas.height / 2 - live.y) / live.scale;
  context.save();
  context.translate(canvas.width / 2 - scale * liveCenterX, canvas.height / 2 - scale * liveCenterY);
  context.scale(scale, scale);
  drawWorld(context, tank, app.fluidView);
  context.restore();
}

// the scale and offset that fit the design's cells, as on the grid, into a canvas of this size
function fitReferenceToCanvas(edited, width, height) {
  return fitPointsToCanvas([...edited.cells.values()].map(cell => hexToPixel(cell.q, cell.r)), width, height);
}

// the scale and offset that fit cells at these points (px) into a canvas of this size, centred
function fitPointsToCanvas(points, width, height) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const left = Math.min(...xs) - CELL_RADIUS;
  const right = Math.max(...xs) + CELL_RADIUS;
  const top = Math.min(...ys) - CELL_RADIUS;
  const bottom = Math.max(...ys) + CELL_RADIUS;
  const scale = Math.min(REFERENCE_MAX_SCALE, (width - 2 * REFERENCE_PADDING) / (right - left),
    (height - 2 * REFERENCE_PADDING) / (bottom - top));
  return {
    scale,
    x: width / 2 - scale * (left + right) / 2,
    y: height / 2 - scale * (top + bottom) / 2,
  };
}

// canvas px -> grid px, through the grid as last drawn; null before it is drawn or while it swims
function referenceGridPoint(reference, canvasX, canvasY) {
  const transform = reference.transform;
  if (!transform || reference.isSwimming) return null;
  return [(canvasX - transform.x) / transform.scale, (canvasY - transform.y) / transform.scale];
}

// The line under the canvas: the cell under the mouse, its neuron and setting, and its fibres; or what to do
function describeReferenceHover(reference) {
  if (reference.isSwimming) return 'Swimming in its own tank. Grid shows its cells and wiring.';
  const cell = reference.hoverPoint && reference.edited.cells.get(hexKey(...pixelToHex(...reference.hoverPoint)));
  if (!cell) return 'Point at a cell to see what it is. The Nerve tab shows the wiring.';
  const parts = [CELLS[cell.typeName].name];
  if (cell.neuron) parts.push(describeNeuronSetting(cell.neuron));
  const key = keyOfCell(cell);
  const fibresIn = reference.edited.fibres.filter(fibre => fibreEndKey(fibre) === key).length;
  const fibresOut = reference.edited.fibres.filter(fibre => fibreStartKey(fibre) === key).length;
  if (fibresIn) parts.push(`${fibresIn} fibre${fibresIn === 1 ? '' : 's'} in`);
  if (fibresOut) parts.push(`${fibresOut} out`);
  return parts.join(' · ');
}

// a neuron's name and setting, such as "Pacemaker 1.8 Hz"
function describeNeuronSetting(neuron) {
  const neuronType = NEURONS[neuron.kind];
  const setting = neuronType.setting;
  if (!setting) return neuronType.name;
  return `${neuronType.name} ${neuron.setting}${setting.unit ? ' ' + setting.unit : ''}`;
}
