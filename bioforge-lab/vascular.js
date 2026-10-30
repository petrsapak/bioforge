'use strict';
// Vascular system: vessels carry blood (the vascular fluids: O2, sugar, waste and repair fluid) straight between the
// two cells at their ends. A fed Heart on a vessel pumps it, and a Valve on it shuts it unless signalled. Routing,
// units, adding a design's vessels to a creature, cutting broken ones, and the blood flow. Pure: no DOM.
// A design vessel is { from: { q, r }, to: { q, r } }, routed from cell centre to cell centre like a fibre
// (fibres.js). It has no direction: blood flows from the fuller end to the emptier one, and the cells between the ends
// only carry it.

const VESSEL_IDLE_CONDUCTANCE = 0.4;                      // flow per unit of fill difference with no Heart beating
const VESSEL_PUMP_CONDUCTANCE = 4;                        // extra flow per fed Heart on the vessel
const VESSEL_MAX_CONDUCTANCE = 8;                         // flow per unit of fill difference, however many Hearts beat
const VESSEL_SUBSTEPS = 4;                                // pipes hold little, so blood moves in small steps
// indexes into cell.fluids of the fluids that travel in blood: all of them, hormones too (until 2026-10-30
// hormones only seeped, and stayed out of vessels)
const BLOOD_FLUIDS = FLUIDS.map((fluid, index) => index);

// total vessel units of a design's vessels routed through its cells; vessels without a route count nothing
function vesselUnits(design) {
  return routedUnits(design.cells, design.vessels || []);
}

// ---------- Vessels in the world ----------
// Adds the creature's missing vessels from a design vessel list: those whose two end cells are both alive and in the
// same group (the body, or one growing Bud part), routed through that group's living cells. Called at spawn, and when
// cells regrow. Vessels already there are kept.
function connectVessels(world, creature, designVessels) {
  if (!designVessels || !designVessels.length) return;
  const areaFor = createGroupAreas(creature);
  for (const designVessel of designVessels) {
    const first = liveCellAt(creature, designVessel.from.q, designVessel.from.r);
    const second = liveCellAt(creature, designVessel.to.q, designVessel.to.r);
    if (!first || !second || first.budParent !== second.budParent) continue;
    if (world.vessels.some(vessel => joinsCells(vessel, first, second))) continue;
    const route = routeFibre(areaFor(first.budParent), first, second);
    if (route) world.vessels.push(createVessel(routeCells(creature, route), route.units));
  }
}

// whether the vessel runs between these two cells, either way round
function joinsCells(vessel, first, second) {
  return (vessel.first === first && vessel.second === second) || (vessel.first === second && vessel.second === first);
}

// The one place a world vessel is built. path: the cells it runs through, from one end to the other; hearts and
// valves: the cells among them that pump or shut it; pumping: how hard its Hearts beat this step (sum of their
// efficiency); open: whether blood passes this step.
function createVessel(path, units) {
  return {
    first: path[0],
    second: path[path.length - 1],
    path,
    units,
    hearts: path.filter(cell => cell.type.pumps),
    valves: path.filter(cell => cell.type.gatesFlow),
    pumping: 0,
    open: true,
    conductance: VESSEL_IDLE_CONDUCTANCE,
  };
}

// Removes vessels that lost a cell they run through (their ends included), or whose cells were split into different
// creatures.
function cutBrokenVessels(world) {
  world.vessels = world.vessels.filter(vessel =>
    vessel.path.every(cell => !cell.dead && cell.creature === vessel.first.creature));
}

// ---------- Blood flow ----------
// Each step a vessel is pumped by its fed Hearts and shut by any Valve on it that gets no signal; then blood flows
// between its two ends, from the fuller to the emptier, in small steps. The world's seepFactor (a level's cold water)
// slows the unpumped flow as it slows seeping; a Heart's push is not slowed.
function updateVascular(world, dt) {
  for (const vessel of world.vessels) {
    vessel.pumping = vessel.hearts.reduce((sum, heart) => sum + heart.efficiency, 0);
    vessel.open = vessel.valves.every(valve => valve.signal > SIGNAL_ON);
    vessel.conductance = Math.min(VESSEL_MAX_CONDUCTANCE,
      VESSEL_IDLE_CONDUCTANCE * world.seepFactor + VESSEL_PUMP_CONDUCTANCE * vessel.pumping);
  }
  const substep = dt / VESSEL_SUBSTEPS;
  for (let i = 0; i < VESSEL_SUBSTEPS; i++) {
    for (const vessel of world.vessels) {
      if (vessel.open) flowAlongVessel(vessel, substep);
    }
  }
}

// moves each blood fluid between the vessel's ends by their difference in fill level
function flowAlongVessel(vessel, dt) {
  const { first, second } = vessel;
  for (const fluid of BLOOD_FLUIDS) {
    const firstFill = first.fluids[fluid] / first.fluidCapacity[fluid];
    const secondFill = second.fluids[fluid] / second.fluidCapacity[fluid];
    let amount = vessel.conductance * FLUIDS[fluid].flowRate * (firstFill - secondFill) * dt;
    amount = Math.max(-second.fluids[fluid], Math.min(first.fluids[fluid], amount));
    first.fluids[fluid] -= amount;
    second.fluids[fluid] += amount;
  }
}

registerSystem({ name: 'vascular', order: 55, switchable: true, update: updateVascular });
