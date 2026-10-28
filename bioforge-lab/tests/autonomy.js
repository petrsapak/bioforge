'use strict';
// Autonomy: an autonomous creature ignores the swimming input and isn't held to a heading; only its own cells move
// and turn it. Cilia push toward the front from where they sit, so cilia on one side turn the creature; muscles move
// it only by pushing water.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'blueprintFromList', 'createDesignCell', 'createNeuron',
  'TEMPLATES', 'createLight', 'LIGHT_RANGE']);

const RUN_STEPS = 200;                                    // 5 game s at 1/40 s per step
const STILL_DISTANCE = 2;                                 // px a creature with no movers may drift
const TURNED_ANGLE = 0.3;                                 // rad that counts as having turned

// runs a creature for 5 game s with "swim up" held; returns how far it went and turned. A design is a cell list or a
// design with neurons and fibres.
function runCreature(design, isAutonomous) {
  const world = sim.newWorld(2000, 2000, { seed: 1 });
  const cells = Array.isArray(design) ? { cells: sim.blueprintFromList(design) } : design;
  const creature = sim.spawn(world, cells, 1000, 1000, 0, 0);
  creature.aiControlled = false;
  creature.autonomous = isAutonomous;
  sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: false });
  const startX = creature.centerX;
  const startY = creature.centerY;
  let turned = 0;                                         // rad, summed step by step so it doesn't wrap at ±π
  for (let i = 0; i < RUN_STEPS; i++) {
    const before = creature.heading;
    sim.step(world, 1 / 40, { swimX: 0, swimY: -1, ability: false });
    turned += Math.atan2(Math.sin(creature.heading - before), Math.cos(creature.heading - before));
  }
  return {
    distance: Math.hypot(creature.centerX - startX, creature.centerY - startY),
    forward: startY - creature.centerY,
    heading: turned,
  };
}

const plainBody = [[0, 0, 'nucleus'], [-1, 0, 'tissue'], [1, 0, 'tissue']];
const steered = runCreature(plainBody, false);
const autonomous = runCreature(plainBody, true);
check('a steered creature swims on the input', steered.distance > 50, steered.distance.toFixed(1) + ' px');
check('an autonomous creature with nothing to move it stays put', autonomous.distance < STILL_DISTANCE,
  autonomous.distance.toFixed(2) + ' px');

const bothSides = runCreature([[0, 0, 'nucleus'], [-1, 0, 'cilia'], [1, 0, 'cilia']], true);
check('cilia on both sides swim it forward without turning',
  bothSides.forward > 50 && Math.abs(bothSides.heading) < TURNED_ANGLE,
  `${bothSides.forward.toFixed(1)} px, ${bothSides.heading.toFixed(2)} rad`);
const rightSide = runCreature([[0, 0, 'nucleus'], [-1, 0, 'tissue'], [1, 0, 'cilia']], true);
check('cilia on the right side turn it to the left', rightSide.heading < -TURNED_ANGLE,
  rightSide.heading.toFixed(2) + ' rad');

