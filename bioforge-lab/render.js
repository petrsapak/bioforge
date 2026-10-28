'use strict';
// Canvas drawing of the world: bonds, cells, nerve fibres, snare lines, globs, zaps, food and sparks (browser only).

// bond colour by team: 0 = the player's side, 1 = enemies, -1 = debris
const BOND_COLORS = { 0: '#1f4a3a', 1: '#4a2430', '-1': '#2a2f33' };
const VIEW_MARGIN = 30;                                   // px around the view box in which cells are still drawn
const FIBRE_COLOR = '#f2d36b';
const FIBRE_ACTIVE_COLOR = '#fffbe0';                     // a fibre carrying a signal
const FIBRE_ARROW_SIZE = 3;                               // px
const LIGHT_GLOW_RADIUS = 40;                             // px of the glow drawn around the light
const BRIDGE_RADIUS = 2.6;                               // px of the arc a fibre jumps over a crossing with

// view 0 = normal, 1..5 = fill level of one fluid; viewBox = { minX, minY, maxX, maxY }: draw only cells inside it
function drawWorld(context, world, view, viewBox) {
  const isVisible = viewBox
    ? cell => cell.x > viewBox.minX - VIEW_MARGIN && cell.x < viewBox.maxX + VIEW_MARGIN &&
      cell.y > viewBox.minY - VIEW_MARGIN && cell.y < viewBox.maxY + VIEW_MARGIN
    : () => true;
  context.lineCap = 'round';
  for (const bond of world.bonds) {
    if (!isVisible(bond.first)) continue;
    context.strokeStyle = BOND_COLORS[bond.first.creature.team] || BOND_COLORS[-1];
    context.lineWidth = Math.min(bond.first.radius, bond.second.radius) * 1.6;
    context.beginPath();
    context.moveTo(bond.first.x, bond.first.y);
    context.lineTo(bond.second.x, bond.second.y);
    context.stroke();
  }
  for (const cell of world.cells) {
    if (isVisible(cell)) drawCell(context, cell, view);
  }
  if (!view) drawWorldFibres(context, world);
  drawSnareLines(context, world);
  drawGlobs(context, world);
  drawZaps(context, world);
  drawFood(context, world);
  drawSparks(context, world);
}

function fillCircle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.fill();
}

function strokeCircle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
  context.stroke();
}

function strokeLine(context, fromX, fromY, toX, toY) {
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();
}

// snare lines, with a barb at the tip
function drawSnareLines(context, world) {
  context.strokeStyle = '#e8d2a8';
  context.lineWidth = 1.5;
  for (const cell of world.cells) {
    const line = cell.snareLine;
    if (!line) continue;
    const tipX = line.target ? line.target.x : line.x;
    const tipY = line.target ? line.target.y : line.y;
    strokeLine(context, cell.x, cell.y, tipX, tipY);
    context.fillStyle = cell.type.color;
    fillCircle(context, tipX, tipY, 3);
  }
}

function drawGlobs(context, world) {
  context.fillStyle = CELLS.spitter.color;
  for (const glob of world.globs) fillCircle(context, glob.x, glob.y, 3.5);
}

// nettle stings: a jagged line with a random kink each frame
function drawZaps(context, world) {
  context.strokeStyle = '#cfe9ff';
  context.lineWidth = 2;
  for (const zap of world.zaps) {
    const kinkX = (zap.fromX + zap.toX) / 2 + (Math.random() - 0.5) * 14;
    const kinkY = (zap.fromY + zap.toY) / 2 + (Math.random() - 0.5) * 14;
    context.beginPath();
    context.moveTo(zap.fromX, zap.fromY);
    context.lineTo(kinkX, kinkY);
    context.lineTo(zap.toX, zap.toY);
    context.stroke();
  }
}

function drawFood(context, world) {
  context.fillStyle = '#d8e070';
  for (const speck of world.food) fillCircle(context, speck.x, speck.y, 2.5);
}

function drawSparks(context, world) {
  for (const spark of world.sparks) {
    context.globalAlpha = Math.min(1, spark.lifetime * 3);
    context.fillStyle = spark.color;
    context.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
  }
  context.globalAlpha = 1;
}

