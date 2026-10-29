'use strict';
// node tests/all.js: the desktop build's checks. Its files keep CRLF line endings like the rest of the working tree
// (--fix converts them), and the save file test runs.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEXT_FILES = ['main.js', 'preload.js', 'saves.js', 'copy-game.js', 'package.json', 'tests/all.js',
  'tests/saves.js'];

let failed = false;
for (const file of TEXT_FILES) {
  const fullPath = path.join(ROOT, file);
  const text = fs.readFileSync(fullPath, 'utf8');
  if (!/(^|[^\r])\n/.test(text)) continue;
  if (process.argv.includes('--fix')) {
    fs.writeFileSync(fullPath, text.replace(/\r?\n/g, '\r\n'));
    continue;
  }
  failed = true;
  console.log(`FAIL ${file} has LF line endings (node tests/all.js --fix)`);
}
try {
  process.stdout.write(execFileSync(process.execPath, [path.join(__dirname, 'saves.js')], { encoding: 'utf8' }));
} catch (error) {
  process.stdout.write(error.stdout || String(error));
  failed = true;
}
console.log(failed ? 'desktop: failed' : 'desktop: all passed');
process.exitCode = failed ? 1 : 0;
