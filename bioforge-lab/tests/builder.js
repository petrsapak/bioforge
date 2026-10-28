// builder.js and the saved format (sim only): placing and removing cells, planned cells, Command keys, Bud parts and
// their aim, stamping, saving a selection, the library, and carrying old saves over to the current format.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['createEditedDesign', 'canPlaceCell', 'placeCell', 'removeCell', 'bodyCells',
  'plannedKeys', 'toggleCommandKey', 'giveBudPart', 'reservedHexes', 'moveBudPart', 'turnBudPart', 'currentBudPart',
  'aimBudPart', 'resetBudAim', 'budHandleAt', 'stampPlacement', 'placeStamp', 'templateFromSelection',
  'storeTemplate', 'migrateLibraryEntry', 'createDesignCell', 'hexKey', 'newWorld', 'spawn', 'step', 'placeNeuron',
  'removeNeuron', 'changeNeuronSetting', 'toggleFibre', 'bodyDesign', 'nerveUsage', 'fibresAt', 'removeFibre',
  'nerveRemovalTarget', 'hexToPixel']);

const cellsOf = list => list.map(([q, r, typeName]) => sim.createDesignCell(q, r, typeName));
const editedFrom = (cells, biomassLimit) => sim.createEditedDesign({ cells, fibres: [] }, biomassLimit);

{ // cells: placing, planned cells, the biomass limit, removing
  const source = cellsOf([[0, 0, 'nucleus'], [1, 0, 'tissue']]);
  const edited = editedFrom(source, 3);
  sim.placeCell(edited, 0, 1, 'tissue');
  check('the edited design is a copy', source.length === 2 && edited.cells.size === 3);
  check('an occupied hex takes no cell', !sim.canPlaceCell(edited, 1, 0, 'tissue'));
  check('a cell joining the body must fit the biomass limit', !sim.canPlaceCell(edited, 2, 0, 'muscle'));
  check('a cell off the body is planned and costs nothing', sim.canPlaceCell(edited, 5, 5, 'muscle'));
  check('a hex off the grid takes no cell', !sim.canPlaceCell(edited, 99, 0, 'tissue'));
  sim.placeCell(edited, 2, 0, 'tissue');
  sim.removeCell(edited, 1, 0);
  check('a cell cut off from the Nucleus stays, as planned',
    sim.plannedKeys(edited).join() === sim.hexKey(2, 0) && sim.bodyCells(edited).length === 2);
  sim.removeCell(edited, 0, 0);
  check('the Nucleus cannot be removed', edited.cells.has(sim.hexKey(0, 0)));
}

{ // Command keys
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [1, 0, 'tissue']]));
  const commandKey = sim.hexKey(1, 0);
  sim.toggleCommandKey(edited, commandKey, '3');
  const wasBound = edited.cells.get(commandKey).boundKey === '3';
  sim.toggleCommandKey(edited, commandKey, '3');
  check('a number key binds a Command, the same key again unbinds it',
    wasBound && edited.cells.get(commandKey).boundKey === undefined);
}

{ // Bud parts: giving, reserving, moving, turning, aiming, and growing in the sim
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [0, -1, 'bud'], [1, -1, 'tissue']]), Infinity);
  const budKey = sim.hexKey(0, -1);
  const spike = { name: 'Spike', isCreature: false, cells: cellsOf([[0, 0, 'thorn'], [0, -1, 'thorn']]) };
  const wholeCreature = { name: 'Whole', isCreature: true, cells: cellsOf([[0, 0, 'nucleus']]) };
  check('a Bud refuses a whole creature', /without a Nucleus/.test(sim.giveBudPart(edited, budKey, wholeCreature)));
  check('a Bud takes a part', sim.giveBudPart(edited, budKey, spike) === '' && !!edited.cells.get(budKey).budPart);
  const reserved = sim.reservedHexes(edited);
  check('the part reserves its hexes', reserved.size === 2);
  const [reservedQ, reservedR] = [...reserved][0].split(',').map(Number);
  check('a reserved hex takes no cell', !sim.canPlaceCell(edited, reservedQ, reservedR, 'tissue'));
  check('a part cannot cover the body', /covers cells of the body/.test(sim.moveBudPart(edited, budKey, 0, 0, 0)));
  check('a part must touch the Bud', /must touch the Bud/.test(sim.moveBudPart(edited, budKey, 0, 5, -5)));
  const offsetBefore = String(sim.currentBudPart(edited, budKey).offset);
  check('Q/E turn the part around the Bud',
    sim.turnBudPart(edited, budKey, 1) === '' && String(sim.currentBudPart(edited, budKey).offset) !== offsetBefore);
  sim.aimBudPart(edited, budKey, 100, -20);
  const wasAimed = edited.cells.get(budKey).partAim > 0;
  sim.resetBudAim(edited, budKey);
  check('dragging toward a point aims the part, and the aim resets',
    wasAimed && edited.cells.get(budKey).partAim === undefined);
  const [partQ, partR] = [...sim.reservedHexes(edited)][0].split(',').map(Number);
  const handle = sim.budHandleAt(edited, partQ, partR, null, null);
  check('a cell of the part is a drag handle', !!handle && handle.budKey === budKey);
  const world = sim.newWorld(800, 800);
  const creature = sim.spawn(world, { cells: sim.bodyCells(edited) }, 400, 400, 0, 0);
  for (let i = 0; i < 400; i++) sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: false });
  check('the spawned Bud grows its part', creature.cells.length > 3, `cells ${creature.cells.length}`);
}

