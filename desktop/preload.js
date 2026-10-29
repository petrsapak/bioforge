'use strict';
// Runs in the game's page before its scripts: gives the page the save file as window.desktopSaves, with
// localStorage's getItem and setItem, so windows.js's readStorage and writeStorage use it unchanged (desktop only).

const { contextBridge, ipcRenderer } = require('electron');

// The whole save, read once now: the game reads its settings while it starts, before an answer could come back.
const items = ipcRenderer.sendSync('saves:load');

contextBridge.exposeInMainWorld('desktopSaves', {
  // the value under key as JSON text, or null, like localStorage
  getItem: key => (key in items ? JSON.stringify(items[key]) : null),
  // keeps a JSON text under key, in the page at once and in the file soon after
  setItem: (key, text) => {
    items[key] = JSON.parse(text);
    ipcRenderer.send('saves:set', key, items[key]);
  },
});
