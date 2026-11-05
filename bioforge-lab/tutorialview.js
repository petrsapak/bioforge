'use strict';
// The tutorial on screen: a spotlight on what to click, a speech bubble with the step's words, its voice line, and
// the Skip and Next buttons (browser only). The lessons are in data/tutorial.js, the rules in tutorial.js.

const TUTORIAL_SPOT_MARGIN = 8;                           // px of room around a spotlit element
const TUTORIAL_BUBBLE_GAP = 14;                           // px between the spotlight and the bubble
const TUTORIAL_BUBBLE_WIDTH = 340;                        // px
const TUTORIAL_EDGE_MARGIN = 12;                          // px kept between the bubble and the window's edge
const TUTORIAL_HEX_ROOM = 0.75;                           // share of a hex step around a spotlit hex's centre
const TUTORIAL_UNDIMMED_TOP = 0.72;                       // share of the window's height: a run's lone bubble's top
const TUTORIAL_VOICE_FOLDER = 'audio/voice/';
const TUTORIAL_VOICE_VOLUME = 0.9;                        // share of full volume

// the tutorial's state in the app: the game's record (data kept per game) and the step on screen
function createTutorialState() {
  return {
    record: null,                                         // createTutorialRecord(), or null: no tutorial in this game
    lesson: null,                                         // the lesson playing
    stepIndex: 0,
    shownStepId: null,                                    // the step the bubble and the voice were made for
    voice: null,                                          // the Audio playing the step's line
    isVoiceOn: true,                                      // the player's setting
    isNextPressed: false,
  };
}

// reads the game's tutorial and the voice setting, and wires the bubble's buttons
function setUpTutorial(app) {
  const tutorial = app.tutorial;
  tutorial.record = readStorage('tutorial', null);
  tutorial.isVoiceOn = readStorage('tutorial-voice', true);
  onButton('tutorial-next', () => {
    tutorial.isNextPressed = true;
  });
  onButton('tutorial-skip', () => skipTutorial(app));
}

// starts the tutorial from its first lesson: a new game, or Replay in the settings (replay: lessons whose level is
// won already play too)
function startTutorial(app, isReplay = false) {
  app.tutorial.record = createTutorialRecord(isReplay);
  app.tutorial.lesson = null;
  writeStorage('tutorial', app.tutorial.record);
}

// stops the tutorial for this game; Replay in the settings starts it again
function skipTutorial(app) {
  const tutorial = app.tutorial;
  if (tutorial.record) tutorial.record.isOn = false;
  tutorial.lesson = null;
  writeStorage('tutorial', tutorial.record);
  hideTutorial(app);
}

// switches the voice lines on or off, remembered per browser
function toggleTutorialVoice(app) {
  app.tutorial.isVoiceOn = !app.tutorial.isVoiceOn;
  writeStorage('tutorial-voice', app.tutorial.isVoiceOn);
  if (!app.tutorial.isVoiceOn) stopTutorialVoice(app);
}

// what the tutorial's conditions read (tutorial.js)
function tutorialFacts(app) {
  return {
    selectedType: app.selectedType,
    selectedNeuron: app.selectedNeuron,
    design: app.edited,
    layer: app.layer,
    mode: app.mode,
    runOutcome: app.levelRun ? app.levelRun.outcome : null,
    levelResults: app.levelResults,
  };
}

// whether something covers the game that the tutorial must wait behind: a menu, a sheet or a dialog
function isTutorialCovered(app) {
  return isMenuOpen(app) || isGuideOpen(app) || isLibraryOpen(app) || isDialogOpen() || isGamesScreenOpen() ||
    byId('levels-sheet').style.display === 'flex' || byId('keys-sheet').style.display === 'flex';
}

