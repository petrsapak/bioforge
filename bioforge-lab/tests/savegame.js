'use strict';
// Saves: a level or a fight saved halfway and restored runs on exactly as the original does, shared objects and
// odd numbers survive, the resume state and creature files are checked when read, and old saves are upgraded.
const { load } = require('./load');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'CELLS', 'GAME_VERSION', 'SAVE_VERSION', 'startLevel',
  'stepLevel', 'newWorld', 'spawn', 'step', 'takeSnapshot', 'restoreSnapshot', 'indexDataObjects', 'savedRun',
  'restoredRun', 'runDataIndex', 'createResumeState', 'readResumeState', 'creatureFileText', 'creatureFileName',
  'readCreatureFile', 'upgradeStoredSave']);

const STEP_SECONDS = 1 / 40;
const STEPS_BEFORE_SAVE = 160;                            // 4 game s
const STEPS_AFTER_SAVE = 160;
const SPACE_PERIOD = 40;                                  // steps: Space is held every other second

// the input of step i: Space held every other second, so that Commands fire
const inputAt = i => ({ swimX: 0, swimY: -1, ability: Math.floor(i / SPACE_PERIOD) % 2 === 1, heldKeys: new Set() });
// the whole state as text, to compare two runs exactly (JSON keeps every digit of a number)
const stateText = run => JSON.stringify(sim.takeSnapshot(run, sim.runDataIndex()));
// what savedRun keeps, through JSON as the save does
const throughSave = (mode, run) => sim.restoredRun(JSON.parse(JSON.stringify(sim.savedRun(mode, run, null))));

// ---------- A run saved halfway goes on as the original ----------
for (const level of sim.LEVELS) {
  const run = sim.startLevel(level, sim.TEMPLATES.jet);
  for (let i = 0; i < STEPS_BEFORE_SAVE; i++) sim.stepLevel(run, STEP_SECONDS, inputAt(i));
  const restored = throughSave('level', run);
  for (let i = STEPS_BEFORE_SAVE; i < STEPS_BEFORE_SAVE + STEPS_AFTER_SAVE; i++) {
    sim.stepLevel(run, STEP_SECONDS, inputAt(i));
    sim.stepLevel(restored, STEP_SECONDS, inputAt(i));
  }
  check(`${level.name}: restored halfway, it runs on exactly as the original`,
    stateText(restored) === stateText(run) && restored.time === run.time);
}

// a fight with an AI hunter, acid, nettles and adrenaline, saved in the middle of it
{
  const world = sim.newWorld(900, 700, { seed: 7 });
  const player = sim.spawn(world, sim.TEMPLATES.eel, 300, 400, 0, 0);
  sim.spawn(world, sim.TEMPLATES.nettler, 600, 300, Math.PI, 1);
  sim.spawn(world, sim.TEMPLATES.spitter, 450, 150, Math.PI, 1);
  const sandbox = { world, player };
  for (let i = 0; i < STEPS_BEFORE_SAVE; i++) sim.step(world, STEP_SECONDS, inputAt(i));
  const restored = throughSave('sandbox', sandbox);
  for (let i = STEPS_BEFORE_SAVE; i < STEPS_BEFORE_SAVE + STEPS_AFTER_SAVE; i++) {
    sim.step(world, STEP_SECONDS, inputAt(i));
    sim.step(restored.world, STEP_SECONDS, inputAt(i));
  }
  check('a fight restored halfway runs on exactly as the original', stateText(restored) === stateText(sandbox));
  const cell = restored.world.cells[0];
  check('a restored cell points at the game\'s own cell type and at its creature',
    cell.type === sim.CELLS[cell.typeName] && restored.world.creatures.includes(cell.creature));
  check('the restored player is the creature in the restored world', restored.world.creatures.includes(restored.player));
}

// ---------- The encoding ----------
{
  const index = sim.indexDataObjects({ CELLS: sim.CELLS });
  const shared = { name: 'shared' };
  const original = { numbers: [NaN, -0, Infinity, -Infinity, 0.1 + 0.2], missing: undefined, shared, again: shared,
    map: new Map([['a', 1]]), set: new Set(['x']), type: sim.CELLS.muscle };
  original.self = original;
  const copy = sim.restoreSnapshot(JSON.parse(JSON.stringify(sim.takeSnapshot(original, index))), index);
  check('NaN, -0, ±Infinity and every digit survive', Number.isNaN(copy.numbers[0]) && Object.is(copy.numbers[1], -0) &&
    copy.numbers[2] === Infinity && copy.numbers[3] === -Infinity && copy.numbers[4] === 0.1 + 0.2);
  check('undefined fields stay', 'missing' in copy && copy.missing === undefined);
  check('a shared object stays shared, and a loop stays a loop', copy.shared === copy.again && copy.self === copy);
  check('Maps and Sets come back', copy.map.get('a') === 1 && copy.set.has('x'));
  check('a data object comes back as the game\'s own', copy.type === sim.CELLS.muscle);
  let error = '';
  try {
    sim.takeSnapshot({ cell: { update: () => 0 } }, index);
  } catch (thrown) {
    error = thrown.message;
  }
  check('a function can\'t be kept, and the error says where it was', error.includes('root.cell.update'));
}

