'use strict';
// Keeps the game where the player left it: the builder's design, the chosen level and a running level or Sandbox,
// saved as they change and picked up by Continue; quick save (F5, Ctrl+S) and quick load (F8); and saving a creature
// to a file or loading one (browser only).
// The save's format is in savegame.js.

const DESIGN_SAVE_INTERVAL = 1;                           // real s between checks whether the design has changed
const RUN_SAVE_INTERVAL = 5;                              // real s between saves of a running level

// what progress.js keeps between frames
function createProgressState() {
  return {
    savedKey: '',                                         // what was saved last, to skip saving it again
    lastSaveTime: 0,                                      // real s (performance.now) of the last check or save
    pendingRun: null,                                     // a run saved last time, until Continue resumes or drops it
    isSwitchingProfile: false,                            // the page is reloading into another profile: no more saves
  };
}

// Brings back the design, the chosen level and a saved run from the last time, and saves once more when the page
// closes. Called while the app starts, before the builder is drawn.
function setUpProgress(app) {
  const state = readResumeState(readStorage('continue', null));
  if (state) {
    app.edited = createEditedDesign(state.design, app.edited.biomassLimit);
    app.lastLoadedName = state.design.name;
    chooseLevel(app, LEVELS.find(level => level.id === state.levelId));
    app.progress.pendingRun = state.run;
  }
  addEventListener('pagehide', () => saveProgress(app));
  addEventListener('beforeunload', () => saveProgress(app));
  byId('creature-file-input').addEventListener('change', event => loadCreatureFromFile(app, event.target));
}

// whether there is anything for Continue to pick up: a design or a run kept from an earlier visit
const hasSavedProgress = () => readStorage('continue', null) !== null;

// Called every frame. In the builder, saves the design and the level when they have changed (checked once a second);
// in a level, saves the run every few seconds (about 6 ms each). A busy Sandbox takes 25 ms or more to save, a
// visible hitch, so it is saved only when the menu opens and when the page closes.
function keepProgress(app, now) {
  const seconds = now / 1000;
  const interval = app.mode === 'build' ? DESIGN_SAVE_INTERVAL : RUN_SAVE_INTERVAL;
  if (seconds - app.progress.lastSaveTime < interval) return;
  app.progress.lastSaveTime = seconds;
  if (app.mode === 'build') saveDesignIfChanged(app);
  else if (app.mode === 'level') saveProgress(app);
}

// saves the builder's design, level and run, but only when one of them has changed
function saveDesignIfChanged(app) {
  const design = builderDesignEntry(app);
  const key = JSON.stringify([design, app.level && app.level.id, !!app.progress.pendingRun]);
  if (key === app.progress.savedKey) return;
  app.progress.savedKey = key;
  writeStorage('continue', createResumeState(design, app.level ? app.level.id : null, app.progress.pendingRun));
}

// Saves everything now: the design, the level, and the running level or Sandbox (or the run kept from last time).
function saveProgress(app) {
  if (app.progress.isSwitchingProfile) return;            // the page reloads into another profile: keep this one's
  app.progress.savedKey = '';                             // the builder saves again on its next check
  writeStorage('continue', createResumeState(builderDesignEntry(app), app.level ? app.level.id : null,
    currentRunToSave(app)));
}

// the builder's whole design as a library entry, under the name it was last loaded or saved as
function builderDesignEntry(app) {
  return templateFromSelection(app.edited, new Set(app.edited.cells.keys()), app.lastLoadedName || '');
}

// the running level (unless it has ended) or Sandbox as plain data; in the builder, the run kept from last time
function currentRunToSave(app) {
  if (app.mode === 'level' && !app.levelRun.outcome) return savedRun('level', app.levelRun, app.levelDesign);
  if (app.mode === 'sandbox') return savedRun('sandbox', { world: app.world, player: app.player }, null);
  return app.mode === 'build' ? app.progress.pendingRun : null;
}

// Starts the run kept from last time again, where it was left. Returns false if there is none or it can't be read.
function resumePendingRun(app) {
  const saved = app.progress.pendingRun;
  app.progress.pendingRun = null;
  if (!saved) return false;
  let run = null;
  try {
    run = restoredRun(saved);
  } catch (error) {
    showMessage("The run you left couldn't be picked up again.");
    return false;
  }
  if (saved.mode === 'level') resumeLevelRun(app, saved.levelDesign, run);
  else resumeSandbox(app, run.world, run.player);
  return true;
}

// ---------- Creature files ----------
// Saves the builder's creature as a file the player can keep or share (the browser's download, or the desktop
// build's save dialog).
function saveCreatureToFile(app) {
  const entry = builderDesignEntry(app);
  entry.name = entry.name || 'My creature';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([creatureFileText(entry)], { type: 'application/json' }));
  link.download = creatureFileName(entry);
  link.click();
  URL.revokeObjectURL(link.href);
  showMessage(`Saved "${entry.name}" as ${link.download}.`);
}

// asks for a creature file (the answer comes to loadCreatureFromFile)
function chooseCreatureFile() {
  byId('creature-file-input').value = '';
  byId('creature-file-input').click();
}

// Reads the chosen file: a creature goes into My creatures (replacing one of the same name) and into the builder.
function loadCreatureFromFile(app, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  file.text().then(text => useCreatureFileText(app, text, file.name));
}

// a creature file's text, put into My creatures and the builder; a file that can't be used says why
function useCreatureFileText(app, text, fileName) {
  const { entry, problem } = readCreatureFile(text);
  if (problem) {
    showMessage(`${fileName}: ${problem}`);
    playSound(app, 'refuse');
    return;
  }
  entry.name = cleanName(entry.name) || fileName.replace(CREATURE_FILE_EXTENSION, '');
  storeTemplate(app.library, entry);
  saveAndShowLibrary(app);
  if (!entry.isCreature) {                                // no Nucleus: a part, to stamp or give to a Bud
    showMessage(`Loaded "${entry.name}" into My templates.`);
    return;
  }
  if (app.mode === 'build') loadDesign(app, entry, entry.name, entry.name);
  showMessage(`Loaded "${entry.name}" into the builder and My creatures.`);
}

// ---------- Quick save (F5 or Ctrl+S) and quick load (F8) ----------
// keeps the builder's design in the one quick slot, apart from My creatures and from what Continue picks up
function quickSave(app) {
  writeStorage('quicksave', builderDesignEntry(app));
  showMessage('Quick saved. F8 loads it back.');
  playSound(app, 'place');
}

// puts the quick saved design back in the builder, leaving a running level or Sandbox
function quickLoad(app) {
  const saved = readStorage('quicksave', null);
  const design = saved && checkedDesign(saved);
  if (!design) {
    showMessage('Nothing quick saved yet: F5 or Ctrl+S saves the creature.');
    return;
  }
  leaveForBuilder(app, () => loadDesign(app, design, 'Quick load', design.name));
  showMessage('Quick loaded.');
}
