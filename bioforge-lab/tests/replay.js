'use strict';
// The recording of a level run and its timeline: any moment of a recorded run comes back exactly, a run on screen
// is the headless run whatever the frame time and speed, the slider shows a past moment, and Result runs to the end.
const { load } = require('./load');
const { startApp } = require('./dom');
const { check, done } = require('./check');
const { X: sim } = load({}, ['LEVELS', 'TEMPLATES', 'startLevel', 'stepLevel', 'runLevel', 'takeSnapshot',
  'runDataIndex', 'createRecording', 'stepRecorded', 'runAtStep', 'recordedEndStep', 'encodeStepInput',
  'decodeStepInput', 'createDesignCell', 'createNeuron', 'LEVEL_STEP', 'KEYFRAME_STEPS', 'MAX_KEYFRAMES']);

const SPACE_PERIOD = 40;                                  // steps: Space is held every other second
const levelById = id => sim.LEVELS.find(level => level.id === id);
// the input of step i: Space held every other second, and the key g with it
const inputAt = i => {
  const isHeld = Math.floor(i / SPACE_PERIOD) % 2 === 1;
  return { ability: isHeld, heldKeys: new Set(isHeld ? ['g'] : []) };
};
// the whole state as text, to compare two runs exactly (JSON keeps every digit of a number)
const stateText = run => JSON.stringify(sim.takeSnapshot(run, sim.runDataIndex()));
// a run of the level stepped headless with the same inputs, with no recording
function plainRun(level, design, steps) {
  const run = sim.startLevel(level, design);
  for (let i = 0; i < steps; i++) sim.stepLevel(run, sim.LEVEL_STEP, inputAt(i));
  return run;
}

// ---------- The recording ----------
{
  const keys = sim.decodeStepInput(sim.encodeStepInput({ ability: true, heldKeys: new Set(['w', '3', 'a']) }));
  check('a step\'s keys come back from their text',
    keys.ability === true && [...keys.heldKeys].sort().join('') === '3aw');
  const none = sim.decodeStepInput(sim.encodeStepInput({ ability: false, heldKeys: new Set() }));
  check('and so does a step with no keys', none.ability === false && none.heldKeys.size === 0);
}

// Bulwark: a hunting Puffer, where a fight turns on small differences, so a moment that isn't exact shows
for (const levelId of ['lighthouse', 'bulwark']) {
  const level = levelById(levelId);
  const design = sim.TEMPLATES.seeker;
  const run = sim.startLevel(level, design);
  const recording = sim.createRecording(run, sim.runDataIndex());
  for (let i = 0; i < 700; i++) sim.stepRecorded(recording, run, inputAt(i));
  const steps = run.steps;                                // 700, or fewer if the run ended before
  check(`${levelId}: the run lasts long enough for the moments below`, steps > 650, steps);
  check(`${levelId}: a recorded run is the plain run`, stateText(run) === stateText(plainRun(level, design, steps)));
  check(`${levelId}: a snapshot is kept every ${sim.KEYFRAME_STEPS} steps`,
    recording.keyframes.map(keyframe => keyframe.step).join(',') === '0,200,400,600');
  let shown = run;
  for (const step of [650, 123, 400, 399, 0, steps]) {
    shown = sim.runAtStep(recording, shown, step);
    check(`${levelId}: step ${step} comes back exactly`, shown.steps === step &&
      stateText(shown) === stateText(plainRun(level, design, step)));
  }
  const lead = sim.runAtStep(recording, run, 450, 240);
  check(`${levelId}: with a lead it is stepped from an earlier snapshot to the same moment`,
    lead !== run && stateText(lead) === stateText(plainRun(level, design, 450)));
  let stepsOnTheWay = 0;
  sim.runAtStep(recording, run, 450, 240, () => stepsOnTheWay++);
  check(`${levelId}: and each step on the way is reported, for the traces`, stepsOnTheWay === 250, stepsOnTheWay);
  check(`${levelId}: a step past the end is the end`, sim.runAtStep(recording, shown, 9999).steps === steps);
  const past = sim.runAtStep(recording, run, 300);
  for (let i = 0; i < 100; i++) sim.stepRecorded(recording, past, { ability: true, heldKeys: new Set(['z']) });
  check(`${levelId}: running on from a past moment plays the recorded keys, not the ones held now`,
    stateText(past) === stateText(plainRun(level, design, 400)) && sim.recordedEndStep(recording) === steps);
}

{ // a long run: the snapshots thin out instead of piling up
  const run = sim.startLevel(levelById('first-stroke'), sim.TEMPLATES.jet);
  const recording = sim.createRecording(run, sim.runDataIndex());
  recording.keyframeSteps = 1;
  for (let i = 0; i < 300; i++) sim.stepRecorded(recording, run, inputAt(i));
  check('past the most snapshots kept, every other one goes and they come half as often',
    recording.keyframes.length <= sim.MAX_KEYFRAMES && recording.keyframeSteps === 4 &&
    recording.keyframes.every(keyframe => keyframe.step % 4 === 0),
    `${recording.keyframes.length} snapshots, ${recording.keyframeSteps} steps apart`);
  const plain = plainRun(levelById('first-stroke'), sim.TEMPLATES.jet, 151);
  check('and a moment between them still comes back exactly',
    stateText(sim.runAtStep(recording, run, 151)) === stateText(plain));
}

