'use strict';
// The "How to" box under the side panel: for the current view, a few steps, each a small looping animation of the
// mouse doing it with a short caption. Steps the design has already done get a tick, and the next one glows
// (browser only).

const COACH_LOOP = 3.2;                                   // s per animation loop
const COACH_WIDTH = 104;                                  // px (CSS) of one step's animation
const COACH_HEIGHT = 56;                                  // px (CSS)
const COACH_PIXEL_RATIO = 2;                              // canvas pixels per CSS px, for sharp drawing
const COACH_SCENE_SCALE = 1.35;                           // CSS px per grid px in the animations
const COACH_STEP_X = HEX_SPACING_X;                       // grid px between neighbouring cells in a row
const RIGHT_CLICK_COLOR = '#ff7a6a';

// The steps of each view. isDone(app) ticks a step off once the design shows it was done.
const COACH_STEPS = {
  body: [
    {
      caption: 'Click next to the body: add the cell',
      drawScene: drawAddCellScene,
      isDone: app => bodyCells(app.edited).length > 1,
    },
    { caption: 'Right-click: remove it', drawScene: drawRemoveCellScene },
    { caption: 'Nerves (2): make it move', drawScene: drawSwitchToNervesScene },
  ],
  nerve: [
    { caption: 'Pick a neuron in the dock', drawScene: drawPickNeuronScene },
    {
      caption: 'Click a cell: the neuron goes in',
      drawScene: drawPlaceNeuronScene,
      isDone: app => nerveUsage(app.edited).neurons > 0,
    },
    {
      caption: 'Drag from cell to cell: a fibre',
      drawScene: drawLayFibreScene,
      isDone: app => app.edited.fibres.length > 0,
    },
    { caption: 'Right-click what turns red: take it out', drawScene: drawRemoveScene },
  ],
  vessel: [
    {
      caption: 'Drag from a Heart to a cell: a vessel',
      drawScene: drawLayVesselScene,
      isDone: app => app.edited.vessels.length > 0,
    },
    { caption: 'Right-click a vessel: take it out', drawScene: drawRemoveVesselScene },
  ],
};

function createCoach() {
  return { layer: null, tiles: [], time: 0, isCollapsed: readStorage('coach-collapsed', false) };
}

// the box's fold button; remembered per browser
function setUpCoach(app) {
  const showCollapsed = () => {
    byId('coach').classList.toggle('collapsed', app.coach.isCollapsed);
    byId('coach-toggle').textContent = app.coach.isCollapsed ? '+' : '–';
  };
  showCollapsed();
  byId('coach-bar').onclick = () => {
    app.coach.isCollapsed = !app.coach.isCollapsed;
    writeStorage('coach-collapsed', app.coach.isCollapsed);
    showCollapsed();
  };
}

// makes the steps of the current view (when the view changed) and marks which are done and which is next
function refreshCoach(app) {
  const coach = app.coach;
  if (coach.layer !== app.layer) {
    coach.layer = app.layer;
    coach.tiles = COACH_STEPS[app.layer].map(makeCoachTile);
  }
  let nextFound = false;
  for (const tile of coach.tiles) {
    const isDone = !!tile.step.isDone && tile.step.isDone(app);
    const isNext = !nextFound && !!tile.step.isDone && !isDone;
    if (isNext) nextFound = true;
    tile.element.classList.toggle('done', isDone);
    tile.element.classList.toggle('next', isNext);
  }
}

// one step: its animation canvas and its caption
function makeCoachTile(step, i) {
  const list = byId('coach-steps');
  if (i === 0) list.innerHTML = '';
  const element = document.createElement('div');
  element.className = 'coach-step';
  const canvas = document.createElement('canvas');
  canvas.width = COACH_WIDTH * COACH_PIXEL_RATIO;
  canvas.height = COACH_HEIGHT * COACH_PIXEL_RATIO;
  const caption = document.createElement('span');
  caption.textContent = step.caption;
  element.appendChild(canvas);
  element.appendChild(caption);
  list.appendChild(element);
  return { step, element, canvas };
}

// advances the animations and redraws them, unless the box is folded
function runCoach(app, dt) {
  const coach = app.coach;
  coach.time = (coach.time + dt) % COACH_LOOP;
  if (coach.isCollapsed) return;
  for (const tile of coach.tiles) {
    const context = tile.canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
    context.setTransform(COACH_SCENE_SCALE * COACH_PIXEL_RATIO, 0, 0, COACH_SCENE_SCALE * COACH_PIXEL_RATIO,
      tile.canvas.width / 2, tile.canvas.height / 2);
    tile.step.drawScene(context, coach.time, app);
    context.setTransform(1, 0, 0, 1, 0, 0);
  }
}

