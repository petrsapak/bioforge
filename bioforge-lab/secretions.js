'use strict';
// Secretions: glands that act while signalled. Acid dissolves hard enemy cells it touches (shell, thorns,
// mineralized cells), protease dissolves soft ones and feeds the gland on them, and a Mineralizer spends stored
// mineral to harden its creature's own cells. None of them hurt their own creature. Pure: no DOM.

const ACID_HARD_DAMAGE = 24;                              // health per second to a touching hard cell, before armour
const ACID_SOFT_DAMAGE = 2;                               // health per second to a touching soft cell
const PROTEASE_DAMAGE = 10;                               // health per second to a touching soft cell
const PROTEASE_SUGAR_YIELD = 0.1;                         // sugar the gland gains per point of health it takes
const SECRETION_TOUCH_MARGIN = 12;                        // px added to the two radii: a secretion seeps a little way
const MINERALIZE_TIME = 1.5;                              // game s to harden one cell
const MINERALIZE_REACH = 2;                               // hexes from the Mineralizer that it can harden
const MINERALIZER_CAPACITY = 6;                           // mineral a Mineralizer stores
const MINERALIZED_DAMAGE_FACTOR = 0.5;                    // share of damage a hardened cell takes

// How each secretion acts on a touching enemy cell, per second: damage dealt, and sugar the gland gains per damage.
const SECRETIONS = {
  acid: target => ({ damage: isHardCell(target) ? ACID_HARD_DAMAGE : ACID_SOFT_DAMAGE, sugarYield: 0 }),
  protease: target => ({ damage: isHardCell(target) ? 0 : PROTEASE_DAMAGE, sugarYield: PROTEASE_SUGAR_YIELD }),
};

// a cell built with mineral (Shell, Thorn) or hardened by a Mineralizer: acid eats it, protease can't
function isHardCell(cell) {
  return cell.mineralized || !!cell.type.recipe.mineral;
}

// Every signalled gland that is fed enough acts this step; the test tank's water refills Mineralizers.
function updateSecretions(world, dt) {
  for (const cell of world.cells) {
    if (cell.type.storesMineral && world.waterMineralRate) refillMineralFromWater(world, cell, dt);
    if (!isGlandReady(cell)) continue;
    if (cell.type.secretes) secreteOnTouchingEnemies(world, cell, dt);
    if (cell.type.mineralizes) mineralizeStep(cell, dt);
  }
}

// signalled, fed enough and part of a creature that can act
function isGlandReady(cell) {
  const canAct = !cell.creature.debris || cell.creature.launchedPart;
  return canAct && cell.signal > SIGNAL_ON && cell.efficiency > MIN_FIRING_EFFICIENCY;
}

// the gland's secretion works on every cell of another creature (debris too) that touches it
function secreteOnTouchingEnemies(world, gland, dt) {
  const power = gland.efficiency * gland.adrenalineBoost;
  const secretion = SECRETIONS[gland.type.secretes];
  for (const other of world.creatures) {
    if (other.team === gland.creature.team || !isNearBounds(gland, other.bounds)) continue;
    for (const target of other.cells) {
      const reach = gland.radius + target.radius + SECRETION_TOUCH_MARGIN;
      if (distanceSquared(gland.x, gland.y, target.x, target.y) > reach * reach) continue;
      const { damage, sugarYield } = secretion(target);
      if (!damage) continue;
      const healthBefore = Math.max(0, target.health);
      damageCell(target, damage * power * dt);
      feedGland(gland, (healthBefore - Math.max(0, target.health)) * sugarYield);
    }
  }
}

// whether the cell is within touching distance of a creature's bounding box (none yet: assume it is)
function isNearBounds(cell, bounds) {
  if (!bounds) return true;
  const reach = 2 * CELL_RADIUS + SECRETION_TOUCH_MARGIN;
  return cell.x > bounds.minX - reach && cell.x < bounds.maxX + reach &&
    cell.y > bounds.minY - reach && cell.y < bounds.maxY + reach;
}

// adds sugar to the gland's store, up to its room
function feedGland(gland, sugar) {
  if (!sugar) return;
  gland.fluids[FLUID_SUGAR] = Math.min(gland.fluidCapacity[FLUID_SUGAR], gland.fluids[FLUID_SUGAR] + sugar);
}

// Hardens the nearest soft cell of its own creature, one every MINERALIZE_TIME, while it has mineral.
function mineralizeStep(mineralizer, dt) {
  if (mineralizer.mineral < 1) return;
  const target = nearestSoftCell(mineralizer);
  if (!target) return;
  mineralizer.mineralizeProgress += dt / MINERALIZE_TIME;
  if (mineralizer.mineralizeProgress < 1) return;
  mineralizer.mineralizeProgress = 0;
  mineralizer.mineral -= 1;
  target.mineralized = true;
}

// the creature's living soft cell nearest the Mineralizer (itself included), within MINERALIZE_REACH hexes; ties go
// to the cell listed first
function nearestSoftCell(mineralizer) {
  let nearest = null;
  let nearestDistance = MINERALIZE_REACH + 1;
  for (const cell of mineralizer.creature.cells) {
    if (cell.dead || isHardCell(cell)) continue;
    const distance = hexDistance(cell, mineralizer);
    if (distance >= nearestDistance) continue;
    nearestDistance = distance;
    nearest = cell;
  }
  return nearest;
}

// the builder's test tank: the water slowly fills Mineralizers, so a design can be tried out without food
function refillMineralFromWater(world, cell, dt) {
  cell.mineral = Math.min(cell.type.mineralCapacity, cell.mineral + world.waterMineralRate * dt);
}

registerSystem({ name: 'secretions', order: 62, switchable: true, update: updateSecretions });
