'use strict';
// The builder and sandbox app: its state, the controls, mouse and keyboard input, and the frame loop (browser only).
// The editing rules are in builder.js, the drawing in builderview.js, the toolbar in toolbar.js, the side panel in
// panel.js (with coach.js), the dock in dock.js, the library in library.js, the tooltip in tooltip.js and
// the sandbox in sandbox.js; the signal traces (runs, and the builder's Traces window) are in probes.js.

const START_DESIGN = 'jet';
const START_CELL_TYPE = 'muscle';
const START_NEURON = 'pacemaker';
const MAX_FRAME_TIME = 0.05;                              // s; a slower frame (below 20 fps) slows the game down
const FPS_SMOOTHING = 0.05;                               // share of the newest frame in the shown fps
const TANK_MARGIN = 160;                                  // px of water around the test tank's creature
const TANK_CENTER_PULL = 0.05;                            // share of the creature's offset from the middle, per frame
const SAVE_MENU_WIDTH = 230;                              // px kept free right of the save menu's corner
const SAVE_MENU_HEIGHT = 120;                             // px
const LAYER_BY_KEY = { 1: 'body', 2: 'nerve', 3: 'vessel' };    // the builder's tab each number key opens
// keys with a job of their own, which a Command can't be bound to: the tabs, Q/E, F, H, M, and P, R, T in runs
const RESERVED_KEYS = new Set(['1', '2', '3', 'e', 'f', 'h', 'm', 'n', 'p', 'q', 'r', 't']);

// The one place the app state is built. Every browser file reads and changes the app through this object.
function createApp(canvas) {
  return {
    canvas,
    context: canvas.getContext('2d'),
    mode: 'build',                                        // or 'sandbox' or 'level'
    layer: 'body',                                        // the builder's view: 'body' or 'nerve'
    fluidView: 0,                                         // 0 = normal, otherwise 1 + the index of the fluid shown
    keysHeld: new Set(),                                  // lower-case key names
    commandKeysHeld: new Set(),                           // letter and number keys held, for bound Commands
    edited: createEditedDesign(TEMPLATES[START_DESIGN],
      readStorage('unlimited-biomass', false) ? Infinity : RULES.budget),
    lastLoadedName: '',                                   // the saved creature last loaded, offered when saving again
    selectedType: START_CELL_TYPE,                        // the cell type a click places (Body view)
    selectedNeuron: START_NEURON,                         // the neuron a click places (Nerve view)
    focusKey: null,                                       // the clicked cell, shown and set up in the panel
    selection: new Set(),                                 // Ctrl+clicked hexes
    stamp: null,                                          // a saved part being placed: { template, rotation }
    mirrorAxes: readStorage('mirror-axes', []),           // the symmetry axes on, as turns of 30° (builder.js)
    paintDrag: null,                                      // a held button painting cells: { isErasing, lastPoint }
    cursorStyle: '',                                      // the canvas's CSS cursor, set when it changes
    partDrag: null,                                       // a Bud part being dragged: { budKey, grab, rotation }
    aimDragKey: null,                                     // the Bud whose aim arrow is being dragged
    fibreDrag: null,                                      // a fibre being laid: { fromKey }
    vesselDrag: null,                                     // a vessel being laid: { fromKey }
    libraryDrag: null,                                    // a library entry being dragged onto a Bud
    panDrag: null,                                        // middle-drag: { panX, panY, mouseX, mouseY } at its start
    hoverHex: null,                                       // [q, r] under the mouse
    hoverPoint: null,                                     // the mouse in grid px
    gridView: createGridView(),
    warnings: [],                                         // design warnings, { need, level, short, text, keys }
    needRows: [],                                         // the Needs card's rows (designNeeds)
    hoveredNeed: null,                                    // the need whose row is under the mouse: its cells are marked
    cardFibres: [],                                       // the clicked cell's fibres, listed in the card
    hoveredFibre: null,                                   // a fibre whose row in the card is under the mouse
    library: loadLibrary(),
    libraryRows: [],
    dockButtons: new Map(),                               // cell types
    neuronButtons: new Map(),
    showDockLayer: () => {},
    fluidViewButtons: [],
    tank: null,                                           // the test tank driving the live grid and the preview
    world: null,                                          // the sandbox
    player: null,
    sandboxLight: null,                                   // { x, y }: the mouse over the sandbox water, a light
    sandboxSpeed: 1,                                     // game speed: 2 is double, 0.5 is slow motion
    paused: false,
    stepRequested: false,                                 // paused: run one step on the next frame
    level: null,                                          // the chosen level (data/levels.js); null: free build
    sheetLevel: null,                                     // the level whose card the levels sheet shows
    levelRun: null,                                       // the level being played (levels.js startLevel)
    levelDesign: null,                                    // the design it runs, kept for a retry and the score
    levelResults: {},                                     // best result per level id: { stars, seconds, biomass }
    isHintShown: false,
    musicOff: false,                                     // the player switched the background music off
    soundsOff: false,                                    // the player switched the sound effects off (sound.js)
    probes: createProbes(),                               // the signal traces of the player's cells in a run
    isProbesShown: true,
    hudBars: [],
    isPreviewCollapsed: () => false,
    tooltip: createTooltipState(),
    builderTraces: createProbes(),                        // the Traces window's lanes: the test tank's signals
    isTracesCollapsed: () => false,
    coach: createCoach(),                                 // the How to box
    fps: 60,
    lastFrameTime: performance.now(),
  };
}