// ---------- The resume state ----------
{
  const design = { name: 'Jet', isCreature: true, ...sim.TEMPLATES.jet };
  const run = { mode: 'level', levelDesign: null, snapshot: '{}' };
  const saved = JSON.parse(JSON.stringify(sim.createResumeState(design, 'lighthouse', run)));
  const read = sim.readResumeState(saved);
  check('a resume state reads back with its design, level and run',
    read.design.cells.length === design.cells.length && read.levelId === 'lighthouse' && read.run);
  check('a run saved by another game version is dropped, the design and level kept',
    sim.readResumeState({ ...saved, gameVersion: '0.0.1' }).run === null &&
    sim.readResumeState({ ...saved, gameVersion: '0.0.1' }).levelId === 'lighthouse');
  check('a level the game no longer has is dropped, and with it a level run',
    sim.readResumeState({ ...saved, levelId: 'gone' }).levelId === null &&
    sim.readResumeState({ ...saved, levelId: 'gone' }).run === null);
  check('a save from a newer game, or a damaged one, is not used',
    sim.readResumeState({ ...saved, version: sim.SAVE_VERSION + 1 }) === null &&
    sim.readResumeState({ ...saved, design: { cells: [{ q: 0, r: 0, typeName: 'dragon' }] } }) === null &&
    sim.readResumeState(null) === null && sim.readResumeState('text') === null);
}

// ---------- Creature files ----------
{
  const entry = { name: 'Eel / long', isCreature: true, ...sim.TEMPLATES.eel };
  const result = sim.readCreatureFile(sim.creatureFileText(entry));
  check('a creature file reads back as the same creature',
    result.entry && result.entry.name === entry.name && result.entry.isCreature &&
    JSON.stringify(result.entry.cells) === JSON.stringify(entry.cells) &&
    JSON.stringify(result.entry.fibres) === JSON.stringify(entry.fibres));
  check('its file name keeps only safe characters', sim.creatureFileName(entry) === 'Eel  long.bioforge.json');
  const file = JSON.parse(sim.creatureFileText(entry));
  check('the file carries its format version and the game version',
    file.version === 1 && file.gameVersion === sim.GAME_VERSION);
  check('a file that isn\'t JSON says so', /isn't a creature file/.test(sim.readCreatureFile('{oops').problem));
  check('another JSON file says so', /isn't a Bioforge Lab creature/.test(sim.readCreatureFile('{"a":1}').problem));
  check('a file from a newer game says so',
    /newer version/.test(sim.readCreatureFile(JSON.stringify({ ...file, version: 99 })).problem));
  const strange = { ...file, creature: { ...file.creature, cells: [{ q: 0, r: 0, typeName: 'dragon' }] } };
  check('a creature with a cell type this game doesn\'t have is refused',
    !!sim.readCreatureFile(JSON.stringify(strange)).problem);
}

// ---------- Upgrading old saves ----------
{
  const stored = { library: [{ name: 'Old', full: true, cells: [{ t: 'nucleus', q: 0, r: 0 }, { t: 'pacemaker', q: 1,
    r: 0 }] }] };
  const read = (name, fallback) => (name in stored ? stored[name] : fallback);
  const write = (name, value) => {
    stored[name] = value;
  };
  check('a save without a version is upgraded from version 0', sim.upgradeStoredSave(read, write) === 0);
  const [upgraded] = stored.library;
  check('the upgrade stores the library in the current format',
    upgraded.isCreature && upgraded.cells[1].typeName === 'tissue' && upgraded.cells[1].neuron.kind === 'pacemaker' &&
    Array.isArray(upgraded.fibres));
  check('the save then carries the current version', stored['save-version'] === sim.SAVE_VERSION);
  stored['save-version'] = sim.SAVE_VERSION + 1;
  stored.library = 'from the future';
  sim.upgradeStoredSave(read, write);
  check('a save from a newer game is left as it is',
    stored.library === 'from the future' && stored['save-version'] === sim.SAVE_VERSION + 1);
}

done();
