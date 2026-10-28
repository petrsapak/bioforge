'use strict';
// The builder's side panel: meters for biomass, cells and the nerve limits, a card with a picture of the clicked or
// chosen cell or neuron (and the neuron scope, scope.js), the creature's figures as icon chips and the design
// warnings; plus which toolbar, dock and library buttons show as selected (browser only).

const CARD_PICTURE_SCALE = 3.2;                           // canvas px per grid px in the card's picture
const RESET_AIM_BUTTON = '<button class="small" id="reset-bud-aim">Reset aim</button>';

// redraws every part of the panel from the app state
function refreshPanel(app) {
  showSelectedButtons(app);
  showMeters(app);
  showCard(app);
  wirePanelButtons(app);
  showStats(app);
  refreshCoach(app);
}

// the buttons inside the card are made anew with its HTML, so their handlers are set after every redraw
function wirePanelButtons(app) {
  const onClick = (id, action) => {
    const button = byId(id);
    if (!button) return;
    button.onclick = () => {
      action();
      rebuildTank(app);
    };
  };
  onClick('reset-bud-aim', () => resetBudAim(app.edited, app.focusKey));
  onClick('neuron-setting-down', () => changeNeuronSetting(app.edited, app.focusKey, -1));
  onClick('neuron-setting-up', () => changeNeuronSetting(app.edited, app.focusKey, 1));
  app.cardFibres.forEach((fibre, i) => onClick('remove-fibre-' + i, () => removeFibre(app.edited, fibre)));
  const info = byId('info');
  info.onmouseover = event => {
    const row = event.target.closest && event.target.closest('.fibre-row');
    app.hoveredFibre = row ? app.cardFibres[+row.dataset.fibre] : null;
  };
  info.onmouseleave = () => {
    app.hoveredFibre = null;
  };
}

function showSelectedButtons(app) {
  for (const [typeName, button] of app.dockButtons) button.classList.toggle('selected', typeName === app.selectedType);
  for (const [kind, button] of app.neuronButtons) button.classList.toggle('selected', kind === app.selectedNeuron);
  byId('layer-body').classList.toggle('selected', app.layer === 'body');
  byId('layer-nerve').classList.toggle('selected', app.layer === 'nerve');
  app.fluidViewButtons.forEach((button, view) => button.classList.toggle('selected', view === app.fluidView));
  for (const { entry, row } of app.libraryRows) {
    row.classList.toggle('selected', !!app.stamp && app.stamp.template === entry);
  }
  byId('unlimited-biomass').classList.toggle('selected', app.edited.biomassLimit === Infinity);
}

// ---------- Meters ----------
// Four bars: biomass and cells (the Body view's), neurons and fibre units (the Nerve view's, which stand out there).
// The full wording is each bar's tooltip.
function showMeters(app) {
  const problem = buildCheck(bodyDesign(app.edited));
  const nerve = nerveUsage(app.edited);
  const isUnlimited = app.edited.biomassLimit === Infinity;
  const used = bodyCost(app.edited);
  const cellCount = bodyCells(app.edited).length;
  const isNerveView = app.layer === 'nerve';
  byId('budget').innerHTML = '<div class="meters">' +
    meterHtml('biomass', `Biomass used: ${formatBiomass(used)} of ${RULES.budget}` +
      (isUnlimited ? ' (unlimited: the Sandbox takes any size)' : ''), used, RULES.budget, isNerveView,
      isUnlimited ? '∞' : `${formatBiomass(RULES.budget - used)} left`) +
    meterHtml('cells', `Cells: ${cellCount} of ${RULES.maxCells}`, cellCount, RULES.maxCells, isNerveView) +
    meterHtml('neurons', `Neurons: ${nerve.neurons} of ${RULES.maxNeurons}`, nerve.neurons, RULES.maxNeurons,
      !isNerveView) +
    meterHtml('fibre', `Fibre: ${nerve.units} of ${RULES.maxFibreUnits} units`, nerve.units, RULES.maxFibreUnits,
      !isNerveView) +
    '</div>' + (problem ? `<div class="warn">⚠ ${problem}</div>` : '');
}

// one bar with its icon and number; a full or overfull bar turns orange, and a dimmed one belongs to the other view
function meterHtml(icon, title, value, limit, isDimmed, text = `${value}/${limit}`) {
  const share = Math.min(1, value / limit);
  const classes = ['meter', isDimmed ? 'dim' : '', value > limit ? 'over' : ''].join(' ');
  return `<div class="${classes}" title="${title}"><i class="icon-${icon}"></i>` +
    `<div class="meter-track"><div class="meter-fill" style="width:${(share * 100).toFixed(1)}%"></div></div>` +
    `<span>${text}</span></div>`;
}

