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

// the dock: a tab per category, and only the chosen tab's cells show
const dockTabs = () => byId('dock-tabs').children;
const shownSections = () => byId('palette').children.filter(section => section.style.display !== 'none');
check('the dock has a tab per cell category', dockTabs().map(tab => tab.textContent).join() ===
  'Body,Sense,Action,Fluid,Gland', dockTabs().map(tab => tab.textContent).join());
const shownTypes = () => shownSections().flatMap(section => section.children[0].children)
  .map(button => button.dataset.type);
check('at first only the Body tab is open', shownSections().length === 1 && shownTypes().includes('tissue'));
dockTabs()[2].onclick();
check('another tab opens beside it', shownSections().length === 2 && shownTypes().includes('tissue') &&
  shownTypes().includes('muscle') && dockTabs()[2].classList.contains('selected'), shownTypes().join());
check('the open tabs are remembered', storage.items['bioforge-lab-dock-categories'] === '["Body","Action"]',
  storage.items['bioforge-lab-dock-categories']);
dockTabs()[0].onclick();
check('a click closes an open tab', shownSections().length === 1 && !shownTypes().includes('tissue'));
dockTabs()[2].onclick();
check('the last open tab stays open', shownSections().length === 1 && shownTypes().includes('muscle'));
dockTabs()[0].onclick();
dockTabs()[2].onclick();

moveMouseTo(0, 0);
runFrames(15);
check('after 0.25 s the hint shows the cell\'s name and biomass cost', byId('tooltip').style.display === 'block' &&
  /<b>Nucleus<\/b>/.test(byId('tooltip').innerHTML) && /◆ 0/.test(byId('tooltip').innerHTML));
runFrames(55);
check('resting on a cell shows its tooltip with a live example',
  byId('tooltip').style.display === 'block' && /How to use/.test(byId('tooltip').innerHTML));

check('the How to box shows the Body steps', /add the cell/.test(coachSteps()[0].caption) && coachSteps()[0].isDone);
pressKey('h');
check('H opens the keys sheet', byId('keys-sheet').style.display === 'flex');
pressKey('Escape');
check('Esc closes it', byId('keys-sheet').style.display === 'none');

pressKey('Escape');
byId('layer-nerve').onclick();
check('the Nerve view shows the neurons in the dock', byId('dock-bar').textContent === 'Neurons');
moveMouseTo(0, 0);
runFrames(30);
check('in the Nerve view, resting on a placed cell shows no hint', byId('tooltip').style.display !== 'block');
// the fake DOM has no closest(), so the mouse's target hands back the dock button itself
fire('window', 'mousemove', { clientX: 10, clientY: 10, target: { closest: () => neuronButton('delay') } });
runFrames(30);
check('resting on a neuron in the dock shows a hint in the cell hint\'s format, with lanes under the example',
  byId('tooltip').style.display === 'block' && /<b>» Delay<\/b>/.test(byId('tooltip').innerHTML) &&
  /Delay 0.25–3 s/.test(byId('tooltip').innerHTML) && /How to use/.test(byId('tooltip').innerHTML) &&
  /tooltip-traces/.test(byId('tooltip').innerHTML), byId('tooltip').innerHTML);
moveMouseTo(0, 0);
runFrames(1);
check('the How to box switches to the Nerve steps, the next one being to put a neuron in',
  /Pick a neuron/.test(coachSteps()[0].caption) && /neuron goes in/.test(nextCoachStep()), nextCoachStep());
check('with nothing clicked there is no card, and the Traces window shows in the Nerve view',
  byId('card').style.display === 'none' && byId('traces').style.display === '');
neuronButton('command').onclick();
clickHex(1, 0);
check('then the next step is laying a fibre', /a fibre/.test(nextCoachStep()), nextCoachStep());
check('the Traces window traces the new neuron', /numbers match/.test(byId('traces-note').textContent),
  byId('traces-note').textContent);
pressKey('g');
check('a click puts the chosen neuron into a cell, and a letter key binds a Command',
  /Command<\/b> neuron/.test(info()) && /Fires on <b>key G<\/b>/.test(info()), info());
pressKey('r');
check('a reserved key (R) doesn\'t bind it', /Fires on <b>key G<\/b>/.test(info()), info());
pressKey('2');
check('with a Command clicked, 2 still opens the Nerves tab and doesn\'t bind',
  byId('dock-bar').textContent === 'Neurons' && /Fires on <b>key G<\/b>/.test(info()), info());
const unitsBefore = fibreUnitsShown();
moveMouseTo(1, 0);
fire('game', 'mousedown', { ...screenPointOf(1, 0), button: 0, target: canvas });
moveMouseTo(0, 1);
fire('window', 'mouseup', { ...screenPointOf(0, 1), target: canvas });
runFrames(1);
check('a drag from one cell to another lays a fibre', fibreUnitsShown() === unitsBefore + 1,
  `${unitsBefore} -> ${fibreUnitsShown()}`);
// the grid shows each fibre's live signal from the test tank (record what drawFibre is given)
readGlobal('globalThis.drawnFibreValues = []; const drawFibreBefore = drawFibre; ' +
  'drawFibre = (...args) => { globalThis.drawnFibreValues.push(args[3]); return drawFibreBefore(...args); }; 0');
