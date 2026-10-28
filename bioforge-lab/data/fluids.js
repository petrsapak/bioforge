'use strict';
// Fluid channels (pure data): what every cell holds and passes on to its neighbours. Field meanings:
//   id, name, short, color: what the views and the HUD show
//   layer: the layer the fluid belongs to ('vascular' or 'chemical'); flowRate: speed of flow between cells, as a
//   multiple of the base flow; decayRate: share lost per second
//   capacityField: the cell type field giving how much a cell holds (otherwise every cell holds `capacity`)
//   startFill: share of its capacity a new cell starts with
// Materials and hormones join this list later (PLAN.md, Layers).

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

const FLUIDS = [
  fluidChannel({
    id: 'oxygen', name: 'Oxygen', short: 'O₂', color: '#ff5560', capacityField: 'oxygenCapacity', startFill: 0.7,
  }),
  fluidChannel({
    id: 'sugar', name: 'Sugar', short: 'Sugar', color: '#ffd23f', capacityField: 'sugarCapacity', startFill: 0.7,
  }),
  fluidChannel({ id: 'waste', name: 'Waste', short: 'Waste', color: '#a89a3a' }),
  fluidChannel({ id: 'repair', name: 'Repair', short: 'Repair', color: '#5ef08a' }),
  fluidChannel({
    id: 'adrenaline', name: 'Adrenaline', short: 'Adren.', color: '#e05ad0', layer: 'chemical', decayRate: 0.25,
  }),
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
