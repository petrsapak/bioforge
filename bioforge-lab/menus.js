'use strict';
// The main menu, shown when the game starts over the living title scene, and the Esc menu over the builder or a run,
// with their Settings view, and the games: Continue, New game, and a Sandbox that keeps no game's place (browser
// only). The title scene and the dimming are in titleview.js, the Load game screen in gamesview.js, and saving and
// picking up where the player left off in progress.js.

// the buttons each menu shows, top to bottom; each is #menu-<name> in index.html. The Esc menu's set depends on the
// mode it opened over.
const MENU_BUTTONS = {
  main: ['continue', 'new-game', 'load-game', 'sandbox', 'guide', 'settings', 'quit'],
  build: ['resume', 'save-creature', 'templates', 'guide', 'settings', 'main', 'quit'],
  level: ['resume', 'retry', 'builder', 'guide', 'settings', 'main', 'quit'],
  sandbox: ['resume', 'builder', 'guide', 'settings', 'main', 'quit'],
};
const ALL_MENU_BUTTONS = [...new Set(Object.values(MENU_BUTTONS).flat())];

// what menus.js keeps in the app
function createMenuState() {
  return {
    open: null,                                           // 'main' or 'pause' (the Esc menu); null: no menu
    view: 'buttons',                                      // or 'settings'
    pausedBefore: false,                                  // whether the run was paused before the Esc menu paused it
  };
}

const isMenuOpen = app => app.menu.open !== null;

// the menu buttons and the Settings rows; the game starts at the main menu
function setUpMenus(app) {
  const actions = {
    continue: () => leaveTitle(app, () => continueCurrentGame(app)),
    'new-game': () => leaveTitle(app, () => startNewGame(app)),
    'load-game': () => openGamesScreen(app),
    sandbox: () => leaveTitle(app, () => enterSandboxSession(app)),
    resume: () => closeMenu(app),
    retry: () => {
      closeMenu(app);
      retryLevel(app);
    },
    builder: () => {
      closeMenu(app);
      enterBuilder(app);
    },
    'save-creature': () => {
      closeMenu(app);
      saveBuilderCreature(app);
    },
    templates: () => {
      closeMenu(app);
      openLibrary(app);
    },
    guide: () => openGuide(app),
    settings: () => showMenuView(app, 'settings'),
    main: () => enterTitle(app, () => {
      app.menu.open = 'main';
      showMenuView(app, 'buttons');
    }),
    quit: () => quitGame(app),
  };
  for (const name of ALL_MENU_BUTTONS) onButton('menu-' + name, actions[name]);
  setUpSettings(app);
  setUpGamesScreen();
  byId('menu-version').textContent = 'Version ' + GAME_VERSION;
  const startWith = readSharedStorage('start-with', null);
  writeSharedStorage('start-with', null);
  if (startWith === 'continue') enterCurrentGame(app);
  else if (startWith === 'new-game') beginNewGame(app);
  else openMainMenu(app);
  if (startWith === 'load-game') openGamesScreen(app);     // after deleting the current game there
  if (startWith) fadeInAtStart(app);
}

// the main menu over the title scene, coming up out of black
function openMainMenu(app) {
  app.menu.open = 'main';
  showMenuView(app, 'buttons');
  fadeInAtStart(app);
}

// The Esc menu. It pauses a run, remembering whether it was paused already, and saves it, in case the player quits.
function openPauseMenu(app) {
  app.menu.pausedBefore = app.paused;
  if (app.mode !== 'build') {
    app.paused = true;
    showTimeControls(app);
  }
  hideTooltip(app);
  saveProgress(app);
  playSound(app, 'open');
  app.menu.open = 'pause';
  showMenuView(app, 'buttons');
}

// closes the menu; a run goes on as it was before the menu opened
function closeMenu(app) {
  if (app.mode !== 'build' && app.menu.open) {
    app.paused = app.menu.pausedBefore;
    showTimeControls(app);
  }
  app.menu.open = null;
  byId('menu-sheet').style.display = 'none';
  showTitleLayout(app);
}

