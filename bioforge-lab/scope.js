'use strict';
// The neuron scope in the side panel: an animated trace of what a neuron makes of a made-up input, run through the
// real neuron rules (NEURON_RULES in nerve.js), so the picture always matches the sim (browser only).

const SCOPE_SECONDS = 6;                                  // s of trace shown across the scope
const SCOPE_STEP = 1 / 60;                                // s per scope sample
const SCOPE_LABEL_WIDTH = 34;                             // px (canvas units) left of the traces for the lane names
const SCOPE_INPUT_COLOR = '#8a96a3';

// Made-up inputs per neuron kind, as functions of time (s) giving 0 or 1. Each list entry is one input lane.
const SCOPE_INPUTS = {
  pacemaker: [],
  command: [{ label: 'key', signal: time => (time % 3 < 1.2 ? 1 : 0) }],
  ganglion: [{ label: 'in', signal: time => (time % 4 < 2 ? 1 : 0) }],
  inhibitor: [{ label: 'in', signal: time => (time % 2.4 < 1.2 ? 1 : 0) }],
  synapse: [
    { label: 'in A', signal: time => (time % 2 < 1 ? 1 : 0) },
    { label: 'in B', signal: time => (time % 3 < 1.5 ? 1 : 0) },
  ],
  latch: [{ label: 'in', signal: time => (time % 1.5 < 0.25 ? 1 : 0) }],
  delay: [{ label: 'in', signal: time => (time % 3 < 0.8 ? 1 : 0) }],
};

function createScope() {
  return { kind: null, neuron: null, cell: null, world: null, history: [], leftover: 0 };
}

// Shows this neuron ({ kind, setting }, or null to hide the scope). A new kind starts the trace over; a new setting
// carries on, so changing it shows its effect at once.
function showScopeNeuron(scope, neuron) {
  byId('neuron-scope').style.display = neuron ? 'block' : 'none';
  if (!neuron) {
    scope.kind = null;
    return;
  }
  if (neuron.kind !== scope.kind) {
    scope.kind = neuron.kind;
    scope.history = [];
    scope.world = { time: 0, spaceFiresAllSources: true };
    scope.cell = {
      neuron: { ...neuron },
      signal: 0,
      neuronMemory: 0,
      delayLine: null,
      boundKey: null,
      creature: { abilityHeld: false, heldKeys: null, aiControlled: false },
    };
  }
  scope.cell.neuron.setting = neuron.setting;
}

// advances the scope's neuron by dt in fixed steps and redraws it
function runScope(scope, dt) {
  if (!scope.kind) return;
  const inputs = SCOPE_INPUTS[scope.kind] || SCOPE_INPUTS.inhibitor;
  const maxSamples = Math.round(SCOPE_SECONDS / SCOPE_STEP);
  scope.leftover += dt;
  while (scope.leftover >= SCOPE_STEP) {
    scope.leftover -= SCOPE_STEP;
    scope.world.time += SCOPE_STEP;
    const values = inputs.map(input => input.signal(scope.world.time));
    const sum = values.reduce((total, value) => total + value, 0);
    scope.cell.creature.abilityHeld = sum > 0;               // a Command reads its key, not its fibres
    scope.cell.signal = NEURON_RULES[scope.kind](scope.cell, sum, scope.world, SCOPE_STEP);
    scope.history.push({ values, output: scope.cell.signal });
    if (scope.history.length > maxSamples) scope.history.shift();
  }
  drawScope(byId('neuron-scope'), scope, inputs);
}

// one lane per input, then the output lane in the neuron's colour, scrolling to the left
function drawScope(canvas, scope, inputs) {
  const context = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const laneCount = inputs.length + 1;
  const laneHeight = height / laneCount;
  context.clearRect(0, 0, width, height);
  context.font = 'bold 22px system-ui';
  context.textBaseline = 'middle';
  inputs.forEach((input, i) => {
    drawScopeLane(context, scope.history.map(sample => sample.values[i]), i * laneHeight, laneHeight, width,
      SCOPE_INPUT_COLOR, input.label);
  });
  drawScopeLane(context, scope.history.map(sample => sample.output), inputs.length * laneHeight, laneHeight, width,
    NEURONS[scope.kind].color, 'out');
  context.textBaseline = 'alphabetic';
}

// a trace of 0..1 values filling a lane, newest on the right, with its name on the left
function drawScopeLane(context, values, top, laneHeight, width, color, label) {
  const traceWidth = width - SCOPE_LABEL_WIDTH * 2;
  const sampleWidth = traceWidth / Math.round(SCOPE_SECONDS / SCOPE_STEP);
  const startX = width - values.length * sampleWidth;
  const bottom = top + laneHeight - 8;
  const highest = top + 10;
  context.fillStyle = color;
  context.textAlign = 'left';
  context.fillText(label, 4, top + laneHeight / 2);
  context.strokeStyle = '#ffffff14';
  context.lineWidth = 2;
  strokeLine(context, SCOPE_LABEL_WIDTH * 2, bottom, width, bottom);
  if (!values.length) return;
  context.beginPath();
  context.moveTo(startX, bottom);
  values.forEach((value, i) => context.lineTo(startX + i * sampleWidth, bottom - (bottom - highest) * value));
  context.lineTo(width, bottom);
  context.closePath();
  context.globalAlpha = 0.25;
  context.fillStyle = color;
  context.fill();
  context.globalAlpha = 1;
  context.beginPath();
  values.forEach((value, i) => context.lineTo(startX + i * sampleWidth, bottom - (bottom - highest) * value));
  context.strokeStyle = color;
  context.lineWidth = 3;
  context.stroke();
}
