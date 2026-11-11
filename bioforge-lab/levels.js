'use strict';
// Levels: builds a level's world from its data (data/levels.js), steps it, moves its light, checks its goal, and
// scores a win. Pure: no DOM, so a level can be run headless to prove it can be beaten.

const LEVEL_SEED = 1;                                     // random seed of every level run
const LEVEL_STEP = GAME_STEP;                             // game s per step of a level run, headless or on screen

// Levels open in order: the first one always, any other once the level before it is won. results: the best
// result per level id, which only wins have.
function isLevelEarned(results, levelIndex) {
  return levelIndex === 0 || !!results[LEVELS[levelIndex - 1].id];
}

// whether a level can be shown and played: earned, or every level while RULES.allLevelsOpen is on (on for the release)
function isLevelOpen(results, levelIndex) {
  return RULES.allLevelsOpen || isLevelEarned(results, levelIndex);
}

// The design limits a level sets, filled in from RULES where it sets none; kit: its material kit, or null for a
// biomass budget; bannedCells: the cell types the level doesn't allow; lockedCells and lockedNeurons: what no level up
// to this one has unlocked yet (levelUnlocks), which the dock doesn't show. An adventure starts with its own list.
function levelLimits(level) {
  const unlocked = level.adventure ? adventureUnlocks(level.adventure.cells, level.adventure.neurons)
    : levelUnlocks(level);
  return {
    budget: RULES.budget,
    maxCells: RULES.maxCells,
    maxNeurons: RULES.maxNeurons,
    maxFibreUnits: RULES.maxFibreUnits,
    kit: null,
    bannedCells: [],
    ...level.limits,
    lockedCells: Object.keys(CELLS).filter(typeName => !unlocked.cells.has(typeName)),
    lockedNeurons: Object.keys(NEURONS).filter(kind => !unlocked.neurons.has(kind)),
  };
}

// What a level's dock has: the pieces it and every level before it unlock (data/levels.js), plus the Nucleus, which
// every creature has. So the dock fills level by level, and each level brings what it needs.
function levelUnlocks(level) {
  const cells = new Set(Object.keys(CELLS).filter(typeName => CELLS[typeName].isNucleus));
  const neurons = new Set();
  for (const earlier of LEVELS.slice(0, LEVELS.indexOf(level) + 1)) {
    earlier.unlocks.cells.forEach(typeName => cells.add(typeName));
    earlier.unlocks.neurons.forEach(kind => neurons.add(kind));
  }
  return { cells, neurons };
}

// the level that brings a cell type or neuron kind to the dock, or null for the Nucleus and the pieces no level
// brings (they are in Free build and the Sandbox)
function levelBringing(name) {
  return LEVELS.find(level => level.unlocks.cells.includes(name) || level.unlocks.neurons.includes(name)) || null;
}

// what a locked piece in the dock says about when it opens; chosen: the level being built for, if any
function lockedPieceText(name, chosen = null) {
  if (chosen && chosen.adventure) return 'Find it on the way: some pickups and kills bring new cells.';
  const level = levelBringing(name);
  return level ? `Opens with level ${LEVELS.indexOf(level) + 1}, ${level.name}.` : 'Not in the levels yet.';
}

// whether the player has met a cell type or neuron kind: the level that brings it is earned, the last level is won,
// or no level brings it
function isPieceMet(results, name) {
  const level = levelBringing(name);
  return !level || isLastLevelWon(results) || isLevelEarned(results, LEVELS.indexOf(level));
}

// the limits with nothing locked, for a player who has won the last level
function withEverythingUnlocked(limits) {
  return { ...limits, lockedCells: [], lockedNeurons: [] };
}

// whether the last level is won, which opens every cell and neuron in every level (not every level: a player
// stuck on one would be locked out)
function isLastLevelWon(results) {
  return !!results[LEVELS[LEVELS.length - 1].id];
}

// A level in play: its world, the player's creature, the level's other creatures, the clock and the outcome
// ('won', 'lost' or null while it runs). steps counts the steps taken (replay.js). goalTime counts the seconds a
// stayNear, restIn or spread goal has been met; ruleBroken: one of the player's bodies has broken the level's host
// rule, which woke its guards. With a material kit, the player starts with the kit's leftovers as its sugar and fat,
// instead of stores two thirds full.
// design: the player's, changed by a rebuild in an adventure's den (adventure.js).
function startLevel(level, design) {
  const world = newWorld(level.arena.width, level.arena.height, { systems: level.systems, seed: LEVEL_SEED,
    seepFactor: level.seepFactor, waterOxygen: level.waterOxygen, foodSupply: createFoodSupply(level.food),
    terrain: createTerrain(level.rocks, level.currents) });
  const player = spawn(world, design, level.start.x, level.start.y, level.start.heading, 0);
  const kit = levelLimits(level).kit;
  if (kit) stockReserves(player, kitReserves(design, kit));
  const creatures = level.creatures.map(entry => (entry.at ? null : spawnLevelCreature(world, entry)));
  const run = { level, world, player, creatures, time: 0, steps: 0, goalTime: 0, outcome: null, reason: '',
    playerSpeed: 0, ruleBroken: false, design };
  if (level.adventure) startAdventure(run);
  placeLevelLight(run);
  if (world.systems.has('food')) stockFood(world);
  return run;
}

