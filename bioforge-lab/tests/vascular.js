'use strict';
// The vascular system (sim and design rules): a beating Heart pumps blood between the cells within its reach, much
// faster than they seep; it beats only on a signal and as hard as it; an unsignalled Valve shuts the pumped flow as
// it shuts seeping; cold water doesn't slow a Heart; hormones ride in the blood; the system can be switched off; the
// builder warns about cells out of reach; and designs from before the Heart's areas keep their Hearts beating.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'createNeuron', 'FLUID_OXYGEN',
  'FLUID_ADRENALINE', 'HEART_REACH', 'migrateLibraryEntry', 'readCreatureFile', 'designWarnings', 'TEMPLATES',
  'CELLS', 'heartBeat']);

const STEP = 1 / 40;                                      // game s per step
const NO_INPUT = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };
const cellAt = (creature, q, r) => creature.cells.find(cell => cell.q === q && cell.r === r);
const inhibitor = () => ({ neuron: sim.createNeuron('inhibitor') });

// A column of cells straight down from the Nucleus: a Heart (or another cell) just below it, Tissue, and a Siphon at
// the end, `length` cells from the top. heartNeuron: the neuron in the Heart (an Inhibitor keeps it beating);
// valveBeforeSiphon: 'shut' or 'open': the cell above the Siphon, its only way in, is a Valve (open: it holds an
// Inhibitor, so it is signalled).
function createColumn({ middleType = 'heart', heartNeuron = inhibitor(), valveBeforeSiphon = false, length = 4,
  systems = ['nerve', 'fluid', 'vascular'] } = {}) {
  const cells = [sim.createDesignCell(0, 0, 'nucleus'),
    sim.createDesignCell(0, 1, middleType, middleType === 'heart' ? heartNeuron : {})];
  for (let r = 2; r < length; r++) {
    const isValve = r === length - 1 && !!valveBeforeSiphon;
    cells.push(sim.createDesignCell(0, r, isValve ? 'valve' : 'tissue', isValve && valveBeforeSiphon === 'open' ?
      inhibitor() : {}));
  }
  cells.push(sim.createDesignCell(0, length, 'siphon'));
  const world = sim.newWorld(600, 900, { systems });
  const creature = sim.spawn(world, { cells, fibres: [] }, 300, 200, 0, 0);
  creature.aiControlled = false;
  const siphon = cellAt(creature, 0, length);
  siphon.fluids[sim.FLUID_OXYGEN] = 0;
  return { world, creature, siphon };
}

// the Siphon's O2 after some game seconds; beforeStep runs before every step
function siphonOxygenAfter(column, seconds, beforeStep = () => {}) {
  for (let i = 0; i < seconds / STEP; i++) {
    beforeStep(column);
    sim.step(column.world, STEP, NO_INPUT);
  }
  return column.siphon.fluids[sim.FLUID_OXYGEN];
}

// after 0.3 s, before the pumped Siphon is full
const pumped = siphonOxygenAfter(createColumn(), 0.3);
const seeped = siphonOxygenAfter(createColumn({ middleType: 'tissue' }), 0.3);
check('fluids seep to the Siphon slowly with no Heart', seeped > 0 && seeped < 0.05, seeped.toFixed(4));
check('a beating Heart pumps O2 to it several times faster', pumped > 5 * seeped,
  `pumped ${pumped.toFixed(4)}, seeped ${seeped.toFixed(4)}`);
const unsignalled = siphonOxygenAfter(createColumn({ heartNeuron: {} }), 0.3);
check('a Heart without a signal doesn\'t beat, and pumps nothing', Math.abs(unsignalled - seeped) < 1e-9,
  `${unsignalled} vs ${seeped}`);
const beatOf = (signal, efficiency) => sim.heartBeat({ signal, efficiency, budParent: null });
check('a Heart beats as hard as its signal, held back by a lack of fuel', beatOf(0.5, 1) === 0.5 &&
  beatOf(2, 1) === 1 && beatOf(1, 0.25) === 0.25 && beatOf(0, 1) === 0);

const reach = sim.HEART_REACH;
const farSiphon = siphonOxygenAfter(createColumn({ length: reach + 2 }), 0.3);
const farSeeped = siphonOxygenAfter(createColumn({ middleType: 'tissue', length: reach + 2 }), 0.3);
check(`a Siphon more than ${reach} steps from the Heart gets only what seeps`, farSiphon < 2 * farSeeped + 1e-6,
  `${farSiphon.toFixed(5)} vs ${farSeeped.toFixed(5)}`);
const edgeSiphon = siphonOxygenAfter(createColumn({ length: reach + 1 }), 0.3);
check(`a Siphon ${reach} steps from the Heart is pumped`, edgeSiphon > 5 * farSeeped, edgeSiphon.toFixed(4));

