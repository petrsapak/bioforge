'use strict';
// Live mini tank inside the cell tooltip, running the cell type's example build from TIPS (browser only).

const DEMO_WIDTH = 288;                                   // px
const DEMO_HEIGHT = 190;                                  // px
const DEMO_RESET_TIME = 8;                                // s before the demo restarts
const DEMO_CENTER_PULL = 0.05;                            // share of the offset from the middle closed per frame
let tooltipDemo = null;

// starts the example for a cell type, drawn into canvas
function startDemo(typeName, canvas) {
  const example = TIPS[typeName].example;
  const cells = blueprintFromList(example.cells);
  if (example.budPart) {
    for (const cell of cells) if (CELLS[cell.typeName].growsParts) cell.budPart = example.budPart;
  }
  const world = newTestTank(DEMO_WIDTH, DEMO_HEIGHT);
  const creature = spawn(world, { cells }, DEMO_WIDTH / 2, DEMO_HEIGHT / 2 + 10, 0, 0);
  for (const cell of creature.cells) {
    if (example.startsHurt && example.startsHurt.includes(cell.typeName)) cell.health = cell.maxHealth * 0.1;
    if (example.startsEmpty && example.startsEmpty.includes(cell.typeName)) {
      cell.fluids[FLUID_OXYGEN] = 0;
      cell.fluids[FLUID_ENERGY] = 0;
    }
  }
  if (example.hasDummyEnemy) {                            // a dummy enemy just in front of the creature
    const front = Math.min(...creature.cells.map(cell => cell.y));
    const dummyDesign = { cells: blueprintFromList([[0, 0, 'tissue'], [1, 0, 'tissue'], [0, 1, 'tissue']]) };
    spawn(world, dummyDesign, DEMO_WIDTH / 2, front - 30, 0, 1).aiControlled = false;
  }
  tooltipDemo = { typeName, example, world, creature, time: 0, canvas };
}

function stopDemo() {
  tooltipDemo = null;
}

function runDemo(dt) {
  if (!tooltipDemo) return;
  const { example, world, creature } = tooltipDemo;
  tooltipDemo.time += dt;
  if (tooltipDemo.time > DEMO_RESET_TIME) {
    startDemo(tooltipDemo.typeName, tooltipDemo.canvas);
    return;
  }
  const spaceHeld = !!example.spaceLabel && tooltipDemo.time % 2 > 1;   // Space is held every other second
  step(world, dt, { swimX: 0, swimY: example.swims ? -1 : 0, ability: spaceHeld });
  if (creature.alive) {                                   // keep the creature in the middle of the tank
    for (const cell of world.cells) {
      cell.x += (DEMO_WIDTH / 2 - creature.centerX) * DEMO_CENTER_PULL;
      cell.y += (DEMO_HEIGHT / 2 + 10 - creature.centerY) * DEMO_CENTER_PULL;
    }
  }
  drawDemo(spaceHeld);
}

function drawDemo(spaceHeld) {
  const { typeName, example, world, creature } = tooltipDemo;
  const context = tooltipDemo.canvas.getContext('2d');
  drawWater(context, world, DEMO_WIDTH, DEMO_HEIGHT);
  drawWorld(context, world, example.fluidView || 0);
  // the cell type being explained gets a pulsing dashed ring
  context.strokeStyle = '#fff';
  context.lineWidth = 1.5;
  context.setLineDash([3, 3]);
  context.globalAlpha = 0.55 + 0.45 * Math.sin(tooltipDemo.time * 5);
  for (const cell of creature.cells) {
    if (cell.typeName === typeName) strokeCircle(context, cell.x, cell.y, cell.radius + 3);
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
