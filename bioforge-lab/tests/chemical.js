'use strict';
// The chemical layer (milestone 7): hormone glands, the Receptor, moods (Synapse thresholds, Pacemaker speed, fuel
// burn, Fat storage), each with its system switched off as well. Sim only:
// glands and muscles are held signalled by hand, and hormone levels are set by hand where only their effect is tested.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'createNeuron', 'damageCell',
  'NEURON_RULES', 'FLUID_SUGAR', 'FLUID_ADRENALINE', 'FLUID_CALM', 'FLUID_FED', 'FLUID_STARVED', 'CELLS',
  'stingShare', 'createEditedDesign', 'setSensedHormone',
  'bodyDesign', 'hexKey', 'migrateLibraryEntry']);

const cell = (q, r, typeName, extras = {}) => sim.createDesignCell(q, r, typeName, extras);
const noInput = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };
const STEP = 1 / 40;                                      // game s per step
const cellAt = (creature, q, r) => creature.cells.find(each => each.q === q && each.r === r);
// holds a cell's signal by hand, as the nerve system would set it for a whole game step (these worlds run without it)
function holdSignal(target, value) {
  target.signal = value;
  target.stepSignal = value;
}

// a creature of these design cells alone in the water, held by nobody
function lone(cells, systems, fibres = []) {
  const world = sim.newWorld(800, 800, { systems });
  const creature = sim.spawn(world, { cells, fibres }, 400, 400, 0, 0);
  creature.aiControlled = false;
  creature.autonomous = true;
  return { world, creature };
}

// runs the world for some game seconds; beforeStep runs before every step
function runFor(world, seconds, beforeStep = () => {}) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    beforeStep();
    sim.step(world, STEP, noInput);
  }
}

// ---------- Hormone glands ----------
for (const [typeName, fluid, name] of [['adrenal', sim.FLUID_ADRENALINE, 'Adrenaline'],
  ['calmgland', sim.FLUID_CALM, 'Calm'], ['fedgland', sim.FLUID_FED, 'Fed'],
  ['starvedgland', sim.FLUID_STARVED, 'Starved']]) {
  const { world, creature } = lone([cell(0, 0, 'nucleus'), cell(0, 1, typeName)], ['fluid']);
  const gland = cellAt(creature, 0, 1);
  runFor(world, 4, () => {
    gland.signal = 1;
  });
  // 4 s, since the slow moods' glands make less
  check(`a signalled ${sim.CELLS[typeName].name} makes ${name}, and it seeps into the Nucleus`,
    gland.fluids[fluid] > 0.3 && cellAt(creature, 0, 0).fluids[fluid] > 0.01,
    `${gland.fluids[fluid].toFixed(2)} / ${cellAt(creature, 0, 0).fluids[fluid].toFixed(3)}`);
}

// ---------- The Receptor ----------
const receptorWorld = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'receptor', { sensedHormone: 'calm' }),
  cell(1, 0, 'receptor')], ['nerve']);
const calmReceptor = cellAt(receptorWorld.creature, 0, 1);
const plainReceptor = cellAt(receptorWorld.creature, 1, 0);
check('a Receptor senses adrenaline unless told otherwise', plainReceptor.sensedHormone === 'adrenaline');
calmReceptor.fluids[sim.FLUID_CALM] = 0.5;
calmReceptor.fluids[sim.FLUID_ADRENALINE] = 1;
plainReceptor.fluids[sim.FLUID_ADRENALINE] = 1;
runFor(receptorWorld.world, STEP);
check('a Receptor signals how full of its own hormone it is, and ignores the others',
  Math.abs(calmReceptor.signal - 0.5) < 1e-9 && plainReceptor.signal === 1,
  `${calmReceptor.signal} / ${plainReceptor.signal}`);

// ---------- Moods: Synapse thresholds ----------
// the mood a lone Tissue cell takes on with this hormone full
function moodWith(fluid, systems = ['chemical']) {
  const { world, creature } = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'tissue')], systems);
  const tissue = cellAt(creature, 0, 1);
  if (fluid !== null) tissue.fluids[fluid] = 1;
  runFor(world, STEP);
  return tissue;
}
const synapseFires = (mood, input) =>
  sim.NEURON_RULES.synapse({ neuron: { kind: 'synapse', setting: 1 }, thresholdFactor: mood.thresholdFactor }, input);
const excited = moodWith(sim.FLUID_ADRENALINE);
const calmed = moodWith(sim.FLUID_CALM);
check('with no hormone a Synapse at threshold 1 needs its full input',
  synapseFires(moodWith(null), 0.9) === 0 && synapseFires(moodWith(null), 1) === 1);
check('adrenaline lowers a Synapse\'s threshold: 0.7 is enough', synapseFires(excited, 0.7) === 1,
  String(excited.thresholdFactor));
check('Calm raises it: a full input is not enough', synapseFires(calmed, 1) === 0, String(calmed.thresholdFactor));
check('with the chemical system off, hormones change no threshold',
  moodWith(sim.FLUID_ADRENALINE, ['fluid']).thresholdFactor === 1);

