'use strict';
// Live mini tank inside the cell and neuron tooltips and the field guide, running the example build from TIPS or
// NEURON_TIPS, with the signal lanes under a neuron's example (browser only).

const DEMO_WIDTH = 288;                                   // px
const DEMO_HEIGHT = 190;                                  // px
const DEMO_RESET_TIME = 8;                                // s before the demo restarts
const DEMO_CENTER_PULL = 0.05;                            // share of the offset from the middle closed per frame
const DEMO_LANE_HEIGHT = 20;                              // px per signal lane under a neuron's example
const DUMMY_GAP = 30;                                     // px from the creature's front to the dummy enemy
const DUMMY_TOUCHING_GAP = 34;                            // px: its nearest cell just within a gland's reach
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

// Spawns the example in a fresh test tank. isShown picks the cells the tooltip is about; tracesCanvas (or null)
// gets a lane per cell in example.traces. options: { showsLens }, kept when the example restarts.
function startExample(example, isShown, canvas, tracesCanvas, options = {}) {
  const design = exampleDesign(example);
  const world = newTestTank(DEMO_WIDTH, DEMO_HEIGHT);
  const creature = spawn(world, design, DEMO_WIDTH / 2, DEMO_HEIGHT / 2 + 10, 0, 0);
  for (const cell of creature.cells) {
    if (example.startsHurt && example.startsHurt.includes(cell.typeName)) cell.health = cell.maxHealth * 0.1;
    if (example.startsEmpty && example.startsEmpty.includes(cell.typeName)) {
      cell.fluids[FLUID_OXYGEN] = 0;
      cell.fluids[FLUID_SUGAR] = 0;
    }
  }
  if (example.hasDummyEnemy) {                            // a dummy enemy just in front of the creature
    const front = Math.min(...creature.cells.map(cell => cell.y));
    const dummyType = example.dummyType || 'tissue';
    const dummyDesign = { cells: blueprintFromList([[0, 0, dummyType], [1, 0, dummyType], [0, 1, dummyType]]) };
    const gap = example.dummyTouches ? DUMMY_TOUCHING_GAP : DUMMY_GAP;
    const dummy = spawn(world, dummyDesign, DEMO_WIDTH / 2, front - gap, 0, 1);
    dummy.aiControlled = false;
    dummy.anchored = !!example.dummyTouches;               // held in place, so the glands keep touching it
  }
  const probes = createProbes();
  probes.creature = creature;
  const tracedCells = (example.traces || []).map(([q, r]) => creature.cellsByHex.get(hexKey(q, r)));
  probes.lanes = tracedCells.filter(Boolean).map((cell, i) => createDemoLane(cell, i + 1));
  tooltipDemo = { example, isShown, world, creature, time: 0, canvas, tracesCanvas, probes, options };
}

// A signal lane for the example. Every neuron in the examples sits in Tissue, so its lane is named and coloured by
// the neuron ("1 Command") instead of the cell type.
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
  const { example, world, creature } = tooltipDemo;
  tooltipDemo.time += dt;
  if (tooltipDemo.time > DEMO_RESET_TIME) {
    const { isShown, canvas, tracesCanvas, options } = tooltipDemo;
    startExample(example, isShown, canvas, tracesCanvas, options);
    return;
  }
  const spaceHeld = !!example.spaceLabel && tooltipDemo.time % 2 > 1;   // Space is held every other second
  stepInPieces(world, dt, { swimX: 0, swimY: example.swims ? -1 : 0, ability: spaceHeld });
  if (creature.alive) {                                   // keep the creature in the middle of the tank
    for (const cell of world.cells) {
      cell.x += (DEMO_WIDTH / 2 - creature.centerX) * DEMO_CENTER_PULL;
      cell.y += (DEMO_HEIGHT / 2 + 10 - creature.centerY) * DEMO_CENTER_PULL;
    }
  }
  recordProbes(tooltipDemo.probes, world);
  drawDemo(spaceHeld);
  if (tooltipDemo.tracesCanvas) {
    drawProbeLanes(tooltipDemo.tracesCanvas, tooltipDemo.probes, world.time, DEMO_LANE_HEIGHT);
  }
}

// draws the example tank: the world, a ring on the cells the tooltip is about, the lane tags and the labels
function drawDemo(spaceHeld) {
  const { example, isShown, world, creature, options } = tooltipDemo;
  const context = tooltipDemo.canvas.getContext('2d');
  drawWater(context, world, DEMO_WIDTH, DEMO_HEIGHT);
  drawWorld(context, world, example.fluidView || 0);
  drawWorldVessels(context, world);
  if (!example.fluidView) drawWorldFibres(context, world);
  if (options.showsLens) drawChemicalLens(context, world);
  // the cell type or neuron being explained gets a pulsing dashed ring
  context.strokeStyle = '#fff';
  context.lineWidth = 1.5;
  context.setLineDash([3, 3]);
  context.globalAlpha = 0.55 + 0.45 * Math.sin(tooltipDemo.time * 5);
  for (const cell of creature.cells) {
    if (isShown(cell)) strokeCircle(context, cell.x, cell.y, cell.radius + 3);
  }
  context.setLineDash([]);
  context.globalAlpha = 1;
  context.font = '11px system-ui';
  if (example.spaceLabel) {
    context.textAlign = 'left';
    context.fillStyle = spaceHeld ? '#e8c547' : '#6f7b88';
    const released = example.spaceLabel === 'Space held' ? '○ Space released' : '○ No enemy';
    context.fillText(spaceHeld ? `● ${example.spaceLabel}` : released, 6, 14);
  }
  if (example.fluidView) {
    context.textAlign = 'right';
    context.fillStyle = FLUIDS[example.fluidView - 1].color;
    context.fillText(`${FLUIDS[example.fluidView - 1].name} view`, DEMO_WIDTH - 6, 14);
  }
}