// A 'wired' creature moves only by its own wiring, like the player's; a 'hunt' creature is steered by the AI
// (ai.js) toward its nearest enemy, a 'guard' one too once the host rule is broken (checkHostRule), and a 'flee'
// one away from it (its wiring still works too). One with an arrival
// time (at) is spawned then (spawnArrivals), null until.
function spawnLevelCreature(world, entry) {
  const design = LEVEL_CREATURES[entry.design] || TEMPLATES[entry.design];
  const creature = spawn(world, design, entry.x, entry.y, entry.heading || 0, 1);
  creature.aiControlled = AI_BEHAVIOURS.includes(entry.behaviour);
  creature.aiBehaviour = creature.aiControlled ? entry.behaviour : 'hunt';
  creature.autonomous = !creature.aiControlled;
  creature.anchored = !!entry.anchored;
  return creature;
}

// the level creature behaviours the AI steers (ai.js)
const AI_BEHAVIOURS = ['hunt', 'flee', 'guard'];

// spawns the level creatures whose arrival time has come
function spawnArrivals(run) {
  run.level.creatures.forEach((entry, i) => {
    if (!run.creatures[i] && entry.at && run.time >= entry.at) run.creatures[i] = spawnLevelCreature(run.world, entry);
  });
}

// Puts the world's light where the level says: fixed, going round its path, or on the creature that carries it
// (gone with that creature's death, and before it arrives). A blinking light is gone while it is off.
function placeLevelLight(run) {
  const light = run.level.light;
  if (!light) return;
  if (!isLevelLightOn(light, run.time)) {
    run.world.light = null;
    return;
  }
  if (light.carriedBy !== undefined) {
    const carrier = run.creatures[light.carriedBy];
    run.world.light = carrier && carrier.alive ? createLight(carrier.centerX, carrier.centerY, light.range) : null;
    return;
  }
  if (light.path) {
    const [x, y] = pointAlongLoop(light.path, run.time * light.speed);
    run.world.light = createLight(x, y, light.range);
    return;
  }
  run.world.light = createLight(light.x, light.y, light.range);
}

// whether the level's light shines at this time (game s): always, unless it blinks or flashes once
function isLevelLightOn(light, time) {
  if (light.flash) return time >= light.flash.at && time < light.flash.at + light.flash.length;
  return !light.blink || time % (light.blink.on + light.blink.off) < light.blink.on;
}

// how long (game s) the level's light has been shining without a break, or 0 while it is off
function levelLightOnTime(light, time) {
  if (!light || !isLevelLightOn(light, time)) return 0;
  if (light.flash) return time - light.flash.at;
  return light.blink ? time % (light.blink.on + light.blink.off) : time;
}

// the point (px) a distance (px) along a closed path of points, wrapping round
function pointAlongLoop(points, distance) {
  const lengths = points.map((point, i) => {
    const next = points[(i + 1) % points.length];
    return vectorLength(next[0] - point[0], next[1] - point[1]);
  });
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let left = distance % total;
  for (let i = 0; i < points.length; i++) {
    if (left <= lengths[i]) {
      const share = left / lengths[i];
      const next = points[(i + 1) % points.length];
      return [points[i][0] + (next[0] - points[i][0]) * share, points[i][1] + (next[1] - points[i][1]) * share];
    }
    left -= lengths[i];
  }
  return points[0];
}

// one step of the level: brings in arriving creatures, moves the light, steps the world, then checks the host rule,
// the adventure's dens and pickups, the goal and the clock
function stepLevel(run, dt, input) {
  if (run.outcome) return;
  spawnArrivals(run);
  placeLevelLight(run);
  const lastX = run.player.centerX;
  const lastY = run.player.centerY;
  step(run.world, dt, input);
  run.time += dt;
  run.steps++;
  run.playerSpeed = vectorLength(run.player.centerX - lastX, run.player.centerY - lastY) / dt;
  checkHostRule(run);
  if (run.adventure) stepAdventure(run);
  checkLevelGoal(run, dt);
}