function boot() {
  const app = createApp(byId('game'));
  fitCanvasToWindow(app);
  addEventListener('resize', () => {
    fitCanvasToWindow(app);
    if (app.mode === 'build') rebuildTank(app);
  });
  const dock = buildDock(typeName => pickCellType(app, typeName), kind => pickNeuron(app, kind));
  app.dockButtons = dock.cellButtons;
  app.neuronButtons = dock.neuronButtons;
  app.showDockLayer = dock.showLayer;
  app.showDockLayer(app.layer);
  setUpWindows(app);
  setUpToolbar(app);
  setUpCoach(app);
  setUpSaveMenu(app);
  setUpSandboxBar(app);
  setUpMusic(app);
  setUpSounds(app);
  setUpLevels(app);
  app.isProbesShown = readStorage('probes-shown', true);
  app.hudBars = makeHudBars(byId('hud-bars'));
  showLibraryRows(app);
  listenToKeyboard(app);
  listenToMouse(app);
  rebuildTank(app);
  requestAnimationFrame(time => runFrame(app, time));
}

function fitCanvasToWindow(app) {
  app.canvas.width = innerWidth;
  app.canvas.height = innerHeight;
}

function setUpWindows(app) {
  app.isPreviewCollapsed = makeCollapsible(byId('preview'), byId('preview-bar'), byId('preview-toggle'), 'preview');
  makeCollapsible(byId('library'), byId('library-bar'), byId('library-toggle'), 'library');
  app.isTracesCollapsed = makeCollapsible(byId('traces'), byId('traces-bar'), byId('traces-toggle'), 'traces');
  showTracesWindow(app);
}

// ---------- The design ----------
// Rebuilds the test tank from the design: a hidden sim that drives the live signals and fluids on the grid and in the
// preview. Called after every change to the design, so it also drops selections of cells that are gone.
function rebuildTank(app) {
  const body = bodyDesign(app.edited);
  const reach = Math.max(0, ...body.cells.map(cell => vectorLength(...hexToPixel(cell.q, cell.r))));
  const size = 2 * reach + 2 * CELL_RADIUS + TANK_MARGIN;
  app.tank = newTestTank(size, size);
  app.tank.time = performance.now() / 1000;
  spawn(app.tank, body, size / 2, size / 2, 0, 0);
  resetBuilderTraces(app);
  for (const key of app.selection) {
    if (!app.edited.cells.has(key)) app.selection.delete(key);
  }
  if (app.focusKey && !app.edited.cells.has(app.focusKey)) app.focusKey = null;
  refreshPanel(app);
}

// shows why an edit couldn't be made, after redrawing the panel (which would overwrite it)
function showProblem(app, problem) {
  rebuildTank(app);
  if (problem) showMessage(problem);
}

// Replaces the whole design. A design over the budget still loads, and the panel says why it can't be used as is.
function loadDesign(app, design, label, savedName) {
  app.edited = createEditedDesign(design, app.edited.biomassLimit, app.edited.kit);
  app.lastLoadedName = savedName;
  app.stamp = null;
  app.selection.clear();
  app.focusKey = null;
  rebuildTank(app);
  const problem = buildCheck(bodyDesign(app.edited), chosenLimits(app));
  if (problem) showMessage(`${label}: ${problem}. Try it in the Sandbox, or trim it to fit.`);
}

