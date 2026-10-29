'use strict';
// Levels: builds a level's world from its data (data/levels.js), steps it, moves its light, checks its goal, and
// scores a win. Pure: no DOM, so a level can be run headless to prove it can be beaten.

const LEVEL_SEED = 1;
const LEVEL_STEP = 1 / 40;                                // game s per step of a headless run

// Levels open in order: the first one always, any other once the level before it is won. results: the best
// result per level id, which only wins have.
function isLevelEarned(results, levelIndex) {
  return levelIndex === 0 || !!results[LEVELS[levelIndex - 1].id];
}

// whether a level can be shown and played: earned, or every level while RULES.allLevelsOpen is on (for testing)
function isLevelOpen(results, levelIndex) {
  return RULES.allLevelsOpen || isLevelEarned(results, levelIndex);
}

// the design limits a level sets, filled in from RULES where it sets none; kit: its material kit, or null for a
// biomass budget
function levelLimits(level) {
  return {
    budget: RULES.budget,
    maxCells: RULES.maxCells,
    maxNeurons: RULES.maxNeurons,
    maxFibreUnits: RULES.maxFibreUnits,
    maxVesselUnits: RULES.maxVesselUnits,
    kit: null,
    ...level.limits,
  };
}

// A level in play: its world, the player's creature, the level's other creatures, the clock and the outcome
// ('won', 'lost' or null while it runs). goalTime counts the seconds a stayNear goal has been met. With a material
// kit, the player starts with the kit's leftovers as its sugar and fat, instead of stores two thirds full.
function startLevel(level, design) {
  const world = newWorld(level.arena.width, level.arena.height, { systems: level.systems, seed: LEVEL_SEED,
    seepFactor: level.seepFactor, foodSupply: createFoodSupply(level.food) });
  const player = spawn(world, design, level.start.x, level.start.y, level.start.heading, 0);
  player.autonomous = true;
  const kit = levelLimits(level).kit;
  if (kit) stockReserves(player, kitReserves(design, kit));
  const creatures = level.creatures.map(entry => spawnLevelCreature(world, entry));
  const run = { level, world, player, creatures, time: 0, goalTime: 0, outcome: null, reason: '',
    playerSpeed: 0 };
  placeLevelLight(run);
  if (world.systems.has('food')) stockFood(world);
  return run;
}

// A 'wired' creature moves only by its own wiring, like the player's; a 'hunt' creature is steered by the AI
// (ai.js) toward its nearest enemy.
function spawnLevelCreature(world, entry) {
  const design = LEVEL_CREATURES[entry.design] || TEMPLATES[entry.design];
  const creature = spawn(world, design, entry.x, entry.y, entry.heading || 0, 1);
  creature.aiControlled = entry.behaviour === 'hunt';
  creature.autonomous = entry.behaviour !== 'hunt';
  return creature;
}

// Puts the world's light where the level says: fixed, going round its path, or on the creature that carries it
// (gone with that creature's death). A blinking light is gone while it is off.
function placeLevelLight(run) {
  const light = run.level.light;
  if (!light) return;
  if (!isLevelLightOn(light, run.time)) {
    run.world.light = null;
    return;
  }
  if (light.carriedBy !== undefined) {
    const carrier = run.creatures[light.carriedBy];
    run.world.light = carrier.alive ? createLight(carrier.centerX, carrier.centerY, light.range) : null;
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

// one step of the level: moves the light, steps the world, then checks the goal and the clock
function stepLevel(run, dt, input) {
  if (run.outcome) return;
  placeLevelLight(run);
  const lastX = run.player.centerX;
  const lastY = run.player.centerY;
  step(run.world, dt, input);
  run.time += dt;
  run.playerSpeed = vectorLength(run.player.centerX - lastX, run.player.centerY - lastY) / dt;
  checkLevelGoal(run, dt);
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
  restIn: (run, goal, dt) => {
    const isResting = distanceToPlayer(run, goal.x, goal.y) < goal.radius && run.playerSpeed < goal.speed;
    run.goalTime = isResting ? run.goalTime + dt : 0;
    return run.goalTime >= goal.seconds;
  },
};

const distanceToPlayer = (run, x, y) => vectorLength(run.player.centerX - x, run.player.centerY - y);

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
