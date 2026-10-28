// Built-in designs (full app, fake DOM): the small builds fit the budget; the showcase builds load, run in the
// builder's test tank, and say why they are over the budget.
const { startApp } = require('./dom');
const { check, done } = require('./check');

const SMALL_BUILDS = ['lancer', 'stinger', 'spitter', 'snarer'];
const SHOWCASE_BUILDS = ['eel', 'jelly', 'manta', 'crab'];
const { byId, fire, runFrames, templateButton } = startApp([...SMALL_BUILDS, ...SHOWCASE_BUILDS]);

const cellCount = () => +/Cells: (\d+)/.exec(byId('budget').innerHTML)[1];
const isOverLimit = () => /Over budget|Too many/.test(byId('budget').innerHTML);

runFrames(10);
for (const name of SHOWCASE_BUILDS) {
  templateButton(name).onclick();
  runFrames(60);
  fire('window', 'keydown', { key: ' ' });                 // Space fires the test tank's signal sources
  runFrames(30);
  fire('window', 'keyup', { key: ' ' });
  check(`${name} loads and shows that it is over the budget`, cellCount() > 30 && isOverLimit(),
    `cells ${cellCount()} | ${byId('budget').innerHTML}`);
}
for (const name of SMALL_BUILDS) {
  templateButton(name).onclick();
  runFrames(30);
  check(`${name} loads and fits`, cellCount() >= 15 && !isOverLimit(),
    `cells ${cellCount()} | ${byId('budget').innerHTML}`);
}
byId('start-sandbox').onclick();
runFrames(60);
check('the sandbox starts with it', byId('hud').style.display === 'block' && byId('hud-mode').textContent === 'Sandbox',
  byId('hud-mode').textContent);
done();
