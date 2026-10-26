'use strict';
// Biomes: map size, obstacles, currents, named places and spawn zones. Layout is generated from the seed, so every run
// (and later every client and the server) builds the same map.
// regions: named areas; every point belongs to the region whose centre `at` is nearest. water/rock: their colours.
// landmarks: hand-placed rings of rock with `gaps` openings (the first faces the start). cave = an enemy den;
//   lair = the dungeon boss's entrance, sealed until milestone 7; arena = where the world boss will appear.
// zones: one entry per enemy kind; `spawners` spawn points are scattered in a `region`, in a `cave` (landmark name), or
//   in the ring [r0, r1] around the start; each keeps `size` enemies alive. aggro = notice radius (px), 0 = passive
//   (runs when hurt); flee = runs away below this share of its health (0 = never); lvl = enemy level (XP, name colour).
const BIOMES = {
  tidepool: {
    name: 'Tidepool', w: 12000, h: 12000, seed: 7, start: [6000, 6000], safeR: 900,
    rocks: { n: 240, r: [40, 200] },
    ridges: { n: 18, len: [6, 14], r: [60, 120] },      // chains of overlapping rocks that act as walls
    currents: { n: 14, r: [400, 900], v: [40, 90] },
    regions: [
      { name: 'Sunlit Shallows', at: [6000, 6000], water: '#123139', rock: '#35524f', desc: 'Calm water. Motes and nippers' },
      { name: 'Wiggler Flats',   at: [6000, 2900], water: '#13292c', rock: '#3a4a3a', desc: 'Wigglers' },
      { name: 'Squirt Gardens',  at: [9000, 4200], water: '#0f2838', rock: '#2e4658', desc: 'Squirters' },
      { name: 'Stinger Reef',    at: [9000, 8000], water: '#191f38', rock: '#3c3a5e', desc: 'Nettlers. Keep your distance' },
      { name: 'Puffer Hollows',  at: [5600, 9300], water: '#1e2a24', rock: '#45503a', desc: 'Puffers' },
      { name: 'Broken Shelf',    at: [2800, 6000], water: '#1b2426', rock: '#4a4a44', desc: 'Wigglers and squirters' },
      { name: 'Eel Trench',      at: [1700, 1700], water: '#0a161d', rock: '#1f3440', desc: 'Eels. Dangerous' },
      { name: 'Jelly Bloom',     at: [10300, 1700], water: '#1c1430', rock: '#43305a', desc: 'Jellies. Dangerous' },
      { name: 'Manta Drift',     at: [10300, 10300], water: '#0b2026', rock: '#24464c', desc: 'Mantas. Dangerous' },
      { name: 'Crab Cliffs',     at: [1700, 10300], water: '#241f18', rock: '#5a4a34', desc: 'Crabs. Dangerous' },
      { name: 'Leviathan Basin', at: [11000, 6000], water: '#0c1c2a', rock: '#2a3a50', desc: 'World boss arena' },
    ],
    landmarks: [
      { name: 'Nipper Nook',    kind: 'cave',  at: [7300, 6900], r: 380, gaps: 1 },
      { name: 'Wiggler Burrow', kind: 'cave',  at: [6900, 2300], r: 450, gaps: 1 },
      { name: 'Glow Grotto',    kind: 'cave',  at: [9700, 8700], r: 500, gaps: 1 },
      { name: 'Puffer Den',     kind: 'cave',  at: [4700, 9900], r: 450, gaps: 1 },
      { name: 'The Maw',        kind: 'lair',  at: [3000, 8700], r: 650, gaps: 1, desc: 'Dungeon boss. Sealed for now' },
      { name: 'Leviathan Ring', kind: 'arena', at: [11000, 6000], r: 900, gaps: 4, desc: 'World boss. Not here yet' },
    ],
    zones: [
      { tpl: 'mote',     region: 'Sunlit Shallows', spawners: 5, size: 5, aggro: 0, flee: 1, lvl: 1 },
      { tpl: 'nipper',   region: 'Sunlit Shallows', spawners: 5, size: 4, aggro: 220, flee: 0.4, lvl: 2 },
      { tpl: 'nipper',   cave: 'Nipper Nook',       spawners: 1, size: 6, aggro: 250, flee: 0, lvl: 3 },
      { tpl: 'wiggler',  region: 'Wiggler Flats',   spawners: 7, size: 5, aggro: 300, flee: 0.3, lvl: 3 },
      { tpl: 'wiggler',  region: 'Broken Shelf',    spawners: 3, size: 5, aggro: 300, flee: 0.3, lvl: 3 },
      { tpl: 'wiggler',  cave: 'Wiggler Burrow',    spawners: 1, size: 6, aggro: 350, flee: 0, lvl: 4 },
      { tpl: 'squirter', region: 'Squirt Gardens',  spawners: 7, size: 5, aggro: 350, flee: 0, lvl: 4 },
      { tpl: 'squirter', region: 'Broken Shelf',    spawners: 2, size: 5, aggro: 350, flee: 0, lvl: 4 },
      { tpl: 'nettler',  region: 'Stinger Reef',    spawners: 7, size: 5, aggro: 300, flee: 0, lvl: 5 },
      { tpl: 'nettler',  cave: 'Glow Grotto',       spawners: 1, size: 6, aggro: 300, flee: 0, lvl: 6 },
      { tpl: 'puffer',   region: 'Puffer Hollows',  spawners: 7, size: 4, aggro: 320, flee: 0.25, lvl: 6 },
      { tpl: 'puffer',   cave: 'Puffer Den',        spawners: 1, size: 5, aggro: 320, flee: 0, lvl: 7 },
      { tpl: 'eel',      region: 'Eel Trench',      spawners: 5, size: 3, aggro: 420, flee: 0, lvl: 9 },
      { tpl: 'jelly',    region: 'Jelly Bloom',     spawners: 5, size: 3, aggro: 380, flee: 0, lvl: 9 },
      { tpl: 'manta',    region: 'Manta Drift',     spawners: 4, size: 3, aggro: 450, flee: 0, lvl: 10 },
      { tpl: 'crab',     region: 'Crab Cliffs',     spawners: 4, size: 3, aggro: 400, flee: 0, lvl: 10 },
    ],
  },
};
