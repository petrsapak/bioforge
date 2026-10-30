'use strict';
// System switches (data/rules.js): every switchable system can be turned off and the sim still runs; off means off.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'newTestTank', 'spawn', 'step', 'RULES', 'TEMPLATES', 'blueprintFromList',
  'FLUID_OXYGEN', 'FLUID_SUGAR', 'SIGNAL_ON', 'stepInPieces', 'createNeuron', 'linksFromList']);

const totalOxygen = creature => creature.cells.reduce((sum, cell) => sum + cell.fluids[sim.FLUID_OXYGEN], 0);

// a pacemaker wiggler, run for 10 game s with no steering; returns what happened
function runWiggler(systemNames) {
  const world = sim.newWorld(1500, 1500, { systems: systemNames });
  const creature = sim.spawn(world, sim.TEMPLATES.wiggler, 750, 750, 0, 0);
  creature.aiControlled = false;
  const startOxygen = totalOxygen(creature);
  let signalFired = false;
  let positionsFinite = true;
  for (let i = 0; i < 400; i++) {
    sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: false });
    if (creature.cells.some(cell => cell.signal > sim.SIGNAL_ON)) signalFired = true;
    if (creature.cells.some(cell => !isFinite(cell.x) || !isFinite(cell.y))) positionsFinite = false;
  }
  return { world, creature, signalFired, positionsFinite, startOxygen, endOxygen: totalOxygen(creature) };
}
const allSystemsExcept = name => sim.RULES.systems.filter(other => other !== name);

const allOn = runWiggler();
check('defaults are RULES.systems', [...sim.newWorld(10, 10).systems].join() === sim.RULES.systems.join());
check('all on: nerves fire, fluids change',
  allOn.signalFired && allOn.endOxygen !== allOn.startOxygen && allOn.positionsFinite);
for (const name of sim.RULES.systems) {
  const run = runWiggler(allSystemsExcept(name));
  check(`${name} off: runs, stays finite`, run.positionsFinite && run.creature.alive);
}
check('nerve off: nothing fires', !runWiggler(allSystemsExcept('nerve')).signalFired);
const noFluid = runWiggler(allSystemsExcept('fluid'));
const fullPower = noFluid.creature.cells.every(cell => cell.efficiency === 1);
check('fluid off: no O2 change, cells at full power, nerves still fire',
  noFluid.endOxygen === noFluid.startOxygen && fullPower && noFluid.signalFired);
check('food off: no food specks', runWiggler(allSystemsExcept('food')).world.food.length === 0);
const samePositions = (first, second) =>
  first.creature.cells.every((cell, i) => {
    const other = second.creature.cells[i];
    return cell.x === other.x && cell.y === other.y;
  });
check('deterministic: same design, same result', samePositions(runWiggler(), runWiggler()));

{ // the test tank (builder preview, tooltip demos): no food, Mouths fed by the water, Space fires every signal source
  const tank = sim.newTestTank(600, 600);
  const design = { cells: sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'eyespot'], [0, 1, 'mouth']]) };
  const creature = sim.spawn(tank, design, 300, 300, 0, 0);
  const cellOfType = typeName => creature.cells.find(cell => cell.typeName === typeName);
  cellOfType('mouth').fluids[sim.FLUID_SUGAR] = 0;
  sim.step(tank, 1 / 40, { swimX: 0, swimY: 0, ability: true });
  check('test tank: food system off', !tank.systems.has('food'));
  check('test tank: the water feeds Mouths', cellOfType('mouth').fluids[sim.FLUID_SUGAR] > 0);
  check('test tank: Space fires an Eyespot with no enemy near', cellOfType('eyespot').signal === 1);
  const world = sim.newWorld(600, 600);
  const sameCreature = sim.spawn(world, design, 300, 300, 0, 0);
  sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: true });
  check('normal world: Space does not fire an Eyespot',
    sameCreature.cells.find(cell => cell.typeName === 'eyespot').signal === 0);
}

{ // a slow frame (20 fps, 0.05 s) in the builder's tank: two Muscles beside each other contracting at once blew the
  // body apart in one long step (NaN by 0.25 s, 2026-10-30); split into short steps it stays whole
  const cells = sim.blueprintFromList([[0, 0, 'nucleus'], [1, 0, 'heart'], [2, 0, 'tissue'], [3, 0, 'muscle'],
    [3, -1, 'muscle'], [-1, 0, 'fat'], [1, -1, 'gill']]);
  cells[0].neuron = sim.createNeuron('pacemaker');
  const design = { cells, fibres: sim.linksFromList([[0, 0, 3, 0], [0, 0, 3, -1]]) };
  const world = sim.newTestTank(900, 600);
  sim.spawn(world, design, 450, 300, 0, 0);
  for (let i = 0; i < 200; i++) sim.stepInPieces(world, 0.05, { swimX: 0, swimY: 0, ability: false });
  check('slow frames split into short steps keep a muscled body whole',
    world.cells.every(cell => Number.isFinite(cell.x) && Math.abs(cell.x - 450) < 200));
}
done();
