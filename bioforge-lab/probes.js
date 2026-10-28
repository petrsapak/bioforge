'use strict';
// Signal probes: a live trace of what a creature's senses, neurons and signalled cells do, one lane per cell, with a
// matching number tag on each probed cell. In Sandbox and level runs they trace the player (a click on one of its
// cells adds or removes its lane); in the builder's Nerve view the Traces window traces the test tank's creature
// (browser only).

const PROBE_SECONDS = 6;                                  // game s of trace shown across a lane
const PROBE_MAX_LANES = 8;
const PROBE_LANE_HEIGHT = 17;                             // px (canvas units) per lane
const TRACES_LANE_HEIGHT = 24;                            // px per lane in the builder's Traces window
const PROBE_LABEL_WIDTH = 78;                             // px (canvas units) left of the traces for the lane names
const PROBE_TAG_RADIUS = 6;                               // px in the world: the number tag on a probed cell
const PROBE_GROUPS = ['sense', 'neuron', 'action'];      // lane order: senses first, then neurons, then actions

// hiddenCount: probe-worthy cells beyond the lanes; chosenHexes: the hex keys the player clicked, in lane order, or
// null while the cells are picked automatically
function createProbes() {
  return { creature: null, lanes: [], hiddenCount: 0, chosenHexes: null };
}

// Forgets the player's choice, so the next reset picks the cells again; a new run from the builder calls it.
function clearProbeChoice(probes) {
  probes.chosenHexes = null;
}

// Which lane group a cell belongs to, or null when its signal says nothing a player wired: a sense organ, a cell
// holding a neuron, or a cell that acts on a signal.
function probeGroup(cell) {
  if (cell.type.senses) return 'sense';
  if (cell.neuron) return 'neuron';
  if (cell.type.needsSignal) return 'action';
  return null;
}

// Starts probing this creature's cells afresh (null: nothing to probe): the cells the player chose, if they did,
// else the senses, neurons and signalled cells.
function resetProbes(probes, creature) {
  probes.creature = creature;
  probes.lanes = [];
  probes.hiddenCount = 0;
  if (!creature) return;
  if (probes.chosenHexes) {
    const chosenCells = probes.chosenHexes.map(key => creature.cellsByHex.get(key)).filter(Boolean);
    probes.lanes = chosenCells.map((cell, i) => createProbeLane(cell, i + 1));
    return;
  }
  const candidates = creature.cells
    .map((cell, index) => ({ cell, index, group: probeGroup(cell) }))
    .filter(candidate => candidate.group);
  candidates.sort((first, second) => PROBE_GROUPS.indexOf(first.group) - PROBE_GROUPS.indexOf(second.group) ||
    first.index - second.index);
  probes.hiddenCount = Math.max(0, candidates.length - PROBE_MAX_LANES);
  probes.lanes = candidates.slice(0, PROBE_MAX_LANES).map((candidate, i) => createProbeLane(candidate.cell, i + 1));
}

// a lane for this cell, with no samples yet
function createProbeLane(cell, number) {
  const lane = { cell, number: 0, label: '', color: cell.type.color, samples: [] };
  numberProbeLane(lane, number);
  return lane;
}

// gives a lane its number, which also starts its label and matches the tag on its cell
function numberProbeLane(lane, number) {
  const cell = lane.cell;
  const neuronSymbol = cell.neuron ? ' ' + NEURONS[cell.neuron.kind].symbol : '';
  lane.number = number;
  lane.label = `${number} ${cell.type.name}${neuronSymbol}`;
}

// A click at (x, y) in the world on one of the probed creature's living cells probes it, or stops probing it if it
// already was (a new lane past the last one replaces the last). True when a cell was hit. From then on the lanes are
// the player's choice, kept through retries and respawns.
function toggleProbeAt(probes, x, y) {
  const creature = probes.creature;
  if (!creature) return false;
  const cell = creature.cells.find(candidate => !candidate.dead &&
    distanceSquared(candidate.x, candidate.y, x, y) < square(candidate.radius));
  if (!cell) return false;
  const probedLane = probes.lanes.find(lane => lane.cell === cell);
  if (probedLane) {
    probes.lanes = probes.lanes.filter(lane => lane !== probedLane);
  } else {
    if (probes.lanes.length >= PROBE_MAX_LANES) probes.lanes.pop();
    probes.lanes.push(createProbeLane(cell, 0));
  }
  probes.lanes.forEach((lane, i) => numberProbeLane(lane, i + 1));
  probes.hiddenCount = 0;
  probes.chosenHexes = probes.lanes.map(lane => hexKey(lane.cell.q, lane.cell.r));
  return true;
}

// Notes every lane's signal at the world's time; called after each sim step. Old samples drop off the left.
function recordProbes(probes, world) {
  for (const lane of probes.lanes) {
    lane.samples.push({ time: world.time, value: lane.cell.dead ? 0 : lane.cell.signal });
    while (lane.samples.length && lane.samples[0].time < world.time - PROBE_SECONDS) lane.samples.shift();
  }
}

