'use strict';
// Builder design logic: hex lookup, the limits check, the design warnings, and the saved design format with the
// conversion of older saves. Pure: no DOM.
// A design is { cells, fibres, vessels } (the format is described under "Saved design format" below).

const VESSEL_SUPPLY_REACH = 2;                            // cells from a pumped vessel's end that blood reaches well

// The checks read the cell types' behaviour fields (data/cells.js), never their names.
const typeOfCell = cell => CELLS[cell.typeName];
const needsSignal = cell => !!typeOfCell(cell).needsSignal;
// makes a signal of its own: a sense organ, or a neuron that ignores its inputs (Pacemaker, Command)
const makesSignals = cell => !!typeOfCell(cell).senses || (!!cell.neuron && NEURONS[cell.neuron.kind].ignoresInputs);
// makes a signal without a key (a Bud part has no key of its own)
const firesByItself = cell => makesSignals(cell) && !(cell.neuron && cell.neuron.kind === 'command');

const parseHexKey = hexKeyText => {
  const [q, r] = hexKeyText.split(',').map(Number);
  return { q, r };
};
const keysOf = cells => cells.map(cell => hexKey(cell.q, cell.r));

// grid pixel -> nearest hex [q, r] (rounding in cube coordinates)
function pixelToHex(x, y) {
  const r = y / HEX_SPACING_Y;
  const q = x / HEX_SPACING_X - r / 2;
  const s = -q - r;
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(s);
  const errorQ = Math.abs(roundedQ - q);
  const errorR = Math.abs(roundedR - r);
  const errorS = Math.abs(roundedS - s);
  if (errorQ > errorR && errorQ > errorS) roundedQ = -roundedR - roundedS;
  else if (errorR > errorS) roundedR = -roundedQ - roundedS;
  return [roundedQ, roundedR];
}

const isInGrid = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= GRID_RADIUS;

// hex keys reachable from the nucleus (0, 0) through hexes for which isOpen(hexKey) is true
function hexesReachableFromNucleus(isOpen) {
  const seen = new Set([hexKey(0, 0)]);
  const queue = [[0, 0]];
  while (queue.length) {
    const [q, r] = queue.pop();
    for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
      const neighbourKey = hexKey(q + stepQ, r + stepR);
      if (!isOpen(neighbourKey) || seen.has(neighbourKey)) continue;
      seen.add(neighbourKey);
      queue.push([q + stepQ, r + stepR]);
    }
  }
  return seen;
}

// why the design can't be run ('' = it can): the cell, biomass, neuron, fibre and vessel limits, from RULES or a
// level's
function buildCheck(design, limits = RULES) {
  if (design.cells.length > limits.maxCells) return `Too many cells: ${design.cells.length} / ${limits.maxCells}`;
  if (designCost(design) > limits.budget) return `Over budget by ${designCost(design) - limits.budget}`;
  const neuronCount = design.cells.filter(cell => cell.neuron).length;
  if (neuronCount > limits.maxNeurons) return `Too many neurons: ${neuronCount} / ${limits.maxNeurons}`;
  const units = fibreUnits(design);
  if (units > limits.maxFibreUnits) return `Too many fibre units: ${units} / ${limits.maxFibreUnits}`;
  const vesselUnitCount = vesselUnits(design);
  if (vesselUnitCount > limits.maxVesselUnits) {
    return `Too many vessel units: ${vesselUnitCount} / ${limits.maxVesselUnits}`;
  }
  return '';
}

