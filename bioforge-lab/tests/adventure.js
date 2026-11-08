'use strict';
// Adventures (adventure.js): Metastasis starts with only its own pieces, pickups and kills fill the bank and unlock
// cells, dens rebuild and bring the player back, sleepers wake near it; a bot that only presses the keys a player
// would wins it; then the app (fake DOM) opens a den, rebuilds and swims on.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'startLevel', 'stepLevel', 'createDesignCell', 'createNeuron', 'wrapAngle',
  'adventureLimits', 'levelLimits', 'buildCheck', 'isCellLocked', 'isNeuronLocked', 'rebuildAtDen', 'returnToDen',
  'currentNews', 'FLUID_SUGAR', 'DEN_RADIUS', 'TEMPLATES', 'designWarnings', 'hexToPixel', 'CELL_RADIUS',
  'adventureSummary']);

const level = sim.LEVELS.find(entry => entry.id === 'metastasis');
const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const command = key => ({ neuron: sim.createNeuron('command'), boundKey: key });
const STEP = 1 / 40;                                      // game s

// The level's hint built: W in the Nucleus fires both back Siphons, A (left Tissue) the right one and D (right
// Tissue) the left one; a Mouth, a Gill, a Heart (pumping while W is held) and a Pore keep them going. front: more
// cells.
const steerer = (front = [], fibres = []) => ({
  cells: [cell(0, 0, 'nucleus', command('w')), cell(0, -1, 'mouth'), cell(1, -1, 'gill'),
    cell(-1, 0, 'tissue', command('a')), cell(1, 0, 'tissue', command('d')),
    cell(-1, 1, 'siphon'), cell(0, 1, 'siphon'), cell(1, 1, 'pore'), cell(-2, 1, 'heart'), ...front],
  fibres: [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1), fibre(0, 0, -2, 1), fibre(-1, 0, 0, 1), fibre(1, 0, -1, 1),
    ...fibres],
});
const START = steerer();
// with Thorns from the Bone spur at the front, and a Fat for the kit's fat
const THORNY = steerer([cell(0, -2, 'thorn'), cell(1, -2, 'thorn'), cell(-1, -1, 'thorn'), cell(2, -2, 'fat')]);
// Nettles fired by W, Thorns, Shell sides and Fat: what the Killer cell and the vessel bring
const NETTLER = steerer([cell(0, -2, 'nettle'), cell(1, -2, 'nettle'), cell(-1, -1, 'thorn'), cell(2, -2, 'thorn'),
  cell(2, -1, 'shell'), cell(-2, 0, 'shell'), cell(-1, 2, 'fat'), cell(0, 2, 'fat')],
[fibre(0, 0, 0, -2), fibre(0, 0, 1, -2)]);
// the journey bot's builds, the best first: in a den it grows the first one that fits
const BUILDS = [NETTLER, THORNY];

// The keys toward a point: A or D to turn to it, W once facing it.
function keysToward(player, x, y) {
  const turn = sim.wrapAngle(Math.atan2(x - player.centerX, -(y - player.centerY)) - player.heading);
  if (turn < -0.35) return ['a'];
  return turn > 0.35 ? ['d'] : ['w'];
}
const stepWithKeys = (run, keys) => sim.stepLevel(run, STEP, { ability: false, heldKeys: new Set(keys) });

// ---------- The start ----------
{
  const run = sim.startLevel(level, START);
  const limits = sim.adventureLimits(run);
  check('Metastasis starts in den 1 with the kit as its bank, steering by Commands, and no weapons yet',
    run.adventure.atDen === 0 && run.adventure.bank.protein === 26 && !sim.isNeuronLocked(limits, 'command') &&
    sim.isCellLocked(limits, 'thorn') && sim.isCellLocked(limits, 'nettle') && !sim.isCellLocked(limits, 'siphon'),
    JSON.stringify(run.adventure.bank));
  check('the hint\'s steerer and the bot\'s builds have no cell left unwired',
    [START, ...BUILDS].every(design =>
      !sim.designWarnings(design, []).some(warning => warning.need === 'signal')));
  check('the level\'s own limits (before the run) match: the hint\'s steerer fits, Thorns don\'t yet',
    !sim.buildCheck(START, sim.levelLimits(level)) && !!sim.buildCheck(THORNY, sim.levelLimits(level)));
  check('a rebuild outside a den, or with a cell not found yet, is refused',
    !sim.rebuildAtDen(run, THORNY) && run.player.cells.length === START.cells.length);
  for (let i = 0; i < 40; i++) stepWithKeys(run, []);
  check('nothing hunts the player in a den: every sleeper is asleep',
    run.creatures.every(creature => !creature.guardAwake));
}