// Continue: back into the current game. After a Sandbox the page loads the game again, since the Sandbox changed
// the Lab.
function continueCurrentGame(app) {
  if (app.progress.isSandboxSession) restartIntoGame(app, readGames(), 'continue', false);
  else enterCurrentGame(app);
}

// Into the current game where it was left: the run the menu opened over, or the run left last time, or else the
// Lab. From here on its place is saved.
function enterCurrentGame(app) {
  closeMenu(app);
  app.progress.isSaving = true;
  markGamePlayed();
  if (app.mode === 'build') resumePendingRun(app);
}

// New game: the current game if it has nothing saved yet, or else a new one, starting at level 1. The game left is
// kept, to load again from Load game.
function startNewGame(app) {
  if (isCurrentGameUnplayed() && !app.progress.isSandboxSession) {
    beginNewGame(app);
    return;
  }
  const games = isCurrentGameUnplayed() ? readGames() : addGame(readGames(), Date.now());
  restartIntoGame(app, games, 'new-game', !app.progress.isSandboxSession);
}

// A game with nothing saved begins: level 1 chosen, the tutorial started, and just the Nucleus to build on (the Jet
// the Lab starts with would already solve level 1, with cells it hasn't opened yet)
function beginNewGame(app) {
  enterCurrentGame(app);
  chooseLevel(app, LEVELS[0]);
  loadDesign(app, bareDesign(), 'New game', '');
  startTutorial(app);
  saveProgress(app);
}

// Sandbox: the Lab with free building from just the Nucleus, every cell open and no levels. It saves nothing, so
// the current game's place stays as it was; its creatures and parts are at hand, and new ones are kept in it.
function enterSandboxSession(app) {
  saveProgress(app);
  app.progress.isSaving = false;
  app.progress.isSandboxSession = true;
  app.progress.pendingRun = null;
  closeMenu(app);
  if (app.mode !== 'build') enterBuilder(app);
  chooseLevel(app, null);
  loadDesign(app, bareDesign(), 'Sandbox', '');
  showModeWindows(app);
}

// the desktop build's Quit, after saving where the player is
function quitGame(app) {
  saveProgress(app);
  if (window.desktopWindow) window.desktopWindow.quit();
}

// shows the open menu with its buttons or its Settings
function showMenuView(app, view) {
  app.menu.view = view;
  const isMain = app.menu.open === 'main';
  const shown = MENU_BUTTONS[isMain ? 'main' : app.mode];
  for (const name of ALL_MENU_BUTTONS) {
    byId('menu-' + name).style.display = shown.includes(name) && isMenuButtonUsable(app, name) ? '' : 'none';
  }
  byId('menu-title').textContent = isMain ? 'Bioforge' : app.mode === 'build' ? 'Menu' : 'Paused';
  byId('menu-buttons').style.display = view === 'buttons' ? '' : 'none';
  byId('menu-settings-view').style.display = view === 'settings' ? '' : 'none';
  byId('menu-sheet').style.display = 'flex';
  showTitleLayout(app);
  showSettings(app);
}

// Quit only in the desktop build; Continue only when there is something to go back to
function isMenuButtonUsable(app, name) {
  if (name === 'quit') return !!window.desktopWindow;
  if (name === 'continue') return hasSavedProgress();
  return true;
}

// Esc in a menu: closes the keys sheet or the Load game screen, leaves Settings, or closes the Esc menu. The main
// menu stays. (M and N still switch the music and sounds, so Settings shows them again.)
function handleMenuKey(app, key) {
  showSettings(app);
  if (key !== 'escape') return;
  if (byId('keys-sheet').style.display === 'flex') toggleKeysSheet();
  else if (isGamesScreenOpen()) closeGamesScreen();
  else if (app.menu.view !== 'buttons') showMenuView(app, 'buttons');
  else if (app.menu.open === 'pause' && !isDimmingToAction(app)) closeMenu(app);
}

