'use strict';
// Scent system: hormones in the water. The water is a grid of patches, each holding some of every hormone. A cell
// gives off a scent of the hormones it holds into the patch it is in, without losing them (so the slow moods last as
// long as before), and takes in a hormone whose patch holds more of it than the cell does. A creature so leaves its
// moods in the water around it, and takes in what other creatures left there: a cloud of an enemy's Calm calms it
// too. The clouds spread from patch to patch and fade. Pure: no DOM.

const SCENT_PATCH_SIZE = 40;                              // px: the side of one water patch
const SCENT_GIVE_OFF_RATE = 4;                            // share of the gap up to a cell's fill its patch gains per s
const SCENT_TAKE_IN_RATE = 0.4;                           // share of the gap up to its patch a cell takes in per s
const SCENT_PATCH_VOLUME = 6;                             // cells' worth of water in a patch: what a cell takes in, the
                                                          // patch loses a sixth of
const SCENT_SPREAD_RATE = 1;                              // share of the gap to each neighbouring patch closed per s
const SCENT_FADE_FACTOR = 2;                              // a hormone fades this many times faster in the water
const SCENT_EMPTY = 1e-6;                                 // fill below which a patch counts as clean

// The hormones the water carries: every chemical fluid's index in FLUIDS.
const SCENT_FLUIDS = FLUIDS.map((fluid, index) => (fluid.layer === 'chemical' ? index : -1))
  .filter(index => index >= 0);

// The water's hormone grid for an arena width × height px: levels[fluid] holds one fill (0..1, like a cell's) per
// patch, row by row; spare is reused while spreading, so a step makes no new arrays.
function createScentField(width, height) {
  const columns = Math.max(1, Math.ceil(width / SCENT_PATCH_SIZE));
  const rows = Math.max(1, Math.ceil(height / SCENT_PATCH_SIZE));
  const levels = {};
  for (const fluid of SCENT_FLUIDS) levels[fluid] = new Array(columns * rows).fill(0);
  return { columns, rows, levels, spare: new Array(columns * rows).fill(0) };
}

// the index of the patch a point lies in; points outside the arena count as in the nearest edge patch
function scentPatchAt(field, x, y) {
  const column = Math.min(field.columns - 1, Math.max(0, Math.floor(x / SCENT_PATCH_SIZE)));
  const row = Math.min(field.rows - 1, Math.max(0, Math.floor(y / SCENT_PATCH_SIZE)));
  return row * field.columns + column;
}

// how much of a hormone the water holds at a point, 0..1 (0 where the system has not run)
function scentAt(world, fluid, x, y) {
  const field = world.scent;
  if (!field || !field.levels[fluid]) return 0;
  return field.levels[fluid][scentPatchAt(field, x, y)];
}

// A hormone that no living cell holds and the water is clean of is skipped, so the system costs nothing until some
// creature makes a hormone.
function updateScent(world, stepTime) {
  if (!world.scent) world.scent = createScentField(world.width, world.height);
  const field = world.scent;
  const living = world.cells.filter(cell => !cell.dead && cell.creature);
  let patches = null;                                     // each living cell's patch, found once a step when needed
  for (const fluid of SCENT_FLUIDS) {
    const levels = field.levels[fluid];
    if (!living.some(cell => cell.fluids[fluid] > 0) && !levels.some(level => level > 0)) continue;
    patches = patches || living.map(cell => scentPatchAt(field, cell.x, cell.y));
    tradeWithWater(living, patches, levels, fluid, stepTime);
    spreadScent(field, levels, stepTime);
    fadeScent(levels, FLUIDS[fluid].decayRate * SCENT_FADE_FACTOR, stepTime);
  }
}

// Every living cell trades one hormone with its patch (patches[i]: the patch of living[i]): a cell fuller than its
// patch scents it, raising the patch toward the cell's fill; a patch fuller than the cell gives the cell some, which
// the patch loses.
function tradeWithWater(living, patches, levels, fluid, stepTime) {
  const giveOffShare = Math.min(1, SCENT_GIVE_OFF_RATE * stepTime);
  const takeInShare = Math.min(1, SCENT_TAKE_IN_RATE * stepTime) * SCENT_PATCH_VOLUME / (SCENT_PATCH_VOLUME + 1);
  for (let i = 0; i < living.length; i++) {
    const cell = living[i];
    const capacity = cell.fluidCapacity[fluid];
    if (!capacity) continue;
    const patch = patches[i];
    const cellFill = Math.min(1, cell.fluids[fluid] / capacity);   // a gland can briefly hold more than its room
    const gap = cellFill - levels[patch];
    if (gap > SCENT_EMPTY) {
      levels[patch] += giveOffShare * gap;
    } else if (gap < -SCENT_EMPTY) {
      const taken = -gap * takeInShare;                   // fill, so neither passes the other
      cell.fluids[fluid] += taken * capacity;
      levels[patch] -= taken / SCENT_PATCH_VOLUME;
    }
  }
}

// each patch moves toward its four neighbours (edges are walls, so nothing leaks out of the arena)
function spreadScent(field, levels, stepTime) {
  const { columns, rows, spare } = field;
  const share = Math.min(0.2, SCENT_SPREAD_RATE * stepTime);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const index = row * columns + column;
      const level = levels[index];
      let change = 0;
      if (column > 0) change += levels[index - 1] - level;
      if (column < columns - 1) change += levels[index + 1] - level;
      if (row > 0) change += levels[index - columns] - level;
      if (row < rows - 1) change += levels[index + columns] - level;
      spare[index] = level + share * change;
    }
  }
  for (let i = 0; i < levels.length; i++) levels[i] = spare[i];
}

// the water's hormone fades as it does in cells, faster by SCENT_FADE_FACTOR; traces are wiped
function fadeScent(levels, fadeRate, stepTime) {
  const kept = Math.max(0, 1 - fadeRate * stepTime);
  for (let i = 0; i < levels.length; i++) levels[i] = levels[i] * kept > SCENT_EMPTY ? levels[i] * kept : 0;
}

registerSystem({ name: 'scent', order: 51, switchable: true, update: updateScent });
