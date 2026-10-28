'use strict';
// The builder's toolbar down the left edge: the Body and Nerve views, Clear, Save creature, Unlimited biomass, the
// fluid views, the keys sheet and the Sandbox button (browser only).

const NORMAL_VIEW_COLOR = '#dfe4ea';

function setUpToolbar(app) {
  setUpLayerSwitch(app);
  setUpFluidViews(app);
  setUpDesignButtons(app);
  setUpKeysSheet();
}

function setUpLayerSwitch(app) {
  byId('layer-body').onclick = () => showLayer(app, 'body');
  byId('layer-nerve').onclick = () => showLayer(app, 'nerve');
}

// one round button per view, filled with its fluid's colour (also Shift+1–6); the first is the normal view
function setUpFluidViews(app) {
  const views = [{ name: 'Normal', color: NORMAL_VIEW_COLOR }, ...FLUIDS];
  views.forEach((view, i) => {
    const button = document.createElement('button');
    button.className = 'view-dot' + (i === 0 ? ' normal' : '');
    button.title = `${view.name} view (Shift+${i + 1})`;
    button.style.setProperty('--dot-color', view.color);
    button.onclick = () => showFluidView(app, i);
    byId('fluid-views').appendChild(button);
    app.fluidViewButtons.push(button);
  });
}

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

// the sheet of mouse buttons and keys: the toolbar button or H opens it, any click closes it
function setUpKeysSheet() {
  byId('show-keys').onclick = toggleKeysSheet;
  byId('keys-sheet').onclick = toggleKeysSheet;
}

function toggleKeysSheet() {
  const sheet = byId('keys-sheet');
  sheet.style.display = sheet.style.display === 'flex' ? 'none' : 'flex';
}
