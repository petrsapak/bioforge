'use strict';
// Vascular system: a beating Heart pumps blood (every fluid: O2, sugar, waste, repair fluid and hormones) between the
// touching cells within its reach, far faster than they seep on their own. A Heart beats only while signalled, as hard
// as its signal, and burns fuel as it beats. Pure: no DOM.
// (Until 2026-11-01 a Heart pumped the vessels it sat on, laid in a Vessels view; the user chose areas instead.)

const HEART_REACH = 5;                                    // hex steps from a Heart to the cells whose links it pumps
const HEART_PUMP_CONDUCTANCE = 2.5;                       // flow per unit of fill difference per Heart at a full beat
const HEART_MAX_CONDUCTANCE = 8;                          // pumped flow per unit of fill difference, however many beat
const PUMP_INTERVAL = 1 / 20 - 1e-6;                      // s between pumping passes, as between seeping passes
const PUMP_SUBSTEPS = 4;                                  // cells hold little, so pumped blood moves in small steps

// how hard a Heart beats this step (0..1): its signal, held back by the share of its fuel it got
function heartBeat(heart) {
  if (heart.budParent) return 0;                          // a Bud's part sleeps until it is released
  return clamp01(heart.signal) * heart.efficiency;
}

// Adds each beating Heart's beat to every cell of its creature within HEART_REACH of it (cell.heartPump).
function addHeartPumping(world) {
  for (const cell of world.cells) cell.heartPump = 0;
  for (const heart of world.cells) {
    if (!heart.type.pumps) continue;
    const beat = heartBeat(heart);
    heart.beat = beat;
    if (beat <= 0) continue;
    for (const cell of heart.creature.cells) {
      if (cell.budParent === heart.budParent && hexDistance(cell, heart) <= HEART_REACH) cell.heartPump += beat;
    }
  }
}

// Every PUMP_INTERVAL each touching pair of cells that both lie in a beating Heart's reach is pumped: blood flows
// between them by their difference in fill level, as in seeping (fluid.js) but much faster. The
// world's seepFactor (a level's cold water) doesn't slow a Heart.
function updateVascular(world, dt) {
  world.pumpTimer += dt;
  if (world.pumpTimer < PUMP_INTERVAL) return;
  pumpBlood(world, world.pumpTimer);
  world.pumpTimer = 0;
}

// one pumping pass over dt game seconds
function pumpBlood(world, dt) {
  addHeartPumping(world);
  for (const link of world.fluidLinks) {
    const pumping = Math.min(link.first.heartPump, link.second.heartPump);
    link.pumpConductance = Math.min(HEART_MAX_CONDUCTANCE, HEART_PUMP_CONDUCTANCE * pumping);
  }
  const substep = dt / PUMP_SUBSTEPS;
  for (let i = 0; i < PUMP_SUBSTEPS; i++) {
    for (const link of world.fluidLinks) {
      if (link.pumpConductance > 0) flowAlongLink(link, link.pumpConductance, substep);
    }
  }
}

registerSystem({ name: 'vascular', order: 55, switchable: true, update: updateVascular });
