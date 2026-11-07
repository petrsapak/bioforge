'use strict';
// Builder design logic: hex lookup, the limits check, the design warnings and the Needs rows they fill, the sugar
// supply, and the saved design format with the conversion of older saves. Pure: no DOM.
// A design is { cells, fibres } (the format is described under "Saved design format" below).


// The rows of the builder's Needs card, in the order a player should fix them. A Buds row only shows on a body with
// Buds. A click on a row with a `fluid` (a FLUIDS id) shows that fluid's view. A row with a `system` only shows
// where that system runs: without fluid every cell works at full power, so nothing needs O2, sugar or an exit.
const NEED_ROWS = [
  { need: 'signal', icon: '↯', label: 'Signal' },
  { need: 'oxygen', icon: 'O₂', label: 'Oxygen', fluid: 'oxygen', system: 'fluid' },
  { need: 'sugar', icon: '⚡', label: 'Sugar', fluid: 'sugar', system: 'fluid' },
  { need: 'waste', icon: '☁', label: 'Waste', fluid: 'waste', system: 'fluid' },
  { need: 'blood', icon: '♥', label: 'Blood', system: 'vascular' },
  { need: 'weapon', icon: '⚔', label: 'Weapon' },
  { need: 'buds', icon: '✿', label: 'Buds' },
];

// The checks read the cell types' behaviour fields (data/cells.js), never their names.
const typeOfCell = cell => CELLS[cell.typeName];
const needsSignal = cell => !!typeOfCell(cell).needsSignal;
// makes a signal of its own: a sense organ, a neuron that ignores its inputs (Pacemaker, Command), or one that is
// on with nothing wired into it (Inhibitor)
const makesSignals = cell => !!typeOfCell(cell).senses ||
  (!!cell.neuron && (NEURONS[cell.neuron.kind].ignoresInputs || NEURONS[cell.neuron.kind].onWithoutInput));
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
  const cubeS = -q - r;                                 // the third cube coordinate
  let roundedQ = Math.round(q);
  let roundedR = Math.round(r);
  const roundedS = Math.round(cubeS);
  const errorQ = Math.abs(roundedQ - q);
  const errorR = Math.abs(roundedR - r);
  const errorS = Math.abs(roundedS - cubeS);
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

// Why the design can't be run ('' = it can): a cell type the level doesn't allow, and the cell, biomass, neuron,
// and fibre limits, from RULES or a level's. Pieces still locked (lockedCells) only stay out of the dock: an
// example or a saved creature that has them still runs, as First stroke's hint points at the Jet.
function buildCheck(design, limits = RULES) {
  const bannedCell = design.cells.find(cell => isCellBanned(limits, cell.typeName));
  if (bannedCell) return `No ${CELLS[bannedCell.typeName].name} allowed here`;
  // a design loaded from the Templates screen can hold pieces no level so far has brought
  const lockedCell = design.cells.find(cell => isCellLocked(limits, cell.typeName));
  if (lockedCell) return `Take out the ${CELLS[lockedCell.typeName].name}: a later level brings it`;
  const lockedNeuron = design.cells.find(cell => cell.neuron && isNeuronLocked(limits, cell.neuron.kind));
  if (lockedNeuron) return `Take out the ${NEURONS[lockedNeuron.neuron.kind].name}: a later level brings it`;
  if (design.cells.length > limits.maxCells) {
    return `Too many cells: the body has ${design.cells.length}, the limit is ${limits.maxCells}`;
  }
  if (limits.kit) {
    const shortfall = kitShortfall(design, limits.kit);
    if (shortfall) return shortfall;
  } else if (designCost(design) > limits.budget) {
    return `Too much biomass: the body costs ${designCost(design)}, the limit is ${limits.budget}`;
  }
  const neuronCount = design.cells.filter(cell => cell.neuron).length;
  if (neuronCount > limits.maxNeurons) {
    return `Too many neurons: the body has ${neuronCount}, the limit is ${limits.maxNeurons}`;
  }
  const units = fibreUnits(design);
  if (units > limits.maxFibreUnits) {
    return `Too many fibre units: the body uses ${units}, the limit is ${limits.maxFibreUnits}`;
  }
  return '';
}

// whether the limits leave this cell type out (a level's bannedCells)
const isCellBanned = (limits, typeName) => !!limits.bannedCells && limits.bannedCells.includes(typeName);