function pickCellType(app, typeName) {
  app.selectedType = typeName;
  app.stamp = null;
  refreshPanel(app);
}

function pickNeuron(app, kind) {
  app.selectedNeuron = kind;
  refreshPanel(app);
}

// ---------- Body, Nerve and Vessels views ----------
// switches the builder between the Body view (cells), the Nerve view (neurons and fibres) and the Vessels view
function showLayer(app, layer) {
  app.layer = layer;
  app.stamp = null;
  app.partDrag = null;
  app.aimDragKey = null;
  app.fibreDrag = null;
  app.vesselDrag = null;
  app.showDockLayer(layer);
  showTracesWindow(app);
  refreshPanel(app);
}

// ---------- The library ----------
function showLibraryRows(app) {
  app.libraryRows = showLibrary(app.library, {
    use: entry => useLibraryEntry(app, entry),
    rename: entry => renameLibraryEntry(app, entry),
    remove: entry => removeLibraryEntry(app, entry),
    startDrag: entry => {
      app.libraryDrag = entry;
    },
  });
}

// A creature replaces the design. A part goes to the clicked Bud, or else is picked up as a stamp (clicking the stamp
// in hand again puts it down).
function useLibraryEntry(app, entry) {
  if (entry.isCreature) {
    loadDesign(app, entry, entry.name, entry.name);
    return;
  }
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  if (focused && CELLS[focused.typeName].growsParts) {
    showProblem(app, giveBudPart(app.edited, app.focusKey, entry));
    return;
  }
  app.stamp = app.stamp && app.stamp.template === entry ? null : { template: entry, rotation: 0 };
  refreshPanel(app);
}

function renameLibraryEntry(app, entry) {
  const name = prompt(entry.isCreature ? 'Creature name' : 'Template name', entry.name);
  if (!name || !cleanName(name)) return;
  entry.name = cleanName(name);
  saveAndShowLibrary(app);
}

function removeLibraryEntry(app, entry) {
  if (!confirm(`Delete ${entry.isCreature ? 'creature' : 'template'} "${entry.name}"?`)) return;
  app.library = app.library.filter(other => other !== entry);
  if (app.stamp && app.stamp.template === entry) app.stamp = null;
  saveAndShowLibrary(app);
}

function saveAndShowLibrary(app) {
  saveLibrary(app.library);
  showLibraryRows(app);
  refreshPanel(app);
}

// ---------- The save menu (right-click on the selection, or Save creature) ----------
function setUpSaveMenu(app) {
  byId('save-menu-save').onclick = () => {
    saveSelection(app, byId('save-menu-name').value);
    closeSaveMenu();
  };
  byId('save-menu-clear').onclick = () => {
    app.selection.clear();
    closeSaveMenu();
  };
  byId('save-menu-name').addEventListener('keydown', event => {
    if (event.key === 'Enter') byId('save-menu-save').onclick();
    if (event.key === 'Escape') closeSaveMenu();
  });
  addEventListener('mousedown', event => {
    if (!(event.target && event.target.closest && event.target.closest('#save-menu'))) closeSaveMenu();
  });
}

// asks for a name; a selection with the Nucleus is saved as a whole creature, anything else as a part
function openSaveMenu(app, x, y) {
  const selected = [...app.selection].map(key => app.edited.cells.get(key));
  const isCreature = selected.some(cell => CELLS[cell.typeName].isNucleus);
  const count = selected.length;
  byId('save-menu-title').textContent = `${count} selected cell${count === 1 ? '' : 's'}` +
    (isCreature ? ' (with the Nucleus: saves a whole creature)' : '');
  const creatureCount = app.library.filter(entry => entry.isCreature).length;
  byId('save-menu-name').value = isCreature
    ? app.lastLoadedName || `Creature ${creatureCount + 1}`
    : `Part ${app.library.length + 1}`;
  byId('save-menu-save').textContent = isCreature ? 'Save creature' : 'Save template';
  Object.assign(byId('save-menu').style, {
    display: 'block',
    left: Math.min(x, innerWidth - SAVE_MENU_WIDTH) + 'px',
    top: Math.min(y, innerHeight - SAVE_MENU_HEIGHT) + 'px',
  });
  byId('save-menu-name').focus?.();
  byId('save-menu-name').select?.();
}

function closeSaveMenu() {
  byId('save-menu').style.display = 'none';
}