{ // a run that has ended takes no more steps
  const level = levelById('first-stroke');
  const run = sim.startLevel(level, sim.TEMPLATES.jet);
  const recording = sim.createRecording(run, sim.runDataIndex());
  while (!run.outcome) sim.stepRecorded(recording, run, inputAt(0));
  const endStep = sim.recordedEndStep(recording);
  sim.stepRecorded(recording, run, inputAt(0));
  check('a run that has ended records nothing more',
    sim.recordedEndStep(recording) === endStep && run.steps === endStep);
  check('and its end comes back with its outcome', sim.runAtStep(recording, run, 0).outcome === null &&
    sim.runAtStep(recording, run, endStep).outcome === run.outcome);
}

// ---------- The app: the same run at any frame time and speed ----------
const cell = (q, r, typeName, extra = {}) => sim.createDesignCell(q, r, typeName, extra);
const FIRST_STROKE = {
  cells: [cell(0, 0, 'nucleus', { neuron: sim.createNeuron('pacemaker') }), cell(-1, 1, 'siphon'),
    cell(0, 1, 'siphon')],
  fibres: [{ from: { q: 0, r: 0 }, to: { q: -1, r: 1 } }, { from: { q: 0, r: 0 }, to: { q: 0, r: 1 } }],
};
const headless = sim.runLevel(levelById('first-stroke'), FIRST_STROKE);
const resultSeconds = text => parseFloat(text);

// plays level 1 in the app; speedPresses: presses of the speed key before the run goes on
function playFirstLevel(speedPresses) {
  const page = startApp();
  page.runFrames(3);
  page.loadTestDesign(FIRST_STROKE, 'First stroke');
  page.byId('run-next-level').onclick();
  for (let i = 0; i < speedPresses; i++) page.fire('window', 'keydown', { key: ',' });
  return page;
}

for (const [speedName, speedPresses] of [['1×', 0], ['2×', 1], ['4×', 2], ['¼×', 4]]) {
  const page = playFirstLevel(speedPresses);
  const speed = { '1×': 1, '2×': 2, '4×': 4, '¼×': 0.25 }[speedName];
  page.runFrames(Math.ceil(headless.time / 0.016 / speed) + 80);
  const run = page.readGlobal('globalThis.testApp.levelRun');
  check(`at ${speedName} the run on screen ends exactly as the headless run does`,
    run.outcome === 'won' && run.time === headless.time && run.steps === headless.steps &&
    run.player.centerX === headless.player.centerX, `${run.time} s against ${headless.time} s`);
}

// ---------- The app: the timeline and Result ----------
{
  const page = playFirstLevel(0);
  const { byId, fire, runFrames, readGlobal, storage } = page;
  const app = () => readGlobal('globalThis.testApp');
  while (app().levelRun.steps < 128) runFrames(1);       // 3.2 game s
  check('the level bar shows the timeline at the run\'s moment',
    byId('level-timeline').style.display === '' && +byId('timeline-slider').value === app().levelRun.steps &&
    +byId('timeline-slider').max === 128 && byId('timeline-time').textContent === '3.2 / 3.2 s',
    byId('timeline-time').textContent);
  const stateAt128 = stateText(app().levelRun);
  byId('timeline-slider').oninput({ target: { value: '60' } });
  runFrames(3);
  check('dragging the slider back shows that moment, paused',
    app().levelRun.steps === 60 && app().paused === true && byId('level-pause').textContent === '▶' &&
    byId('timeline-time').textContent === '1.5 / 3.2 s' && /^1\.5 \//.test(byId('hud-enemies').textContent),
    byId('timeline-time').textContent);
  check('the signal traces hold the seconds before that moment',
    app().probes.lanes.length > 0 && app().probes.lanes[0].samples.length === 60);
  fire('window', 'keydown', { key: 'arrowright' });
  runFrames(1);
  check('the right arrow moves a second on', app().levelRun.steps === 100);
  fire('window', 'keydown', { key: 'arrowleft' });
  fire('window', 'keydown', { key: 'arrowleft' });
  fire('window', 'keydown', { key: 'arrowleft' });
  check('the left arrow moves back, to the start at most', app().levelRun.steps === 0);
  fire('window', 'keydown', { key: 'p' });
  while (app().levelRun.steps < 128) runFrames(1);
  check('running on from the start plays the same run again', app().levelRun.steps === 128 &&
    stateText(app().levelRun) === stateAt128);
  fire('window', 'keydown', { key: 'enter' });
  runFrames(2);
  check('Enter runs the level to its result at once, the same result as the headless run',
    app().levelRun.outcome === 'won' && app().levelRun.time === headless.time &&
    byId('level-result').style.display === 'block' &&
    resultSeconds(byId('result-text').textContent) === +headless.time.toFixed(1), byId('result-text').textContent);
  const keptBefore = storage.items['bioforge-lab-game-1-level-results'];
  byId('timeline-slider').oninput({ target: { value: '200' } });
  check('a look back from the result hides the result box',
    byId('level-result').style.display === 'none' && app().levelRun.outcome === null);
  byId('level-skip').onclick({});
  runFrames(2);
  check('and Result brings it back, the kept result unchanged',
    byId('level-result').style.display === 'block' && app().levelRun.outcome === 'won' &&
    storage.items['bioforge-lab-game-1-level-results'] === keptBefore && app().isFirstWin === true);
  fire('window', 'keydown', { key: 'r' });
  runFrames(2);
  check('Retry starts a new recording', +byId('timeline-slider').max <= 2 && app().levelRun.steps <= 2);
}

done();
