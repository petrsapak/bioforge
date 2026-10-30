'use strict';
// The builder's toolbar down the left edge (Clear, Save creature, Unlimited biomass, Symmetry, Levels and the Sandbox
// button), the keys sheet (H), the fluid views (Shift+1–6) and the Body, Nerves and Vessels tabs at the top (browser only).

function setUpToolbar(app) {
  setUpLayerSwitch(app);
  setUpDesignButtons(app);
  setUpMirrorMenu(app);
  setUpKeysSheet();
}

// the tabs at the top centre; the keys 1, 2 and 3 are in ui.js
function setUpLayerSwitch(app) {
  byId('layer-body').onclick = () => showLayer(app, 'body');
  byId('layer-nerve').onclick = () => showLayer(app, 'nerve');
  byId('layer-vessel').onclick = () => showLayer(app, 'vessel');
}

// shows fluid view number `view` (0 = normal, otherwise 1 + its index in FLUIDS): from Shift+1–6, and in the builder
// from a click on a Needs row (panel.js)
function showFluidView(app, view) {
  app.fluidView = view;
  if (app.mode === 'build') refreshPanel(app);
}

// the built-in designs, Clear, Save creature and Unlimited biomass
function setUpDesignButtons(app) {
  document.querySelectorAll('[data-template]').forEach(button => {
    button.onclick = () => {
      const name = button.dataset.template;
      const design = name === 'clear' ? { cells: [createDesignCell(0, 0, 'nucleus')], fibres: [] } : TEMPLATES[name];
      loadDesign(app, design, button.textContent, '');
    };
  });
  byId('save-creature').onclick = event => {
    app.selection = new Set(app.edited.cells.keys());
    openSaveMenu(app, event.clientX, event.clientY);
  };
  byId('unlimited-biomass').onclick = () => {
    const isUnlimited = app.edited.biomassLimit !== Infinity;
    app.edited.biomassLimit = isUnlimited ? Infinity : chosenLimits(app).budget;
    writeStorage('unlimited-biomass', isUnlimited);
    refreshPanel(app);
  };
}

// The Symmetry button opens a dial of the six axes through the Nucleus; each one clicked turns on or off. Cells
// placed or removed in the Body view are mirrored across every axis that is on (builder.js).
function setUpMirrorMenu(app) {
  const dial = byId('mirror-dial');
  for (let axisTurns = 0; axisTurns < MIRROR_AXIS_COUNT; axisTurns++) {
    const line = document.createElement('button');
    line.className = 'mirror-axis';
    line.dataset.axis = String(axisTurns);
    line.title = `Axis at ${axisTurns * 30}°${axisTurns === FRONT_TO_BACK_AXIS ? ' (front to back)' : ''}`;
    line.style.setProperty('--angle', `${axisTurns * 30}deg`);
    line.onclick = () => toggleMirrorAxis(app, axisTurns);
    dial.appendChild(line);
  }
  byId('mirror-axes').onclick = () => {
    const menu = byId('mirror-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  };
  byId('mirror-none').onclick = () => setMirrorAxes(app, []);
  addEventListener('mousedown', event => {
    const target = event.target;
    if (target && target.closest && (target.closest('#mirror-menu') || target.closest('#mirror-axes'))) return;
    byId('mirror-menu').style.display = 'none';
  });
  showMirrorAxes(app);
}

function toggleMirrorAxis(app, axisTurns) {
  const isOn = app.mirrorAxes.includes(axisTurns);
  setMirrorAxes(app, isOn ? app.mirrorAxes.filter(other => other !== axisTurns) : [...app.mirrorAxes, axisTurns]);
}

// keeps the axes for the next visit too
function setMirrorAxes(app, axes) {
  app.mirrorAxes = axes;
  writeStorage('mirror-axes', axes);
  showMirrorAxes(app);
}

// lights the axes that are on in the dial, and the toolbar button while any is
function showMirrorAxes(app) {
  for (const line of byId('mirror-dial').children) {
    line.classList.toggle('selected', app.mirrorAxes.includes(+line.dataset.axis));
  }
  byId('mirror-axes').classList.toggle('selected', app.mirrorAxes.length > 0);
}

// the sheet of mouse buttons and keys: H or Settings opens it, any click closes it
function setUpKeysSheet() {
  byId('keys-sheet').onclick = toggleKeysSheet;
  byId('game-version').textContent = 'Bioforge Lab ' + GAME_VERSION;
}

function toggleKeysSheet() {
  const sheet = byId('keys-sheet');
  sheet.style.display = sheet.style.display === 'flex' ? 'none' : 'flex';
}
