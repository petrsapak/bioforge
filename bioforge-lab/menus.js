'use strict';
// The main menu, shown when the game starts over the living title scene, and the Esc menu over the builder or a run,
// with their Settings view (browser only). The title scene and the dimming are in titleview.js; saving and picking up
// where the player left off is in progress.js.

// the buttons each menu shows, top to bottom; each is #menu-<name> in index.html. The Esc menu's set depends on the
// mode it opened over.
const MENU_BUTTONS = {
  main: ['continue', 'levels', 'free-build', 'guide', 'settings', 'profile', 'quit'],
  build: ['resume', 'save-creature', 'guide', 'settings', 'main', 'quit'],
  level: ['resume', 'retry', 'builder', 'guide', 'settings', 'main', 'quit'],
  sandbox: ['resume', 'builder', 'guide', 'settings', 'main', 'quit'],
};
const ALL_MENU_BUTTONS = [...new Set(Object.values(MENU_BUTTONS).flat())];

// what menus.js keeps in the app
function createMenuState() {
  return {
    open: null,                                           // 'main' or 'pause' (the Esc menu); null: no menu
    view: 'buttons',                                      // or 'settings' or 'profiles'
    pausedBefore: false,                                  // whether the run was paused before the Esc menu paused it
  };
}

const isMenuOpen = app => app.menu.open !== null;