// Each frame: starts the next lesson when one is ready, moves on when the step's condition is met, and keeps the
// spotlight and the bubble on their target.
function runTutorial(app) {
  const tutorial = app.tutorial;
  if (!tutorial.record || !tutorial.record.isOn || app.progress.isSandboxSession || isTutorialCovered(app)) {
    hideTutorial(app);
    return;
  }
  if (!tutorial.lesson && !startNextLesson(app)) {
    hideTutorial(app);
    return;
  }
  const facts = tutorialFacts(app);
  advanceTutorialSteps(app, facts);
  if (!tutorial.lesson) {
    hideTutorial(app);
    return;
  }
  showTutorialStep(app, tutorial.lesson.steps[tutorial.stepIndex]);
}

// begins the next ready lesson, in the builder only: its level chosen and the Body view open. Returns whether one
// began.
function startNextLesson(app) {
  const tutorial = app.tutorial;
  if (app.mode !== 'build') return false;
  const lesson = nextTutorialLesson(tutorial.record, app.levelResults);
  writeStorage('tutorial', tutorial.record);              // lessons outgrown on the way are kept as done
  if (!lesson) return false;
  tutorial.lesson = lesson;
  tutorial.stepIndex = 0;
  tutorial.isNextPressed = false;
  if (lesson.level) {
    chooseLevel(app, LEVELS.find(level => level.id === lesson.level));
    showLayer(app, 'body');
  }
  return true;
}

// Moves past every step whose condition is met (a step met before it shows is passed without a word), and past
// steps that skipIf leaves out. At the lesson's end it is kept as done.
function advanceTutorialSteps(app, facts) {
  const tutorial = app.tutorial;
  const lesson = tutorial.lesson;
  for (;;) {
    tutorial.stepIndex = nextShownStep(lesson, tutorial.stepIndex, facts);
    const step = lesson.steps[tutorial.stepIndex];
    if (!step) break;
    const isMet = step.waitFor === 'next' ? tutorial.isNextPressed : isTutorialConditionMet(step.waitFor, facts);
    if (!isMet) return;
    tutorial.isNextPressed = false;
    tutorial.stepIndex++;
  }
  tutorial.record.done.push(lesson.id);
  tutorial.lesson = null;
  writeStorage('tutorial', tutorial.record);
  stopTutorialVoice(app);
}

// shows a step: its words and voice once, then the spotlight and bubble on its target every frame
function showTutorialStep(app, step) {
  const tutorial = app.tutorial;
  const overlay = byId('tutorial');
  if (tutorial.shownStepId !== step.id) {
    tutorial.shownStepId = step.id;
    byId('tutorial-text').textContent = step.text;
    byId('tutorial-next').style.display = step.waitFor === 'next' ? '' : 'none';
    playTutorialVoice(app, step);
  }
  overlay.style.display = 'block';
  const spot = tutorialTargetRect(app, step.target);
  const isDimmed = step.dim !== false;
  overlay.classList.toggle('dimmed', isDimmed && !spot);
  placeTutorialSpot(spot, isDimmed);
  placeTutorialBubble(spot, isDimmed);
}

// hides the overlay and stops the voice
function hideTutorial(app) {
  if (app.tutorial.shownStepId === null) return;
  app.tutorial.shownStepId = null;
  byId('tutorial').style.display = 'none';
  stopTutorialVoice(app);
}