// Design checks: signals, Bud parts, weapons, and whether the body has O2, energy and a waste exit for its working
// cells. body: the cells joined to the nucleus with their fibres and vessels; plannedKeys: hex keys of cells not
// joined to it.
// Returns warnings as { text, keys }, where keys are the hexes the warning is about (marked on the grid).
function designWarnings(body, plannedKeys) {
  const bodyCells = body.cells;
  const warnings = [];
  const warn = (text, keys = []) => warnings.push({ text, keys });
  if (plannedKeys.length) {
    warn(`${plannedKeys.length} planned cell(s) are not connected to the body: they are not part of the creature and ` +
      'cost nothing until you join them.', plannedKeys);
  }
  // the checks below look at the joined body only
  const typeAt = new Map(bodyCells.map(cell => [hexKey(cell.q, cell.r), cell.typeName]));
  const countWith = behaviour => bodyCells.filter(cell => typeOfCell(cell)[behaviour]).length;
  checkSignals(body, warn);
  checkBuds(bodyCells, warn);
  if (!countWith('isWeapon')) warn('No weapons: it cannot hurt anything.');
  checkFluids(typeAt, countWith, warn);
  checkVessels(body, warn);
  return warnings;
}

// signal-driven cells need a signal source, and a chain of fibres from one
function checkSignals(body, warn) {
  const sources = body.cells.filter(makesSignals);
  const driven = body.cells.filter(needsSignal);
  if (driven.length && !sources.length) {
    warn('Muscles, Bloaters, Siphons, Nettles, Snares, Spitters, Adrenals, Valves and Buds need a nerve signal: ' +
      'a Pacemaker or Command neuron, or an Eyespot, with fibres to them (Nerve view).', keysOf(driven));
  }
  const reached = new Set(keysOf(sources));
  const queue = [...reached];
  for (let i = 0; i < queue.length; i++) {
    for (const fibre of body.fibres || []) {
      const toKey = hexKey(fibre.to.q, fibre.to.r);
      if (hexKey(fibre.from.q, fibre.from.r) !== queue[i] || reached.has(toKey)) continue;
      reached.add(toKey);
      queue.push(toKey);
    }
  }
  const unwired = driven.filter(cell => !reached.has(hexKey(cell.q, cell.r)));
  if (sources.length && unwired.length) {
    warn(`${unwired.length} cell(s) that need a nerve signal get no fibre from a signal source.`, keysOf(unwired));
  }
}

// Buds need a part, room to grow it, parts that don't overlap, and their own signal source for signal-driven cells
function checkBuds(bodyCells, warn) {
  const buds = bodyCells.filter(cell => typeOfCell(cell).growsParts);
  const budsWithPart = buds.filter(bud => bud.budPart);
  const plans = budsWithPart.map(bud => planBudPart(bodyCells, bud));
  const budsWithoutPart = buds.filter(bud => !bud.budPart);
  if (budsWithoutPart.length) {
    warn(`${budsWithoutPart.length} Bud(s) have no part to grow: click the Bud, then a part in the Templates library.`,
      keysOf(budsWithoutPart));
  }
  const cramped = budsWithPart.filter((bud, i) => !plans[i].cells.length);
  const blocked = budsWithPart.filter((bud, i) => plans[i].blockedCount);
  if (cramped.length) {
    warn(`${cramped.length} Bud(s) have no free side to grow on: put Buds on the surface.`, keysOf(cramped));
  } else if (blocked.length) {
    const blockedCells = plans.reduce((sum, plan) => sum + plan.blockedCount, 0);
    warn(`${blockedCells} cell(s) of Bud parts are blocked by the body and will not grow.`, keysOf(blocked));
  }
  // a part has its own nerves: what needs a signal in it needs a Pacemaker neuron or an Eyespot in the part too
  const deaf = budsWithPart.filter(bud =>
    bud.budPart.cells.some(needsSignal) && !bud.budPart.cells.some(firesByItself));
  if (deaf.length) {
    warn(`${deaf.length} Bud part(s) have Muscles, Nettles or the like but no Pacemaker neuron or Eyespot of ` +
      'their own: ' +
      "a part's nerves are apart from the body's, so those cells do nothing.", keysOf(deaf));
  }
  const claimed = plans.flatMap(plan => keysOf(plan.cells));
  if (new Set(claimed).size < claimed.length) {
    const doubled = new Set(claimed.filter((key, i) => claimed.indexOf(key) !== i));
    warn('Two Buds grow parts onto the same hexes. Click a Bud and turn its part (Q/E) so they do not overlap.',
      [...doubled]);
  }
}

