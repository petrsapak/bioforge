'use strict';
// Live mini tank inside the cell and neuron tooltips and the field guide, running the example build from TIPS or
// NEURON_TIPS (createExampleRun in fieldguide.js), with the signal lanes under a neuron's example (browser only).

const DEMO_WIDTH = EXAMPLE_TANK_WIDTH;                    // px
const DEMO_HEIGHT = EXAMPLE_TANK_HEIGHT;                  // px
const DEMO_RESET_TIME = 12;                               // s before the demo restarts
const DEMO_LANE_HEIGHT = 20;                              // px per signal lane under a neuron's example
// what the corner label says while the example's stimulus is on and off
const DEMO_STIMULUS_LABELS = {
  enemy: ['● Enemy near', '○ No enemy'],
  key: ['● Space held', '○ Space released'],
};
let tooltipDemo = null;

// starts the example for a cell type, drawn into canvas, with the cells of that type ringed; options.showsLens
// draws the hormone lens over it
function startDemo(typeName, canvas, options = {}) {
  startExample(TIPS[typeName].example, cell => cell.typeName === typeName, canvas, null, options);
}

// starts the example for a neuron kind, drawn into canvas, with its cells ringed and the example's traces drawn
// into tracesCanvas
function startNeuronDemo(kind, canvas, tracesCanvas, options = {}) {
  const isShown = cell => !!cell.neuron && cell.neuron.kind === kind;
  startExample(NEURON_TIPS[kind].example, isShown, canvas, tracesCanvas, options);
}

// Starts the example in a fresh test tank. isShown picks the cells the tooltip is about; tracesCanvas (or null)
// gets a lane per cell in example.traces. options: { showsLens }, kept when the example restarts.
function startExample(example, isShown, canvas, tracesCanvas, options = {}) {
  const run = createExampleRun(example);
  const probes = createProbes();
  probes.creature = run.creature;
  const tracedCells = (example.traces || []).map(([q, r]) => run.creature.cellsByHex.get(hexKey(q, r)));
  probes.lanes = tracedCells.filter(Boolean).map((cell, i) => createDemoLane(cell, i + 1));
  tooltipDemo = { example, isShown, run, canvas, tracesCanvas, probes, options };
}

// A signal lane for the example. A neuron's lane is named and coloured by the neuron ("1 Pacemaker") instead of the
// cell type it sits in.
function createDemoLane(cell, number) {
  const lane = createProbeLane(cell, number);
  if (!cell.neuron) return lane;
  const neuronType = NEURONS[cell.neuron.kind];
  lane.label = `${number} ${neuronType.name}`;
  lane.color = neuronType.color;
  return lane;
}

// stops the running example (the tooltip closed)
function stopDemo() {
  tooltipDemo = null;
}

// moves the running example on by dt, restarting it every DEMO_RESET_TIME, and draws it
function runDemo(dt) {
  if (!tooltipDemo) return;
  const { example, run } = tooltipDemo;
  if (run.time > DEMO_RESET_TIME) {
    const { isShown, canvas, tracesCanvas, options } = tooltipDemo;
    startExample(example, isShown, canvas, tracesCanvas, options);
    return;
  }
  stepExampleRun(run, dt);
  recordProbes(tooltipDemo.probes, run.world);
  drawDemo();
  if (tooltipDemo.tracesCanvas) {
    drawProbeLanes(tooltipDemo.tracesCanvas, tooltipDemo.probes, run.world.time, DEMO_LANE_HEIGHT);
  }
}

// draws the example tank: the world round the creature, its light, a ring on the cells the tooltip is about, and
// the labels
function drawDemo() {
  const { example, isShown, run, options } = tooltipDemo;
  const { world, creature } = run;
  const context = tooltipDemo.canvas.getContext('2d');
  drawWater(context, world, DEMO_WIDTH, DEMO_HEIGHT, run.cameraX, run.cameraY);
  context.save();
  context.translate(Math.round(DEMO_WIDTH / 2 - run.cameraX), Math.round(DEMO_HEIGHT / 2 - run.cameraY));
  drawLight(context, world.light, false);
  drawWorld(context, world, example.fluidView || 0);
  if (!example.fluidView) drawWorldFibres(context, world);
  if (options.showsLens) drawChemicalLens(context, world);
  // the cell type or neuron being explained gets a pulsing dashed ring
  context.strokeStyle = '#fff';
  context.lineWidth = 1.5;
  context.setLineDash([3, 3]);
  context.globalAlpha = 0.55 + 0.45 * Math.sin(run.time * 5);
  for (const cell of creature.cells) {
    if (isShown(cell)) strokeCircle(context, cell.x, cell.y, cell.radius + 3);
  }
  context.setLineDash([]);
  context.globalAlpha = 1;
  context.restore();
  context.font = '11px system-ui';
  const labels = DEMO_STIMULUS_LABELS[example.stimulus];
  if (labels) {
    const isOn = isExampleStimulusOn(run);
    context.textAlign = 'left';
    context.fillStyle = isOn ? '#e8c547' : '#6f7b88';
    context.fillText(isOn ? labels[0] : labels[1], 6, 14);
  }
  if (example.fluidView) {
    context.textAlign = 'right';
    context.fillStyle = FLUIDS[example.fluidView - 1].color;
    context.fillText(`${FLUIDS[example.fluidView - 1].name} view`, DEMO_WIDTH - 6, 14);
  }
}
