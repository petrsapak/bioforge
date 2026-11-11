'use strict';
// Sandbox mode: play any creature with no budget, click the water to spawn enemies, and nobody wins or loses. Its top
// bar, its steps and drawing, and its HUD (browser only).

const SANDBOX_DESIGNS = ['jet', 'paddler', 'seeker', 'wiggler', 'squirter', 'nettler', 'puffer', 'starter', 'eel',
  'jelly', 'manta', 'crab'];
const OWN_DESIGN = 'mine';                                // the select value for the design in the builder
const PLAYER_BOTTOM_MARGIN = 50;                          // px between the player's spawn and the bottom edge
const PLAYER_MIN_BOTTOM_DISTANCE = 150;                   // px
const REMOVE_CLICK_MARGIN = 4;                            // px added to a cell's radius for right-click removal
const SANDBOX_SPEEDS = [1, 2, 4, 0.5, 0.25];              // game seconds per real second, cycled by the speed button
const SANDBOX_KEYS_HELP = '<b>Mouse</b> is the light (Light eyes)<br>' +
  '<b>Click</b> spawn (on your cell: probe it) &nbsp;<b>Right-click</b> remove &nbsp;<b>R</b> respawn<br>' +
  '<b>Space</b> and bound keys: Commands &nbsp;<b>P</b> pause &nbsp;<b>.</b> one step &nbsp;<b>,</b> speed<br>' +
  '<b>T</b> signals &nbsp;' +
  '<b>Shift+1–5</b> view &nbsp;<b>Esc</b> menu';

// the top bar: who you play, what a click spawns, and the enemy, clear, respawn and exit buttons
function setUpSandboxBar(app) {
  for (const selectId of ['sandbox-player', 'sandbox-enemy']) {
    for (const designName of [OWN_DESIGN, ...SANDBOX_DESIGNS]) {
      const option = document.createElement('option');
      option.value = designName;
      option.textContent = designName === OWN_DESIGN ? 'Your design' : capitalize(designName);
      byId(selectId).appendChild(option);
    }
  }
  byId('sandbox-player').value = OWN_DESIGN;
  byId('sandbox-enemy').value = SANDBOX_DESIGNS[0];
  onButton('start-sandbox', () => startSandbox(app));
  onButton('sandbox-enemy-mode', () => toggleEnemiesIdle(app));
  onButton('sandbox-clear', () => removeEnemies(app));
  onButton('sandbox-respawn', () => spawnSandboxPlayer(app));
  onButton('back-to-lab', () => enterBuilder(app));
  onButton('sandbox-pause', () => togglePause(app));
  onButton('sandbox-step', () => requestOneStep(app));
  onButton('sandbox-speed', () => cycleSandboxSpeed(app));
  byId('sandbox-player').onchange = event => {
    spawnSandboxPlayer(app);
    event?.target?.blur?.();
  };
  byId('sandbox-enemy').onchange = event => event?.target?.blur?.();
}

const capitalize = text => text[0].toUpperCase() + text.slice(1);

const sandboxDesign = (app, designName) => designName === OWN_DESIGN ? bodyDesign(app.edited) : TEMPLATES[designName];

// opens the Sandbox with a new world and the player's creature
function startSandbox(app) {
  playSound(app, 'start');
  const world = newWorld(app.canvas.width, app.canvas.height);
  world.enemiesIdle = byId('sandbox-enemy-mode').textContent.endsWith('idle');
  enterSandboxMode(app, world, null);
  spawnSandboxPlayer(app);
}

// picks up a Sandbox saved earlier (progress.js), where it was left
function resumeSandbox(app, world, player) {
  enterSandboxMode(app, world, player);
  byId('sandbox-enemy-mode').textContent = `Enemies: ${world.enemiesIdle ? 'idle' : 'hunt'}`;
  resetProbes(app.probes, player);
}

// leaves the builder for the Sandbox's world: the Sandbox's windows instead of the builder's
function enterSandboxMode(app, world, player) {
  app.mode = 'sandbox';
  app.world = world;
  app.player = player;
  app.paused = false;
  app.stepRequested = false;
  showTimeControls(app);
  clearProbeChoice(app.probes);
  app.stamp = null;
  app.partDrag = null;
  app.aimDragKey = null;
  hideTooltip(app);
  closeSaveMenu();
  showModeWindows(app);
}

// (re)spawns the player near the bottom, facing up
function spawnSandboxPlayer(app) {
  if (app.player) removeCreature(app.world, app.player);
  const design = sandboxDesign(app, byId('sandbox-player').value);
  const reach = Math.max(...design.cells.map(cell => vectorLength(...hexToPixel(cell.q, cell.r))));
  const y = app.canvas.height - Math.max(PLAYER_MIN_BOTTOM_DISTANCE, reach + PLAYER_BOTTOM_MARGIN);
  app.player = spawn(app.world, design, app.canvas.width / 2, y, 0, 0);
  noteSpawnHealth(app.player);
  resetProbes(app.probes, app.player);
}

