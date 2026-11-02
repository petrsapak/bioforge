'use strict';
// The sound bank (audio/sfx/bank.js) holds every sound effect's WAV file as base64, so Web Audio can play them from a
// page opened from disk. This checks it matches the files; `node tests/soundbank.js --update` writes it again.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, ROOT } = require('./load');
const { check, done } = require('./check');

const BANK_FILE = 'audio/sfx/bank.js';
const BANK_HEADER = [
  '\'use strict\';',
  '// The sound effects\' WAV files as base64 text, by path, so sound.js can decode them for Web Audio on a page',
  '// opened from disk, where fetch can\'t read files (pure data). Written by `node tests/soundbank.js --update` from',
  '// the files data/sounds.js names; don\'t edit it by hand.',
];

// the bank's contents as they should be: every file a sound effect names, read from disk
function expectedBank() {
  const { X: data } = load({}, ['SOUND_EFFECTS']);
  const files = new Set(Object.values(data.SOUND_EFFECTS)
    .flatMap(effect => effect.variants.map(variant => variant.file)));
  return Object.fromEntries([...files].map(file => [file, fs.readFileSync(path.join(ROOT, file)).toString('base64')]));
}

// the bank file's text for these contents, one file per line
function bankText(bank) {
  const entries = Object.entries(bank).map(([file, data]) => `  '${file}': '${data}',`);
  return [...BANK_HEADER, '', 'const SOUND_BANK = {', ...entries, '};', ''].join('\r\n');
}

// the bank as the file on disk holds it, or null if there is none
function savedBank() {
  const file = path.join(ROOT, BANK_FILE);
  if (!fs.existsSync(file)) return null;
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, 'utf8') + '\nthis.bank = SOUND_BANK;', context);
  return context.bank;
}

const expected = expectedBank();
if (process.argv.includes('--update')) {
  fs.writeFileSync(path.join(ROOT, BANK_FILE), bankText(expected));
  console.log(`wrote ${BANK_FILE}: ${Object.keys(expected).length} files`);
}
const saved = savedBank() || {};
const stale = Object.keys(expected).filter(file => saved[file] !== expected[file]);
const extra = Object.keys(saved).filter(file => !(file in expected));
check('the sound bank holds every sound effect\'s file as it is on disk (node tests/soundbank.js --update)',
  !stale.length && !extra.length, `stale or missing: ${stale.join(', ')}; not used: ${extra.join(', ')}`);
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
check('index.html loads the sound bank before sound.js',
  html.indexOf(`src="${BANK_FILE}"`) >= 0 && html.indexOf(`src="${BANK_FILE}"`) < html.indexOf('src="sound.js"'));
done();
