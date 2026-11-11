'use strict';
// A run's events and the ghost: what a recorded run notes as it goes (cells lost, fuel out, hits, the goal held and
// let go, the nearest moment to the ring, the end), the marks they make on the timeline, and the run before drawn as
// a ghost in the next one.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'startLevel', 'runLevel', 'runDataIndex', 'createRecording',
  'stepRecorded', 'runAtStep', 'recordedEndStep', 'runMarks', 'createDesignCell', 'createNeuron', 'EVENT_MERGE_STEPS',
  'GHOST_MIN_STEPS']);

const NO_KEYS = { ability: false, heldKeys: new Set() };
const levelById = id => sim.LEVELS.find(level => level.id === id);
const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const FIRST_STROKE = {
  cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') }), cell(-1, 1, 'siphon'),
    cell(0, 1, 'siphon')],
  fibres: [{ from: { q: 0, r: 0 }, to: { q: -1, r: 1 } }, { from: { q: 0, r: 0 }, to: { q: 0, r: 1 } }],
};
// the same with a cell of Tissue in front: another design, which swims another way
const HEAVIER = { cells: [...FIRST_STROKE.cells, cell(0, -1, 'tissue')], fibres: FIRST_STROKE.fibres };
const STILL = { cells: [cell(0, 0, 'nucleus')], fibres: [] };

// a level run recorded to its end, or for a number of steps
function recordedRun(levelId, design, steps = Infinity) {
  const run = sim.startLevel(levelById(levelId), design);
  const recording = sim.createRecording(run, sim.runDataIndex());
  while (!run.outcome && run.steps < steps) sim.stepRecorded(recording, run, NO_KEYS);
  return { run, recording };
}
const marksText = recording => sim.runMarks(recording.log).map(mark => `${mark.step} ${mark.tone} ${mark.text}`);
const kindsOf = recording => recording.log.events.map(event => event.kind);

// ---------- Events ----------
{
  const { run, recording } = recordedRun('first-stroke', FIRST_STROKE);
  const marks = sim.runMarks(recording.log);
  check('a win is marked at its end, with the result\'s time', run.outcome === 'won' && marks.length === 1 &&
    marks[0].kind === 'end' && marks[0].tone === 'good' && marks[0].step === run.steps &&
    marks[0].seconds === run.time && recording.log.outcome === 'won', marksText(recording).join('; '));
  check('the recording keeps the player\'s pose at the start and after every step',
    recording.poses.length === run.steps + 1 && recording.poses[0].length === 2 + 2 * FIRST_STROKE.cells.length &&
    Math.abs(recording.poses[run.steps][0] - run.player.centerX) < 0.01 &&
    Math.abs(recording.poses[run.steps][3] - run.player.cells[0].y) < 0.01);
}

{
  const { run, recording } = recordedRun('first-stroke', STILL);
  const marks = sim.runMarks(recording.log);
  check('a run that never comes nearer to the ring than its start says so, and why it was lost',
    run.outcome === 'lost' && marks.length === 2 && marks[0].kind === 'closest' && marks[0].step === 0 &&
    /^Nearest to the ring: \d+ px away$/.test(marks[0].text) && marks[1].text === 'Out of time.' &&
    marks[1].tone === 'bad', marksText(recording).join('; '));
}

{ // the Jet in Lighthouse swims past the ring
  const { run, recording } = recordedRun('lighthouse', sim.TEMPLATES.jet);
  const closest = sim.runMarks(recording.log).find(mark => mark.kind === 'closest');
  check('a lost run marks the moment the player was nearest to the ring', run.outcome === 'lost' && !!closest &&
    closest.step > 0 && closest.step < run.steps, marksText(recording).join('; '));
  const shown = sim.runAtStep(recording, run, closest.step);
  const ring = shown.level.goal;
  const distance = Math.sqrt((shown.player.centerX - ring.x) ** 2 + (shown.player.centerY - ring.y) ** 2) - ring.radius;
  check('and the run at that moment is that far from it', closest.text.includes(` ${Math.round(distance)} px`),
    `${closest.text}; ${distance}`);
}