// switches the enemies between hunting and idle
function toggleEnemiesIdle(app) {
  app.world.enemiesIdle = !app.world.enemiesIdle;
  byId('sandbox-enemy-mode').textContent = `Enemies: ${app.world.enemiesIdle ? 'idle' : 'hunt'}`;
}

// removes every creature that isn't the player's
function removeEnemies(app) {
  for (const creature of app.world.creatures.filter(other => other.team !== 0)) removeCreature(app.world, creature);
}

// Left click on one of the player's cells probes it (while the signals show); elsewhere it spawns the chosen enemy
// facing the player. Right click removes the enemy or debris under the mouse.
function handleSandboxClick(app, event) {
  const x = event.clientX;
  const y = event.clientY;
  if (event.button === 0 && app.isProbesShown && toggleProbeAt(app.probes, x, y)) return;
  if (event.button === 0) {
    const design = sandboxDesign(app, byId('sandbox-enemy').value);
    const facing = Math.atan2(app.player.centerX - x, y - app.player.centerY);
    spawn(app.world, design, x, y, facing, 1);
  } else if (event.button === 2) {
    const hit = app.world.cells.find(cell => cell.creature !== app.player &&
      distanceSquared(cell.x, cell.y, x, y) < square(cell.radius + REMOVE_CLICK_MARGIN));
    if (hit) removeCreature(app.world, hit.creature);
  }
}

// the mouse is the light that Light eyes see; it stays where the mouse last was on the water
function trackSandboxLight(app, event) {
  if (app.mode !== 'sandbox') return;
  app.sandboxLight = createLight(event.clientX, event.clientY);
}

// Runs at the chosen speed (real time at 1×, like the builder). Space and the bound keys reach the player's
// Command neurons, nothing else.
function stepSandbox(app, dt) {
  app.world.light = app.sandboxLight;
  const input = { ability: app.keysHeld.has(' '), heldKeys: app.commandKeysHeld };
  runTimeControlled(app, dt, app.world, () => {
    step(app.world, GAME_STEP, input);
    recordProbes(app.probes, app.world);
  });
}

// pauses or resumes the sandbox
function togglePause(app) {
  app.paused = !app.paused;
  app.stepRequested = false;
  showTimeControls(app);
}

// pauses the sandbox if it runs, and moves it on by one step
function requestOneStep(app) {
  app.paused = true;
  app.stepRequested = true;
  showTimeControls(app);
}

// normal speed, double, four times, half, quarter, then back to normal
function cycleSandboxSpeed(app) {
  const index = SANDBOX_SPEEDS.indexOf(app.sandboxSpeed);
  app.sandboxSpeed = SANDBOX_SPEEDS[(index + 1) % SANDBOX_SPEEDS.length];
  showTimeControls(app);
}

const speedLabel = speed => ({ 0.5: '½×', 0.25: '¼×' })[speed] || speed + '×';

// The pause button shows what a click does; the speed button shows the speed. The Sandbox bar and the level bar
// each have a set.
function showTimeControls(app) {
  for (const bar of ['sandbox', 'level']) {
    byId(bar + '-pause').textContent = app.paused ? '▶' : '⏸';
    byId(bar + '-pause').title = app.paused ? 'Run (P)' : 'Pause (P)';
    byId(bar + '-speed').textContent = speedLabel(app.sandboxSpeed);
  }
}

// What runTimeControlled keeps between frames: the game time (s) the frames have brought that no step has used yet,
// and where the world's moving things were before its last step (see drawBlended).
function createStepClock() {
  return { unusedTime: 0, world: null, points: [], fromX: [], fromY: [] };
}

// Steps a world at the chosen speed (real time at 1×), always in whole steps of GAME_STEP: a frame's time is saved
// up until it makes a step, so a run doesn't depend on the frame rate or the speed. Paused, only the one step asked
// for. stepWorld() does one step. Shared by the Sandbox and level runs.
function runTimeControlled(app, dt, world, stepWorld) {
  const clock = app.stepClock;
  if (app.paused) {
    if (app.stepRequested) stepWorld();
    app.stepRequested = false;
    clock.unusedTime = 0;
    return;
  }
  clock.unusedTime += dt * app.sandboxSpeed;
  while (clock.unusedTime >= GAME_STEP) {
    clock.unusedTime -= GAME_STEP;
    if (clock.unusedTime < GAME_STEP) rememberPositions(clock, world);   // only the frame's last step is blended
    stepWorld();
  }
}

