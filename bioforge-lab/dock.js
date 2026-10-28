'use strict';
// The dock at the bottom of the builder: in the Body view one collapsible section per cell category, each cell type a
// hexagon button showing the cell, its name and its cost; in the Nerve view the neurons (browser only).

const DOCK_HEX_WIDTH = 54;                                // px
const DOCK_HEX_HEIGHT = Math.round(DOCK_HEX_WIDTH * 2 / Math.sqrt(3));
const DOCK_HEX_GAP = 3;                                   // px
const DOCK_MAX_ROWS = 6;
const DOCK_SIDE_MARGIN = 50;                              // px of the window width the dock leaves free
const DOCK_SECTION_GAP = 18;                              // px between sections
const DOCK_CLOSED_SECTION_WIDTH = 70;                     // px

// Builds the dock. Clicking a cell type calls onPickCell(typeName), a neuron onPickNeuron(kind). Returns the buttons
// by type name and by neuron kind, and showLayer(layer), which shows the sections of 'body' or 'nerve'.
function buildDock(onPickCell, onPickNeuron) {
  const sections = [];
  const cellButtons = new Map();
  const neuronButtons = new Map();
  const relayOut = () => layOutDock(sections);
  for (const [typeName, cellType] of Object.entries(CELLS)) {
    if (cellType.isNucleus) continue;                     // every creature has exactly one, placed for you
    let section = sections[sections.length - 1];
    if (!section || section.category !== cellType.category) {
      section = makeDockSection(cellType.category, 'body', relayOut);
      sections.push(section);
    }
    const button = makeDockButton(typeName, cellType);
    button.onclick = () => onPickCell(typeName);
    addToSection(section, button);
    cellButtons.set(typeName, button);
  }
  const neuronSection = makeDockSection('Neurons', 'nerve', relayOut);
  sections.push(neuronSection);
  for (const [kind, neuronType] of Object.entries(NEURONS)) {
    const button = makeNeuronButton(kind, neuronType);
    button.onclick = () => onPickNeuron(kind);
    addToSection(neuronSection, button);
    neuronButtons.set(kind, button);
  }
  const showLayer = layer => {
    for (const section of sections) section.branch.style.display = section.layer === layer ? '' : 'none';
    byId('dock-bar').textContent = { body: 'Cells', nerve: 'Neurons', vessel: 'Vessels: drag cell to cell' }[layer];
    relayOut();
  };
  addEventListener('resize', relayOut);
  setUpDockToggle();
  return { cellButtons, neuronButtons, showLayer };
}

function addToSection(section, button) {
  section.hexes.appendChild(button);
  section.buttons.push(button);
}

// a collapsible section for one category, shown in one layer
function makeDockSection(category, layer, onToggle) {
  const branch = document.createElement('details');
  const summary = document.createElement('summary');
  const hexes = document.createElement('div');
  branch.open = true;
  branch.dataset.node = 'category:' + category;
  summary.textContent = category;
  hexes.className = 'palette-hexes';
  branch.appendChild(summary);
  branch.appendChild(hexes);
  byId('palette').appendChild(branch);
  branch.addEventListener('toggle', onToggle);
  return { category, layer, branch, hexes, buttons: [] };
}

// an empty hexagon button with a canvas drawn at twice the size, for sharp text
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

function makeDockButton(typeName, cellType) {
  const { button, context, width, height } = makeHexButton();
  button.dataset.type = typeName;
  if (!context) return button;
  context.save();
  context.translate(width / 2, height * 0.4);
  context.scale(1.2, 1.2);
  drawCell(context, makeDisplayCell(typeName, 0, 0, { centerX: 0, centerY: 10, heading: 0 }), 0);
  context.restore();
  drawDockLabel(context, cellType.name, String(cellType.cost), width, height);
  return button;
}

// a neuron button: the neuron's badge on a plain cell; its description is the button's tooltip
function makeNeuronButton(kind, neuronType) {
  const { button, context, width, height } = makeHexButton();
  button.dataset.neuron = kind;
  button.title = neuronType.description;
  if (!context) return button;
  const cell = { ...makeDisplayCell('tissue', 0, 0), neuron: { kind } };
  context.save();
  context.translate(width / 2, height * 0.4);
  context.scale(1.4, 1.4);
  drawNeuronBadge(context, cell, CELL_RADIUS * 0.9);
  context.restore();
  drawDockLabel(context, neuronType.name, '', width, height);
  return button;
}

function drawDockLabel(context, name, cost, width, height) {
  context.globalAlpha = 1;
  context.textAlign = 'center';
  context.fillStyle = '#dfe4ea';
  context.font = '8px system-ui';
  context.fillText(name, width / 2, height * 0.78);
  context.fillStyle = '#e8c547';
  context.font = 'bold 8px system-ui';
  context.fillText(cost, width / 2, 9);
}

// Honeycomb: every shown section uses the same number of rows, the fewest that fit the window width, and odd rows are
// shifted half a hexagon so the rows interlock. Sections wrap if even the most rows are too wide.
function layOutDock(sections) {
  const shown = sections.filter(section => section.branch.style.display !== 'none');
  const columnStep = DOCK_HEX_WIDTH + DOCK_HEX_GAP;
  const rowStep = DOCK_HEX_HEIGHT * 0.75 + DOCK_HEX_GAP;
  const sizeWith = (section, rows) => {
    const columns = Math.ceil(section.buttons.length / rows);
    const usedRows = Math.ceil(section.buttons.length / columns);
    const width = columns * columnStep - DOCK_HEX_GAP + (usedRows > 1 ? columnStep / 2 : 0);
    return { columns, usedRows, width };
  };
  const totalWidth = rows => shown.reduce((sum, section) =>
    sum + (section.branch.open ? sizeWith(section, rows).width : DOCK_CLOSED_SECTION_WIDTH) + DOCK_SECTION_GAP, 0);
  let rows = 1;
  while (rows < DOCK_MAX_ROWS && totalWidth(rows) > innerWidth - DOCK_SIDE_MARGIN) rows++;
  for (const section of shown) {
    const { columns, usedRows, width } = sizeWith(section, rows);
    section.buttons.forEach((button, i) => {
      const row = Math.floor(i / columns);
      const column = i % columns;
      button.style.left = column * columnStep + (row % 2 ? columnStep / 2 : 0) + 'px';
      button.style.top = row * rowStep + 'px';
    });
    section.hexes.style.width = width + 'px';
    section.hexes.style.height = DOCK_HEX_HEIGHT + (usedRows - 1) * rowStep + 'px';
  }
}

// the dock's title bar folds it away; remembered per browser
function setUpDockToggle() {
  const dock = byId('dock');
  dock.classList.toggle('collapsed', readStorage('dock-collapsed', false));
  byId('dock-bar').onclick = () => {
    dock.classList.toggle('collapsed');
    writeStorage('dock-collapsed', dock.classList.contains('collapsed'));
  };
}
