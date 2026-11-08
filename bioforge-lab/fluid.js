'use strict';
// Fluid system: cells burn O2 and sugar into waste, Menders make repair fluid, and fluids seep between
// touching cells from fuller to emptier. A beating Heart pumps them faster (vascular.js). Pure: no DOM.

const FUEL_BURN_SCALE = 0.25;                             // every cell burns fuelBurn * this per second at full work
const FLOW_CONDUCTANCE = 0.1;                             // flow between touching cells, per unit of fill difference
const FLOW_INTERVAL = 1 / 20 - 1e-6;                      // s between flow passes; fluids move slowly
const FLOW_SUBSTEPS = 8;                                  // pipes hold little, so flow takes small steps
const GILL_OXYGEN_RATE = 0.25;                            // O2 per second a gill makes
const GILL_SPEED_BONUS = 0.002;                           // extra O2 per second per px/s of the gill's speed
const PORE_RATE = 0.8;                                    // waste per second a surface pore dumps

const POISON_THRESHOLD = 0.75;                            // share of waste capacity at which working cells are poisoned
const POISON_DAMAGE = 6;                                  // health per second
const REPAIR_RATE = 0.5;                                  // repair fluid used per second
const REPAIR_HEALTH = 40;                                 // health restored per unit of repair fluid
const STARVING_EFFICIENCY = 0.4;                          // below this share of its fuel, a working cell is starving

const LAUNCHED_PART_MIN_FUEL = 0.05;                      // O2 and sugar a launched part needs to stay fueled
const MENDER_FULL_SHARE = 0.9;                            // a mender works until its repair fluid reaches this share

// How hard a cell works (0..1), by the cell type's `work` behaviour (data/cells.js).
const WORK_LEVELS = {
  graded: cell => clamp01(cell.signal),
  onSignal: cell => cell.signal > SIGNAL_ON ? 1 : 0,
  snare: cell => cell.snareLine || cell.signal > SIGNAL_ON ? 1 : 0,
  beating: cell => (cell.creature.resting ? 0 : 1),
  always: () => 1,
  refillRepair: cell => cell.fluids[FLUID_REPAIR] < MENDER_FULL_SHARE * cell.fluidCapacity[FLUID_REPAIR] ? 1 : 0,
  growPart: cell => {
    const growth = cell.budGrowth;
    return growth && !growth.done && !growth.waitingForProtein && cell.cooldown <= 0 ? 1 : 0;
  },
};

// What a cell's burned fuel turns into, by the cell type's `product` behaviour.
// Glands make as much as before the global burn rate was lowered, from less fuel.
const PRODUCTS = {
  repair: (cell, burned) => {
    cell.fluids[FLUID_REPAIR] += burned / FUEL_BURN_SCALE;
  },
  budPart: (cell, burned) => {
    if (cell.budGrowth) cell.budGrowth.progress += burned;
  },
};

// How hard a fuel-burning cell is working this step (0..1).
function workLevel(cell) {
  if (cell.budParent) return 0;                           // a Bud's part sleeps until it is released
  const level = WORK_LEVELS[cell.type.work];
  return level ? level(cell) : 0;
}

// Burns equal parts O2 and sugar from the cell's own store into waste; efficiency = share of the demand it got.
function burnFuel(cell, demand) {
  const fluids = cell.fluids;
  if (demand <= 0) {
    cell.efficiency = fluids[FLUID_OXYGEN] > 0.01 && fluids[FLUID_SUGAR] > 0.01 ? 1 : 0;
    return 0;
  }
  const burned = Math.min(demand, fluids[FLUID_OXYGEN], fluids[FLUID_SUGAR]);
  fluids[FLUID_OXYGEN] -= burned;
  fluids[FLUID_SUGAR] -= burned;
  fluids[FLUID_WASTE] = Math.min(2 * cell.fluidCapacity[FLUID_WASTE], fluids[FLUID_WASTE] + burned);
  cell.efficiency = burned / demand;
  return burned;
}

