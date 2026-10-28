'use strict';
// The builder and sandbox app: its state, the controls, mouse and keyboard input, and the frame loop (browser only).
// The editing rules are in builder.js, the drawing in builderview.js, the side panel in panel.js, the dock in dock.js,
// the library in library.js, the tooltip in tooltip.js and the sandbox in sandbox.js.

const START_DESIGN = 'starter';
const START_CELL_TYPE = 'muscle';
const MAX_FRAME_TIME = 0.05;                              // s; a slower frame (below 20 fps) slows the game down
const FPS_SMOOTHING = 0.05;                               // share of the newest frame in the shown fps
const TANK_MARGIN = 160;                                  // px of water around the test tank's creature
const TANK_CENTER_PULL = 0.05;                            // share of the creature's offset from the middle, per frame
const SAVE_MENU_WIDTH = 230;                              // px kept free right of the save menu's corner
const SAVE_MENU_HEIGHT = 120;                             // px

// The one place the app state is built. Every browser file reads and changes the app through this object.
function createApp(canvas) {
  return {
    canvas,
    context: canvas.getContext('2d'),
    mode: 'build',                                        // or 'sandbox'
    fluidView: 0,                                         // 0 = normal, otherwise 1 + the index of the fluid shown
    keysHeld: new Set(),                                  // lower-case key names
    digitsHeld: new Set(),                                // number keys held, for bound Commands
    edited: createEditedDesign(TEMPLATES[START_DESIGN].cells,
      readStorage('unlimited-biomass', false) ? Infinity : RULES.budget),
    lastLoadedName: '',                                   // the saved creature last loaded, offered when saving again
    selectedType: START_CELL_TYPE,                        // the cell type a click places
    focusKey: null,                                       // the clicked cell, shown and set up in the panel
    selection: new Set(),                                 // Ctrl+clicked hexes
    stamp: null,                                          // a saved part being placed: { template, rotation }
    partDrag: null,                                       // a Bud part being dragged: { budKey, grab, rotation }
    aimDragKey: null,                                     // the Bud whose aim arrow is being dragged
    libraryDrag: null,                                    // a library entry being dragged onto a Bud
    panDrag: null,                                        // middle-drag: { panX, panY, mouseX, mouseY } at its start
    hoverHex: null,                                       // [q, r] under the mouse
    hoverPoint: null,                                     // the mouse in grid px
    gridView: createGridView(),
    warnings: [],                                         // design warnings, { text, keys }
    hoveredWarning: -1,
    library: loadLibrary(),
    libraryRows: [],
    dockButtons: new Map(),
    fluidViewButtons: [],
    tank: null,                                           // the test tank driving the live grid and the preview
    world: null,                                          // the sandbox
    player: null,
    hudBars: [],
    isPreviewCollapsed: () => false,
    tooltip: createTooltipState(),
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
  app.dockButtons = buildCellDock(typeName => pickCellType(app, typeName));
  setUpWindows(app);
  setUpFluidViews(app);
  setUpDesignButtons(app);
  setUpSaveMenu(app);
  setUpSandboxBar(app);
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
  makeFloating(byId('panel'), byId('panel-grip'), 'panel');
  app.isPreviewCollapsed = makeCollapsible(byId('preview'), byId('preview-bar'), byId('preview-toggle'), 'preview');
  makeCollapsible(byId('library'), byId('library-bar'), byId('library-toggle'), 'library');
  rememberOpenBranches();
}

// one button per view: normal, then one per fluid (also Shift+1–6)
function setUpFluidViews(app) {
  ['Normal', ...FLUIDS.map(fluid => fluid.short)].forEach((name, view) => {
    const button = document.createElement('button');
    button.className = 'small';
    button.textContent = name;
    button.onclick = () => showFluidView(app, view);
    byId('fluid-views').appendChild(button);
    app.fluidViewButtons.push(button);
  });
}

function showFluidView(app, view) {
  app.fluidView = view;
  if (app.mode === 'build') refreshPanel(app);
}

// the built-in designs, Clear all, Save creature and Unlimited biomass
function setUpDesignButtons(app) {
  document.querySelectorAll('[data-template]').forEach(button => {
    button.onclick = () => {
      const name = button.dataset.template;
      const design = name === 'clear' ? { cells: [createDesignCell(0, 0, 'nucleus')] } : TEMPLATES[name];
      loadDesign(app, design, button.textContent, '');
    };
  });
  byId('save-creature').onclick = event => {
    app.selection = new Set(app.edited.cells.keys());
    openSaveMenu(app, event.clientX, event.clientY);
  };
  byId('unlimited-biomass').onclick = () => {
    const isUnlimited = app.edited.biomassLimit !== Infinity;
    app.edited.biomassLimit = isUnlimited ? Infinity : RULES.budget;
    writeStorage('unlimited-biomass', isUnlimited);
    refreshPanel(app);
  };
}

// ---------- The design ----------
// Rebuilds the test tank from the design: a hidden sim that drives the live signals and fluids on the grid and in the
// preview. Called after every change to the design, so it also drops selections of cells that are gone.
function rebuildTank(app) {
  const cells = bodyCells(app.edited);
  const reach = Math.max(0, ...cells.map(cell => vectorLength(...hexToPixel(cell.q, cell.r))));
  const size = 2 * reach + 2 * CELL_RADIUS + TANK_MARGIN;
  app.tank = newTestTank(size, size);
  app.tank.time = performance.now() / 1000;
  spawn(app.tank, { cells }, size / 2, size / 2, 0, 0);
  for (const key of app.selection) {
    if (!app.edited.cells.has(key)) app.selection.delete(key);
  }
  if (app.focusKey && !app.edited.cells.has(app.focusKey)) app.focusKey = null;
  refreshPanel(app);
}

// shows why an edit couldn't be made, after redrawing the panel (which would overwrite it)
function showProblem(app, problem) {
  rebuildTank(app);
  if (problem) byId('info').textContent = problem;
}

// Replaces the whole design. A design over the budget still loads, and the panel says why it can't be used as is.
function loadDesign(app, design, label, savedName) {
  app.edited = createEditedDesign(design.cells, app.edited.biomassLimit);
  app.lastLoadedName = savedName;
  app.stamp = null;
  app.selection.clear();
  app.focusKey = null;
  rebuildTank(app);
  const problem = buildCheck(bodyDesign(app.edited));
  if (problem) byId('info').textContent = `${label}: ${problem}. Try it in the Sandbox, or trim it to fit.`;
}

function pickCellType(app, typeName) {
  app.selectedType = typeName;
  app.stamp = null;
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
  byId('info').textContent = `${replaced ? 'Overwrote' : 'Saved'} "${entry.name}" in ` +
    `${entry.isCreature ? 'My creatures' : 'My templates'}.`;
}

// ---------- Modes ----------
function showBuilderWindows(isShown) {
  for (const id of ['panel', 'preview', 'library']) byId(id).style.display = isShown ? 'flex' : 'none';
  byId('dock').style.display = isShown ? 'block' : 'none';
  byId('hud').style.display = isShown ? 'none' : 'block';
  byId('sandbox-bar').style.display = isShown ? 'none' : 'flex';
}

function enterBuilder(app) {
  app.mode = 'build';
  app.world = null;
  app.player = null;
  showBuilderWindows(true);
  rebuildTank(app);
}

// ---------- Keyboard ----------
function listenToKeyboard(app) {
  addEventListener('keydown', event => {
    if (event.target && event.target.tagName === 'INPUT') return;   // typing a name
    const key = event.key.toLowerCase();
    app.keysHeld.add(key);
    if (key === ' ') event.preventDefault();
    const digit = digitOf(event);
    if (digit && event.shiftKey) {
      if (digit >= '1' && digit <= String(FLUIDS.length + 1)) showFluidView(app, +digit - 1);
    } else if (digit && digit !== '0') {
      app.digitsHeld.add(digit);
      if (!event.repeat) bindFocusedCommand(app, digit);
    }
    if (app.mode === 'build') handleBuilderKey(app, key);
    else handleSandboxKey(app, key);
  });
  addEventListener('keyup', event => {
    app.keysHeld.delete(event.key.toLowerCase());
    const digit = digitOf(event);
    if (digit) app.digitsHeld.delete(digit);
  });
}

// the number key pressed ('0'–'9'), from the key's position so that Shift doesn't change it; null for other keys
function digitOf(event) {
  if (/^Digit[0-9]$/.test(event.code || '')) return event.code[5];
  return /^[0-9]$/.test(event.key) ? event.key : null;
}

// in the builder, a number key binds the clicked Command to it
function bindFocusedCommand(app, digit) {
  const focused = app.mode === 'build' && app.focusKey && app.edited.cells.get(app.focusKey);
  if (!focused || CELLS[focused.typeName].signalSource !== 'key') return;
  toggleCommandKey(app.edited, app.focusKey, digit);
  rebuildTank(app);
}

// F fits the grid; Esc drops what is in hand; Q/E turn the stamp, the dragged part or the clicked Bud's part
function handleBuilderKey(app, key) {
  if (key === 'f') fitGridToScreen(app);
  if (key === 'escape') {
    if (app.partDrag || app.aimDragKey) {
      app.partDrag = null;
      app.aimDragKey = null;
    } else {
      app.stamp = null;
      app.selection.clear();
      app.focusKey = null;
    }
    closeSaveMenu();
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
  canvas.addEventListener('mousemove', event => trackMouse(app, event));
  canvas.addEventListener('mousedown', event => {
    if (app.mode === 'sandbox') handleSandboxClick(app, event);
    else handleBuilderMouseDown(app, event);
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
  if (isRight) removeCell(app.edited, q, r);
  else if (!placeChosenCell(app, q, r)) return;
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
  if (problem) byId('info').textContent = problem;
  else rebuildTank(app);
}

// places the chosen cell type; a new Bud or Command is clicked at once, ready to be set up
function placeChosenCell(app, q, r) {
  if (!canPlaceCell(app.edited, q, r, app.selectedType)) return false;
  placeCell(app.edited, q, r, app.selectedType);
  const cellType = CELLS[app.selectedType];
  app.focusKey = cellType.growsParts || cellType.signalSource === 'key' ? hexKey(q, r) : null;
  return true;
}

// lets go of a dragged Bud part, aim arrow or library part; a drop that doesn't fit says why
function dropWhatIsInHand(app, event) {
  const hex = app.hoverHex;
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
  app.partDrag = null;
  app.aimDragKey = null;
  app.libraryDrag = null;
}

// ---------- Frames ----------
function runFrame(app, now) {
  const frameTime = (now - app.lastFrameTime) / 1000;
  const dt = Math.min(MAX_FRAME_TIME, frameTime);
  app.lastFrameTime = now;
  app.fps += (1 / Math.max(frameTime, 1e-3) - app.fps) * FPS_SMOOTHING;
  if (app.mode === 'build') runBuilderFrame(app, dt, now);
  else {
    stepSandbox(app, dt);
    drawSandbox(app);
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
  step(tank, dt, { swimX: 0, swimY: 0, ability: app.keysHeld.has(' '), heldKeys: app.digitsHeld });
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
}
