'use strict';
// Chemical system: the hormones in each cell set its mood. Adrenaline lowers Synapse thresholds and speeds up
// Pacemakers; Calm raises thresholds, slows Pacemakers and lowers fuel burn; Fed makes Fat cells store sugar sooner,
// faster and without loss; Starved makes them give it back sooner and faster, and lowers fuel burn. Glands make the hormones (fluid.js), and they seep and
// ride in the blood like the other fluids. Pure: no DOM.

const ADRENALINE_THRESHOLD_DROP = 0.4;                    // share of a Synapse's threshold taken off at full adrenaline
const CALM_THRESHOLD_RAISE = 0.6;                         // share added to a Synapse's threshold at full calm
const ADRENALINE_CLOCK_SPEEDUP = 0.8;                     // share a Pacemaker speeds up at full adrenaline
const CALM_CLOCK_SLOWDOWN = 0.5;                          // share a Pacemaker slows down at full calm
const CALM_BURN_CUT = 0.5;                                // share of fuel burn saved at full calm
const STARVED_BURN_CUT = 0.5;                             // share of fuel burn saved at full starved
const MIN_MOOD_FACTOR = 0.2;                              // no mood takes a threshold, clock or burn below this share
const FED_STORE_SHIFT = 0.6;                              // fill (share of sugar room) Fed takes off the store point
const FED_RELEASE_SHIFT = 0.4;                            // fill Fed takes off the release point
const STARVED_STORE_SHIFT = 0.1;                          // fill Starved adds to the store point
const STARVED_RELEASE_SHIFT = 0.35;                       // fill Starved adds to the release point
const FED_STORE_SPEEDUP = 2;                              // share Fed adds to the speed Fat stores at
const STARVED_RELEASE_SPEEDUP = 2;                        // share Starved adds to the speed Fat releases at

const FLUID_CALM = fluidIndex('calm');
const FLUID_FED = fluidIndex('fed');
const FLUID_STARVED = fluidIndex('starved');

// how full of a hormone the cell is, 0..1
function hormoneLevel(cell, fluid) {
  return clamp01(cell.fluids[fluid] / cell.fluidCapacity[fluid]);
}

// Every cell's mood from the hormones it holds now. With no hormones every factor is 1 and every shift 0, which is
// how a cell starts, so the other systems work as they would without this one.
function updateMoods(world) {
  for (const cell of world.cells) {
    const adrenaline = hormoneLevel(cell, FLUID_ADRENALINE);
    const calm = hormoneLevel(cell, FLUID_CALM);
    const starved = hormoneLevel(cell, FLUID_STARVED);
    const fed = hormoneLevel(cell, FLUID_FED) * (1 - starved);   // Starved cancels Fed: a famine opens the stores
    cell.thresholdFactor = moodFactor(1 - ADRENALINE_THRESHOLD_DROP * adrenaline + CALM_THRESHOLD_RAISE * calm);
    cell.clockFactor = moodFactor(1 + ADRENALINE_CLOCK_SPEEDUP * adrenaline - CALM_CLOCK_SLOWDOWN * calm);
    cell.burnFactor = moodFactor(1 - CALM_BURN_CUT * calm - STARVED_BURN_CUT * starved);
    cell.storeFillShift = STARVED_STORE_SHIFT * starved - FED_STORE_SHIFT * fed;
    cell.releaseFillShift = STARVED_RELEASE_SHIFT * starved - FED_RELEASE_SHIFT * fed;
    cell.storeRateFactor = 1 + FED_STORE_SPEEDUP * fed;
    cell.releaseRateFactor = 1 + STARVED_RELEASE_SPEEDUP * starved;
    cell.storeLoss = 1 - fed;                             // full Fed stores without loss
  }
}

const moodFactor = value => Math.max(MIN_MOOD_FACTOR, value);

registerSystem({ name: 'chemical', order: 52, switchable: true, update: updateMoods });