// ---------- Pickups, dens, kills and coming back ----------
{
  const run = sim.startLevel(level, START);
  const spur = run.adventure.pickups.find(pickup => pickup.name === 'Bone spur');
  let seconds = 0;
  while (!spur.taken && seconds < 60) {
    stepWithKeys(run, keysToward(run.player, spur.x, spur.y));
    seconds += STEP;
  }
  check('swimming over the Bone spur adds its mineral to the bank and unlocks the Thorn, with news in the HUD',
    spur.taken && run.adventure.bank.mineral === 6 && run.adventure.cells.includes('thorn') &&
    /Thorn/.test(sim.currentNews(run).map(item => item.text).join()), `${seconds.toFixed(1)} s`);
  const den = level.adventure.dens[0];
  while (run.adventure.atDen < 0 && seconds < 120) {
    stepWithKeys(run, keysToward(run.player, den.x, den.y));
    seconds += STEP;
  }
  check('back in den 1, the Thorns fit and the rebuild grows them there',
    sim.rebuildAtDen(run, THORNY) && run.player.cells.length === THORNY.cells.length &&
    Math.hypot(run.player.centerX - den.x, run.player.centerY - den.y) < sim.DEN_RADIUS);
  const grazer = run.creatures[0];
  grazer.cells.forEach(grazerCell => {
    grazerCell.health = 0;
  });
  stepWithKeys(run, []);
  const remains = run.adventure.pickups[run.adventure.pickups.length - 1];
  check('a kill drops its remains where it died, to be picked up',
    !grazer.alive && remains.name === 'Remains' && remains.materials.protein === 6 && !remains.taken);
  run.adventure.den = 1;
  run.player.cells.forEach(playerCell => {
    playerCell.health = 0;
  });
  stepWithKeys(run, []);
  const second = level.adventure.dens[1];
  check('a destroyed Nucleus grows back at the last den, with the design last built',
    run.player.alive && run.adventure.deaths === 1 && run.player.cells.length === THORNY.cells.length &&
    Math.hypot(run.player.centerX - second.x, run.player.centerY - second.y) < sim.DEN_RADIUS && !run.outcome);
  sim.returnToDen(run);
  check('giving up the body (R) does the same', run.adventure.deaths === 2 && run.player.alive);
}

// ---------- Sleepers ----------
{
  const run = sim.startLevel(level, START);
  const grazer = run.creatures[0];
  const wakeRange = level.creatures[0].wakeRange;
  // the player swims straight at the first Grazer until it wakes
  let seconds = 0;
  while (!grazer.guardAwake && seconds < 60) {
    stepWithKeys(run, keysToward(run.player, grazer.centerX, grazer.centerY));
    seconds += STEP;
  }
  const distance = Math.hypot(grazer.centerX - run.player.centerX, grazer.centerY - run.player.centerY);
  check('a sleeper wakes once the player comes within its range, not before',
    grazer.guardAwake && distance < wakeRange && distance > wakeRange - 60 &&
    run.creatures.slice(1).every(creature => !creature.guardAwake), `${distance.toFixed(0)} px`);
  // the player gives its body up and grows back in den 1: the Grazer sleeps and swims back to its post
  sim.returnToDen(run);
  for (let i = 0; i < 40 * 30; i++) stepWithKeys(run, []);
  const post = level.creatures[0];
  check('a sleeper whose player has gone home swims back to its post',
    !grazer.guardAwake && Math.hypot(grazer.centerX - post.x, grazer.centerY - post.y) < 60,
    `${Math.hypot(grazer.centerX - post.x, grazer.centerY - post.y).toFixed(0)} px from its post`);
}

