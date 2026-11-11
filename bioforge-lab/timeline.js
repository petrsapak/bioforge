'use strict';
// The timeline of a level run: a slider over everything the run has been through, to look at any moment of it again
// with its signals; marks on it where something happened, to go straight there; and Result, which runs the level to
// its end at once (browser only). The recording it shows is in replay.js and the events in runevents.js. An adventure
// has none of it: it is played by hand and far too long to keep.

const TIMELINE_LEAD_STEPS = Math.round(PROBE_SECONDS / GAME_STEP);   // steps replayed before a moment, for its traces
const TIMELINE_JUMP_STEPS = Math.round(1 / GAME_STEP);    // steps the arrow keys move along the timeline (1 game s)
const RESULT_FRAME_BUDGET = 12;                           // real ms of stepping per frame while running to the result
const MARK_SHOWN_STEPS = 60;                              // steps (1.5 game s) a mark's words stay up after its moment

// What the timeline keeps for the level run on screen. recording: replay.js's, or null for an adventure;
// isSkipping: the run is being stepped to its end as fast as the frames allow; isResultKnown: its result has been
// shown and kept once, so coming back to the end only shows the box again; marksShown: the marks the bar shows now,
// as one text, so they are only built again when they change.
function createTimeline(recording = null) {
  return { recording, isSkipping: false, isResultKnown: false, marksShown: '' };
}

// the slider and the Result button in the level bar
function setUpTimeline(app) {
  byId('timeline-slider').oninput = event => showMoment(app, +event.target.value);
  onButton('level-skip', () => skipToResult(app));
}

// Starts recording the level run on screen from where it is now: a new run, or one picked up by Continue. The
// recording before it may become the ghost (ghost.js).
function startTimeline(app) {
  const run = app.levelRun;
  keepGhost(app, run);
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

// one frame of running to the result; the steps in between make no sounds and aren't blended
function runTowardResult(app, input) {
  const start = performance.now();
  do {
    stepLevelRun(app, input);
  } while (!app.levelRun.outcome && performance.now() - start < RESULT_FRAME_BUDGET);
  app.soundWatch = null;
  forgetBlend(app);
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

// ---------- Marks ----------
// The marks on the timeline, oldest first: the run's events (runevents.js) and, where the ghost on screen ended
// within what this run has been through, that moment.
function timelineMarks(app) {
  const recording = app.timeline.recording;
  const ghost = shownGhost(app);
  const hasGhostEnd = ghost && ghostEndStep(ghost) <= recordedEndStep(recording) &&
    ghostEndStep(ghost) > recording.firstStep;
  if (!hasGhostEnd) return runMarks(recording.log);
  const ghostMark = createRunEvent(ghostEndStep(ghost), ghost.endSeconds, 'ghost', 'ghost', ghostLabel(ghost, true));
  return runMarks(recording.log, [ghostMark]);
}

// Shows the moment just before a mark's: paused one step short of it, so that one step (.) shows it happen.
function showMark(app, mark) {
  showMoment(app, mark.step - 1);
}

// Shift with an arrow: goes to the nearest mark before the run's moment (direction -1) or after it (1), if any
function jumpToMark(app, direction) {
  const steps = app.levelRun.steps;
  const marks = timelineMarks(app);
  const mark = direction < 0 ? marks.filter(other => other.step - 1 < steps).pop()
    : marks.find(other => other.step - 1 > steps);
  if (mark) showMark(app, mark);
}

// what a mark says: its time (game s) and its words
const markText = mark => (mark.kind === 'ghost' ? mark.text : `${mark.seconds.toFixed(1)} s · ${mark.text}`);

// The marks under the slider, each at its moment's place along it, coloured by its tone, saying what it is on hover;
// a click goes there. They are built again only when a mark is new or reads differently, and moved as the run grows.
function showTimelineMarks(app) {
  const timeline = app.timeline;
  const marks = timelineMarks(app);
  const container = byId('timeline-marks');
  const marksText = marks.map(mark => mark.tone + markText(mark)).join('\n');
  if (marksText !== timeline.marksShown || container.children.length !== marks.length) {
    timeline.marksShown = marksText;
    container.innerHTML = '';
    for (const mark of marks) container.appendChild(createMarkButton(app, mark));
  }
  const firstStep = timeline.recording.firstStep;
  const span = Math.max(1, recordedEndStep(timeline.recording) - firstStep);
  marks.forEach((mark, i) => {
    const left = ((mark.step - firstStep) / span * 100).toFixed(2) + '%';
    if (container.children[i].style.left !== left) container.children[i].style.left = left;
  });
}

// one mark's button
function createMarkButton(app, mark) {
  const button = document.createElement('button');
  button.className = 'timeline-mark ' + mark.tone;
  button.title = markText(mark);
  button.onclick = () => showMark(app, mark);
  return button;
}

// The mark the run's moment is at: the last one whose moment is the next step or at most MARK_SHOWN_STEPS back, so
// its words show while it happens in a run and after a jump to it. null if there is none.
function markAtMoment(app) {
  const steps = app.levelRun.steps;
  const isAtMoment = mark => mark.kind !== 'ghost' && mark.step <= steps + 1 && mark.step > steps - MARK_SHOWN_STEPS;
  return timelineMarks(app).filter(isAtMoment).pop() || null;
}

// the words of the mark at the run's moment, in the goal banner
function showMarkAtMoment(app) {
  const mark = app.timeline.recording ? markAtMoment(app) : null;
  const line = byId('hud-goal-event');
  line.style.display = mark ? '' : 'none';
  if (!mark) return;
  if (line.textContent !== markText(mark)) line.textContent = markText(mark);
  if (line.className !== mark.tone) line.className = mark.tone;
}

// the slider at the run's moment, over as far as the run has come, with its marks, and both times in game seconds
function showTimeline(app) {
  const recording = app.timeline.recording;
  byId('level-timeline').style.display = recording ? '' : 'none';
  byId('level-skip').style.display = recording ? '' : 'none';
  showGhostButton(app);
  showMarkAtMoment(app);
  if (!recording) return;
  const slider = byId('timeline-slider');
  const endStep = recordedEndStep(recording);
  const steps = app.levelRun.steps;
  if (+slider.min !== recording.firstStep) slider.min = recording.firstStep;
  if (+slider.max !== endStep) slider.max = endStep;
  if (+slider.value !== steps) slider.value = steps;
  byId('timeline-time').textContent = `${app.levelRun.time.toFixed(1)} / ${recording.endSeconds.toFixed(1)} s`;
  byId('level-skip').disabled = !!app.levelRun.outcome || app.timeline.isSkipping;
  showTimelineMarks(app);
}