// T: shows or hides the probes, remembered between visits
function toggleProbes(app) {
  app.isProbesShown = !app.isProbesShown;
  writeStorage('probes-shown', app.isProbesShown);
}

// The trace panel above the vitals: each lane's name, a baseline and its signal over the last PROBE_SECONDS. It
// stays up with no lanes, to say how to add one.
function drawProbes(app, world) {
  const panel = byId('hud-probes');
  const probes = app.probes;
  const isShown = app.isProbesShown && probes.creature !== null;
  panel.style.display = isShown ? 'block' : 'none';
  if (!isShown) return;
  drawProbeLanes(byId('probe-canvas'), probes, world.time, PROBE_LANE_HEIGHT);
  byId('probe-more').textContent = probeFootnote(probes);
}

// each lane's name, a baseline and its signal over the last PROBE_SECONDS before time, laneHeight px apart
function drawProbeLanes(canvas, probes, time, laneHeight) {
  const height = probes.lanes.length * laneHeight;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  const traceWidth = canvas.width - PROBE_LABEL_WIDTH;
  const startTime = time - PROBE_SECONDS;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = '10px sans-serif';
  context.textBaseline = 'middle';
  probes.lanes.forEach((lane, i) => {
    const bottom = (i + 1) * laneHeight - 3;
    const top = i * laneHeight + 3;
    context.fillStyle = '#b9c3cd';
    context.fillText(lane.label, 0, (top + bottom) / 2);
    context.strokeStyle = '#23323a';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(PROBE_LABEL_WIDTH, bottom + 0.5);
    context.lineTo(canvas.width, bottom + 0.5);
    context.stroke();
    context.strokeStyle = lane.color;
    context.lineWidth = 1.5;
    context.beginPath();
    lane.samples.forEach((sample, j) => {
      const x = PROBE_LABEL_WIDTH + (sample.time - startTime) / PROBE_SECONDS * traceWidth;
      const y = bottom - clamp01(sample.value) * (bottom - top);
      if (j === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  });
}

// ---------- The Traces window (builder, Nerve view) ----------
// Starts tracing the test tank's creature afresh; called whenever the tank is rebuilt.
function resetBuilderTraces(app) {
  const creature = app.tank.creatures.find(candidate => !candidate.debris) || null;
  clearProbeChoice(app.builderTraces);
  resetProbes(app.builderTraces, creature);
}

// the window shows only while building in the Nerve view
function showTracesWindow(app) {
  byId('traces').style.display = app.mode === 'build' && app.layer === 'nerve' ? '' : 'none';
}

// records the test tank's signals after its step and, in the Nerve view, draws them as wide as the window
function runBuilderTraces(app) {
  recordProbes(app.builderTraces, app.tank);
  if (app.layer !== 'nerve' || app.isTracesCollapsed()) return;
  const canvas = byId('traces-canvas');
  const width = Math.round(canvas.clientWidth || 0);
  if (width > 0 && canvas.width !== width) canvas.width = width;
  drawProbeLanes(canvas, app.builderTraces, app.tank.time, TRACES_LANE_HEIGHT);
  const traces = app.builderTraces;
  byId('traces-note').textContent = traces.lanes.length === 0
    ? 'No neurons, senses or signalled cells yet.'
    : (traces.hiddenCount ? `+${traces.hiddenCount} more not shown · ` : '') +
      'the numbers match the tags on the grid · Space and bound keys fire Commands';
}

// the line under the lanes: how to add one when there are none, or how many probe-worthy cells didn't fit
function probeFootnote(probes) {
  if (probes.lanes.length === 0) return 'Click a cell of yours to probe it.';
  if (probes.hiddenCount) return `+${probes.hiddenCount} more not shown (click a cell to choose)`;
  return '';
}

// the lane numbers of the builder's traces on their hexes of the grid (Nerve view)
function drawBuilderTraceTags(app, context) {
  context.font = 'bold 8px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const lane of app.builderTraces.lanes) {
    const [x, y] = hexToPixel(lane.cell.q, lane.cell.r);
    drawProbeTag(context, x + CELL_RADIUS * 0.7, y - CELL_RADIUS * 0.7, lane.number);
  }
  context.textAlign = 'start';
  context.textBaseline = 'alphabetic';
}

function drawProbeTag(context, x, y, number) {
  context.fillStyle = '#0e181de6';
  fillCircle(context, x, y, PROBE_TAG_RADIUS);
  context.fillStyle = '#dfe4ea';
  context.fillText(String(number), x, y + 0.5);
}

// the lane numbers on the probed cells, in world coordinates (the caller sets up any arena transform)
function drawProbeTags(app, context) {
  if (!app.isProbesShown) return;
  context.font = 'bold 8px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const lane of app.probes.lanes) {
    const cell = lane.cell;
    if (cell.dead || !cell.creature.alive) continue;
    drawProbeTag(context, cell.x + cell.radius * 0.7, cell.y - cell.radius * 0.7, lane.number);
  }
  context.textAlign = 'start';
}