// ---------- Games ----------
// the saved game list (a save from before games has been upgraded to one at start)
const readGames = () => readSharedStorage('games', null) || createGames();

// whether the current game has nothing saved yet: New game uses it instead of adding another
const isCurrentGameUnplayed = () => isUnplayedGame(readStorage('continue', null), readStorage('level-results', null),
  readStorage('library', null));

// marks the current game as played now, for the Load game screen's order
function markGamePlayed() {
  const games = readGames();
  writeSharedStorage('games', switchGame(games, games.current, Date.now()));
}

// asks first, then forgets the current game's level results: the stars go and the levels lock again from the
// second one; its creatures stay. A chosen level that is locked now is left. In Settings.
function resetLevelProgressAsked(app) {
  askToConfirm({
    title: 'Reset level progress?',
    text: "This game's stars and best results go for good, and the levels lock again from level 2. Creatures stay.",
    confirmLabel: 'Reset',
    isDangerous: true,
  }, () => {
    app.levelResults = {};
    writeStorage('level-results', app.levelResults);
    if (app.level && !isLevelOpen(app.levelResults, LEVELS.indexOf(app.level))) chooseLevel(app, null);
    showLevelButtons(app);                                // Run level goes back to level 1
    refreshPanel(app);                                    // the dock locks again what the last level's win opened
    showMessage('Level progress reset.');
  });
}

// Keeps the game list and loads the page again into its current game, where startWith ('continue' or 'new-game')
// runs at once instead of the main menu ('load-game' opens the Load game screen over it). The game playing now is
// saved first, unless it was just deleted (shouldSave false); nothing is saved after that, so this game's Lab can't
// leak into the next one.
function restartIntoGame(app, games, startWith, shouldSave = true) {
  if (shouldSave) saveProgress(app);
  app.progress.isSaving = false;
  writeSharedStorage('games', games);
  writeSharedStorage('start-with', startWith);
  restartGame();
}

// the page loads again (in the tests' fake browser there is no reload)
function restartGame() {
  if (typeof location !== 'undefined' && location.reload) location.reload();
}

// ---------- Settings ----------
function setUpSettings(app) {
  onButton('setting-music', () => {
    toggleMusic(app);
    showSettings(app);
  });
  onButton('setting-sounds', () => {
    toggleSounds(app);
    showSettings(app);
  });
  onButton('setting-voice', () => {
    toggleTutorialVoice(app);
    showSettings(app);
  });
  onButton('setting-fullscreen', () => toggleFullscreen(app));
  onButton('setting-keys', toggleKeysSheet);
  onButton('setting-replay-tutorial', () => {
    startTutorial(app, true);
    closeMenu(app);
  });
  onButton('setting-reset-levels', () => resetLevelProgressAsked(app));
  onButton('menu-back', () => showMenuView(app, 'buttons'));
  addEventListener('fullscreenchange', () => showSettings(app));
}

// each setting's button says whether it is on
function showSettings(app) {
  const onOff = isOn => (isOn ? 'On' : 'Off');
  byId('setting-music').textContent = onOff(!app.musicOff);
  byId('setting-sounds').textContent = onOff(!app.soundsOff);
  byId('setting-voice').textContent = onOff(app.tutorial.isVoiceOn);
  byId('setting-fullscreen').textContent = onOff(isFullscreen());
  byId('setting-fullscreen-row').style.display = canGoFullscreen() ? '' : 'none';
}

// The desktop build switches its window (and remembers it, like F11); a browser asks for the page to fill the
// screen.
const canGoFullscreen = () => !!window.desktopWindow || !!(document.documentElement || {}).requestFullscreen;

// whether the game is fullscreen (the desktop window, or the browser page)
function isFullscreen() {
  if (window.desktopWindow) return window.desktopWindow.isFullscreen();
  return !!document.fullscreenElement;
}

// switches fullscreen on or off, in the desktop window or the browser
function toggleFullscreen(app) {
  if (window.desktopWindow) {
    window.desktopWindow.toggleFullscreen();
    showSettings(app);
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
}