// ---------- The card ----------
// What the card shows: the stamp in hand, else the clicked cell, else the neuron (Nerve view) or cell type (Body
// view) a click would place. The picture is drawn on its canvas, the text goes beside it.
function showCard(app) {
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  app.cardFibres = [];
  app.hoveredFibre = null;
  if (app.stamp) {
    drawCardPicture(app.stamp.template.cells);
    byId('info').innerHTML = describeStamp(app.stamp);
    showScopeNeuron(app.scope, null);
  } else if (focused) {
    drawCardPicture([focused]);
    byId('info').innerHTML = describeFocusedCell(app, focused);
    showScopeNeuron(app.scope, focused.neuron || null);
  } else if (app.layer === 'nerve') {
    drawCardPicture([{ q: 0, r: 0, typeName: 'tissue', neuron: { kind: app.selectedNeuron } }], true);
    byId('info').innerHTML = describeNeuronType(NEURONS[app.selectedNeuron]);
    showScopeNeuron(app.scope, createNeuron(app.selectedNeuron));
  } else {
    drawCardPicture([{ q: 0, r: 0, typeName: app.selectedType }]);
    byId('info').innerHTML = describeCellType(CELLS[app.selectedType]);
    showScopeNeuron(app.scope, null);
  }
}

// design cells drawn into the card's picture, fitted to it; isShaded fades the cells as the Nerve view does
function drawCardPicture(cells, isShaded = false) {
  const canvas = byId('card-picture');
  const context = canvas.getContext('2d');
  const points = cells.map(cell => hexToPixel(cell.q, cell.r));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const middleX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const middleY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 2 * CELL_RADIUS;
  const scale = Math.min(CARD_PICTURE_SCALE, (canvas.width - 12) / span);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, canvas.width / 2 - middleX * scale, canvas.height / 2 - middleY * scale);
  cells.forEach((designCell, i) => {
    const cell = makeDisplayCell(designCell.typeName, points[i][0], points[i][1],
      { centerX: middleX, centerY: middleY + 1, heading: 0 });
    drawCell(context, cell, 0);
    if (isShaded) {
      traceHex(context, ...points[i], HEX_FILL_SIZE);
      context.fillStyle = NERVE_VIEW_SHADE;
      context.fill();
    }
    if (designCell.neuron) {
      const withNeuron = { ...cell, neuron: designCell.neuron, boundKey: designCell.boundKey };
      drawNeuronBadge(context, withNeuron, CELL_RADIUS * 0.9);
    }
  });
  context.setTransform(1, 0, 0, 1, 0, 0);
}

// the first sentence of a description, for the card; the whole text is its tooltip
function firstSentence(text) {
  const end = text.search(/\.(\s|$)/);
  return end < 0 ? text : text.slice(0, end + 1);
}

function describeStamp(stamp) {
  const template = stamp.template;
  return `<b>Placing "${escapeHtml(template.name)}"</b>` +
    `<div class="chips"><span title="Cells">⬢ ${template.cells.length}</span>` +
    `<span title="Biomass">◆ ${formatBiomass(designCost(template))}</span></div>` +
    '<div class="keys-hint"><span class="mouse left"></span> place <b>Q</b><b>E</b> turn ' +
    '<span class="mouse right"></span> stop</div>';
}

// the chosen cell type from the dock
function describeCellType(cellType) {
  return `<b>${cellType.name}</b><div class="chips">${cellTypeChips(cellType)}</div>` +
    `<div class="line" title="${escapeHtml(cellType.description)}">${firstSentence(cellType.description)}</div>`;
}

// cost, health, and whether it needs a nerve signal, as icon chips
function cellTypeChips(cellType) {
  return `<span title="Biomass cost">◆ ${cellType.cost}</span><span title="Health">❤ ${cellType.health}</span>` +
    (cellType.needsSignal ? '<span class="needs-signal" title="Needs a nerve signal to act">↯ nerve</span>' : '');
}

function describeNeuronType(neuronType) {
  return `<b>${neuronType.name}</b> <span class="dim">neuron</span>` +
    `<div class="line" title="${escapeHtml(neuronType.description)}">${firstSentence(neuronType.description)}</div>`;
}

// The clicked cell: Buds show and take their part; its neuron shows its setting, and a Command its key; its fibres.
function describeFocusedCell(app, cell) {
  const cellType = CELLS[cell.typeName];
  const heading = `<b>${cellType.name}</b> <span class="dim">clicked · Esc</span>` +
    `<div class="chips">${cellTypeChips(cellType)}</div>`;
  const fibres = describeCellFibres(app, app.focusKey);
  if (cellType.growsParts) return heading + describeBud(cell, cellType) + fibres;
  if (!cell.neuron) {
    const offer = app.layer === 'nerve' ? ` Click it again: ${NEURONS[app.selectedNeuron].name} in.` : '';
    return heading + `<div class="line dim">No neuron.${offer}</div>` + fibres;
  }
  return heading + describeNeuron(cell) + fibres;
}

