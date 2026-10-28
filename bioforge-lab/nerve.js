'use strict';
// Nerve system: signals travel only along fibres (fibres.js), one nerve step per fibre. Every nerve step each cell
// adds up what its incoming fibres deliver, plus its own sense; a plain cell passes the sum on (clamped to 0..1), and
// a cell with a neuron (data/neurons.js) lets the neuron decide its signal. Pure: no DOM.

const NERVE_SUBSTEPS = 4;                                 // nerve steps per game step
const EYESPOT_RANGE = 120;                                // px from an eyespot to an enemy cell it notices
const SIGNAL_ON = 0.5;                                    // signal level above which on/off cells count as on
const GANGLION_RATE = 2;                                  // share of the gap to its input a Ganglion closes per second
const MIN_LIGHT_LENGTH = 0.001;                           // px²; nearer than this a Light eye can't tell a direction
const UNSURE_LIGHT = 0.5;                                 // signal of a Light eye that can't tell where the light is

// What each neuron kind makes of its input sum. The cell's previous signal and neuronMemory are its state.
const NEURON_RULES = {
  pacemaker: (cell, input, world) => (sine(TAU * cell.neuron.setting * world.time) > 0 ? 1 : 0),
  command: (cell, input, world) => commandOutput(world, cell),
  ganglion: (cell, input, world, stepTime) =>
    cell.signal + (clamp01(input) - cell.signal) * Math.min(1, GANGLION_RATE * stepTime),
  inhibitor: (cell, input) => (input > SIGNAL_ON ? 0 : 1),
  synapse: (cell, input) => (input >= cell.neuron.setting ? 1 : 0),
  latch: (cell, input) => {
    const isPulse = input > SIGNAL_ON;
    if (isPulse && !cell.neuronMemory) cell.signal = cell.signal > SIGNAL_ON ? 0 : 1;   // a new pulse flips it
    cell.neuronMemory = isPulse ? 1 : 0;
    return cell.signal;
  },
};

// Cells that can't act yet make no signal of their own: a growing Bud part waits for its launch, and debris that
// isn't a launched part is dead weight.
function canMakeSignals(cell) {
  const creature = cell.creature;
  return !cell.budParent && (!creature.debris || creature.launchedPart);
}

// What each sense feels, from 0 to 1, by the cell type's `senses` behaviour (data/cells.js).
const SENSES = {
  enemy: (world, cell) => (enemyNear(world, cell) ? 1 : 0),
  light: (world, cell) => lightSeen(world, cell),
};

// What a sense organ feels now. In the test tank, Space stands in for every sense.
function senseOutput(world, cell) {
  if (!cell.type.senses || !canMakeSignals(cell)) return 0;
  if (world.spaceFiresAllSources) return cell.creature.abilityHeld ? 1 : 0;
  return SENSES[cell.type.senses](world, cell);
}

// A bound Command fires on its number key for the player; unbound ones, the AI and the test tank use Space (ability).
function commandOutput(world, cell) {
  const creature = cell.creature;
  const keyHeld = !!cell.boundKey && !!creature.heldKeys && creature.heldKeys.has(cell.boundKey);
  const playerBound = cell.boundKey && !creature.aiControlled &&!world.spaceFiresAllSources;
  return (playerBound ? keyHeld : creature.abilityHeld || keyHeld) ? 1 : 0;
}

function enemyNear(world, cell) {
  for (const other of world.creatures) {
    if (other.team === cell.creature.team || other.debris) continue;
    for (const otherCell of other.cells) {
      if (distanceSquared(cell.x, cell.y, otherCell.x, otherCell.y) < EYESPOT_RANGE * EYESPOT_RANGE) return true;
    }
  }
  return false;
}

// Graded by direction: 1 when the light lies straight out from the cell's side of the body, a half when it lies
// square to that side, 0 when it lies straight across the body. So a Light eye on the left sees more of a light on
// the left than its twin on the right does, at any distance.
function lightSeen(world, cell) {
  const light = world.light;
  if (!light) return 0;
  const outwardX = cell.x - cell.creature.centerX;
  const outwardY = cell.y - cell.creature.centerY;
  const towardX = light.x - cell.x;
  const towardY = light.y - cell.y;
  const lengths = vectorLength(outwardX, outwardY) * vectorLength(towardX, towardY);
  if (lengths < MIN_LIGHT_LENGTH) return UNSURE_LIGHT;
  return (1 + (outwardX * towardX + outwardY * towardY) / lengths) / 2;
}

// the signal a cell takes on, given the sum of its fibre inputs and its sense
function decideSignal(world, cell, input, stepTime) {
  const neuron = cell.neuron;
  if (!neuron) return clamp01(input);
  const makesItsOwn = NEURONS[neuron.kind].ignoresInputs;
  if (makesItsOwn && !canMakeSignals(cell)) return 0;
  return NEURON_RULES[neuron.kind](cell, input, world, stepTime);
}

// Each nerve step, every fibre first takes its start cell's signal, then all cells update at once from what arrived:
// so a signal needs one nerve step per fibre, whatever order the cells and fibres are in.
function updateNerves(world, dt) {
  for (const cell of world.cells) cell.senseOutput = senseOutput(world, cell);
  const stepTime = dt / NERVE_SUBSTEPS;
  for (let i = 0; i < NERVE_SUBSTEPS; i++) {
    for (const fibre of world.fibres) fibre.value = fibre.from.signal;
    for (const cell of world.cells) cell.nerveInput = cell.senseOutput;
    for (const fibre of world.fibres) fibre.to.nerveInput += fibre.value;
    for (const cell of world.cells) cell.signal = decideSignal(world, cell, cell.nerveInput, stepTime);
  }
}

registerSystem({ name: 'nerve', order: 40, switchable: true, update: updateNerves });
