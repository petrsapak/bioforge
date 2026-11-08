'use strict';
// An adventure level in the app (adventure.js has the rules): the camera that follows the player, the dens and
// pickups drawn over the arena, its HUD lines, and the den's rebuild: E opens the Lab on the paused run, and
// Back to the adventure grows the new design in the den (browser only).

const CAMERA_EASE = 0.12;                                 // share of the gap to the player the camera closes per frame
const CAMERA_SNAP_DISTANCE = 900;                         // px in the arena: farther (a respawn), the camera jumps
const DEN_COLOR = '120,220,200';                          // r,g,b of a den's ring
const PICKUP_COLOR = '255,214,120';                       // r,g,b of a pickup's glow
const PICKUP_RADIUS_DRAWN = 13;                           // px in the arena
const ADVENTURE_KEYS_HELP = '<b>Your bound keys</b>: steer &nbsp;<b>E</b> rebuild in a den &nbsp;<b>R</b> back to ' +
  'the last den<br><b>P</b> pause &nbsp;<b>,</b> speed &nbsp;<b>T</b> signals &nbsp;<b>Esc</b> menu';

// The camera's place (px in the arena) for this frame: easing toward the player, kept inside the arena where the
// arena is bigger than the screen. halfWidth, halfHeight: half the screen, in arena px.
function followCamera(app, run, halfWidth, halfHeight) {
  const player = run.player;
  const camera = app.adventureCamera;
  const gap = vectorLength(player.centerX - camera.x, player.centerY - camera.y);
  const ease = gap > CAMERA_SNAP_DISTANCE || camera.run !== run ? 1 : CAMERA_EASE;
  camera.run = run;
  camera.x += (player.centerX - camera.x) * ease;
  camera.y += (player.centerY - camera.y) * ease;
  const keepInside = (value, half, size) =>
    (size <= 2 * half ? size / 2 : Math.max(half, Math.min(size - half, value)));
  return {
    x: keepInside(camera.x, halfWidth, run.world.width),
    y: keepInside(camera.y, halfHeight, run.world.height),
  };
}

// the dens and the pickups not taken yet, in the arena's coordinates
function drawAdventure(context, run) {
  if (!run.adventure) return;
  const pulse = 0.5 + 0.5 * Math.sin(run.world.time * GOAL_PULSE_RATE);
  run.level.adventure.dens.forEach((den, i) => {
    drawGoalRing(context, den.x, den.y, DEN_RADIUS, DEN_COLOR, i === run.adventure.atDen ? 1 : pulse * 0.5);
    context.fillStyle = `rgba(${DEN_COLOR},0.8)`;
    context.font = '600 15px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(`Den ${i + 1}`, den.x, den.y - DEN_RADIUS - 8);
  });
  for (const pickup of run.adventure.pickups) {
    if (!pickup.taken) drawPickup(context, pickup, pulse);
  }
}

// a pickup: a glowing blob, in the colour of the first cell it unlocks or else of its first material, and its name
function drawPickup(context, pickup, pulse) {
  const material = Object.keys(pickup.materials)[0];
  const color = pickup.cells.length ? CELLS[pickup.cells[0]].color : MATERIALS_BY_ID[material].color;
  context.fillStyle = `rgba(${PICKUP_COLOR},${0.08 + 0.1 * pulse})`;
  fillCircle(context, pickup.x, pickup.y, PICKUP_RADIUS_DRAWN * 2.2);
  context.fillStyle = color;
  fillCircle(context, pickup.x, pickup.y, PICKUP_RADIUS_DRAWN);
  context.strokeStyle = `rgba(255,255,255,${0.4 + 0.4 * pulse})`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(pickup.x, pickup.y, PICKUP_RADIUS_DRAWN, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = 'rgba(255,240,210,0.85)';
  context.font = '13px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText(pickup.name, pickup.x, pickup.y + PICKUP_RADIUS_DRAWN + 18);
}

// The adventure's HUD: no goal banner (user, 2026-11-08: no "green text about what I need to do"); the clock chip
// shows the newest news for a while, and otherwise the deaths.
function showAdventureHud(app, run) {
  byId('hud-goal').style.display = 'none';
  byId('hud-enemies').textContent = `${formatClock(run.time)} · ${adventureLine(run)}`;
  if (byId('hud-keys').innerHTML !== ADVENTURE_KEYS_HELP) byId('hud-keys').innerHTML = ADVENTURE_KEYS_HELP;
}

// the clock chip's words after the clock: the newest news, or how often the creature grew back
function adventureLine(run) {
  const news = currentNews(run);
  if (news.length) return news[news.length - 1].text;
  return `grew back ${run.adventure.deaths}×`;
}

// game s as minutes and seconds: 4:05
function formatClock(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

// adventure keys in a run: E rebuilds in a den, R gives the body up for the last den. True if the key was one.
function handleAdventureKey(app, key) {
  const run = app.levelRun;
  if (!run.adventure || run.outcome) return false;
  if (key === 'e') openDen(app);
  else if (key === 'r') giveUpBody(app);
  else return false;
  return true;
}

// R: the creature grows back at the last den, as if destroyed
function giveUpBody(app) {
  returnToDen(app.levelRun);
  playSound(app, 'start');
  resetProbes(app.probes, app.levelRun.player);
}

// E in a den: the run waits while the Lab opens on the creature, with the bank for its kit and only the cells found
// so far. The run is kept for Continue too.
function openDen(app) {
  const run = app.levelRun;
  if (run.adventure.atDen < 0) {
    showMessage('Swim into a den, a green ring, to rebuild there.');
    playSound(app, 'refuse');
    return;
  }
  app.progress.pendingRun = savedRun('level', run, app.levelDesign);
  enterBuilder(app);
  app.adventureRun = run;
  chooseLevel(app, run.level);
  showMessage(`Den ${run.adventure.atDen + 1}: rebuild with ${kitText(run.adventure.bank)}, then Back to the ` +
    'adventure.');
}

// Back to the adventure: the Lab's design grows in the den, if it fits the bank and the cells found
function resumeAdventure(app) {
  const run = app.adventureRun;
  const design = bodyDesign(app.edited);
  const problem = buildCheck(design, adventureLimits(run));
  if (problem) {
    showMessage(`It doesn't fit: ${problem}.`);
    playSound(app, 'refuse');
    return;
  }
  app.adventureRun = null;
  app.progress.pendingRun = null;
  rebuildAtDen(run, design);
  resumeLevelRun(app, design, run);
  playSound(app, 'start');
}
