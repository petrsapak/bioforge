'use strict';
// The chemical layer (milestone 7): hormone glands, the Receptor, moods (Synapse thresholds, Pacemaker speed, fuel
// burn, Fat storage) and the treatments (Tanner, Resilin gland), each with its system switched off as well. Sim only:
// glands and muscles are held signalled by hand, and hormone levels are set by hand where only their effect is tested.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'createNeuron', 'damageCell',
  'NEURON_RULES', 'FLUID_SUGAR', 'FLUID_ADRENALINE', 'FLUID_CALM', 'FLUID_FED', 'FLUID_STARVED', 'CELLS',
  'TREAT_TIME', 'TANNED_DAMAGE_FACTOR', 'stingShare', 'BOND_STIFFNESS', 'createEditedDesign', 'setSensedHormone', 'bodyDesign',
  'hexKey', 'TIPS', 'newTestTank', 'exampleCells', 'linksFromList']);

const cell = (q, r, typeName, extras = {}) => sim.createDesignCell(q, r, typeName, extras);
const noInput = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };
const STEP = 1 / 40;
const cellAt = (creature, q, r) => creature.cells.find(each => each.q === q && each.r === r);

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
    muscle.signal = 1;
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

// ---------- Tanner ----------
// a Tanner in a row of Tissue, held signalled for some game seconds
function tannedRow(seconds, systems = ['treatments']) {
  const cells = [cell(0, 0, 'nucleus'), cell(1, 0, 'tanner'), cell(2, 0, 'tissue'), cell(3, 0, 'tissue'),
    cell(4, 0, 'tissue')];
  const { world, creature } = lone(cells, systems);
  const tanner = cellAt(creature, 1, 0);
  runFor(world, seconds, () => {
    tanner.signal = 1;
  });
  return { world, creature };
}
const tanned = row => row.creature.cells.filter(each => each.tanned).map(each => each.q);
check('a Tanner tans one cell every TREAT_TIME, nearest first',
  tanned(tannedRow(sim.TREAT_TIME + 0.05)).join() === '1' &&
  tanned(tannedRow(3 * sim.TREAT_TIME + 0.05)).join() === '0,1,2', tanned(tannedRow(3 * sim.TREAT_TIME + 0.05)).join());
const fullyTanned = tannedRow(10);
check('it reaches only 2 cells away', tanned(fullyTanned).join() === '0,1,2,3');
const tannedTissue = cellAt(fullyTanned.creature, 2, 0);
const healthBefore = tannedTissue.health;
sim.damageCell(tannedTissue, 10);
check('a tanned cell takes less damage (TANNED_DAMAGE_FACTOR of it)',
  Math.abs(healthBefore - tannedTissue.health - 10 * sim.TANNED_DAMAGE_FACTOR) < 1e-9);
const bondBetween = (world, firstQ, secondQ) => world.bonds.find(bond =>
  [bond.first.q, bond.second.q].sort().join() === [firstQ, secondQ].sort().join() && bond.first.r === 0 &&
  bond.second.r === 0);
check('a bond between two tanned cells is stiffer; one to an untanned cell is not',
  bondBetween(fullyTanned.world, 2, 3).stiffness > 2 * sim.BOND_STIFFNESS &&
  bondBetween(fullyTanned.world, 3, 4).stiffness === sim.BOND_STIFFNESS);
check('with the treatments system off nothing is tanned', tanned(tannedRow(10, [])).length === 0);

// a Muscle's size after 0.1 s of contracting, tanned or not
function contractedSize(isTanned) {
  const { world, creature } = lone([cell(0, 0, 'nucleus'), cell(0, 1, 'muscle')], []);
  const muscle = cellAt(creature, 0, 1);
  if (isTanned) muscle.resizeRateFactor = 0.5;
  runFor(world, 0.1, () => {
    muscle.signal = 1;
  });
  return muscle.size;
}
check('a tanned muscle contracts slower', contractedSize(true) > contractedSize(false) + 0.1,
  `${contractedSize(false).toFixed(2)} vs ${contractedSize(true).toFixed(2)}`);

