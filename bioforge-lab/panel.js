'use strict';
// The builder's panels: the limits line under the tabs, a message line, the card of the clicked cell when it has
// something to set up (a neuron, a Bud, its fibres) or of the part being stamped, and the Needs card (how long the
// sugar lasts, a row per need and the next thing to fix); plus which toolbar, dock and library buttons show as
// selected (browser only).

const RESET_AIM_BUTTON = '<button class="small" id="reset-bud-aim">Reset aim</button>';

// redraws every part of the panel from the app state
function refreshPanel(app) {
  showSelectedButtons(app);
  showLimits(app);
  showMessage('');
  showCard(app);
  wirePanelButtons(app);
  showNeeds(app);
  refreshCoach(app);
}

// a line saying why an edit couldn't be made, or what was saved; '' hides it (every redraw of the panel does)
function showMessage(text) {
  byId('message').textContent = text;
  byId('message').style.display = text ? '' : 'none';
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
  // each change is copied onto the mirrored cells too, across the axes on when the button is clicked
  onClick('neuron-setting-down', () => changeNeuronSettingMirrored(app.edited, app.focusKey, -1, app.mirrorAxes));
  onClick('neuron-setting-up', () => changeNeuronSettingMirrored(app.edited, app.focusKey, 1, app.mirrorAxes));
  for (const hormone of HORMONES) {
    onClick('sense-' + hormone.id,
      () => setSensedHormoneMirrored(app.edited, app.focusKey, hormone.id, app.mirrorAxes));
  }
  app.cardFibres.forEach((fibre, i) => {
    onClick('remove-fibre-' + i, () => removeFibreMirrored(app.edited, fibre, app.mirrorAxes));
  });
  const guideButton = byId('card-guide');
  if (guideButton) guideButton.onclick = () => openGuideFromBuilder(app);
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
  byId('layer-vessel').classList.toggle('selected', app.layer === 'vessel');
  for (const { entry, row } of app.libraryRows) {
    row.classList.toggle('selected', !!app.stamp && app.stamp.template === entry);
  }
  byId('unlimited-biomass').classList.toggle('selected', app.edited.biomassLimit === Infinity);
}

// ---------- The limits line ----------
// The current tab's limits in words under the tabs: biomass and cells in the Body view, neurons and fibre in the Nerve
// view, vessel units in the Vessels view. A full limit turns orange. A design that breaks any limit, in any view,
// says so below the line.
function showLimits(app) {
  const limits = chosenLimits(app);
  const problem = buildCheck(bodyDesign(app.edited), limits);
  const nerve = nerveUsage(app.edited);
  const isUnlimited = app.edited.biomassLimit === Infinity;
  const used = bodyCost(app.edited);
  const cellCount = bodyCells(app.edited).length;
  const vesselCount = vesselUsage(app.edited);
  const biomassText = isUnlimited ? `${formatBiomass(used)} <span class="dim">unlimited</span>`
    : `${formatBiomass(used)} / ${limits.budget}`;
  const biomassTitle = `Biomass used: ${formatBiomass(used)} of ${limits.budget}` +
    (isUnlimited ? ' (unlimited: the Sandbox takes any size)' : '');
  const materialsHtml = usesKit(app.edited) ? kitLimitsHtml(app, bodyDesign(app.edited))
    : limitHtml('body', app.layer, 'Biomass', biomassTitle, biomassText, !isUnlimited && used >= limits.budget);
  byId('budget').innerHTML = '<div class="limits">' + materialsHtml +
    limitHtml('body', app.layer, 'Cells', `Cells: ${cellCount} of ${limits.maxCells}`,
      `${cellCount} / ${limits.maxCells}`, cellCount >= limits.maxCells) +
    limitHtml('nerve', app.layer, 'Neurons', `Neurons: ${nerve.neurons} of ${limits.maxNeurons}`,
      `${nerve.neurons} / ${limits.maxNeurons}`, nerve.neurons >= limits.maxNeurons) +
    limitHtml('nerve', app.layer, 'Fibre', `Fibre: ${nerve.units} of ${limits.maxFibreUnits} units`,
      `${nerve.units} / ${limits.maxFibreUnits}`, nerve.units >= limits.maxFibreUnits) +
    limitHtml('vessel', app.layer, 'Vessels', `Vessels: ${vesselCount} of ${limits.maxVesselUnits} units`,
      `${vesselCount} / ${limits.maxVesselUnits}`, vesselCount >= limits.maxVesselUnits) +
    '</div>' + (problem ? `<div class="limits-problem">⚠ ${problem}</div>` : '');
}

