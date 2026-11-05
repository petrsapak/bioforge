'use strict';
// The desktop build's save file: every setting and all progress the game keeps, as one JSON file in the user's
// app-data folder (Node only, no Electron, so tests/saves.js can run it).

const fs = require('fs');
const path = require('path');

const SAVE_DELAY = 500;                                   // ms after the last change before the file is written
const SAVE_RETRY_DELAY = 2000;                            // ms before trying again after a write failed
const SAVE_RENAME_TRIES = 5;                              // tries at putting the new file in place
const SAVE_RENAME_PAUSE = 30;                             // ms between those tries
const SAVE_FORMAT = 1;                                    // the file layout's number, for later migrations

// The saved items by key, read from filePath (empty if it is missing or unreadable), and how to change them. Changes
// are written after SAVE_DELAY, in one go, so a dragged window doesn't write the file on every mouse move. A write
// that fails keeps the changes and tries again after retryDelay, rather than crashing the game.
function createSaveStore(filePath, delay = SAVE_DELAY, retryDelay = SAVE_RETRY_DELAY) {
  const items = readSaveFile(filePath);
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    try {
      writeSaveFile(filePath, items);
    } catch (error) {
      console.warn(`Bioforge Lab: the save file could not be written, trying again (${error.code || error.message})`);
      timer = setTimeout(flush, retryDelay);
    }
  };
  return {
    items,
    // keeps value (any JSON value) under key and schedules the write
    set(key, value) {
      items[key] = value;
      if (!timer) timer = setTimeout(flush, delay);
    },
    // writes any change still waiting (on quitting); a failure here is only reported, quitting goes on
    flush() {
      if (!timer) return;
      flush();
      clearTimeout(timer);
      timer = null;
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
  renameWithRetries(temporaryPath, filePath);
}

// Renames from over to, trying again a few times: on Windows a virus scanner, the search indexer or a cloud sync
// that has just opened the save makes the rename fail with EPERM for a moment.
function renameWithRetries(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (error) {
      if (attempt >= SAVE_RENAME_TRIES) throw error;
      pauseFor(SAVE_RENAME_PAUSE);
    }
  }
}

// blocks for ms milliseconds (the write is synchronous so that quitting can flush it)
function pauseFor(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

module.exports = { createSaveStore, readSaveFile, SAVE_DELAY };