// saves the selected cells in the library, replacing an entry of the same kind and name
function saveSelection(app, name) {
  const entry = templateFromSelection(app.edited, app.selection, cleanName(name) || `Part ${app.library.length + 1}`);
  if (!entry) return;
  const replaced = storeTemplate(app.library, entry);
  if (replaced && app.stamp && app.stamp.template === replaced) app.stamp = null;
  app.selection.clear();
  saveAndShowLibrary(app);
  showMessage(`${replaced ? 'Overwrote' : 'Saved'} "${entry.name}" in ` +
    `${entry.isCreature ? 'My creatures' : 'My templates'}.`);
}

// ---------- Modes ----------
// the windows of the app's mode: the builder's, or the HUD with the Sandbox's or the level's bar
function showModeWindows(app) {
  const isBuilding = app.mode === 'build';
  for (const id of ['builder-left', 'layer-tabs', 'budget', 'preview', 'library']) {
    byId(id).style.display = isBuilding ? '' : 'none';     // '' gives the display back to style.css
  }
  if (!isBuilding) {
    byId('keys-sheet').style.display = 'none';
    byId('levels-sheet').style.display = 'none';
  }
  byId('dock').style.display = isBuilding ? '' : 'none';
  showTracesWindow(app);
  byId('hud').style.display = isBuilding ? 'none' : 'block';
  byId('sandbox-bar').style.display = app.mode === 'sandbox' ? 'flex' : 'none';
  byId('level-bar').style.display = app.mode === 'level' ? 'flex' : 'none';
  byId('level-result').style.display = 'none';
}

function enterBuilder(app) {
  app.mode = 'build';
  app.world = null;
  app.player = null;
  app.levelRun = null;
  app.gridView.panX = 0;                                // the Nucleus back in the middle of the screen
  app.gridView.panY = 0;
  showModeWindows(app);
  rebuildTank(app);
}

// what the builder's design must fit: the chosen level's limits, or RULES
function chosenLimits(app) {
  return app.level ? levelLimits(app.level) : RULES;
}

// ---------- Keyboard ----------
function listenToKeyboard(app) {
  addEventListener('keydown', event => {
    if (event.target && event.target.tagName === 'INPUT') return;   // typing a name
    const key = event.key.toLowerCase();
    app.keysHeld.add(key);
    if (key === ' ') event.preventDefault();
    if (key === 'm' && !event.repeat) toggleMusic(app);
    if (key === 'n' && !event.repeat) toggleSounds(app);
    if (key === 't' && !event.repeat && app.mode !== 'build') toggleProbes(app);
    const digit = digitOf(event);
    const commandKey = commandKeyOf(event);
    if (digit && event.shiftKey) {
      if (digit >= '1' && digit <= String(FLUIDS.length + 1)) showFluidView(app, +digit - 1);
    } else if (commandKey) {
      app.commandKeysHeld.add(commandKey);
      if (!event.repeat) pressKeyInBuilder(app, commandKey);
    }
    if (app.mode === 'build') handleBuilderKey(app, key);
    else if (app.mode === 'sandbox') handleSandboxKey(app, key);
    else handleLevelKey(app, key);
  });
  addEventListener('keyup', event => {
    app.keysHeld.delete(event.key.toLowerCase());
    const commandKey = commandKeyOf(event);
    if (commandKey) app.commandKeysHeld.delete(commandKey);
  });
}

// the number key pressed ('0'–'9'), from the key's position so that Shift doesn't change it; null for other keys
function digitOf(event) {
  if (/^Digit[0-9]$/.test(event.code || '')) return event.code[5];
  return /^[0-9]$/.test(event.key) ? event.key : null;
}

// the key a Command can fire on: a letter ('a'–'z') or a number key, without Ctrl or Alt; null for other keys.
// Reserved keys count too, so that a Command bound to one in an older save still fires.
function commandKeyOf(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = digitOf(event) || (event.key || '').toLowerCase();
  return /^[a-z0-9]$/.test(key) ? key : null;
}

// in the builder, 1–3 open the Body, Nerves and Vessels tabs, and any other free key binds the clicked Command
function pressKeyInBuilder(app, commandKey) {
  if (app.mode !== 'build') return;
  if (LAYER_BY_KEY[commandKey]) showLayer(app, LAYER_BY_KEY[commandKey]);
  else if (!RESERVED_KEYS.has(commandKey)) bindFocusedCommand(app, commandKey);
}

