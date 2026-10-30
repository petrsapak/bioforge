'use strict';
// Canvas drawing of the world: bonds, cells, blood vessels, nerve fibres, snare lines, globs, zaps, food and sparks
// (browser only).

// bond colour by team, see-through like the cells: 0 = the player's side, 1 = enemies, -1 = debris
const BOND_COLORS = { 0: 'rgba(80,170,140,0.22)', 1: 'rgba(200,90,110,0.22)', '-1': 'rgba(140,150,155,0.18)' };
const BOND_WIDTH_STEP = 0.5;                              // px: bond widths are rounded to this, to batch the bonds
const VIEW_MARGIN = 30;                                   // px around the view box in which cells are still drawn
const FIBRE_COLOR = '#f2d36b';
const FIBRE_ACTIVE_COLOR = '#fffbe0';                     // a fibre carrying a signal
// fibres that share a cell get different colours from this list (see layOutFibreLanes); no red, which marks removal
const FIBRE_COLORS = ['#f2d36b', '#5fd4f4', '#ff9f5a', '#b79cff', '#7ee08a', '#ff7fc8', '#6aa8ff', '#d9e2e6'];
const FIBRE_WIDTH = 0.9;                                  // px
const FIBRE_ARROW_SIZE = 2.2;                             // px
const LIGHT_GLOW_RADIUS = 40;                             // px of the glow drawn around the light
const LURE_GLOW_RADIUS = 22;                              // px of the glow drawn around a lit Photophore
const LURE_COLOR = '159,240,224';                         // r,g,b of a Photophore's light
const VESSEL_PUMPED_COLOR = '#e0485a';                    // a vessel being laid, and the pumped core's base
const VESSEL_PUMPED_CORE_COLOR = '#ffd8dc';               // the core of a vessel a fed Heart pumps
const VESSEL_SHUT_COLOR = '#6a5a62';                      // a vessel an unsignalled Valve shuts
// vessels that share a cell get different shades of red from this list, as fibres get colours
const VESSEL_COLORS = ['#e0485a', '#ff8a7a', '#c0304a', '#ff6f9a', '#d8645a', '#ff9fb4'];
const VESSEL_WIDTH = 1.2;                                 // px, a little thicker than a fibre
const VESSEL_IDLE_ALPHA = 0.55;                           // share of its strength a vessel no Heart pumps is drawn at

// view 0 = normal, 1..5 = fill level of one fluid; viewBox = { minX, minY, maxX, maxY }: draw only cells inside it.
// Vessels and fibres are left out, since they clutter the game and the builder's preview; the tip demos add them.
// showRanges: the faint rings of what Eyespots see (the title scene leaves them out).
function drawWorld(context, world, view, viewBox, showRanges = true) {
  const isVisible = viewBox
    ? cell => cell.x > viewBox.minX - VIEW_MARGIN && cell.x < viewBox.maxX + VIEW_MARGIN &&
      cell.y > viewBox.minY - VIEW_MARGIN && cell.y < viewBox.maxY + VIEW_MARGIN
    : () => true;
  drawBonds(context, world, isVisible);
  for (const cell of world.cells) {
    if (isVisible(cell)) drawCell(context, cell, view, showRanges);
  }
  drawLureReaches(context, world, isVisible);
  drawSnareLines(context, world);
  drawGlobs(context, world);
  drawZaps(context, world);
  drawFood(context, world);
  drawSparks(context, world);
}