// ---------- The map ----------
{
  const run = sim.startLevel(level, START);
  const rockTiles = run.world.terrain.tiles.map(([q, r]) => sim.hexToPixel(q, r));
  const inRock = place => rockTiles.some(([x, y]) => Math.hypot(x - place.x, y - place.y) < 2 * sim.CELL_RADIUS);
  const places = [...level.adventure.pickups, ...level.adventure.dens, ...level.creatures];
  check('no pickup, den or creature starts inside rock', !places.some(inRock),
    places.filter(inRock).map(place => place.name || place.design || `${place.x},${place.y}`).join(', '));
  const secrets = level.adventure.pickups.filter(pickup => pickup.secret);
  const secretDrops = level.creatures.filter(entry => entry.drop && entry.drop.secret);
  check('there are secrets: the old scar, the capillary cache and the Mast cell, with rare cells',
    secrets.length === 2 && secretDrops.length === 1 &&
    [...secrets, ...secretDrops.map(entry => entry.drop)].every(pickup => pickup.cells.length));
  check('the summary counts secrets, pickups and deaths', sim.adventureSummary(run) === 'Secrets 0 / 3 · 0 pickups ' +
    '· grew back 0×', sim.adventureSummary(run));
  check('the Steerer template is the hint\'s build, keys bound',
    JSON.stringify(sim.TEMPLATES.steerer.cells.map(bodyCell => [bodyCell.typeName, bodyCell.boundKey || ''])) ===
    JSON.stringify(START.cells.map(bodyCell => [bodyCell.typeName, bodyCell.boundKey || ''])) &&
    level.starter === 'steerer');
}

// ---------- The Macrophage's leash and waves ----------
{
  const run = sim.startLevel(level, START);
  const boss = run.creatures[level.goal.creature];
  const entry = level.creatures[level.goal.creature];
  // the player grows back far out by den 3, the boss awake: it chases, but not past its leash
  run.adventure.den = 2;
  sim.returnToDen(run);
  boss.guardAwake = true;
  let farthest = 0;
  for (let i = 0; i < 40 * 40; i++) {
    stepWithKeys(run, []);
    farthest = Math.max(farthest, Math.hypot(boss.centerX - entry.x, boss.centerY - entry.y));
  }
  check('the Macrophage doesn\'t chase the player out of its lair: it turns back at its leash',
    farthest < entry.leash + 80 && farthest > 0, `${farthest.toFixed(0)} px from its post at most`);
  const before = run.world.creatures.length;
  const cut = boss.cells.length - Math.floor(boss.cells.length * 0.6);
  boss.cells.filter(bossCell => bossCell.typeName !== 'nucleus').slice(0, cut).forEach(bossCell => {
    bossCell.health = 0;
  });
  stepWithKeys(run, []);
  stepWithKeys(run, []);
  check('broken to 60% of its cells, the Macrophage sends out its first wave, a Phagocyte',
    run.adventure.waves[level.goal.creature] === 1 &&
    run.world.creatures.filter(creature => creature.aiBehaviour === 'hunt' && !creature.debris).length >= 1 &&
    /a Phagocyte/.test(sim.currentNews(run).map(item => item.text).join()), `${before} creatures before`);
}

const FIGHT_RANGE = 250;                                  // px within which the bots turn on a hunter
// The nearest enemy hunting the player within range (px), but not the level's goal, or null: the bots turn on it,
// as a player would.
function nearestHunter(run, range) {
  const goal = run.creatures[level.goal.creature];
  const hunters = run.world.creatures.filter(creature => creature.team !== run.player.team && creature.alive &&
    !creature.debris && creature !== goal && (creature.guardAwake || creature.aiBehaviour === 'hunt'));
  const distance = creature => Math.hypot(creature.centerX - run.player.centerX, creature.centerY - run.player.centerY);
  const near = hunters.filter(creature => distance(creature) < range);
  return near.length ? near.reduce((best, creature) => (distance(creature) < distance(best) ? creature : best)) : null;
}