// the menu buttons and the Settings rows; the game starts at the main menu
function setUpMenus(app) {
  const actions = {
    continue: () => leaveTitle(app, () => continueGame(app)),
    levels: () => leaveTitle(app, () => leaveForBuilder(app, () => toggleLevelsSheet(app))),
    'free-build': () => leaveTitle(app, () => leaveForBuilder(app, () => chooseLevel(app, null))),
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
    guide: () => openGuide(app),
    settings: () => showMenuView(app, 'settings'),
    profile: () => showMenuView(app, 'profiles'),
    main: () => enterTitle(app, () => {
      app.menu.open = 'main';
      showMenuView(app, 'buttons');
    }),
    quit: () => quitGame(app),
  };
  for (const name of ALL_MENU_BUTTONS) onSandboxButton('menu-' + name, actions[name]);
  setUpSettings(app);
  setUpProfiles(app);
  byId('menu-version').textContent = 'Version ' + GAME_VERSION;
  openMainMenu(app);
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

// Continue: back to the run the menu opened over, or to the run left last time, or else to the builder
function continueGame(app) {
  closeMenu(app);
  if (app.mode === 'build') resumePendingRun(app);
}

// Levels and Free build: ends the run behind the menu and forgets the one left last time, does the rest in the
// builder, and saves what that leaves
function leaveForBuilder(app, then) {
  closeMenu(app);
  if (app.mode !== 'build') enterBuilder(app);
  app.progress.pendingRun = null;
  then();
  saveProgress(app);
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
  byId('menu-continue').textContent = continueLabel(app);
  byId('menu-profile').textContent = `Profile: ${currentProfile(readProfiles()).name}`;
  byId('menu-title').textContent = isMain ? 'Bioforge' : app.mode === 'build' ? 'Menu' : 'Paused';
  byId('menu-buttons').style.display = view === 'buttons' ? '' : 'none';
  byId('menu-settings-view').style.display = view === 'settings' ? '' : 'none';
  byId('menu-profiles-view').style.display = view === 'profiles' ? '' : 'none';
  if (view === 'profiles') showProfiles(app);
  byId('menu-sheet').style.display = 'flex';
  showTitleLayout(app);
  showSettings(app);
}

// Quit only in the desktop build; Continue only when there is something to go back to
function isMenuButtonUsable(app, name) {
  if (name === 'quit') return !!window.desktopWindow;
  if (name === 'continue') return app.mode !== 'build' || !!app.progress.pendingRun || hasSavedProgress();
  return true;
}

// what Continue goes back to, in its label
function continueLabel(app) {
  const runMode = app.mode !== 'build' ? app.mode : app.progress.pendingRun && app.progress.pendingRun.mode;
  if (runMode === 'level' && app.level) return `Continue: ${app.level.name}`;
  if (runMode === 'sandbox') return 'Continue: Sandbox';
  return 'Continue building';
}

// Esc in a menu: closes the keys sheet, leaves Settings, or closes the Esc menu. The main menu stays. (M and N
// still switch the music and sounds, so Settings shows them again.)
function handleMenuKey(app, key) {
  showSettings(app);
  if (key !== 'escape') return;
  if (byId('keys-sheet').style.display === 'flex') toggleKeysSheet();
  else if (app.menu.view !== 'buttons') showMenuView(app, 'buttons');
  else if (app.menu.open === 'pause' && !isDimmingToAction(app)) closeMenu(app);
}

// ---------- Profiles ----------
// the saved profile list (a save from before profiles has been upgraded to one at start)
const readProfiles = () => readSharedStorage('profiles', null) || createProfiles();

// wires the Profiles view's buttons: new, rename, switch and delete
function setUpProfiles(app) {
  onSandboxButton('profile-new', () => askForName(
    { title: 'New profile', text: 'A name for the new player. The game starts again in their profile.',
      confirmLabel: 'Add' }, '', name => {
      if (cleanName(name)) changeProfiles(app, addProfile(readProfiles(), cleanName(name)));
    }));
  onSandboxButton('profile-reset-levels', () => resetLevelProgressAsked(app));
  onSandboxButton('profile-back', () => showMenuView(app, 'buttons'));
}

// a row per profile: its name (the current one marked; a click on another plays it), rename and delete
function showProfiles(app) {
  const profiles = readProfiles();
  const list = byId('profile-list');
  list.innerHTML = '';
  for (const profile of profiles.list) {
    const row = document.createElement('div');
    row.className = 'profile-row';
    const isCurrent = profile.id === profiles.current;
    const name = profileButton('menu-button' + (isCurrent ? ' current' : ''), profile.name,
      isCurrent ? 'Playing now' : 'Play as ' + profile.name,
      () => !isCurrent && changeProfiles(app, switchProfile(readProfiles(), profile.id)));
    row.appendChild(name);
    row.appendChild(profileButton('small', '✎', 'Rename', () => renameProfileAsked(app, profile)));
    if (profiles.list.length > 1) {
      row.appendChild(profileButton('small', '✕', 'Delete', () => deleteProfileAsked(app, profile)));
    }
    list.appendChild(row);
  }
}

// a button for the profiles list
function profileButton(className, text, title, onClick) {
  const button = document.createElement('button');
  button.className = className;
  button.textContent = text;
  button.title = title;
  button.onclick = onClick;
  return button;
}

// asks for a new name for this profile, then renames it
function renameProfileAsked(app, profile) {
  askForName({ title: 'Rename profile', text: `A new name for ${profile.name}.`, confirmLabel: 'Rename' },
    profile.name, name => {
      if (!cleanName(name)) return;
      writeSharedStorage('profiles', renameProfile(readProfiles(), profile.id, cleanName(name)));
      showMenuView(app, 'profiles');
    });
}

// asks first; the profile's creatures, results and saved run go with it
function deleteProfileAsked(app, profile) {
  askToConfirm({
    title: 'Delete this profile?',
    text: `${profile.name}'s creatures, level results and saved run go for good.`,
    confirmLabel: 'Delete',
    isDangerous: true,
  }, () => {
    for (const name of PROFILE_KEYS) writeSharedStorage(profileKey(profile.id, name), null);
    const profiles = readProfiles();
    const remaining = removeProfile(profiles, profile.id);
    if (remaining.current === profiles.current) {
      writeSharedStorage('profiles', remaining);
      showMenuView(app, 'profiles');
      return;
    }
    changeProfiles(app, remaining, false);
  });
}

// asks first, then forgets the current profile's level results: the stars go and the levels lock again from the
// second one; its creatures stay. A chosen level that is locked now is left.
function resetLevelProgressAsked(app) {
  askToConfirm({
    title: 'Reset level progress?',
    text: `${currentProfile(readProfiles()).name}'s stars and best results go for good, and the levels lock ` +
      'again from level 2. Creatures stay.',
    confirmLabel: 'Reset',
    isDangerous: true,
  }, () => {
    app.levelResults = {};
    writeStorage('level-results', app.levelResults);
    if (app.level && !isLevelOpen(app.levelResults, LEVELS.indexOf(app.level))) chooseLevel(app, null);
    showMessage('Level progress reset.');
  });
}

// Keeps the new profile list and starts the game again in its current profile, after saving where this one is
// (unless it was just deleted: shouldSave false).
function changeProfiles(app, profiles, shouldSave = true) {
  if (shouldSave) saveProgress(app);
  writeSharedStorage('profiles', profiles);
  app.progress.isSwitchingProfile = true;
  restartGame();
}

// the page loads again, at the main menu (in the tests' fake browser there is no reload)
function restartGame() {
  if (typeof location !== 'undefined' && location.reload) location.reload();
}

// ---------- Settings ----------
function setUpSettings(app) {
  onSandboxButton('setting-music', () => {
    toggleMusic(app);
    showSettings(app);
  });
  onSandboxButton('setting-sounds', () => {
    toggleSounds(app);
    showSettings(app);
  });
  onSandboxButton('setting-fullscreen', () => toggleFullscreen(app));
  onSandboxButton('setting-keys', toggleKeysSheet);
  onSandboxButton('menu-back', () => showMenuView(app, 'buttons'));
  addEventListener('fullscreenchange', () => showSettings(app));
}

// each setting's button says whether it is on
function showSettings(app) {
  const onOff = isOn => (isOn ? 'On' : 'Off');
  byId('setting-music').textContent = onOff(!app.musicOff);
  byId('setting-sounds').textContent = onOff(!app.soundsOff);
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
