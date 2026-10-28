'use strict';
// Global rules and system switches (pure data). Every mechanic can be switched off here;
// levels narrow the systems further (milestone 2).
const RULES = {
  budget: 50,                                         // biomass; design limits until levels bring material kits
  maxCells: 24,
  maxNeurons: 12,                                     // neurons on the nerve layer (they cost no biomass)
  maxFibreUnits: 40,                                  // hexagon sides of nerve fibre
  selfHarm: true,                                     // secretions can hurt your own cells (milestone 5)
  // systems stepped each tick: nerve = signals;
  // fluid = O2, energy, waste and hormones burn and flow (off: cells work at full power);
  // food = food specks in the water; regrow = Menders and lost-cell regrowth
  systems: ['nerve', 'fluid', 'food', 'regrow'],
};