// ---------- The Macrophage ----------
// a fight from den 4 with the given design, ramming the Macrophage, and back to the den (R) once it is crippled
// (it hasn't moved for 15 s); the bank is filled about as the journey fills it
function bossFight(design, seconds) {
  const run = sim.startLevel(level, START);
  run.adventure.den = 3;
  run.adventure.bank = { protein: 200, sugar: 50, fat: 6, mineral: 40 };
  run.adventure.cells.push('thorn', 'shell', 'nettle', 'mender');
  sim.returnToDen(run);
  sim.rebuildAtDen(run, design);
  const boss = run.creatures[level.goal.creature];
  const start = run.time;
  let stuck = { time: start, x: 0, y: 0 };
  while (!run.outcome && run.time - start < seconds) {
    const target = nearestHunter(run, FIGHT_RANGE) || boss;
    stepWithKeys(run, keysToward(run.player, target.centerX, target.centerY));
    if (run.time - stuck.time < 15) continue;
    if (Math.hypot(run.player.centerX - stuck.x, run.player.centerY - stuck.y) < 25) sim.returnToDen(run);
    stuck = { time: run.time, x: run.player.centerX, y: run.player.centerY };
  }
  return { run, seconds: run.time - start };
}
{
  // a win with Nettles is the journey's, below: with its waves out, the fight is long and goes either way
  const unarmed = bossFight(START, 120);
  check('the Macrophage outlasts the starting creature for 2 min', !unarmed.run.outcome &&
    unarmed.run.creatures[level.goal.creature].alive);
}

// ---------- The whole journey ----------
// A bot that presses only W, A and D: to the pickups and dens in order, and at the Killer cell that drops the Nettle
// until it can take the drop; rebuilding in each den with the best build that fits; to the nearest food when it runs
// low on sugar; back to the last den (R) when the sugar is all gone, or when it hasn't moved for 15 s unless it is
// pushing at the Macrophage; then at the Macrophage. It turns on hunters near it. It steers straight, so the route's
// points are clear of rock between them, and after growing back it walks the route again from that den. It leaves
// out the Bud tissue in the lymph node's corner, by the Killer cell: it isn't needed.
const ROUTE = [
  { x: 700, y: 1150 }, { den: 0 }, { x: 1100, y: 300 }, { x: 1450, y: 1250 }, { den: 1 }, { x: 2650, y: 500 },
  { kill: 6 }, { den: 2 }, { x: 4200, y: 330 }, { x: 4380, y: 480 }, { x: 4380, y: 800 }, { den: 3 },
  { boss: true },
];
const sugarOf = player => player.cells.reduce((sum, bodyCell) =>
  sum + bodyCell.fluids[sim.FLUID_SUGAR] + 2 * (bodyCell.fat || 0), 0);