// A level's kit in the Body view: each material cells are built from, used against the kit, then the reserves the
// rest becomes. Reserves turn orange when the body has no room for all of them.
function kitLimitsHtml(app, body) {
  const kit = app.edited.kit;
  const used = designMaterials(body);
  const buildingMaterials = MATERIALS.filter(material =>
    Object.values(CELLS).some(cellType => cellType.recipe[material.id]));
  const materialSpans = buildingMaterials.map(material => {
    const name = material.name;
    const has = kit[material.id] || 0;
    return limitHtml('body', app.layer, name, `${name} used: ${formatBiomass(used[material.id])} of the kit's ${has}`,
      `${formatBiomass(used[material.id])} / ${has}`, used[material.id] >= has);
  });
  const reserves = kitReserves(body, kit);
  const room = reserveRoom(body.cells.map(cell => CELLS[cell.typeName]));
  const lost = Math.max(0, reserves.sugar - room.sugar) + Math.max(0, reserves.fat - room.fat) +
    Math.max(0, reserves.mineral - room.mineral);
  const hasMineral = reserves.mineral > 0 || room.mineral > 0;
  const mineralTitle = hasMineral ? `, ${formatBiomass(reserves.mineral)} mineral in Mineralizers ` +
    `(room for ${formatBiomass(room.mineral)})` : '';
  const reservesTitle = `Left over for the run: ${formatBiomass(reserves.sugar)} sugar spread over the body ` +
    `(room for ${formatBiomass(room.sugar)}), ${formatBiomass(reserves.fat)} fat in Fat cells ` +
    `(room for ${formatBiomass(room.fat)})` + mineralTitle +
    (lost ? `. ${formatBiomass(lost)} has no room and is lost.` : '');
  const reservesText = `${formatBiomass(reserves.sugar)} sugar · ${formatBiomass(reserves.fat)} fat` +
    (hasMineral ? ` · ${formatBiomass(reserves.mineral)} mineral` : '');
  return materialSpans.join('') + limitHtml('body', app.layer, 'Reserves', reservesTitle, reservesText, lost > 0);
}

// one limit: its name and value, hidden outside its view; the full wording is its tooltip
function limitHtml(layer, shownLayer, name, title, valueHtml, isFull) {
  const hidden = layer === shownLayer ? '' : ' hidden';
  return `<span class="limit${isFull ? ' full' : ''}" title="${title}"${hidden}>${name} <b>${valueHtml}</b></span>`;
}

// ---------- The card ----------
// The card shows the stamp in hand, or the clicked cell when it has something to set up: a neuron, a Bud, or in the
// Nerve view any cell (its fibres, or a neuron to put in). Otherwise it hides; the hover hint tells what a cell is.
function showCard(app) {
  const focused = app.focusKey && app.edited.cells.get(app.focusKey);
  app.cardFibres = [];
  app.hoveredFibre = null;
  let html = '';
  if (app.stamp) html = describeStamp(app.stamp);
  else if (focused && hasCardSettings(app, focused)) html = describeFocusedCell(app, focused);
  byId('info').innerHTML = html;
  byId('card').style.display = html ? '' : 'none';
}

