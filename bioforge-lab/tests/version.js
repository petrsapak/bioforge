'use strict';
// The version (full app, fake DOM): one number in data/version.js, CHANGELOG.md's top entry and desktop/package.json,
// shown on the keys sheet; and the desktop build's save file standing in for localStorage when the page has it.
const fs = require('fs');
const path = require('path');
const { startApp } = require('./dom');
const { ROOT } = require('./load');
const { check, done } = require('./check');

const SEMANTIC_VERSION = /^\d+\.\d+\.\d+$/;

const { byId, readGlobal, storage } = startApp();
const gameVersion = readGlobal('GAME_VERSION');
check('the version is major.minor.patch', SEMANTIC_VERSION.test(gameVersion), gameVersion);

const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const topEntry = (changelog.match(/^## (\S+)/m) || [])[1];
check('the changelog\'s top entry is this version', topEntry === gameVersion, topEntry);

const desktopPackage = JSON.parse(fs.readFileSync(path.join(ROOT, '..', 'desktop', 'package.json'), 'utf8'));
check('the desktop build has the same version', desktopPackage.version === gameVersion, desktopPackage.version);

check('the keys sheet shows it', byId('game-version').textContent === 'Bioforge Lab ' + gameVersion,
  byId('game-version').textContent);

// the desktop build's preload gives the page window.desktopSaves; readStorage and writeStorage then use it
readGlobal('globalThis.desktopItems = { "bioforge-lab-music-off": "true" }; window.desktopSaves = { ' +
  'getItem: key => (key in desktopItems ? desktopItems[key] : null), ' +
  'setItem: (key, text) => { desktopItems[key] = text; } }');
check('readStorage reads the desktop save', readGlobal('readStorage("music-off", false)') === true);
readGlobal('writeStorage("mirror-axes", [1, 4])');
check('writeStorage writes the desktop save', readGlobal('desktopItems["bioforge-lab-mirror-axes"]') === '[1,4]');
check('and leaves localStorage alone', storage.items['bioforge-lab-mirror-axes'] === undefined);

done();