// ---------- Timing ----------
// how far the loop time is from start to end, 0..1
function progressBetween(time, start, end) {
  return clamp01((time - start) / (end - start));
}

// smooth start and stop
function easeInOut(progress) {
  return progress * progress * (3 - 2 * progress);
}

// a point moved from one place to another between two times
function movePoint(time, start, end, [fromX, fromY], [toX, toY]) {
  const progress = easeInOut(progressBetween(time, start, end));
  return [fromX + (toX - fromX) * progress, fromY + (toY - fromY) * progress];
}

// a size that pops up from nothing, overshoots a little and settles, starting at a time
function popScale(time, start) {
  const progress = progressBetween(time, start, start + 0.3);
  return progress <= 0 ? 0 : progress * (1 + 0.4 * Math.sin(progress * Math.PI));
}

// ---------- Drawing pieces ----------
// a cell at a point, scaled about its centre; options: neuron kind, signal (0..1), shaded (as in the Nerve view)
function drawSceneCell(context, typeName, x, y, { scale = 1, neuronKind = null, signal = 0, shaded = false } = {}) {
  if (scale <= 0) return;
  const cell = makeDisplayCell(typeName, x, y);
  cell.radius = CELL_RADIUS * scale;
  cell.signal = signal;
  drawCell(context, cell, 0);
  if (shaded) {
    traceHex(context, x, y, HEX_FILL_SIZE * scale);
    context.globalAlpha = COACH_SHADE_ALPHA;
    context.fillStyle = NERVE_VIEW_SHADE;
    context.fill();
    context.globalAlpha = 1;
  }
  if (neuronKind) drawSceneNeuron(context, neuronKind, x, y, 1, signal);
}

function drawSceneNeuron(context, kind, x, y, scale, signal = 0) {
  if (scale <= 0) return;
  drawNeuronBadge(context, { x, y, neuron: { kind }, signal, boundKey: null }, CELL_RADIUS * 0.9 * scale);
}

// an empty hex, dashed: a free place on the grid
function drawEmptyHex(context, x, y) {
  traceHex(context, x, y, HEX_OUTLINE_SIZE);
  context.strokeStyle = '#5d6b77';
  context.lineWidth = 0.7;
  context.setLineDash([2, 1.5]);
  context.stroke();
  context.setLineDash([]);
}

// The mouse pointer with its tip at the point. While pressed, a ring shows the click: white for the left button,
// red for the right.
function drawCursor(context, [x, y], pressButton = null) {
  if (pressButton) {
    context.strokeStyle = pressButton === 'right' ? RIGHT_CLICK_COLOR : '#fff';
    context.lineWidth = 1.2;
    strokeCircle(context, x, y, 5);
  }
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x, y + 11);
  context.lineTo(x + 2.8, y + 8.2);
  context.lineTo(x + 5, y + 12.4);
  context.lineTo(x + 6.6, y + 11.6);
  context.lineTo(x + 4.5, y + 7.6);
  context.lineTo(x + 8, y + 7.6);
  context.closePath();
  context.fillStyle = pressButton === 'right' ? RIGHT_CLICK_COLOR : '#fff';
  context.fill();
  context.strokeStyle = '#000';
  context.lineWidth = 0.7;
  context.stroke();
}

// which button is held at this time, if the press runs from start to end
const pressAt = (time, start, end, button = 'left') => (time >= start && time < end ? button : null);

// ---------- Scenes: each draws one moment of its loop, centred on 0, 0 in grid px ----------
const COACH_REST_POINT = [30, 3];                         // where the pointer starts and returns to
const COACH_SHADE_ALPHA = 0.6;                            // the Nerve view's shade, lighter for the small pictures

// the Nucleus with a free hex beside it; the pointer clicks the free hex and the chosen cell type pops in
function drawAddCellScene(context, time, app) {
  const slot = [COACH_STEP_X / 2, 0];
  drawSceneCell(context, 'nucleus', -COACH_STEP_X / 2, 0);
  drawEmptyHex(context, ...slot);
  drawSceneCell(context, app.selectedType, ...slot, { scale: popScale(time, 1.2) });
  const pointer = time < 1.6 ? movePoint(time, 0.2, 1.0, COACH_REST_POINT, slot)
    : movePoint(time, 2.0, 2.8, slot, COACH_REST_POINT);
  drawCursor(context, pointer, pressAt(time, 1.05, 1.3));
}

