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
  'nextShownStep', 'isTutorialConditionMet', 'createEditedDesign', 'stepAfterLeavingRun', 'isStepInPlace']).X;

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
const chapterTwoIds = ['first-stroke', 'lighthouse', 'shade', 'hunt', 'freeze', 'false-start', 'metronome', 'dock',
  'tail', 'crevice'];
const afterTour = { ...sim.createTutorialRecord(), done: ['first-stroke', 'lighthouse', 'lab-tour'] };
check('after the Lab tour, Long haul\'s lesson on fluids waits for level 10 to be won',
  sim.nextTutorialLesson({ ...afterTour }, results('first-stroke', 'lighthouse')) === null &&
  sim.nextTutorialLesson({ ...afterTour }, results(...chapterTwoIds)).id === 'long-haul');
const pastLongHaul = { ...afterTour, done: [...afterTour.done] };
check('a player who won Long haul already gets Packed lunch\'s lesson on kits and fat after chapter 3',
  sim.nextTutorialLesson(pastLongHaul, results(...chapterTwoIds, 'long-haul', 'exhaust', 'cold-water',
    'marathon')).id === 'packed-lunch' && pastLongHaul.done.includes('long-haul'), pastLongHaul.done.join());
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

// ---------- Where a step shows, and leaving a run ----------
check('every step shows in the Lab or in a run, and every lesson with a level names its run step, a Lab step',
  steps.every(step => step.mode === undefined || step.mode === 'level') &&
  sim.TUTORIAL_LESSONS.filter(lesson => lesson.level).every(lesson => {
    const runStep = lesson.steps.find(step => step.id === lesson.runStep);
    return runStep && !runStep.mode && runStep.waitFor.kind === 'mode' && runStep.waitFor.mode === 'level';
  }));
const firstLesson = sim.TUTORIAL_LESSONS[0];
const stepIndexOf = id => firstLesson.steps.findIndex(step => step.id === id);
const inLab = outcome => factsFor([], [], { mode: 'build', lastRunOutcome: outcome });
check('a run step shows only in a run, a Lab step only in the Lab',
  sim.isStepInPlace(firstLesson.steps[stepIndexOf('first-stroke-watch')], { mode: 'level' }) &&
  !sim.isStepInPlace(firstLesson.steps[stepIndexOf('first-stroke-watch')], { mode: 'build' }) &&
  !sim.isStepInPlace(firstLesson.steps[0], { mode: 'level' }) &&
  !sim.isStepInPlace(firstLesson.steps[0], { mode: 'sandbox' }));
check('back in the Lab from a won run, the run\'s steps are passed: the lesson ends',
  sim.stepAfterLeavingRun(firstLesson, stepIndexOf('first-stroke-won'), inLab('won')) === firstLesson.steps.length);
check('back in the Lab from a lost or unfinished run, the lesson goes back to its run step',
  sim.stepAfterLeavingRun(firstLesson, stepIndexOf('first-stroke-lost'), inLab('lost')) ===
  stepIndexOf('first-stroke-run') &&
  sim.stepAfterLeavingRun(firstLesson, stepIndexOf('first-stroke-watch'), inLab(null)) ===
  stepIndexOf('first-stroke-run'));
check('a Lab step, or a run step during the run, stays where it is',
  sim.stepAfterLeavingRun(firstLesson, 3, inLab(null)) === 3 && sim.stepAfterLeavingRun(firstLesson,
    stepIndexOf('first-stroke-watch'), { ...inLab(null), mode: 'level' }) === stepIndexOf('first-stroke-watch'));

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
const pressKey = key => {
  fire('window', 'keydown', { key });
  fire('window', 'keyup', { key });
  runFrames(1);
};
// the blockers' rectangles, which catch the mouse everywhere but the hole
const blocker = side => byId('tutorial-block-' + side).style;
check('a Next step with no target locks the whole screen but the bubble',
  blocker('top').width === '1600px' && blocker('top').height === '900px' && blocker('left').width === '0px');
