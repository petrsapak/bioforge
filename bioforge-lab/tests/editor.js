// The builder (full app, fake DOM), driven by the mouse and keys: placing and removing cells, the tooltip, the Needs
// card, binding a Command, the Traces window, saving a selection and stamping it, giving a Bud a part by dragging, and
// carrying old saves over.
const { startApp } = require('./dom');
const { check, done } = require('./check');

// Bioforge Moba's library, in the old format, as it may sit in the browser's storage
const OLD_LIBRARY = JSON.stringify([{ name: 'Old timer', full: true, cells: [{ q: 0, r: 0, t: 'nucleus' }] }]);
const { byId, fire, runFrames, readGlobal, storage, templateButton } =
  startApp(['clear', 'starter'], { 'bioforge-templates': OLD_LIBRARY });

// where hex (q, r) is on screen: the grid's middle is the screen's middle, at the start zoom (see builderview.js)
const GRID_MIDDLE_X = 1600 / 2;
const GRID_MIDDLE_Y = 900 / 2;
const START_ZOOM = 1.9;
function screenPointOf(q, r) {
  const [x, y] = readGlobal('hexToPixel')(q, r);
  return { clientX: GRID_MIDDLE_X + x * START_ZOOM, clientY: GRID_MIDDLE_Y + y * START_ZOOM };
}
const canvas = byId('game');
const moveMouseTo = (q, r) => {
  fire('game', 'mousemove', { ...screenPointOf(q, r), target: canvas });
  fire('window', 'mousemove', { ...screenPointOf(q, r), target: canvas });
};
const clickHex = (q, r, fields = {}) => {
  moveMouseTo(q, r);
  fire('game', 'mousedown', { ...screenPointOf(q, r), button: 0, target: canvas, ...fields });
  fire('window', 'mouseup', { ...screenPointOf(q, r), target: canvas });
  runFrames(1);
};
const cellCount = () => +/Cells: (\d+)/.exec(byId('budget').innerHTML)[1];
const info = () => byId('info').innerHTML;
const needs = () => byId('needs').innerHTML;
const pressKey = key => {
  fire('window', 'keydown', { key });
  fire('window', 'keyup', { key });
};
// the dock's button for a cell type or a neuron: palette > section > hexagons > buttons
const dockButtons = () => byId('palette').children.flatMap(section => section.children[0].children);
const dockButton = typeName => dockButtons().find(button => button.dataset.type === typeName);
const neuronButton = kind => dockButtons().find(button => button.dataset.neuron === kind);
const fibreUnitsShown = () => +/Fibre: (\d+)/.exec(byId('budget').innerHTML)[1];
const vesselUnitsShown = () => +/Vessels: (\d+)/.exec(byId('budget').innerHTML)[1];
// the How to box's steps: their captions and which is marked next or done
const coachSteps = () => byId('coach-steps').children.map(step => ({
  caption: step.children[1].textContent,
  isNext: step.classList.contains('next'),
  isDone: step.classList.contains('done'),
}));
const nextCoachStep = () => (coachSteps().find(step => step.isNext) || {}).caption || '';

runFrames(5);
// the default Jet comes wired; these steps wire a body from scratch, so they start from the Starter (no neurons)
templateButton('starter').onclick();
runFrames(2);
const startCount = cellCount();
dockButton('tissue').onclick();
clickHex(2, 0);
check('a click on a free hex next to the body places the chosen cell', cellCount() === startCount + 1);
clickHex(2, 0, { button: 2 });
check('a right click removes it', cellCount() === startCount);
check('the limits line shows the Body view\'s limits only', /Cells: /.test(byId('budget').innerHTML) &&
  /title="Fibre: [^"]*" hidden/.test(byId('budget').innerHTML), byId('budget').innerHTML);
check('the Needs card has a row per need and says how long the sugar lasts',
  (needs().match(/class="need-row /g) || []).length === 6 && /Sugar lasts|Burns no sugar/.test(needs()), needs());
dockButton('muscle').onclick();
clickHex(2, 0);
check('a Muscle with no signal source: the Signal row is missing and is the next thing to fix',
  /need-row missing" data-need="signal"/.test(needs()) && /Next:<\/b> Muscles/.test(needs()), needs());
clickHex(2, 0);
check('clicking a placed Muscle shows no card: it has nothing to set up', byId('card').style.display === 'none');
clickHex(2, 0, { button: 2 });
dockButton('tissue').onclick();

// a click on a fluid's Needs row shows that fluid's view; a second click goes back to the normal view. The pressed
// rows tell which view is on screen.
const clickNeedRow = need => byId('needs').onclick({ target: { closest: () => ({ dataset: { need } }) } });
const pressedRows = () => (needs().match(/data-need="\w+" aria-pressed="true"/g) || []).join();
clickNeedRow('oxygen');
check('clicking the Oxygen row shows the oxygen view and marks the row',
  pressedRows() === 'data-need="oxygen" aria-pressed="true"', pressedRows());
clickNeedRow('sugar');
check('clicking the Sugar row switches to the sugar view',
  pressedRows() === 'data-need="sugar" aria-pressed="true"', pressedRows());
clickNeedRow('sugar');
check('clicking it again goes back to the normal view', pressedRows() === '', pressedRows());
for (const need of ['signal', 'blood', 'weapon']) {
  clickNeedRow(need);
  check(`the ${need} row has no view: a click leaves the tab and the view as they were`, pressedRows() === '' &&
    !new RegExp(`data-need="${need}" aria-pressed`).test(needs()) && byId('layer-body').classList.contains('selected'),
    pressedRows());
}

// The fake DOM has no layout, so this reads the style sheet: without a fixed width the side column grows to fit its
// longest line, and a long Next hint stretched the Creature card and How to box across the grid (user, 2026-10-29).
const styleSheet = require('fs').readFileSync(require('path').join(__dirname, '..', 'style.css'), 'utf8');
check('the side column (Creature card, How to) keeps a fixed width',
  /#side-column\s*\{[^}]*\bwidth:\s*\d+px/.test(styleSheet));
