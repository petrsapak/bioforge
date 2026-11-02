'use strict';
// Actuators: cells that act on a nerve signal (muscles, bloaters, nettles, snares, spitters), plus cooldown timers and
// the rotting of debris. Pure: no DOM.

const MUSCLE_MIN_SIZE = 0.25;                             // share of full size a muscle never shrinks below
const MUSCLE_CONTRACTION = 0.7;                           // size lost at full signal and power
const BLOATER_MAX_SIZE = 2;                               // times full size a bloater never swells past
const BLOATER_SWELL = 0.8;                                // size gained at full signal and power
const SIZE_SNAP_RATE = 16;                                // per second, toward the active size
const SIZE_RELAX_RATE = 4;                                // per second, back to rest: a newly grown cell filling out
const MUSCLE_RELAX_RATE = 16;                             // per second; a muscle lets go as fast as it snaps
const MUSCLE_HOLD_WINDOW = 1;                             // game s; held pull: the weakest over this and the last one
const BLOATER_RELAX_RATE = 6;                             // per second; a bloater lets go slower than it swells
const MIN_FIRING_EFFICIENCY = 0.3;                        // a weapon needs this share of its fuel to fire
const DEBRIS_ROT_RATE = 6;                                // health per second lost by unfueled debris

// What a nerve signal fires, by the cell type's `trigger` behaviour (data/cells.js).
// ready: signalled, fed enough, off cooldown and part of a creature that can act.
const TRIGGERS = {
  nettle: (world, cell, ready, power) => {
    if (ready) fireNettle(world, cell, power);
  },
  snare: (world, cell, ready, power, dt) => {
    if (cell.snareLine) updateSnareLine(world, cell, dt);
    else if (ready) launchSnare(world, cell);
  },
  spit: (world, cell, ready, power) => {
    if (ready) spitGlob(world, cell, power);
  },
};

// Cooldowns, size changes, weapons firing on their signal, and the rotting of debris.
function updateActuators(world, dt) {
  for (const cell of world.cells) {
    cell.cooldown -= dt;
    cell.hitFlash = Math.max(0, cell.hitFlash - dt);
    const power = cell.efficiency * cell.adrenalineBoost;
    updateSize(cell, power, dt, world.time);
    const canAct = !cell.creature.debris || cell.creature.launchedPart;
    const ready = cell.signal > SIGNAL_ON && cell.efficiency > MIN_FIRING_EFFICIENCY && cell.cooldown <= 0 && canAct;
    const trigger = TRIGGERS[cell.type.trigger];
    if (trigger) trigger(world, cell, ready, power, dt);
    if (cell.creature.debris && !cell.creature.fueled) cell.health -= DEBRIS_ROT_RATE * dt;
  }
}

const RELAX_RATES = { contract: MUSCLE_RELAX_RATE, swell: BLOATER_RELAX_RATE };   // by the cell type's resize

// Muscles contract and bloaters swell with their signal. Both snap into action. A muscle lets go as fast, so a tail
// can beat; a bloater a little slower, so its quick swell pushes more water than its return (the Manta swims on it),
// yet quick enough to let go of the rock it is wedged against (Crevice). They act on the share of the game step
// their signal was on (nerve.js): a game step holds 4 nerve steps, so reading only the last one would give one half
// of a beat an extra game step.
function updateSize(cell, power, dt, time) {
  const signal = cell.stepSignal;
  let targetSize = 1;
  const resize = cell.type.resize;
  if (resize === 'contract') {
    targetSize = Math.max(MUSCLE_MIN_SIZE, 1 - MUSCLE_CONTRACTION * musclePull(cell, power, time));
  } else if (resize === 'swell') {
    targetSize = Math.min(BLOATER_MAX_SIZE, 1 + BLOATER_SWELL * signal * power);
  }
  const snapping = resize === 'swell' ? targetSize > cell.size : targetSize < cell.size;
  const relaxRate = RELAX_RATES[resize] || SIZE_RELAX_RATE;
  const rate = (snapping ? SIZE_SNAP_RATE : relaxRate) * cell.resizeRateFactor;   // tanned cells are slower
  cell.size += (targetSize - cell.size) * Math.min(1, dt * rate);
  cell.radius = CELL_RADIUS * cell.size;
}

// How hard a muscle pulls now: by the square root of its signal, so a weak signal still pulls (a quarter signal at
// half strength), times its power. Also keeps its held pull for pullImbalance: the weakest it pulled in this hold
// window and the one before (MUSCLE_HOLD_WINDOW, counted in game time), so a muscle that lets go on every beat holds
// nothing, and one kept partly shut holds that much. time: the world's game s.
function musclePull(cell, power, time) {
  const pull = Math.sqrt(cell.stepSignal) * power;
  const windowIndex = Math.floor(time / MUSCLE_HOLD_WINDOW);
  if (windowIndex !== cell.holdWindow) {
    cell.weakestPullBefore = windowIndex === cell.holdWindow + 1 ? cell.weakestPull : 0;
    cell.weakestPull = pull;
    cell.holdWindow = windowIndex;
  }
  cell.weakestPull = Math.min(cell.weakestPull, pull);
  cell.heldPull = Math.min(cell.weakestPull, cell.weakestPullBefore);
  return pull;
}

// How much harder the right side's muscles hold than the left side's (heldPull), from -1 (only the left holds) to 1
// (only the right): a creature turns toward the side held shut (physics.js), so two eyes each holding their own side's
// muscles partly shut steer it. A tail beating on a Pacemaker lets go every beat and holds nothing, so it swims
// straight. Sides are left and right of the Nucleus's column in the design; muscles on that column count for neither.
function pullImbalance(creature) {
  let left = 0;
  let right = 0;
  let count = 0;
  for (const cell of creature.cells) {
    if (cell.type.resize !== 'contract') continue;
    const side = cell.q + cell.r / 2;
    if (side === 0) continue;
    count++;
    if (side < 0) left += cell.heldPull;
    else right += cell.heldPull;
  }
  return count ? 2 * (right - left) / count : 0;
}

registerSystem({ name: 'actuators', order: 60, switchable: false, update: updateActuators });
