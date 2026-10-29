'use strict';
// Food: specks drift in the water, and a creature with a Mouth eats the specks that touch it. How much food there is,
// and where it appears, is the world's food supply (a level can set its own). Pure: no DOM.

const FOOD_EDGE_MARGIN = 30;                              // px kept free along the world's edges
const FOOD_DRIFT_SPEED = 4;                               // px/s
const FOOD_TOUCH_MARGIN = 5;                              // px added to a cell's radius for eating
const DEAD_CELL_FOOD_CHANCE = 0.35;                       // chance that a dying cell leaves a speck

// The one place a food supply is built; a level's food field overrides these:
//   sugar: sugar per speck; maxCount: specks in the water at most; interval: s between new specks;
//   specks: [x, y] places (px) of specks there at the start; startCount: more specks at random places at the start;
//   nearLight: px from the light that new specks appear within (none while the light is off), or 0 for anywhere;
//   until: game s after which no new specks appear (0 = never stops)
function createFoodSupply(overrides = {}) {
  return { sugar: 1, maxCount: 14, interval: 1.2, specks: [], startCount: 0, nearLight: 0, until: 0, ...overrides };
}

function updateFood(world, dt) {
  spawnFood(world, dt);
  driftFood(world, dt);
  for (const creature of world.creatures) {
    if (creature.debris && !creature.launchedPart) continue;
    eatTouchingFood(world, creature);
  }
}

// a new speck every interval, while there are fewer than the supply's most and its time hasn't run out
function spawnFood(world, dt) {
  const supply = world.foodSupply;
  world.foodTimer -= dt;
  if (world.foodTimer > 0 || world.food.length >= supply.maxCount) return;
  if (supply.until && world.time >= supply.until) return;
  world.foodTimer = supply.interval;
  addFoodSpeck(world);
}

// Puts the supply's first specks in the water, for a level's start: its fixed ones, then its random ones.
function stockFood(world) {
  for (const [x, y] of world.foodSupply.specks) world.food.push({ x, y });
  for (let i = 0; i < world.foodSupply.startCount; i++) addFoodSpeck(world);
}

// a speck at a random place in the water, or near the light if the supply says so
function addFoodSpeck(world) {
  const nearLight = world.foodSupply.nearLight;
  if (!nearLight) {
    world.food.push({
      x: FOOD_EDGE_MARGIN + randomFraction(world) * (world.width - 2 * FOOD_EDGE_MARGIN),
      y: FOOD_EDGE_MARGIN + randomFraction(world) * (world.height - 2 * FOOD_EDGE_MARGIN),
    });
    return;
  }
  const light = world.light;
  if (!light) return;
  const angle = TAU * randomFraction(world);
  const distance = nearLight * Math.sqrt(randomFraction(world));
  world.food.push({
    x: Math.max(FOOD_EDGE_MARGIN, Math.min(world.width - FOOD_EDGE_MARGIN, light.x + cosine(angle) * distance)),
    y: Math.max(FOOD_EDGE_MARGIN, Math.min(world.height - FOOD_EDGE_MARGIN, light.y + sine(angle) * distance)),
  });
}

function driftFood(world, dt) {
  for (const speck of world.food) {
    speck.x += sine(world.time * 0.7 + speck.y * 0.01) * FOOD_DRIFT_SPEED * dt;
    speck.y += cosine(world.time * 0.5 + speck.x * 0.01) * FOOD_DRIFT_SPEED * dt;
  }
}

// a speck touching any cell goes into a Mouth that has room; the creature counts what it eats
function eatTouchingFood(world, creature) {
  const mouths = creature.cells.filter(cell => cell.type.eatsFood);
  if (!mouths.length) return;
  const speckSugar = world.foodSupply.sugar;
  const touches = (speck, cell) =>
    distanceSquared(speck.x, speck.y, cell.x, cell.y) <= square(cell.radius + FOOD_TOUCH_MARGIN);
  world.food = world.food.filter(speck => {
    const mouth = mouths.find(cell => cell.fluids[FLUID_SUGAR] <= cell.fluidCapacity[FLUID_SUGAR] - speckSugar / 2);
    if (!mouth || !creature.cells.some(cell => touches(speck, cell))) return true;
    mouth.fluids[FLUID_SUGAR] = Math.min(mouth.fluidCapacity[FLUID_SUGAR], mouth.fluids[FLUID_SUGAR] + speckSugar);
    creature.foodEaten += 1;
    return false;
  });
}

// a dying cell sometimes leaves a speck behind
function leaveFoodSpeck(world, cell) {
  if (randomFraction(world) < DEAD_CELL_FOOD_CHANCE) world.food.push({ x: cell.x, y: cell.y });
}

registerSystem({ name: 'food', order: 100, switchable: true, update: updateFood, onCellDeath: leaveFoodSpeck });