fire('window', 'keydown', { key: ' ' });
runFrames(3);
fire('window', 'keyup', { key: ' ' });
check('holding Space lights the new fibre in the test tank', readGlobal('globalThis.drawnFibreValues').includes(1));
const layFibre = () => {
  moveMouseTo(1, 0);
  fire('game', 'mousedown', { ...screenPointOf(1, 0), button: 0, target: canvas });
  moveMouseTo(0, 1);
  fire('window', 'mouseup', { ...screenPointOf(0, 1), target: canvas });
  runFrames(1);
};
const fromPoint = screenPointOf(1, 0);
const toPoint = screenPointOf(0, 1);
const onTheFibre = {
  clientX: (fromPoint.clientX + toPoint.clientX) / 2,
  clientY: (fromPoint.clientY + toPoint.clientY) / 2,
};
fire('game', 'mousedown', { ...onTheFibre, button: 2, target: canvas });
runFrames(1);
check('a right-click on a fibre removes it and leaves the neuron',
  fibreUnitsShown() === unitsBefore && /Command<\/b> neuron/.test(info()), `units ${fibreUnitsShown()}`);
layFibre();
check('the clicked cell lists its fibres', /out →/.test(info()) && fibreUnitsShown() === unitsBefore + 1, info());
byId('remove-fibre-0').onclick();
check('the × on a fibre in the card removes it', fibreUnitsShown() === unitsBefore && !/out →/.test(info()));
fire('game', 'mousedown', { ...screenPointOf(1, 0), button: 2, target: canvas });
runFrames(1);
check('a right-click on the neuron takes it out', /No neuron/.test(info()), info());
pressKey('1');
check('with no Command clicked, 1 opens the Body tab, which hides the Traces window',
  byId('dock-bar').textContent === 'Cells' && byId('traces').style.display === 'none');

pressKey('3');
check('3 opens the Vessels tab', byId('layer-vessel').classList.contains('selected') &&
  /Vessels/.test(byId('dock-bar').textContent) && /a vessel/.test(nextCoachStep()), nextCoachStep());
moveMouseTo(-1, 0);
fire('game', 'mousedown', { ...screenPointOf(-1, 0), button: 0, target: canvas });
moveMouseTo(0, 1);
fire('window', 'mouseup', { ...screenPointOf(0, 1), target: canvas });
runFrames(1);
check('a drag from the Gill to a Cilia lays a vessel of 2 units', vesselUnitsShown() === 2, String(vesselUnitsShown()));
fire('game', 'mousedown', { ...screenPointOf(0, 1), button: 2, target: canvas });
runFrames(1);
check('a right-click on the vessel removes it', vesselUnitsShown() === 0, String(vesselUnitsShown()));
pressKey('1');
check('1 goes back to the Body tab', byId('dock-bar').textContent === 'Cells');
pressKey('Escape');

clickHex(0, -1, { ctrlKey: true });
clickHex(1, -1, { ctrlKey: true });
fire('game', 'contextmenu', { ...screenPointOf(1, -1), target: canvas });
check('right-clicking the selection opens the save menu', byId('save-menu').style.display === 'block');
byId('save-menu-name').value = 'Front';
byId('save-menu-save').onclick();
const partRow = byId('my-parts').children[0];
check('the selection is saved as a part', !!partRow && /Saved "Front"/.test(byId('message').textContent),
  byId('message').textContent);
check('the library is kept in storage', JSON.parse(storage.items['bioforge-lab-library']).length === 2);

partRow.onclick();
check('clicking the part picks it up as a stamp', /Placing "Front"/.test(info()), info());
const beforeStamp = cellCount();
clickHex(3, -3);
check('a click puts the stamp down (off the body, as planned cells)',
  needs().includes('planned cell'), `cells ${beforeStamp} -> ${cellCount()}`);
pressKey('Escape');

dockButton('bud').onclick();
clickHex(-1, -1);
partRow.onmousedown({ button: 0, target: {}, preventDefault() {} });
moveMouseTo(-1, -1);
fire('window', 'mouseup', { ...screenPointOf(-1, -1), target: canvas });
runFrames(1);
check('dragging the part onto a Bud makes the Bud grow it', /Grows <b>Front<\/b>/.test(info()), info());

fire('game', 'mousedown', { clientX: 800, clientY: 450, button: 1, target: canvas });
fire('window', 'mousemove', { clientX: 1000, clientY: 550, target: canvas });
fire('window', 'mouseup', { clientX: 1000, clientY: 550, target: canvas });
byId('start-sandbox').onclick();
runFrames(5);
pressKey('Escape');
runFrames(1);
moveMouseTo(0, 0);
runFrames(15);
check('back in the builder, the pan is reset: the Nucleus is in the middle of the screen',
  /<b>Nucleus<\/b>/.test(byId('tooltip').innerHTML), byId('tooltip').innerHTML);

check("Bioforge Moba's old library carries over", byId('my-creatures').children.length === 1);
check('the old library is left as it was', storage.items['bioforge-templates'] === OLD_LIBRARY);
done();
