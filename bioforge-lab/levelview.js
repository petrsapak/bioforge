'use strict';
// Levels in the app: the levels sheet that picks one, the level card in the side column, a level run with its bar,
// arena, HUD and result box, and the best result kept per level (browser only). The rules are in levels.js.

const ARENA_TOP_MARGIN = 84;                              // px of screen above the arena, for the HUD and the bar
const ARENA_SIDE_MARGIN = 16;                             // px of screen left, right and below the arena
const GOAL_COLOR = '127,224,160';                         // r,g,b of the goal rings
const GOAL_PULSE_RATE = 2;                                // rad/s of the goal ring's breathing
const DARK_LAMP_RADIUS = 9;                               // px in the arena: a light that is off
const LEVEL_KEYS_HELP = '<b>Space</b> and bound keys: Commands &nbsp;<b>P</b> pause &nbsp;<b>.</b> one step ' +
  '&nbsp;<b>,</b> speed<br><b>T</b> signals &nbsp;<b>R</b> retry &nbsp;<b>Esc</b> builder';

// the toolbar button, the levels sheet, the level card's buttons, the level bar and the result box
function setUpLevels(app) {
  app.levelResults = readStorage('level-results', {});
  byId('show-levels').onclick = () => toggleLevelsSheet(app);
  byId('levels-sheet').onclick = event => {
    if (event.target === byId('levels-sheet')) byId('levels-sheet').style.display = 'none';
  };
  onSandboxButton('level-run', () => startLevelRun(app));
  onSandboxButton('level-hint', () => {
    app.isHintShown = !app.isHintShown;
    showLevelCard(app);
  });
  onSandboxButton('level-pick', () => toggleLevelsSheet(app));
  onSandboxButton('level-leave', () => chooseLevel(app, null));
  onSandboxButton('level-pause', () => togglePause(app));
  onSandboxButton('level-step', () => requestOneStep(app));
  onSandboxButton('level-speed', () => cycleSandboxSpeed(app));
  onSandboxButton('level-retry', () => retryLevel(app));
  onSandboxButton('level-exit', () => enterBuilder(app));
  onSandboxButton('result-retry', () => retryLevel(app));
  onSandboxButton('result-builder', () => enterBuilder(app));
  onSandboxButton('result-next', () => {
    chooseLevel(app, LEVELS[LEVELS.indexOf(app.level) + 1]);
    enterBuilder(app);
  });
  showLevelCard(app);
}

// ---------- Choosing a level ----------
// The sheet lists the levels with their best stars; a click on an open one chooses it and closes the sheet. A
// locked level says which win opens it.
function toggleLevelsSheet(app) {
  const sheet = byId('levels-sheet');
  const isOpen = sheet.style.display === 'flex';
  sheet.style.display = isOpen ? 'none' : 'flex';
  if (isOpen) return;
  const list = byId('levels-list');
  list.innerHTML = '';
  LEVELS.forEach((level, i) => {
    if (i === 0 || LEVELS[i - 1].chapter !== level.chapter) list.appendChild(chapterHeading(level.chapter));
    const isOpen = isLevelOpen(app.levelResults, i);
    const row = document.createElement('button');
    row.className = 'level-row' + (level === app.level ? ' selected' : '') + (isOpen ? '' : ' locked');
    const brief = isOpen ? level.brief : `Win “${LEVELS[i - 1].name}” to open it.`;
    row.innerHTML = `<span class="level-number">${isOpen ? i + 1 : '🔒'}</span>` +
      `<span class="level-name">${level.name}</span>` +
      `<span class="level-stars">${starsHtml(bestResult(app, level))}</span>` +
      `<span class="level-brief">${brief}</span>`;
    row.onclick = () => {
      if (!isOpen) return;
      chooseLevel(app, level);
      sheet.style.display = 'none';
    };
    list.appendChild(row);
  });
}

// the line above a chapter's levels in the sheet
function chapterHeading(chapter) {
  const heading = document.createElement('div');
  heading.className = 'chapter-heading';
  heading.textContent = `Chapter ${chapter}: ${CHAPTER_NAMES[chapter]}`;
  return heading;
}

// Makes the level the one the builder works toward (null: free build). Its limits become the builder's.
function chooseLevel(app, level) {
  app.level = level || null;
  app.isHintShown = false;
  if (app.edited.biomassLimit !== Infinity) app.edited.biomassLimit = chosenLimits(app).budget;
  showLevelCard(app);
  refreshPanel(app);
}

const bestResult = (app, level) => app.levelResults[level.id] || null;

// three stars, as many lit as the result earned (none for a level not won yet)
function starsHtml(result) {
  const earned = result ? result.stars : 0;
  return [0, 1, 2].map(i => `<b class="${i < earned ? 'lit' : ''}">★</b>`).join('');
}