// The screen rectangle a step's target covers ({ left, top, width, height }), or null for none, or a target that
// isn't on screen now (an element hidden, a dock button in the other view).
function tutorialTargetRect(app, target) {
  if (!target) return null;
  if (target.hexes) return app.mode === 'build' ? hexesRect(app, target.hexes) : null;
  const element = target.element ? byId(target.element)
    : target.cell ? app.dockButtons.get(target.cell) : app.neuronButtons.get(target.neuron);
  if (!element || !element.getBoundingClientRect) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

// the screen rectangle around builder hexes, as the grid is panned and zoomed now
function hexesRect(app, hexes) {
  const origin = gridOrigin(app);
  const zoom = app.gridView.zoom;
  const room = HEX_SPACING_X * TUTORIAL_HEX_ROOM * zoom;
  const points = hexes.map(([q, r]) => hexToPixel(q, r)).map(([x, y]) => [origin.x + x * zoom, origin.y + y * zoom]);
  const left = Math.min(...points.map(point => point[0])) - room;
  const top = Math.min(...points.map(point => point[1])) - room;
  const right = Math.max(...points.map(point => point[0])) + room;
  const bottom = Math.max(...points.map(point => point[1])) + room;
  return { left, top, width: right - left, height: bottom - top };
}

// puts the spotlight's ring (and, dimmed, the darkness around it) on the rectangle, or hides it
function placeTutorialSpot(spot, isDimmed) {
  const element = byId('tutorial-spot');
  element.style.display = spot ? 'block' : 'none';
  if (!spot) return;
  element.classList.toggle('dimmed', isDimmed);
  element.style.left = spot.left - TUTORIAL_SPOT_MARGIN + 'px';
  element.style.top = spot.top - TUTORIAL_SPOT_MARGIN + 'px';
  element.style.width = spot.width + 2 * TUTORIAL_SPOT_MARGIN + 'px';
  element.style.height = spot.height + 2 * TUTORIAL_SPOT_MARGIN + 'px';
}

// Puts the bubble above the spotlight, or below it when there is no room above. With no spotlight it goes in the
// middle of the screen's upper half, or, over a run left undimmed, near the bottom, out of the creature's way.
function placeTutorialBubble(spot, isDimmed) {
  const bubble = byId('tutorial-bubble');
  const height = bubble.offsetHeight || 0;
  const width = TUTORIAL_BUBBLE_WIDTH;
  let left = innerWidth / 2 - width / 2;
  let top = isDimmed ? innerHeight * 0.3 - height / 2 : innerHeight * TUTORIAL_UNDIMMED_TOP;
  let arrow = 'none';
  if (spot) {
    left = spot.left + spot.width / 2 - width / 2;
    const above = spot.top - TUTORIAL_SPOT_MARGIN - TUTORIAL_BUBBLE_GAP - height;
    const below = spot.top + spot.height + TUTORIAL_SPOT_MARGIN + TUTORIAL_BUBBLE_GAP;
    const fitsAbove = above >= TUTORIAL_EDGE_MARGIN;
    top = fitsAbove ? above : below;
    arrow = fitsAbove ? 'down' : 'up';
  }
  left = Math.max(TUTORIAL_EDGE_MARGIN, Math.min(left, innerWidth - width - TUTORIAL_EDGE_MARGIN));
  top = Math.max(TUTORIAL_EDGE_MARGIN, Math.min(top, innerHeight - height - TUTORIAL_EDGE_MARGIN));
  bubble.style.left = left + 'px';
  bubble.style.top = top + 'px';
  bubble.dataset.arrow = arrow;
  const arrowX = spot ? spot.left + spot.width / 2 - left : width / 2;
  const arrowRoom = 2 * TUTORIAL_EDGE_MARGIN;
  byId('tutorial-arrow').style.left = Math.max(arrowRoom, Math.min(arrowX, width - arrowRoom)) + 'px';
}

// Plays the step's voice line, if the player has the voice on. A line not made yet (no file) stays silent.
function playTutorialVoice(app, step) {
  stopTutorialVoice(app);
  if (!app.tutorial.isVoiceOn || typeof Audio === 'undefined') return;
  const voice = new Audio(TUTORIAL_VOICE_FOLDER + step.id + '.mp3');
  voice.volume = TUTORIAL_VOICE_VOLUME;
  voice.play().catch(() => {});                           // a missing file, or the browser not allowing sound yet
  app.tutorial.voice = voice;
}

// stops the voice line playing, if any
function stopTutorialVoice(app) {
  if (!app.tutorial.voice) return;
  app.tutorial.voice.pause();
  app.tutorial.voice = null;
}
