'use strict';
// The tutorial: its lessons are well formed (known conditions, real targets, unique voice ids), the rules pick the
// right lesson and read the design right, and in the app a new game walks through level 1's lesson by doing each
// step, with Skip, Replay and the voice setting.
const fs = require('fs');
const path = require('path');
const { load, ROOT } = require('./load');
const { startApp, LEAVE_TITLE_FRAMES } = require('./dom');
const { check, done } = require('./check');

const sim = load({}, ['TUTORIAL_LESSONS', 'CELLS', 'NEURONS', 'LEVELS', 'createTutorialRecord', 'nextTutorialLesson',
  'nextShownStep', 'isTutorialConditionMet', 'createEditedDesign']).X;

// ---------- The lessons ----------
const CONDITION_KINDS = ['cellPicked', 'neuronPicked', 'cellCount', 'view', 'neuronIn', 'fibresTo', 'fibresAcross',
  'mode', 'runEnded', 'levelWon'];
const steps = sim.TUTORIAL_LESSONS.flatMap(lesson => lesson.steps);
const pageIds = new Set([...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/id="([^"]+)"/g)]
  .map(match => match[1]));
const levelIds = sim.LEVELS.map(level => level.id);
const lessonIds = sim.TUTORIAL_LESSONS.map(lesson => lesson.id);

check('every step has words and an id of its own (the voice file\'s name)',
  steps.every(step => step.text && /^[a-z0-9-]+$/.test(step.id)) &&
  new Set(steps.map(step => step.id)).size === steps.length);
const badConditions = steps.filter(step => [step.waitFor, step.skipIf].some(condition => condition &&
  condition !== 'next' && !CONDITION_KINDS.includes(condition.kind)));
check('every step waits for Next or a known condition', !badConditions.length && steps.every(step => step.waitFor),
  badConditions.map(step => step.id).join());
const badTargets = steps.filter(step => step.target && !(
  (step.target.element && pageIds.has(step.target.element)) || (step.target.cell && sim.CELLS[step.target.cell]) ||
  (step.target.neuron && sim.NEURONS[step.target.neuron]) || Array.isArray(step.target.hexes)));
check('every target is a real element of the page, cell type, neuron or list of hexes', !badTargets.length,
  badTargets.map(step => step.id).join());
const conditions = steps.flatMap(step => [step.waitFor, step.skipIf]).filter(condition => condition && condition.kind);
const badNames = conditions.filter(condition => (condition.cell && !sim.CELLS[condition.cell]) ||
  (condition.neuron && !sim.NEURONS[condition.neuron]) || (condition.level && !levelIds.includes(condition.level)) ||
  [condition.from, condition.to].some(type => type && !sim.CELLS[type]));
check('every cell, neuron and level a condition names exists', !badNames.length, JSON.stringify(badNames));
check('every lesson\'s level, needed win and lesson before it exist', sim.TUTORIAL_LESSONS.every(lesson =>
  (!lesson.level || levelIds.includes(lesson.level)) && (!lesson.needsWin || levelIds.includes(lesson.needsWin)) &&
  (!lesson.after || lessonIds.includes(lesson.after))));

// ---------- Which lesson is next ----------
const results = (...ids) => Object.fromEntries(ids.map(id => [id, { stars: 1 }]));
const fresh = sim.createTutorialRecord();
check('a new game\'s tutorial starts with level 1\'s lesson', sim.nextTutorialLesson(fresh, {}).id === 'first-stroke');
check('the next lesson waits for level 1 to be won',
  sim.nextTutorialLesson({ ...fresh, done: ['first-stroke'] }, {}) === null &&
  sim.nextTutorialLesson({ ...fresh, done: ['first-stroke'] }, results('first-stroke')).id === 'lighthouse');
const veteran = sim.createTutorialRecord();
check('a player past levels 1 and 2 skips their lessons and gets the tour of the Lab',
  sim.nextTutorialLesson(veteran, results('first-stroke', 'lighthouse')).id === 'lab-tour' &&
  veteran.done.join() === 'first-stroke,lighthouse', veteran.done.join());
check('a replay plays level 1\'s lesson although the level is won',
  sim.nextTutorialLesson(sim.createTutorialRecord(true), results('first-stroke')).id === 'first-stroke');
check('a skipped tutorial plays nothing', sim.nextTutorialLesson({ ...fresh, isOn: false }, {}) === null);