// ---------- Resilin ----------
// A Resilin gland beside a Muscle, with a Tissue beyond it: the gland treats, then the muscle is held contracted for
// holdSeconds and let go. Returns the Tissue's speed the step after the release, and the creature.
function resilinSnap(holdSeconds, systems = ['treatments']) {
  const cells = [cell(0, 0, 'nucleus'), cell(1, 0, 'resilin'), cell(0, 1, 'muscle'), cell(0, 2, 'tissue')];
  const { world, creature } = lone(cells, systems);
  const gland = cellAt(creature, 1, 0);
  const muscle = cellAt(creature, 0, 1);
  runFor(world, sim.TREAT_TIME + 0.05, () => {
    gland.signal = 1;
  });
  gland.signal = 0;
  runFor(world, holdSeconds, () => {
    muscle.signal = 1;
  });
  muscle.signal = 0;
  const tissue = cellAt(creature, 0, 2);
  runFor(world, STEP);
  return { speed: Math.hypot(tissue.velocityX, tissue.velocityY), creature, muscle };
}
const snap = resilinSnap(1);
const plainRelease = resilinSnap(1, []);
check('a Resilin gland makes only muscles springy',
  snap.muscle.resilient && snap.creature.cells.filter(each => each.resilient).length === 1);
check('a springy muscle held contracted, then let go, kicks its neighbour much harder than a plain one',
  snap.speed > 3 * plainRelease.speed, `${plainRelease.speed.toFixed(1)} → ${snap.speed.toFixed(1)} px/s`);
check('a short hold charges it less', resilinSnap(0.3).speed < snap.speed);

// a springy muscle beside a dummy enemy Tissue, held contracted for some game seconds and let go: the damage it took
function strikeOnDummy(seconds) {
  const cells = [cell(0, 0, 'nucleus'), cell(1, 0, 'resilin'), cell(0, -1, 'muscle')];
  const { world, creature } = lone(cells, ['treatments']);
  const muscle = cellAt(creature, 0, -1);
  const dummy = sim.spawn(world, { cells: [cell(0, 0, 'tissue')] }, muscle.x, muscle.y - 22, 0, 1);
  dummy.autonomous = true;
  const gland = cellAt(creature, 1, 0);
  runFor(world, sim.TREAT_TIME + 0.05, () => {
    gland.signal = 1;
  });
  gland.signal = 0;
  const target = dummy.cells[0];
  const healthBefore = target.health;
  runFor(world, seconds, () => {
    muscle.signal = 1;
  });
  muscle.signal = 0;
  runFor(world, STEP);
  return healthBefore - Math.max(0, target.health);
}
check('the snap strikes an enemy cell touching the muscle, harder for a full charge',
  strikeOnDummy(1) >= sim.CELLS.tissue.health && strikeOnDummy(0.3) < strikeOnDummy(1),   // a full strike kills the Tissue
  `${strikeOnDummy(0.3).toFixed(1)} / ${strikeOnDummy(1).toFixed(1)}`);
check('a tanned cell blunts thorns like Shell', sim.stingShare({ type: sim.CELLS.tissue, tanned: true }) < 1 &&
  sim.stingShare({ type: sim.CELLS.tissue, tanned: false, mineralized: false }) === 1);
const momentum = snap.creature.cells.reduce((sum, each) => sum + each.type.mass * each.velocityY, 0);
// the kick pushes both ways; after a step of water drag a little momentum is left, small next to the kick itself
check('the kick keeps the creature\'s momentum', Math.abs(momentum) < 0.1 * snap.speed, momentum.toFixed(2));

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

// ---------- Tooltip examples ----------
// each new cell's example (data/tips.js) wires it, so it works in the builder's test tank
for (const typeName of ['receptor', 'calmgland', 'fedgland', 'starvedgland', 'tanner', 'resilin']) {
  const example = sim.TIPS[typeName].example;
  const world = sim.newTestTank(288, 190);
  const design = { cells: sim.exampleCells(example), fibres: sim.linksFromList(example.fibres || []) };
  const creature = sim.spawn(world, design, 144, 100, 0, 0);
  const shown = creature.cells.find(own => own.typeName === typeName);
  let worked = false;
  for (let i = 0; i < 320; i++) {
    sim.step(world, STEP, { swimX: 0, swimY: 0, ability: i % 80 > 40, heldKeys: new Set() });
    worked = worked || shown.signal > 0.5 || shown.springCharge > 0.5;
  }
  const changed = typeName === 'tanner' ? creature.cells.some(own => own.tanned) : worked;
  check(`the ${sim.CELLS[typeName].name} tooltip example works in the test tank`, changed);
}

done();
