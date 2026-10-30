'use strict';
// The menus (full app, fake DOM): the main menu at the start, Esc in the builder (a sheet, then what is in hand, then
// the menu), the Esc menu pausing a run, Continue picking up a level run after the game is closed and opened again,
// Free build forgetting it, the desktop build's Quit and Fullscreen, and loading a creature file.
const { startApp, LEAVE_TITLE_FRAMES } = require('./dom');
const { check, done } = require('./check');

const FRAMES_PER_SECOND = 63;                             // the fake browser's frames are 16 ms
const GRID_MIDDLE_X = 1600 / 2;                           // where the builder's grid middle is on screen (px)
const GRID_MIDDLE_Y = 900 / 2;                            // px

const isShown = (byId, id) => byId(id).style.display !== 'none';
const pressKeyIn = fire => (key, fields = {}) => {
  fire('window', 'keydown', { key, ...fields });
  fire('window', 'keyup', { key, ...fields });
};
const clockOf = byId => parseFloat(byId('hud-enemies').textContent);
const cellCount = byId => +/Cells: (\d+)/.exec(byId('budget').innerHTML)[1];
const savedState = storage => JSON.parse(storage.items['bioforge-lab-profile-1-continue'] || 'null');

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
  check('the old save was upgraded and carries its version', storage.items['bioforge-lab-save-version'] === '2');
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
  first.fire('game', 'mousedown', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, button: 0, target: byId('game') });
  first.fire('window', 'mouseup', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, target: byId('game') });
  pressKey('2');
  const cardShown = byId('card').style.display !== 'none';
  pressKey('Escape');
  check('with a cell clicked, Esc lets go of it (its card closes) and opens no menu',
    cardShown && byId('card').style.display === 'none' && byId('menu-sheet').style.display === 'none');
  pressKey('1');
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

  // ---------- Saving the creature: the Nucleus' right-click, quick save and load, Delete all ----------
  const starterCells = cellCount(byId);
  first.fire('game', 'contextmenu', { clientX: GRID_MIDDLE_X, clientY: GRID_MIDDLE_Y, preventDefault() {} });
  check('a right-click on the Nucleus offers to save the whole creature', byId('save-menu').style.display === 'block' &&
    byId('save-menu-title').textContent.startsWith(`${starterCells} selected`) &&
    byId('save-menu-save').textContent === 'Save creature');
  pressKey('Escape');
  pressKey('Escape');
  check('Esc closes the save menu, then lets go of the cells', byId('save-menu').style.display === 'none' &&
    byId('menu-sheet').style.display === 'none');
  pressKey('F8');
  check('F8 with nothing quick saved says so', byId('message').textContent.includes('Nothing quick saved'));
  pressKey('s', { ctrlKey: true });
  const quickSaved = JSON.parse(storage.items['bioforge-lab-profile-1-quicksave'] || 'null');
  check('Ctrl+S quick saves the creature', !!quickSaved && quickSaved.cells.length === starterCells);
  byId('clear-design').onclick({});
  check('Delete all asks first, in the game\'s own red box', byId('dialog-sheet').style.display === 'flex' &&
    byId('dialog-box').classList.contains('dangerous') && cellCount(byId) === starterCells);
  pressKey('Escape');
  check('Esc cancels it: the box closes, the cells stay and no menu opens',
    byId('dialog-sheet').style.display === 'none' && byId('menu-sheet').style.display === 'none' &&
    cellCount(byId) === starterCells);
  byId('clear-design').onclick({});
  pressKey('Enter');
  check('Enter confirms: just the Nucleus is left', byId('dialog-sheet').style.display === 'none' &&
    cellCount(byId) === 1);
  pressKey('F8');
  check('F8 brings the quick saved creature back', cellCount(byId) === starterCells);
  byId('clear-design').onclick({});
  byId('dialog-confirm').onclick();
  pressKey('F5');
  pressKey('F8');
  check('F5 quick saves too', cellCount(byId) === 1);
  first.templateButton('starter').onclick();

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
  // renaming it asks in the game's own box, with the old name in a field: Enter there renames, Esc keeps it
  const renameButton = () => third.byId('my-creatures').children[0].children[2];
  const nameField = third.byId('dialog-input');
  renameButton().onclick({ stopPropagation() {} });
  check('renaming asks in the game\'s own box, the old name ready to edit',
    third.byId('dialog-sheet').style.display === 'flex' && nameField.style.display === '' &&
    nameField.value === 'Shared eel');
  nameField.value = 'Long eel';
  third.fire('dialog-input', 'keydown', { key: 'Enter' });
  check('Enter in the name field renames it', third.byId('dialog-sheet').style.display === 'none' &&
    third.readGlobal('JSON.parse(localStorage.getItem("bioforge-lab-profile-1-library"))')[0].name === 'Long eel');
  renameButton().onclick({ stopPropagation() {} });
  nameField.value = 'Short eel';
  third.fire('dialog-input', 'keydown', { key: 'Escape' });
  check('Esc in the name field keeps the name', third.byId('dialog-sheet').style.display === 'none' &&
    third.readGlobal('JSON.parse(localStorage.getItem("bioforge-lab-profile-1-library"))')[0].name === 'Long eel');
  byId('clear-design').onclick({});
  check('the plain question box has no name field', byId('dialog-input').style.display === 'none');
  pressKey('Escape');
  chooseFile('notes.json', '{"shopping":["milk"]}');
  await new Promise(resolve => setImmediate(resolve));
  check('another file is refused, saying why', third.byId('message').innerHTML.includes("isn't a Bioforge Lab"));

  // ---------- Profiles ----------
  const before = startApp(['clear'], { ...third.storage.items }, { atMainMenu: true });
  const profilesIn = app => JSON.parse(app.storage.items['bioforge-lab-profiles']);
  check('the main menu shows the profile playing', isShown(before.byId, 'menu-profile') &&
    before.byId('menu-profile').textContent === 'Profile: Player');
  before.byId('menu-profile').onclick({});
  check('Profile lists the profiles, with no Delete for the only one',
    before.byId('menu-profiles-view').style.display === '' &&
    before.byId('profile-list').children.length === 1 && before.byId('profile-list').children[0].children.length === 2);
  before.byId('profile-new').onclick({});
  before.byId('dialog-input').value = 'Ada';
  before.byId('dialog-confirm').onclick();
  check('New profile asks for a name, keeps it as the current profile and starts the game again',
    profilesIn(before).list.length === 2 && profilesIn(before).current === 2 &&
    before.readGlobal('Object.keys(localStorage.items)').every(key => !key.startsWith('bioforge-lab-profile-2-')));
  const ada = startApp(['clear'], { ...before.storage.items }, { atMainMenu: true });
  check('the new profile starts afresh: nothing to continue, no creatures, the settings kept',
    ada.byId('menu-profile').textContent === 'Profile: Ada' && !isShown(ada.byId, 'menu-continue') &&
    ada.byId('my-creatures').children.length === 0 && ada.byId('setting-music').textContent === 'Off');
  ada.byId('menu-profile').onclick({});
  ada.byId('profile-list').children[0].children[0].onclick();
  const back = startApp(['clear'], { ...ada.storage.items }, { atMainMenu: true });
  check('switching back brings the first profile\'s creatures and run back',
    back.byId('menu-profile').textContent === 'Profile: Player' && isShown(back.byId, 'menu-continue') &&
    back.byId('my-creatures').children.length === 1);
  back.byId('menu-profile').onclick({});
  back.byId('profile-list').children[1].children[2].onclick();
  check('deleting a profile asks first, in red', back.byId('dialog-box').classList.contains('dangerous'));
  back.byId('dialog-confirm').onclick();
  check('deleting another profile keeps playing this one, and its saves are gone', profilesIn(back).list.length === 1 &&
    profilesIn(back).current === 1 && back.byId('profile-list').children.length === 1 &&
    [undefined, 'null'].includes(back.storage.items['bioforge-lab-profile-2-library']));

  done();
}

main();