{ // Bulwark: a Puffer hunts the Seeker down
  const { run, recording } = recordedRun('bulwark', sim.TEMPLATES.seeker);
  const events = recording.log.events;
  const lost = events.find(event => event.kind === 'lost');
  check('a fight marks the first hit taken, the cells lost with their names and the end',
    kindsOf(recording).includes('hit') && !!lost && /^Lost (a cell|\d+ cells): [A-Z]/.test(lost.text) &&
    events[events.length - 1].text === 'Your Nucleus was destroyed.' && run.outcome === 'lost',
    marksText(recording).join('; '));
  check('the lost cells are counted once each',
    lost.cellNames.length === +(/\d+/.exec(lost.text) || [1])[0] && lost.cellNames.length <= 5, lost.text);
  const isMerged = events.every((event, i) => events.slice(i + 1).every(later =>
    later.kind !== event.kind || later.step - event.lastStep > sim.EVENT_MERGE_STEPS));
  check('events of one kind within 2 s of each other are one mark', isMerged, marksText(recording).join('; '));
  check('marks come oldest first', sim.runMarks(recording.log).every((mark, i, marks) =>
    i === 0 || marks[i - 1].step <= mark.step));

  // the same run with a look back in the middle: the events are the same, none twice and none made up
  const again = recordedRun('bulwark', sim.TEMPLATES.seeker, 450);
  let shown = sim.runAtStep(again.recording, again.run, 120);
  check('a look back is another run object at the same moment', shown !== again.run && shown.steps === 120);
  while (!shown.outcome) sim.stepRecorded(again.recording, shown, NO_KEYS);
  check('a run looked back at and run on notes the same events as one that ran straight through',
    JSON.stringify(marksText(again.recording)) === JSON.stringify(marksText(recording)) &&
    again.recording.poses.length === recording.poses.length, marksText(again.recording).join('; '));
  shown = sim.runAtStep(again.recording, shown, 200);
  for (let i = 0; i < 100; i++) sim.stepRecorded(again.recording, shown, NO_KEYS);
  check('and steps played again add nothing', again.recording.log.events.length === events.length &&
    again.recording.poses.length === recording.poses.length);
}

{ // Long haul: the Seeker reaches the light, runs out of sugar and falls behind
  const { recording } = recordedRun('long-haul', sim.TEMPLATES.seeker);
  const texts = recording.log.events.map(event => event.text);
  const held = texts.indexOf('Near the light');
  const starving = texts.findIndex(text => /^Out of (sugar|O₂): [A-Z]/.test(text));
  const letGo = texts.indexOf('Left the light');
  check('a goal that counts time marks when the count starts and when it stops, and fuel running out between',
    held >= 0 && starving > held && letGo > starving && recording.log.events[held].tone === 'good' &&
    recording.log.events[letGo].tone === 'bad', marksText(recording).join('; '));
  check('a stayNear goal has no ring to come near to', recording.log.closest === null);
}

{ // Grazing has food, Quarry a creature that arrives later
  const grazing = recordedRun('grazing', sim.TEMPLATES.jet).recording;
  check('the first food eaten is marked', kindsOf(grazing).includes('food'));
  const { recording } = recordedRun('quarry', sim.TEMPLATES.jet);
  const arrival = recording.log.events.find(event => event.kind === 'arrival');
  check('a creature arriving later is marked when it comes',
    !!arrival && arrival.seconds > 30 && arrival.seconds < 30.2,
    marksText(recording).join('; '));
}

