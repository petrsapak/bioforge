'use strict';
// The builder's side panel: biomass, the clicked or chosen cell, the creature's stats and the design warnings; plus
// which dock, view and library buttons show as selected (browser only).

const RESET_AIM_BUTTON = '<div class="row"><button class="small" id="reset-bud-aim">Reset aim</button></div>';

// redraws every part of the panel from the app state
function refreshPanel(app) {
  showSelectedButtons(app);
  showBudget(app);
  byId('info').innerHTML = app.stamp ? describeStamp(app.stamp)
    : app.focusKey ? describeFocusedCell(app.edited.cells.get(app.focusKey))
      : describeCellType(CELLS[app.selectedType]);
  const resetAimButton = byId('reset-bud-aim');
  if (resetAimButton) {
    resetAimButton.onclick = () => {
      resetBudAim(app.edited, app.focusKey);
      rebuildTank(app);
    };
  }
  showStats(app);
}

function showSelectedButtons(app) {
  for (const [typeName, button] of app.dockButtons) button.classList.toggle('selected', typeName === app.selectedType);
  app.fluidViewButtons.forEach((button, view) => button.classList.toggle('selected', view === app.fluidView));
  for (const { entry, row } of app.libraryRows) {
    row.classList.toggle('selected', !!app.stamp && app.stamp.template === entry);
  }
  byId('unlimited-biomass').classList.toggle('selected', app.edited.biomassLimit === Infinity);
}

function showBudget(app) {
  const problem = buildCheck(bodyDesign(app.edited));
  const left = formatBiomass(RULES.budget - bodyCost(app.edited));
  const cellCount = bodyCells(app.edited).length;
  byId('budget').innerHTML = `Biomass: <b>${left}</b> / ${RULES.budget} · Cells ${cellCount} / ${RULES.maxCells}` +
    (problem ? ` <span class="warn">${problem}</span>` : '') +
    (app.edited.biomassLimit === Infinity ? ' <span class="help">(unlimited: the Sandbox takes any size)</span>' : '');
}

function describeStamp(stamp) {
  const template = stamp.template;
  return `<b>Placing "${escapeHtml(template.name)}"</b> (${template.cells.length} cells, ` +
    `${formatBiomass(designCost(template))} biomass)<br>Click to place it; off the body it stays planned until ` +
    'joined. Hexes already taken are skipped. Q/E rotate, right-click or Esc to stop.';
}

// the chosen cell type from the dock
function describeCellType(cellType) {
  const facts = [`${cellType.health} HP`];
  if (cellType.conductsSignal) facts.push('carries nerve signals');
  if (cellType.fuelBurn) facts.push(`burns ${+(cellType.fuelBurn * FUEL_BURN_SCALE).toFixed(3)}/s`);
  return `<b>${cellType.name}</b> (${facts.join(', ')})<br>${cellType.description}`;
}

// The clicked cell: Buds show and take their part, Commands show and take their key.
function describeFocusedCell(cell) {
  const cellType = CELLS[cell.typeName];
  const heading = `<b>${cellType.name}</b> (clicked cell; Esc to let go)<br>`;
  if (cellType.growsParts) return heading + describeBud(cell, cellType);
  if (cellType.signalSource === 'key') {
    const key = cell.boundKey ? 'key ' + cell.boundKey : 'Space';
    return heading + `Fires on <b>${key}</b>. Press 1–9 to bind it to a number key, the same key again to go back ` +
      'to Space. The AI still fires it when close.';
  }
  return heading + cellType.description;
}

function describeBud(bud, cellType) {
  const part = bud.budPart;
  const howToAssign = 'Drag a part from the Templates library onto a Bud (or click it while this Bud is clicked) ' +
    'to make it grow that. Fire it with a nerve signal once the ring is full.';
  if (!part) return 'Grows nothing yet. ' + howToAssign;
  const growSeconds = designCost(part) * BUD_FUEL_PER_BIOMASS / (cellType.fuelBurn * FUEL_BURN_SCALE);
  const aimText = bud.partAim !== undefined
    ? `Fires at ${Math.round(((bud.partAim * 180 / Math.PI) % 360 + 360) % 360)}° (0° = straight ahead, clockwise).`
    : "Fires the way the part's front (top in the library picture) points.";
  return `Grows <b>${escapeHtml(part.name)}</b> (${part.cells.length} cells, about ${Math.round(growSeconds)} s when ` +
    'well fed). Drag its dots to move it, Q/E turn it around the Bud, drag the arrow tip to aim. ' + howToAssign +
    `<br><span class="help">${aimText}</span>` + (bud.partAim !== undefined ? RESET_AIM_BUTTON : '');
}

// size, health and fuel figures of the joined body, then the design warnings (hovering one outlines its cells)
function showStats(app) {
  const cells = bodyCells(app.edited);
  const types = cells.map(cell => CELLS[cell.typeName]);
  const sumOf = valueOf => types.reduce((sum, cellType) => sum + valueOf(cellType), 0);
  const energyFluid = FLUIDS[FLUID_ENERGY];
  const health = sumOf(cellType => cellType.health);
  const mass = sumOf(cellType => cellType.mass);
  const maxBurn = sumOf(cellType => cellType.fuelBurn * FUEL_BURN_SCALE);
  const gillOxygen = types.filter(cellType => cellType.breathes).length * GILL_OXYGEN_RATE;
  const energyStock = sumOf(cellType => fluidCapacityOf(cellType, energyFluid) * energyFluid.startFill);
  const hasMouth = types.some(cellType => cellType.eatsFood);
  app.warnings = designWarnings(cells, plannedKeys(app.edited));
  const stats = byId('stats');
  stats.innerHTML = `Cells: ${cells.length}   Mass: ${mass.toFixed(1)}   HP: ${health}` +
    `\nMax burn: ${maxBurn.toFixed(2)}/s   Gills: +${gillOxygen.toFixed(2)} O₂/s` +
    `\nEnergy stock: ${energyStock.toFixed(1)}${hasMouth ? ' + whatever the Mouth eats' : ' (no Mouth)'}` +
    app.warnings.map((warning, i) => `\n<span class="warn" data-warning="${i}">⚠ ${warning.text}</span>`).join('');
  stats.onmouseover = event => {
    const index = event.target.dataset && event.target.dataset.warning;
    app.hoveredWarning = index === undefined ? -1 : +index;
  };
  stats.onmouseleave = () => {
    app.hoveredWarning = -1;
  };
}
