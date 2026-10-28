'use strict';
// Neuron types (pure data): the logic that sits inside a body cell, one per cell, on the nerve layer. A trial set
// (PLAN.md, milestone 1): any of them can be cut after playing. What each one does is in nerve.js (NEURON_RULES).
// Field meanings:
//   name, symbol, color, description: what the editor shows
//   setting: a number the player can change, { name, unit, start, step, min, max }, or null
//   ignoresInputs: the neuron makes its own signal and doesn't read its fibres
// A design cell holds its neuron as { kind, setting }.

function neuronType(definition) {
  return { setting: null, ignoresInputs: false, ...definition };
}

const NEURONS = {
  pacemaker: neuronType({
    name: 'Pacemaker', symbol: '~', color: '#f2e35b', ignoresInputs: true,
    setting: { name: 'Rate', unit: 'Hz', start: 1.4, step: 0.2, min: 0.2, max: 4 },
    description: 'Turns on and off by itself, at its rate.',
  }),
  command: neuronType({
    name: 'Command', symbol: 'K', color: '#f29b38', ignoresInputs: true,
    description: 'On while its key is held: Space, or a key of your own (click the cell, then press a letter or ' +
      'number). The AI presses it when close to an enemy.',
  }),
  ganglion: neuronType({
    name: 'Ganglion', symbol: '≈', color: '#c78f3c',
    description: 'Follows its input slowly. Use it to smooth a signal.',
  }),
  delay: neuronType({
    name: 'Delay', symbol: '»', color: '#7fd18b',
    setting: { name: 'Delay', unit: 's', start: 0.5, step: 0.25, min: 0.25, max: 3 },
    description: 'Passes its input on unchanged, but late by its delay. Use it to make one side act after the ' +
      'other, or to keep going for a moment after a sense goes quiet.',
  }),
  inhibitor: neuronType({
    name: 'Inhibitor', symbol: '¬', color: '#9a86e0',
    description: 'NOT: on while its input is off, off while its input is on.',
  }),
  synapse: neuronType({
    name: 'Synapse', symbol: '≥', color: '#6fc3e0',
    setting: { name: 'Threshold', unit: '', start: 1, step: 0.5, min: 0.5, max: 4 },
    description: 'On while the sum of its inputs reaches its threshold. Threshold 1 is OR; with two inputs, ' +
      'threshold 2 is AND.',
  }),
  latch: neuronType({
    name: 'Latch', symbol: '◐', color: '#e07ab8',
    description: 'Memory: each new pulse on its input flips it on or off.',
  }),
};

// a new neuron of this kind for a design cell, with its setting at the start value
function createNeuron(kind) {
  const setting = NEURONS[kind].setting;
  return setting ? { kind, setting: setting.start } : { kind };
}