// The cell's fibres, one row each: the cell at the other end, and a × that removes the fibre. Hovering a row shows
// the fibre in red on the grid.
function describeCellFibres(app, key) {
  app.cardFibres = app.edited.fibres.filter(fibre => fibreStartKey(fibre) === key || fibreEndKey(fibre) === key);
  return app.cardFibres.map((fibre, i) => {
    const isOutgoing = fibreStartKey(fibre) === key;
    const other = app.edited.cells.get(isOutgoing ? fibreEndKey(fibre) : fibreStartKey(fibre));
    const title = isOutgoing ? 'Carries this cell\'s signal to' : 'Brings the signal of';
    return `<div class="fibre-row" data-fibre="${i}" title="${title} this ${CELLS[other.typeName].name}">` +
      `<span>${isOutgoing ? 'out →' : 'in ←'} ${cellLabel(other)}</span>` +
      `<button class="small" id="remove-fibre-${i}" title="Remove this fibre">×</button></div>`;
  }).join('');
}

// a cell's name for the card, with its neuron's if it has one
function cellLabel(cell) {
  const typeName = CELLS[cell.typeName].name;
  return cell.neuron ? `${NEURONS[cell.neuron.kind].name} <span class="dim">${typeName}</span>` : typeName;
}

// the cell's neuron: what it does, its setting with − and + buttons, and a Command's key
function describeNeuron(cell) {
  const neuronType = NEURONS[cell.neuron.kind];
  let text = `<div class="line" title="${escapeHtml(neuronType.description)}"><b>${neuronType.name}</b> neuron: ` +
    `${firstSentence(neuronType.description)}</div>`;
  const setting = neuronType.setting;
  if (setting) {
    text += '<div class="stepper"><button class="small" id="neuron-setting-down">−</button>' +
      `<span>${setting.name} <b>${cell.neuron.setting}</b> ${setting.unit}</span>` +
      '<button class="small" id="neuron-setting-up">+</button></div>';
  }
  if (cell.neuron.kind === 'command') {
    const key = cell.boundKey ? 'key ' + cell.boundKey : 'Space';
    text += `<div class="keys-hint">Fires on <b>${key}</b> · press <b>1</b>–<b>9</b> to bind</div>`;
  }
  return text;
}

function describeBud(bud, cellType) {
  const part = bud.budPart;
  if (!part) return '<div class="line">Grows nothing yet: drag a part from the library onto it.</div>';
  const growSeconds = designCost(part) * BUD_FUEL_PER_BIOMASS / (cellType.fuelBurn * FUEL_BURN_SCALE);
  const aimText = bud.partAim !== undefined
    ? `aimed at ${Math.round(((bud.partAim * 180 / Math.PI) % 360 + 360) % 360)}°`
    : "fires the way the part's front points";
  return `<div class="line">Grows <b>${escapeHtml(part.name)}</b> in about ${Math.round(growSeconds)} s, ` +
    `${aimText}.</div>` +
    '<div class="keys-hint">drag dots: move · <b>Q</b><b>E</b> turn · drag arrow: aim</div>' +
    (bud.partAim !== undefined ? RESET_AIM_BUTTON : '');
}

// ---------- Figures and warnings ----------
// size, health and fuel figures of the joined body as icon chips, then the design warnings (hovering one outlines
// its cells)
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
  app.warnings = designWarnings(bodyDesign(app.edited), plannedKeys(app.edited));
  const stats = byId('stats');
  stats.innerHTML = '<div class="chips">' +
    `<span title="Health of all cells">❤ ${health}</span>` +
    `<span title="Mass">⚖ ${mass.toFixed(1)}</span>` +
    `<span title="Most fuel burnt per second, with every cell working">🔥 ${maxBurn.toFixed(2)}/s</span>` +
    `<span title="Oxygen the Gills take in per second">O₂ +${gillOxygen.toFixed(2)}/s</span>` +
    `<span title="Energy stored at the start${hasMouth ? ', plus whatever the Mouth eats' : ' (no Mouth)'}">` +
    `⚡ ${energyStock.toFixed(1)}${hasMouth ? '+' : ''}</span></div>` +
    app.warnings.map((warning, i) => `<div class="warn" data-warning="${i}">⚠ ${warning.text}</div>`).join('');
  stats.onmouseover = event => {
    const index = event.target.dataset && event.target.dataset.warning;
    app.hoveredWarning = index === undefined ? -1 : +index;
  };
  stats.onmouseleave = () => {
    app.hoveredWarning = -1;
  };
}
