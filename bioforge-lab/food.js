'use strict';
// Food: specks drift in the water, and a creature with a Mouth eats the specks that touch it. Most specks are sugar;
// mineral specks (from broken hard cells, or a level's supply) go into the eater's mineral stores. How much food
// there is, and where it appears, is the world's food supply (a level can set its own). Pure: no DOM.

const FOOD_EDGE_MARGIN = 30;                              // px kept free along the world's edges
const FOOD_DRIFT_SPEED = 4;                               // px/s
const FOOD_TOUCH_MARGIN = 5;                              // px added to a cell's radius for eating
const DEAD_CELL_FOOD_CHANCE = 0.35;                       // chance that a dying soft cell leaves a speck
const MINERAL_SPECK_AMOUNT = 1;                           // mineral in a mineral speck

// The one place a food supply is built; a level's food field overrides these:
//   sugar: sugar per speck; maxCount: specks in the water at most; interval: s between new specks;
//   specks: [x, y] places (px) of specks there at the start; startCount: more specks at random places at the start;
//   nearLight: px from the light that new specks appear within (none while the light is off), or 0 for anywhere;
//   until: game s after which no new specks appear (0 = never stops);
//   mineralSpecks: [x, y] places (px) of mineral specks there at the start
function createFoodSupply(overrides = {}) {
  return { sugar: 1, maxCount: 14, interval: 1.2, specks: [], startCount: 0, nearLight: 0, until: 0,
    mineralSpecks: [], ...overrides };
}

// spawns and drifts the food, and lets every creature eat what it touches
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
  if (world.foodTimer > 0 || world.food.filter(speck => !speck.mineral).length >= supply.maxCount) return;
  if (supply.until && world.time >= supply.until) return;
  world.foodTimer = supply.interval;
  addFoodSpeck(world);
}

// Puts the supply's first specks in the water, for a level's start: its fixed ones, its mineral ones, then its
// random ones.
function stockFood(world) {
  for (const [x, y] of world.foodSupply.specks) world.food.push({ x, y });
  for (const [x, y] of world.foodSupply.mineralSpecks) world.food.push({ x, y, mineral: true });
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

// moves every speck along a slow, wavy current
function driftFood(world, dt) {
  for (const speck of world.food) {
    speck.x += sine(world.time * 0.7 + speck.y * 0.01) * FOOD_DRIFT_SPEED * dt;
    speck.y += cosine(world.time * 0.5 + speck.x * 0.01) * FOOD_DRIFT_SPEED * dt;
  }
}

// A speck touching any cell is eaten while the creature has a Mouth: a sugar speck goes into a Mouth that has room,
// a mineral speck into a mineral store with room. The creature counts what it eats.
function eatTouchingFood(world, creature) {
  const mouths = creature.cells.filter(cell => cell.type.eatsFood);
  if (!mouths.length) return;
  const speckSugar = world.foodSupply.sugar;
  const touches = (speck, cell) =>
    distanceSquared(speck.x, speck.y, cell.x, cell.y) <= square(cell.radius + FOOD_TOUCH_MARGIN);
  world.food = world.food.filter(speck => {
    if (speck.mineral) return !eatMineralSpeck(creature, speck, touches);
    const mouth = mouths.find(cell => cell.fluids[FLUID_SUGAR] <= cell.fluidCapacity[FLUID_SUGAR] - speckSugar / 2);
    if (!mouth || !creature.cells.some(cell => touches(speck, cell))) return true;
    mouth.fluids[FLUID_SUGAR] = Math.min(mouth.fluidCapacity[FLUID_SUGAR], mouth.fluids[FLUID_SUGAR] + speckSugar);
    creature.foodEaten += 1;
    return false;
  });
}

// puts a touching mineral speck into the first mineral store with room for it; true if it was eaten
function eatMineralSpeck(creature, speck, touches) {
  const store = creature.cells.find(cell => cell.mineral <= cell.type.mineralCapacity - MINERAL_SPECK_AMOUNT);
  if (!store || !creature.cells.some(cell => touches(speck, cell))) return false;
  store.mineral += MINERAL_SPECK_AMOUNT;
  creature.mineralEaten += 1;
  return true;
}

// a dying hard cell always leaves a mineral speck behind, a soft one sometimes a sugar speck
function leaveFoodSpeck(world, cell) {
  if (isHardCell(cell)) world.food.push({ x: cell.x, y: cell.y, mineral: true });
  else if (randomFraction(world) < DEAD_CELL_FOOD_CHANCE) world.food.push({ x: cell.x, y: cell.y });
}

registerSystem({ name: 'food', order: 100, switchable: true, update: updateFood, onCellDeath: leaveFoodSpeck });