// binds the clicked cell's Command neuron to the key, if a Command neuron is clicked
function bindFocusedCommand(app, commandKey) {
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  if (!focused || !focused.neuron || focused.neuron.kind !== 'command') return;
  toggleCommandKey(app.edited, app.focusKey, commandKey);
  rebuildTank(app);
}

// F fits the grid; H shows the keys; Esc drops what is in hand; Q/E turn the stamp, the dragged part or the
// clicked Bud's part
function handleBuilderKey(app, key) {
  if (key === 'f') fitGridToScreen(app);
  if (key === 'h') toggleKeysSheet();
  if (key === 'escape') {
    if (app.partDrag || app.aimDragKey || app.fibreDrag || app.vesselDrag) {
      app.partDrag = null;
      app.aimDragKey = null;
      app.fibreDrag = null;
      app.vesselDrag = null;
    } else {
      app.stamp = null;
      app.selection.clear();
      app.focusKey = null;
    }
    closeSaveMenu();
    byId('keys-sheet').style.display = 'none';
    closeLevelsSheet();
    refreshPanel(app);
  }
  if (key === 'q' || key === 'e') turnWhatIsInHand(app, key === 'e' ? 1 : -1);
}

function turnWhatIsInHand(app, steps) {
  if (app.stamp) {
    app.stamp.rotation += steps;
    return;
  }
  if (app.partDrag) {
    app.partDrag.rotation += steps;
    app.partDrag.grab = rotateHex(app.partDrag.grab[0], app.partDrag.grab[1], steps);
    return;
  }
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  if (focused && focused.budPart) showProblem(app, turnBudPart(app.edited, app.focusKey, steps));
}

// ---------- Mouse ----------
function hexUnderMouse(app, event) {
  return pixelToHex(...screenToGrid(app, event.clientX, event.clientY));
}

function listenToMouse(app) {
  const canvas = app.canvas;
  canvas.addEventListener('mousemove', event => {
    trackMouse(app, event);
    trackSandboxLight(app, event);
  });
  canvas.addEventListener('mousedown', event => {
    if (app.mode === 'sandbox') handleSandboxClick(app, event);
    else if (app.mode === 'level') handleLevelClick(app, event);
    else if (app.mode === 'build') handleBuilderMouseDown(app, event);
  });
  canvas.addEventListener('wheel', event => {
    if (app.mode !== 'build') return;
    event.preventDefault();
    zoomAtCursor(app, event.clientX, event.clientY, event.deltaY);
  }, { passive: false });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    const isOnSelection = app.selection.has(hexKey(...hexUnderMouse(app, event)));
    if (app.mode === 'build' && !app.stamp && isOnSelection) openSaveMenu(app, event.clientX, event.clientY);
  });
  addEventListener('mouseup', event => dropWhatIsInHand(app, event));
  addEventListener('mousemove', event => trackTooltipTarget(app, event));
  addEventListener('mousedown', () => hideTooltip(app));
}

function trackMouse(app, event) {
  const pan = app.panDrag;
  if (pan) {
    app.gridView.panX = pan.panX + event.clientX - pan.mouseX;
    app.gridView.panY = pan.panY + event.clientY - pan.mouseY;
  }
  if (app.mode !== 'build') {
    app.hoverHex = null;
    return;
  }
  app.hoverHex = hexUnderMouse(app, event);
  app.hoverPoint = screenToGrid(app, event.clientX, event.clientY);
  if (app.paintDrag) paintAlongStroke(app);
}

// Middle button pans. Left: grab a Bud's aim arrow or part, Ctrl+click selects, a click on a cell sets it up, a click
// on an empty hex places the chosen cell. Right: remove. While a stamp is in hand, left places it and right drops it.
function handleBuilderMouseDown(app, event) {
  if (event.button === 1) {
    event.preventDefault();
    app.panDrag = { panX: app.gridView.panX, panY: app.gridView.panY, mouseX: event.clientX, mouseY: event.clientY };
    return;
  }
  const [q, r] = hexUnderMouse(app, event);
  if (app.layer === 'nerve') {
    handleNerveMouseDown(app, event, q, r);
    return;
  }
  if (app.layer === 'vessel') {
    handleVesselMouseDown(app, event, q, r);
    return;
  }
  const key = hexKey(q, r);
  const isLeft = event.button === 0;
  const isRight = event.button === 2;
  const withCtrl = event.ctrlKey || event.metaKey;
  if (isLeft && !app.stamp && !withCtrl && grabBudHandle(app, q, r)) return;
  if (app.stamp) {
    useStamp(app, isRight, q, r);
    return;
  }
  if (isLeft && withCtrl) {
    if (app.edited.cells.has(key) && !app.selection.delete(key)) app.selection.add(key);
    return;
  }
  if (isRight && app.selection.has(key)) return;          // the save menu opens on the selection instead
  if (isLeft && app.edited.cells.has(key)) {
    app.focusKey = key;
    refreshPanel(app);
    return;
  }
  app.paintDrag = { isErasing: isRight, lastPoint: screenToGrid(app, event.clientX, event.clientY) };
  if (isRight) {
    if (removeMirrored(app.edited, q, r, app.mirrorAxes)) playSound(app, 'remove');
  } else if (!placeChosenCell(app, q, r)) {
    playSound(app, 'refuse');
    return;
  }
  rebuildTank(app);
}

