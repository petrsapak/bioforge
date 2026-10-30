'use strict';
// Secretions and Mineral (milestone 5): acid against hard and soft cells, protease feeding its gland, the
// Mineralizer hardening cells, mineral specks, a kit's mineral, and the system switched off. Sim only: the glands are
// held signalled by hand, with the nerve and fluid systems off, so every gland works at full power.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'newTestTank', 'spawn', 'step', 'createDesignCell', 'damageCell', 'isHardCell',
  'kitReserves', 'stockReserves', 'exampleCells', 'linksFromList', 'TIPS', 'FLUID_SUGAR', 'CELLS',
  'ACID_HARD_DAMAGE', 'ACID_SOFT_DAMAGE', 'PROTEASE_DAMAGE', 'MINERALIZE_TIME', 'MINERALIZER_CAPACITY']);

const cell = (q, r, typeName) => sim.createDesignCell(q, r, typeName);
const noInput = { swimX: 0, swimY: 0, ability: false };
const STEP = 1 / 40;                                      // game s per step

// a gland creature facing a dummy of dummyType cells just touching its front, both held in place
function glandArena(glandType, dummyType, systems = ['secretions']) {
  const world = sim.newWorld(600, 600, { systems });
  const player = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(0, -1, glandType)] }, 300, 300, 0, 0);
  const gland = player.cells[1];
  const dummy = sim.spawn(world, { cells: [cell(0, 0, dummyType)] }, gland.x, gland.y - 22, 0, 1);
  for (const creature of [player, dummy]) {
    creature.aiControlled = false;
    creature.autonomous = true;
  }
  return { world, player, gland, target: dummy.cells[0] };
}

// runs the arena for some game seconds with the gland signalled; returns the health the target lost
function runSignalled(arena, seconds) {
  const startHealth = arena.target.health;
  for (let i = 0; i < seconds / STEP; i++) {
    arena.gland.signal = 1;
    sim.step(arena.world, STEP, noInput);
  }
  return startHealth - arena.target.health;
}

// ---------- Hard cells ----------
check('Shell and Thorn are hard, built with mineral; Tissue is soft',
  sim.isHardCell({ type: sim.CELLS.shell }) && sim.isHardCell({ type: sim.CELLS.thorn }) &&
  !sim.isHardCell({ type: sim.CELLS.tissue }));
check('Shell and Thorn cost as much biomass as before (2 and 3), so budget levels are unchanged',
  sim.CELLS.shell.cost === 2 && sim.CELLS.thorn.cost === 3);

// ---------- Acid ----------
const acidOnShell = runSignalled(glandArena('acid', 'shell'), 1);
const acidOnTissue = runSignalled(glandArena('acid', 'tissue'), 1);
check('acid eats a touching Shell fast (half its rate, through the armour)',
  Math.abs(acidOnShell - sim.ACID_HARD_DAMAGE * sim.CELLS.shell.damageFactor) < 1, acidOnShell.toFixed(2));
check('acid eats a touching Tissue only slowly', Math.abs(acidOnTissue - sim.ACID_SOFT_DAMAGE) < 0.2,
  acidOnTissue.toFixed(2));
{
  const arena = glandArena('acid', 'shell');
  check('acid without a signal does nothing', (() => {
    for (let i = 0; i < 40; i++) sim.step(arena.world, STEP, noInput);
    return arena.target.health === arena.target.maxHealth;
  })());
  runSignalled(arena, 1);
  check('acid never hurts its own creature', arena.player.cells.every(own => own.health === own.maxHealth));
}

// ---------- Protease ----------
{
  const arena = glandArena('protease', 'tissue');
  arena.gland.fluids[sim.FLUID_SUGAR] = 0;
  const lost = runSignalled(arena, 1);
  check('protease digests a touching soft cell', Math.abs(lost - sim.PROTEASE_DAMAGE) < 0.5, lost.toFixed(2));
  check('and its gland takes in sugar from it', arena.gland.fluids[sim.FLUID_SUGAR] > 0.5,
    arena.gland.fluids[sim.FLUID_SUGAR].toFixed(2));
}
check('protease can\'t touch a hard cell', runSignalled(glandArena('protease', 'shell'), 1) === 0);

