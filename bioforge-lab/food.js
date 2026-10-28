'use strict';
// Food: specks drift in the water, and a creature with a Mouth eats the specks that touch it. Pure: no DOM.

const FOOD_ENERGY = 1;                                    // energy per speck
const FOOD_MAX_COUNT = 14;                                // specks in the water at most
const FOOD_SPAWN_INTERVAL = 1.2;                          // s between new specks
const FOOD_EDGE_MARGIN = 30;                              // px kept free along the world's edges
const FOOD_DRIFT_SPEED = 4;                               // px/s
const FOOD_TOUCH_MARGIN = 5;                              // px added to a cell's radius for eating
const DEAD_CELL_FOOD_CHANCE = 0.35;                       // chance that a dying cell leaves a speck

function updateFood(world, dt) {
  spawnFood(world, dt);
  driftFood(world, dt);
  for (const creature of world.creatures) {
    if (creature.debris && !creature.launchedPart) continue;
    eatTouchingFood(world, creature);
  }
}

function spawnFood(world, dt) {
  world.foodTimer -= dt;
  if (world.foodTimer > 0 || world.food.length >= FOOD_MAX_COUNT) return;
  world.foodTimer = FOOD_SPAWN_INTERVAL;
  world.food.push({
    x: FOOD_EDGE_MARGIN + randomFraction(world) * (world.width - 2 * FOOD_EDGE_MARGIN),
    y: FOOD_EDGE_MARGIN + randomFraction(world) * (world.height - 2 * FOOD_EDGE_MARGIN),
  });
}

function driftFood(world, dt) {
  for (const speck of world.food) {
    speck.x += sine(world.time * 0.7 + speck.y * 0.01) * FOOD_DRIFT_SPEED * dt;
    speck.y += cosine(world.time * 0.5 + speck.x * 0.01) * FOOD_DRIFT_SPEED * dt;
  }
}

// a speck touching any cell goes into a Mouth that has room
function eatTouchingFood(world, creature) {
  const mouths = creature.cells.filter(cell => cell.type.eatsFood);
  if (!mouths.length) return;
  const touches = (speck, cell) =>
    distanceSquared(speck.x, speck.y, cell.x, cell.y) <= square(cell.radius + FOOD_TOUCH_MARGIN);
  world.food = world.food.filter(speck => {
    const mouth = mouths.find(cell => cell.fluids[FLUID_ENERGY] <= cell.fluidCapacity[FLUID_ENERGY] - FOOD_ENERGY / 2);
    if (!mouth || !creature.cells.some(cell => touches(speck, cell))) return true;
    mouth.fluids[FLUID_ENERGY] = Math.min(mouth.fluidCapacity[FLUID_ENERGY], mouth.fluids[FLUID_ENERGY] + FOOD_ENERGY);
    return false;
  });
}

// a dying cell sometimes leaves a speck behind
function leaveFoodSpeck(world, cell) {
  if (randomFraction(world) < DEAD_CELL_FOOD_CHANCE) world.food.push({ x: cell.x, y: cell.y });
}

registerSystem({ name: 'food', order: 100, switchable: true, update: updateFood, onCellDeath: leaveFoodSpeck });