{ // stamping and saving a selection
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [1, 0, 'muscle'], [2, 0, 'muscle']]), Infinity);
  const selection = new Set([sim.hexKey(1, 0), sim.hexKey(2, 0)]);
  const part = sim.templateFromSelection(edited, selection, '  Arm  ');
  check('a selection without the Nucleus saves as a part, around its middle cell',
    part.name === 'Arm' && !part.isCreature && part.cells.some(cell => cell.q === 0 && cell.r === 0));
  const onTaken = sim.stampPlacement(edited, { template: part, rotation: 0 }, 2, 0);   // (2, 0) taken, (3, 0) free
  check('a stamp on taken hexes leaves them out', onTaken.cells.length === 1 && onTaken.problem === '');
  const onlyTaken = sim.stampPlacement(edited, { template: { cells: cellsOf([[0, 0, 'tissue']]) }, rotation: 0 }, 0, 0);
  check('a stamp with no free hex says so', onlyTaken.problem === 'Every hex there is already taken.');
  const stamp = { template: part, rotation: 2 };
  check('a turned stamp is placed', sim.placeStamp(edited, stamp, 0, 2) === '' && edited.cells.size === 5);
  const tight = editedFrom(cellsOf([[0, 0, 'nucleus']]), 1);
  check('a stamp joining the body must fit the biomass limit',
    /Not enough biomass/.test(sim.stampPlacement(tight, stamp, 1, 0).problem));
  const whole = sim.templateFromSelection(edited, new Set(edited.cells.keys()), 'Me');
  check('a selection with the Nucleus saves as a whole creature', whole.isCreature && whole.cells.length === 5);
  const library = [];
  sim.storeTemplate(library, part);
  const replaced = sim.storeTemplate(library, { ...part, cells: [] });
  sim.storeTemplate(library, { ...part, isCreature: true });
  check('the same name and kind replaces, another kind adds', replaced === part && library.length === 2);
}

{ // the nerve layer: neurons, their settings, fibres
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [1, 0, 'tissue'], [2, 0, 'muscle'], [5, 5, 'muscle']]));
  const tissueKey = sim.hexKey(1, 0);
  const muscleKey = sim.hexKey(2, 0);
  sim.placeNeuron(edited, tissueKey, 'synapse');
  check('a neuron goes into a cell, with its setting at the start value',
    edited.cells.get(tissueKey).neuron.kind === 'synapse' && edited.cells.get(tissueKey).neuron.setting === 1);
  for (let i = 0; i < 20; i++) sim.changeNeuronSetting(edited, tissueKey, 1);
  check('a setting stops at its maximum', edited.cells.get(tissueKey).neuron.setting === 4);
  sim.changeNeuronSetting(edited, tissueKey, -1);
  check('a setting moves by its step', edited.cells.get(tissueKey).neuron.setting === 3.5);
  check('a fibre is laid by a drag', sim.toggleFibre(edited, tissueKey, muscleKey) === 'laid' &&
    sim.fibresAt(edited, muscleKey).incoming === 1);
  check('the same drag again removes it', sim.toggleFibre(edited, tissueKey, muscleKey) === 'removed' &&
    edited.fibres.length === 0);
  check('no fibre from a cell to itself, or to an empty hex',
    sim.toggleFibre(edited, tissueKey, tissueKey) === '' &&
    sim.toggleFibre(edited, tissueKey, sim.hexKey(9, 9)) === '');
  sim.toggleFibre(edited, tissueKey, muscleKey);
  sim.toggleFibre(edited, muscleKey, sim.hexKey(5, 5));
  check('fibres to planned cells stay out of the creature', sim.bodyDesign(edited).fibres.length === 1);
  const usage = sim.nerveUsage(edited);
  check('the nerve usage counts neurons and fibre units', usage.neurons === 1 && usage.units === 1);
  sim.removeNeuron(edited, tissueKey);
  sim.removeCell(edited, 2, 0);
  check('removing a cell removes its fibres; removing a neuron leaves the cell',
    edited.fibres.length === 0 && edited.cells.has(tissueKey) && !edited.cells.get(tissueKey).neuron);
}

