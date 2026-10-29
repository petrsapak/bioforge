'use strict';
// The save file: changes are written together after a delay, survive a reload, and a broken file doesn't lose the
// game (Node only). Prints PASS / FAIL lines.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSaveStore, readSaveFile } = require('../saves');

const TEST_DELAY = 20;                                    // ms, short so the test runs fast
let failures = 0;

// prints one result line
function check(name, passed, detail = '') {
  if (!passed) failures++;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}${passed || detail === '' ? '' : ': ' + detail}`);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'bioforge-saves-'));
  const savePath = path.join(folder, 'nested', 'save.json');

  const store = createSaveStore(savePath, TEST_DELAY);
  check('a missing file starts an empty save', Object.keys(store.items).length === 0);
  store.set('bioforge-lab-music-off', true);
  store.set('bioforge-lab-mirror-axes', [3]);
  check('nothing is written before the delay', !fs.existsSync(savePath));
  await wait(TEST_DELAY * 3);
  check('the changes are written after the delay (folder made too)', fs.existsSync(savePath));
  const reloaded = readSaveFile(savePath);
  check('a reload reads them back', reloaded['bioforge-lab-music-off'] === true &&
    JSON.stringify(reloaded['bioforge-lab-mirror-axes']) === '[3]', JSON.stringify(reloaded));
  check('no temporary file is left', !fs.existsSync(savePath + '.tmp'));

  store.set('bioforge-lab-music-off', false);
  store.flush();
  check('flush writes a waiting change at once', readSaveFile(savePath)['bioforge-lab-music-off'] === false);

  fs.writeFileSync(savePath, '{ "format": 1, "items": { broken');
  const afterBreak = createSaveStore(savePath, TEST_DELAY);
  check('a broken file starts an empty save', Object.keys(afterBreak.items).length === 0);
  check('the broken file is kept beside it', fs.existsSync(savePath + '.broken'));

  fs.rmSync(folder, { recursive: true, force: true });
  console.log(failures ? `${failures} failed` : 'all passed');
  process.exitCode = failures ? 1 : 0;
})();
