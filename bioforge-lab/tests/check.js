'use strict';
// Test output: check() prints one PASS or FAIL line per check, done() prints the summary and sets the exit code.
let allPassed = true;

// name: what is checked; passed: the result; details: extra text printed after the name (shown mostly on failure)
function check(name, passed, details = '') {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${details}`);
  if (!passed) allPassed = false;
}

// prints the summary, and fails the process if any check failed
function done() {
  console.log(allPassed ? 'ALL PASS' : 'SOME FAIL');
  process.exitCode = allPassed ? 0 : 1;
}

module.exports = { check, done };
