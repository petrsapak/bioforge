'use strict';
// The dock at the bottom of the builder: in the Body view a tab per cell category, any number of them open side by
// side, each cell type a hexagon button showing the cell (its name and cost are in the hover hint); in the Nerve view
// the neurons (browser only).

const DOCK_HEX_WIDTH = 54;                                // px
const DOCK_HEX_HEIGHT = Math.round(DOCK_HEX_WIDTH * 2 / Math.sqrt(3));
const DOCK_HEX_GAP = 3;                                   // px
const DOCK_ROWS = 2;                                      // rows of hexagons in every section
const DOCK_ICON_ZOOM = 1.5;                               // how much bigger than in the creature a dock icon is
// the cell radius (px) at which a neuron badge's disc is as big as a whole cell's body, so neuron icons in the
// dock are as big as cell icons (in the creature a badge is about half the cell)
const DOCK_NEURON_CELL_RADIUS = CELL_RADIUS * 0.9 * MEMBRANE_RADIUS / NEURON_BADGE_SIZE;

// Builds the dock. Clicking a cell type calls onPickCell(typeName), a neuron onPickNeuron(kind). Returns the buttons
// by type name and by neuron kind, and showLayer(layer), which shows the tabs and sections of 'body' or 'nerve'.
function buildDock(onPickCell, onPickNeuron) {
  const sections = [];
  const cellButtons = new Map();
  const neuronButtons = new Map();
  for (const [typeName, cellType] of Object.entries(CELLS)) {
    if (cellType.isNucleus) continue;                     // every creature has exactly one, placed for you
    let section = sections[sections.length - 1];
    if (!section || section.category !== cellType.category) {
      section = makeDockSection(cellType.category, 'body');
      sections.push(section);
    }
    const button = makeDockButton(typeName);
    button.onclick = () => onPickCell(typeName);
    addToSection(section, button);
    cellButtons.set(typeName, button);
  }
  const neuronSection = makeDockSection('Neurons', 'nerve');
  sections.push(neuronSection);
  for (const kind of Object.keys(NEURONS)) {
    const button = makeNeuronButton(kind);
    button.onclick = () => onPickNeuron(kind);
    addToSection(neuronSection, button);
    neuronButtons.set(kind, button);
  }
  const bodySections = sections.filter(section => section.layer === 'body');
  const tabs = makeDockTabs(bodySections);
  let layer = 'body';
  const openCategories = readOpenCategories(bodySections);
  const showSections = () => {
    for (const section of sections) {
      const isShown = section.layer === layer && (layer !== 'body' || openCategories.has(section.category));
      section.element.style.display = isShown ? '' : 'none';
    }
    for (const tab of tabs) tab.classList.toggle('selected', openCategories.has(tab.dataset.category));
    byId('dock-tabs').style.display = layer === 'body' ? '' : 'none';
  };
  // a tab opens or closes its category; the last open one stays open, so the dock is never empty
  for (const tab of tabs) {
    tab.onclick = () => {
      const category = tab.dataset.category;
      if (!openCategories.has(category)) openCategories.add(category);
      else if (openCategories.size > 1) openCategories.delete(category);
      writeStorage('dock-categories', [...openCategories]);
      showSections();
    };
  }
  const showLayer = newLayer => {
    layer = newLayer;
    byId('dock-bar').textContent = { body: 'Cells', nerve: 'Neurons', vessel: 'Vessels: drag cell to cell' }[layer];
    showSections();
  };
  layOutDock(sections);
  setUpDockToggle();
  return { cellButtons, neuronButtons, showLayer };
}

// the categories the player left open, in the dock's order; the first category when none is remembered
function readOpenCategories(bodySections) {
  const remembered = readStorage('dock-categories', []);
  const known = bodySections.map(section => section.category);
  const open = new Set(known.filter(category => Array.isArray(remembered) && remembered.includes(category)));
  if (open.size === 0) open.add(known[0]);
  return open;
}

// adds a button to a dock section
function addToSection(section, button) {
  section.hexes.appendChild(button);
  section.buttons.push(button);
}

// one section of hexagons for a category, shown in one layer
function makeDockSection(category, layer) {
  const element = document.createElement('div');
  const hexes = document.createElement('div');
  element.className = 'dock-section';
  hexes.className = 'palette-hexes';
  element.appendChild(hexes);
  byId('palette').appendChild(element);
  return { category, layer, element, hexes, buttons: [] };
}