// ---------- Reading the design ----------
const cell = (q, r, typeName, neuron) => ({ q, r, typeName, ...(neuron ? { neuron: { kind: neuron } } : {}) });
const fibre = (fromQ, fromR, toQ, toR) => ({ from: { q: fromQ, r: fromR }, to: { q: toQ, r: toR } });
const factsFor = (cells, fibres, more = {}) => ({ design: sim.createEditedDesign({ cells, fibres }), selectedType: null,
  selectedNeuron: null, layer: 'nerve', mode: 'build', runOutcome: null, levelResults: {}, ...more });
const isMet = (condition, facts) => sim.isTutorialConditionMet(condition, facts);
const firstStroke = factsFor([cell(0, 0, 'nucleus', 'pacemaker'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')],
  [fibre(0, 0, -1, 1), fibre(0, 0, 0, 1)]);
check('level 1\'s answer meets its lesson\'s conditions', isMet({ kind: 'cellCount', cell: 'siphon', count: 2 },
  firstStroke) && isMet({ kind: 'neuronIn', neuron: 'pacemaker', cell: 'nucleus' }, firstStroke) &&
  isMet({ kind: 'fibresTo', from: 'nucleus', to: 'siphon', count: 2 }, firstStroke));
const oneFibre = factsFor([cell(0, 0, 'nucleus'), cell(-1, 1, 'siphon'), cell(0, 1, 'siphon')], [fibre(0, 0, -1, 1),
  fibre(0, 0, -1, 1)]);
check('two fibres to the same Siphon are not one to each',
  !isMet({ kind: 'fibresTo', from: 'nucleus', to: 'siphon', count: 2 }, oneFibre));
const eyes = [cell(0, 0, 'nucleus'), cell(0, -1, 'lighteye'), cell(1, -1, 'lighteye'), cell(-1, 1, 'siphon'),
  cell(0, 1, 'siphon')];
const across = { kind: 'fibresAcross', from: 'lighteye', to: 'siphon' };
check('crossed eyes are across; eyes on their own side, or one eye wired, are not',
  isMet(across, factsFor(eyes, [fibre(0, -1, 0, 1), fibre(1, -1, -1, 1)])) &&
  !isMet(across, factsFor(eyes, [fibre(0, -1, -1, 1), fibre(1, -1, 0, 1)])) &&
  !isMet(across, factsFor(eyes, [fibre(0, -1, 0, 1)])));
check('the view condition holds only in the builder', isMet({ kind: 'view', layer: 'nerve' }, firstStroke) &&
  !isMet({ kind: 'view', layer: 'nerve' }, { ...firstStroke, mode: 'level' }));
const lighthouse = sim.TUTORIAL_LESSONS.find(lesson => lesson.id === 'lighthouse');
const lostIndex = lighthouse.steps.findIndex(step => step.id === 'lighthouse-lost');
check('the words for a lost run are left out once the level is won',
  sim.nextShownStep(lighthouse, lostIndex, factsFor([], [], { levelResults: results('lighthouse') })) ===
  lostIndex + 1 && sim.nextShownStep(lighthouse, lostIndex, factsFor([], [])) === lostIndex);

// ---------- In the app: a new game ----------
const game = startApp({}, { atMainMenu: true });
const { byId, fire, runFrames, readGlobal, storage } = game;
game.runFrames(2);
byId('menu-new-game').onclick({});
runFrames(LEAVE_TITLE_FRAMES);
const bubbleText = () => byId('tutorial-text').textContent;
const isBubbleShown = () => byId('tutorial').style.display === 'block';
check('a new game starts the tutorial: the welcome, with Next',
  isBubbleShown() && /Welcome to the Lab/.test(bubbleText()) && byId('tutorial-next').style.display === '',
  bubbleText());
const pressNext = () => {
  byId('tutorial-next').onclick();
  runFrames(1);
};
pressNext();
check('Next moves on to the Nucleus', /This is the Nucleus/.test(bubbleText()), bubbleText());
pressNext();
pressNext();
check('a step that waits for the player has no Next', /Pick the Siphon/.test(bubbleText()) &&
  byId('tutorial-next').style.display === 'none', bubbleText());
runFrames(5);
check('it waits until the player does it', /Pick the Siphon/.test(bubbleText()));

// the screen px of hex (q, r)'s centre at the start zoom, the grid in the middle of the 1600 x 900 fake screen
const START_ZOOM = 1.9;                                   // screen px per grid px (ZOOM_START)
const screenPointOf = (q, r) => {
  const [x, y] = readGlobal('hexToPixel')(q, r);
  return { clientX: 800 + x * START_ZOOM, clientY: 450 + y * START_ZOOM, target: byId('game') };
};
// the dock's button for a cell type or neuron kind (attribute 'type' or 'neuron')
const dockButton = (attribute, name) => byId('palette').children.flatMap(section => section.children[0].children)
  .find(button => button.dataset[attribute] === name);
// whether the builder works toward the level of this name (the Levels button's tooltip names it)
const chosenLevelIs = name => byId('show-levels').title.includes(name);
const clickHex = (q, r) => {
  fire('game', 'mousemove', screenPointOf(q, r));
  fire('game', 'mousedown', { ...screenPointOf(q, r), button: 0 });
  fire('window', 'mouseup', screenPointOf(q, r));
  runFrames(1);
};
const dragFibre = (fromQ, fromR, toQ, toR) => {
  fire('game', 'mousemove', screenPointOf(fromQ, fromR));
  fire('game', 'mousedown', { ...screenPointOf(fromQ, fromR), button: 0 });
  fire('game', 'mousemove', screenPointOf(toQ, toR));
  fire('window', 'mouseup', screenPointOf(toQ, toR));
  runFrames(1);
};
dockButton('type', 'siphon').onclick();
runFrames(1);
check('picking the Siphon moves on to placing two', /two places behind the Nucleus/.test(bubbleText()), bubbleText());
clickHex(-1, 1);
check('one Siphon is not yet two', /two places behind the Nucleus/.test(bubbleText()));
clickHex(0, 1);
check('two Siphons move on to the Preview', /The Preview runs your creature/.test(bubbleText()), bubbleText());
pressNext();
byId('layer-nerve').onclick();
runFrames(1);
check('opening the Nerves view moves on to the Pacemaker', /Pick the Pacemaker/.test(bubbleText()), bubbleText());
dockButton('neuron', 'pacemaker').onclick();
runFrames(1);
clickHex(0, 0);
check('a Pacemaker in the Nucleus moves on to the fibres', /drag from the Nucleus to a Siphon/.test(bubbleText()),
  bubbleText());
dragFibre(0, 0, -1, 1);
dragFibre(0, 0, 0, 1);
check('a fibre to each Siphon moves on', /both Siphons fire together/.test(bubbleText()), bubbleText());
pressNext();
check('then it points at Run level', /Run the level/.test(bubbleText()), bubbleText());
byId('run-next-level').onclick();
runFrames(1);
check('running the level moves on to watching, undimmed', /Watch it swim/.test(bubbleText()) &&
  !byId('tutorial').classList.contains('dimmed'), bubbleText());
for (let i = 0; i < 1600 && byId('level-result').style.display !== 'block'; i++) runFrames(1);
runFrames(1);
check('the tutorial\'s creature wins level 1, and the bubble talks about the stars',
  byId('result-title').textContent === 'Level done' && /The stars count/.test(bubbleText()), bubbleText());
pressNext();
const kept = () => JSON.parse(storage.items['bioforge-lab-game-1-tutorial']);
check('the lesson is kept as done, and nothing shows during the rest of the run',
  kept().done.join() === 'first-stroke' && !isBubbleShown(), JSON.stringify(kept()));
byId('result-builder').onclick();
runFrames(2);
check('back in the builder, level 2\'s lesson starts, with level 2 chosen',
  /Level two: reach the light/.test(bubbleText()) && chosenLevelIs('Lighthouse'), bubbleText());

// ---------- Skip, the voice setting and Replay ----------
byId('tutorial-skip').onclick();
runFrames(1);
check('Skip tutorial hides it and keeps it off for this game', !isBubbleShown() && kept().isOn === false);
byId('setting-voice').onclick();
check('the voice can be switched off in the settings', byId('setting-voice').textContent === 'Off' &&
  storage.items['bioforge-lab-tutorial-voice'] === 'false');
byId('setting-replay-tutorial').onclick();
runFrames(1);
check('Replay tutorial starts again at level 1\'s lesson, although level 1 is won',
  /Welcome to the Lab/.test(bubbleText()) && chosenLevelIs('First stroke'), bubbleText());

// ---------- A game that has no tutorial ----------
const old = startApp();
old.runFrames(3);
check('a game from before the tutorial, or opened with Continue, shows none',
  old.byId('tutorial').style.display !== 'block');
done();
