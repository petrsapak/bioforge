'use strict';
// The timeline of a level run: a slider over everything the run has been through, to look at any moment of it again
// with its signals, and Result, which runs the level to its end at once (browser only). The recording it shows is in
// replay.js. An adventure has neither: it is played by hand and far too long to keep.

const TIMELINE_LEAD_STEPS = Math.round(PROBE_SECONDS / GAME_STEP);   // steps replayed before a moment, for its traces
const TIMELINE_JUMP_STEPS = Math.round(1 / GAME_STEP);    // steps the arrow keys move along the timeline (1 game s)
const RESULT_FRAME_BUDGET = 12;                           // real ms of stepping per frame while running to the result

// What the timeline keeps for the level run on screen. recording: replay.js's, or null for an adventure;
// isSkipping: the run is being stepped to its end as fast as the frames allow; isResultKnown: its result has been
// shown and kept once, so coming back to the end only shows the box again.
function createTimeline(recording = null) {
  return { recording, isSkipping: false, isResultKnown: false };
}

// the slider and the Result button in the level bar
function setUpTimeline(app) {
  byId('timeline-slider').oninput = event => showMoment(app, +event.target.value);
  onButton('level-skip', () => skipToResult(app));
}

// starts recording the level run on screen from where it is now: a new run, or one picked up by Continue
function startTimeline(app) {
  const run = app.levelRun;
  app.timeline = createTimeline(run.adventure ? null : createRecording(run, runDataIndex()));
}

// One step of the level run on screen, recorded; a step the run has been through before is played as it went then.
function stepLevelRun(app, input) {
  const run = app.levelRun;
  if (app.timeline.recording) stepRecorded(app.timeline.recording, run, input);
  else stepLevel(run, LEVEL_STEP, input);
  recordProbes(app.probes, run.world);
}

// Result: runs the level on to its end without waiting for it, a frame's worth of steps at a time
function skipToResult(app) {
  if (!app.timeline.recording || app.levelRun.outcome) return;
  app.timeline.isSkipping = true;
  app.paused = false;
  app.stepRequested = false;
  showTimeControls(app);
}

// one frame of running to the result; the steps in between make no sounds
function runTowardResult(app, input) {
  const start = performance.now();
  do {
    stepLevelRun(app, input);
  } while (!app.levelRun.outcome && performance.now() - start < RESULT_FRAME_BUDGET);
  app.soundWatch = null;
  if (app.levelRun.outcome) app.timeline.isSkipping = false;
}

// Shows the run as it was after a number of steps, paused there, with the signal traces of the seconds before it.
// Running on from a moment in the past plays the run again as it went.
function showMoment(app, step) {
  const recording = app.timeline.recording;
  if (!recording) return;
  let traced = app.levelRun;
  const trace = shown => {
    if (shown !== traced) resetProbes(app.probes, shown.player);
    traced = shown;
    recordProbes(app.probes, shown.world);
  };
  const run = runAtStep(recording, app.levelRun, step, TIMELINE_LEAD_STEPS, trace);
  if (run !== traced) resetProbes(app.probes, run.player);
  app.levelRun = run;
  app.timeline.isSkipping = false;
  app.paused = true;
  app.stepRequested = false;
  byId('level-result').style.display = run.outcome ? 'block' : 'none';
  showTimeControls(app);
}

// moves along the timeline by a number of steps, back or forward
function jumpAlongTimeline(app, steps) {
  showMoment(app, app.levelRun.steps + steps);
}

// the slider at the run's moment, over as far as the run has come, and both times in game seconds
function showTimeline(app) {
  const recording = app.timeline.recording;
  byId('level-timeline').style.display = recording ? '' : 'none';
  byId('level-skip').style.display = recording ? '' : 'none';
  if (!recording) return;
  const slider = byId('timeline-slider');
  const endStep = recordedEndStep(recording);
  const steps = app.levelRun.steps;
  if (+slider.min !== recording.firstStep) slider.min = recording.firstStep;
  if (+slider.max !== endStep) slider.max = endStep;
  if (+slider.value !== steps) slider.value = steps;
  byId('timeline-time').textContent = `${(steps * GAME_STEP).toFixed(1)} / ${(endStep * GAME_STEP).toFixed(1)} s`;
  byId('level-skip').disabled = !!app.levelRun.outcome || app.timeline.isSkipping;
}
