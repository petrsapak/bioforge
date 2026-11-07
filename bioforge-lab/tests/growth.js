'use strict';
// Growth (sim only): a Bud's part leaves stocked with the body's fuel and swims; growing takes the kit's leftover
// protein and waits when it runs out; a Mender regrows a lost cell from it; hunters chase launched parts with fuel.
const { load } = require('./load');
const { check, done } = require('./check');

const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'createNeuron', 'FLUID_SUGAR',
  'CELLS', 'nearestEnemy']);
const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const SYSTEMS = ['nerve', 'fluid', 'vascular', 'metabolism', 'food', 'regrow', 'secretions'];
const STEP = 1 / 60;                                      // game s

// a part that swims on its own: a Pacemaker in Tissue pulsing a Siphon behind it, and a Fat
const SWIMMER_PART = { name: 'swimmer', cells: [cell(0, 0, 'tissue', { neuron: sim.createNeuron('pacemaker') }),
  cell(0, 1, 'siphon'), cell(1, 0, 'fat')], fibres: [fibre(0, 0, 0, 1)] };
// a body with a Bud at the front, fired by the Nucleus's Pacemaker, and a Fat, a Gill and a Pore
const budBody = part => ({ cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') }),
  cell(0, -1, 'bud', { budPart: part, partRotation: 0 }), cell(1, 0, 'fat'), cell(-1, 0, 'gill'), cell(0, 1, 'pore')],
fibres: [fibre(0, 0, 0, -1)] });

// spawns a design in an empty world; protein: the creature's leftover protein, or null for none kept
function spawnAlone(design, protein = null) {
  const world = sim.newWorld(1400, 800, { systems: SYSTEMS, seed: 1 });
  const creature = sim.spawn(world, design, 700, 400, 0, 0);
  creature.autonomous = true;
  creature.protein = protein;
  return { world, creature };
}
const runFor = (world, seconds) => {
  for (let i = 0; i < seconds / STEP; i++) sim.step(world, STEP, {});
};
const sugarIn = cells => cells.reduce((sum, bodyCell) => sum + bodyCell.fluids[sim.FLUID_SUGAR], 0);

// ---------- A launched part carries fuel ----------
{
  const { world, creature } = spawnAlone(budBody(SWIMMER_PART));
  let part = null;
  let launchX = 0;
  let launchY = 0;
  for (let i = 0; i < 20 / STEP && !part; i++) {
    sim.step(world, STEP, {});
    part = world.creatures.find(other => other.launchedPart) || null;
    if (part) [launchX, launchY] = [part.centerX, part.centerY];
  }
  check('a Bud launches its finished part', !!part);
  const sugarShare = sugarIn(part.cells) / sugarIn([...part.cells, ...creature.cells]);
  check('the part leaves stocked with its share of the body\'s sugar (about 0.1 sugar before 2026-11-07)',
    sugarIn(part.cells) > 2 && sugarShare > 0.2, `${sugarIn(part.cells).toFixed(2)} sugar, share ${sugarShare}`);
  runFor(world, 10);
  const travelled = Math.hypot(part.centerX - launchX, part.centerY - launchY);
  check('and swims on its own, still fueled', part.fueled && travelled > 60, `${travelled.toFixed(0)} px`);
}

// ---------- Growing costs protein ----------
{
  const partProtein = SWIMMER_PART.cells.reduce((sum, partCell) => sum + sim.CELLS[partCell.typeName].recipe.protein,
    0);
  const { world, creature } = spawnAlone(budBody(SWIMMER_PART), partProtein + 1);
  runFor(world, 30);
  const launched = world.creatures.filter(other => other.launchedPart).length;
  const bud = creature.cells.find(bodyCell => bodyCell.type.growsParts);
  check('with protein for one part, the Bud sends one part and waits', launched === 1 &&
    bud.budGrowth.waitingForProtein && creature.protein >= 0 && creature.protein < partProtein,
  `${launched} launched, ${creature.protein} protein left`);
  const burnedBefore = bud.fluids[sim.FLUID_SUGAR];
  runFor(world, 2);
  check('a Bud waiting for protein does no work', bud.fluids[sim.FLUID_SUGAR] >= burnedBefore - 0.05);
  const free = spawnAlone(budBody(SWIMMER_PART));
  runFor(free.world, 30);
  check('without a kit\'s protein to spend, growing costs none',
    free.world.creatures.filter(other => other.launchedPart).length > 2);
}

// ---------- A Mender regrows from protein ----------
{
  const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const design = { cells: [cell(0, 0, 'nucleus'), ...ring.map(([q, r], i) => cell(q, r, i < 2 ? 'mender' : 'tissue')),
    cell(2, -1, 'tissue')], fibres: [] };
  const regrows = protein => {
    const { world, creature } = spawnAlone(design, protein);
    runFor(world, 3);
    creature.cells.find(bodyCell => bodyCell.q === 2 && bodyCell.r === -1).health = -1;
    runFor(world, 10);
    return { regrown: creature.cells.some(bodyCell => bodyCell.q === 2 && bodyCell.r === -1 && !bodyCell.dead),
      protein: creature.protein };
  };
  const paid = regrows(5);
  check('a Mender regrows a lost Tissue cell, paying its 1 protein', paid.regrown && paid.protein === 4,
    JSON.stringify(paid));
  check('with no protein left, nothing regrows', !regrows(0).regrown);
}

// ---------- Hunters chase launched parts ----------
{
  const { world, creature } = spawnAlone(budBody(SWIMMER_PART));
  const hunter = sim.spawn(world, { cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'mouth')], fibres: [] }, 700, 700, 0, 1);
  let part = null;
  for (let i = 0; i < 20 / STEP && !part; i++) {
    sim.step(world, STEP, {});
    part = world.creatures.find(other => other.launchedPart) || null;
  }
  sim.step(world, STEP, {});                              // the fluid system marks the new part fueled
  // the part 50 px from the hunter at the bottom, the creature 300 px (nearestEnemy goes by centres)
  part.centerX = 700;
  part.centerY = 650;
  check('a hunter goes for a fueled launched part nearer to it than the creature', part.fueled &&
    sim.nearestEnemy(world, hunter).target === part);
  part.fueled = false;
  check('but not for one out of fuel', sim.nearestEnemy(world, hunter).target === creature);
}
done();
