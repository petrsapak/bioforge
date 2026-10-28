'use strict';
// Nerve system: signal sources, and signal charge spreading between touching nerve-conducting cells. Pure: no DOM.

const NERVE_CONDUCTANCE = 25;                             // charge flow per unit of signal difference, per second
const SIGNAL_LEAK = 0.4;                                  // share of its signal a cell loses per second
const NERVE_SUBSTEPS = 4;                                 // nerve steps per game step
const PACEMAKER_HZ = 1.4;                                 // pacemaker on/off cycles per second
const EYESPOT_RANGE = 120;                                // px from an eyespot to an enemy cell it notices
const SIGNAL_ON = 0.5;                                    // signal level above which on/off cells count as on

// What a signal source cell puts out now (0 or 1).
function signalSourceOutput(world, cell) {
  const creature = cell.creature;
  const source = cell.type.signalSource;
  if (cell.budParent) return 0;                           // sources in a growing Bud part wait for its release
  if (source === 'pulse') return sine(TAU * PACEMAKER_HZ * world.time) > 0 ? 1 : 0;
  if (creature.debris && !creature.launchedPart) return 0;
  if (source === 'key') return commandOutput(world, cell);
  if (world.spaceFiresAllSources) return creature.abilityHeld ? 1 : 0;
  return enemyNear(world, cell) ? 1 : 0;
}

// A bound Command fires on its number key for the player; unbound ones, the AI and the test tank use Space (ability).
function commandOutput(world, cell) {
  const creature = cell.creature;
  const keyHeld = !!cell.boundKey && !!creature.heldKeys && creature.heldKeys.has(cell.boundKey);
  const playerBound = cell.boundKey && !creature.aiControlled && !creature.autopilot && !world.spaceFiresAllSources;
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

// Signal charge flows between touching conducting cells; sources hold their output.
// A growing Bud part has its own nerves, apart from the body's.
function updateNerves(world, dt) {
  for (const cell of world.cells) {
    if (cell.type.signalSource) cell.sourceOutput = signalSourceOutput(world, cell);
  }
  const substep = dt / NERVE_SUBSTEPS;
  for (let i = 0; i < NERVE_SUBSTEPS; i++) {
    for (const cell of world.cells) {
      cell.signalInflow = 0;
      if (cell.type.signalSource) cell.signal = cell.sourceOutput;
    }
    for (const bond of world.bonds) {
      const { first, second } = bond;
      if (!first.type.conductsSignal || !second.type.conductsSignal || first.budParent !== second.budParent) continue;
      const current = NERVE_CONDUCTANCE * (second.signal - first.signal);
      first.signalInflow += current;
      second.signalInflow -= current;
    }
    for (const cell of world.cells) {
      if (!cell.type.conductsSignal || cell.type.signalSource) continue;
      const charging = cell.signalInflow / (cell.type.signalCapacity || 1);
      cell.signal += (charging - SIGNAL_LEAK * cell.signal) * substep;
    }
  }
}

registerSystem({ name: 'nerve', order: 40, switchable: true, update: updateNerves });