// While the button that placed or removed a cell is held, every hex the mouse passes over gets the same: the
// chosen cell, or removal. Hexes that can't take the cell are passed over quietly.
function paintAlongStroke(app) {
  const drag = app.paintDrag;
  if (app.mode !== 'build' || app.layer !== 'body' || app.stamp) {
    app.paintDrag = null;
    return;
  }
  let changed = 0;
  for (const [q, r] of hexesAlongStroke(drag.lastPoint, app.hoverPoint).slice(1)) {
    if (drag.isErasing) changed += removeMirrored(app.edited, q, r, app.mirrorAxes);
    else changed += placeMirrored(app.edited, q, r, app.selectedType, app.mirrorAxes);
  }
  drag.lastPoint = app.hoverPoint;
  if (!changed) return;
  playSound(app, drag.isErasing ? 'remove' : 'place');
  rebuildTank(app);
}

// Nerve view: a press on a cell starts a fibre from it (see finishFibreDrag) and selects it; a right-click takes out
// the fibre or neuron under the mouse (the one drawn red, see nerveRemovalTarget).
function handleNerveMouseDown(app, event, q, r) {
  const key = hexKey(q, r);
  if (event.button === 2) {
    const target = nerveRemovalTarget(app.edited, screenToGrid(app, event.clientX, event.clientY));
    if (!target) return;
    if (target.fibre) removeFibre(app.edited, target.fibre);
    else removeNeuron(app.edited, target.neuronKey);
    playSound(app, 'remove');
    rebuildTank(app);
    return;
  }
  if (!app.edited.cells.has(key)) return;
  if (event.button !== 0) return;
  app.fibreDrag = { fromKey: key };
  app.focusKey = key;
  refreshPanel(app);
}

// Letting go on another cell lays a fibre to it (or removes the one already there); letting go on the same cell puts
// the chosen neuron in, if the cell has none.
function finishFibreDrag(app, hex) {
  const fromKey = app.fibreDrag.fromKey;
  const toKey = hexKey(...hex);
  const cell = app.edited.cells.get(fromKey);
  if (toKey === fromKey && !cell.neuron) {
    placeNeuron(app.edited, fromKey, app.selectedNeuron);
    playSound(app, 'place');
  } else {
    const result = toggleFibre(app.edited, fromKey, toKey);
    if (result) playSound(app, result === 'laid' ? 'wire' : 'remove');
  }
  rebuildTank(app);
}

// Vessels view: a press on a cell starts a vessel from it (see finishVesselDrag) and selects it; a right-click takes
// out the vessel under the mouse (the one drawn red).
function handleVesselMouseDown(app, event, q, r) {
  const key = hexKey(q, r);
  if (event.button === 2) {
    const vessel = vesselRemovalTarget(app.edited, screenToGrid(app, event.clientX, event.clientY));
    if (!vessel) return;
    removeVessel(app.edited, vessel);
    playSound(app, 'remove');
    rebuildTank(app);
    return;
  }
  if (event.button !== 0 || !app.edited.cells.has(key)) return;
  app.vesselDrag = { fromKey: key };
  app.focusKey = key;
  refreshPanel(app);
}

// letting go on another cell lays a vessel to it, or removes the one already there
function finishVesselDrag(app, hex) {
  const result = toggleVessel(app.edited, app.vesselDrag.fromKey, hexKey(...hex));
  if (!result) return;
  playSound(app, result === 'laid' ? 'vessel' : 'remove');
  rebuildTank(app);
}