// the pointer right-clicks a cell and it shrinks away
function drawRemoveCellScene(context, time) {
  const target = [COACH_STEP_X / 2, 0];
  drawSceneCell(context, 'nucleus', -COACH_STEP_X / 2, 0);
  drawEmptyHex(context, ...target);
  drawSceneCell(context, 'tissue', ...target, { scale: 1 - progressBetween(time, 1.2, 1.45) });
  const pointer = time < 1.6 ? movePoint(time, 0.2, 1.0, COACH_REST_POINT, target)
    : movePoint(time, 2.0, 2.8, target, COACH_REST_POINT);
  drawCursor(context, pointer, pressAt(time, 1.05, 1.3, 'right'));
}

// the cells fade back, a neuron pops into one, and a fibre lights up to a muscle that glows with its signal
function drawSwitchToNervesScene(context, time) {
  const shade = progressBetween(time, 0.2, 0.6);
  const left = [-COACH_STEP_X, 0];
  const right = [COACH_STEP_X, 0];
  const isLit = time > 1.6 && time % 0.8 < 0.4;
  drawSceneCell(context, 'tissue', ...left);
  drawSceneCell(context, 'tissue', 0, 0);
  drawSceneCell(context, 'muscle', ...right, { signal: isLit ? 1 : 0 });
  for (const point of [left, [0, 0], right]) {
    traceHex(context, ...point, HEX_FILL_SIZE);
    context.globalAlpha = shade * COACH_SHADE_ALPHA;
    context.fillStyle = NERVE_VIEW_SHADE;
    context.fill();
    context.globalAlpha = 1;
  }
  drawSceneNeuron(context, 'pacemaker', ...left, popScale(time, 0.7), isLit ? 1 : 0);
  if (time > 1.1) drawFibre(context, [left, [0, 0], right], null, isLit ? 1 : 0, null, 1, 1.6);
}

// a small dock of three neurons; the pointer clicks the chosen one, which lights up
function drawPickNeuronScene(context, time, app) {
  const kinds = Object.keys(NEURONS);
  const chosen = app.selectedNeuron;
  const others = kinds.filter(kind => kind !== chosen);
  const row = [others[0], chosen, others[1]];
  const isPicked = time > 1.15;
  row.forEach((kind, i) => {
    const x = (i - 1) * COACH_STEP_X * 1.2;
    traceHex(context, x, 0, HEX_FILL_SIZE * 1.1);
    context.fillStyle = '#132228';
    context.fill();
    context.strokeStyle = kind === chosen && isPicked ? SELECTION_COLOR : '#2c3f48';
    context.lineWidth = 1.4;
    context.stroke();
    drawSceneNeuron(context, kind, x, 0, 1.1);
  });
  const pointer = time < 1.6 ? movePoint(time, 0.2, 1.0, COACH_REST_POINT, [0, 2])
    : movePoint(time, 2.0, 2.8, [0, 2], COACH_REST_POINT);
  drawCursor(context, pointer, pressAt(time, 1.05, 1.3));
}

// shaded cells as in the Nerve view; the pointer clicks one and the chosen neuron pops in
function drawPlaceNeuronScene(context, time, app) {
  const target = [-COACH_STEP_X / 2, 0];
  drawSceneCell(context, 'tissue', ...target, { shaded: true });
  drawSceneCell(context, 'muscle', COACH_STEP_X / 2, 0, { shaded: true });
  drawSceneNeuron(context, app.selectedNeuron, ...target, popScale(time, 1.2));
  const pointer = time < 1.6 ? movePoint(time, 0.2, 1.0, COACH_REST_POINT, target)
    : movePoint(time, 2.0, 2.8, target, COACH_REST_POINT);
  drawCursor(context, pointer, pressAt(time, 1.05, 1.3));
}

// The pointer presses on a neuron's cell, drags to a muscle two cells away and lets go: the fibre runs through the
// middle cell, then carries the neuron's pulses and the muscle glows with them.
function drawLayFibreScene(context, time) {
  const start = [-COACH_STEP_X, 0];
  const middle = [0, 0];
  const end = [COACH_STEP_X, 0];
  const isLaid = time > 1.75;
  const isLit = isLaid && time > 2.0 && time % 0.6 < 0.3;
  drawSceneCell(context, 'tissue', ...start, { shaded: true });
  drawSceneCell(context, 'tissue', ...middle, { shaded: true });
  drawSceneCell(context, 'muscle', ...end, { shaded: true, signal: isLit ? 1 : 0 });
  drawSceneNeuron(context, 'pacemaker', ...start, 1, isLit ? 1 : 0);
  const pointer = time < 0.6 ? movePoint(time, 0, 0.5, COACH_REST_POINT, start)
    : time < 2.2 ? movePoint(time, 0.7, 1.6, start, end)
      : movePoint(time, 2.4, 3.1, end, COACH_REST_POINT);
  if (time >= 0.6 && !isLaid) {                           // the drag: a dashed line to the pointer
    context.strokeStyle = FIBRE_COLOR;
    context.lineWidth = 1;
    context.setLineDash([2, 1.5]);
    strokeLine(context, ...start, ...pointer);
    context.setLineDash([]);
  }
  if (isLaid) drawFibre(context, [start, middle, end], null, isLit ? 1 : 0, null, 1, 1.6);
  drawCursor(context, pointer, pressAt(time, 0.6, 1.75));
}

