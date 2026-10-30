'use strict';
// Code style (CLAUDE.md "Code rules"): every script starts with 'use strict' and a comment, lines stay within 120
// characters, every function and tuning constant is commented, and the pure and browser-only file lists in CLAUDE.md,
// tests/determinism.js and PLAN.md cover every script.
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./load');
const { check, done } = require('./check');

const MAX_LINE_LENGTH = 120;                              // characters

// the .js files in a folder of the project, as paths relative to the project
const scriptsIn = folder => fs.readdirSync(path.join(ROOT, folder))
  .filter(name => name.endsWith('.js'))
  .map(name => (folder ? folder + '/' + name : name));

const gameScripts = scriptsIn('');
const allScripts = [...gameScripts, ...scriptsIn('data'), ...scriptsIn('tests')];
const readLines = file => fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/);

// one check per rule, naming every place that breaks it
function checkEveryLine(name, findProblems) {
  const problems = allScripts.flatMap(file => findProblems(readLines(file)).map(where => `${file}:${where}`));
  check(name, !problems.length, problems.join(', '));
}

checkEveryLine('every script starts with \'use strict\' and a comment saying what it holds', lines =>
  (lines[0] === '\'use strict\';' && lines[1].startsWith('// ') ? [] : [1]));
checkEveryLine(`no line is longer than ${MAX_LINE_LENGTH} characters`, lines =>
  lines.flatMap((line, i) => ([...line].length > MAX_LINE_LENGTH ? [i + 1] : [])));
checkEveryLine('no var (const by default, let when the value changes)', lines =>
  lines.flatMap((line, i) => (/^\s*var\s/.test(line) ? [i + 1] : [])));
// a function's comment is the line right above it
checkEveryLine('every function declaration has a comment above it', lines =>
  lines.flatMap((line, i) => (/^\s*function\s/.test(line) && !/^\s*\/\//.test(lines[i - 1] || '') ? [i + 1] : [])));
// a tuning value is a top-level constant set to a number
checkEveryLine('every numeric constant has a trailing comment with its unit', lines =>
  lines.flatMap((line, i) => (/^const [A-Z][A-Z0-9_]* = [-\d.(]/.test(line) && !line.includes('//') ? [i + 1] : [])));

// ---------- File lists ----------
// the backticked .js names in a piece of text
const namedScripts = text => [...text.matchAll(/`([\w/]+\.js)`/g)].map(match => match[1]);

const rulesText = fs.readFileSync(path.join(ROOT, '..', 'CLAUDE.md'), 'utf8');
const pureRule = rulesText.split(/\r?\n/).find(line => line.startsWith('- **Pure files have no DOM.**'));
const [pureText, browserText] = pureRule.split('Browser-only code goes in');
const pureFiles = namedScripts(pureText).filter(file => !file.startsWith('data/'));
const browserFiles = namedScripts(browserText);
const unlisted = gameScripts.filter(file => pureFiles.includes(file) === browserFiles.includes(file));
check('CLAUDE.md lists every script as either pure or browser-only, not both', !unlisted.length, unlisted.join(', '));

const determinismText = fs.readFileSync(path.join(ROOT, 'tests', 'determinism.js'), 'utf8');
const checkedFiles = namedScripts(/const SIM_FILES = \[([\s\S]*?)\];/.exec(determinismText)[1].replace(/'/g, '`'));
const uncheckedPure = [...pureFiles, ...scriptsIn('data')].filter(file => !checkedFiles.includes(file));
const checkedBrowser = checkedFiles.filter(file => browserFiles.includes(file));
check('tests/determinism.js checks every pure file, and no browser-only one', !uncheckedPure.length &&
  !checkedBrowser.length, `unchecked: ${uncheckedPure.join(', ')}; browser-only: ${checkedBrowser.join(', ')}`);

const planText = fs.readFileSync(path.join(ROOT, 'PLAN.md'), 'utf8');
const architecture = /## Architecture[\s\S]*?```([\s\S]*?)```/.exec(planText)[1];
const testNames = /tests\/\*\.js[\s\S]*?\(([^)]*)\)/.exec(architecture)[1];
const notInPlan = [
  ...gameScripts.filter(file => !new RegExp(`^${file.replace('.', '\\.')}\\s`, 'm').test(architecture)),
  ...scriptsIn('tests').filter(file => !['load.js', 'dom.js', 'check.js', 'all.js'].includes(path.basename(file)))
    .filter(file => !new RegExp(`\\b${path.basename(file, '.js')}\\b`).test(testNames)),
];
check('PLAN.md\'s architecture lists every script and test file', !notInPlan.length, notInPlan.join(', '));
done();