{ // what a right-click takes out in the Nerve view: a neuron near its cell's centre, else a fibre near its line
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [1, 0, 'tissue'], [2, 0, 'muscle'], [1, -1, 'tissue']]));
  const tissueKey = sim.hexKey(1, 0);
  sim.placeNeuron(edited, tissueKey, 'pacemaker');
  sim.toggleFibre(edited, tissueKey, sim.hexKey(2, 0));
  const fibre = edited.fibres[0];
  const [tissueX, tissueY] = sim.hexToPixel(1, 0);
  const [muscleX] = sim.hexToPixel(2, 0);
  const halfway = [(tissueX + muscleX) / 2, tissueY];
  check('on the neuron: the neuron', sim.nerveRemovalTarget(edited, [tissueX, tissueY]).neuronKey === tissueKey);
  check('on the fibre between the cells: the fibre', sim.nerveRemovalTarget(edited, halfway).fibre === fibre);
  const [otherX, otherY] = sim.hexToPixel(1, -1);
  check('on a cell with nothing on it: nothing', sim.nerveRemovalTarget(edited, [otherX, otherY]) === null);
  check('on the neuron\'s cell away from the fibre: the neuron',
    sim.nerveRemovalTarget(edited, [tissueX - 4, tissueY - 6]).neuronKey === tissueKey);
  sim.removeFibre(edited, fibre);
  check('removeFibre takes out just that fibre', edited.fibres.length === 0 && !!edited.cells.get(tissueKey).neuron);
}

{ // fibres travel with saved parts: saving a selection, stamping it, and growing it on a Bud
  const edited = editedFrom(cellsOf([[0, 0, 'nucleus'], [1, 0, 'tissue'], [2, 0, 'muscle'], [0, -1, 'bud']]), Infinity);
  sim.placeNeuron(edited, sim.hexKey(1, 0), 'pacemaker');
  sim.toggleFibre(edited, sim.hexKey(1, 0), sim.hexKey(2, 0));
  const part = sim.templateFromSelection(edited, new Set([sim.hexKey(1, 0), sim.hexKey(2, 0)]), 'Pulse');
  check('a saved part keeps its fibres and neurons',
    part.fibres.length === 1 && part.cells.some(cell => cell.neuron && cell.neuron.kind === 'pacemaker'));
  check('a stamped part brings its fibres', sim.placeStamp(edited, { template: part, rotation: 0 }, 1, 2) === '' &&
    edited.fibres.length === 2);
  sim.giveBudPart(edited, sim.hexKey(0, -1), part);
  const budPart = edited.cells.get(sim.hexKey(0, -1)).budPart;
  check('a Bud part keeps its fibres and neurons',
    budPart.fibres.length === 1 && budPart.cells.some(cell => cell.neuron));
  const world = sim.newWorld(800, 800);
  sim.spawn(world, sim.bodyDesign(edited), 400, 400, 0, 0);
  const fibresAtSpawn = world.fibres.length;
  for (let i = 0; i < 400; i++) sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: false });
  check('a growing Bud part gets its fibres once both ends have grown', world.fibres.length > fibresAtSpawn,
    `${fibresAtSpawn} -> ${world.fibres.length}`);
}

{ // saves from before 2026-10-28 (and from Bioforge Moba) carry over
  const oldBud = {
    q: 0, r: -1, t: 'bud', tpl: { name: 'Spike', cells: [{ q: 0, r: 0, t: 'thorn' }] }, rot: 1, off: [0, -1], aim: 0.5,
  };
  const oldEntry = {
    name: 'Old',
    full: true,
    cells: [{ q: 0, r: 0, t: 'nucleus' }, oldBud, { q: 1, r: -1, t: 'command', bind: '4', aim: undefined }],
  };
  const entry = sim.migrateLibraryEntry(oldEntry);
  const [, bud, command] = entry.cells;
  check('old field names are renamed', entry.isCreature && bud.typeName === 'bud' && bud.partRotation === 1 &&
    String(bud.partOffset) === '0,-1' && bud.partAim === 0.5 && command.boundKey === '4');
  check('an old Command cell becomes Tissue with a Command neuron, keeping its key',
    command.typeName === 'tissue' && command.neuron.kind === 'command' && Array.isArray(entry.fibres));
  check('the Bud part inside is renamed too',
    bud.budPart.cells[0].typeName === 'thorn' && !('t' in bud.budPart.cells[0]));
  check('empty fields are dropped', !('partAim' in command));
  check('an entry in the current format stays as it is',
    JSON.stringify(sim.migrateLibraryEntry(entry)) === JSON.stringify(entry));
}
done();