// notes where the world's cells and spit globs are, before a step moves them
function rememberPositions(clock, world) {
  clock.world = world;
  clock.points.length = 0;
  for (const cell of world.cells) clock.points.push(cell);
  for (const glob of world.globs) clock.points.push(glob);
  clock.points.forEach((point, i) => {
    clock.fromX[i] = point.x;
    clock.fromY[i] = point.y;
  });
}

// How far (0 to 1) the frames have come from the world's last step toward its next one, which is how far between the
// two steps before it the world is drawn; 1 (drawn as it is) while paused or when no step was noted for this world.
function blendShare(app, world) {
  const clock = app.stepClock;
  return app.paused || clock.world !== world ? 1 : clamp01(clock.unusedTime / GAME_STEP);
}

// the steps taken since were not noted for blending (a run to the result), so the world is drawn as it is
function forgetBlend(app) {
  app.stepClock.world = null;
}

// Draws the world part of the way from where it was before its last step to where it is now, as far as the frames
// have come toward the next step: 40 steps a second then move smoothly at any frame rate and in slow motion. The sim
// isn't changed: every position is put back after drawing. A paused world, or one no step was noted for (a moment
// picked on the timeline), is drawn as it is.
function drawBlended(app, world, draw) {
  const clock = app.stepClock;
  const share = blendShare(app, world);
  if (share === 1) {
    draw();
    return;
  }
  const nowX = clock.points.map(point => point.x);
  const nowY = clock.points.map(point => point.y);
  clock.points.forEach((point, i) => {
    point.x = clock.fromX[i] + (nowX[i] - clock.fromX[i]) * share;
    point.y = clock.fromY[i] + (nowY[i] - clock.fromY[i]) * share;
  });
  draw();
  clock.points.forEach((point, i) => {
    point.x = nowX[i];
    point.y = nowY[i];
  });
}

// draws one Sandbox frame: water, light, world and probes
function drawSandbox(app) {
  drawWater(app.context, app.world, app.canvas.width, app.canvas.height);
  drawLight(app.context, app.world.light);
  drawBlended(app, app.world, () => drawWorld(app.context, app.world, app.fluidView));
  drawProbes(app, app.world);
  showSandboxHud(app);
}

// the HUD: fps, mode, enemy count, the player's vitals bars and status chips, and the keys
function showSandboxHud(app) {
  const enemyCount = app.world.creatures.filter(creature => creature.team === 1 && !creature.debris).length;
  byId('hud-fps').textContent = `${Math.round(app.fps)} fps`;
  byId('hud-mode').textContent = 'Sandbox';
  byId('hud-enemies').textContent = `Enemies ${enemyCount}`;
  byId('hud-goal').style.display = 'none';
  showVitalsHud(app, app.world, app.player, []);
  if (byId('hud-keys').innerHTML !== SANDBOX_KEYS_HELP) byId('hud-keys').innerHTML = SANDBOX_KEYS_HELP;
}

// The player's vitals bars (the fluid bars only while the world runs the fluid system), then its status chips:
// starving and poisoned cells, the given chips, and the time controls' state. Shared by the Sandbox and levels.
function showVitalsHud(app, world, player, extraChips) {
  const vitals = creatureVitals(player);
  const isDead = !player.alive;
  const hasFluids = world.systems.has('fluid');
  app.hudBars.forEach((bar, i) => {
    bar.row.style.display = bar.isFluid && !hasFluids ? 'none' : '';
    const value = clamp01(vitals.bars[i]);
    bar.fill.style.width = (value * 100).toFixed(1) + '%';
    bar.value.textContent = Math.round(value * 100) + '%';
    bar.row.classList.toggle('low', !isDead && bar.isLow(value));
  });
  byId('hud-dead').style.display = isDead ? 'block' : 'none';
  const chips = [...extraChips];
  if (vitals.starving) chips.push(`<span class="chip-starving">${vitals.starving} starving</span>`);
  if (vitals.poisoned) chips.push(`<span class="chip-poisoned">${vitals.poisoned} poisoned</span>`);
  if (app.paused) chips.push('<span class="chip-time">Paused</span>');
  else if (app.sandboxSpeed !== 1) {
    const speedName = app.sandboxSpeed > 1 ? 'Fast' : 'Slow motion';
    chips.push(`<span class="chip-time">${speedName} ${speedLabel(app.sandboxSpeed)}</span>`);
  }
  const chipsHtml = chips.join('');
  if (byId('hud-chips').innerHTML !== chipsHtml) byId('hud-chips').innerHTML = chipsHtml;
}

// sandbox keys: Esc the menu, R respawn, P pause, . one step, , speed
function handleSandboxKey(app, key) {
  if (key === 'escape') openPauseMenu(app);
  if (key === 'r') spawnSandboxPlayer(app);
  if (key === 'p') togglePause(app);
  if (key === '.') requestOneStep(app);
  if (key === ',') cycleSandboxSpeed(app);
}