// muscles move a creature only through the water: a shape that just pulses goes nowhere, a tail beating side to
// side swims. The tail is a spine of joints with a column of muscles each side; the left column is on a Pacemaker,
// the right on an Inhibitor of it, so the sides take turns.
const designCell = (q, r, typeName, neuronKind) =>
  sim.createDesignCell(q, r, typeName, neuronKind ? { neuron: sim.createNeuron(neuronKind) } : {});
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const pulsingBlob = {
  cells: [designCell(0, 0, 'nucleus', 'pacemaker'), designCell(-1, 0, 'muscle'), designCell(1, 0, 'muscle')],
  fibres: [fibre(0, 0, -1, 0), fibre(0, 0, 1, 0)],
};
const pulsing = runCreature(pulsingBlob, true);
check('a blob that just pulses its muscles goes nowhere', pulsing.distance < 10, pulsing.distance.toFixed(1) + ' px');
const SPINE = [[0, 1], [-1, 2], [-1, 3], [-2, 4], [-2, 5], [-3, 6], [-3, 7], [-4, 8]];
const LEFT_MUSCLES = [[-1, 1], [-2, 2], [-2, 3], [-3, 4], [-3, 5], [-4, 6]];
const RIGHT_MUSCLES = [[1, 1], [0, 2], [0, 3], [-1, 4], [-1, 5], [-2, 6]];
const fish = {
  cells: [designCell(0, 0, 'nucleus', 'pacemaker'), designCell(1, 0, 'tissue', 'inhibitor'),
    designCell(-1, 0, 'tissue'),
    ...SPINE.map(([q, r]) => designCell(q, r, 'joint')), ...LEFT_MUSCLES.map(([q, r]) => designCell(q, r, 'muscle')),
    ...RIGHT_MUSCLES.map(([q, r]) => designCell(q, r, 'muscle'))],
  fibres: [fibre(0, 0, 1, 0), ...LEFT_MUSCLES.map(([q, r]) => fibre(0, 0, q, r)),
    ...RIGHT_MUSCLES.map(([q, r]) => fibre(1, 0, q, r))],
};
const swimming = runCreature(fish, true);
check('a tail beating side to side swims it forward', swimming.forward > 20, swimming.forward.toFixed(1) + ' px');
const unwired = runCreature([[0, 0, 'nucleus'], [-1, 0, 'muscle'], [1, 0, 'muscle']], true);
check('muscles with no signal do nothing', unwired.distance < STILL_DISTANCE, unwired.distance.toFixed(2) + ' px');
const jet = runCreature(sim.TEMPLATES.jet, true);
check('the default Jet swims straight ahead on its own wiring',
  jet.forward > 50 && Math.abs(jet.heading) < TURNED_ANGLE,
  `${jet.forward.toFixed(1)} px, ${jet.heading.toFixed(2)} rad`);
const paddler = runCreature(sim.TEMPLATES.paddler, true);
check('the Paddler swims forward by muscle alone', paddler.forward > 80, paddler.forward.toFixed(1) + ' px');

// The Seeker's Light eyes are wired across to its siphons, so it turns toward the light and swims to it, wherever
// the light is; with no light it holds still.
function runSeeker(lightOffsetX, lightOffsetY, seconds = 10) {
  const world = sim.newWorld(2000, 2000, { seed: 1 });
  const creature = sim.spawn(world, sim.TEMPLATES.seeker, 1000, 1000, 0, 0);
  creature.aiControlled = false;
  creature.autonomous = true;
  world.light = lightOffsetX === null ? null : sim.createLight(1000 + lightOffsetX, 1000 + lightOffsetY);
  const target = world.light || { x: 1000, y: 1000 };
  let turned = 0;                                         // rad
  for (let i = 0; i < seconds * 40; i++) {
    const before = creature.heading;
    sim.step(world, 1 / 40, { ability: false });
    turned += Math.atan2(Math.sin(creature.heading - before), Math.cos(creature.heading - before));
  }
  return { distance: Math.hypot(creature.centerX - target.x, creature.centerY - target.y), turned };
}
const toLeft = runSeeker(-200, -100);
check('the Seeker turns left and swims to a light on its left', toLeft.turned < -TURNED_ANGLE && toLeft.distance < 60,
  `${toLeft.turned.toFixed(2)} rad, ${toLeft.distance.toFixed(0)} px from it after 10 s`);
const toRight = runSeeker(200, -100);
check('the Seeker turns right and swims to a light on its right',
  toRight.turned > TURNED_ANGLE && toRight.distance < 60,
  `${toRight.turned.toFixed(2)} rad, ${toRight.distance.toFixed(0)} px from it after 10 s`);
const toBehind = runSeeker(50, 200, 20);
check('the Seeker turns round to a light behind it', toBehind.distance < 60,
  `${toBehind.distance.toFixed(0)} px from it after 20 s`);
const outOfReach = runSeeker(0, -(sim.LIGHT_RANGE + 100));
check('the Seeker doesn\'t see a light beyond its range', outOfReach.distance > sim.LIGHT_RANGE + 98,
  `${outOfReach.distance.toFixed(0)} px from it after 10 s`);
const inTheDark = runSeeker(null, null);
check('the Seeker holds still with no light', inTheDark.distance < STILL_DISTANCE,
  inTheDark.distance.toFixed(2) + ' px');
done();