// ---------- Nerve fibres ----------
// A fibre as a line through the centres of its cells, brighter while it carries a signal, with an arrow on its last
// step. pointKeys: the hex key of each point; crossings: hex keys where it jumps over another fibre with a small arc;
// alpha and width: how strongly it is drawn.
function drawFibre(context, points, pointKeys, value, crossings = null, alpha = 1, width = 1.3) {
  context.globalAlpha = alpha * (0.6 + 0.4 * clamp01(value));
  context.strokeStyle = value > SIGNAL_ON ? FIBRE_ACTIVE_COLOR : FIBRE_COLOR;
  context.lineWidth = width;
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    if (crossings && i < points.length - 1 && crossings.has(pointKeys[i])) traceBridge(context, points[i - 1], [x, y]);
    context.lineTo(x, y);
  }
  context.stroke();
  drawFibreArrow(context, points[points.length - 2], points[points.length - 1]);
  context.globalAlpha = 1;
}

// a small half circle just before the corner, so the line visibly jumps over the fibre it crosses there
function traceBridge(context, [fromX, fromY], [toX, toY]) {
  const length = vectorLength(toX - fromX, toY - fromY) || 1;
  const directionX = (toX - fromX) / length;
  const directionY = (toY - fromY) / length;
  const startX = toX - directionX * BRIDGE_RADIUS * 2;
  const startY = toY - directionY * BRIDGE_RADIUS * 2;
  context.lineTo(startX, startY);
  const centreX = toX - directionX * BRIDGE_RADIUS;
  const centreY = toY - directionY * BRIDGE_RADIUS;
  const angle = Math.atan2(directionY, directionX);
  context.arc(centreX, centreY, BRIDGE_RADIUS, angle + Math.PI, angle, false);
}

// an arrowhead in the middle of the fibre's last side, pointing toward its end
function drawFibreArrow(context, [fromX, fromY], [toX, toY]) {
  const length = vectorLength(toX - fromX, toY - fromY) || 1;
  const directionX = (toX - fromX) / length;
  const directionY = (toY - fromY) / length;
  const tipX = (fromX + toX) / 2 + directionX * FIBRE_ARROW_SIZE;
  const tipY = (fromY + toY) / 2 + directionY * FIBRE_ARROW_SIZE;
  context.beginPath();
  context.moveTo(tipX - directionX * FIBRE_ARROW_SIZE * 2 - directionY * FIBRE_ARROW_SIZE,
    tipY - directionY * FIBRE_ARROW_SIZE * 2 + directionX * FIBRE_ARROW_SIZE);
  context.lineTo(tipX, tipY);
  context.lineTo(tipX - directionX * FIBRE_ARROW_SIZE * 2 + directionY * FIBRE_ARROW_SIZE,
    tipY - directionY * FIBRE_ARROW_SIZE * 2 - directionX * FIBRE_ARROW_SIZE);
  context.stroke();
}

// the world's fibres, through the moving centres of the cells they run through
function drawWorldFibres(context, world) {
  for (const fibre of world.fibres) {
    const points = fibre.path.map(cell => [cell.x, cell.y]);
    drawFibre(context, points, null, fibre.value, null, 0.6);
  }
}

// ---------- Cells ----------
// One cell: its body, a detail by type, then overlays for key binding, signal, adrenaline, starving, poison and hits.
function drawCell(context, cell, view) {
  const radius = cell.radius * 0.9;
  if (view) {
    drawFluidLevel(context, cell, radius, view - 1);
    return;
  }
  const creature = cell.creature;
  context.globalAlpha = 0.4 + 0.6 * clamp01(cell.health / cell.maxHealth);
  const outward = Math.atan2(cell.y - creature.centerY, cell.x - creature.centerX);   // away from the body centre
  if (cell.typeName === 'thorn') drawThornSpike(context, cell, radius, outward);
  context.fillStyle = cell.type.color;
  fillCircle(context, cell.x, cell.y, radius);
  context.strokeStyle = 'rgba(0,0,0,0.35)';
  context.lineWidth = 1.2;
  context.stroke();
  context.fillStyle = 'rgba(0,0,0,0.35)';
  context.strokeStyle = 'rgba(0,0,0,0.4)';
  const drawDetail = CELL_DETAILS[cell.typeName] || (cell.type.senses ? drawSenseOrganDetail : null);
  if (drawDetail) drawDetail(context, cell, radius, outward);
  drawCellOverlays(context, cell, radius);
  context.globalAlpha = 1;
}

