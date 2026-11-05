'use strict';
// The level briefing (browser only): a card over the Lab the first time it builds for a level not won yet, with
// what the level asks, a picture of its arena, the pieces it brings to the dock and its rules, before the player
// builds (user, 2026-11-05: "now you end up in the lab but you have no idead what you're preparing for").

const BRIEFING_ARENA_WIDTH = 420;                         // px: the arena picture's width on the card
const BRIEFING_ICON_SIZE = 40;                            // px: a new piece's picture
const BRIEFING_YOU_RADIUS = 14;                           // px on the card: the ring round the player's creature
const BRIEFING_YOU_COLOR = '#e8c547';

// reads which levels this game has been briefed on, and wires the card's buttons
function setUpBriefing(app) {
  app.briefedLevels = readStorage('briefed-levels', []);
  onButton('briefing-build', () => closeBriefing(app));
  onButton('briefing-hint', toggleBriefingHint);
  byId('briefing-sheet').onclick = event => {
    if (event.target === byId('briefing-sheet')) closeBriefing(app);
  };
}

const isBriefingOpen = () => byId('briefing-sheet').style.display === 'flex';

// Each frame: opens the briefing for the chosen level the first time the Lab builds for it, unless the level is won
// already, the tutorial teaches it, or something covers the Lab.
function runBriefing(app) {
  const level = app.level;
  if (app.mode !== 'build' || !level || isBriefingOpen() || app.briefedLevels.includes(level.id)) return;
  if (app.progress.isSandboxSession || bestResult(app, level) || isTutorialCovered(app)) return;
  if (isLevelTaught(app.tutorial.record, level.id)) return;
  openBriefing(app, level);
}

// shows the level's card, and keeps that this game has seen it
function openBriefing(app, level) {
  app.briefedLevels.push(level.id);
  writeStorage('briefed-levels', app.briefedLevels);
  byId('briefing-number').textContent =
    `Level ${LEVELS.indexOf(level) + 1} · Chapter ${level.chapter}: ${CHAPTER_NAMES[level.chapter]}`;
  byId('briefing-title').textContent = level.name;
  byId('briefing-brief').textContent = level.brief;
  drawBriefingArena(byId('briefing-arena'), level, bodyDesign(app.edited));
  showNewPieces(level);
  byId('briefing-rules').innerHTML = levelRulesHtml(app, level);
  byId('briefing-hint-text').textContent = level.hint;
  byId('briefing-hint-text').style.display = 'none';
  byId('briefing-hint').textContent = 'Hint';
  byId('briefing-sheet').style.display = 'flex';
  playSound(app, 'open');
}

// hides the card, back to building
function closeBriefing(app) {
  byId('briefing-sheet').style.display = 'none';
  playSound(app, 'close');
}

// Hint shows the level's hint under the rules, and hides it again
function toggleBriefingHint() {
  const hint = byId('briefing-hint-text');
  const isShown = hint.style.display !== 'none';
  hint.style.display = isShown ? 'none' : 'block';
  byId('briefing-hint').textContent = isShown ? 'Hint' : 'Hide hint';
}

// The arena as the run starts, scaled to the card: the water, the goal, the light, the rocks and the creatures
// there from the start, with the player's creature (the design in the Lab) at its spawn.
function drawBriefingArena(canvas, level, design) {
  const run = startLevel(level, design);
  const world = run.world;
  const scale = BRIEFING_ARENA_WIDTH / world.width;
  canvas.width = BRIEFING_ARENA_WIDTH;
  canvas.height = Math.round(world.height * scale);
  const context = canvas.getContext && canvas.getContext('2d');
  if (!context) return;
  context.save();
  context.scale(scale, scale);
  drawWater(context, world, world.width, world.height);
  drawLevelGoal(context, run);
  drawDarkLamp(context, run);
  drawLight(context, world.light);
  drawWorld(context, world, null);
  context.restore();
  markPlayerStart(context, run.player.centerX * scale, run.player.centerY * scale);
}

// a ring round the player's creature at its spawn, labelled You, since it is small at the card's scale
function markPlayerStart(context, x, y) {
  context.strokeStyle = BRIEFING_YOU_COLOR;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(x, y, BRIEFING_YOU_RADIUS, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = BRIEFING_YOU_COLOR;
  context.font = '600 12px sans-serif';
  context.textAlign = 'center';
  context.fillText('You', x, y - BRIEFING_YOU_RADIUS - 4);
}

// the pieces the level brings to the dock, each with its picture, name and what it does; none: the list is hidden
function showNewPieces(level) {
  const pieces = [
    ...level.unlocks.cells.map(typeName => ({ typeName })),
    ...level.unlocks.neurons.map(kind => ({ kind })),
  ];
  const list = byId('briefing-pieces');
  list.innerHTML = '';
  for (const piece of pieces) list.appendChild(makeNewPieceRow(piece));
  byId('briefing-new').style.display = pieces.length ? 'block' : 'none';
}

// one new piece: { typeName } for a cell type or { kind } for a neuron
function makeNewPieceRow(piece) {
  const row = document.createElement('div');
  row.className = 'briefing-piece';
  const icon = document.createElement('canvas');
  icon.width = BRIEFING_ICON_SIZE;
  icon.height = BRIEFING_ICON_SIZE;
  const context = icon.getContext && icon.getContext('2d');
  if (context) {
    context.translate(BRIEFING_ICON_SIZE / 2, BRIEFING_ICON_SIZE / 2);
    if (piece.typeName) drawCellIcon(context, piece.typeName, iconZoom(BRIEFING_ICON_SIZE));
    else drawNeuronIcon(context, piece.kind, iconZoom(BRIEFING_ICON_SIZE));
  }
  const name = piece.typeName ? CELLS[piece.typeName].name : `${NEURONS[piece.kind].name} neuron`;
  const words = piece.typeName ? GUIDE_CELLS[piece.typeName] : GUIDE_NEURONS[piece.kind];
  const text = document.createElement('div');
  text.innerHTML = `<b>${name}</b><span>${words.summary}</span>`;
  row.appendChild(icon);
  row.appendChild(text);
  return row;
}
