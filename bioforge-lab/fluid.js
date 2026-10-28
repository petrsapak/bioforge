'use strict';
// Fluid system: cells burn O2 and energy into waste, glands make repair fluid and adrenaline, and fluids seep between
// touching cells from fuller to emptier. Vessels carry them farther and faster (vascular.js). Pure: no DOM.

const FUEL_BURN_SCALE = 0.25;                             // every cell burns fuelBurn * this per second at full work
const FLOW_CONDUCTANCE = 0.4;                             // flow between touching cells, per unit of fill difference
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
const ADRENALINE_GAIN = 8;                                // adrenaline made per unit of fuel an adrenal burns
const ADRENALINE_EFFECT = 0.8;                            // extra work at a full adrenaline level

const LAUNCHED_PART_MIN_FUEL = 0.05;                      // O2 and energy a launched part needs to stay fueled
const MENDER_FULL_SHARE = 0.9;                            // a mender works until its repair fluid reaches this share

// How hard a cell works (0..1), by the cell type's `work` behaviour (data/cells.js).
const WORK_LEVELS = {
  graded: cell => clamp01(cell.signal),
  onSignal: cell => cell.signal > SIGNAL_ON ? 1 : 0,
  snare: cell => cell.snareLine || cell.signal > SIGNAL_ON ? 1 : 0,
  swimming: cell => cell.creature.swimX || cell.creature.swimY ? 1 : 0,
  always: () => 1,
  refillRepair: cell => cell.fluids[FLUID_REPAIR] < MENDER_FULL_SHARE * cell.fluidCapacity[FLUID_REPAIR] ? 1 : 0,
  growPart: cell => cell.budGrowth && !cell.budGrowth.done && cell.cooldown <= 0 ? 1 : 0,
};

// What a cell's burned fuel turns into, by the cell type's `product` behaviour.
// Glands make as much as before the global burn rate was lowered, from less fuel.
const PRODUCTS = {
  repair: (cell, burned) => {
    cell.fluids[FLUID_REPAIR] += burned / FUEL_BURN_SCALE;
  },
  adrenaline: (cell, burned) => {
    cell.fluids[FLUID_ADRENALINE] += burned * ADRENALINE_GAIN / FUEL_BURN_SCALE;
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

// Burns equal parts O2 and energy from the cell's own store into waste; efficiency = share of the demand it got.
function burnFuel(cell, demand) {
  const fluids = cell.fluids;
  if (demand <= 0) {
    cell.efficiency = fluids[FLUID_OXYGEN] > 0.01 && fluids[FLUID_ENERGY] > 0.01 ? 1 : 0;
    return 0;
  }
  const burned = Math.min(demand, fluids[FLUID_OXYGEN], fluids[FLUID_ENERGY]);
  fluids[FLUID_OXYGEN] -= burned;
  fluids[FLUID_ENERGY] -= burned;
  fluids[FLUID_WASTE] = Math.min(2 * cell.fluidCapacity[FLUID_WASTE], fluids[FLUID_WASTE] + burned);
  cell.efficiency = burned / demand;
  return burned;
}

// Per cell: adrenaline, poisoning, repair, fuel burning and what each organ makes or removes.
// Released Bud parts run on what they carry: they stay alive until their O2 or energy is used up, then rot.
function updateMetabolism(world, dt) {
  for (const cell of world.cells) {
    const fluids = cell.fluids;
    const capacity = cell.fluidCapacity;
    cell.adrenalineBoost = 1 + ADRENALINE_EFFECT * clamp01(fluids[FLUID_ADRENALINE] / capacity[FLUID_ADRENALINE]);
    decayFluids(cell, dt);
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
      const oxygenMade = (GILL_OXYGEN_RATE + GILL_SPEED_BONUS * vectorLength(cell.velocityX, cell.velocityY)) * dt;
      fluids[FLUID_OXYGEN] = Math.min(capacity[FLUID_OXYGEN], fluids[FLUID_OXYGEN] + oxygenMade);
    }
    if (cell.type.dumpsWaste && cell.onSurface) {
      fluids[FLUID_WASTE] = Math.max(0, fluids[FLUID_WASTE] - PORE_RATE * dt);
    }
    if (cell.type.eatsFood && world.waterFeedRate) {
      fluids[FLUID_ENERGY] = Math.min(capacity[FLUID_ENERGY], fluids[FLUID_ENERGY] + world.waterFeedRate * dt);
    }
  }
  for (const creature of world.creatures) {
    if (creature.launchedPart) creature.fueled = isFueled(creature);
  }
}

// fluids with a decay rate (hormones) fade over time
function decayFluids(cell, dt) {
  for (let fluid = 0; fluid < FLUID_COUNT; fluid++) {
    const decayRate = FLUIDS[fluid].decayRate;
    if (decayRate) cell.fluids[fluid] *= 1 - decayRate * dt;
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

// fueled = it has a working cell and still carries O2 and energy somewhere
function isFueled(creature) {
  const carries = fluid => creature.cells.reduce((sum, cell) => sum + cell.fluids[fluid], 0) > LAUNCHED_PART_MIN_FUEL;
  return creature.cells.some(cell => cell.type.fuelBurn) && carries(FLUID_OXYGEN) && carries(FLUID_ENERGY);
}

// Fluids seep between touching cells from the fuller one to the emptier one (by fill level); a valve without a signal
// lets nothing through. (Until 2026-10-28 a fed Heart sped up every link within 3 cells of it; now it pumps vessels.)
function updateFluidFlow(world, dt) {
  const valveOpen = cell => !cell.type.gatesFlow || cell.signal > SIGNAL_ON;
  for (const link of world.fluidLinks) link.open = valveOpen(link.first) && valveOpen(link.second);
  const substep = dt / FLOW_SUBSTEPS;
  for (let i = 0; i < FLOW_SUBSTEPS; i++) {
    for (const link of world.fluidLinks) {
      if (link.open) flowAlongLink(link, substep);
    }
  }
}

function flowAlongLink(link, dt) {
  const { first, second } = link;
  for (let fluid = 0; fluid < FLUID_COUNT; fluid++) {
    const firstFill = first.fluids[fluid] / first.fluidCapacity[fluid];
    const secondFill = second.fluids[fluid] / second.fluidCapacity[fluid];
    const fillDifference = firstFill - secondFill;
    let amount = link.conductance * FLUIDS[fluid].flowRate * fillDifference * dt;
    amount = Math.max(-second.fluids[fluid], Math.min(first.fluids[fluid], amount));
    first.fluids[fluid] -= amount;
    second.fluids[fluid] += amount;
  }
}

function updateFluids(world, dt) {
  updateMetabolism(world, dt);
  world.flowTimer += dt;
  if (world.flowTimer < FLOW_INTERVAL) return;
  updateFluidFlow(world, world.flowTimer);
  world.flowTimer = 0;
}

registerSystem({ name: 'fluid', order: 50, switchable: true, update: updateFluids });
