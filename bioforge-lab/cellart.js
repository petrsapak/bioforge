'use strict';
// How each cell looks, in the Microscope style: a see-through body with a coloured membrane, and a line-art symbol
// for its type (browser only).

const CELL_BODY_ALPHA = 0.2;                              // opacity of a cell's inside
const CELL_RING_ALPHA = 0.45;                             // opacity of the inner membrane line
const CELL_SPECK_ALPHA = 0.5;                             // opacity of the small organelle specks
const RESERVOIR_ALPHA = 0.6;                              // opacity of the fluid disc in an Air sac or Fat
const MINERAL_FILL_ALPHA = 0.75;                          // opacity of the mineral in a Mineralizer's crystal
const MEMBRANE_WIDTH = 0.09;                              // cell radii: the outer membrane line
const SYMBOL_WIDTH = 0.09;                                // cell radii: most symbol lines
const THIN_SYMBOL_WIDTH = 0.07;                           // cell radii: fine symbol detail
const MEMBRANE_RADIUS = 0.95;                             // cell radii: where the membrane line sits
const DETAIL_MIN_RADIUS = 14;                             // screen px of radius from which a cell gets its fine detail
const SPIKE_LENGTH = 1.9;                               // cell radii from the centre to a Thorn's tip
const SIPHON_PUFF_DISTANCE = 1.6;                         // cell radii behind a Siphon where its puff shows
const HEART_BEAT_RATE = 8;                                // radians per real second of the Heart's beat
// small specks inside the body, in cell radii (outward is up)
const ORGANELLE_SPECKS = [[0.55, 0.4, 0.05], [-0.6, 0.3, 0.05], [0.35, 0.62, 0.05]];
// the Mineralizer's crystal and the crust of a hardened cell, in cell radii
const CRYSTAL_OUTLINE = [[0, -0.6], [0.4, -0.2], [0.4, 0.25], [0, 0.6], [-0.4, 0.25], [-0.4, -0.2]];
const CRUST_RADIUS = 0.86;

// ---------- colours ----------
const translucentCache = new Map();