// The pointer presses on a Heart, drags to a Siphon two cells away and lets go: the vessel runs through the middle
// cell, lit while the Heart pumps it.
function drawLayVesselScene(context, time) {
  const start = [-COACH_STEP_X, 0];
  const middle = [0, 0];
  const end = [COACH_STEP_X, 0];
  const isLaid = time > 1.75;
  drawSceneCell(context, 'heart', ...start, { shaded: true });
  drawSceneCell(context, 'tissue', ...middle, { shaded: true });
  drawSceneCell(context, 'siphon', ...end, { shaded: true });
  const pointer = time < 0.6 ? movePoint(time, 0, 0.5, COACH_REST_POINT, start)
    : time < 2.2 ? movePoint(time, 0.7, 1.6, start, end)
      : movePoint(time, 2.4, 3.1, end, COACH_REST_POINT);
  if (time >= 0.6 && !isLaid) {                           // the drag: a dashed line to the pointer
    context.strokeStyle = VESSEL_PUMPED_COLOR;
    context.lineWidth = 1.4;
    context.setLineDash([2, 1.5]);
    strokeLine(context, ...start, ...pointer);
    context.setLineDash([]);
  }
  if (isLaid) drawVessel(context, [start, middle, end], 'pumped', 1, 2.4);
  drawCursor(context, pointer, pressAt(time, 0.6, 1.75));
}

// The pointer rests on a vessel, which turns red, and right-clicks it away.
function drawRemoveVesselScene(context, time) {
  const start = [-COACH_STEP_X / 2, 0];
  const end = [COACH_STEP_X / 2, 0];
  const onVessel = [0, 0];
  drawSceneCell(context, 'heart', ...start, { shaded: true });
  drawSceneCell(context, 'siphon', ...end, { shaded: true });
  const pointer = time < 1.4 ? movePoint(time, 0.1, 0.7, COACH_REST_POINT, onVessel)
    : movePoint(time, 1.6, 2.2, onVessel, COACH_REST_POINT);
  if (time < 1.15) {
    drawVessel(context, [start, end], 'pumped', 1, 2.4);
    if (time > 0.6) {
      context.strokeStyle = RIGHT_CLICK_COLOR;
      context.lineWidth = 3;
      strokeLine(context, ...start, ...end);
    }
  }
  drawCursor(context, pointer, pressAt(time, 0.95, 1.15, 'right'));
}

// The pointer rests on a fibre, which turns red, and right-clicks it away; then it does the same to the neuron.
function drawRemoveScene(context, time) {
  const start = [-COACH_STEP_X / 2, 0];
  const end = [COACH_STEP_X / 2, 0];
  const onFibre = [0, 0];
  drawSceneCell(context, 'tissue', ...start, { shaded: true });
  drawSceneCell(context, 'muscle', ...end, { shaded: true });
  const pointer = time < 1.4 ? movePoint(time, 0.1, 0.7, COACH_REST_POINT, onFibre)
    : time < 2.7 ? movePoint(time, 1.4, 1.8, onFibre, start)
      : movePoint(time, 2.7, 3.1, start, COACH_REST_POINT);
  const isFibreThere = time < 1.15;
  const isNeuronThere = time < 2.35;
  if (isFibreThere) {
    const isTargeted = time > 0.6;
    drawFibre(context, [start, end], null, 0, null, 1, 1.6);
    if (isTargeted) {
      context.strokeStyle = RIGHT_CLICK_COLOR;
      context.lineWidth = 2.4;
      strokeLine(context, ...start, ...end);
    }
  }
  if (isNeuronThere) {
    drawSceneNeuron(context, 'pacemaker', ...start, 1);
    if (time > 1.75) {
      context.strokeStyle = RIGHT_CLICK_COLOR;
      context.lineWidth = 1.2;
      strokeCircle(context, ...start, CELL_RADIUS * 0.65);
    }
  }
  drawCursor(context, pointer, pressAt(time, 0.95, 1.15, 'right') || pressAt(time, 2.15, 2.35, 'right'));
}
