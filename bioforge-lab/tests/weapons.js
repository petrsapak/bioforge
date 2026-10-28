// Snare and Spitter: an eyespot build facing a dummy, sim only. The builds are written by touch, as before the nerve
// layer, and converted to fibres (upgradeToNerveLayer).
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'blueprintFromList', 'upgradeToNerveLayer']);

const DUMMY_DESIGN = [[0, 0, 'nucleus'], [1, 0, 'tissue'], [0, 1, 'tissue'], [-1, 1, 'tissue']];
const NO_INPUT = { swimX: 0, swimY: 0, ability: false };
// gill, fat and pore keep the weapon fueled
const SUPPORT_CELLS = [[-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'pore']];

// the player's build at the middle, and a passive dummy `gap` px in front of it
function createArena(cells, gap) {
  const world = sim.newWorld(2000, 2000);
  const design = sim.upgradeToNerveLayer({ cells: sim.blueprintFromList(cells) });
  const player = sim.spawn(world, design, 1000, 1000, 0, 0);
  player.aiControlled = false;
  const front = Math.min(...player.cells.map(cell => cell.y));
  const dummy = sim.spawn(world, { cells: sim.blueprintFromList(DUMMY_DESIGN) }, 1000, front - gap, 0, 1);
  dummy.aiControlled = false;
  return { world, player, dummy };
}
const totalHealth = creature => creature.cells.reduce((sum, cell) => sum + cell.health, 0);
const centerDistance = (first, second) => Math.hypot(second.centerX - first.centerX, second.centerY - first.centerY);

{ // Snare: catches the dummy and drags it closer
  const design = [[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'snare'], ...SUPPORT_CELLS];
  const { world, player, dummy } = createArena(design, 110);
  const snare = player.cells.find(cell => cell.typeName === 'snare');
  const startDistance = centerDistance(player, dummy);
  let caught = false;
  let closestDistance = startDistance;
  for (let i = 0; i < 120; i++) {
    sim.step(world, 1 / 60, NO_INPUT);
    if (snare.snareLine && snare.snareLine.target) caught = true;
    if (dummy.alive) closestDistance = Math.min(closestDistance, centerDistance(player, dummy));
  }
  check('snare catches dummy', caught);
  check('snare drags dummy in', closestDistance < startDistance - 40,
    `start ${startDistance.toFixed(0)} closest ${closestDistance.toFixed(0)}`);
  check('no NaN (snare)', world.cells.every(cell => isFinite(cell.x) && isFinite(cell.y)));
}
{ // Spitter: hits the dummy from range
  const design = [[0, 0, 'nucleus'], [0, -1, 'eyespot'], [1, -1, 'spitter'], ...SUPPORT_CELLS];
  const { world, player, dummy } = createArena(design, 100);
  const startHealth = totalHealth(dummy);
  let mostGlobs = 0;
  for (let i = 0; i < 180; i++) {
    sim.step(world, 1 / 60, NO_INPUT);
    mostGlobs = Math.max(mostGlobs, world.globs.length);
  }
  check('spitter fires globs', mostGlobs > 0);
  check('globs damage dummy', !dummy.alive || totalHealth(dummy) < startHealth - 10,
    `health ${startHealth} -> ${dummy.alive ? totalHealth(dummy).toFixed(0) : 'dead'}`);
  check('own cells unhurt', player.cells.every(cell => cell.health >= cell.maxHealth - 1e-6));
}
done();
