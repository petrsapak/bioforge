'use strict';
// Progression: levels, XP from kills, and what a level lets you build (biomass, cell count, unlocked cell types).
// No DOM: runs in the browser and in Node.
const LVL_MAX = 20;
// the level each cell type unlocks at (boss drops come with milestone 7)
const CELL_LVL = {
  nucleus: 1, tissue: 1, joint: 1, cilia: 1, thorn: 1, mouth: 1, gill: 1, pore: 1, fat: 1, muscle: 1, bloater: 1, pacemaker: 1, heart: 1,
  nerve: 2, shell: 2, command: 3, siphon: 3, eyespot: 4, airsac: 4, nettle: 5, valve: 5, ganglion: 6, adrenal: 6,
  mender: 7, spitter: 8, snare: 9, bud: 10,
};
const xpNeed = L => Math.round(30 * L ** 1.7);      // XP to go from level L to L + 1
const levelBiomass = L => 40 + 8 * (L - 1);
const levelCells = L => 16 + 3 * (L - 1);
// XP for killing a level m enemy at level L: tougher ones give more, ones far below you only a trickle
const killXP = (m, L) => Math.max(1, Math.round(15 * m ** 1.3 * Math.max(0.1, Math.min(1.5, 1 + (m - L) * (m > L ? 0.15 : 0.2)))));

const newProgress = () => ({ lvl: 1, xp: 0 });
// adds n XP; returns the levels gained, each { lvl, cells: cell types it unlocks }
function gainXP(p, n) {
  const ups = [];
  p.xp += n;
  while (p.lvl < LVL_MAX && p.xp >= xpNeed(p.lvl)) {
    p.xp -= xpNeed(p.lvl); p.lvl++;
    ups.push({ lvl: p.lvl, cells: Object.keys(CELL_LVL).filter(t => CELL_LVL[t] === p.lvl) });
  }
  if (p.lvl === LVL_MAX) p.xp = 0;
  return ups;
}
// why design bpo cannot go into the world at level L ('' = it can)
function buildCheck(bpo, L) {
  const locked = [...new Set(bpo.cells.map(b => b.t))].filter(t => CELL_LVL[t] > L);
  if (locked.length) return `Locked: ${locked.map(t => `${CELLS[t].name} (Lv ${CELL_LVL[t]})`).join(', ')}`;
  if (bpo.cells.length > levelCells(L)) return `Too many cells: ${bpo.cells.length} / ${levelCells(L)}`;
  if (bpCost(bpo) > levelBiomass(L)) return `Over budget by ${bpCost(bpo) - levelBiomass(L)}`;
  return '';
}