// The card above the panel: the chosen level, what it asks, its limits and par, the best result, and the hint.
function showLevelCard(app) {
  const level = app.level;
  byId('level-card').style.display = level ? 'block' : 'none';
  if (!level) return;
  const limits = levelLimits(level);
  const best = bestResult(app, level);
  byId('level-card-title').innerHTML = `Level ${LEVELS.indexOf(level) + 1}: ${level.name} ` +
    `<span class="level-stars">${starsHtml(best)}</span>`;
  byId('level-card-brief').textContent = level.brief;
  byId('level-card-rules').textContent = `${limits.budget} biomass · ${level.timeLimit} s · ★ by ` +
    `${level.par.seconds} s · ★ within ${level.par.biomass} biomass`;
  byId('level-card-best').textContent = best ?
    `Best: ${best.seconds.toFixed(1)} s, ${formatBiomass(best.biomass)} biomass` : '';
  byId('level-card-hint').textContent = app.isHintShown ? level.hint : '';
  byId('level-card-hint').style.display = app.isHintShown ? 'block' : 'none';
  byId('level-hint').textContent = app.isHintShown ? 'Hide hint' : 'Hint';
}

// ---------- Running a level ----------
// Runs the builder's design in the chosen level, if it fits the level's limits.
function startLevelRun(app) {
  const design = bodyDesign(app.edited);
  const problem = buildCheck(design, chosenLimits(app));
  if (problem) {
    byId('info').textContent = `It doesn't fit this level: ${problem}.`;
    return;
  }
  app.mode = 'level';
  app.levelDesign = design;
  clearProbeChoice(app.probes);
  app.stamp = null;
  app.partDrag = null;
  app.aimDragKey = null;
  hideTooltip(app);
  closeSaveMenu();
  showModeWindows(app);
  retryLevel(app);
}

// starts the run over with the same design, running at the chosen speed
function retryLevel(app) {
  app.levelRun = startLevel(app.level, app.levelDesign);
  noteSpawnHealth(app.levelRun.player);
  resetProbes(app.probes, app.levelRun.player);
  app.paused = false;
  app.stepRequested = false;
  byId('level-result').style.display = 'none';
  showTimeControls(app);
}

// Steps the level like the Sandbox (time controls apply); when it ends, keeps a win and shows the result.
function stepLevelMode(app, dt) {
  const run = app.levelRun;
  if (run.outcome) return;
  const input = { ability: app.keysHeld.has(' '), heldKeys: app.commandKeysHeld };
  runTimeControlled(app, dt, stepTime => {
    stepLevel(run, stepTime, input);
    recordProbes(app.probes, run.world);
  });
  if (run.outcome) showLevelResult(app, run);
}

// The result box: stars, time and biomass for a win (kept if it is the best so far), or why the run was lost.
function showLevelResult(app, run) {
  const isWon = run.outcome === 'won';
  const isLast = LEVELS.indexOf(run.level) === LEVELS.length - 1;
  byId('result-title').textContent = isWon ? 'Level done' : 'Not this time';
  if (isWon) {
    const score = levelScore(run, app.levelDesign);
    const isBest = keepLevelResult(app, run.level, score);
    byId('result-stars').innerHTML = starsHtml(score);
    byId('result-text').textContent = `${score.seconds.toFixed(1)} s · ${formatBiomass(score.biomass)} biomass` +
      (isBest ? ' · new best' : '');
  } else {
    byId('result-stars').innerHTML = '';
    byId('result-text').textContent = run.reason;
  }
  byId('result-next').style.display = isWon && !isLast ? 'inline-block' : 'none';
  byId('level-result').style.display = 'block';
}

// Keeps the score if it beats the best so far: more stars, or as many in less time. Returns whether it did.
function keepLevelResult(app, level, score) {
  const best = bestResult(app, level);
  const isBetter = !best || score.stars > best.stars || (score.stars === best.stars && score.seconds < best.seconds);
  if (!isBetter) return false;
  app.levelResults[level.id] = { stars: score.stars, seconds: score.seconds, biomass: score.biomass };
  writeStorage('level-results', app.levelResults);
  return true;
}

// level keys: Esc back to the builder, R retry, P pause, . one step, , speed
function handleLevelKey(app, key) {
  if (key === 'escape') enterBuilder(app);
  if (key === 'r') retryLevel(app);
  if (key === 'p') togglePause(app);
  if (key === '.') requestOneStep(app);
  if (key === ',') cycleSandboxSpeed(app);
}

// ---------- Drawing ----------
// a left click on one of the player's cells probes it, while the signals show
function handleLevelClick(app, event) {
  if (event.button !== 0 || !app.isProbesShown) return;
  const view = arenaView(app, app.levelRun.world);
  toggleProbeAt(app.probes, (event.clientX - view.offsetX) / view.scale, (event.clientY - view.offsetY) / view.scale);
}

