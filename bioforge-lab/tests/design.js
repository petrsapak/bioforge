// design.js (builder checks, sim only): hex lookup, reach from the nucleus, and the design warnings
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['pixelToHex', 'isInGrid', 'hexesReachableFromNucleus', 'designWarnings', 'hexToPixel',
  'hexKey', 'blueprintFromList', 'GRID_RADIUS', 'TEMPLATES']);

const warningText = (bodyCells, plannedKeys = []) =>
  sim.designWarnings(bodyCells, plannedKeys).map(warning => warning.text).join(' | ');

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

check('bare nucleus: no weapons', /No weapons/.test(warningText(sim.blueprintFromList([[0, 0, 'nucleus']]))));
const unsignalled = sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'muscle'], [0, 1, 'thorn']]);
check('muscle without a signal source', /need a nerve signal source/.test(warningText(unsignalled)));
const unfed = warningText(sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'cilia'], [0, 1, 'thorn']]));
check('fuel burner without gill, food or pore',
  /No Gill/.test(unfed) && /No Mouth or Fat/.test(unfed) && /No Pore/.test(unfed), unfed);
const withPlanned = sim.designWarnings(sim.blueprintFromList([[0, 0, 'nucleus'], [0, 1, 'thorn']]), [sim.hexKey(4, 4)]);
check('planned cells reported with their keys',
  withPlanned.some(warning => /planned cell/.test(warning.text) && warning.keys[0] === sim.hexKey(4, 4)));
// the Heart-distance note is only a hint (the Stinger has one such cell); anything else means a broken hero
const seriousWarnings = cells =>
  sim.designWarnings(cells, [])
    .filter(warning => !/from a Heart/.test(warning.text))
    .map(warning => warning.text)
    .join(' | ');
for (const name of ['lancer', 'stinger', 'spitter', 'snarer']) {
  const warnings = seriousWarnings(sim.TEMPLATES[name].cells);
  check(name + ' has no warnings', warnings === '', warnings);
}
done();