// the faint reach of every lit Photophore: as far as other creatures' Light eyes see it
function drawLureReaches(context, world, isVisible) {
  for (const cell of world.cells) {
    if (!isGlowing(cell) || !isVisible(cell)) continue;
    const reach = context.createRadialGradient(cell.x, cell.y, 0, cell.x, cell.y, PHOTOPHORE_RANGE);
    reach.addColorStop(0, `rgba(${LURE_COLOR},0.08)`);
    reach.addColorStop(1, `rgba(${LURE_COLOR},0)`);
    context.fillStyle = reach;
    fillCircle(context, cell.x, cell.y, PHOTOPHORE_RANGE);
  }
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
// A vessel as a thin line along its points (its cells' centres, or its lane beside them, as fibres have), curved
// through the cells between its ends (see smoothLinkLine), with a small dot at each end, where blood goes in and out.
// state: 'pumped' (a light core, like a fibre carrying a signal), 'idle' (fainter) or 'shut' (grey, dashed). style:
// { color, alpha, width (px), gap (px from an end cell's centre to the line's end) }.
function drawVessel(context, points, state, style = {}) {
  const { color = VESSEL_COLORS[0], alpha = 1, width = VESSEL_WIDTH, gap = LINK_END_GAP } = style;
  const line = smoothLinkLine(points, gap);
  const isShut = state === 'shut';
  context.globalAlpha = state === 'idle' ? alpha * VESSEL_IDLE_ALPHA : alpha;
  context.strokeStyle = isShut ? VESSEL_SHUT_COLOR : color;
  context.fillStyle = context.strokeStyle;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (isShut) context.setLineDash([width * 2, width * 1.5]);
  traceLine(context, line);
  context.stroke();
  context.setLineDash([]);
  if (state === 'pumped') {
    context.strokeStyle = VESSEL_PUMPED_CORE_COLOR;
    context.lineWidth = width * 0.4;
    context.stroke();
  }
  for (const [x, y] of [line[0], line[line.length - 1]]) fillCircle(context, x, y, width * 0.9 + 0.4);
  context.globalAlpha = 1;
}

// how a world vessel is drawn this frame: shut by a Valve, pumped by a Heart, or idle
function vesselState(vessel) {
  if (!vessel.open) return 'shut';
  return vessel.pumping > 0 ? 'pumped' : 'idle';
}

// the world's vessels, through the moving centres of the cells they run through
function drawWorldVessels(context, world) {
  const lanes = layOutWorldLinks(world).vessels;
  world.vessels.forEach((vessel, i) => {
    const color = VESSEL_COLORS[lanes[i].colorIndex % VESSEL_COLORS.length];
    drawVessel(context, lanes[i].points, vesselState(vessel), { color, alpha: 0.85 });
  });
}

// The world's fibres and vessels in one set of lanes (see layOutFibreLanes), the fibres first, so that neither lies on
// the other: { fibres, vessels }, one { points, lane, colorIndex } per world fibre and vessel, in their order.
function layOutWorldLinks(world) {
  const pathOf = link => link.path.map(cell => ({ node: cell, x: cell.x, y: cell.y }));
  const lanes = layOutFibreLanes([...world.fibres.map(pathOf), ...world.vessels.map(pathOf)], FIBRE_COLORS.length);
  return { fibres: lanes.slice(0, world.fibres.length), vessels: lanes.slice(world.fibres.length) };
}

// ---------- Nerve fibres ----------
// A fibre as a thin line along its points ([x, y]: its cells' centres, or its lane beside them), curved through the
// cells between its ends (see smoothLinkLine), with a dot where it starts and an arrowhead where it ends. It brightens
// with the signal it carries (value), and shows a white core while the signal is on. style: { color, alpha, width
// (px), gap (px from an end cell's centre to the line's end) }.
function drawFibre(context, points, value, style = {}) {
  const { color = FIBRE_COLOR, alpha = 1, width = FIBRE_WIDTH, gap = LINK_END_GAP } = style;
  const line = smoothLinkLine(points, gap);
  context.globalAlpha = alpha * (0.6 + 0.4 * clamp01(value));
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  traceLine(context, line);
  context.stroke();
  if (value > SIGNAL_ON) {
    context.strokeStyle = FIBRE_ACTIVE_COLOR;
    context.lineWidth = width * 0.45;
    context.stroke();
    context.strokeStyle = color;
    context.lineWidth = width;
  }
  fillCircle(context, line[0][0], line[0][1], width * 0.8 + 0.5);
  drawFibreArrow(context, line[line.length - 2], line[line.length - 1], width);
  context.globalAlpha = 1;
}

// a path through the points ([x, y]), ready to stroke
function traceLine(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) context.lineTo(points[i][0], points[i][1]);
}