// fluid view: the cell filled by how full it is of one fluid
function drawFluidLevel(context, cell, radius, fluid) {
  context.globalAlpha = 1;
  context.fillStyle = '#1a2328';
  fillCircle(context, cell.x, cell.y, radius);
  context.globalAlpha = 0.1 + 0.9 * clamp01(cell.fluids[fluid] / cell.fluidCapacity[fluid]);
  context.fillStyle = FLUIDS[fluid].color;
  context.fill();
  context.globalAlpha = 1;
  context.strokeStyle = cell.type.color;
  context.lineWidth = 1.5;
  context.stroke();
}

function drawThornSpike(context, cell, radius, outward) {
  const pointAt = (angle, distance) => [cell.x + Math.cos(angle) * distance, cell.y + Math.sin(angle) * distance];
  context.fillStyle = cell.type.color;
  context.beginPath();
  context.moveTo(...pointAt(outward, radius * 1.9));
  context.lineTo(...pointAt(outward + 1.9, radius));
  context.lineTo(...pointAt(outward - 1.9, radius));
  context.closePath();
  context.fill();
}

// a reservoir cell shows how full it is as a disc of the fluid's colour
function drawReservoir(context, cell, radius, fluid) {
  context.fillStyle = FLUIDS[fluid].color;
  const fill = clamp01(cell.fluids[fluid] / cell.fluidCapacity[fluid]);
  fillCircle(context, cell.x, cell.y, radius * 0.75 * Math.sqrt(fill));
}

// a sense organ: a pupil, white while it senses something (an Eyespot, and the range it senses in) or brighter the
// more it senses (a Light eye)
function drawSenseOrganDetail(context, cell, radius) {
  const isGraded = cell.type.senses === 'light';
  const isOn = cell.senseOutput > SIGNAL_ON;
  if (isGraded) context.fillStyle = `rgba(255,255,255,${(0.15 + 0.85 * clamp01(cell.senseOutput)).toFixed(2)})`;
  else context.fillStyle = isOn ? '#fff' : 'rgba(0,0,0,0.45)';
  fillCircle(context, cell.x, cell.y, radius * 0.45);
  if (cell.type.senses !== 'enemy') return;
  context.strokeStyle = 'rgba(79,209,197,0.12)';
  strokeCircle(context, cell.x, cell.y, EYESPOT_RANGE);
}

// the light that Light eyes see (the mouse in the Sandbox): a soft glow
function drawLight(context, light) {
  if (!light) return;
  const glow = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, LIGHT_GLOW_RADIUS);
  glow.addColorStop(0, 'rgba(255,230,150,0.35)');
  glow.addColorStop(1, 'rgba(255,230,150,0)');
  context.fillStyle = glow;
  fillCircle(context, light.x, light.y, LIGHT_GLOW_RADIUS);
  const reach = context.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.range);
  reach.addColorStop(0, 'rgba(255,230,150,0.07)');
  reach.addColorStop(1, 'rgba(255,230,150,0)');
  context.fillStyle = reach;
  fillCircle(context, light.x, light.y, light.range);
  context.strokeStyle = 'rgba(255,230,150,0.15)';
  context.setLineDash([4, 8]);
  context.beginPath();
  context.arc(light.x, light.y, light.range, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
}