// ---------- Mineralizer ----------
{
  const world = sim.newWorld(600, 600, { systems: ['secretions'] });
  const design = { cells: [cell(0, 0, 'nucleus'), cell(1, 0, 'mineralizer'), cell(2, 0, 'tissue'),
    cell(3, 0, 'tissue'), cell(4, 0, 'tissue')] };
  const creature = sim.spawn(world, design, 300, 300, 0, 0);
  creature.aiControlled = false;
  const mineralizer = creature.cells[1];
  mineralizer.mineral = 2;
  const steps = Math.round(2.5 * sim.MINERALIZE_TIME / STEP);
  for (let i = 0; i < steps; i++) {
    mineralizer.signal = 1;
    sim.step(world, STEP, noInput);
  }
  const hardened = creature.cells.filter(own => own.mineralized).map(own => own.q);
  check('a signalled Mineralizer hardens one cell per mineral, nearest first (itself, then its neighbours)',
    hardened.length === 2 && mineralizer.mineral === 0 && mineralizer.mineralized, hardened.join());
  check('it reaches no farther than two hexes', !creature.cells[4].mineralized);
  const tissue = creature.cells.find(own => own.mineralized && own.typeName !== 'mineralizer');
  const health = tissue.health;
  sim.damageCell(tissue, 10);
  check('a hardened cell takes half damage, and counts as hard', health - tissue.health === 5 &&
    sim.isHardCell(tissue));
}

// ---------- Mineral specks and kits ----------
{
  const world = sim.newWorld(600, 600, { systems: ['food'], foodSupply: { maxCount: 0, interval: 1, specks: [],
    startCount: 0, nearLight: 0, until: 0, mineralSpecks: [] } });
  const creature = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'mouth'), cell(1, 0, 'mineralizer')] },
    300, 300, 0, 0);
  creature.aiControlled = false;
  const mineralizer = creature.cells[2];
  world.food.push({ x: creature.cells[1].x, y: creature.cells[1].y, mineral: true });
  sim.step(world, STEP, noInput);
  check('a mineral speck touching the body goes into the Mineralizer, not the Mouth',
    mineralizer.mineral === 1 && creature.mineralEaten === 1 && creature.foodEaten === 0 && !world.food.length);
  mineralizer.mineral = sim.MINERALIZER_CAPACITY;
  world.food.push({ x: creature.cells[1].x, y: creature.cells[1].y, mineral: true });
  sim.step(world, STEP, noInput);
  check('a full Mineralizer leaves mineral specks alone', world.food.length === 1);
}
{
  const world = sim.newWorld(600, 600, { systems: ['food'] });
  const creature = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'shell')] }, 300, 300, 0, 0);
  creature.aiControlled = false;
  creature.cells[1].health = 0;
  sim.step(world, STEP, noInput);
  check('a broken Shell leaves a mineral speck', world.food.filter(speck => speck.mineral).length === 1);
}
{
  const design = { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'shell'), cell(1, 0, 'mineralizer')] };
  const reserves = sim.kitReserves(design, { protein: 10, mineral: 5 });
  check('a kit\'s leftover mineral becomes a reserve', reserves.mineral === 4, JSON.stringify(reserves));
  const world = sim.newWorld(600, 600);
  const creature = sim.spawn(world, design, 300, 300, 0, 0);
  sim.stockReserves(creature, reserves);
  check('and goes into the Mineralizers', creature.cells[2].mineral === 4);
}

// ---------- Tooltip examples ----------
// each gland's example (data/tips.js) wires the gland, so it fires in the builder's test tank
for (const typeName of ['acid', 'protease', 'mineralizer']) {
  const example = sim.TIPS[typeName].example;
  const world = sim.newTestTank(288, 190);
  const design = { cells: sim.exampleCells(example), fibres: sim.linksFromList(example.fibres || []) };
  const creature = sim.spawn(world, design, 144, 100, 0, 0);
  if (example.hasDummyEnemy) sim.spawn(world, { cells: [cell(0, 0, 'tissue')] }, 144, 40, 0, 1);
  const gland = creature.cells.find(own => own.typeName === typeName);
  let fired = false;
  for (let i = 0; i < 160; i++) {
    sim.step(world, STEP, { swimX: 0, swimY: 0, ability: i % 80 > 40 });
    fired = fired || gland.signal > 0.5;
  }
  check(`the ${typeName} tooltip example fires its gland`, fired);
}

// ---------- Switched off ----------
check('secretions off: acid does nothing', runSignalled(glandArena('acid', 'shell', []), 1) === 0);
done();
