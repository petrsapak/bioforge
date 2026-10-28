'use strict';
// The match arena: two bases, two lanes (top and bottom) with towers, rocks in between, minion waves, bot heroes.
// Lanes run from team 0's base (left) to team 1's base (right); team 1 walks them backwards.
const ARENA = {
  w: 6000, h: 3000, seed: 11,
  teams: [
    { name: 'Reef',  color: '#5ad08a', spawn: [220, 1500],  core: [650, 1500] },
    { name: 'Brine', color: '#ff6a5a', spawn: [5780, 1500], core: [5350, 1500] },
  ],
  lanes: {
    top: [[650, 1500], [800, 650], [1300, 420], [4700, 420], [5200, 650], [5350, 1500]],
    bot: [[650, 1500], [800, 2350], [1300, 2580], [4700, 2580], [5200, 2350], [5350, 1500]],
  },
  // per team, per lane: outer then inner tower (x on the lane's straight part)
  towers: { top: [[2300, 1400], [3700, 4600]], bot: [[2300, 1400], [3700, 4600]] },
  laneW: 280,                                          // rocks keep this far from a lane's middle line
  rocks: { n: 70, r: [50, 170] },
  ridges: { n: 6, len: [4, 8], r: [60, 110] },
  currents: { n: 4, r: [300, 500], v: [30, 60] },
};

// structures are pinned creatures: a Nucleus with a big health pool walled in by Shell; tower guns are in moba.js
const STRUCTS = {
  tower: { tpl: art(['  S S', ' S N S', '  S S']), hp: 500, range: 380, every: 1.0, dmg: 8 },
  core:  { tpl: art(['   S S S', '  S S S S', ' S S N S S', '  S S S S', '   S S S']), hp: 900, range: 420, every: 0.8, dmg: 10 },
};

// minions: small creatures that swim their lane and fight whatever enemy comes near
const MINIONS = {
  grunt:    tpl([[0, 0, 'nucleus'], [0, -1, 'thorn'], [1, -1, 'mouth'], [-1, 0, 'gill'], [0, 1, 'cilia'], [-1, 1, 'pore']]),
  spitling: tpl([[0, 0, 'nucleus'], [0, -1, 'spitter'], [1, -1, 'command'], [-1, 0, 'gill'], [1, 0, 'fat'], [0, 1, 'cilia'], [-1, 1, 'pore']]),
};
const WAVE = ['grunt', 'grunt', 'spitling'];          // per lane per team
const WAVE_EVERY = 30, WAVE_FIRST = 4;                 // game seconds

// the build every hero gets: same budget for you and the bots (kept small: ten big creatures are too slow to simulate)
const MATCH_BIOMASS = 50, MATCH_CELLS = 24;
// bot heroes, one role each; also in the builder's library (hex art: see templates.js)
const HEROES = {
  lancer:  art(['   T T T',  '  S G N G S', '   c h f c', '  c k s k c', '   o s o']),   // Space: siphon dash into its thorns
  stinger: art([' x x e x x', '  G f N h G', '   c c c c',  '    o   o']),                // eyespot stings everything close
  spitter: art(['   P k k P', '  P G N G P', '   f h a f',  '  c c o c c']),               // Space: four acid spitters
  snarer:  art(['   T T T',   '  H k N k H', '   G h f G',  '  c c o c c']),              // Space: snares pull foes onto its thorns
};
Object.assign(TEMPLATES, HEROES);
const BOT_DESIGNS = Object.keys(HEROES);
const BOT_NAMES = ['Murk', 'Silt', 'Kelpie', 'Grue', 'Barnacle', 'Fathom', 'Spindle', 'Ooze', 'Brack', 'Wrack'];
