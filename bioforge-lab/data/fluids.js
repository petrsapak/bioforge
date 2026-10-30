'use strict';
// Fluid channels (pure data): what every cell holds and passes on to its neighbours. Field meanings:
//   id, name, short, color: what the views and the HUD show
//   layer: the layer the fluid belongs to ('vascular' or 'chemical'); flowRate: speed of flow between cells, as a
//   multiple of the base flow; decayRate: share lost per second
//   capacityField: the cell type field giving how much a cell holds (otherwise every cell holds `capacity`)
//   startFill: share of its capacity a new cell starts with
// Hormones are the 'chemical' fluids: glands make them (fluid.js) and chemical.js reads their effects.

const HORMONE_FLOW_RATE = 4;                              // hormones seep this many times faster than O2 and sugar

function fluidChannel(definition) {
  return {
    layer: 'vascular',
    flowRate: 1,
    decayRate: 0,
    capacityField: null,
    capacity: 1,
    startFill: 0,
    ...definition,
  };
}

// a hormone: a chemical fluid that seeps fast, so a mood soon reaches the whole body (since 2026-10-30; it seeped
// like sugar until then)
function hormoneChannel(definition) {
  return fluidChannel({ layer: 'chemical', flowRate: HORMONE_FLOW_RATE, ...definition });
}

const FLUIDS = [
  fluidChannel({
    id: 'oxygen', name: 'Oxygen', short: 'O₂', color: '#ff5560', capacityField: 'oxygenCapacity', startFill: 0.7,
  }),
  fluidChannel({
    id: 'sugar', name: 'Sugar', short: 'Sugar', color: '#ffd23f', capacityField: 'sugarCapacity', startFill: 0.7,
  }),
  fluidChannel({ id: 'waste', name: 'Waste', short: 'Waste', color: '#a89a3a' }),
  fluidChannel({ id: 'repair', name: 'Repair', short: 'Repair', color: '#5ef08a' }),
  hormoneChannel({ id: 'adrenaline', name: 'Adrenaline', short: 'Adren.', color: '#e05ad0', decayRate: 0.25 }),
  hormoneChannel({ id: 'calm', name: 'Calm', short: 'Calm', color: '#5a9ee8', decayRate: 0.02 }),
  hormoneChannel({ id: 'fed', name: 'Fed', short: 'Fed', color: '#d08a40', decayRate: 0.02 }),
  hormoneChannel({ id: 'starved', name: 'Starved', short: 'Starv.', color: '#9a90b0', decayRate: 0.02 }),
];

const FLUID_COUNT = FLUIDS.length;
const fluidIndex = id => FLUIDS.findIndex(fluid => fluid.id === id);
// indexes into cell.fluids and cell.fluidCapacity
const FLUID_OXYGEN = fluidIndex('oxygen');
const FLUID_SUGAR = fluidIndex('sugar');
const FLUID_WASTE = fluidIndex('waste');
const FLUID_REPAIR = fluidIndex('repair');
const FLUID_ADRENALINE = fluidIndex('adrenaline');

// how much of a fluid a cell of this type holds
function fluidCapacityOf(cellType, fluid) {
  return fluid.capacityField ? cellType[fluid.capacityField] : fluid.capacity;
}