// where the arena sits on screen: as large as fits below the HUD, centred
function arenaView(app, world) {
  const freeWidth = app.canvas.width - 2 * ARENA_SIDE_MARGIN;
  const freeHeight = app.canvas.height - ARENA_TOP_MARGIN - ARENA_SIDE_MARGIN;
  const scale = Math.min(freeWidth / world.width, freeHeight / world.height);
  return {
    scale,
    offsetX: (app.canvas.width - world.width * scale) / 2,
    offsetY: ARENA_TOP_MARGIN + (freeHeight - world.height * scale) / 2,
  };
}

// the arena scaled to the screen, clipped to its walls: water, goal, light and creatures; then the HUD
function drawLevelMode(app) {
  const context = app.context;
  const run = app.levelRun;
  const world = run.world;
  const view = arenaView(app, world);
  context.fillStyle = '#071014';
  context.fillRect(0, 0, app.canvas.width, app.canvas.height);
  context.save();
  context.translate(view.offsetX, view.offsetY);
  context.scale(view.scale, view.scale);
  context.beginPath();
  context.rect(0, 0, world.width, world.height);
  context.clip();
  drawWater(context, world, world.width, world.height);
  drawLevelGoal(context, run);
  drawDarkLamp(context, run);
  drawLight(context, world.light);
  drawWorld(context, world, app.fluidView);
  drawProbeTags(app, context);
  context.restore();
  context.strokeStyle = '#2c4650';
  context.lineWidth = 2;
  context.strokeRect(view.offsetX, view.offsetY, world.width * view.scale, world.height * view.scale);
  drawProbes(app, world);
  showLevelHud(app, run);
}

// What the goal looks like: a breathing ring to swim into or rest in, or one round the light to stay inside.
function drawLevelGoal(context, run) {
  const goal = run.level.goal;
  const pulse = 0.5 + 0.5 * Math.sin(run.world.time * GOAL_PULSE_RATE);
  if (goal.kind === 'reach' || goal.kind === 'restIn') {
    drawGoalRing(context, goal.x, goal.y, goal.radius, GOAL_COLOR, pulse);
  }
  if (goal.kind === 'stayNear' && run.world.light) {
    drawGoalRing(context, run.world.light.x, run.world.light.y, goal.radius, GOAL_COLOR, pulse);
  }
}

// A blinking or flashing light that is off still shows where it is, as a dim lamp.
function drawDarkLamp(context, run) {
  const light = run.level.light;
  if (!light || run.world.light || light.x === undefined) return;
  context.fillStyle = 'rgba(255,240,180,0.18)';
  fillCircle(context, light.x, light.y, DARK_LAMP_RADIUS);
  context.strokeStyle = 'rgba(255,240,180,0.35)';
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(light.x, light.y, DARK_LAMP_RADIUS, 0, Math.PI * 2);
  context.stroke();
}

function drawGoalRing(context, x, y, radius, rgb, pulse) {
  context.fillStyle = `rgba(${rgb},${0.06 + 0.06 * pulse})`;
  fillCircle(context, x, y, radius);
  context.strokeStyle = `rgba(${rgb},${0.45 + 0.35 * pulse})`;
  context.lineWidth = 2;
  context.setLineDash([8, 6]);
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
}

// the HUD: the level's name, the clock against the time limit, the goal's progress, the vitals and the keys
function showLevelHud(app, run) {
  byId('hud-fps').textContent = `${Math.round(app.fps)} fps`;
  byId('hud-mode').textContent = `${LEVELS.indexOf(run.level) + 1}. ${run.level.name}`;
  byId('hud-enemies').textContent = `${run.time.toFixed(1)} / ${run.level.timeLimit} s`;
  const chips = [`<span class="chip-goal">${goalProgress(run)}</span>`];
  const stillness = stillnessRule(run);
  if (stillness) chips.push(`<span class="chip-still">${stillness}</span>`);
  showVitalsHud(app, run.world, run.player, chips);
  if (byId('hud-keys').innerHTML !== LEVEL_KEYS_HELP) byId('hud-keys').innerHTML = LEVEL_KEYS_HELP;
}

// what a level's stillness rule asks right now, or '' when it asks nothing
function stillnessRule(run) {
  const level = run.level;
  if (level.stillWhileLit) return run.world.light ? 'Light on: hold still' : 'Dark: go';
  if (level.stillUntilLit && run.time < level.light.flash.at) return 'Wait for the flash';
  return '';
}

// the goal in a few words, with how far along it is
function goalProgress(run) {
  const goal = run.level.goal;
  if (goal.kind === 'stayNear') return `Near the light ${run.goalTime.toFixed(1)} / ${goal.seconds} s`;
  if (goal.kind === 'restIn') return `At rest in the ring ${run.goalTime.toFixed(1)} / ${goal.seconds} s`;
  return 'Reach the ring';
}
