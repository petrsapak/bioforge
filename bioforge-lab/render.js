'use strict';
// Canvas drawing of the world: bonds, cells, blood vessels, nerve fibres, snare lines, globs, zaps, food and sparks
// (browser only).

// bond colour by team, see-through like the cells: 0 = the player's side, 1 = enemies, -1 = debris
const BOND_COLORS = { 0: 'rgba(80,170,140,0.22)', 1: 'rgba(200,90,110,0.22)', '-1': 'rgba(140,150,155,0.18)' };
const BOND_WIDTH_STEP = 0.5;                              // px: bond widths are rounded to this, to batch the bonds
const VIEW_MARGIN = 30;                                   // px around the view box in which cells are still drawn
const FIBRE_COLOR = '#f2d36b';
const FIBRE_ACTIVE_COLOR = '#fffbe0';                     // a fibre carrying a signal
const FIBRE_ARROW_SIZE = 3;                               // px
const LIGHT_GLOW_RADIUS = 40;                             // px of the glow drawn around the light
const BRIDGE_RADIUS = 2.6;                               // px of the arc a fibre jumps over a crossing with
const VESSEL_COLOR = '#8f1d2c';                           // a vessel no Heart pumps
const VESSEL_PUMPED_COLOR = '#e0485a';                    // a vessel a fed Heart pumps
const VESSEL_SHUT_COLOR = '#6a5a62';                      // a vessel an unsignalled Valve shuts

// view 0 = normal, 1..5 = fill level of one fluid; viewBox = { minX, minY, maxX, maxY }: draw only cells inside it.
// Vessels and fibres are left out, since they clutter the game and the builder's preview; the tip demos add them.
function drawWorld(context, world, view, viewBox) {
  const isVisible = viewBox
    ? cell => cell.x > viewBox.minX - VIEW_MARGIN && cell.x < viewBox.maxX + VIEW_MARGIN &&
      cell.y > viewBox.minY - VIEW_MARGIN && cell.y < viewBox.maxY + VIEW_MARGIN
    : () => true;
  drawBonds(context, world, isVisible);
  for (const cell of world.cells) {
    if (isVisible(cell)) drawCell(context, cell, view);
  }
  drawSnareLines(context, world);
  drawGlobs(context, world);
  drawZaps(context, world);
  drawFood(context, world);
  drawSparks(context, world);
}