// A level's host rule ({ maxBodyCells }): every one of the player's bodies, its own (with the part growing on a Bud)
// and each launched Bud part, may have that many cells at most. The first time one has more, every guard wakes.
function checkHostRule(run) {
  const rule = run.level.hostRule;
  if (!rule || run.ruleBroken) return;
  const bodies = run.world.creatures.filter(creature => creature.team === run.player.team &&
    (creature === run.player || creature.launchedPart));
  if (!bodies.some(body => body.cells.length > rule.maxBodyCells)) return;
  run.ruleBroken = true;
  for (const creature of run.creatures) {
    if (creature && creature.aiBehaviour === 'guard') creature.guardAwake = true;
  }
}

// What each goal kind asks, as a test of the run after a step of dt: true once it is met.
const LEVEL_GOALS = {
  reach: (run, goal) => distanceToPlayer(run, goal.x, goal.y) < goal.radius,
  stayNear: (run, goal, dt) => {
    const light = run.world.light;
    if (light && distanceToPlayer(run, light.x, light.y) < goal.radius) run.goalTime += dt;
    return run.goalTime >= goal.seconds;
  },
  eat: (run, goal) => run.player.foodEaten >= goal.count,
  survive: (run, goal) => run.time >= goal.seconds,
  kill: (run, goal) => !!run.creatures[goal.creature] && !run.creatures[goal.creature].alive,
  spread: (run, goal, dt) => {
    run.goalTime = livingPlayerCells(run) >= goal.count ? run.goalTime + dt : 0;
    return run.goalTime >= goal.seconds;
  },
  restIn: (run, goal, dt) => {
    const isResting = distanceToPlayer(run, goal.x, goal.y) < goal.radius && run.playerSpeed < goal.speed;
    run.goalTime = isResting ? run.goalTime + dt : 0;
    return run.goalTime >= goal.seconds;
  },
};

// The player's living cells: its body's (with a Bud part still growing on it) and those of its launched Bud parts
// that still have fuel. A part that has rotted or been cut to unfueled pieces doesn't count.
function livingPlayerCells(run) {
  const player = run.player;
  const body = player.alive ? player.cells.length : 0;
  const parts = run.world.creatures.filter(creature =>
    creature.team === player.team && creature.launchedPart && creature.fueled);
  return parts.reduce((sum, part) => sum + part.cells.length, body);
}

const distanceToPlayer = (run, x, y) => vectorLength(run.player.centerX - x, run.player.centerY - y);

// the ring's place for a goal that has one (reach, restIn), or null
const goalRingOf = run => (run.level.goal.kind === 'reach' || run.level.goal.kind === 'restIn' ? run.level.goal : null);

// Won when the goal is met; lost when the player's Nucleus is gone, it was seen moving, or the time is up.
function checkLevelGoal(run, dt) {
  if (LEVEL_GOALS[run.level.goal.kind](run, run.level.goal, dt)) {
    run.outcome = 'won';
    return;
  }
  if (!run.player.alive) {
    run.outcome = 'lost';
    run.reason = 'Your Nucleus was destroyed.';
  } else if (isSeenMoving(run)) {
    run.outcome = 'lost';
    run.reason = 'Seen moving while the light was on.';
  } else if (isFalseStart(run)) {
    run.outcome = 'lost';
    run.reason = 'False start: you moved before the flash.';
  } else if (run.time >= run.level.timeLimit) {
    run.outcome = 'lost';
    run.reason = 'Out of time.';
  }
}

// A level with a stillWhileLit rule loses when the player swims faster than its speed while the light has been on
// longer than its grace time (a moment to coast to a stop).
function isSeenMoving(run) {
  const rule = run.level.stillWhileLit;
  if (!rule) return false;
  return levelLightOnTime(run.level.light, run.time) > rule.grace && run.playerSpeed > rule.speed;
}

// A level with a stillUntilLit rule loses when the player swims faster than its speed before the light first comes on.
function isFalseStart(run) {
  const rule = run.level.stillUntilLit;
  if (!rule) return false;
  return run.time < run.level.light.flash.at && run.playerSpeed > rule.speed;
}

// A win's score: its time (game s), the design's biomass, and stars: one for the win, one for beating the par time
// and one for staying within the par biomass.
function levelScore(run, design) {
  const seconds = run.time;
  const biomass = designCost(design);
  const par = run.level.par;
  const stars = 1 + (seconds <= par.seconds ? 1 : 0) + (biomass <= par.biomass ? 1 : 0);
  return { seconds, biomass, stars };
}

// Plays the level headless with no keys pressed, until it is won or lost. Returns the finished run.
function runLevel(level, design) {
  const run = startLevel(level, design);
  const input = { ability: false, heldKeys: new Set() };
  while (!run.outcome) stepLevel(run, LEVEL_STEP, input);
  return run;
}
