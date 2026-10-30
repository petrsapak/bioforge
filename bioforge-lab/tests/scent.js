'use strict';
// Hormones in the water (scent.js) and the Photophore's light (nerve.js): a cell scents the water without losing its
// hormone, another creature takes the cloud in, clouds spread and fade, the system switched off leaves the water
// clean; a lit Photophore is seen by another creature's Light eyes, never by its own creature's. Sim only.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'createNeuron', 'FLUID_CALM',
  'FLUID_ADRENALINE', 'scentAt', 'SCENT_PATCH_SIZE', 'lightSeen', 'isGlowing', 'PHOTOPHORE_RANGE', 'createLight']);

const cell = (q, r, typeName, extras = {}) => sim.createDesignCell(q, r, typeName, extras);
const noInput = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };
const STEP = 1 / 40;
const cellAt = (creature, q, r) => creature.cells.find(each => each.q === q && each.r === r);
const fillOf = (target, fluid) => target.fluids[fluid] / target.fluidCapacity[fluid];

// creatures of these designs ([cells, x, y]) in one world, held by nobody and doing nothing on their own
function tank(designs, systems) {
  const world = sim.newWorld(800, 800, { systems });
  const creatures = designs.map(([cells, x, y], i) => {
    const creature = sim.spawn(world, { cells, fibres: [] }, x, y, 0, i === 0 ? 0 : 1);
    creature.aiControlled = false;
    creature.autonomous = true;
    return creature;
  });
  return { world, creatures };
}

function runFor(world, seconds, beforeStep = () => {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    beforeStep();
    sim.step(world, STEP, noInput);
  }
}

// ---------- Hormones in the water ----------
{
  const calmed = [cell(0, 0, 'nucleus'), cell(0, 1, 'tissue')];
  const { world, creatures: [creature] } = tank([[calmed, 400, 400]], ['chemical', 'scent']);
  const tissue = cellAt(creature, 0, 1);
  runFor(world, 3, () => {
    tissue.fluids[sim.FLUID_CALM] = tissue.fluidCapacity[sim.FLUID_CALM];   // held full, as a gland keeps it
  });
  const here = sim.scentAt(world, sim.FLUID_CALM, tissue.x, tissue.y);
  const near = sim.scentAt(world, sim.FLUID_CALM, tissue.x + sim.SCENT_PATCH_SIZE * 2, tissue.y);
  const far = sim.scentAt(world, sim.FLUID_CALM, tissue.x + sim.SCENT_PATCH_SIZE * 8, tissue.y);
  check('a cell full of Calm scents the water round it, less and less with distance',
    here > 0.3 && near > 0.01 && near < here && far < near, `${here.toFixed(2)} / ${near.toFixed(3)} / ${far}`);
  check('the water never holds more than a full cell', world.scent.levels[sim.FLUID_CALM].every(level => level <= 1));
}

{ // giving off scent costs the cell nothing: the same cell in clean water and in its own cloud keeps its Calm
  const design = [cell(0, 0, 'nucleus'), cell(0, 1, 'tissue')];
  const withScent = tank([[design, 400, 400]], ['fluid', 'chemical', 'scent']);
  const without = tank([[design, 400, 400]], ['fluid', 'chemical']);
  for (const { creatures: [creature] } of [withScent, without]) {
    cellAt(creature, 0, 1).fluids[sim.FLUID_CALM] = cellAt(creature, 0, 1).fluidCapacity[sim.FLUID_CALM];
  }
  runFor(withScent.world, 2);
  runFor(without.world, 2);
  const kept = creature => fillOf(cellAt(creature, 0, 1), sim.FLUID_CALM);
  check('a cell gives off scent without losing its own hormone',
    kept(withScent.creatures[0]) >= kept(without.creatures[0]) - 1e-9,
    `${kept(withScent.creatures[0]).toFixed(4)} vs ${kept(without.creatures[0]).toFixed(4)}`);
}

{ // another creature in the cloud takes it in, and its Synapse threshold rises with it
  const source = [cell(0, 0, 'nucleus'), cell(0, 1, 'calmgland', { neuron: sim.createNeuron('inhibitor') })];
  const guard = [cell(0, 0, 'nucleus'), cell(0, -1, 'tissue', { neuron: { kind: 'synapse', setting: 0.9 } })];
  const { world, creatures: [, other] } = tank([[source, 400, 400], [guard, 470, 400]],
    ['nerve', 'fluid', 'chemical', 'scent']);
  const synapseCell = cellAt(other, 0, -1);
  runFor(world, 20);
  check('a creature beside a Calm gland takes in its Calm from the water', fillOf(synapseCell, sim.FLUID_CALM) > 0.15,
    fillOf(synapseCell, sim.FLUID_CALM).toFixed(3));
  check('which raises its Synapse threshold', synapseCell.thresholdFactor > 1.08,
    synapseCell.thresholdFactor.toFixed(3));
  const apart = tank([[source, 400, 400], [guard, 470, 400]], ['nerve', 'fluid', 'chemical']);
  runFor(apart.world, 20);
  check('with the scent system off, nothing reaches the other creature and the water stays clean',
    fillOf(cellAt(apart.creatures[1], 0, -1), sim.FLUID_CALM) === 0 && !apart.world.scent);
}

