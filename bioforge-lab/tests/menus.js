'use strict';
// The menus (full app, fake DOM): the main menu at the start, Esc in the builder (a sheet, then what is in hand, then
// the menu), the Esc menu pausing a run, Continue picking up a level run after the game is closed and opened again,
// the desktop build's Quit and Fullscreen, loading a creature file, New game, Load game, deleting a game, and the
// Sandbox keeping the game as it was.
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
const savedState = storage => JSON.parse(storage.items['bioforge-lab-game-1-continue'] || 'null');
// the number on the Templates window's My creatures tab
const savedCreatureCount = byId => +/class="count">(\d+)</.exec(byId('library-tab-creatures').innerHTML)[1];
// the card in the Templates window's open tab with the given name
const cardNamed = (byId, name) => byId('library-cards').children.find(card => card.children[1].textContent === name);

async function main() {
  // ---------- The main menu on a first start ----------
  const first = startApp({}, { atMainMenu: true });
  const { byId, runFrames, storage } = first;
  const pressKey = pressKeyIn(first.fire);
  runFrames(2);
  check('the game starts at the main menu', byId('menu-sheet').style.display === 'flex' &&
    byId('menu-title').textContent === 'Bioforge');
  check('the loading screen is gone once the title is drawn', byId('loading-screen').classList.contains('done'));
  check('with nothing saved yet there is no Continue, and no Quit outside the desktop build',
    !isShown(byId, 'menu-continue') && !isShown(byId, 'menu-quit') && isShown(byId, 'menu-new-game') &&
    isShown(byId, 'menu-load-game') && isShown(byId, 'menu-sandbox'));
  check('the old save was upgraded and carries its version', storage.items['bioforge-lab-save-version'] === '3');
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
  byId('menu-continue').onclick({});                      // hidden, but it enters the current game all the same
  check('Continue first dims the screen, with the menu still up', byId('menu-sheet').style.display === 'flex');
  runFrames(LEAVE_TITLE_FRAMES);
  check('Continue closes the menu', byId('menu-sheet').style.display === 'none');

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
  check('the builder\'s menu offers Save creature, not Retry', isShown(byId, 'menu-save-creature') &&
    !isShown(byId, 'menu-retry') && isShown(byId, 'menu-main'));
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
  pressKey('F5');
  const quickSaved = JSON.parse(storage.items['bioforge-lab-game-1-quicksave'] || 'null');
  check('F5 quick saves the creature', !!quickSaved && quickSaved.cells.length === starterCells);
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
  check('F5 quick saves over the last quick save', cellCount(byId) === 1);
  first.templateButton('starter').onclick();

  // ---------- Saving into My creatures: Ctrl+S, the Esc menu and the Templates window ----------
  const library = () => JSON.parse(storage.items['bioforge-lab-game-1-library'] || '[]');
  pressKey('s', { ctrlKey: true });
  check('Ctrl+S asks for a name in the game\'s own box, with no file dialog',
    byId('dialog-sheet').style.display === 'flex' && byId('dialog-input').value === 'Creature 1');
  byId('dialog-input').value = 'Ada';
  byId('dialog-confirm').onclick();
  check('the creature goes into My creatures, which opens', library().length === 1 &&
    library()[0].name === 'Ada' && library()[0].cells.length === starterCells &&
    byId('library-tab-creatures').classList.contains('selected') && byId('library-cards').children.length === 1 &&
    byId('library-tab-creatures').innerHTML.includes('>1<'));
  pressKey('Escape');
  byId('menu-save-creature').onclick({});
  check('the Esc menu\'s Save creature asks too, with the name it was saved as',
    byId('dialog-sheet').style.display === 'flex' && byId('dialog-input').value === 'Ada');
  byId('dialog-confirm').onclick();
  check('saving again under its own name just saves', byId('dialog-sheet').style.display === 'none' &&
    library().length === 1);
  first.templateButton('jet').onclick();
  byId('library-tab-creatures').onclick();
  byId('library-save').onclick();
  byId('dialog-input').value = 'Ada';
  byId('dialog-confirm').onclick();
  check('another creature under a taken name asks before it overwrites, in red',
    byId('dialog-sheet').style.display === 'flex' && byId('dialog-box').classList.contains('dangerous') &&
    library()[0].cells.length === starterCells);
  byId('dialog-confirm').onclick();
  check('confirming overwrites it', library().length === 1 && library()[0].cells.length !== starterCells);
  pressKey('Escape');
  byId('menu-templates').onclick({});
  check('the Esc menu\'s Templates opens the Templates screen', byId('library-sheet').style.display === 'flex' &&
    byId('menu-sheet').style.display !== 'flex');
  cardNamed(byId, 'Ada').onclick();
  check('clicking a creature loads it and closes the screen', byId('library-sheet').style.display === 'none' &&
    cellCount(byId) !== starterCells);
  first.templateButton('starter').onclick();

  // ---------- The Esc menu over a level run ----------
  byId('show-levels').onclick();
  byId('level-run').onclick({});
  runFrames(2 * FRAMES_PER_SECOND);
  check('the first level runs', byId('level-bar').style.display === 'flex' && clockOf(byId) > 1);
  pressKey('Escape');
  check('Esc in a run opens the menu, paused', byId('menu-title').textContent === 'Paused' &&
    byId('level-pause').textContent === '▶' && isShown(byId, 'menu-retry') && !isShown(byId, 'menu-save-creature'));
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
  check('Main menu from a run offers Continue', byId('menu-title').textContent === 'Bioforge' &&
    isShown(byId, 'menu-continue'));
  const leftAt = clockOf(byId);

  // ---------- Closing the game and opening it again ----------
  first.fire('window', 'pagehide', {});
  const second = startApp({ ...storage.items }, { atMainMenu: true });
  second.runFrames(2);
  check('opened again, the design is back in the builder', cellCount(second.byId) === cellCount(byId) &&
    cellCount(byId) > 3, `${cellCount(byId)} cells`);
  check('and Continue is offered', isShown(second.byId, 'menu-continue'));
  second.byId('menu-continue').onclick({});
  second.runFrames(LEAVE_TITLE_FRAMES);
  const resumedClock = clockOf(second.byId);
  check('Continue picks the run up where it was left', second.byId('level-bar').style.display === 'flex' &&
    // the run starts while the lab is still fading in, so a few frames of it have passed (at most 0.5 s)
    resumedClock >= leftAt && resumedClock < leftAt + 0.5, `${leftAt} → ${resumedClock}`);
  second.runFrames(30);
  check('and it runs on', clockOf(second.byId) > resumedClock);

  // ---------- A Sandbox leaves the saved run alone ----------
  const third = startApp({ ...second.storage.items }, { atMainMenu: true });
  check('a third start offers Continue too', isShown(third.byId, 'menu-continue'));
  third.byId('menu-sandbox').onclick({});
  third.runFrames(LEAVE_TITLE_FRAMES);
  check('a Sandbox from the main menu keeps the game\'s run and level', savedState(third.storage).run !== null &&
    savedState(third.storage).levelId !== null && cellCount(third.byId) === 1);

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
  const desktop = startApp({}, { atMainMenu: true, window: { desktopWindow } });
  check('the desktop build\'s main menu has Quit', isShown(desktop.byId, 'menu-quit'));
  desktop.byId('menu-settings').onclick({});
  desktop.byId('setting-fullscreen').onclick({});
  check('Fullscreen switches the desktop window', isWindowFullscreen &&
    desktop.byId('setting-fullscreen').textContent === 'On' && isShown(desktop.byId, 'setting-fullscreen-row'));
  desktop.byId('menu-back').onclick({});
  desktop.byId('menu-quit').onclick({});
  check('Quit closes the game; from the first main menu there is nothing to save',
    quitCount === 1 && !savedState(desktop.storage));

  // ---------- Loading a creature file ----------
  const eelFile = JSON.stringify({ kind: 'bioforge-lab-creature', version: 1, gameVersion: '0.0.0',
    creature: { name: 'Shared eel', ...third.readGlobal('TEMPLATES').eel } });
  const chooseFile = (name, text) => third.fire('creature-file-input', 'change',
    { target: { files: [{ name, text: () => Promise.resolve(text) }] } });
  chooseFile('eel.bioforge.json', eelFile);
  await new Promise(resolve => setImmediate(resolve));
  check('a creature file goes into My creatures and the builder',
    !!cardNamed(third.byId, 'Shared eel') && third.byId('message').innerHTML.includes('Shared eel'));
  // renaming it asks in the game's own box, with the old name in a field: Enter there renames, Esc keeps it
  const renameButton = () => cardNamed(third.byId, 'Long eel') || cardNamed(third.byId, 'Shared eel');
  const nameField = third.byId('dialog-input');
  renameButton().children[4].children[0].onclick({ stopPropagation() {} });
  check('renaming asks in the game\'s own box, the old name ready to edit',
    third.byId('dialog-sheet').style.display === 'flex' && nameField.style.display === '' &&
    nameField.value === 'Shared eel');
  nameField.value = 'Long eel';
  third.fire('dialog-input', 'keydown', { key: 'Enter' });
  check('Enter in the name field renames it', third.byId('dialog-sheet').style.display === 'none' &&
    !!cardNamed(third.byId, 'Long eel'));
  renameButton().children[4].children[0].onclick({ stopPropagation() {} });
  nameField.value = 'Short eel';
  third.fire('dialog-input', 'keydown', { key: 'Escape' });
  check('Esc in the name field keeps the name', third.byId('dialog-sheet').style.display === 'none' &&
    !!cardNamed(third.byId, 'Long eel'));
  byId('clear-design').onclick({});
  check('the plain question box has no name field', byId('dialog-input').style.display === 'none');
  pressKey('Escape');
  chooseFile('notes.json', '{"shopping":["milk"]}');
  await new Promise(resolve => setImmediate(resolve));
  check('another file is refused, saying why', third.byId('message').innerHTML.includes("isn't a Bioforge Lab"));

  // ---------- Games: New game, Load game, deleting one ----------
  const gamesIn = app => JSON.parse(app.storage.items['bioforge-lab-games']);
  const startWithIn = app => JSON.parse(app.storage.items['bioforge-lab-start-with'] || 'null');
  const before = startApp({ ...third.storage.items }, { atMainMenu: true });
  check('the main menu offers Continue, New game, Load game and Sandbox',
    ['menu-continue', 'menu-new-game', 'menu-load-game', 'menu-sandbox'].every(id => isShown(before.byId, id)));
  before.byId('menu-load-game').onclick({});
  check('Load game shows a card per saved game, the current one marked',
    before.byId('games-sheet').style.display === 'flex' && before.byId('games-cards').children.length === 1 &&
    before.byId('games-cards').children[0].children[1].textContent === 'Game 1 · last played');
  pressKeyIn(before.fire)('Escape');
  check('Esc closes Load game, back to the main menu', before.byId('games-sheet').style.display === 'none' &&
    before.byId('menu-sheet').style.display === 'flex');
  before.byId('menu-new-game').onclick({});
  before.runFrames(LEAVE_TITLE_FRAMES);
  check('New game adds a game and loads the page again into it, to start there',
    gamesIn(before).list.length === 2 && gamesIn(before).current === 2 && startWithIn(before) === 'new-game' &&
    before.readGlobal('Object.keys(localStorage.items)').every(key => !key.startsWith('bioforge-lab-game-2-')));
  const fresh = startApp({ ...before.storage.items }, { atMainMenu: true });
  fresh.runFrames(2);
  const firstLevelId = fresh.readGlobal('LEVELS[0].id');
  check('the new game starts at once at level 1, its card open, with no creatures and the settings kept',
    fresh.byId('menu-sheet').style.display === 'none' && fresh.byId('levels-sheet').style.display === 'flex' &&
    fresh.byId('show-levels').classList.contains('selected') && savedCreatureCount(fresh.byId) === 0 &&
    fresh.storage.items['bioforge-lab-music-off'] === 'true' && startWithIn(fresh) === null &&
    JSON.parse(fresh.storage.items['bioforge-lab-game-2-continue']).levelId === firstLevelId);
  const pressInFresh = pressKeyIn(fresh.fire);
  pressInFresh('Escape');
  pressInFresh('Escape');
  fresh.byId('menu-main').onclick({});
  fresh.runFrames(LEAVE_TITLE_FRAMES);
  fresh.byId('menu-load-game').onclick({});
  const gameCards = fresh.byId('games-cards').children;
  check('Load game lists the game played last first', gameCards.length === 2 &&
    gameCards[0].children[1].textContent === 'Game 2 · last played' &&
    gameCards[0].children[2].textContent === 'Chapter 1 · no levels won yet' &&
    gameCards[1].children[1].textContent === 'Game 1');
  gameCards[1].onclick();
  fresh.runFrames(LEAVE_TITLE_FRAMES);
  check('picking another game loads the page again into it', gamesIn(fresh).current === 1 &&
    startWithIn(fresh) === 'continue');
  const back = startApp({ ...fresh.storage.items }, { atMainMenu: true });
  back.runFrames(2);
  check('the game loaded is where it was left: in its level run, with its creatures',
    back.byId('menu-sheet').style.display === 'none' && back.byId('level-bar').style.display === 'flex' &&
    savedCreatureCount(back.byId) > 0);
  const pressInBack = pressKeyIn(back.fire);
  pressInBack('Escape');
  back.byId('menu-main').onclick({});
  back.runFrames(LEAVE_TITLE_FRAMES);
  back.byId('menu-load-game').onclick({});
  const otherCard = back.byId('games-cards').children[1];
  otherCard.children[otherCard.children.length - 1].children[0].onclick({ stopPropagation() {} });
  check('deleting a game asks first, in red', back.byId('dialog-box').classList.contains('dangerous'));
  back.byId('dialog-confirm').onclick();
  check('deleting another game keeps this one, and the other\'s saves are gone', gamesIn(back).list.length === 1 &&
    gamesIn(back).current === 1 && back.byId('games-cards').children.length === 1 &&
    [undefined, 'null'].includes(back.storage.items['bioforge-lab-game-2-continue']));
  pressInBack('Escape');

  // ---------- Sandbox: just the Nucleus, every cell, no levels, and the game kept as it was ----------
  const keptPlace = back.storage.items['bioforge-lab-game-1-continue'];
  back.byId('menu-sandbox').onclick({});
  back.runFrames(LEAVE_TITLE_FRAMES);
  check('Sandbox opens the Lab with just the Nucleus and no Levels button', cellCount(back.byId) === 1 &&
    back.byId('menu-sheet').style.display === 'none' && back.byId('show-levels').style.display === 'none');
  back.templateButton('starter').onclick();
  back.runFrames(2 * FRAMES_PER_SECOND);
  back.fire('window', 'pagehide', {});
  check('the Sandbox saves nothing: the game\'s place is as it was',
    back.storage.items['bioforge-lab-game-1-continue'] === keptPlace);
  pressInBack('Escape');
  back.byId('menu-main').onclick({});
  back.runFrames(LEAVE_TITLE_FRAMES);
  back.byId('menu-continue').onclick({});
  back.runFrames(LEAVE_TITLE_FRAMES);
  check('Continue after a Sandbox loads the page again into the game', startWithIn(back) === 'continue' &&
    back.storage.items['bioforge-lab-game-1-continue'] === keptPlace);

  done();
}

main();