// The bonds as soft see-through flesh. Bonds of one team and width go into one path and are stroked once, so where
// they overlap (round every cell) the flesh does not darken.
function drawBonds(context, world, isVisible) {
  const paths = new Map();                                // 'team width' -> { team, width, bonds }
  for (const bond of world.bonds) {
    if (!isVisible(bond.first)) continue;
    const team = bond.first.creature.team;
    const width = Math.round(Math.min(bond.first.radius, bond.second.radius) * 1.6 / BOND_WIDTH_STEP) *
      BOND_WIDTH_STEP;
    const key = `${team} ${width}`;
    if (!paths.has(key)) paths.set(key, { team, width, bonds: [] });
    paths.get(key).bonds.push(bond);
  }
  context.lineCap = 'round';
  for (const { team, width, bonds } of paths.values()) {
    context.strokeStyle = BOND_COLORS[team] || BOND_COLORS[-1];
    context.lineWidth = width;
    context.beginPath();
    for (const bond of bonds) {
      context.moveTo(bond.first.x, bond.first.y);
      context.lineTo(bond.second.x, bond.second.y);
    }
    context.stroke();
  }
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

// sugar specks as dots, mineral specks as small diamonds
function drawFood(context, world) {
  for (const speck of world.food) {
    if (speck.mineral) {
      context.fillStyle = MATERIALS_BY_ID.mineral.color;
      fillDiamond(context, speck.x, speck.y, 2.5, 3.5);
      continue;
    }
    context.fillStyle = '#d8e070';
    fillCircle(context, speck.x, speck.y, 2.5);
  }
}

function drawSparks(context, world) {
  for (const spark of world.sparks) {
    context.globalAlpha = Math.min(1, spark.lifetime * 3);
    context.fillStyle = spark.color;
    context.fillRect(spark.x - 1.5, spark.y - 1.5, 3, 3);
  }
  context.globalAlpha = 1;
}

// ---------- Blood vessels ----------
// A vessel as a thick line through the centres of its cells, with a dot on each end cell, where blood goes in and out.
// state: 'pumped' (bright), 'idle' (dark) or 'shut' (grey, dashed); alpha and width: how strongly it is drawn.
function drawVessel(context, points, state, alpha = 1, width = 3) {
  context.globalAlpha = alpha;
  context.strokeStyle = state === 'pumped' ? VESSEL_PUMPED_COLOR : state === 'shut' ? VESSEL_SHUT_COLOR : VESSEL_COLOR;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (state === 'shut') context.setLineDash([width, width]);
  context.beginPath();
  for (const [x, y] of points) context.lineTo(x, y);
  context.stroke();
  context.setLineDash([]);
  for (const [x, y] of [points[0], points[points.length - 1]]) fillCircle(context, x, y, width);
  context.globalAlpha = 1;
}

// how a world vessel is drawn this frame: shut by a Valve, pumped by a Heart, or idle
function vesselState(vessel) {
  if (!vessel.open) return 'shut';
  return vessel.pumping > 0 ? 'pumped' : 'idle';
}

// the world's vessels, through the moving centres of the cells they run through
function drawWorldVessels(context, world) {
  for (const vessel of world.vessels) {
    drawVessel(context, vessel.path.map(cell => [cell.x, cell.y]), vesselState(vessel), 0.55, 2.2);
  }
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
// One cell: its body and symbol (cellart.js), then overlays for key binding, signal, adrenaline, starving, poison and
// hits.
function drawCell(context, cell, view) {
  const radius = cell.radius * 0.9;
  if (view) {
    drawFluidLevel(context, cell, radius, view - 1);
    return;
  }
  const creature = cell.creature;
  context.globalAlpha = 0.4 + 0.6 * clamp01(cell.health / cell.maxHealth);
  const outward = Math.atan2(cell.y - creature.centerY, cell.x - creature.centerX);   // away from the body centre
  drawCellArt(context, cell, radius, outward);
  if (cell.type.senses === 'enemy') drawEyespotRange(context, cell);
  drawCellOverlays(context, cell, radius);
  context.globalAlpha = 1;
}

// a faint ring round an Eyespot at the distance it sees enemies from
function drawEyespotRange(context, cell) {
  context.strokeStyle = 'rgba(79,209,197,0.12)';
  context.lineWidth = 1;
  strokeCircle(context, cell.x, cell.y, EYESPOT_RANGE);
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

// a diamond centred on (x, y), halfWidth by halfHeight px
function fillDiamond(context, x, y, halfWidth, halfHeight) {
  context.beginPath();
  context.moveTo(x, y - halfHeight);
  context.lineTo(x + halfWidth, y);
  context.lineTo(x, y + halfHeight);
  context.lineTo(x - halfWidth, y);
  context.closePath();
  context.fill();
}

function drawCellOverlays(context, cell, radius) {
  if (cell.neuron) drawNeuronBadge(context, cell, radius);
  if (cell.signal > 0.03) {                               // nerve signal glow
    context.globalAlpha = clamp01(cell.signal) * 0.55;
    context.fillStyle = '#fff6a0';
    fillCircle(context, cell.x, cell.y, radius * 0.75);
  }
  if (cell.mineralized) drawHardenedCrust(context, cell, radius);   // hardened by a Mineralizer
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

// The cell's neuron (drawn by cellart.js), lit while the cell's signal is on. alpha: how solidly it is drawn.
function drawNeuronBadge(context, cell, radius, alpha = 1) {
  drawNeuronArt(context, cell, radius, alpha);
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
    mineral: 0,
    mineralized: false,
    creature,
  };
}
