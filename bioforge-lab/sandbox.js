'use strict';
// Sandbox mode: play any creature with no budget, click the water to spawn enemies, and nobody wins or loses. Its top
// bar, its steps and drawing, and its HUD (browser only).

const SANDBOX_DESIGNS = ['wiggler', 'squirter', 'nettler', 'puffer', 'starter', 'eel', 'jelly', 'manta', 'crab'];
const OWN_DESIGN = 'mine';                                // the select value for the design in the builder
const GAME_SPEED = 2.5;                                   // game seconds per real second
const SANDBOX_MAX_STEP = 1 / 40;                          // game s; longer steps would make the springs unstable
const PLAYER_BOTTOM_MARGIN = 50;                          // px between the player's spawn and the bottom edge
const PLAYER_MIN_BOTTOM_DISTANCE = 150;                   // px
const REMOVE_CLICK_MARGIN = 4;                            // px added to a cell's radius for right-click removal
const SANDBOX_KEYS_HELP = '<b>Click</b> spawn &nbsp;<b>Right-click</b> remove &nbsp;<b>R</b> respawn<br>' +
  '<b>W</b><b>S</b> swim &nbsp;<b>A</b><b>D</b> turn &nbsp;<b>Space</b> fire &nbsp;<b>1–9</b> triggers<br>' +
  '<b>T</b> autopilot &nbsp;<b>Shift+1–6</b> view &nbsp;<b>Esc</b> builder';

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
  onSandboxButton('start-sandbox', () => startSandbox(app));
  onSandboxButton('sandbox-enemy-mode', () => toggleEnemiesIdle(app));
  onSandboxButton('sandbox-clear', () => removeEnemies(app));
  onSandboxButton('sandbox-respawn', () => spawnSandboxPlayer(app));
  onSandboxButton('sandbox-exit', () => enterBuilder(app));
  byId('sandbox-player').onchange = event => {
    spawnSandboxPlayer(app);
    event?.target?.blur?.();
  };
  byId('sandbox-enemy').onchange = event => event?.target?.blur?.();
}

const capitalize = text => text[0].toUpperCase() + text.slice(1);

// a button that lets go of the keyboard focus after a click, so Space doesn't press it again
function onSandboxButton(id, action) {
  byId(id).onclick = event => {
    action();
    event?.currentTarget?.blur?.();
  };
}

const sandboxDesign = (app, designName) => designName === OWN_DESIGN ? bodyDesign(app.edited) : TEMPLATES[designName];

function startSandbox(app) {
  app.mode = 'sandbox';
  app.world = newWorld(app.canvas.width, app.canvas.height);
  app.world.enemiesIdle = byId('sandbox-enemy-mode').textContent.endsWith('idle');
  app.player = null;
  spawnSandboxPlayer(app);
  app.stamp = null;
  app.partDrag = null;
  app.aimDragKey = null;
  hideTooltip(app);
  closeSaveMenu();
  showBuilderWindows(false);
}

// (re)spawns the player near the bottom, facing up
function spawnSandboxPlayer(app) {
  if (app.player) removeCreature(app.world, app.player);
  const design = sandboxDesign(app, byId('sandbox-player').value);
  const reach = Math.max(...design.cells.map(cell => vectorLength(...hexToPixel(cell.q, cell.r))));
  const y = app.canvas.height - Math.max(PLAYER_MIN_BOTTOM_DISTANCE, reach + PLAYER_BOTTOM_MARGIN);
  app.player = spawn(app.world, design, app.canvas.width / 2, y, 0, 0);
  app.player.spawnHealth = app.player.cells.reduce((sum, cell) => sum + cell.maxHealth, 0);   // the HUD's Body bar
}

function toggleEnemiesIdle(app) {
  app.world.enemiesIdle = !app.world.enemiesIdle;
  byId('sandbox-enemy-mode').textContent = `Enemies: ${app.world.enemiesIdle ? 'idle' : 'hunt'}`;
}

function removeEnemies(app) {
  for (const creature of app.world.creatures.filter(other => other.team !== 0)) removeCreature(app.world, creature);
}

// left click spawns the chosen enemy facing the player; right click removes the enemy or debris under the mouse
function handleSandboxClick(app, event) {
  const x = event.clientX;
  const y = event.clientY;
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

// Runs GAME_SPEED game seconds per real second, in steps of at most SANDBOX_MAX_STEP. W/S swim, A/D turn.
function stepSandbox(app, dt) {
  const isHeld = key => app.keysHeld.has(key);
  const turn = (isHeld('d') || isHeld('arrowright') ? 1 : 0) - (isHeld('a') || isHeld('arrowleft') ? 1 : 0);
  const forward = (isHeld('w') || isHeld('arrowup') ? 1 : 0) - (isHeld('s') || isHeld('arrowdown') ? 1 : 0);
  const gameTime = dt * GAME_SPEED;
  const stepCount = Math.ceil(gameTime / SANDBOX_MAX_STEP - 1e-6);
  const input = { forward, turn, ability: isHeld(' '), heldKeys: app.digitsHeld };
  for (let i = 0; i < stepCount; i++) step(app.world, gameTime / stepCount, input);
}

function drawSandbox(app) {
  drawWater(app.context, app.world, app.canvas.width, app.canvas.height);
  drawWorld(app.context, app.world, app.fluidView);
  showSandboxHud(app);
}

// the HUD: fps, mode, enemy count, the player's vitals bars and status chips, and the keys
function showSandboxHud(app) {
  const player = app.player;
  const vitals = creatureVitals(player);
  const isDead = !player.alive;
  const enemyCount = app.world.creatures.filter(creature => creature.team === 1 && !creature.debris).length;
  byId('hud-fps').textContent = `${Math.round(app.fps)} fps`;
  byId('hud-mode').textContent = 'Sandbox';
  byId('hud-enemies').textContent = `Enemies ${enemyCount}`;
  app.hudBars.forEach((bar, i) => {
    const value = clamp01(vitals.bars[i]);
    bar.fill.style.width = (value * 100).toFixed(1) + '%';
    bar.value.textContent = Math.round(value * 100) + '%';
    bar.row.classList.toggle('low', !isDead && bar.isLow(value));
  });
  byId('hud-dead').style.display = isDead ? 'block' : 'none';
  const chips = [];
  if (vitals.starving) chips.push(`<span class="chip-starving">${vitals.starving} starving</span>`);
  if (vitals.poisoned) chips.push(`<span class="chip-poisoned">${vitals.poisoned} poisoned</span>`);
  if (player.autopilot) chips.push('<span class="chip-autopilot">Autopilot</span>');
  byId('hud-chips').innerHTML = chips.join('');
  if (byId('hud-keys').innerHTML !== SANDBOX_KEYS_HELP) byId('hud-keys').innerHTML = SANDBOX_KEYS_HELP;
}

// sandbox keys: Esc back to the builder, T autopilot (the AI plays you), R respawn
function handleSandboxKey(app, key) {
  if (key === 'escape') enterBuilder(app);
  if (key === 't') app.player.autopilot = !app.player.autopilot;
  if (key === 'r') spawnSandboxPlayer(app);
}