// cold water (a world seepFactor below 1) slows seeping, not a Heart's push
const coldColumn = middleType => {
  const column = createColumn({ middleType });
  column.world.seepFactor = 0.05;
  return column;
};
const coldSeeped = siphonOxygenAfter(coldColumn('tissue'), 0.3);
const coldPumped = siphonOxygenAfter(coldColumn('heart'), 0.3);
check('in cold water seeping is far slower', coldSeeped < 0.1 * seeped, `${coldSeeped} vs ${seeped}`);
check('in cold water a beating Heart pumps nearly as well', coldPumped > 0.9 * pumped,
  `${coldPumped.toFixed(4)} vs ${pumped.toFixed(4)}`);
const switchedOff = siphonOxygenAfter(createColumn({ systems: ['nerve', 'fluid'] }), 0.3);
check('with the vascular system off, a Heart pumps nothing', Math.abs(switchedOff - seeped) < 1e-5,
  `${switchedOff} vs ${seeped}`);

const shut = siphonOxygenAfter(createColumn({ valveBeforeSiphon: 'shut' }), 1);
check('an unsignalled Valve before the Siphon shuts the blood out', shut === 0, String(shut));
const opened = siphonOxygenAfter(createColumn({ valveBeforeSiphon: 'open' }), 0.3);
check('a signalled Valve lets it through', opened > 5 * seeped, opened.toFixed(4));

const hormone = createColumn();
cellAt(hormone.creature, 0, 0).fluids[sim.FLUID_ADRENALINE] = 1;
const hormoneSeeped = createColumn({ middleType: 'tissue' });
cellAt(hormoneSeeped.creature, 0, 0).fluids[sim.FLUID_ADRENALINE] = 1;
siphonOxygenAfter(hormone, 0.3);
siphonOxygenAfter(hormoneSeeped, 0.3);
const adrenalineAt = column => column.siphon.fluids[sim.FLUID_ADRENALINE];
check('hormones ride in the blood too', adrenalineAt(hormone) > 3 * adrenalineAt(hormoneSeeped),
  `${adrenalineAt(hormone).toFixed(4)} vs ${adrenalineAt(hormoneSeeped).toFixed(4)}`);

// ---------- The builder's warnings ----------
const warningTexts = design => sim.designWarnings(design, []).map(warning => warning.text).join(' | ');
const near = { cells: createColumn().creature.design, fibres: [] };
check('a body within its Heart\'s reach gets no blood warning', !/seep to them/.test(warningTexts(near)),
  warningTexts(near));
const far = { cells: createColumn({ length: reach + 2 }).creature.design, fibres: [] };
check('a fuel-burning cell out of every Heart\'s reach is a hint', /more than 5 steps from every Heart/.test(
  warningTexts(far)), warningTexts(far));
const heartless = { cells: createColumn({ middleType: 'tissue' }).creature.design, fibres: [] };
check('with no Heart the working cells only seep', /pumped by no Heart/.test(warningTexts(heartless)),
  warningTexts(heartless));
const unwired = { cells: createColumn({ heartNeuron: {} }).creature.design, fibres: [] };
check('a Heart with no signal is a signal warning, like any cell that needs one', /signal/i.test(
  warningTexts(unwired)), warningTexts(unwired));

// ---------- Designs from before the Heart's areas ----------
const oldEntry = { name: 'Old jet', isCreature: true, fibres: [],
  cells: [sim.createDesignCell(0, 0, 'nucleus'), sim.createDesignCell(0, 1, 'heart'),
    sim.createDesignCell(1, 0, 'heart', { neuron: sim.createNeuron('pacemaker') })],
  vessels: [{ from: { q: 0, r: 1 }, to: { q: 0, r: 0 } }] };
const upgraded = sim.migrateLibraryEntry(oldEntry);
const heartNeuronAt = (entry, q, r) => entry.cells.find(cell => cell.q === q && cell.r === r).neuron;
check('a saved creature from before 2026-11-01 gets an Inhibitor in each Heart without a neuron, and loses its vessels',
  heartNeuronAt(upgraded, 0, 1).kind === 'inhibitor' && heartNeuronAt(upgraded, 1, 0).kind === 'pacemaker' &&
  !('vessels' in upgraded), JSON.stringify(upgraded));
const { vessels, ...savedSince } = oldEntry;
const current = sim.migrateLibraryEntry(JSON.parse(JSON.stringify(savedSince)));
check('a creature saved since is left as it is', !heartNeuronAt(current, 0, 1), JSON.stringify(current.cells));
const oldFile = JSON.stringify({ kind: 'bioforge-lab-creature', version: 1, gameVersion: '0.7.12',
  creature: oldEntry });
const fromFile = sim.readCreatureFile(oldFile);
check('an old creature file gets the same upgrade', !!fromFile.entry &&
  heartNeuronAt(fromFile.entry, 0, 1).kind === 'inhibitor', JSON.stringify(fromFile));
const templateHearts = Object.values(sim.TEMPLATES).flatMap(design => design.cells)
  .filter(cell => sim.CELLS[cell.typeName].pumps);
check('every built-in design\'s Heart holds a neuron, so it beats', templateHearts.length > 0 &&
  templateHearts.every(cell => cell.neuron), `${templateHearts.length} Hearts`);

done();
