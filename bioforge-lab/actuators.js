'use strict';
// Actuators: cells that act on a nerve signal (muscles, bloaters, nettles, snares, spitters), plus cooldown timers and
// the rotting of debris. Pure: no DOM.

const MUSCLE_MIN_SIZE = 0.35;
const MUSCLE_CONTRACTION = 0.55;                          // size lost at full signal and power
const BLOATER_MAX_SIZE = 2;
const BLOATER_SWELL = 0.8;                                // size gained at full signal and power
const SIZE_SNAP_RATE = 16;                                // per second, toward the active size
const SIZE_RELAX_RATE = 4;                                // per second, back to rest
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

// Muscles contract and bloaters swell with their signal; both snap into action and relax slowly.
function updateSize(cell, power, dt) {
  const signal = clamp01(cell.signal);
  let targetSize = 1;
  const resize = cell.type.resize;
  if (resize === 'contract') targetSize = Math.max(MUSCLE_MIN_SIZE, 1 - MUSCLE_CONTRACTION * signal * power);
  else if (resize === 'swell') targetSize = Math.min(BLOATER_MAX_SIZE, 1 + BLOATER_SWELL * signal * power);
  const snapping = resize === 'swell' ? targetSize > cell.size : targetSize < cell.size;
  cell.size += (targetSize - cell.size) * Math.min(1, dt * (snapping ? SIZE_SNAP_RATE : SIZE_RELAX_RATE));
  cell.radius = CELL_RADIUS * cell.size;
}

registerSystem({ name: 'actuators', order: 60, switchable: false, update: updateActuators });
