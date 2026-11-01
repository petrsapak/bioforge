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
    updateSize(cell, power, dt);
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
function updateSize(cell, power, dt) {
  const signal = cell.stepSignal;
  let targetSize = 1;
  const resize = cell.type.resize;
  if (resize === 'contract') targetSize = Math.max(MUSCLE_MIN_SIZE, 1 - MUSCLE_CONTRACTION * signal * power);
  else if (resize === 'swell') targetSize = Math.min(BLOATER_MAX_SIZE, 1 + BLOATER_SWELL * signal * power);
  const snapping = resize === 'swell' ? targetSize > cell.size : targetSize < cell.size;
  const relaxRate = RELAX_RATES[resize] || SIZE_RELAX_RATE;
  const rate = (snapping ? SIZE_SNAP_RATE : relaxRate) * cell.resizeRateFactor;   // tanned cells are slower
  cell.size += (targetSize - cell.size) * Math.min(1, dt * rate);
  cell.radius = CELL_RADIUS * cell.size;
}

registerSystem({ name: 'actuators', order: 60, switchable: false, update: updateActuators });
