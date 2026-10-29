'use strict';
// The desktop build's save file: every setting and all progress the game keeps, as one JSON file in the user's
// app-data folder (Node only, no Electron, so tests/saves.js can run it).

const fs = require('fs');
const path = require('path');

const SAVE_DELAY = 500;                                   // ms after the last change before the file is written
const SAVE_FORMAT = 1;                                    // the file layout's number, for later migrations

// The saved items by key, read from filePath (empty if it is missing or unreadable), and how to change them. Changes
// are written after SAVE_DELAY, in one go, so a dragged window doesn't write the file on every mouse move.
function createSaveStore(filePath, delay = SAVE_DELAY) {
  const items = readSaveFile(filePath);
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    writeSaveFile(filePath, items);
  };
  return {
    items,
    // keeps value (any JSON value) under key and schedules the write
    set(key, value) {
      items[key] = value;
      if (!timer) timer = setTimeout(flush, delay);
    },
    // writes any change still waiting (on quitting)
    flush() {
      if (timer) flush();
    },
  };
}

// the items of the save file, or none if it is missing or broken (a broken file is kept beside it as .broken)
function readSaveFile(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return {};
  }
  try {
    const saved = JSON.parse(text);
    return saved && typeof saved.items === 'object' ? saved.items : {};
  } catch (error) {
    fs.copyFileSync(filePath, filePath + '.broken');
    return {};
  }
}

// Writes a temporary file and renames it over the save, so a crash mid-write leaves the old save whole.
function writeSaveFile(filePath, items) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = filePath + '.tmp';
  fs.writeFileSync(temporaryPath, JSON.stringify({ format: SAVE_FORMAT, items }, null, 1));
  fs.renameSync(temporaryPath, filePath);
}

module.exports = { createSaveStore, readSaveFile, SAVE_DELAY };
