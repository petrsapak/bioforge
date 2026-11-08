'use strict';
// The tooltip examples (data/tips.js), run as their demos run them (createExampleRun in fieldguide.js): each is a
// valid build in the current format, none pilots the creature with a Command but the Command's own, and each shows
// what its tip says: the explained cell works, eyes and noses reach what they sense, a neuron turns on and off.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['TIPS', 'NEURON_TIPS', 'CELLS', 'NEURONS', 'createExampleRun', 'stepExampleRun',
  'hexKey']);

const STEP = 1 / 60;                                      // game s per step, as a demo at 60 frames a second
const RUN_TIME = 12;                                      // game s: a demo's run before it starts again
const MOST_TURNING = 1;                                   // rad a still or straight-swimming example may turn in a run

// runs the example for a demo's run and returns what happened: the run, how far the shown cells' signals reached,
// whether any Muscle pulled, and how far the creature turned in all (rad)
function runExample(example, isShown) {
  const run = sim.createExampleRun(example);
  const shown = run.creature.cells.filter(isShown);
  let highest = 0;
  let lowest = 1;
  let turned = 0;
  let musclesWorked = false;
  let lastHeading = run.creature.heading;
  for (let time = 0; time < RUN_TIME; time += STEP) {
    sim.stepExampleRun(run, STEP);
    for (const cell of shown) {
      highest = Math.max(highest, cell.signal);
      if (time > 1) lowest = Math.min(lowest, cell.signal);
    }
    musclesWorked = musclesWorked || run.creature.cells.some(cell => cell.typeName === 'muscle' && cell.signal > 0.5);
    const change = run.creature.heading - lastHeading;
    turned += Math.abs(Math.atan2(Math.sin(change), Math.cos(change)));
    lastHeading = run.creature.heading;
  }
  return { run, shown, highest, lowest, turned, musclesWorked };
}

const allTips = [...Object.entries(sim.TIPS), ...Object.entries(sim.NEURON_TIPS)];

// ---------- Every example is a valid build ----------
check('every cell type has a tooltip example', Object.keys(sim.CELLS).every(typeName => sim.TIPS[typeName]));
check('every neuron has a tooltip example', Object.keys(sim.NEURONS).every(kind => sim.NEURON_TIPS[kind]));
const badBuilds = allTips.filter(([, tip]) => {
  const hexes = new Set(tip.example.cells.map(([q, r]) => sim.hexKey(q, r)));
  const isKnown = ([, , typeName, neuronKind]) => sim.CELLS[typeName] && (!neuronKind || sim.NEURONS[neuronKind]);
  const fibresLand = (tip.example.fibres || []).every(([fromQ, fromR, toQ, toR]) =>
    hexes.has(sim.hexKey(fromQ, fromR)) && hexes.has(sim.hexKey(toQ, toR)));
  const nucleusCount = tip.example.cells.filter(([, , typeName]) => typeName === 'nucleus').length;
  return hexes.size !== tip.example.cells.length || !tip.example.cells.every(isKnown) || !fibresLand ||
    nucleusCount !== 1;
}).map(([name]) => name);
check('every example has one Nucleus, known cells and neurons, one cell per hex, and fibres between its cells',
  badBuilds.length === 0, badBuilds.join(', '));
// the player programs and watches: only the Command's own example presses a key
const piloted = allTips.filter(([name, tip]) => name !== 'command' &&
  (tip.example.stimulus === 'key' || tip.example.cells.some(([, , , neuronKind]) => neuronKind === 'command')))
  .map(([name]) => name);
check('no example but the Command\'s uses a Command or a key', piloted.length === 0, piloted.join(', '));

// ---------- Cell examples show what their tips say ----------
const cellResults = {};
for (const typeName of Object.keys(sim.TIPS)) {
  cellResults[typeName] = runExample(sim.TIPS[typeName].example, cell => cell.typeName === typeName);
}
const idleWorkers = Object.entries(cellResults)
  .filter(([typeName, result]) => (sim.CELLS[typeName].needsSignal || sim.CELLS[typeName].senses) &&
    result.highest <= 0.5)
  .map(([typeName]) => typeName);
check('every example signals its cell when the cell needs a signal or is a sense', idleWorkers.length === 0,
  idleWorkers.join(', '));
for (const typeName of ['lighteye', 'nose']) {
  const { run } = cellResults[typeName];
  // the first target is placed at the start, and each one reached places the next
  check(`the ${sim.CELLS[typeName].name} example turns to its target and reaches it, again and again`,
    run.targetCount >= 3, `targets placed ${run.targetCount}`);
}
// (the Bloater's is left out: swelling against the enemy rocks the body back and forth, about 1.2 rad in all, without
// turning it round)
const spinners = ['nucleus', 'shell', 'cilia', 'thorn', 'siphon', 'tissue']
  .filter(typeName => cellResults[typeName].turned > MOST_TURNING);
check(`still or straight examples turn less than ${MOST_TURNING} rad in a run`, spinners.length === 0,
  spinners.map(typeName => `${typeName} ${cellResults[typeName].turned.toFixed(1)}`).join(', '));
const travelled = typeName => {
  const { creature } = cellResults[typeName].run;
  const start = cellResults[typeName].run.world.width / 2;
  return Math.hypot(creature.centerX - start, creature.centerY - start);
};
check('the Cilia, Thorn and Siphon examples swim', ['cilia', 'thorn', 'siphon'].every(name => travelled(name) > 100),
  ['cilia', 'thorn', 'siphon'].map(name => `${name} ${travelled(name).toFixed(0)} px`).join(', '));
check('the Mineralizer example hardens cells',
  cellResults.mineralizer.run.creature.cells.some(cell => cell.mineralized));

// ---------- Neuron examples ----------
for (const kind of Object.keys(sim.NEURONS)) {
  const example = sim.NEURON_TIPS[kind].example;
  const result = runExample(example, cell => !!cell.neuron && cell.neuron.kind === kind);
  const tracesFound = example.traces.every(([q, r]) => result.run.creature.cellsByHex.get(sim.hexKey(q, r)));
  check(`the ${kind} example turns its neuron on and off, works its Muscles and traces its cells`,
    result.highest > 0.8 && result.lowest < 0.2 && result.musclesWorked && example.traces.length >= 2 && tracesFound,
    `highest ${result.highest.toFixed(2)}, lowest ${result.lowest.toFixed(2)}`);
  // the Inhibitor's sides take turns, so its tail swims and may turn; the rest pull both sides alike
  if (kind === 'inhibitor') continue;
  check(`the ${kind} example's body doesn't turn`, result.turned < MOST_TURNING, `${result.turned.toFixed(1)} rad`);
}

done();
