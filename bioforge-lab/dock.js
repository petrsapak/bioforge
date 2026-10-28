'use strict';
// The cell dock at the bottom of the builder: one collapsible section per cell category, each cell type a hexagon
// button showing the cell, its name and its cost (browser only).

const DOCK_HEX_WIDTH = 54;                                // px
const DOCK_HEX_HEIGHT = Math.round(DOCK_HEX_WIDTH * 2 / Math.sqrt(3));
const DOCK_HEX_GAP = 3;                                   // px
const DOCK_MAX_ROWS = 6;
const DOCK_SIDE_MARGIN = 50;                              // px of the window width the dock leaves free
const DOCK_SECTION_GAP = 18;                              // px between sections
const DOCK_CLOSED_SECTION_WIDTH = 70;                     // px

// Builds the dock; clicking a cell type calls onPick(typeName). Returns the dock's buttons by type name.
function buildCellDock(onPick) {
  const sections = [];
  const buttons = new Map();
  for (const [typeName, cellType] of Object.entries(CELLS)) {
    if (cellType.isNucleus) continue;                     // every creature has exactly one, placed for you
    let section = sections[sections.length - 1];
    if (!section || section.category !== cellType.category) {
      section = makeDockSection(cellType.category, () => layOutDock(sections));
      sections.push(section);
    }
    const button = makeDockButton(typeName, cellType);
    button.onclick = () => onPick(typeName);
    section.hexes.appendChild(button);
    section.buttons.push(button);
    buttons.set(typeName, button);
  }
  layOutDock(sections);
  addEventListener('resize', () => layOutDock(sections));
  setUpDockToggle();
  return buttons;
}

// a collapsible section for one category
function makeDockSection(category, onToggle) {
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
  return { category, branch, hexes, buttons: [] };
}

// a hexagon button with the cell drawn at twice the size, for sharp text
function makeDockButton(typeName, cellType) {
  const button = document.createElement('button');
  const canvasWidth = DOCK_HEX_WIDTH - 4;
  const canvasHeight = DOCK_HEX_HEIGHT - 4;
  button.className = 'palette-cell';
  button.dataset.type = typeName;
  button.style.width = DOCK_HEX_WIDTH + 'px';
  button.style.height = DOCK_HEX_HEIGHT + 'px';
  button.innerHTML = `<canvas width="${canvasWidth * 2}" height="${canvasHeight * 2}"></canvas>`;
  const canvas = button.querySelector && button.querySelector('canvas');
  if (canvas) drawDockButton(canvas.getContext('2d'), typeName, cellType, canvasWidth, canvasHeight);
  return button;
}

function drawDockButton(context, typeName, cellType, width, height) {
  context.scale(2, 2);
  context.save();
  context.translate(width / 2, height * 0.4);
  context.scale(1.2, 1.2);
  drawCell(context, makeDisplayCell(typeName, 0, 0, { centerX: 0, centerY: 10, heading: 0 }), 0);
  context.restore();
  context.globalAlpha = 1;
  context.textAlign = 'center';
  context.fillStyle = '#dfe4ea';
  context.font = '8px system-ui';
  context.fillText(cellType.name, width / 2, height * 0.78);
  context.fillStyle = '#e8c547';
  context.font = 'bold 8px system-ui';
  context.fillText(cellType.cost, width / 2, 9);
}

// Honeycomb: every section uses the same number of rows, the fewest that fit the window width, and odd rows are
// shifted half a hexagon so the rows interlock. Sections wrap if even the most rows are too wide.
function layOutDock(sections) {
  const columnStep = DOCK_HEX_WIDTH + DOCK_HEX_GAP;
  const rowStep = DOCK_HEX_HEIGHT * 0.75 + DOCK_HEX_GAP;
  const sizeWith = (section, rows) => {
    const columns = Math.ceil(section.buttons.length / rows);
    const usedRows = Math.ceil(section.buttons.length / columns);
    const width = columns * columnStep - DOCK_HEX_GAP + (usedRows > 1 ? columnStep / 2 : 0);
    return { columns, usedRows, width };
  };
  const totalWidth = rows => sections.reduce((sum, section) =>
    sum + (section.branch.open ? sizeWith(section, rows).width : DOCK_CLOSED_SECTION_WIDTH) + DOCK_SECTION_GAP, 0);
  let rows = 1;
  while (rows < DOCK_MAX_ROWS && totalWidth(rows) > innerWidth - DOCK_SIDE_MARGIN) rows++;
  for (const section of sections) {
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
