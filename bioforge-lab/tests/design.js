// design.js (builder checks, sim only): hex lookup, reach from the nucleus, the limits, and the design warnings
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['pixelToHex', 'isInGrid', 'hexesReachableFromNucleus', 'designWarnings', 'buildCheck',
  'designNeeds', 'nextNeed', 'sugarSupply',
  'hexToPixel', 'hexKey', 'blueprintFromList', 'createNeuron', 'GRID_RADIUS', 'RULES', 'TEMPLATES']);

// a design from [q, r, typeName] cells and [fromQ, fromR, toQ, toR] fibres
const designOf = (cells, fibres = []) => ({
  cells: sim.blueprintFromList(cells),
  fibres: fibres.map(([fromQ, fromR, toQ, toR]) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } })),
});
const warningText = (design, plannedKeys = []) =>
  sim.designWarnings(design, plannedKeys).map(warning => warning.text).join(' | ');

const roundTrips = [[0, 0], [3, -2], [-4, 1], [2, 5]]
  .every(([q, r]) => String(sim.pixelToHex(...sim.hexToPixel(q, r))) === String([q, r]));
check('pixelToHex inverts hexToPixel', roundTrips);
const edge = sim.GRID_RADIUS;
check('isInGrid edge',
  sim.isInGrid(edge, 0) && sim.isInGrid(0, -edge) && !sim.isInGrid(edge + 1, 0) && !sim.isInGrid(edge, 1));

const openHexes = new Set([sim.hexKey(0, 0), sim.hexKey(1, 0), sim.hexKey(2, 0), sim.hexKey(5, 5)]);
const reached = sim.hexesReachableFromNucleus(key => openHexes.has(key));
check('reach follows neighbours, skips islands',
  reached.has(sim.hexKey(2, 0)) && !reached.has(sim.hexKey(5, 5)) && reached.size === 3);

check('bare nucleus: no weapons', /No weapons/.test(warningText(designOf([[0, 0, 'nucleus']]))));
const unsignalled = designOf([[0, 0, 'nucleus'], [1, 0, 'muscle'], [0, 1, 'thorn']]);
check('a muscle without a signal source', /need a nerve signal: a Pacemaker/.test(warningText(unsignalled)));
const eyeAndMuscle = [[0, 0, 'nucleus'], [1, 0, 'muscle'], [0, 1, 'thorn'], [-1, 0, 'eyespot']];
check('a muscle with a source but no fibre from it',
  /get no fibre from a signal source/.test(warningText(designOf(eyeAndMuscle))));
check('a chain of fibres from the source counts (through the Nucleus)',
  !/signal/.test(warningText(designOf(eyeAndMuscle, [[-1, 0, 0, 0], [0, 0, 1, 0]]))));
const pacedCells = sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'muscle'], [0, 1, 'tissue']]);
pacedCells[2].neuron = sim.createNeuron('pacemaker');
const paced = { cells: pacedCells, fibres: [{ from: { q: 0, r: 1 }, to: { q: 1, r: 0 } }] };
check('a Pacemaker neuron is a signal source', !/signal/.test(warningText(paced)), warningText(paced));
const heldOnCells = sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'photophore'], [0, 1, 'calmgland']]);
heldOnCells[1].neuron = sim.createNeuron('inhibitor');
heldOnCells[2].neuron = sim.createNeuron('inhibitor');
const heldOn = { cells: heldOnCells, fibres: [] };
check('a cell holding an Inhibitor with nothing wired in is on, so it needs no fibre',
  !/signal/.test(warningText(heldOn)), warningText(heldOn));
const unfed = warningText(designOf([[0, 0, 'nucleus'], [1, 0, 'cilia'], [0, 1, 'thorn']]));
check('fuel burner without gill, food or pore',
  /No Gill/.test(unfed) && /No Mouth or Fat/.test(unfed) && /No Pore/.test(unfed), unfed);
const withPlanned = sim.designWarnings(designOf([[0, 0, 'nucleus'], [0, 1, 'thorn']]), [sim.hexKey(4, 4)]);
check('planned cells reported with their keys',
  withPlanned.some(warning => /planned cell/.test(warning.text) && warning.keys[0] === sim.hexKey(4, 4)));

{ // the Needs card: a row per need, 'none' until the body needs it; the first missing one is the next to fix
  const needStates = design => sim.designNeeds(design, sim.designWarnings(design, []))
    .map(row => row.need + ' ' + row.state).join(', ');
  const bare = designOf([[0, 0, 'nucleus']]);
  check('a bare Nucleus needs nothing yet and has no weapon', needStates(bare) ===
    'signal none, oxygen none, sugar none, waste none, blood none, weapon none', needStates(bare));
  const muscle = designOf([[0, 0, 'nucleus'], [1, 0, 'muscle']]);
  check('a Muscle needs a signal, O2, sugar and a waste exit',
    /signal missing, oxygen missing, sugar missing, waste missing/.test(needStates(muscle)), needStates(muscle));
  const muscleRows = sim.designNeeds(muscle, sim.designWarnings(muscle, []));
  check('the next thing to fix is the signal', /need a nerve signal/.test(sim.nextNeed(muscleRows)));
  check('a Bud adds a Buds row', /buds missing/.test(needStates(designOf([[0, 0, 'nucleus'], [1, 0, 'bud']]))));
  const jet = sim.TEMPLATES.jet;
  check('the Jet has every need met', needStates(jet) ===
    'signal ok, oxygen ok, sugar ok, waste ok, blood ok, weapon ok', needStates(jet));
  const supply = sim.sugarSupply(jet);
  check('the Jet\'s sugar lasts a while even with every cell working', supply.burn > 0 && supply.stock / supply.burn > 5,
    JSON.stringify(supply));
}

{ // the nerve limits in RULES
  const cells = sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'tissue'], [2, 0, 'tissue']]);
  const manyNeurons = { cells: cells.map(cell => ({ ...cell, neuron: sim.createNeuron('latch') })), fibres: [] };
  const savedNeuronLimit = sim.RULES.maxNeurons;
  sim.RULES.maxNeurons = 2;
  check('more neurons than RULES.maxNeurons are reported',
    /Too many neurons: 3 \/ 2/.test(sim.buildCheck(manyNeurons)));
  sim.RULES.maxNeurons = savedNeuronLimit;
  const longFibre = { cells, fibres: [{ from: { q: 0, r: 0 }, to: { q: 2, r: 0 } }] };
  const savedUnitLimit = sim.RULES.maxFibreUnits;
  sim.RULES.maxFibreUnits = 1;
  check('more fibre units than RULES.maxFibreUnits are reported',
    /Too many fibre units: 2 \/ 1/.test(sim.buildCheck(longFibre)), sim.buildCheck(longFibre));
  sim.RULES.maxFibreUnits = savedUnitLimit;
}

// the note about cells far from a pumped vessel is only a hint; anything else (such as a Heart on no vessel) means a
// broken hero
const seriousWarnings = design =>
  sim.designWarnings(design, [])
    .filter(warning => !/vessel with a Heart on it/.test(warning.text))
    .map(warning => warning.text)
    .join(' | ');
for (const name of ['lancer', 'stinger', 'spitter', 'snarer']) {
  const design = sim.TEMPLATES[name];
  check(name + ' has no warnings and fits the limits', seriousWarnings(design) === '' && !sim.buildCheck(design),
    seriousWarnings(design) + ' ' + sim.buildCheck(design));
}
done();
