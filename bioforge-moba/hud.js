'use strict';
// Match and sandbox HUD bars (browser only, except vitals).

// battle HUD bars: Core = Nucleus health, Body = health of all cells vs. at spawn (lost cells count as 0), O2 / Energy = how full the body's stores are,
// Waste = average over the working cells (bad when high); low = pulses red
const HUD_BAR_DEFS = [
  { name: 'Core', color: '#e8c547', low: v => v < 0.3 },
  { name: 'Body', color: '#7fd18a', low: v => v < 0.4 },
  { name: 'O₂', color: FLUIDS[O].color, low: v => v < 0.2 },
  { name: 'Energy', color: FLUIDS[S].color, low: v => v < 0.2 },
  { name: 'Waste', color: '#b8a040', low: v => v > 0.6 },
];

// build one row per bar into box; returns the bars with their elements
function makeHudBars(box) {
  return HUD_BAR_DEFS.map(b => {
    const row = document.createElement('div'), lbl = document.createElement('span'), trk = document.createElement('div');
    const fill = document.createElement('div'), val = document.createElement('span');
    row.className = 'hbar'; lbl.className = 'hlbl'; trk.className = 'htrk'; fill.className = 'hfill'; val.className = 'hval';
    lbl.textContent = b.name; fill.style.setProperty?.('--c', b.color);
    trk.appendChild(fill); for (const x of [lbl, trk, val]) row.appendChild(x);
    box.appendChild(row);
    return { ...b, row, fill, val };
  });
}

// the bar values (0..1, in HUD_BAR_DEFS order) and status counts for creature cr
function vitals(cr) {
  const cs = cr.cells, sum = (l, g) => l.reduce((s, c) => s + g(c), 0);
  const stock = i => cs.length ? sum(cs, c => c.f[i]) / sum(cs, c => c.cap[i]) : 0;
  const wk = cs.filter(c => c.d.fuel);
  return {
    bars: [cr.alive && cr.core ? cr.core.hp / cr.core.max : 0, sum(cs, c => Math.max(0, c.hp)) / (cr.hp0 || 1), stock(O), stock(S),
           wk.length ? sum(wk, c => clamp01(c.f[W] / c.cap[W])) / wk.length : 0],
    starving: cs.filter(c => c.starve).length, poisoned: cs.filter(c => c.poison).length,
  };
}