// where a waypoint is now: a den, a point, the creature to kill or then its drop (null once taken), or null for the
// Macrophage
function waypointPlace(run, waypoint) {
  if (waypoint.den !== undefined) return level.adventure.dens[waypoint.den];
  if (waypoint.boss) return null;
  if (waypoint.kill === undefined) return waypoint;
  const prey = run.creatures[waypoint.kill];
  if (prey.alive) return { x: prey.centerX, y: prey.centerY, isPrey: true };
  const drop = run.adventure.pickups.find(pickup => pickup.name === level.creatures[waypoint.kill].drop.name &&
    Math.hypot(pickup.x - prey.centerX, pickup.y - prey.centerY) < 1);
  return drop.taken ? null : drop;
}
// plays the journey with the bot until it is won or 1800 game s have gone; returns the run
function playJourney() {
  const run = sim.startLevel(level, START);
  const boss = run.creatures[level.goal.creature];
  let stop = 0;
  let stuck = { time: 0, x: 0, y: 0 };
  let deaths = 0;
  while (!run.outcome && run.time < 1800) {
    if (run.adventure.deaths !== deaths) {
      deaths = run.adventure.deaths;
      stop = Math.min(stop, ROUTE.findIndex(waypoint => waypoint.den === run.adventure.den) + 1);
    }
    const waypoint = ROUTE[stop];
    const place = waypointPlace(run, waypoint);
    if (!place && waypoint.kill !== undefined) {
      stop++;
      continue;
    }
    const player = run.player;
    if (sugarOf(player) < 0.5) {
      sim.returnToDen(run);
      continue;
    }
    const food = run.world.food.filter(speck => !speck.mineral);
    const isHungry = sugarOf(player) < 4 && food.length;
    if (place && !place.isPrey && !isHungry && Math.hypot(place.x - player.centerX, place.y - player.centerY) < 50) {
      if (waypoint.den !== undefined) BUILDS.find(design => sim.rebuildAtDen(run, design));
      stop++;
      continue;
    }
    const nearestFood = isHungry ? food.reduce((best, speck) => (Math.hypot(speck.x - player.centerX,
      speck.y - player.centerY) < Math.hypot(best.x - player.centerX, best.y - player.centerY) ? speck : best)) : null;
    const enemy = nearestHunter(run, FIGHT_RANGE);
    const target = nearestFood || (enemy && { x: enemy.centerX, y: enemy.centerY }) || place ||
      { x: boss.centerX, y: boss.centerY };
    stepWithKeys(run, keysToward(player, target.x, target.y));
    const isAtBoss = Math.hypot(boss.centerX - run.player.centerX, boss.centerY - run.player.centerY) < 250;
    if (run.time - stuck.time < 15 || isAtBoss) continue;
    if (Math.hypot(run.player.centerX - stuck.x, run.player.centerY - stuck.y) < 25) sim.returnToDen(run);
    stuck = { time: run.time, x: run.player.centerX, y: run.player.centerY };
  }
  return run;
}
{
  const journey = playJourney();
  check('a bot pressing only the steering keys, rebuilding on the way, wins the journey in 5 to 20 min',
    journey.outcome === 'won' && journey.time > 300 && journey.time < 1200,
    `${journey.outcome} at ${journey.time.toFixed(0)} s, grew back ${journey.adventure.deaths}×, ` +
    `${journey.adventure.pickups.filter(pickup => pickup.taken).length} pickups`);
  check('the journey is the same every time', playJourney().time === journey.time);
}

// ---------- The app ----------
const { byId, fire, runFrames, readGlobal, loadTestDesign } = startApp();
readGlobal('RULES.allLevelsOpen = true');
runFrames(3);
loadTestDesign(START, 'Steerer');
readGlobal(`chooseLevel(testApp, LEVELS.find(level => level.id === 'metastasis'))`);
readGlobal('startLevelRun(testApp)');
runFrames(5);
check('the run follows the player: the camera shows a window of the arena, not all of it',
  readGlobal('arenaView(testApp, testApp.levelRun.world).scale') >
    readGlobal('testApp.canvas.width / testApp.levelRun.world.width') &&
  byId('level-retry').textContent === 'Back to den' && /E<\/b> rebuild/.test(byId('hud-keys').innerHTML));
fire('window', 'keydown', { key: 'e' });
runFrames(2);
check('E in den 1 opens the Lab on the waiting run, with Back to the adventure on the run button',
  readGlobal('testApp.mode') === 'build' && readGlobal('!!testApp.adventureRun') &&
  byId('run-next-label').textContent === 'Back to the adventure');
readGlobal('testApp.adventureRun.adventure.cells.push("thorn"); testApp.adventureRun.adventure.bank.mineral = 6');
loadTestDesign(THORNY, 'Thorny');
byId('run-next-level').onclick();
runFrames(3);
check('Back to the adventure grows the new design in the den and the run goes on where it was',
  readGlobal('testApp.mode') === 'level' &&
  readGlobal('testApp.levelRun.player.cells.length') === THORNY.cells.length &&
  readGlobal('testApp.levelRun.time') > 0 && !readGlobal('testApp.adventureRun'));
const timeBefore = readGlobal('testApp.levelRun.time');
fire('window', 'keydown', { key: 'r' });
runFrames(2);
check('R in an adventure goes back to the last den instead of starting over',
  readGlobal('testApp.levelRun.adventure.deaths') === 1 && readGlobal('testApp.levelRun.time') >= timeBefore);

done();