// ---------- The app: the ghost and the marks ----------
{
  const headless = sim.runLevel(levelById('first-stroke'), FIRST_STROKE);
  const page = startApp();
  const { byId, fire, runFrames, readGlobal, storage, loadTestDesign } = page;
  const app = () => readGlobal('globalThis.testApp');
  // runs the design in level 1 from the Lab
  const runInFirstLevel = (design, name) => {
    if (app().mode !== 'build') byId('result-builder').onclick({});
    loadTestDesign(design, name);
    readGlobal('chooseLevel(globalThis.testApp, LEVELS[0]); startLevelRun(globalThis.testApp)');
  };
  runFrames(3);
  runInFirstLevel(FIRST_STROKE, 'First stroke');
  runFrames(2);
  check('a first run has no ghost', app().ghost === null && byId('level-ghost').style.display === '' &&
    byId('level-ghost').classList.contains('selected'));
  fire('window', 'keydown', { key: 'Enter' });
  runFrames(3);
  check('it runs to its result', app().levelRun.outcome === 'won' && app().levelRun.steps === headless.steps);

  runInFirstLevel(HEAVIER, 'Heavier');
  runFrames(2);
  const ghost = app().ghost;
  check('the next run, with another design, has the run before as its ghost',
    !!ghost && ghost.level.id === 'first-stroke' && ghost.outcome === 'won' && ghost.endSeconds === headless.time &&
    ghost.poses.length === headless.steps + 1 && ghost.firstStep === 0);
  check('the ghost\'s label says how that run ended once it is over',
    readGlobal('ghostLabel(globalThis.testApp.ghost, false)') === 'last run' &&
    readGlobal('ghostLabel(globalThis.testApp.ghost, true)') === `last run: done in ${headless.time.toFixed(1)} s`);
  while (app().levelRun.steps < sim.GHOST_MIN_STEPS + 40) runFrames(1);
  fire('window', 'keydown', { key: 'r' });
  runFrames(2);
  check('a Retry of the same design keeps the ghost it had', app().ghost === ghost && app().levelRun.steps < 10);
  fire('window', 'keydown', { key: 'g' });
  const ghostKey = Object.keys(storage.items).find(key => key.endsWith('ghost-shown'));
  check('G hides the ghost, remembered', app().isGhostShown === false && storage.items[ghostKey] === 'false' &&
    readGlobal('shownGhost(globalThis.testApp)') === null);
  runFrames(1);
  check('and the Ghost button shows it is off', !byId('level-ghost').classList.contains('selected'));
  byId('level-ghost').onclick({});
  check('the button brings it back', app().isGhostShown === true &&
    readGlobal('shownGhost(globalThis.testApp)') === ghost);

  fire('window', 'keydown', { key: 'Enter' });
  runFrames(3);
  const run = app().levelRun;
  const marks = readGlobal('timelineMarks(globalThis.testApp)');
  const buttons = byId('timeline-marks').children;
  const ghostIndex = marks.findIndex(mark => mark.kind === 'ghost');
  check('the heavier design is slower, so the ghost ended within this run', !!run.outcome &&
    run.steps > headless.steps && ghostIndex >= 0, `${run.outcome} at ${run.time} s`);
  check('the timeline has a mark for each event and one where the ghost ended',
    buttons.length === marks.length && marks.some(mark => mark.kind === 'end') &&
    buttons[ghostIndex].className === 'timeline-mark ghost' &&
    buttons[ghostIndex].title === `last run: done in ${headless.time.toFixed(1)} s` &&
    buttons[ghostIndex].style.left === (headless.steps / run.steps * 100).toFixed(2) + '%',
    buttons.map(button => `${button.className} ${button.title} ${button.style.left}`).join('; '));
  const endIndex = marks.findIndex(mark => mark.kind === 'end');
  check('a mark says when and what', buttons[endIndex].title.startsWith(`${run.time.toFixed(1)} s · `) &&
    buttons[endIndex].style.left === '100.00%', buttons[endIndex].title);
  check('at the end the banner shows the end\'s words', byId('hud-goal-event').style.display === '' &&
    byId('hud-goal-event').textContent === buttons[endIndex].title);

  buttons[ghostIndex].onclick({});
  runFrames(1);
  check('a click on a mark shows the moment one step before it, paused',
    app().levelRun.steps === headless.steps - 1 && app().paused === true &&
    byId('level-result').style.display === 'none');
  check('the ghost\'s own mark puts no words in the banner', byId('hud-goal-event').style.display === 'none');
  fire('window', 'keydown', { key: '.' });
  runFrames(1);
  check('and one step from there is the mark\'s moment', app().levelRun.steps === headless.steps);
  fire('window', 'keydown', { key: 'Shift' });
  fire('window', 'keydown', { key: 'ArrowRight' });
  runFrames(1);
  const nextMark = marks.find(mark => mark.step - 1 > headless.steps);
  check('Shift with the right arrow goes to the next mark', app().levelRun.steps === nextMark.step - 1 &&
    byId('hud-goal-event').textContent.endsWith(nextMark.text), `${app().levelRun.steps}`);
  fire('window', 'keydown', { key: 'ArrowLeft' });
  fire('window', 'keydown', { key: 'ArrowLeft' });
  const firstMark = marks[0];
  check('and with the left arrow back, mark by mark, to the first', app().levelRun.steps === firstMark.step - 1 ||
    (firstMark.step === 0 && app().levelRun.steps === 0), `${app().levelRun.steps}`);
  fire('window', 'keyup', { key: 'Shift' });
  fire('window', 'keydown', { key: 'ArrowRight' });
  check('without Shift the arrows move 1 s again',
    app().levelRun.steps === Math.max(0, firstMark.step - 1) + 40, `${app().levelRun.steps}`);

  byId('result-builder').onclick({});
  readGlobal('chooseLevel(globalThis.testApp, LEVELS[1]); startLevelRun(globalThis.testApp)');
  runFrames(2);
  check('a run in another level has no ghost', app().ghost === null && byId('timeline-marks').children.length <= 1);
}

done();
