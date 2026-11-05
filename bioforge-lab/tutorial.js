'use strict';
// The tutorial's rules: which lesson and step comes next (data/tutorial.js), and whether what the player has done
// meets a step's condition. Pure: it reads a plain record of the game (tutorialFacts in tutorialview.js), no DOM.

// A game's tutorial record, kept per game: isOn while it runs (New game and Replay switch it on, Skip off), the
// lessons done, and isReplay, which plays lessons whose level is won already.
function createTutorialRecord(isReplay = false) {
  return { isOn: true, done: [], isReplay };
}

// Whether a lesson may start now: not done, the lesson before it done, and the level it needs won. levelResults:
// the best result per level id.
function isLessonReady(record, lesson, levelResults) {
  if (record.done.includes(lesson.id)) return false;
  if (lesson.after && !record.done.includes(lesson.after)) return false;
  return !lesson.needsWin || !!levelResults[lesson.needsWin];
}

// whether a ready lesson has nothing left to teach: its level is won already, and this is no replay
function isLessonOutgrown(record, lesson, levelResults) {
  return !!lesson.level && !!levelResults[lesson.level] && !record.isReplay;
}

// The lesson to play next, or null. Lessons outgrown on the way are marked done, so an experienced player's chain
// moves on to the next lesson that still has something to show.
function nextTutorialLesson(record, levelResults) {
  if (!record.isOn) return null;
  for (const lesson of TUTORIAL_LESSONS) {
    if (!isLessonReady(record, lesson, levelResults)) continue;
    if (!isLessonOutgrown(record, lesson, levelResults)) return lesson;
    record.done.push(lesson.id);
  }
  return null;
}

// The index of the first step from stepIndex on that its skipIf doesn't leave out, or the lesson's length when none
// is left.
function nextShownStep(lesson, stepIndex, facts) {
  let index = stepIndex;
  while (index < lesson.steps.length && lesson.steps[index].skipIf &&
    isTutorialConditionMet(lesson.steps[index].skipIf, facts)) {
    index++;
  }
  return index;
}

// where a step is meant to be seen: 'level' (a run) or, by default, 'build' (the Lab)
const tutorialStepMode = step => step.mode || 'build';

// whether the step can show where the player is now; elsewhere (a Lab step during a run or in the Sandbox) the
// tutorial waits for the player to come back
function isStepInPlace(step, facts) {
  return tutorialStepMode(step) === facts.mode;
}

// Where a lesson goes on when the player is back in the Lab while it is at one of the run's steps: past the run's
// steps when the last run was won (the player chose Lab instead of Next), or else back to the lesson's runStep
// (they left before the end, or lost), so the lesson always follows the player. Other steps stay where they are.
// facts.lastRunOutcome: how the last run ended ('won', 'lost', or null when it was left before the end).
function stepAfterLeavingRun(lesson, stepIndex, facts) {
  const step = lesson.steps[stepIndex];
  if (tutorialStepMode(step) !== 'level' || facts.mode !== 'build') return stepIndex;
  if (facts.lastRunOutcome !== 'won' && lesson.runStep) {
    return lesson.steps.findIndex(other => other.id === lesson.runStep);
  }
  let index = stepIndex;
  while (index < lesson.steps.length && tutorialStepMode(lesson.steps[index]) === 'level') index++;
  return index;
}

// The design's cells of a type. design: an edited design ({ cells: Map of hex key to cell }).
function cellsOfType(design, typeName) {
  return [...design.cells.values()].filter(cell => cell.typeName === typeName);
}

// the cells of type toType that a fibre from a cell of type fromType reaches
function cellsReachedFrom(design, fromType, toType) {
  const reached = new Set();
  for (const fibre of design.fibres) {
    const from = design.cells.get(hexKey(fibre.from.q, fibre.from.r));
    const to = design.cells.get(hexKey(fibre.to.q, fibre.to.r));
    if (from && to && from.typeName === fromType && to.typeName === toType) reached.add(to);
  }
  return reached;
}

// Whether every cell of type fromType has a fibre to a cell of type toType on the other side of the Nucleus (the
// body's middle line, x = 0 in grid px), and there are at least two of them: wires that cross.
function areFibresCrossed(design, fromType, toType) {
  const sources = cellsOfType(design, fromType);
  const sideOf = cell => Math.sign(hexToPixel(cell.q, cell.r)[0]);
  return sources.length >= 2 && sources.every(source => design.fibres.some(fibre => {
    if (fibre.from.q !== source.q || fibre.from.r !== source.r) return false;
    const target = design.cells.get(hexKey(fibre.to.q, fibre.to.r));
    return !!target && target.typeName === toType && sideOf(source) * sideOf(target) < 0;
  }));
}

// Whether a step's condition holds. facts: { selectedType, selectedNeuron, design, layer, mode, runOutcome,
// lastRunOutcome, levelResults } (runOutcome: 'won', 'lost' or null).
function isTutorialConditionMet(condition, facts) {
  switch (condition.kind) {
    case 'cellPicked': return facts.selectedType === condition.cell;
    case 'neuronPicked': return facts.selectedNeuron === condition.neuron;
    case 'cellCount': return cellsOfType(facts.design, condition.cell).length >= condition.count;
    case 'view': return facts.mode === 'build' && facts.layer === condition.layer;
    case 'neuronIn': return cellsOfType(facts.design, condition.cell)
      .some(cell => cell.neuron && cell.neuron.kind === condition.neuron);
    case 'fibresTo': return cellsReachedFrom(facts.design, condition.from, condition.to).size >= condition.count;
    case 'fibresAcross': return areFibresCrossed(facts.design, condition.from, condition.to);
    case 'mode': return facts.mode === condition.mode;
    case 'runEnded': return facts.mode === 'level' && !!facts.runOutcome;
    case 'levelWon': return !!facts.levelResults[condition.level];
    default: throw new Error('Unknown tutorial condition: ' + condition.kind);
  }
}
