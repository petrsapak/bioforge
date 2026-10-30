'use strict';
// Built-in designs (full app, fake DOM): the small builds fit the budget; the showcase builds load, run in the
// builder's test tank, and say why they are over the budget; the Templates window's Examples tab shows every example,
// badging those over the limits.
const { startApp } = require('./dom');
const { check, done } = require('./check');

const SMALL_BUILDS = ['lancer', 'stinger', 'spitter', 'snarer'];
const SHOWCASE_BUILDS = ['eel', 'jelly', 'manta', 'crab'];
const { byId, fire, runFrames, templateButton, readGlobal } = startApp();

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

// the Templates window's Examples tab: every example is a built-in design, with its card
const isBadged = name => templateButton(name).children[3].style.display !== 'none';
const examples = readGlobal('EXAMPLE_GROUPS').flatMap(group => group.examples);
check('every example is a built-in design', examples.every(example => readGlobal('TEMPLATES')[example.template]));
check('the Examples tab shows every example as a card, under its group title',
  examples.every(example => templateButton(example.template).children[1].textContent === example.name) &&
  byId('library-cards').children.filter(child => child.className === 'library-heading').length ===
  readGlobal('EXAMPLE_GROUPS').length);
check('a showcase card is badged as over the limits, saying why, and a small one isn\'t',
  SHOWCASE_BUILDS.every(isBadged) && /Over budget|Too many/.test(templateButton('eel').children[3].title) &&
  !SMALL_BUILDS.some(isBadged));
byId('unlimited-biomass').onclick();
check('with Unlimited biomass the showcase cards lose the badge, unless they break another limit',
  !isBadged('crab') || !/Over budget/.test(templateButton('crab').children[3].title));
byId('unlimited-biomass').onclick();

byId('start-sandbox').onclick();
runFrames(60);
check('the sandbox starts with it', byId('hud').style.display === 'block' && byId('hud-mode').textContent === 'Sandbox',
  byId('hud-mode').textContent);
done();
