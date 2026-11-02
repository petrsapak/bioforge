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
// The Wiggler: two rows of Muscles taking turns and a fin of Joints. Mirror-symmetric and wired so both sides are
// the same number of fibres from the beat, so it swims head first and straight, at about the Jet's speed. The
// Paddler is the same body with a Delay in each back-row Muscle: a wave runs down to the fin, and it swims faster.
const wiggler = runCreature(sim.TEMPLATES.wiggler, true);
check('the Wiggler swims head first and straight by muscle alone',
  wiggler.forward > 80 && Math.abs(wiggler.heading) < TURNED_ANGLE,
  `${wiggler.forward.toFixed(1)} px, ${wiggler.heading.toFixed(2)} rad`);
const paddler = runCreature(sim.TEMPLATES.paddler, true);
check('the Paddler, wired in a wave, swims head first and straight, faster than the Wiggler',
  paddler.forward > 1.2 * wiggler.forward && Math.abs(paddler.heading) < TURNED_ANGLE,
  `${paddler.forward.toFixed(1)} px, ${paddler.heading.toFixed(2)} rad`);

// The Jelly's Bloaters pulse with its Pacemaker: they swell and let go, never stuck swollen
{
  const world = sim.newWorld(2000, 2000, { seed: 1 });
  const jelly = sim.spawn(world, sim.TEMPLATES.jelly, 1000, 1000, 0, 0);
  jelly.aiControlled = false;
  jelly.autonomous = true;
  const bloater = jelly.cells.find(cell => cell.type.resize === 'swell');
  let smallest = Infinity;
  let largest = 0;
  for (let i = 0; i < RUN_STEPS; i++) {
    sim.step(world, 1 / 40, { swimX: 0, swimY: 0, ability: false });
    smallest = Math.min(smallest, bloater.size);
    largest = Math.max(largest, bloater.size);
  }
  check('the Jelly\'s Bloaters swell and let go', largest > 1.5 && smallest < 1.3,
    `size ${smallest.toFixed(2)}–${largest.toFixed(2)}`);
}

// runs a template for some game s with a light at this offset from where it starts (none for null); returns how far
// it ends from the light (or from its start, in the dark) and how far it turned
function runToLight(template, lightOffsetX, lightOffsetY, seconds = 10) {
  const world = sim.newWorld(2000, 2000, { seed: 1 });
  const creature = sim.spawn(world, sim.TEMPLATES[template], 1000, 1000, 0, 0);
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

// The Seeker's Light eyes are wired across to its siphons, so it turns toward the light and swims to it, wherever
// the light is; with no light it holds still.
const runSeeker = (lightOffsetX, lightOffsetY, seconds) => runToLight('seeker', lightOffsetX, lightOffsetY, seconds);
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

// The Light eel: its eyes open the gates of its Muscle tail, fire the far Siphon and bend their own side, so it swims
// to a light ahead or to either side and stays there; in the dark its tail rests. (A light behind it it doesn't
// turn round for.) It is slower than the Seeker: a long body turns slowly.
const EEL_LIGHT_DISTANCE = 250;                           // px from its start
const EEL_SECONDS = 30;                                   // game s
for (const [where, offsetX, offsetY] of [['ahead of it', 0, -EEL_LIGHT_DISTANCE],
  ['on its left', -EEL_LIGHT_DISTANCE, 0], ['on its right', EEL_LIGHT_DISTANCE, 0]]) {
  const eel = runToLight('lightEel', offsetX, offsetY, EEL_SECONDS);
  check(`the Light eel swims to a light ${where} and stays there`, eel.distance < 60,
    `${eel.distance.toFixed(0)} px from it after ${EEL_SECONDS} s`);
}
const eelInTheDark = runToLight('lightEel', null, null);
check('the Light eel rests with no light', eelInTheDark.distance < STILL_DISTANCE,
  eelInTheDark.distance.toFixed(2) + ' px');
done();
