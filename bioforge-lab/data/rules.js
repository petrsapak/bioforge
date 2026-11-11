'use strict';
// Global rules and system switches (pure data). Every mechanic can be switched off here;
// levels narrow the systems further (milestone 2).
const RULES = {
  budget: 50,                                         // biomass; levels with a material kit (data/levels.js) use that
  maxCells: 24,
  maxNeurons: 12,                                     // neurons on the nerve layer (they cost no biomass)
  maxFibreUnits: 40,                                  // steps of nerve fibre from cell centre to cell centre
  allLevelsOpen: true,                                // all levels open (user, 2026-10-29, for testing; kept on for the
                                                      // release, user 2026-11-07: "do not switch it off")
  thrustFollowsBody: true,                            // a Cilia or Siphon pushes the way its own part of the body
                                                      // points (physics.js: localForward); off: along the whole
                                                      // creature's heading, the rule until 0.8.5, kept for one version
  // systems stepped each tick: nerve = signals;
  // fluid = O2, sugar and waste burn and seep (off: cells work at full power);
  // vascular = beating Hearts pump blood between the cells in their reach;
  // metabolism = Fat cells store spare sugar as fat and turn it back;
  // food = food specks in the water; regrow = Menders and lost-cell regrowth;
  // secretions = acid, protease and Mineralizer glands
  systems: ['nerve', 'fluid', 'vascular', 'metabolism', 'food', 'regrow', 'secretions'],
};