// fluids spread through the whole joined body (valves counted as open)
function checkFluids(typeAt, countWith, warn) {
  const keysWith = behaviour => [...typeAt].filter(([, typeName]) => CELLS[typeName][behaviour]).map(([key]) => key);
  const fueled = keysWith('fuelBurn');
  const fueledCount = fueled.length;
  if (fueledCount && !countWith('breathes')) {
    warn(`No Gill: the ${fueledCount} fuel-burning cell(s) run out of O₂.`, fueled);
  }
  if (fueledCount && !countWith('eatsFood') && !countWith('storesEnergy')) {
    warn(`No Mouth or Fat: the ${fueledCount} fuel-burning cell(s) run out of energy.`, fueled);
  }
  if (fueledCount && !countWith('dumpsWaste')) {
    warn(`No Pore: waste builds up in the ${fueledCount} fuel-burning cell(s) and poisons them.`, fueled);
  }
  const isEnclosed = key => {
    const { q, r } = parseHexKey(key);
    return HEX_NEIGHBOURS.every(([stepQ, stepR]) => typeAt.has(hexKey(q + stepQ, r + stepR)));
  };
  const buried = keysWith('dumpsWaste').filter(isEnclosed);
  if (buried.length) {
    warn(`${buried.length} Pore cell(s) are buried inside the body and do nothing: Pores must touch the water.`,
      buried);
  }
}

// Hearts pump only the vessels they sit on, and blood reaches a working cell well only near the end of a pumped vessel
// (elsewhere fluids only seep, slowly)
function checkVessels(body, warn) {
  const area = createRouteArea(body.cells);
  const routes = (body.vessels || []).map(vessel => routeFibre(area, vessel.from, vessel.to)).filter(Boolean);
  const pumpKeys = new Set(keysOf(body.cells.filter(cell => typeOfCell(cell).pumps)));
  const onVessel = new Set(routes.flatMap(route => route.hexes));
  const idleHearts = [...pumpKeys].filter(key => !onVessel.has(key));
  if (idleHearts.length) {
    warn(`${idleHearts.length} Heart(s) sit on no vessel and pump nothing: lay vessels through them (Vessels view, ` +
      'V).', idleHearts);
  }
  const pumpedEnds = routes
    .filter(route => route.hexes.some(key => pumpKeys.has(key)))
    .flatMap(route => [route.hexes[0], route.hexes[route.hexes.length - 1]])
    .map(parseHexKey);
  const fueled = body.cells.filter(cell => typeOfCell(cell).fuelBurn);
  const farFromBlood = fueled.filter(cell => !pumpedEnds.some(end => hexDistance(cell, end) <= VESSEL_SUPPLY_REACH));
  if (farFromBlood.length) {
    warn(`${farFromBlood.length} fuel-burning cell(s) are more than ${VESSEL_SUPPLY_REACH} cells from the end of a ` +
      'vessel with a Heart on it: fluids only seep to them, slowly.', keysOf(farFromBlood));
  }
}

// ---------- Saved design format ----------
// A design cell: { q, r, typeName }, plus on a Bud: budPart ({ name, cells }), partRotation (60° steps), partOffset
// ([q, r] of the part's anchor from the Bud) and partAim (radians clockwise from the front); on a Command: boundKey.
function createDesignCell(q, r, typeName, extras = {}) {
  return { q, r, typeName, ...extras };
}

// Saves made before 2026-10-28 (and by Bioforge Moba) used short field names.
const OLD_DESIGN_FIELD_NAMES = {
  t: 'typeName', tpl: 'budPart', bind: 'boundKey', rot: 'partRotation', off: 'partOffset', aim: 'partAim',
};

// a saved design cell in the current format, whichever format it was saved in
function migrateDesignCell(savedCell) {
  const cell = {};
  for (const [field, value] of Object.entries(savedCell)) {
    if (value === undefined || value === null) continue;
    const name = OLD_DESIGN_FIELD_NAMES[field] || field;
    cell[name] = name === 'budPart' ? migrateBudPart(value) : value;
  }
  return cell;
}