// whether no level so far has unlocked this cell type or neuron kind (a level's lockedCells and lockedNeurons)
const isCellLocked = (limits, typeName) => !!limits.lockedCells && limits.lockedCells.includes(typeName);
const isNeuronLocked = (limits, kind) => !!limits.lockedNeurons && limits.lockedNeurons.includes(kind);

// ---------- Material kits ----------
// A level with a kit ({ protein, sugar, fat }, data/levels.js) has no biomass budget: the body's recipes
// (data/cells.js) must fit the kit, and what is left becomes the creature's starting reserves (metabolism.js).

// the materials the design's cells are built from, by material id
function designMaterials(design) {
  const used = Object.fromEntries(MATERIALS.map(material => [material.id, 0]));
  for (const cell of design.cells) {
    const recipe = CELLS[cell.typeName].recipe;
    for (const id of Object.keys(recipe)) used[id] += recipe[id];
  }
  return used;
}

// what the design leaves of the kit, by material id
function kitLeftover(design, kit) {
  const used = designMaterials(design);
  return Object.fromEntries(MATERIALS.map(material => [material.id, (kit[material.id] || 0) - used[material.id]]));
}

// the first material the design uses more of than the kit has, in words, naming the cells that use it ('' = it fits)
function kitShortfall(design, kit) {
  const leftover = kitLeftover(design, kit);
  const over = MATERIALS.find(material => leftover[material.id] < 0);
  if (!over) return '';
  const inKit = kit[over.id] || 0;
  const users = [...new Set(design.cells
    .filter(cell => CELLS[cell.typeName].recipe[over.id])
    .map(cell => 'the ' + CELLS[cell.typeName].name))];
  return `Too much ${over.name.toLowerCase()}: the body uses ${inKit - leftover[over.id]}, ` +
    `the kit has ${inKit || 'none'}. It goes into ${joinWithAnd(users)}`;
}