{ // the water's adrenaline fades fast, as in cells
  const design = [cell(0, 0, 'nucleus'), cell(0, 1, 'tissue')];
  const { world, creatures: [creature] } = tank([[design, 400, 400]], ['chemical', 'scent']);
  const tissue = cellAt(creature, 0, 1);
  runFor(world, 1, () => {
    tissue.fluids[sim.FLUID_ADRENALINE] = tissue.fluidCapacity[sim.FLUID_ADRENALINE];
  });
  const before = sim.scentAt(world, sim.FLUID_ADRENALINE, tissue.x, tissue.y);
  for (const each of world.cells) each.fluids[sim.FLUID_ADRENALINE] = 0;
  creature.cells.forEach(each => {
    each.dead = true;                                     // nothing left to scent it or take it back in
  });
  runFor(world, 8);
  check('a cloud fades once nothing gives it off', sim.scentAt(world, sim.FLUID_ADRENALINE, 400, 400) < before * 0.2,
    `${before.toFixed(3)} -> ${sim.scentAt(world, sim.FLUID_ADRENALINE, 400, 400).toFixed(4)}`);
}

// ---------- The Photophore ----------
{
  const lure = [cell(0, 0, 'nucleus'), cell(0, -1, 'photophore'), cell(1, -1, 'lighteye')];
  const watcher = [cell(0, 0, 'nucleus'), cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye')];
  const { world, creatures: [lurer, other] } = tank([[lure, 400, 400], [watcher, 400, 600]], ['nerve']);
  const photophore = cellAt(lurer, 0, -1);
  const ownEye = cellAt(lurer, 1, -1);
  const otherEye = cellAt(other, 0, -1);
  sim.step(world, STEP, noInput);
  check('an unsignalled Photophore is dark: nobody sees it', !sim.isGlowing(photophore) &&
    sim.lightSeen(world, otherEye) === 0);
  photophore.signal = 1;
  check('a signalled one glows, and another creature\'s Light eyes see it', sim.isGlowing(photophore) &&
    sim.lightSeen(world, otherEye) > 0.05, sim.lightSeen(world, otherEye).toFixed(3));
  check('its own creature\'s Light eyes don\'t', sim.lightSeen(world, ownEye) === 0);
  other.cells.forEach(each => {
    each.x += sim.PHOTOPHORE_RANGE;
  });
  check('beyond its reach it is not seen', sim.lightSeen(world, otherEye) === 0);
  world.light = sim.createLight(otherEye.x, otherEye.y - 50, 300);
  check('a Light eye sees the brighter of the world\'s light and a Photophore', sim.lightSeen(world, otherEye) > 0.3);
}

{ // a Seeker follows a glowing Photophore, as it follows the light
  const lure = [cell(0, 0, 'nucleus'), cell(0, -1, 'photophore', { neuron: sim.createNeuron('inhibitor') })];
  const world = sim.newWorld(900, 900, { systems: ['nerve'] });
  const lurer = sim.spawn(world, { cells: lure, fibres: [] }, 450, 250, 0, 0);
  lurer.aiControlled = false;
  lurer.autonomous = true;
  const seeker = sim.spawn(world, {
    cells: [cell(0, 0, 'nucleus'), cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'), cell(-1, 1, 'siphon'),
      cell(0, 1, 'siphon')],
    fibres: [{ from: { q: 0, r: -1 }, to: { q: 0, r: 1 } }, { from: { q: 1, r: -1 }, to: { q: -1, r: 1 } }],
  }, 450, 550, 0, 1);
  seeker.aiControlled = false;
  seeker.autonomous = true;
  const distance = () => Math.hypot(seeker.centerX - lurer.centerX, seeker.centerY - lurer.centerY);
  const start = distance();
  runFor(world, 10);
  check('a Seeker swims to a lit Photophore', distance() < start - 150,
    `${start.toFixed(0)} -> ${distance().toFixed(0)}`);
}

done();