// the small drawing inside each cell type: (context, cell, radius, outward angle)
const CELL_DETAILS = {
  nucleus(context, cell, radius) {
    const forwardX = Math.sin(cell.creature.heading);
    const forwardY = -Math.cos(cell.creature.heading);
    context.fillStyle = '#fff';
    fillCircle(context, cell.x + forwardX * radius * 0.3, cell.y + forwardY * radius * 0.3, radius * 0.45);
    context.fillStyle = '#111';
    fillCircle(context, cell.x + forwardX * radius * 0.5, cell.y + forwardY * radius * 0.5, radius * 0.22);
  },
  muscle(context, cell, radius) {
    for (const offset of [-0.4, 0, 0.4]) {
      const y = cell.y + offset * radius;
      strokeLine(context, cell.x - radius * 0.6, y, cell.x + radius * 0.6, y);
    }
  },
  shell(context, cell, radius) {
    strokeCircle(context, cell.x, cell.y, radius * 0.55);
  },
  cilia(context, cell, radius, outward) {
    context.strokeStyle = cell.type.color;
    context.lineWidth = 1;
    for (const offset of [-0.9, -0.3, 0.3, 0.9]) {
      const angle = outward + offset;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const innerX = cell.x + cos * radius;
      const innerY = cell.y + sin * radius;
      strokeLine(context, innerX, innerY, innerX + cos * radius * 0.5, innerY + sin * radius * 0.5);
    }
  },

  // a nozzle at the back, and a puff of water while it squirts
  siphon(context, cell, radius) {
    const backX = -Math.sin(cell.creature.heading);
    const backY = Math.cos(cell.creature.heading);
    context.fillStyle = '#2f6d91';
    fillCircle(context, cell.x + backX * radius * 0.4, cell.y + backY * radius * 0.4, radius * 0.35);
    if (cell.signal <= 0.2 || cell.efficiency <= 0.2) return;
    context.fillStyle = `rgba(160,220,255,${clamp01(cell.signal * cell.efficiency) * 0.7})`;
    const puffRadius = radius * 0.5 * (0.7 + Math.random() * 0.5);
    fillCircle(context, cell.x + backX * radius * 1.6, cell.y + backY * radius * 1.6, puffRadius);
  },
  nettle(context, cell, radius, outward) {
    context.strokeStyle = '#3f5aa0';
    context.lineWidth = 2;
    for (const offset of [0, 2.1, 4.2]) {
      const angle = outward + offset;
      const reach = radius * 0.7;
      strokeLine(context, cell.x, cell.y, cell.x + Math.cos(angle) * reach, cell.y + Math.sin(angle) * reach);
    }
  },
  // a hook pointing out
  snare(context, cell, radius, outward) {
    context.strokeStyle = '#3a2410';
    context.lineWidth = 2;
    const hookX = cell.x + Math.cos(outward) * radius * 0.15;
    const hookY = cell.y + Math.sin(outward) * radius * 0.15;
    context.beginPath();
    context.arc(hookX, hookY, radius * 0.45, outward + 0.6, outward + 0.6 + 4.2);
    context.stroke();
  },
  // a muzzle on the outer side, lit while ready to fire
  spitter(context, cell, radius, outward) {
    context.fillStyle = cell.cooldown <= 0 ? '#2e4a10' : '#1a2208';
    const offset = radius * 0.35;
    fillCircle(context, cell.x + Math.cos(outward) * offset, cell.y + Math.sin(outward) * offset, radius * 0.38);
  },
  gill(context, cell, radius) {
    context.strokeStyle = '#7a2a3a';
    context.lineWidth = 1.5;
    for (const offset of [-0.4, 0, 0.4]) {
      const x = cell.x + offset * radius;
      strokeLine(context, x, cell.y - radius * 0.5, x, cell.y + radius * 0.5);
    }
  },
  mouth(context, cell, radius, outward) {
    context.fillStyle = '#3a1a14';
    context.beginPath();
    context.moveTo(cell.x, cell.y);
    context.arc(cell.x, cell.y, radius * 0.85, outward - 0.6, outward + 0.6);
    context.closePath();
    context.fill();
  },
  // beats while fed
  heart(context, cell, radius) {
    context.fillStyle = '#ff7a8a';
    const beat = Math.max(0, Math.sin(secondsNow() * 8));
    fillCircle(context, cell.x, cell.y, radius * (0.3 + 0.15 * cell.efficiency * beat));
  },
  // two flaps, light when open
  valve(context, cell, radius) {
    context.fillStyle = cell.signal > SIGNAL_ON ? '#e8f4ff' : '#26323a';
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(cell.x + side * radius * 0.6, cell.y - radius * 0.45);
      context.lineTo(cell.x, cell.y);
      context.lineTo(cell.x + side * radius * 0.6, cell.y + radius * 0.45);
      context.closePath();
      context.fill();
    }
  },
  airsac(context, cell, radius) {
    drawReservoir(context, cell, radius, FLUID_OXYGEN);
  },
  fat(context, cell, radius) {
    drawReservoir(context, cell, radius, FLUID_ENERGY);
  },
  pore(context, cell, radius) {
    context.strokeStyle = '#2a2014';
    context.lineWidth = 2;
    strokeCircle(context, cell.x, cell.y, radius * 0.35);
  },
  mender(context, cell, radius) {
    context.fillStyle = '#fff';
    context.fillRect(cell.x - radius * 0.15, cell.y - radius * 0.5, radius * 0.3, radius);
    context.fillRect(cell.x - radius * 0.5, cell.y - radius * 0.15, radius, radius * 0.3);
  },
  adrenal(context, cell, radius) {
    context.fillStyle = '#5a0a30';
    context.beginPath();
    context.moveTo(cell.x, cell.y - radius * 0.55);
    context.lineTo(cell.x + radius * 0.4, cell.y);
    context.lineTo(cell.x, cell.y + radius * 0.55);
    context.lineTo(cell.x - radius * 0.4, cell.y);
    context.closePath();
    context.fill();
  },
  // a seed, with a ring that fills as the part grows (solid white when ready)
  bud(context, cell, radius) {
    const growth = cell.budGrowth;
    const partSize = growth ? growth.plan.cells.length : 0;
    context.fillStyle = growth && growth.done && partSize ? '#fff' : '#4a5a20';
    fillCircle(context, cell.x, cell.y, radius * 0.3);
    if (!partSize) return;
    context.strokeStyle = '#fff';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(cell.x, cell.y, radius * 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * growth.grownCount / partSize);
    context.stroke();
  },
};