function hasCardSettings(app, cell) {
  const cellType = CELLS[cell.typeName];
  return app.layer === 'nerve' || !!cell.neuron || !!cellType.growsParts || cellType.senses === 'hormone';
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

// The clicked cell: Buds show and take their part, a Receptor its hormone; its neuron shows its setting, and a
// Command its key; its fibres.
function describeFocusedCell(app, cell) {
  const cellType = CELLS[cell.typeName];
  const heading = `<b>${cellType.name}</b> <span class="dim">clicked · Esc</span>` +
    '<button class="small card-guide" id="card-guide" title="Read about it in the field guide (G)">Guide</button>';
  const fibres = describeCellFibres(app, app.focusKey);
  if (cellType.growsParts) return heading + describeBud(cell, cellType) + fibres;
  const receptor = cellType.senses === 'hormone' ? describeReceptor(cell) : '';
  if (!cell.neuron) {
    const offer = app.layer === 'nerve' ? ` Click it again: ${NEURONS[app.selectedNeuron].name} in.` : '';
    return heading + receptor + `<div class="line dim">No neuron.${offer}</div>` + fibres;
  }
  return heading + receptor + describeNeuron(cell) + fibres;
}

// The cell's fibres, one row each: its colour on the grid, the cell at the other end, and a × that removes the
// fibre. Hovering a row highlights the whole fibre on the grid.
function describeCellFibres(app, key) {
  app.cardFibres = app.edited.fibres.filter(fibre => fibreStartKey(fibre) === key || fibreEndKey(fibre) === key);
  const colors = new Map(laidOutBodyFibres(app.edited, FIBRE_COLORS.length)
    .map(({ fibre, colorIndex }) => [fibre, FIBRE_COLORS[colorIndex]]));
  return app.cardFibres.map((fibre, i) => {
    const isOutgoing = fibreStartKey(fibre) === key;
    const other = app.edited.cells.get(isOutgoing ? fibreEndKey(fibre) : fibreStartKey(fibre));
    const title = isOutgoing ? 'Carries this cell\'s signal to' : 'Brings the signal of';
    return `<div class="fibre-row" data-fibre="${i}" title="${title} this ${CELLS[other.typeName].name}">` +
      `<i class="fibre-swatch" style="background:${colors.get(fibre) || FIBRE_COLOR}"></i>` +
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
    const key = cell.boundKey ? 'key ' + cell.boundKey.toUpperCase() : 'Space';
    text += `<div class="keys-hint">Fires on <b>${key}</b> · press a letter or number to bind</div>`;
  }
  return text;
}

// the Receptor's hormone, as a row of buttons in the hormones' colours with the chosen one selected
function describeReceptor(cell) {
  const sensed = cell.sensedHormone || DEFAULT_SENSED_HORMONE;
  const buttons = HORMONES.map(hormone => {
    const selected = hormone.id === sensed ? ' selected' : '';
    return `<button class="small${selected}" id="sense-${hormone.id}" style="border-color:${hormone.color}">` +
      `${hormone.name}</button>`;
  }).join('');
  return `<div class="line">Senses <b>${FLUIDS[fluidIndex(sensed)].name}</b>:</div>` +
    `<div class="hormone-choice">${buttons}</div>`;
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

// ---------- The Needs card ----------
// How long the sugar lasts, a row per need (✓ met, ✗ missing with its fix, ~ works poorly, – not needed yet) and the
// next thing to fix. Hovering a row marks its cells on the grid; clicking one with a view shows it (see showNeedView).
function showNeeds(app) {
  const body = bodyDesign(app.edited);
  app.warnings = designWarnings(body, plannedKeys(app.edited));
  app.needRows = designNeeds(body, app.warnings);
  const planned = app.warnings.find(warning => warning.need === 'planned');
  const next = nextNeed(app.needRows);
  const needs = byId('needs');
  needs.innerHTML = '<div class="needs-title">Creature</div>' + sugarHtml(sugarSupply(body)) +
    '<div class="need-rows">' + app.needRows.map(row => needRowHtml(row, isNeedViewShown(app, row))).join('') +
    '</div>' +
    `<div class="need-next">${next ? '<b>Next:</b> ' + next : 'Ready: try it in the Sandbox (bottom left).'}</div>` +
    (planned ? `<div class="need-planned" data-need="planned">${planned.text}</div>` : '');
  needs.onmouseover = event => {
    const row = event.target.closest && event.target.closest('[data-need]');
    app.hoveredNeed = row ? row.dataset.need : null;
  };
  needs.onmouseleave = () => {
    app.hoveredNeed = null;
  };
  needs.onclick = event => {
    const rowElement = event.target.closest && event.target.closest('[data-need]');
    const row = rowElement && app.needRows.find(needRow => needRow.need === rowElement.dataset.need);
    if (row) showNeedView(app, row);
  };
}

// the fluid view's number (1 + its index in FLUIDS) a need row shows, or 0 when it shows none
function needFluidView(row) {
  return row.fluid ? FLUIDS.findIndex(fluid => fluid.id === row.fluid) + 1 : 0;
}

// whether the fluid view a need row shows is the one on screen now; null for a row with no fluid
function isNeedViewShown(app, row) {
  if (!row.fluid) return null;
  return app.fluidView === needFluidView(row);
}

// shows a need row's fluid view, or the normal view again when it is already shown
function showNeedView(app, row) {
  if (!row.fluid) return;
  showFluidView(app, isNeedViewShown(app, row) ? 0 : needFluidView(row));
}

// how long the stored sugar lasts with every cell working, in big type
function sugarHtml(supply) {
  if (supply.burn <= 0) return '<div class="need-lasts">Burns no sugar</div>';
  const seconds = Math.round(supply.stock / supply.burn);
  return `<div class="need-lasts" title="Sugar stored at the start: ${supply.stock.toFixed(1)}; burnt per second ` +
    `with every cell working: ${supply.burn.toFixed(2)}">Sugar lasts <b>${seconds} s</b></div>` +
    `<div class="need-lasts-note">even with every cell working${supply.eatsFood ? ', plus what the Mouth eats' : ''}` +
    '</div>';
}

const NEED_STATE_MARKS = { ok: '✓', missing: '✗', weak: '~', none: '–' };

// One need: icon, name, its mark and, when it isn't met, the fix in a few words; the whole warning is its tooltip.
// isShown: whether its view is on screen (aria-pressed), or null for a row with no view to show.
function needRowHtml(row, isShown) {
  const fix = row.state === 'ok' ? '' : row.short;
  const pressed = isShown === null ? '' : ` aria-pressed="${isShown}"`;
  return `<div class="need-row ${row.state}" data-need="${row.need}"${pressed} title="${escapeHtml(row.text)}">` +
    `<span class="need-icon">${row.icon}</span><span class="need-label">${row.label}</span>` +
    `<span class="need-mark">${NEED_STATE_MARKS[row.state]}</span><span class="need-fix">${fix}</span></div>`;
}
