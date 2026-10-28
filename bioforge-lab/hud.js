'use strict';
// Sandbox HUD bars (browser only, except creatureVitals).

// Core = nucleus health. Body = health of all cells vs. at spawn (lost cells count as 0).
// O2 / Energy = how full the body's stores are. Waste = average over the working cells (bad when high).
// isLow: when the bar pulses red.
const HUD_BAR_DEFINITIONS = [
  { name: 'Core', color: '#e8c547', isLow: value => value < 0.3 },
  { name: 'Body', color: '#7fd18a', isLow: value => value < 0.4 },
  { name: 'O₂', color: FLUIDS[FLUID_OXYGEN].color, isLow: value => value < 0.2 },
  { name: 'Energy', color: FLUIDS[FLUID_ENERGY].color, isLow: value => value < 0.2 },
  { name: 'Waste', color: '#b8a040', isLow: value => value > 0.6 },
];

// one row per bar inside container; returns the bars with their elements
function makeHudBars(container) {
  return HUD_BAR_DEFINITIONS.map(definition => {
    const row = document.createElement('div');
    const label = document.createElement('span');
    const track = document.createElement('div');
    const fill = document.createElement('div');
    const value = document.createElement('span');
    row.className = 'hud-bar';
    label.className = 'hud-label';
    track.className = 'hud-track';
    fill.className = 'hud-fill';
    value.className = 'hud-value';
    label.textContent = definition.name;
    fill.style.setProperty?.('--bar-color', definition.color);
    track.appendChild(fill);
    for (const element of [label, track, value]) row.appendChild(element);
    container.appendChild(row);
    return { ...definition, row, fill, value };
  });
}

// the bar values (0..1, in HUD_BAR_DEFINITIONS order) and status counts for a creature
function creatureVitals(creature) {
  const cells = creature.cells;
  const sum = (list, valueOf) => list.reduce((total, cell) => total + valueOf(cell), 0);
  const fillShare = fluid => cells.length
    ? sum(cells, cell => cell.fluids[fluid]) / sum(cells, cell => cell.fluidCapacity[fluid])
    : 0;
  const workingCells = cells.filter(cell => cell.type.fuelBurn);
  const wasteShare = workingCells.length
    ? sum(workingCells, cell => clamp01(cell.fluids[FLUID_WASTE] / cell.fluidCapacity[FLUID_WASTE]))
      / workingCells.length
    : 0;
  const nucleus = creature.nucleus;
  return {
    bars: [
      creature.alive && nucleus ? nucleus.health / nucleus.maxHealth : 0,
      sum(cells, cell => Math.max(0, cell.health)) / (creature.spawnHealth || 1),
      fillShare(FLUID_OXYGEN),
      fillShare(FLUID_ENERGY),
      wasteShare,
    ],
    starving: cells.filter(cell => cell.starving).length,
    poisoned: cells.filter(cell => cell.poisoned).length,
  };
}