// names joined as 'A', 'A and B' or 'A, B and C'
function joinWithAnd(names) {
  if (names.length < 2) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

// the kit's leftovers that become reserves at the start of a run: { sugar, fat, mineral }
function kitReserves(design, kit) {
  const leftover = kitLeftover(design, kit);
  const reserves = { sugar: 0, fat: 0, mineral: 0 };
  for (const material of MATERIALS) {
    if (material.reserve) reserves[material.reserve] += leftover[material.id];
  }
  return reserves;
}

// Design checks: signals, Bud parts, weapons, and whether the body has O2, sugar and a waste exit for its working
// cells. body: the cells joined to the nucleus with their fibres; plannedKeys: hex keys of cells not
// joined to it.
// Returns warnings as { need, level, short, text, keys }: need is the Needs row it belongs to (or 'planned'), level
// is 'problem' (it doesn't work), 'hint' (it works, but poorly) or 'note', short is the fix in a few words, and
// keys are the hexes the warning is about (marked on the grid).
function designWarnings(body, plannedKeys) {
  const bodyCells = body.cells;
  const warnings = [];
  const warn = (need, level, short, text, keys = []) => warnings.push({ need, level, short, text, keys });
  if (plannedKeys.length) {
    warn('planned', 'note', 'not joined', `${plannedKeys.length} planned cell(s) are not connected to the body: ` +
      'they are not part of the creature and cost nothing until you join them.', plannedKeys);
  }
  // the checks below look at the joined body only
  const typeAt = new Map(bodyCells.map(cell => [hexKey(cell.q, cell.r), cell.typeName]));
  const countWith = behaviour => bodyCells.filter(cell => typeOfCell(cell)[behaviour]).length;
  checkSignals(body, warn);
  checkBuds(bodyCells, warn);
  if (!countWith('isWeapon')) warn('weapon', 'note', 'none', 'No weapons: it cannot hurt anything.');
  checkFluids(typeAt, countWith, warn);
  checkHearts(body, warn);
  return warnings;
}

// signal-driven cells need a signal source, and a chain of fibres from one
function checkSignals(body, warn) {
  const sources = body.cells.filter(makesSignals);
  const driven = body.cells.filter(needsSignal);
  if (driven.length && !sources.length) {
    warn('signal', 'problem', 'add a Pacemaker',
      'Muscles, Bloaters, Siphons, Nettles, Snares, Spitters, Adrenals and Buds need a nerve signal: ' +
      'a Pacemaker or Command neuron, or an Eyespot, with fibres to them (Nerves, 2).', keysOf(driven));
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
    warn('signal', 'problem', `wire ${unwired.length} cell(s)`,
      `${unwired.length} cell(s) that need a nerve signal get no fibre from a signal source (Nerves, 2).`,
      keysOf(unwired));
  }
}

// Buds need a part, room to grow it, parts that don't overlap, and their own signal source for signal-driven cells
function checkBuds(bodyCells, warn) {
  const buds = bodyCells.filter(cell => typeOfCell(cell).growsParts);
  const budsWithPart = buds.filter(bud => bud.budPart);
  const plans = budsWithPart.map(bud => planBudPart(bodyCells, bud));
  const budsWithoutPart = buds.filter(bud => !bud.budPart);
  if (budsWithoutPart.length) {
    warn('buds', 'problem', 'give it a part', `${budsWithoutPart.length} Bud(s) have no part to grow: click the Bud, ` +
      'then a part on the Templates screen (T).', keysOf(budsWithoutPart));
  }
  const cramped = budsWithPart.filter((bud, i) => !plans[i].cells.length);
  const blocked = budsWithPart.filter((bud, i) => plans[i].blockedCount);
  if (cramped.length) {
    warn('buds', 'problem', 'no room', `${cramped.length} Bud(s) have no free side to grow on: put Buds on the ` +
      'surface.', keysOf(cramped));
  } else if (blocked.length) {
    const blockedCells = plans.reduce((sum, plan) => sum + plan.blockedCount, 0);
    warn('buds', 'hint', 'part blocked', `${blockedCells} cell(s) of Bud parts are blocked by the body and will not ` +
      'grow.', keysOf(blocked));
  }
  // a part has its own nerves: what needs a signal in it needs a Pacemaker neuron or an Eyespot in the part too
  const deaf = budsWithPart.filter(bud =>
    bud.budPart.cells.some(needsSignal) && !bud.budPart.cells.some(firesByItself));
  if (deaf.length) {
    warn('buds', 'problem', 'part has no signal',
      `${deaf.length} Bud part(s) have Muscles, Nettles or the like but no Pacemaker neuron or Eyespot of ` +
      'their own: ' +
      "a part's nerves are apart from the body's, so those cells do nothing.", keysOf(deaf));
  }
  const claimed = plans.flatMap(plan => keysOf(plan.cells));
  if (new Set(claimed).size < claimed.length) {
    const doubled = new Set(claimed.filter((key, i) => claimed.indexOf(key) !== i));
    warn('buds', 'problem', 'parts overlap',
      'Two Buds grow parts onto the same hexes. Click a Bud and turn its part (Q/E) so they do not overlap.',
      [...doubled]);
  }
}

// fluids spread through the whole joined body
function checkFluids(typeAt, countWith, warn) {
  const keysWith = behaviour => [...typeAt].filter(([, typeName]) => CELLS[typeName][behaviour]).map(([key]) => key);
  const fueled = keysWith('fuelBurn');
  const fueledCount = fueled.length;
  if (fueledCount && !countWith('breathes')) {
    warn('oxygen', 'problem', 'add a Gill', `No Gill: the ${fueledCount} fuel-burning cell(s) run out of O₂.`, fueled);
  }
  if (fueledCount && !countWith('eatsFood') && !countWith('storesSugar')) {
    warn('sugar', 'problem', 'add a Mouth or Fat',
      `No Mouth or Fat: the ${fueledCount} fuel-burning cell(s) run out of sugar.`, fueled);
  }
  if (fueledCount && !countWith('dumpsWaste')) {
    warn('waste', 'problem', 'add a Pore',
      `No Pore: waste builds up in the ${fueledCount} fuel-burning cell(s) and poisons them.`, fueled);
  }
  const isEnclosed = key => {
    const { q, r } = parseHexKey(key);
    return HEX_NEIGHBOURS.every(([stepQ, stepR]) => typeAt.has(hexKey(q + stepQ, r + stepR)));
  };
  const buried = keysWith('dumpsWaste').filter(isEnclosed);
  if (buried.length) {
    warn('waste', 'problem', 'Pore buried',
      `${buried.length} Pore cell(s) are buried inside the body and do nothing: Pores must touch the water.`, buried);
  }
}

// Blood reaches a working cell fast only within a Heart's reach (vascular.js); elsewhere fluids only seep, slowly.
// (Whether a Heart gets a signal is checkSignals' job, as for every cell that needs one.)
function checkHearts(body, warn) {
  const hearts = body.cells.filter(cell => typeOfCell(cell).pumps);
  const fueled = body.cells.filter(cell => typeOfCell(cell).fuelBurn && !typeOfCell(cell).pumps);
  const outOfReach = fueled.filter(cell => !hearts.some(heart => hexDistance(cell, heart) <= HEART_REACH));
  if (!outOfReach.length) return;
  const where = hearts.length ? `more than ${HEART_REACH} steps from every Heart` : 'pumped by no Heart';
  warn('blood', 'hint', hearts.length ? 'out of reach' : 'seeps slowly',
    `${outOfReach.length} fuel-burning cell(s) are ${where}: fluids only seep to them, slowly. A beating Heart ` +
    `within ${HEART_REACH} steps helps.`, keysOf(outOfReach));
}

// ---------- The Needs card ----------
// One row per need: 'none' while nothing in the body needs it, else 'ok', or the worst of its warnings: 'missing'
// for a problem, 'weak' for a hint, 'none' for a note. Each row keeps its warnings, the first one's short fix and
// the hexes they are about. systems: the switchable systems that run (a level's, or RULES'); rows of others are left
// out.
function designNeeds(body, warnings, systems = RULES.systems) {
  const types = body.cells.map(typeOfCell);
  const hasAny = behaviour => types.some(cellType => cellType[behaviour]);
  const burnsFuel = hasAny('fuelBurn');
  const applies = {
    signal: hasAny('needsSignal'),
    oxygen: burnsFuel,
    sugar: burnsFuel,
    waste: burnsFuel || hasAny('dumpsWaste'),
    blood: burnsFuel || hasAny('pumps'),
    weapon: true,
    buds: hasAny('growsParts'),
  };
  const isShown = row => (row.need !== 'buds' || applies.buds) && (!row.system || systems.includes(row.system));
  return NEED_ROWS.filter(isShown).map(row => {
    const own = warnings.filter(warning => warning.need === row.need);
    let state = applies[row.need] ? 'ok' : 'none';
    if (own.some(warning => warning.level === 'problem')) state = 'missing';
    else if (own.some(warning => warning.level === 'hint')) state = 'weak';
    else if (own.length) state = 'none';
    const worst = own.find(warning => warning.level === 'problem') || own[0];
    return { ...row, state, short: worst ? worst.short : '', text: worst ? worst.text : '', warnings: own,
      keys: [...new Set(own.flatMap(warning => warning.keys))] };
  });
}

// the one thing to fix next: the first missing need's warning, else the first weak one's; '' when nothing is wrong
function nextNeed(needRows) {
  const row = needRows.find(candidate => candidate.state === 'missing') ||
    needRows.find(candidate => candidate.state === 'weak');
  return row ? row.text : '';
}

// The body's sugar: what its cells hold at the start, the most they burn per second (every cell working), and
// whether a Mouth can top it up. stock / burn is the shortest time it lasts without food.
function sugarSupply(body) {
  const types = body.cells.map(typeOfCell);
  const sugarFluid = FLUIDS[FLUID_SUGAR];
  const sumOf = valueOf => types.reduce((sum, cellType) => sum + valueOf(cellType), 0);
  return {
    stock: sumOf(cellType => fluidCapacityOf(cellType, sugarFluid) * sugarFluid.startFill),
    burn: sumOf(cellType => (cellType.fuelBurn || 0) * FUEL_BURN_SCALE),
    eatsFood: types.some(cellType => cellType.eatsFood),
  };
}

// ---------- Saved design format ----------
// A design cell: { q, r, typeName }, plus on a Bud: budPart ({ name, cells }), partRotation (60° steps), partOffset
// ([q, r] of the part's anchor from the Bud) and partAim (radians clockwise from the front); on a Command: boundKey;
// on a Receptor: sensedHormone (a hormone's id, data/fluids.js; left out: DEFAULT_SENSED_HORMONE).
function createDesignCell(q, r, typeName, extras = {}) {
  return { q, r, typeName, ...extras };
}

// a design of just the Nucleus: Delete all, and the main menu's Sandbox
const bareDesign = () => ({ cells: [createDesignCell(0, 0, 'nucleus')], fibres: [] });

// Saves made before 2026-10-28 (and by Bioforge Moba) used short field names.
const OLD_DESIGN_FIELD_NAMES = {
  t: 'typeName', tpl: 'budPart', bind: 'boundKey', rot: 'partRotation', off: 'partOffset', aim: 'partAim',
};

// Cell types taken out of the game, and the type a saved one becomes. It keeps its neuron and fibres.
const REMOVED_CELL_TYPES = {
  valve: 'tissue',                                        // 2026-11-02: no level used it
};

// a saved design cell in the current format, whichever format it was saved in
function migrateDesignCell(savedCell) {
  const cell = {};
  for (const [field, value] of Object.entries(savedCell)) {
    if (value === undefined || value === null) continue;
    const name = OLD_DESIGN_FIELD_NAMES[field] || field;
    cell[name] = name === 'budPart' ? migrateBudPart(value) : value;
  }
  if (Object.hasOwn(REMOVED_CELL_TYPES, cell.typeName)) cell.typeName = REMOVED_CELL_TYPES[cell.typeName];
  return cell;
}

// a saved Bud part in the current format
function migrateBudPart(savedPart) {
  const part = { name: savedPart.name, cells: savedPart.cells.map(migrateDesignCell) };
  if (savedPart.fibres) part.fibres = savedPart.fibres;
  return part;
}

// A saved library entry in the current format: { name, isCreature, cells, fibres }. Old entries called isCreature
// `full`, entries from before the nerve layer get their neurons and fibres (see upgradeToNerveLayer), and entries
// from before the Heart's areas keep their Hearts beating (see upgradeToHeartAreas).
function migrateLibraryEntry(savedEntry) {
  const isCreature = savedEntry.isCreature !== undefined ? savedEntry.isCreature : savedEntry.full;
  const design = { cells: savedEntry.cells.map(migrateDesignCell) };
  if (savedEntry.fibres) design.fibres = savedEntry.fibres;
  const upgraded = upgradeToHeartAreas(upgradeToNerveLayer(design), isFromBeforeHeartAreas(savedEntry));
  return {
    name: String(savedEntry.name),
    isCreature: !!isCreature,
    cells: upgraded.cells,
    fibres: upgraded.fibres,
  };
}

// ---------- Designs from before the Heart's areas ----------
// Until 2026-11-01 a fed Heart beat all the time, and pumped vessels the player laid. Now it beats only on a signal,
// so a design saved before then (isOld) gets an Inhibitor in every Heart that has no neuron, which keeps it beating
// as before; its vessels are dropped. Bud parts are upgraded with it.

// whether a saved design is from before 2026-11-01: it has a vessels list (every save from the vascular layer on
// had one), or no fibres (it is from before the nerve layer)
const isFromBeforeHeartAreas = saved => 'vessels' in saved || !saved.fibres;

// the design with its Hearts kept beating and its vessels dropped, if it is old (see above)
function upgradeToHeartAreas(design, isOld) {
  if (!isOld) return design;
  const cells = design.cells.map(cell => {
    const upgraded = { ...cell };
    if (cell.budPart) upgraded.budPart = upgradeToHeartAreas(cell.budPart, true);
    if (CELLS[cell.typeName] && CELLS[cell.typeName].pumps && !cell.neuron) upgraded.neuron = createNeuron('inhibitor');
    return upgraded;
  });
  const upgraded = { ...design, cells };
  delete upgraded.vessels;
  return upgraded;
}

// ---------- Designs from before the nerve layer ----------
// Before 2026-10-28 signals leaked between touching cells that carried them, and four cell types made or shaped
// signals. A design without a fibres list is from then: its nerve cells become Tissue holding the matching neuron, and
// its touch-wiring becomes fibres, so it behaves as it did.
const OLD_NERVE_CELL_NEURONS = { nerve: null, ganglion: 'ganglion', pacemaker: 'pacemaker', command: 'command' };
const OLD_SIGNAL_SOURCES = new Set(['pacemaker', 'command', 'eyespot']);
const OLD_SIGNAL_CARRIERS = new Set([
  'nerve', 'ganglion', 'pacemaker', 'command', 'eyespot', 'muscle', 'bloater', 'siphon', 'nettle', 'snare', 'spitter',
  'bud', 'adrenal',
]);

// the design in the current format; a current design is returned as it is
function upgradeToNerveLayer(design) {
  if (design.fibres) return design;
  return { ...design, cells: design.cells.map(upgradeOldCell), fibres: wireByOldTouchRule(design.cells) };
}

// a cell from before the nerve layer: an old nerve cell becomes tissue with the matching neuron
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
