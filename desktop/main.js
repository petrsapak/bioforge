'use strict';
// The desktop build's main process: one game window around bioforge-lab/index.html, the save file, fullscreen, the
// game menu's Quit, and the browser's own keys and menus turned off (Electron only).

const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { createSaveStore } = require('./saves');

const GAME_NAME = 'Bioforge Lab';                         // the window's title and the app-data folder's name
const SAVE_FILE_NAME = 'save.json';
const FULLSCREEN_KEY = 'bioforge-lab-desktop-fullscreen'; // in the save file, beside the game's own keys
const MIN_WINDOW_WIDTH = 1024;                            // px
const MIN_WINDOW_HEIGHT = 640;                            // px
const BACKGROUND_COLOR = '#0b1418';                       // the page's background, shown before it has drawn

// Built: the game is packed beside this file as game/. From the repository (npm start): the live bioforge-lab folder.
const GAME_PAGE = app.isPackaged
  ? path.join(__dirname, 'game', 'index.html')
  : path.join(__dirname, '..', 'bioforge-lab', 'index.html');

// The app-data folder is named after the game in both cases, so a built and a repository run share one save.
app.setName(GAME_NAME);
// A desktop game starts its music without waiting for a click.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let saves = null;

// the game window, maximized (or fullscreen if it was left so), with no menu bar
function createGameWindow() {
  const gameWindow = new BrowserWindow({
    title: GAME_NAME,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    backgroundColor: BACKGROUND_COLOR,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,                        // the sim keeps its pace while the window is behind another
    },
  });
  gameWindow.once('ready-to-show', () => {
    gameWindow.maximize();
    gameWindow.show();
    if (saves.items[FULLSCREEN_KEY] === true) gameWindow.setFullScreen(true);
  });
  lockToGamePage(gameWindow.webContents);
  gameWindow.webContents.on('before-input-event', (event, input) => handleWindowKeys(gameWindow, event, input));
  gameWindow.loadFile(GAME_PAGE);
  return gameWindow;
}

// The window shows only the game: links don't navigate, nothing opens new windows, and the page can't be zoomed.
function lockToGamePage(contents) {
  contents.on('will-navigate', event => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('zoom-changed', () => contents.setZoomLevel(0));
  contents.on('did-finish-load', () => contents.setVisualZoomLevelLimits(1, 1));
}

// F11 and Alt+Enter switch fullscreen (remembered); F12 opens the developer tools, only when run from the repository.
function handleWindowKeys(gameWindow, event, input) {
  if (input.type !== 'keyDown') return;
  const isFullscreenKey = input.key === 'F11' || (input.alt && input.key === 'Enter');
  if (isFullscreenKey) {
    event.preventDefault();
    toggleFullscreen(gameWindow);
    return;
  }
  if (input.key === 'F12' && !app.isPackaged) {
    event.preventDefault();
    gameWindow.webContents.toggleDevTools();
  }
}

// switches the window between fullscreen and maximized, and remembers it for the next start
function toggleFullscreen(gameWindow) {
  const isFullscreen = !gameWindow.isFullScreen();
  gameWindow.setFullScreen(isFullscreen);
  saves.set(FULLSCREEN_KEY, isFullscreen);
}

// The page's window calls (see preload.js): its menu's Quit and Fullscreen. Whether the window is fullscreen is
// answered from the remembered wish, since the window itself may take a moment to change.
function handleWindowMessages() {
  ipcMain.on('window:quit', event => {
    const gameWindow = BrowserWindow.fromWebContents(event.sender);
    if (gameWindow) gameWindow.close();
  });
  ipcMain.on('window:toggle-fullscreen', event => {
    const gameWindow = BrowserWindow.fromWebContents(event.sender);
    if (gameWindow) toggleFullscreen(gameWindow);
  });
  ipcMain.on('window:is-fullscreen', event => {
    event.returnValue = saves.items[FULLSCREEN_KEY] === true;
  });
}

// the page's save calls (see preload.js)
function handleSaveMessages() {
  ipcMain.on('saves:load', event => {
    event.returnValue = saves.items;
  });
  ipcMain.on('saves:set', (event, key, value) => saves.set(key, value));
}

// Only one copy runs: a second start brings the first window forward, so two copies never write one save file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [gameWindow] = BrowserWindow.getAllWindows();
    if (!gameWindow) return;
    if (gameWindow.isMinimized()) gameWindow.restore();
    gameWindow.focus();
  });
  app.whenReady().then(() => {
    // No menu also means none of its keys: no reload, zoom or developer tools shortcuts.
    Menu.setApplicationMenu(null);
    saves = createSaveStore(path.join(app.getPath('userData'), SAVE_FILE_NAME));
    handleSaveMessages();
    handleWindowMessages();
    createGameWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => saves && saves.flush());
}