function migrateBudPart(savedPart) {
  const part = { name: savedPart.name, cells: savedPart.cells.map(migrateDesignCell) };
  if (savedPart.fibres) part.fibres = savedPart.fibres;
  return part;
}

// A saved library entry in the current format: { name, isCreature, cells, fibres, vessels }. Old entries called
// isCreature `full`, entries from before the nerve layer get their neurons and fibres (see upgradeToNerveLayer), and
// entries from before the vascular layer have no vessels.
function migrateLibraryEntry(savedEntry) {
  const isCreature = savedEntry.isCreature !== undefined ? savedEntry.isCreature : savedEntry.full;
  const design = { cells: savedEntry.cells.map(migrateDesignCell) };
  if (savedEntry.fibres) design.fibres = savedEntry.fibres;
  const upgraded = upgradeToNerveLayer(design);
  return {
    name: String(savedEntry.name),
    isCreature: !!isCreature,
    cells: upgraded.cells,
    fibres: upgraded.fibres,
    vessels: savedEntry.vessels || [],
  };
}

// ---------- Designs from before the nerve layer ----------
// Before 2026-10-28 signals leaked between touching cells that carried them, and four cell types made or shaped
// signals. A design without a fibres list is from then: its nerve cells become Tissue holding the matching neuron, and
// its touch-wiring becomes fibres, so it behaves as it did.
const OLD_NERVE_CELL_NEURONS = { nerve: null, ganglion: 'ganglion', pacemaker: 'pacemaker', command: 'command' };
const OLD_SIGNAL_SOURCES = new Set(['pacemaker', 'command', 'eyespot']);
const OLD_SIGNAL_CARRIERS = new Set([
  'nerve', 'ganglion', 'pacemaker', 'command', 'eyespot', 'muscle', 'bloater', 'siphon', 'nettle', 'snare', 'spitter',
  'bud', 'valve', 'adrenal',
]);

// the design in the current format; a current design is returned as it is
function upgradeToNerveLayer(design) {
  if (design.fibres) return design;
  return { ...design, cells: design.cells.map(upgradeOldCell), fibres: wireByOldTouchRule(design.cells) };
}

function upgradeOldCell(cell) {
  const upgraded = { ...cell };
  if (cell.budPart) upgraded.budPart = upgradeToNerveLayer(cell.budPart);
  if (!(cell.typeName in OLD_NERVE_CELL_NEURONS)) return upgraded;
  upgraded.typeName = 'tissue';
  const kind = OLD_NERVE_CELL_NEURONS[cell.typeName];
  if (kind) upgraded.neuron = createNeuron(kind);
  return upgraded;
}

// From each old signal source outward through the cells that used to carry signals, one fibre per step. Sources
// don't pass on each other's signals, as before.
function wireByOldTouchRule(cells) {
  const typeAt = new Map(cells.map(cell => [hexKey(cell.q, cell.r), cell.typeName]));
  const fibres = [];
  const laid = new Set();
  for (const source of cells.filter(cell => OLD_SIGNAL_SOURCES.has(cell.typeName))) {
    const reached = new Set([hexKey(source.q, source.r)]);
    const queue = [{ q: source.q, r: source.r }];
    for (let i = 0; i < queue.length; i++) {
      const from = queue[i];
      for (const [stepQ, stepR] of HEX_NEIGHBOURS) {
        const to = { q: from.q + stepQ, r: from.r + stepR };
        const typeName = typeAt.get(hexKey(to.q, to.r));
        if (reached.has(hexKey(to.q, to.r)) || !OLD_SIGNAL_CARRIERS.has(typeName)) continue;
        if (OLD_SIGNAL_SOURCES.has(typeName)) continue;
        reached.add(hexKey(to.q, to.r));
        queue.push(to);
        const fibreKey = hexKey(from.q, from.r) + '>' + hexKey(to.q, to.r);
        if (laid.has(fibreKey)) continue;
        laid.add(fibreKey);
        fibres.push({ from, to });
      }
    }
  }
  return fibres;
}