// ---------- Moods: Pacemakers ----------
// how many times a Pacemaker (1.4 Hz) switches on in 5 s with this hormone held full in it
function pacemakerBeats(fluid, systems = ['nerve', 'chemical']) {
  const { world, creature } = lone([cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') })], systems);
  const nucleus = creature.cells[0];
  let beats = 0;
  let wasOn = false;
  runFor(world, 5, () => {
    if (fluid !== null) nucleus.fluids[fluid] = 1;
    if (nucleus.signal > 0.5 && !wasOn) beats++;
    wasOn = nucleus.signal > 0.5;
  });
  return beats;
}
const steadyBeats = pacemakerBeats(null);
const fastBeats = pacemakerBeats(sim.FLUID_ADRENALINE);
const slowBeats = pacemakerBeats(sim.FLUID_CALM);
check('adrenaline speeds a Pacemaker up', fastBeats >= steadyBeats + 4, `${steadyBeats} → ${fastBeats}`);
check('Calm slows it down', slowBeats <= steadyBeats - 2, `${steadyBeats} → ${slowBeats}`);
check('with the chemical system off it keeps its rate',
  pacemakerBeats(sim.FLUID_ADRENALINE, ['nerve']) === steadyBeats);

// ---------- Moods: fuel burn ----------
// the sugar a signalled Muscle burns in 1 s with this hormone held full in it: what the creature loses, since sugar
// seeps into the muscle from the Nucleus, and the muscle is its only cell that burns fuel
function muscleBurn(fluid, systems = ['fluid', 'chemical']) {
  const { world, creature } = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'muscle')], systems);
  const muscle = cellAt(creature, 0, 1);
  const creatureSugar = () => creature.cells.reduce((sum, each) => sum + each.fluids[sim.FLUID_SUGAR], 0);
  const startSugar = creatureSugar();
  runFor(world, 1, () => {
    holdSignal(muscle, 1);
    if (fluid !== null) muscle.fluids[fluid] = 1;
  });
  return startSugar - creatureSugar();
}
const usualBurn = muscleBurn(null);
check('Calm halves fuel burn', Math.abs(muscleBurn(sim.FLUID_CALM) / usualBurn - 0.5) < 0.08,
  `${(muscleBurn(sim.FLUID_CALM) / usualBurn).toFixed(2)}`);
check('Starved halves it too', Math.abs(muscleBurn(sim.FLUID_STARVED) / usualBurn - 0.5) < 0.08,
  `${(muscleBurn(sim.FLUID_STARVED) / usualBurn).toFixed(2)}`);

// ---------- Moods: Fat stores ----------
// a Fat cell's fat after 2 s, starting this full of sugar and with this much fat, with a hormone held full in it
function fatAfter(sugarFill, startFat, fluid) {
  const { world, creature } = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'fat')], ['metabolism', 'chemical']);
  const fat = cellAt(creature, 0, 1);
  fat.fat = startFat;
  runFor(world, 2, () => {
    fat.fluids[sim.FLUID_SUGAR] = sugarFill * fat.fluidCapacity[sim.FLUID_SUGAR];
    if (fluid !== null) fat.fluids[fluid] = 1;
  });
  return fat.fat;
}
check('a Fat cell 60% full of sugar stores nothing by itself', fatAfter(0.6, 0, null) === 0);
// 2 s at 0.25 fat per s, three times as fast: 1.5 fat
check('with Fed it stores the spare sugar as fat, three times as fast', fatAfter(0.6, 0, sim.FLUID_FED) > 1.4,
  fatAfter(0.6, 0, sim.FLUID_FED).toFixed(2));
check('a Fat cell 70% full keeps its fat by itself', fatAfter(0.7, 5, null) === 5);
check('with Starved it turns fat back into sugar', fatAfter(0.7, 5, sim.FLUID_STARVED) < 4.7,
  fatAfter(0.7, 5, sim.FLUID_STARVED).toFixed(2));

// ---------- Gone cells ----------
// the Resilin gland and the Tanner went on 2026-11-07: a saved one, in a body or a Bud's part, loads as Tissue
const withResilin = sim.migrateLibraryEntry({ name: 'old', isCreature: true, fibres: [], cells: [
  cell(0, 0, 'nucleus'), cell(0, 1, 'resilin', { neuron: sim.createNeuron('inhibitor') }),
  cell(0, 2, 'bud', { budPart: { name: 'part', cells: [cell(0, 0, 'resilin')] } }), cell(1, 0, 'tanner')] });
check('a saved Resilin gland or Tanner loads as Tissue, keeping its neuron, also in a Bud part',
  withResilin.cells[1].typeName === 'tissue' && withResilin.cells[1].neuron.kind === 'inhibitor' &&
  withResilin.cells[2].budPart.cells[0].typeName === 'tissue' && withResilin.cells[3].typeName === 'tissue',
  JSON.stringify(withResilin.cells));

// ---------- The builder: the Receptor's hormone ----------
const edited = sim.createEditedDesign({ cells: [cell(0, 0, 'nucleus'), cell(0, 1, 'receptor'),
  cell(1, 0, 'tissue')] });
const receptorKey = sim.hexKey(0, 1);
sim.setSensedHormone(edited, receptorKey, 'fed');
sim.setSensedHormone(edited, sim.hexKey(1, 0), 'fed');
sim.setSensedHormone(edited, receptorKey, 'sugar');
const savedCells = sim.bodyDesign(edited).cells;
check('the builder sets a Receptor\'s hormone, keeps it in the design, and ignores other cells and fluids',
  savedCells.find(each => each.typeName === 'receptor').sensedHormone === 'fed' &&
  !savedCells.find(each => each.typeName === 'tissue').sensedHormone);
sim.setSensedHormone(edited, receptorKey, 'adrenaline');
check('choosing the default hormone again leaves it out of the design',
  !('sensedHormone' in edited.cells.get(receptorKey)));
const spawned = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'receptor', { sensedHormone: 'starved' })], []);
check('a spawned Receptor senses the design\'s hormone', cellAt(spawned.creature, 0, 1).sensedHormone === 'starved');

done();
