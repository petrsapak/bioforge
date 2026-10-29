'use strict';
// node copy-game.js: copies what the game needs from bioforge-lab/ into game/ before a build, since electron-builder
// packs only files inside this folder. Tests, session logs and plans stay behind (Node only).

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'bioforge-lab');
const TARGET = path.join(__dirname, 'game');
const LEFT_OUT = new Set(['tests', 'sessions', 'PLAN.md', 'CHANGELOG.md']);

fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(SOURCE, TARGET, {
  recursive: true,
  filter: source => !LEFT_OUT.has(path.relative(SOURCE, source).split(path.sep)[0]),
});
console.log('copied the game into', path.relative(process.cwd(), TARGET) || '.');
