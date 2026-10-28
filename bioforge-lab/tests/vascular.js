'use strict';
// The vascular layer (sim and builder rules): a vessel carries blood between its two ends, much faster while a Heart
// on it beats; an unsignalled Valve on it shuts it; hormones stay out of it; it is cut with its cells; the system can
// be switched off; vessel units are limited; and the builder lays, removes, stamps, saves and loads vessels.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['newWorld', 'spawn', 'step', 'createDesignCell', 'vesselUnits', 'buildCheck', 'RULES',
  'FLUID_OXYGEN', 'FLUID_ADRENALINE', 'createEditedDesign', 'toggleVessel', 'removeCell', 'bodyDesign', 'placeCell',
  'templateFromSelection', 'stampPlacement', 'migrateLibraryEntry', 'designWarnings', 'TEMPLATES', 'hexKey',
  'linksFromList']);

const STEP = 1 / 40;
const NO_INPUT = { swimX: 0, swimY: 0, ability: false, heldKeys: new Set() };
const cellAt = (creature, q, r) => creature.cells.find(cell => cell.q === q && cell.r === r);

// A column of five cells: the Nucleus on top, a Siphon at the bottom, and between them a middle cell (a Heart unless
// told otherwise) and two Tissue. With a vessel, it runs from the Nucleus down to the Siphon through all of them.
function createColumn({ middleType = 'heart', valveAt2 = false, hasVessel = true, systems = ['vascular'] } = {}) {
  const cells = [
    sim.createDesignCell(0, 0, 'nucleus'),
    sim.createDesignCell(0, 1, middleType),
    sim.createDesignCell(0, 2, valveAt2 ? 'valve' : 'tissue'),
    sim.createDesignCell(0, 3, 'tissue'),
    sim.createDesignCell(0, 4, 'siphon'),
  ];
  const vessels = hasVessel ? sim.linksFromList([[0, 0, 0, 4]]) : [];
  const world = sim.newWorld(600, 600, { systems });
  const creature = sim.spawn(world, { cells, fibres: [], vessels }, 300, 200, 0, 0);
  creature.aiControlled = false;
  const siphon = cellAt(creature, 0, 4);
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

// after 0.2 s, before the pumped Siphon is full: a pumped vessel carries 11x as much
const pumped = siphonOxygenAfter(createColumn(), 0.2);
const idle = siphonOxygenAfter(createColumn({ middleType: 'tissue' }), 0.2);
const none = siphonOxygenAfter(createColumn({ hasVessel: false }), 1);
check('a vessel carries O2 from the Nucleus to the far Siphon', idle > 0.01, idle.toFixed(3));
check('a Heart on the vessel pumps it several times faster', pumped > 3 * idle,
  `pumped ${pumped.toFixed(3)}, idle ${idle.toFixed(3)}`);
check('without a vessel nothing reaches it (seeping is the fluid system\'s, off here)', none === 0, String(none));
const switchedOff = siphonOxygenAfter(createColumn({ systems: [] }), 1);
check('with the vascular system off, vessels carry nothing', switchedOff === 0, String(switchedOff));

const shut = siphonOxygenAfter(createColumn({ valveAt2: true }), 1);
check('an unsignalled Valve on the vessel shuts it', shut === 0, String(shut));
const opened = siphonOxygenAfter(createColumn({ valveAt2: true }), 0.2, column => {
  cellAt(column.creature, 0, 2).signal = 1;
});
check('a signalled Valve lets blood through', Math.abs(opened - pumped) < 1e-9, `${opened} vs ${pumped}`);

const hormone = createColumn();
cellAt(hormone.creature, 0, 0).fluids[sim.FLUID_ADRENALINE] = 1;
siphonOxygenAfter(hormone, 1);
check('hormones do not travel in vessels', hormone.siphon.fluids[sim.FLUID_ADRENALINE] === 0);

const injured = createColumn();
check('the vessel is in the world', injured.world.vessels.length === 1 && injured.world.vessels[0].units === 4);
cellAt(injured.creature, 0, 2).health = 0;
sim.step(injured.world, STEP, NO_INPUT);
check('a vessel is cut when a cell it runs through dies', injured.world.vessels.length === 0);

// ---------- Limits ----------
const longVessel = { cells: createColumn().creature.design, vessels: sim.linksFromList([[0, 0, 0, 4], [0, 4, 0, 1]]) };
check('vessel units are counted along their routes', sim.vesselUnits(longVessel) === 7,
  String(sim.vesselUnits(longVessel)));
const savedLimit = sim.RULES.maxVesselUnits;
sim.RULES.maxVesselUnits = 6;
check('more vessel units than the limit are reported', /Too many vessel units: 7 \/ 6/.test(sim.buildCheck(longVessel)),
  sim.buildCheck(longVessel));
sim.RULES.maxVesselUnits = savedLimit;

const heartOnly = { cells: createColumn().creature.design, fibres: [], vessels: [] };
const warningTexts = design => sim.designWarnings(design, []).map(warning => warning.text).join(' | ');
check('a Heart on no vessel is a warning', /Heart\(s\) sit on no vessel/.test(warningTexts(heartOnly)),
  warningTexts(heartOnly));
const heartOnVessel = { ...heartOnly, vessels: longVessel.vessels };
check('a Heart on a vessel is not', !/sit on no vessel/.test(warningTexts(heartOnVessel)));
for (const name of ['jet', 'seeker', 'paddler']) {
  const design = sim.TEMPLATES[name];
  check(`the ${name} has vessels from its Heart and no vessel warning`,
    design.vessels.length > 0 && !/vessel/.test(warningTexts(design)), warningTexts(design));
}

// ---------- The builder ----------
const edited = sim.createEditedDesign({ cells: createColumn().creature.design });
const key = (q, r) => sim.hexKey(q, r);
check('a vessel is laid between two cells', sim.toggleVessel(edited, key(0, 0), key(0, 4)) === 'laid' &&
  edited.vessels.length === 1);
check('dragging it the other way round removes it', sim.toggleVessel(edited, key(0, 4), key(0, 0)) === 'removed' &&
  edited.vessels.length === 0);
check('no vessel from a cell to itself or to an empty hex', sim.toggleVessel(edited, key(0, 0), key(0, 0)) === '' &&
  sim.toggleVessel(edited, key(0, 0), key(3, 3)) === '');
sim.toggleVessel(edited, key(0, 0), key(0, 4));
sim.placeCell(edited, 3, 0, 'tissue');
sim.placeCell(edited, 3, 1, 'tissue');
sim.toggleVessel(edited, key(3, 0), key(3, 1));
check('the body keeps only the vessels between joined cells', sim.bodyDesign(edited).vessels.length === 1);
const saved = sim.templateFromSelection(edited, new Set([key(0, 0), key(0, 1), key(0, 2), key(0, 3), key(0, 4)]),
  'Column');
check('saving a selection keeps its vessels', saved.vessels.length === 1);
const loaded = sim.migrateLibraryEntry(JSON.parse(JSON.stringify(saved)));
check('a saved entry loads with its vessels', loaded.vessels.length === 1 && loaded.vessels[0].to.r === 4);
check('an entry saved before vessels loads with none', sim.migrateLibraryEntry({ name: 'Old', cells: [] }).vessels
  .length === 0);
const part = { name: 'Pipe', isCreature: false, cells: [sim.createDesignCell(0, 0, 'heart'),
  sim.createDesignCell(1, 0, 'tissue')], fibres: [], vessels: sim.linksFromList([[0, 0, 1, 0]]) };
const placement = sim.stampPlacement(edited, { template: part, rotation: 1 }, -3, 2);
const placedVessel = placement.vessels[0];
check('a stamp places its vessels turned and moved with its cells', placement.vessels.length === 1 &&
  placedVessel.from.q === -3 && placedVessel.from.r === 2 && placedVessel.to.q === -3 && placedVessel.to.r === 3,
  JSON.stringify(placement.vessels));
sim.removeCell(edited, 0, 4);
check('removing a cell removes its vessels', !edited.vessels.some(vessel => vessel.to.r === 4));

done();
