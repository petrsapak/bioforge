'use strict';
// node tests/all.js: runs every test file in this folder, and prints each file's result, its failures and a summary.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HELPER_FILES = new Set(['all.js', 'load.js', 'dom.js', 'check.js']);
const LINES_SHOWN_ON_CRASH = 8;                           // last output lines of a test file that crashed

let failedFiles = 0;
for (const file of fs.readdirSync(__dirname).filter(name => name.endsWith('.js') && !HELPER_FILES.has(name))) {
  let output;
  let exitedCleanly = true;
  try {
    output = execFileSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8' });
  } catch (error) {
    output = (error.stdout || '') + (error.stderr || '');
    exitedCleanly = false;
  }
  const failures = output.split('\n').filter(line => line.startsWith('FAIL'));
  const passed = exitedCleanly && !failures.length;
  if (!passed) failedFiles++;
  console.log(`${passed ? 'ok  ' : 'FAIL'} ${file}`);
  if (passed) continue;
  const shown = failures.length ? failures : output.trim().split('\n').slice(-LINES_SHOWN_ON_CRASH);
  for (const line of shown) console.log('     ' + line);
}
console.log(failedFiles ? `${failedFiles} file(s) failed` : 'all passed');
process.exitCode = failedFiles ? 1 : 0;
