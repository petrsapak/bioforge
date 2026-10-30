'use strict';
// The menus (full app, fake DOM): the main menu at the start, Esc in the builder (a sheet, then what is in hand, then
// the menu), the Esc menu pausing a run, Continue picking up a level run after the game is closed and opened again,
// Free build forgetting it, the desktop build's Quit and Fullscreen, and loading a creature file.
const { startApp, LEAVE_TITLE_FRAMES } = require('./dom');
const { check, done } = require('./check');

const FRAMES_PER_SECOND = 63;                             // the fake browser's frames are 16 ms
const GRID_MIDDLE_X = 1600 / 2;                           // where the builder's grid middle is on screen (px)
const GRID_MIDDLE_Y = 900 / 2;

const isShown = (byId, id) => byId(id).style.display !== 'none';
const pressKeyIn = fire => (key, fields = {}) => {
  fire('window', 'keydown', { key, ...fields });
  fire('window', 'keyup', { key, ...fields });
};
const clockOf = byId => parseFloat(byId('hud-enemies').textContent);
const cellCount = byId => +/Cells: (\d+)/.exec(byId('budget').innerHTML)[1];
const savedState = storage => JSON.parse(storage.items['bioforge-lab-continue'] || 'null');

async function main() {
  // ---------- The main menu on a first start ----------
  const first = startApp(['clear', 'starter'], {}, { atMainMenu: true });
  const { byId, runFrames, storage } = first;
  const pressKey = pressKeyIn(first.fire);
  runFrames(2);
  check('the game starts at the main menu', byId('menu-sheet').style.display === 'flex' &&
    byId('menu-title').textContent === 'Bioforge');
  check('with nothing saved yet there is no Continue, and no Quit outside the desktop build',
    !isShown(byId, 'menu-continue') && !isShown(byId, 'menu-quit') && isShown(byId, 'menu-levels') &&
    isShown(byId, 'menu-free-build'));
  check('the old save was upgraded and carries its version', storage.items['bioforge-lab-save-version'] === '1');
  pressKey('2');
  runFrames(1);
  check('the builder\'s keys wait while a menu is open', !byId('layer-nerve').classList.contains('selected'));
  byId('menu-settings').onclick({});
  check('Settings shows music and sounds on', byId('setting-music').textContent === 'On' &&
    byId('setting-sounds').textContent === 'On' && !isShown(byId, 'menu-buttons'));
  byId('setting-music').onclick({});
  check('switching the music off in Settings shows it off and remembers it',
    byId('setting-music').textContent === 'Off' && storage.items['bioforge-lab-music-off'] === 'true');
  pressKey('Escape');
  check('Esc leaves Settings for the buttons, and the main menu stays',
    isShown(byId, 'menu-buttons') && byId('menu-sheet').style.display === 'flex');
  byId('menu-free-build').onclick({});
  check('Free build first dims the screen, with the menu still up', byId('menu-sheet').style.display === 'flex');
  runFrames(LEAVE_TITLE_FRAMES);
  check('Free build closes the menu', byId('menu-sheet').style.display === 'none');

  // ---------- Esc in the builder: a sheet, then what is in hand, then the menu ----------
  pressKey('h');
  pressKey('Escape');
  check('Esc first closes an open sheet', byId('keys-sheet').style.display === 'none' &&
    byId('menu-sheet').style.display === 'none');
  first.fire('game', 'mousedown', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, button: 0, ctrlKey: true,
    target: byId('game') });
  first.fire('window', 'mouseup', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, target: byId('game') });
  pressKey('Escape');
  check('with cells selected, Esc lets go of them and opens no menu', byId('menu-sheet').style.display === 'none');
  first.fire('game', 'contextmenu', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, preventDefault() {} });
  check('the selection is gone (a right-click opens no save menu)', byId('save-menu').style.display !== 'block');
  pressKey('Escape');
  check('holding nothing, Esc opens the menu', byId('menu-sheet').style.display === 'flex' &&
    byId('menu-title').textContent === 'Menu');
  check('the builder\'s menu offers creature files, not Retry', isShown(byId, 'menu-save-file') &&
    isShown(byId, 'menu-load-file') && !isShown(byId, 'menu-retry') && isShown(byId, 'menu-main'));
  pressKey('Escape');
  check('Esc closes it again', byId('menu-sheet').style.display === 'none');

  // ---------- The design is saved as it changes ----------
  first.templateButton('starter').onclick();
  runFrames(2 * FRAMES_PER_SECOND);
  check('the builder\'s design is saved within a second or two',
    savedState(storage) && savedState(storage).design.cells.length > 3 && savedState(storage).run === null);

  // ---------- The Esc menu over a level run ----------
  byId('show-levels').onclick();
  byId('level-run').onclick({});
  runFrames(2 * FRAMES_PER_SECOND);
  check('the first level runs', byId('level-bar').style.display === 'flex' && clockOf(byId) > 1);
  pressKey('Escape');
  check('Esc in a run opens the menu, paused', byId('menu-title').textContent === 'Paused' &&
    byId('level-pause').textContent === '▶' && isShown(byId, 'menu-retry') && !isShown(byId, 'menu-save-file'));
  const pausedClock = clockOf(byId);
  runFrames(30);
  check('the run stands still behind the menu', clockOf(byId) === pausedClock);
  check('opening the menu saved the run', savedState(storage).run && savedState(storage).run.mode === 'level');
  byId('menu-resume').onclick({});
  runFrames(30);
  check('Resume goes on with the run', byId('level-pause').textContent === '⏸' && clockOf(byId) > pausedClock);
  pressKey('Escape');
  byId('menu-main').onclick({});
  runFrames(LEAVE_TITLE_FRAMES);
  check('Main menu from a run: Continue goes back to that level', byId('menu-title').textContent === 'Bioforge' &&
    isShown(byId, 'menu-continue') && byId('menu-continue').textContent === 'Continue: First stroke');
  const leftAt = clockOf(byId);

  // ---------- Closing the game and opening it again ----------
  first.fire('window', 'pagehide', {});
  const second = startApp(['clear', 'starter'], { ...storage.items }, { atMainMenu: true });
  second.runFrames(2);
  check('opened again, the design is back in the builder', cellCount(second.byId) === cellCount(byId) &&
    cellCount(byId) > 3, `${cellCount(byId)} cells`);
  check('and Continue offers the level run', isShown(second.byId, 'menu-continue') &&
    second.byId('menu-continue').textContent === 'Continue: First stroke');
  second.byId('menu-continue').onclick({});
  second.runFrames(LEAVE_TITLE_FRAMES);
  const resumedClock = clockOf(second.byId);
  check('Continue picks the run up where it was left', second.byId('level-bar').style.display === 'flex' &&
    // the run starts while the lab is still fading in, so a few frames of it have passed (at most 0.5 s)
    resumedClock >= leftAt && resumedClock < leftAt + 0.5, `${leftAt} → ${resumedClock}`);
  second.runFrames(30);
  check('and it runs on', clockOf(second.byId) > resumedClock);

  // ---------- Free build forgets the run ----------
  const third = startApp(['clear', 'starter'], { ...second.storage.items }, { atMainMenu: true });
  check('a third start offers the run too', third.byId('menu-continue').textContent === 'Continue: First stroke');
  third.byId('menu-free-build').onclick({});
  third.runFrames(LEAVE_TITLE_FRAMES);
  check('Free build drops the run and the level, and keeps the design', savedState(third.storage).run === null &&
    savedState(third.storage).levelId === null && third.byId('budget').innerHTML.includes('Cells'));

  // ---------- The desktop build: Quit and Fullscreen ----------
  let quitCount = 0;
  let isWindowFullscreen = false;
  const desktopWindow = {
    quit: () => quitCount++,
    isFullscreen: () => isWindowFullscreen,
    toggleFullscreen: () => {
      isWindowFullscreen = !isWindowFullscreen;
    },
  };
  const desktop = startApp(['clear'], {}, { atMainMenu: true, window: { desktopWindow } });
  check('the desktop build\'s main menu has Quit', isShown(desktop.byId, 'menu-quit'));
  desktop.byId('menu-settings').onclick({});
  desktop.byId('setting-fullscreen').onclick({});
  check('Fullscreen switches the desktop window', isWindowFullscreen &&
    desktop.byId('setting-fullscreen').textContent === 'On' && isShown(desktop.byId, 'setting-fullscreen-row'));
  desktop.byId('menu-back').onclick({});
  desktop.byId('menu-quit').onclick({});
  check('Quit saves, then closes the game', quitCount === 1 && !!savedState(desktop.storage));

  // ---------- Loading a creature file ----------
  const eelFile = JSON.stringify({ kind: 'bioforge-lab-creature', version: 1, gameVersion: '0.0.0',
    creature: { name: 'Shared eel', ...third.readGlobal('TEMPLATES').eel } });
  const chooseFile = (name, text) => third.fire('creature-file-input', 'change',
    { target: { files: [{ name, text: () => Promise.resolve(text) }] } });
  chooseFile('eel.bioforge.json', eelFile);
  await new Promise(resolve => setImmediate(resolve));
  check('a creature file goes into My creatures and the builder',
    third.byId('my-creatures').children.length === 1 && third.byId('message').innerHTML.includes('Shared eel'));
  chooseFile('notes.json', '{"shopping":["milk"]}');
  await new Promise(resolve => setImmediate(resolve));
  check('another file is refused, saying why', third.byId('message').innerHTML.includes("isn't a Bioforge Lab"));

  done();
}

main();
