'use strict';
// Terrain: rock boxes fill with hex tiles on the cells' grid, only edges facing water count, cells are pushed out of
// rock and held by it the harder they press, and a current carries what floats in it.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createTerrain', 'blueprintFromList', 'hexToPixel',
  'HEX_SPACING_X', 'CELL_RADIUS']);

const STEPS_PER_SECOND = 40;                              // game steps per game s

// a world with this terrain and nothing switched on but the nerves
const worldWith = terrain => sim.newWorld(1000, 1000, { systems: ['nerve'], seed: 1, terrain });
// steps the world for this many game s
function runFor(world, seconds) {
  for (let i = 0; i < seconds * STEPS_PER_SECOND; i++) sim.step(world, 1 / STEPS_PER_SECOND, { ability: false });
}
// a creature of these [q, r, type] cells, holding still on its own wiring
function spawnStill(world, list, x, y) {
  const creature = sim.spawn(world, { cells: sim.blueprintFromList(list) }, x, y, 0, 0);
  creature.autonomous = true;
  return creature;
}

// a box 100 px wide and one row high holds the hexes whose centres are inside it, and only their outside edges count
{
  const terrain = sim.createTerrain([{ x: 0, y: -1, width: 100, height: 2 }]);
  const centres = terrain.tiles.map(([q, r]) => sim.hexToPixel(q, r)[0]);
  check('a box fills with the grid hexes whose centres lie inside it', centres.join() === '0,20,40,60,80,100',
    centres.join());
  check('only edges facing the water count: 4 each along the row, 1 more at each end',
    terrain.edges.length === 6 * 4 + 2, `${terrain.edges.length} edges`);
}

// a cell sunk halfway into a slab of rock is pushed out, and drifts off a little way with the push (there is no
// gravity to hold it on the rock)
{
  const terrain = sim.createTerrain([{ x: 0, y: 500, width: 1000, height: 500 }]);
  const topRowY = Math.min(...terrain.tiles.map(([q, r]) => sim.hexToPixel(q, r)[1]));
  const tipsY = topRowY - 2 * sim.CELL_RADIUS / Math.sqrt(3);    // px: the hexes' upper corners
  const world = worldWith(terrain);
  const creature = spawnStill(world, [[0, 0, 'nucleus']], 500, tipsY);
  runFor(world, 1);
  const clearance = tipsY - creature.centerY;
  check('a cell sunk into rock is pushed out of it, and not flung away', clearance > 0 &&
    clearance < 3 * sim.CELL_RADIUS, clearance.toFixed(1) + ' px above the corners');
}

// a current carries a floating body along at about its speed
{
  const current = { x: 0, y: 0, width: 1000, height: 1000, flowX: 30, flowY: 0 };
  const world = worldWith(sim.createTerrain([], [current]));
  const creature = spawnStill(world, [[0, 0, 'nucleus'], [1, 0, 'tissue'], [-1, 0, 'tissue']], 300, 500);
  runFor(world, 2);
  const startX = creature.centerX;
  runFor(world, 4);
  const speed = (creature.centerX - startX) / 4;
  check('a body floating in a current drifts with it at about its speed', speed > 25 && speed <= 30.5,
    speed.toFixed(1) + ' px/s');
}

// Rock grips the harder it is pressed: in a crevice with a current, a row of two cells slides out of a crevice three
// hex rows high, but is squeezed between the walls of one a single row high and stays put.
function driftInCrevice(gapRows) {
  const rowHeight = sim.CELL_RADIUS * Math.sqrt(3);         // px between hex rows
  const middleRow = 29;
  const middle = middleRow * rowHeight;
  const top = middle - (gapRows + 1) / 2 * rowHeight + 1;   // px: just below the last rock row above
  const bottom = middle + (gapRows + 1) / 2 * rowHeight - 1;
  const rocks = [{ x: 0, y: top - 200, width: 1000, height: 200 }, { x: 0, y: bottom, width: 1000, height: 200 }];
  const current = { x: 0, y: top, width: 1000, height: bottom - top, flowX: -30, flowY: 0 };
  const world = worldWith(sim.createTerrain(rocks, [current]));
  const creature = spawnStill(world, [[0, 0, 'nucleus'], [1, 0, 'tissue']], 500, middle);
  runFor(world, 0.5);
  const startX = creature.centerX;
  runFor(world, 4);
  return startX - creature.centerX;
}
const loose = driftInCrevice(3);
const wedged = driftInCrevice(1);
check('a body that fits the crevice is carried out by the current', loose > 60, loose.toFixed(0) + ' px');
check('a body pressed against both walls is held by the rock', wedged < 5, wedged.toFixed(1) + ' px');
done();