// Per cell: poisoning, repair, fuel burning and what each organ makes or removes.
// Released Bud parts run on what they carry: they stay alive until their O2 or sugar is used up, then rot.
function updateMetabolism(world, dt) {
  for (const cell of world.cells) {
    const fluids = cell.fluids;
    const capacity = cell.fluidCapacity;
    cell.poisoned = cell.type.fuelBurn > 0 && fluids[FLUID_WASTE] > POISON_THRESHOLD * capacity[FLUID_WASTE];
    if (cell.poisoned) cell.health -= POISON_DAMAGE * dt;
    if (fluids[FLUID_REPAIR] > 0 && cell.health < cell.maxHealth) {
      const repairUsed = Math.min(fluids[FLUID_REPAIR], REPAIR_RATE * dt);
      fluids[FLUID_REPAIR] -= repairUsed;
      cell.health = Math.min(cell.maxHealth, cell.health + repairUsed * REPAIR_HEALTH);
    }
    if (cell.creature.debris && !cell.creature.launchedPart) continue;
    if (cell.type.fuelBurn) burnAndProduce(cell, dt);
    if (cell.type.breathes) {
      const oxygenMade = (GILL_OXYGEN_RATE + GILL_SPEED_BONUS * vectorLength(cell.velocityX, cell.velocityY)) *
        world.waterOxygen * dt;
      fluids[FLUID_OXYGEN] = Math.min(capacity[FLUID_OXYGEN], fluids[FLUID_OXYGEN] + oxygenMade);
    }
    if (cell.type.dumpsWaste && cell.onSurface) {
      fluids[FLUID_WASTE] = Math.max(0, fluids[FLUID_WASTE] - PORE_RATE * dt);
    }
    if (cell.type.eatsFood && world.waterFeedRate) {
      fluids[FLUID_SUGAR] = Math.min(capacity[FLUID_SUGAR], fluids[FLUID_SUGAR] + world.waterFeedRate * dt);
    }
  }
  for (const creature of world.creatures) {
    if (creature.launchedPart) creature.fueled = isFueled(creature);
  }
}

// a working cell burns fuel for its work; glands turn the burned fuel into what they make
function burnAndProduce(cell, dt) {
  const work = workLevel(cell);
  const burned = burnFuel(cell, cell.type.fuelBurn * FUEL_BURN_SCALE * work * dt);
  cell.starving = work > 0 && cell.efficiency < STARVING_EFFICIENCY;
  const product = PRODUCTS[cell.type.product];
  if (product) product(cell, burned);
}

// fueled = it has a working cell and still carries O2 and sugar somewhere
function isFueled(creature) {
  const carries = fluid => creature.cells.reduce((sum, cell) => sum + cell.fluids[fluid], 0) > LAUNCHED_PART_MIN_FUEL;
  return creature.cells.some(cell => cell.type.fuelBurn) && carries(FLUID_OXYGEN) && carries(FLUID_SUGAR);
}

// Fluids seep between touching cells from the fuller one to the emptier one (by fill level). (A beating Heart pumps
// the links in its reach on top of this: vascular.js.) The world's seepFactor slows it all down (a level's cold water).
function updateFluidFlow(world, dt) {
  const substep = dt / FLOW_SUBSTEPS;
  for (let i = 0; i < FLOW_SUBSTEPS; i++) {
    for (const link of world.fluidLinks) flowAlongLink(link, link.conductance * world.seepFactor, substep);
  }
}

// moves each fluid between the link's two cells by their difference in fill level (conductance: flow per unit)
function flowAlongLink(link, conductance, dt) {
  const { first, second } = link;
  for (let fluid = 0; fluid < FLUID_COUNT; fluid++) {
    const firstFill = first.fluids[fluid] / first.fluidCapacity[fluid];
    const secondFill = second.fluids[fluid] / second.fluidCapacity[fluid];
    const fillDifference = firstFill - secondFill;
    let amount = conductance * fillDifference * dt;
    amount = Math.max(-second.fluids[fluid], Math.min(first.fluids[fluid], amount));
    first.fluids[fluid] -= amount;
    second.fluids[fluid] += amount;
  }
}

// burns fuel every step, and lets fluids seep between cells every FLOW_INTERVAL
function updateFluids(world, dt) {
  updateMetabolism(world, dt);
  world.flowTimer += dt;
  if (world.flowTimer < FLOW_INTERVAL) return;
  updateFluidFlow(world, world.flowTimer);
  world.flowTimer = 0;
}

registerSystem({ name: 'fluid', order: 50, switchable: true, update: updateFluids });