// a '#rrggbb' colour at the given opacity, as an rgba() string (cached: cells are drawn every frame)
function translucent(hex, alpha) {
  const key = hex + alpha;
  let color = translucentCache.get(key);
  if (color) return color;
  const value = parseInt(hex.slice(1), 16);
  color = `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;
  translucentCache.set(key, color);
  return color;
}

// a '#rrggbb' colour mixed toward white by amount (0..1)
function lighten(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  return `rgb(${mix(value >> 16 & 255)},${mix(value >> 8 & 255)},${mix(value & 255)})`;
}

const paletteCache = new Map();

// the colours one cell type is drawn with, worked out once per type
function cellPalette(type) {
  let palette = paletteCache.get(type);
  if (palette) return palette;
  palette = {
    edge: type.color,
    body: translucent(type.color, CELL_BODY_ALPHA),
    ring: translucent(type.color, CELL_RING_ALPHA),
    speck: translucent(type.color, CELL_SPECK_ALPHA),
    ink: lighten(type.color, 0.15),                        // the symbol's lines
    light: lighten(type.color, 0.7),                       // the symbol's bright parts
  };
  paletteCache.set(type, palette);
  return palette;
}

// ---------- unit-space helpers (1 = the cell's radius, outward = up) ----------
function traceCircle(context, x, y, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, TAU);
}

function tracePolyline(context, points) {
  context.beginPath();
  context.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) context.lineTo(points[i][0], points[i][1]);
}

function strokeIn(context, color, width) {
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}

function fillIn(context, color) {
  context.fillStyle = color;
  context.fill();
}

// a ray from inner to outer distance along angle, as a path
function traceRay(context, angle, inner, outer) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  tracePolyline(context, [[cos * inner, sin * inner], [cos * outer, sin * outer]]);
}

// a drop pointing up
function traceDrop(context, size) {
  context.beginPath();
  context.moveTo(0, -size * 1.1);
  context.quadraticCurveTo(size * 0.95, size * 0.15, 0, size * 0.85);
  context.quadraticCurveTo(-size * 0.95, size * 0.15, 0, -size * 1.1);
}

function traceHeart(context, size) {
  context.beginPath();
  context.moveTo(0, size * 0.9);
  context.bezierCurveTo(-size * 1.3, 0, -size * 0.7, -size, 0, -size * 0.35);
  context.bezierCurveTo(size * 0.7, -size, size * 1.3, 0, 0, size * 0.9);
  context.closePath();
}

// a regular hexagon of the given size, corners at angle offset + i * 60°
function traceHexagon(context, size, offset) {
  context.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = offset + i * TAU / 6;
    context.lineTo(Math.cos(angle) * size, Math.sin(angle) * size);
  }
  context.closePath();
}

// ---------- the body ----------
// A whole cell in its own frame: body first, then its type's symbol. outward: the angle away from the body centre.
function drawCellArt(context, cell, radius, outward) {
  const palette = cellPalette(cell.type);
  const towardOutward = outward + Math.PI / 2;            // turns the frame so up points outward
  context.save();
  context.translate(cell.x, cell.y);
  context.rotate(towardOutward);
  context.scale(radius, radius);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (cell.type.spiked) drawSpike(context, palette);
  drawMembrane(context, palette);
  const drawSymbol = CELL_SYMBOLS[cell.typeName];
  if (drawSymbol) {
    if (SYMBOLS_FACING_HEADING.has(cell.typeName)) context.rotate(cell.creature.heading - towardOutward);
    drawSymbol(context, cell, palette);
  }
  context.restore();
}

// See-through inside and a coloured membrane. Drawn big (the builder, the dock), it also gets a fainter inner line and
// a few specks; at game size they would be under half a pixel wide, and they cost about 1.7 ms per frame for 225
// cells.
function drawMembrane(context, palette) {
  traceCircle(context, 0, 0, MEMBRANE_RADIUS);
  fillIn(context, palette.body);
  strokeIn(context, palette.edge, MEMBRANE_WIDTH);
  const frame = context.getTransform();                   // its scale is the cell's radius on screen
  if (Math.hypot(frame.a, frame.b) < DETAIL_MIN_RADIUS) return;
  traceCircle(context, 0, 0, 0.82);
  strokeIn(context, palette.ring, 0.05);
  context.beginPath();                                    // one path for all specks: one fill call per cell
  for (const [x, y, size] of ORGANELLE_SPECKS) {
    context.moveTo(x + size, y);
    context.arc(x, y, size, 0, TAU);
  }
  fillIn(context, palette.speck);
}

// a spiked cell's point, behind its body
function drawSpike(context, palette) {
  const sideAngle = 1.9;                                  // radians from the tip to each base corner
  tracePolyline(context, [[0, -SPIKE_LENGTH], [Math.sin(sideAngle), -Math.cos(sideAngle)],
    [-Math.sin(sideAngle), -Math.cos(sideAngle)]]);
  context.closePath();
  fillIn(context, palette.body);
  strokeIn(context, palette.edge, 0.08);
}

// A cell a Mineralizer hardened: a faceted mineral crust just inside its membrane. Drawn in world space, as an
// overlay.
function drawHardenedCrust(context, cell, radius) {
  context.save();
  context.translate(cell.x, cell.y);
  context.scale(radius, radius);
  context.globalAlpha = 1;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  traceHexagon(context, CRUST_RADIUS, 0);
  strokeIn(context, MATERIALS_BY_ID.mineral.color, 0.13);
  for (let i = 0; i < 6; i += 2) traceRay(context, i * TAU / 6, CRUST_RADIUS, CRUST_RADIUS * 0.72);
  strokeIn(context, MATERIALS_BY_ID.mineral.color, THIN_SYMBOL_WIDTH);
  context.restore();
}

// ---------- the symbols ----------
// Symbols that face the way the creature swims instead of away from the body.
const SYMBOLS_FACING_HEADING = new Set(['nucleus', 'siphon']);

// The symbol inside each cell type, in the cell's frame (1 = its radius, up = outward): (context, cell, palette).
const CELL_SYMBOLS = {
  // an eye looking the way the creature swims
  nucleus(context, cell, palette) {
    traceCircle(context, 0, -0.2, 0.5);
    fillIn(context, palette.light);
    traceCircle(context, 0, -0.36, 0.25);
    fillIn(context, palette.ink);
    traceCircle(context, 0.08, -0.45, 0.07);
    fillIn(context, palette.light);
  },
  tissue(context, cell, palette) {
    context.fillStyle = palette.ink;
    for (const [x, y] of [[-0.3, -0.2], [0.3, -0.15], [0, 0.32]]) {
      traceCircle(context, x, y, 0.11);
      context.fill();
    }
  },
  // a hexagonal plate with a seam
  shell(context, cell, palette) {
    traceHexagon(context, 0.6, Math.PI / 6);
    strokeIn(context, palette.ink, 0.11);
    tracePolyline(context, [[0, -0.6], [0, 0.6]]);
    strokeIn(context, palette.ink, 0.08);
  },
  // a hinge: two arcs bowing toward the middle, ") (", round a pin
  joint(context, cell, palette) {
    for (const side of [-1, 1]) {
      const facing = side < 0 ? 0 : Math.PI;
      context.beginPath();
      context.arc(side * 0.95, 0, 0.6, facing - 0.9, facing + 0.9);
      strokeIn(context, palette.ink, 0.11);
    }
    traceCircle(context, 0, 0, 0.12);
    fillIn(context, palette.ink);
  },
  // curved hairs on the outer side
  cilia(context, cell, palette) {
    for (const offset of [-0.9, -0.3, 0.3, 0.9]) {
      const angle = -Math.PI / 2 + offset;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      context.beginPath();
      context.moveTo(cos, sin);
      context.quadraticCurveTo(cos * 1.3 - sin * 0.15, sin * 1.3 + cos * 0.15, cos * 1.55, sin * 1.55);
      strokeIn(context, palette.edge, 0.1);
    }
    context.fillStyle = palette.ink;
    for (const x of [-0.3, 0.3]) {
      traceCircle(context, x, 0.1, 0.1);
      context.fill();
    }
  },
  // a pupil, white while an enemy is near (render.js adds the range it senses in)
  eyespot(context, cell, palette) {
    const isOn = cell.senseOutput > SIGNAL_ON;
    traceCircle(context, 0, 0, 0.48);
    fillIn(context, isOn ? '#fff' : palette.ink);
    traceCircle(context, 0.15, -0.15, 0.13);
    fillIn(context, isOn ? palette.ink : palette.light);
  },
  // a sun, brighter the more light it sees
  lighteye(context, cell, palette) {
    const brightness = (0.15 + 0.85 * clamp01(cell.senseOutput)).toFixed(2);
    traceCircle(context, 0, 0, 0.3);
    fillIn(context, `rgba(255,255,255,${brightness})`);
    strokeIn(context, palette.ink, THIN_SYMBOL_WIDTH);
    for (let i = 0; i < 8; i++) {
      traceRay(context, i * TAU / 8, 0.45, 0.68);
      strokeIn(context, palette.ink, SYMBOL_WIDTH);
    }
  },
  // two nostrils, white while it smells food strongly
  nose(context, cell, palette) {
    context.fillStyle = cell.senseOutput > SIGNAL_ON ? '#fff' : palette.ink;
    for (const x of [-0.25, 0.25]) {
      context.beginPath();
      context.ellipse(x, 0.1, 0.13, 0.22, x * 0.8, 0, TAU);
      context.fill();
    }
    context.beginPath();
    context.arc(0, -0.15, 0.55, -Math.PI * 0.8, -Math.PI * 0.2);
    strokeIn(context, palette.ink, SYMBOL_WIDTH);
  },
  // a striped fibre bundle
  muscle(context, cell, palette) {
    context.beginPath();
    context.ellipse(0, 0, 0.62, 0.42, 0, 0, TAU);
    strokeIn(context, palette.ink, SYMBOL_WIDTH);
    for (const y of [-0.18, 0.18]) {
      tracePolyline(context, [[-0.5, y], [0.5, y]]);
      strokeIn(context, palette.ink, SYMBOL_WIDTH);
    }
  },
  // a core with four arrows pushing out
  bloater(context, cell, palette) {
    traceCircle(context, 0, 0, 0.25);
    strokeIn(context, palette.ink, SYMBOL_WIDTH);
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + i * TAU / 4;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      traceRay(context, angle, 0.42, 0.68);
      strokeIn(context, palette.ink, 0.1);
      const tipX = cos * 0.68;
      const tipY = sin * 0.68;
      tracePolyline(context, [[tipX - sin * 0.14 - cos * 0.14, tipY + cos * 0.14 - sin * 0.14], [tipX, tipY],
        [tipX + sin * 0.14 - cos * 0.14, tipY - cos * 0.14 - sin * 0.14]]);
      strokeIn(context, palette.ink, 0.1);
    }
  },
  // a nozzle at the back (it faces the creature's heading), and a puff of water while it squirts
  siphon(context, cell, palette) {
    context.beginPath();
    context.ellipse(0, 0.35, 0.3, 0.38, 0, 0, TAU);
    fillIn(context, palette.ink);
    tracePolyline(context, [[-0.25, -0.45], [0, -0.2], [0.25, -0.45]]);
    strokeIn(context, palette.ink, 0.1);
    if (cell.signal <= 0.2 || cell.efficiency <= 0.2) return;
    const puffRadius = 0.5 * (0.7 + Math.random() * 0.5);
    traceCircle(context, 0, SIPHON_PUFF_DISTANCE, puffRadius);
    fillIn(context, `rgba(160,220,255,${clamp01(cell.signal * cell.efficiency) * 0.7})`);
  },
  // three stinging threads
  nettle(context, cell, palette) {
    context.fillStyle = palette.ink;
    for (const offset of [0, 2.1, 4.2]) {
      const angle = -Math.PI / 2 + offset;
      traceRay(context, angle, 0, 0.62);
      strokeIn(context, palette.ink, 0.11);
      traceCircle(context, Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 0.11);
      context.fill();
    }
  },
  // a hook with a barb, pointing out
  snare(context, cell, palette) {
    context.beginPath();
    context.moveTo(0, 0.55);
    context.lineTo(0, -0.1);
    context.arc(-0.25, -0.1, 0.25, 0, -Math.PI, true);
    strokeIn(context, palette.ink, 0.12);
    tracePolyline(context, [[-0.5, -0.1], [-0.38, 0.08]]);
    strokeIn(context, palette.ink, 0.12);
  },
  // a muzzle on the outer side, its core lit while ready to fire
  spitter(context, cell, palette) {
    traceCircle(context, 0, -0.3, 0.36);
    fillIn(context, palette.ink);
    traceCircle(context, 0, -0.3, 0.14);
    fillIn(context, cell.cooldown <= 0 ? palette.light : palette.body);
  },
  thorn(context, cell, palette) {
    tracePolyline(context, [[0, -0.5], [0.3, 0.2], [-0.3, 0.2]]);
    context.closePath();
    strokeIn(context, palette.ink, SYMBOL_WIDTH);
  },
  // a seed, with a ring that fills as the part grows (white when ready)
  bud(context, cell, palette) {
    const growth = cell.budGrowth;
    const partSize = growth ? growth.plan.cells.length : 0;
    context.beginPath();
    context.ellipse(0, 0.05, 0.22, 0.3, 0, 0, TAU);
    fillIn(context, growth && growth.done && partSize ? '#fff' : palette.ink);
    if (!partSize) return;
    context.beginPath();
    context.arc(0, 0, 0.6, -Math.PI / 2, -Math.PI / 2 + TAU * growth.grownCount / partSize);
    strokeIn(context, '#fff', 0.12);
  },
  // gill slits
  gill(context, cell, palette) {
    for (const x of [-0.36, 0, 0.36]) {
      context.beginPath();
      context.moveTo(x, -0.5);
      context.quadraticCurveTo(x + 0.16, 0, x, 0.5);
      strokeIn(context, palette.ink, 0.1);
    }
  },
  // an open mouth with two teeth, facing out
  mouth(context, cell, palette) {
    context.beginPath();
    context.moveTo(0, 0.05);
    context.arc(0, 0.05, 0.75, -Math.PI / 2 - 0.65, -Math.PI / 2 + 0.65);
    context.closePath();
    fillIn(context, palette.ink);
    context.fillStyle = palette.light;
    for (const x of [-0.18, 0.18]) {
      tracePolyline(context, [[x - 0.08, -0.58], [x + 0.08, -0.58], [x, -0.4]]);
      context.closePath();
      context.fill();
    }
  },
  // a heart that beats while fed
  heart(context, cell, palette) {
    const beat = Math.max(0, Math.sin(secondsNow() * HEART_BEAT_RATE));
    traceHeart(context, 0.42 + 0.12 * cell.efficiency * beat);
    fillIn(context, palette.light);
  },
  // two flaps, light while open
  valve(context, cell, palette) {
    context.fillStyle = cell.signal > SIGNAL_ON ? '#e8f4ff' : palette.ink;
    for (const side of [-1, 1]) {
      tracePolyline(context, [[side * 0.55, -0.45], [side * 0.08, 0], [side * 0.55, 0.45]]);
      context.closePath();
      context.fill();
    }
  },
  // a disc of O₂ that shrinks as it empties, with bubbles
  airsac(context, cell, palette) {
    drawReservoirDisc(context, cell, FLUID_OXYGEN);
    for (const [x, y, size] of [[-0.15, -0.1, 0.14], [0.18, 0.12, 0.09]]) {
      traceCircle(context, x, y, size);
      strokeIn(context, 'rgba(255,255,255,0.8)', 0.06);
    }
  },
  // a disc of sugar that shrinks as it empties, with fat droplets
  fat(context, cell, palette) {
    drawReservoirDisc(context, cell, FLUID_SUGAR);
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [x, y] of [[-0.2, -0.12], [0.18, -0.05], [0, 0.22]]) {
      traceCircle(context, x, y, 0.12);
      context.fill();
    }
  },
  // an opening with waste puffing out
  pore(context, cell, palette) {
    traceCircle(context, 0, 0, 0.32);
    fillIn(context, palette.ink);
    for (let i = 0; i < 3; i++) {
      traceRay(context, -Math.PI / 2 + (i - 1) * 0.6, 0.45, 0.68);
      strokeIn(context, palette.ink, SYMBOL_WIDTH);
    }
  },
  mender(context, cell, palette) {
    context.beginPath();
    context.rect(-0.15, -0.52, 0.3, 1.04);
    context.rect(-0.52, -0.15, 1.04, 0.3);
    fillIn(context, palette.light);
  },
  // a lightning bolt
  adrenal(context, cell, palette) {
    tracePolyline(context, [[0.12, -0.6], [-0.25, 0.05], [0.02, 0.05], [-0.12, 0.6], [0.28, -0.08], [0.02, -0.08]]);
    context.closePath();
    fillIn(context, palette.ink);
  },
  // a drop with bubbles, bright while it secretes
  acid(context, cell, palette) {
    const isOn = cell.signal > SIGNAL_ON;
    traceDrop(context, 0.5);
    if (isOn) fillIn(context, palette.light);
    strokeIn(context, palette.ink, 0.1);
    context.fillStyle = isOn ? palette.edge : palette.ink;
    for (const [x, y, size] of [[-0.08, 0.15, 0.13], [0.14, -0.1, 0.08], [0.05, 0.42, 0.06]]) {
      traceCircle(context, x, y, size);
      context.fill();
    }
  },
  // a protein strand snipped in two, bright while it secretes
  protease(context, cell, palette) {
    const color = cell.signal > SIGNAL_ON ? palette.light : palette.ink;
    const halves = [[[-0.62, 0.1], [-0.42, -0.2], [-0.22, 0.1], [-0.1, -0.08]],
      [[0.1, 0.08], [0.22, -0.1], [0.42, 0.2], [0.62, -0.1]]];
    context.fillStyle = color;
    for (const half of halves) {
      tracePolyline(context, half);
      strokeIn(context, color, 0.11);
      for (let i = 0; i < 3; i++) {
        traceCircle(context, half[i][0], half[i][1], 0.09);
        context.fill();
      }
    }
    tracePolyline(context, [[-0.12, -0.42], [0.12, -0.24]]);
    strokeIn(context, color, THIN_SYMBOL_WIDTH);
    tracePolyline(context, [[0.12, -0.42], [-0.12, -0.24]]);
    strokeIn(context, color, THIN_SYMBOL_WIDTH);
  },
  // a crystal that fills from the bottom with the mineral it stores
  mineralizer(context, cell, palette) {
    const fill = cell.type.mineralCapacity ? clamp01(cell.mineral / cell.type.mineralCapacity) : 0;
    tracePolyline(context, CRYSTAL_OUTLINE);
    context.closePath();
    context.save();
    context.clip();
    context.fillStyle = translucent(MATERIALS_BY_ID.mineral.color, MINERAL_FILL_ALPHA);
    context.fillRect(-0.5, 0.6 - 1.2 * fill, 1, 1.2 * fill);
    context.restore();
    tracePolyline(context, CRYSTAL_OUTLINE);
    context.closePath();
    strokeIn(context, palette.ink, SYMBOL_WIDTH);
    tracePolyline(context, [[-0.4, -0.2], [0, 0.1], [0.4, -0.2]]);
    strokeIn(context, palette.ink, THIN_SYMBOL_WIDTH);
    tracePolyline(context, [[0, 0.1], [0, 0.6]]);
    strokeIn(context, palette.ink, THIN_SYMBOL_WIDTH);
  },
};

// a reservoir's fluid, as a disc whose area shows how full it is
function drawReservoirDisc(context, cell, fluid) {
  const fill = clamp01(cell.fluids[fluid] / cell.fluidCapacity[fluid]);
  traceCircle(context, 0, 0, 0.62 * Math.sqrt(fill));
  fillIn(context, translucent(FLUIDS[fluid].color, RESERVOIR_ALPHA));
}

// ---------- neurons ----------
const NEURON_BADGE_SIZE = 0.55;                           // cell radii: the badge's radius
const NEURON_BODY_ALPHA = 0.3;                            // opacity of an unlit badge's inside
const NEURON_LIT_COLOR = '#fff6a0';                       // a badge while its cell's signal is on
const NEURON_LIT_INK = '#4a3c08';                         // the symbol on a lit badge
const NEURON_GLYPH_WIDTH = 0.17;                          // badge radii: the symbol's lines
const DENDRITE_COUNT = 6;                                 // short ticks round the badge

// A cell's neuron, as a small see-through cell body with dendrite ticks and a line-art symbol for its kind (a bound
// Command shows its key). alpha: how solidly it is drawn.
function drawNeuronArt(context, cell, radius, alpha = 1) {
  const neuronType = NEURONS[cell.neuron.kind];
  const isLit = cell.signal > SIGNAL_ON;
  const ink = isLit ? NEURON_LIT_INK : lighten(neuronType.color, 0.35);
  const badgeRadius = radius * NEURON_BADGE_SIZE;
  context.save();
  context.globalAlpha = alpha;
  context.translate(cell.x, cell.y);
  context.scale(badgeRadius, badgeRadius);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  traceCircle(context, 0, 0, 1);
  fillIn(context, isLit ? NEURON_LIT_COLOR : translucent(neuronType.color, NEURON_BODY_ALPHA));
  strokeIn(context, isLit ? NEURON_LIT_COLOR : neuronType.color, 0.14);
  context.beginPath();
  for (let i = 0; i < DENDRITE_COUNT; i++) {
    const angle = -Math.PI / 2 + i * TAU / DENDRITE_COUNT;
    context.moveTo(Math.cos(angle) * 1.05, Math.sin(angle) * 1.05);
    context.lineTo(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35);
  }
  strokeIn(context, isLit ? NEURON_LIT_COLOR : neuronType.color, 0.12);
  const drawGlyph = NEURON_GLYPHS[cell.neuron.kind];
  const hasGlyph = drawGlyph && !cell.boundKey;
  if (hasGlyph) {
    context.strokeStyle = ink;
    context.fillStyle = ink;
    context.lineWidth = NEURON_GLYPH_WIDTH;
    drawGlyph(context);
  }
  context.restore();
  if (hasGlyph) return;
  context.globalAlpha = alpha;
  drawNeuronLetter(context, cell, cell.boundKey ? cell.boundKey.toUpperCase() : neuronType.symbol, ink, badgeRadius);
}

// a bound key, or a symbol with no drawing, as text in the badge (in screen pixels: tiny scaled fonts render badly)
function drawNeuronLetter(context, cell, text, color, badgeRadius) {
  context.fillStyle = color;
  context.font = `bold ${badgeRadius * 1.4 | 0}px system-ui`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, cell.x, cell.y + 0.5);
  context.textBaseline = 'alphabetic';
}

// The symbol of each neuron kind, in badge radii, stroked and filled in the badge's ink: (context).
const NEURON_GLYPHS = {
  // a wave: it beats by itself
  pacemaker(context) {
    context.beginPath();
    context.moveTo(-0.6, 0);
    context.bezierCurveTo(-0.4, -0.55, -0.2, -0.55, 0, 0);
    context.bezierCurveTo(0.2, 0.55, 0.4, 0.55, 0.6, 0);
    context.stroke();
  },
  // a key
  command(context) {
    traceCircle(context, -0.28, 0, 0.24);
    context.stroke();
    tracePolyline(context, [[-0.04, 0], [0.6, 0], [0.6, 0.25]]);
    context.stroke();
    tracePolyline(context, [[0.36, 0], [0.36, 0.2]]);
    context.stroke();
  },
  // two gentle waves: it smooths its input
  ganglion(context) {
    for (const y of [-0.2, 0.2]) {
      context.beginPath();
      context.moveTo(-0.55, y);
      context.bezierCurveTo(-0.25, y - 0.25, 0.25, y + 0.25, 0.55, y);
      context.stroke();
    }
  },
  // two chevrons: the signal passes on later
  delay(context) {
    for (const x of [-0.3, 0.12]) {
      tracePolyline(context, [[x, -0.35], [x + 0.28, 0], [x, 0.35]]);
      context.stroke();
    }
  },
  // NOT: a bar with its end turned down
  inhibitor(context) {
    tracePolyline(context, [[-0.5, -0.12], [0.45, -0.12], [0.45, 0.3]]);
    context.stroke();
  },
  // at least: a chevron over a bar
  synapse(context) {
    tracePolyline(context, [[-0.35, -0.45], [0.35, -0.18], [-0.35, 0.09]]);
    context.stroke();
    tracePolyline(context, [[-0.35, 0.38], [0.35, 0.38]]);
    context.stroke();
  },
  // a half-filled circle: it remembers on or off
  latch(context) {
    traceCircle(context, 0, 0, 0.45);
    context.stroke();
    context.beginPath();
    context.arc(0, 0, 0.45, -Math.PI / 2, Math.PI / 2);
    context.closePath();
    context.fill();
  },
};