// grabs the clicked Bud's aim arrow tip or a cell of a Bud's part, if one is under the mouse
function grabBudHandle(app, q, r) {
  const handle = budHandleAt(app.edited, q, r, app.hoverPoint, app.focusKey);
  if (!handle) return false;
  app.focusKey = handle.budKey;
  if (handle.isAim) app.aimDragKey = handle.budKey;
  else app.partDrag = handle;
  refreshPanel(app);
  return true;
}

function useStamp(app, isRight, q, r) {
  if (isRight) {
    app.stamp = null;
    refreshPanel(app);
    return;
  }
  const problem = placeStamp(app.edited, app.stamp, q, r);
  if (problem) {
    showMessage(problem);
    playSound(app, 'refuse');
  } else {
    playSound(app, 'place');
    rebuildTank(app);
  }
}

// places the chosen cell type, and its mirror images; a new Bud is clicked at once, ready to be given a part
function placeChosenCell(app, q, r) {
  if (!placeMirrored(app.edited, q, r, app.selectedType, app.mirrorAxes)) return false;
  playSound(app, 'place');
  app.focusKey = CELLS[app.selectedType].growsParts ? hexKey(q, r) : null;
  return true;
}

// lets go of a dragged Bud part, aim arrow or library part; a drop that doesn't fit says why
function dropWhatIsInHand(app, event) {
  const hex = app.hoverHex;
  if (app.mode === 'build' && hex && app.fibreDrag) finishFibreDrag(app, hex);
  if (app.mode === 'build' && hex && app.vesselDrag) finishVesselDrag(app, hex);
  if (app.mode === 'build' && hex) {
    const drag = app.partDrag;
    if (drag) {
      showProblem(app,
        moveBudPart(app.edited, drag.budKey, drag.rotation, hex[0] - drag.grab[0], hex[1] - drag.grab[1]));
    }
    if (app.aimDragKey && app.hoverPoint) {
      aimBudPart(app.edited, app.aimDragKey, app.hoverPoint[0], app.hoverPoint[1]);
      rebuildTank(app);
    }
    const target = app.edited.cells.get(hexKey(...hex));
    if (app.libraryDrag && event.target === app.canvas && target && CELLS[target.typeName].growsParts) {
      app.focusKey = hexKey(...hex);
      showProblem(app, giveBudPart(app.edited, app.focusKey, app.libraryDrag));
    }
  }
  app.panDrag = null;
  app.paintDrag = null;
  app.partDrag = null;
  app.aimDragKey = null;
  app.libraryDrag = null;
  app.fibreDrag = null;
  app.vesselDrag = null;
}

// ---------- Frames ----------
function runFrame(app, now) {
  const frameTime = (now - app.lastFrameTime) / 1000;
  const dt = Math.min(MAX_FRAME_TIME, frameTime);
  app.lastFrameTime = now;
  app.fps += (1 / Math.max(frameTime, 1e-3) - app.fps) * FPS_SMOOTHING;
  updateMusic(app);
  updateCursor(app);
  if (app.mode === 'build') runBuilderFrame(app, dt, now);
  else if (app.mode === 'sandbox') {
    stepSandbox(app, dt);
    listenToWorld(app, app.world, app.player);
    drawSandbox(app);
  } else {
    stepLevelMode(app, dt);
    listenToWorld(app, app.levelRun.world, app.levelRun.player, app.levelRun);
    drawLevelMode(app);
  }
  requestAnimationFrame(time => runFrame(app, time));
}

// The test tank runs in real time with its creature held facing up in the middle; Space and the number keys fire
// its signal sources.
function runBuilderFrame(app, dt, now) {
  const tank = app.tank;
  for (const creature of tank.creatures) {
    if (!creature.debris) creature.targetHeading = 0;
  }
  step(tank, dt, { swimX: 0, swimY: 0, ability: app.keysHeld.has(' '), heldKeys: app.commandKeysHeld });
  const creature = tank.creatures.find(other => !other.debris);
  if (creature) {
    const shiftX = (tank.width / 2 - creature.centerX) * TANK_CENTER_PULL;
    const shiftY = (tank.height / 2 - creature.centerY) * TANK_CENTER_PULL;
    for (const cell of tank.cells) {
      cell.x += shiftX;
      cell.y += shiftY;
    }
  }
  drawBuilder(app);
  drawPreview(app);
  updateTooltip(app, now);
  runDemo(dt);
  runBuilderTraces(app);
  runCoach(app, dt);
}