// a filled arrowhead with its tip on the fibre's end (to), pointing the way the line runs into it, sized to the line
function drawFibreArrow(context, [fromX, fromY], [toX, toY], width) {
  const length = vectorLength(toX - fromX, toY - fromY) || 1;
  const directionX = (toX - fromX) / length;
  const directionY = (toY - fromY) / length;
  const size = FIBRE_ARROW_SIZE * Math.max(1, width / FIBRE_WIDTH * 0.7);
  context.beginPath();
  context.moveTo(toX - directionX * size * 2 - directionY * size, toY - directionY * size * 2 + directionX * size);
  context.lineTo(toX, toY);
  context.lineTo(toX - directionX * size * 2 + directionY * size, toY - directionY * size * 2 - directionX * size);
  context.closePath();
  context.fill();
}

// the world's fibres side by side in their lanes, through the moving centres of the cells they run through
function drawWorldFibres(context, world) {
  const lanes = layOutWorldLinks(world).fibres;
  world.fibres.forEach((fibre, i) => {
    drawFibre(context, lanes[i].points, fibre.value, { color: FIBRE_COLORS[lanes[i].colorIndex], alpha: 0.85 });
  });
}

// ---------- Cells ----------
// One cell: its body and symbol (cellart.js), then overlays for key binding, signal, hormones, treatments, starving,
// poison and hits.
function drawCell(context, cell, view, showRanges = true) {
  const radius = cell.radius * 0.9;
  if (view) {
    drawFluidLevel(context, cell, radius, view - 1);
    return;
  }
  const creature = cell.creature;
  context.globalAlpha = 0.4 + 0.6 * clamp01(cell.health / cell.maxHealth);
  const outward = Math.atan2(cell.y - creature.centerY, cell.x - creature.centerX);   // away from the body centre
  if (isGlowing(cell)) drawLureGlow(context, cell);
  drawCellArt(context, cell, radius, outward);
  if (showRanges && cell.type.senses === 'enemy') drawEyespotRange(context, cell);
  drawCellOverlays(context, cell, radius);
  context.globalAlpha = 1;
}

// a faint ring round an Eyespot at the distance it sees enemies from
function drawEyespotRange(context, cell) {
  context.strokeStyle = 'rgba(79,209,197,0.12)';
  context.lineWidth = 1;
  strokeCircle(context, cell.x, cell.y, EYESPOT_RANGE);
}

// the hormones whose fluid channels are drawn as a rim (data/fluids.js)
const RIM_HORMONES = FLUIDS.map((fluid, index) => index).filter(index => FLUIDS[index].layer === 'chemical');

// a rim in the colour of the hormone the cell holds most of, as strong as it is full
function drawHormoneRim(context, cell, radius) {
  let strongest = -1;
  let strongestFill = 0.05;
  for (const fluid of RIM_HORMONES) {
    const fill = cell.fluids[fluid] / cell.fluidCapacity[fluid];
    if (fill <= strongestFill) continue;
    strongest = fluid;
    strongestFill = fill;
  }
  if (strongest < 0) return;
  context.globalAlpha = clamp01(strongestFill);
  context.strokeStyle = FLUIDS[strongest].color;
  context.lineWidth = 1.5;
  strokeCircle(context, cell.x, cell.y, radius + 1);
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
// showReach: the dashed ring at the edge of its reach (the title scene leaves it out)
function drawLight(context, light, showReach = true) {
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
  if (!showReach) return;
  context.strokeStyle = 'rgba(255,230,150,0.15)';
  context.setLineDash([4, 8]);
  context.beginPath();
  context.arc(light.x, light.y, light.range, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
}

// the bright glow round a lit Photophore
function drawLureGlow(context, cell) {
  const alpha = context.globalAlpha;
  const glow = context.createRadialGradient(cell.x, cell.y, 0, cell.x, cell.y, LURE_GLOW_RADIUS);
  glow.addColorStop(0, `rgba(${LURE_COLOR},0.55)`);
  glow.addColorStop(1, `rgba(${LURE_COLOR},0)`);
  context.globalAlpha = 1;
  context.fillStyle = glow;
  fillCircle(context, cell.x, cell.y, LURE_GLOW_RADIUS);
  context.globalAlpha = alpha;
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
  drawTreatments(context, cell, radius);
  drawHormoneRim(context, cell, radius);
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