pressKey('h');
check('and the keys: H opens no keys sheet', byId('keys-sheet').style.display !== 'flex');
pressKey('Escape');
check('Esc still opens the menu (the player can always leave), and the tutorial waits behind it',
  byId('menu-sheet').style.display === 'flex' && !isBubbleShown());
pressKey('Escape');
check('closing the menu brings the step back', isBubbleShown() && /Welcome to the Lab/.test(bubbleText()));
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
const pixels = text => parseFloat(text);
// the hexes' row is below the Nucleus (the screen's middle, 450 px); the hole reaches a little above, for the room
// around the hexes
check('a step that waits for the player leaves a hole over its hexes, below the Nucleus in the middle',
  pixels(blocker('left').width) > 0 && pixels(blocker('left').width) < 800 && pixels(blocker('right').left) > 800 &&
  pixels(blocker('top').height) > 400 && pixels(blocker('bottom').top) < 600,
  ['top', 'bottom', 'left', 'right'].map(side => JSON.stringify(blocker(side))).join(' '));
pressKey('2');
check('keys the step doesn\'t name stay locked: 2 doesn\'t open the Nerves view',
  !byId('layer-nerve').classList.contains('selected'));
clickHex(-1, 1);
check('one Siphon is not yet two', /two places behind the Nucleus/.test(bubbleText()));
clickHex(0, 1);
check('two Siphons move on to the Preview', /The Preview runs your creature/.test(bubbleText()), bubbleText());
// the Run level button is blocked during this step; should the player get into a run anyway, the step waits
byId('run-next-level').onclick();
runFrames(1);
check('a Lab step hides while the player is in a run', !isBubbleShown());
byId('back-to-lab').onclick();
runFrames(1);
check('and shows again, on the same step, back in the Lab',
  isBubbleShown() && /The Preview runs your creature/.test(bubbleText()), bubbleText());
// the fake page has no layout: the Nerves button gets a place on screen, so its step locks as in a browser
byId('layer-nerve').getBoundingClientRect = () => ({ left: 640, top: 10, width: 110, height: 34 });
pressNext();
check('the Nerves step leaves a hole over its button only',
  blocker('top').height === '2px' && pixels(blocker('right').left) === 758, JSON.stringify(blocker('top')));
pressKey('h');
check('it locks H', byId('keys-sheet').style.display !== 'flex');
pressKey('2');
check('but the 2 key it names opens the Nerves view, and moves on to the Pacemaker',
  byId('layer-nerve').classList.contains('selected') && /Pick the Pacemaker/.test(bubbleText()), bubbleText());
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
runFrames(20);
byId('back-to-lab').onclick();
runFrames(1);
check('leaving the run before its end goes back to Run the level, not on about the run',
  isBubbleShown() && /Run the level/.test(bubbleText()), bubbleText());
byId('run-next-level').onclick();
runFrames(1);
check('running it again watches again', /Watch it swim/.test(bubbleText()), bubbleText());
for (let i = 0; i < 1600 && byId('level-result').style.display !== 'block'; i++) runFrames(1);
runFrames(1);
check('the tutorial\'s creature wins level 1, and the bubble talks about the stars',
  byId('result-title').textContent === 'Level done' && /The stars count/.test(bubbleText()), bubbleText());
// the user's bug (2026-11-05): Lab clicked instead of Next, and the tutorial went on about the run in the Lab
byId('result-builder').onclick();
runFrames(2);
const kept = () => JSON.parse(storage.items['bioforge-lab-game-1-tutorial']);
check('Lab instead of Next ends the lesson, and level 2\'s lesson starts in the Lab, with level 2 chosen',
  kept().done.join() === 'first-stroke' && /Level two: reach the light/.test(bubbleText()) &&
  chosenLevelIs('Lighthouse'), bubbleText());

// ---------- Skip, the voice setting and Replay ----------
byId('tutorial-skip').onclick();
runFrames(1);
check('Skip tutorial hides it and keeps it off for this game', !isBubbleShown() && kept().isOn === false);
runFrames(1);
check('the level the tutorial was to teach gets its briefing instead',
  byId('briefing-sheet').style.display === 'flex' && byId('briefing-title').textContent === 'Lighthouse');
byId('briefing-build').onclick();
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