// a tab per cell category, in the dock's head
function makeDockTabs(bodySections) {
  return bodySections.map(section => {
    const tab = document.createElement('button');
    tab.className = 'dock-tab';
    tab.dataset.category = section.category;
    tab.textContent = section.category;
    byId('dock-tabs').appendChild(tab);
    return tab;
  });
}

// an empty hexagon button with a canvas drawn at twice the size, for sharp edges
function makeHexButton() {
  const button = document.createElement('button');
  button.className = 'palette-cell';
  button.style.width = DOCK_HEX_WIDTH + 'px';
  button.style.height = DOCK_HEX_HEIGHT + 'px';
  button.innerHTML = `<canvas width="${(DOCK_HEX_WIDTH - 4) * 2}" height="${(DOCK_HEX_HEIGHT - 4) * 2}"></canvas>`;
  const canvas = button.querySelector && button.querySelector('canvas');
  const context = canvas ? canvas.getContext('2d') : null;
  if (context) context.scale(2, 2);
  return { button, context, width: DOCK_HEX_WIDTH - 4, height: DOCK_HEX_HEIGHT - 4 };
}

// the zoom at which a cell or neuron icon fills a square of size px, as the dock's icons fill their hexagons
function iconZoom(size) {
  return DOCK_ICON_ZOOM * size / (DOCK_HEX_WIDTH - 4);
}

// a cell type alone, centred on the context's origin, zoom times its size in the creature (the dock, the guide)
function drawCellIcon(context, typeName, zoom) {
  context.save();
  context.scale(zoom, zoom);
  drawCell(context, makeDisplayCell(typeName, 0, 0, { centerX: 0, centerY: 10, heading: 0 }), 0);
  context.restore();
}

// a neuron's badge on a plain cell, centred on the context's origin, as big as a cell icon at the same zoom
function drawNeuronIcon(context, kind, zoom) {
  const cell = { ...makeDisplayCell('tissue', 0, 0), neuron: { kind } };
  context.save();
  context.scale(zoom, zoom);
  drawNeuronBadge(context, cell, DOCK_NEURON_CELL_RADIUS);
  context.restore();
}

// a cell type's button: the cell alone, in the middle of the hexagon
function makeDockButton(typeName) {
  const { button, context, width, height } = makeHexButton();
  button.dataset.type = typeName;
  if (!context) return button;
  context.save();
  context.translate(width / 2, height / 2);
  drawCellIcon(context, typeName, DOCK_ICON_ZOOM);
  context.restore();
  return button;
}

// a neuron button: the neuron's badge on a plain cell
function makeNeuronButton(kind) {
  const { button, context, width, height } = makeHexButton();
  button.dataset.neuron = kind;
  if (!context) return button;
  context.save();
  context.translate(width / 2, height / 2);
  drawNeuronIcon(context, kind, DOCK_ICON_ZOOM);
  context.restore();
  return button;
}

// Honeycomb in two rows: the second row is shifted half a hexagon so the rows interlock. The palette is at least two
// rows tall, so opening and closing tabs doesn't make the dock jump.
function layOutDock(sections) {
  const columnStep = DOCK_HEX_WIDTH + DOCK_HEX_GAP;
  const rowStep = DOCK_HEX_HEIGHT * 0.75 + DOCK_HEX_GAP;
  for (const section of sections) {
    const columns = Math.ceil(section.buttons.length / DOCK_ROWS);
    const usedRows = Math.ceil(section.buttons.length / columns);
    section.buttons.forEach((button, i) => {
      const row = Math.floor(i / columns);
      const column = i % columns;
      button.style.left = column * columnStep + (row % 2 ? columnStep / 2 : 0) + 'px';
      button.style.top = row * rowStep + 'px';
    });
    const width = columns * columnStep - DOCK_HEX_GAP + (usedRows > 1 ? columnStep / 2 : 0);
    section.hexes.style.width = width + 'px';
    section.hexes.style.height = DOCK_HEX_HEIGHT + (usedRows - 1) * rowStep + 'px';
  }
  byId('palette').style.minHeight = DOCK_HEX_HEIGHT + (DOCK_ROWS - 1) * rowStep + 'px';
}

// the dock's title folds it away; remembered per browser
function setUpDockToggle() {
  const dock = byId('dock');
  dock.classList.toggle('collapsed', readStorage('dock-collapsed', false));
  byId('dock-bar').onclick = () => {
    dock.classList.toggle('collapsed');
    writeStorage('dock-collapsed', dock.classList.contains('collapsed'));
  };
}
