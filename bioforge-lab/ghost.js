'use strict';
// The ghost in a level run: the creature of the run before, with another design, drawn faint where it was at the same
// moment, along the way it took. A changed design shows at once what the change did (browser only). The poses it is
// drawn from are recorded in replay.js.

const GHOST_MIN_STEPS = 80;                               // steps (2 game s) a run must last to become the ghost
const GHOST_ROUTE_STEPS = 8;                              // steps between two points of the ghost's drawn way
const GHOST_COLOR = '190,215,235';                        // r,g,b of the ghost
const GHOST_CELL_SHARE = 0.85;                            // share of a cell's radius a ghost cell is drawn with
const GHOST_LABEL_SIZE = 12;                              // px on screen: the ghost's label
const GHOST_LABEL_GAP = 6;                                // px on screen between the ghost's top and its label

// The one place a ghost is built, from a run's recording. poses: one per step from firstStep on (playerPose);
// outcome: how that run ended, or null if it was left before its end; endSeconds: its clock at its last step.
function createGhost(recording) {
  return { level: recording.level, firstStep: recording.firstStep, poses: recording.poses,
    outcome: recording.log.outcome, endSeconds: recording.endSeconds };
}

// the step count at the ghost's last pose
const ghostEndStep = ghost => ghost.firstStep + ghost.poses.length - 1;

// the Ghost button in the level bar
function setUpGhost(app) {
  app.isGhostShown = readStorage('ghost-shown', true);
  onButton('level-ghost', () => toggleGhost(app));
}

// G: shows or hides the ghost, remembered between visits
function toggleGhost(app) {
  app.isGhostShown = !app.isGhostShown;
  writeStorage('ghost-shown', app.isGhostShown);
}

// Called as a new run's recording starts, with the one before still in place. That run becomes the ghost if it was in
// the same level, lasted GHOST_MIN_STEPS and ran another design: a Retry of the same design would only hide the ghost
// under the creature, so it keeps the ghost it had. A ghost of another level goes.
function keepGhost(app, run) {
  const last = app.timeline.recording;
  const isWorthKeeping = last && last.level === run.level && last.design !== run.design &&
    last.keys.length >= GHOST_MIN_STEPS;
  if (isWorthKeeping) app.ghost = createGhost(last);
  if (app.ghost && app.ghost.level !== run.level) app.ghost = null;
}

// the ghost to draw in the level run on screen, or null: none kept, hidden, or an adventure
function shownGhost(app) {
  const hasGhost = app.isGhostShown && app.ghost && app.timeline.recording && app.ghost.level === app.levelRun.level;
  return hasGhost ? app.ghost : null;
}

// The Ghost button: lit while ghosts show, and away in an adventure, which has none.
function showGhostButton(app) {
  const button = byId('level-ghost');
  button.style.display = app.timeline.recording ? '' : 'none';
  button.classList.toggle('selected', app.isGhostShown);
}

// Draws the ghost in the arena (the context is scaled to it; scale: screen px per arena px): its whole way as a
// dashed line, and its body where it was after as many steps as the run on screen has taken, part of the way between
// two steps like the world itself. Past its end it stays where it ended, fainter, with how it ended.
function drawGhost(app, run, scale) {
  const ghost = shownGhost(app);
  if (!ghost || run.steps < ghost.firstStep) return;
  const context = app.context;
  const endStep = ghostEndStep(ghost);
  const isOver = run.steps >= endStep;
  const index = Math.min(run.steps, endStep) - ghost.firstStep;
  const pose = ghost.poses[index];
  const poseBefore = ghost.poses[Math.max(0, index - 1)];
  const share = isOver || poseBefore.length !== pose.length ? 1 : blendShare(app, run.world);
  const at = i => poseBefore[i] + (pose[i] - poseBefore[i]) * share;
  drawGhostRoute(context, ghost, scale);
  context.fillStyle = `rgba(${GHOST_COLOR},${isOver ? 0.05 : 0.1})`;
  context.strokeStyle = `rgba(${GHOST_COLOR},${isOver ? 0.3 : 0.55})`;
  context.lineWidth = 1.5;
  let top = at(1);                                        // the body's highest point, for the label above it
  for (let i = 2; i < pose.length; i += 2) {
    context.beginPath();
    context.arc(at(i), at(i + 1), CELL_RADIUS * GHOST_CELL_SHARE, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    top = Math.min(top, at(i + 1) - CELL_RADIUS);
  }
  context.fillStyle = `rgba(${GHOST_COLOR},0.8)`;
  context.font = `${GHOST_LABEL_SIZE / scale}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.fillText(ghostLabel(ghost, isOver), at(0), top - GHOST_LABEL_GAP / scale);
}

// what the ghost's label says: whose it is, and once it has ended how and when
function ghostLabel(ghost, isOver) {
  if (!isOver) return 'last run';
  const seconds = ghost.endSeconds.toFixed(1);
  if (ghost.outcome === 'won') return `last run: done in ${seconds} s`;
  return ghost.outcome === 'lost' ? `last run: lost at ${seconds} s` : `last run: left at ${seconds} s`;
}

// the way the ghost's centre took from its first step to its last, as a dashed line
function drawGhostRoute(context, ghost, scale) {
  context.strokeStyle = `rgba(${GHOST_COLOR},0.3)`;
  context.lineWidth = 1.5 / scale;
  context.setLineDash([6 / scale, 6 / scale]);
  context.beginPath();
  for (let i = 0; i < ghost.poses.length; i += GHOST_ROUTE_STEPS) context.lineTo(ghost.poses[i][0], ghost.poses[i][1]);
  const last = ghost.poses[ghost.poses.length - 1];
  context.lineTo(last[0], last[1]);
  context.stroke();
  context.setLineDash([]);
}
