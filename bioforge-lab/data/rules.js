'use strict';
// Global rules and system switches (pure data). Every mechanic can be switched off here;
// levels narrow the systems further (milestone 2).
const RULES = {
  budget: 50,                                         // biomass; levels with a material kit (data/levels.js) use that
  maxCells: 24,
  maxNeurons: 12,                                     // neurons on the nerve layer (they cost no biomass)
  maxFibreUnits: 40,                                  // steps of nerve fibre from cell centre to cell centre
  maxVesselUnits: 30,                                 // steps of blood vessel from cell centre to cell centre
  allLevelsOpen: true,                                // TESTING ONLY (user, 2026-10-29): every level is open; remove later
  // systems stepped each tick: nerve = signals;
  // fluid = O2, sugar, waste and hormones burn and seep (off: cells work at full power);
  // vascular = vessels carry blood, pumped by Hearts;
  // metabolism = Fat cells store spare sugar as fat and turn it back;
  // food = food specks in the water; regrow = Menders and lost-cell regrowth;
  // secretions = acid, protease and Mineralizer glands; chemical = hormones set moods (thresholds, clocks, burn,
  // stores); scent = hormones in the water, traded with the cells in it; treatments = Tanner and Resilin glands
  systems: ['nerve', 'fluid', 'vascular', 'metabolism', 'food', 'regrow', 'secretions', 'chemical', 'scent',
    'treatments'],
};