function drawCellOverlays(context, cell, radius) {
  if (cell.neuron) drawNeuronBadge(context, cell, radius);
  if (cell.signal > 0.03) {                               // nerve signal glow
    context.globalAlpha = clamp01(cell.signal) * 0.55;
    context.fillStyle = '#fff6a0';
    fillCircle(context, cell.x, cell.y, radius * 0.75);
  }
  if (cell.fluids[FLUID_ADRENALINE] > 0.05) {             // adrenaline rim
    context.globalAlpha = clamp01(cell.fluids[FLUID_ADRENALINE]);
    context.strokeStyle = FLUIDS[FLUID_ADRENALINE].color;
    context.lineWidth = 1.5;
    strokeCircle(context, cell.x, cell.y, radius + 1);
  }
  if (cell.starving) {
    context.globalAlpha = 0.5;
    context.fillStyle = '#000';
    fillCircle(context, cell.x, cell.y, radius);
  }
  if (cell.poisoned) {
    context.globalAlpha = 0.9;
    context.strokeStyle = FLUIDS[FLUID_WASTE].color;
    context.lineWidth = 2;
    context.setLineDash([3, 2]);
    strokeCircle(context, cell.x, cell.y, radius);
    context.setLineDash([]);
  }
  if (cell.hitFlash > 0) {
    context.globalAlpha = Math.min(1, cell.hitFlash * 8);
    context.fillStyle = '#fff';
    fillCircle(context, cell.x, cell.y, radius);
  }
}

// The cell's neuron: a small disc in the neuron's colour with its symbol (or the bound key of a Command), lit while
// the cell's signal is on. alpha: how solidly it is drawn.
function drawNeuronBadge(context, cell, radius, alpha = 1) {
  const neuronType = NEURONS[cell.neuron.kind];
  const badgeRadius = radius * 0.55;
  context.globalAlpha = alpha;
  context.fillStyle = cell.signal > SIGNAL_ON ? '#fff6a0' : neuronType.color;
  fillCircle(context, cell.x, cell.y, badgeRadius);
  context.strokeStyle = 'rgba(0,0,0,0.6)';
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = '#111';
  context.font = `bold ${badgeRadius * 1.5 | 0}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(cell.boundKey || neuronType.symbol, cell.x, cell.y + 0.5);
  context.textBaseline = 'alphabetic';
}

const secondsNow = () => (typeof performance !== 'undefined' ? performance.now() / 1000 : 0);

// The water: background colour and slowly drifting motes.
// cameraX, cameraY: camera position; motes drift past at half speed for depth
function drawWater(context, world, width, height, cameraX = 0, cameraY = 0, background = '#0e1d24') {
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = 'rgba(120,200,220,0.05)';
  const wrapInto = (value, size) => (value % size + size) % size;
  for (let i = 0; i < 60; i++) {
    const x = wrapInto(i * 137.5 + world.time * 6 * (1 + i % 3) - cameraX * 0.5, width);
    const y = wrapInto(i * 91.3 + Math.sin(world.time * 0.3 + i) * 20 + height - cameraY * 0.5, height);
    fillCircle(context, x, y, 1 + i % 3);
  }
}

// a cell outside any world, for drawing on its own (palette icons, the builder grid)
function makeDisplayCell(typeName, x, y, creature = { centerX: 0, centerY: 0, heading: 0 }) {
  return {
    typeName,
    type: CELLS[typeName],
    x,
    y,
    radius: CELL_RADIUS,
    health: 1,
    maxHealth: 1,
    signal: 0,
    hitFlash: 0,
    efficiency: 1,
    cooldown: 0,
    fluids: new Array(FLUID_COUNT).fill(0),
    fluidCapacity: new Array(FLUID_COUNT).fill(1),
    boundKey: null,
    neuron: null,
    senseOutput: 0,
    budGrowth: null,
    starving: false,
    poisoned: false,
    creature,
  };
}
