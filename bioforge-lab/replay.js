'use strict';
// The recording of a level run: the keys held in every step, and a snapshot of the whole run every few game seconds.
// Every step is GAME_STEP long, so a run stepped on from a snapshot with the same keys is the same run, and any
// moment it has been through can be shown again (the timeline, timeline.js). Pure: no DOM.

const KEYFRAME_STEPS = 200;                               // steps between two snapshots at first (5 game s)
const MAX_KEYFRAMES = 120;                                // snapshots kept; past that every other one is dropped
const ABILITY_MARK = '!';                                 // in a step's recorded keys: Space was held

// The one place a recording is built. It starts where the run is now (firstStep), so a run picked up by Continue
// records from there on. keys: one text per recorded step (encodeStepInput); keyframes: { step, snapshot }, oldest
// first, keyframeSteps apart; dataIndex: the game's data objects, for the snapshots (savegame.js runDataIndex).
function createRecording(run, dataIndex) {
  return { firstStep: run.steps, keys: [], keyframes: [], keyframeSteps: KEYFRAME_STEPS, dataIndex };
}

// the number of the step after the last recorded one: as far as the run has ever come
const recordedEndStep = recording => recording.firstStep + recording.keys.length;

// a step's input ({ ability, heldKeys }) as a short text: the mark for Space, then the held Command keys in order
function encodeStepInput(input) {
  const keys = input.heldKeys ? [...input.heldKeys].sort().join('') : '';
  return (input.ability ? ABILITY_MARK : '') + keys;
}

// the input a recorded text stands for
function decodeStepInput(text) {
  const isAbilityHeld = text.startsWith(ABILITY_MARK);
  return { ability: isAbilityHeld, heldKeys: new Set(isAbilityHeld ? text.slice(1) : text) };
}

// Moves the run on by one step. A step the recording has been through uses the keys held then, whatever is held
// now; a new step is recorded with the input given, after a snapshot if one is due. A run that has ended stays as it
// is.
function stepRecorded(recording, run, input) {
  if (run.outcome) return;
  const index = run.steps - recording.firstStep;
  if (index === recording.keys.length) {
    if (index % recording.keyframeSteps === 0) addKeyframe(recording, run);
    recording.keys.push(encodeStepInput(input));
  }
  stepLevel(run, LEVEL_STEP, decodeStepInput(recording.keys[index]));
}

// Keeps a snapshot of the run as it is. Past MAX_KEYFRAMES every other snapshot goes and they come half as often, so
// a long run costs no more memory than a short one.
function addKeyframe(recording, run) {
  recording.keyframes.push({ step: run.steps, snapshot: takeSnapshot(run, recording.dataIndex) });
  if (recording.keyframes.length <= MAX_KEYFRAMES) return;
  recording.keyframes = recording.keyframes.filter((keyframe, i) => i % 2 === 0);
  recording.keyframeSteps *= 2;
}

// The run as it was after a number of steps (kept within what was recorded). It is the run given, stepped on, when
// that is the shortest way there; otherwise a new run from the last snapshot at least leadSteps before the moment
// asked for, stepped on from there. afterStep(run), if given, is called after every step on the way (the signal
// traces use the lead to fill up).
function runAtStep(recording, run, step, leadSteps = 0, afterStep = null) {
  const target = Math.max(recording.firstStep, Math.min(recordedEndStep(recording), Math.round(step)));
  if (!recording.keyframes.length) return run;             // nothing recorded yet
  const keyframe = lastKeyframeBefore(recording, target - leadSteps);
  const isAhead = run.steps <= target && run.steps >= keyframe.step;
  const shown = isAhead ? run : restoreSnapshot(keyframe.snapshot, recording.dataIndex);
  while (shown.steps < target) {
    stepRecorded(recording, shown, null);
    if (afterStep) afterStep(shown);
  }
  return shown;
}

// the last snapshot taken at or before a step, or the first one if the step is before them all
function lastKeyframeBefore(recording, step) {
  let found = recording.keyframes[0];
  for (const keyframe of recording.keyframes) {
    if (keyframe.step <= step) found = keyframe;
  }
  return found;
}
